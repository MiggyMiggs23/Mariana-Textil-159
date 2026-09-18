import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  db, movimientosCreditoTable, operacionesCreditoE1Table, cobrosCreditoPendientesE1Table,
  sesionesCajaTable, ticketsTable, ubicacionesTable, usuariosTable,
} from "@workspace/db";
import type { Tx } from "./inventario";
import {
  assertCreditActorAccess, assertCreditCaptureEnabled, assertCreditPhysicalContext,
  assertCreditProducerNature, canonicalCreditMoney, claimCreditOperationCore,
  CREDIT_PENDING_RECEIPTS_ENABLED, CreditEvidenceError, readCreditEvidenceInput,
  type CreditEvidenceInput, type CreditProducer, type CreditOperationClaim, type CreditOperationResult,
} from "./credit-evidence-contract";
export * from "./credit-evidence-contract";

/** No session or domain-state validation here: current access is checked on replay too. */
export async function assertCreditEvidenceAccess(req: Request, input: CreditEvidenceInput, tx: Tx | typeof db = db): Promise<void> {
  if (!req.auth?.user) throw new CreditEvidenceError("E1: sesión de usuario requerida.", 401);
  const [actor] = await tx.select({
    id: usuariosTable.id, activo: usuariosTable.activo, rol: usuariosTable.rol, ubicacionId: usuariosTable.ubicacionId,
  }).from(usuariosTable).where(eq(usuariosTable.id, req.auth.user.id)).for("share").limit(1);
  assertCreditActorAccess(actor, input.sitioOrigenId);
}

export async function assertCreditEvidenceScope(req: Request, input: CreditEvidenceInput, tx: Tx | typeof db = db): Promise<void> {
  await assertCreditEvidenceAccess(req, input, tx);
  const [site] = await tx.select().from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, input.sitioOrigenId)).for("share").limit(1);
  if (!site?.activa || site.tipo !== "TIENDA") throw new CreditEvidenceError("E1: el sitio de origen debe ser una TIENDA activa.");
  if (input.sesionCajaId != null) {
    const [session] = await tx.select().from(sesionesCajaTable)
      .where(eq(sesionesCajaTable.id, input.sesionCajaId)).for("share").limit(1);
    if (!session || session.ubicacionId !== input.sitioOrigenId || session.estado !== "ABIERTA" || session.cerradaAt != null) {
      throw new CreditEvidenceError("E1: la sesión debe estar abierta y pertenecer al mismo sitio.");
    }
  }
}

/** Transaction MUST encompass this claim, its movement and all associated side effects. */
export async function claimCreditOperation(tx: Tx, input: CreditOperationClaim): Promise<CreditOperationResult<typeof movimientosCreditoTable.$inferSelect>> {
  return claimCreditOperationCore({
    async loadOperation(productor, clave) {
      const [stored] = await tx.select().from(operacionesCreditoE1Table).where(and(
        eq(operacionesCreditoE1Table.productor, productor), eq(operacionesCreditoE1Table.clave, clave),
      )).limit(1);
      return stored ?? null;
    },
    async insertOperation(record) {
      const inserted = await tx.insert(operacionesCreditoE1Table).values(record)
        .onConflictDoNothing({ target: [operacionesCreditoE1Table.productor, operacionesCreditoE1Table.clave] }).returning();
      return inserted.length > 0;
    },
    async loadMovement(productor, clave) {
      // READ COMMITTED SELECT after ON CONFLICT sees the winner after it commits.
      const [movement] = await tx.select().from(movimientosCreditoTable).where(and(
        eq(movimientosCreditoTable.operacionProductor, productor), eq(movimientosCreditoTable.operacionClave, clave),
      )).limit(1);
      return movement ?? null;
    },
  }, input);
}

export async function insertCreditMovementE1(
  tx: Tx,
  movement: typeof movimientosCreditoTable.$inferInsert,
  input: CreditEvidenceInput,
  productor: CreditProducer,
): Promise<typeof movimientosCreditoTable.$inferSelect> {
  const evidence = readCreditEvidenceInput(input);
  assertCreditProducerNature(productor, evidence.naturaleza);
  assertCreditCaptureEnabled(evidence, movement.formaPago);
  assertCreditPhysicalContext(evidence, movement.formaPago, movement.cuentaDestino);
  const importe = canonicalCreditMoney(movement.importe);
  const amount = Number(importe);
  const compatible =
    (productor === "VENTA_CREDITO" && movement.tipo === "VENTA_CREDITO" && amount > 0) ||
    (["ABONO_ORDINARIO", "ABONO_DIRIGIDO"].includes(productor) && movement.tipo === "ABONO" && amount < 0) ||
    (productor === "REVERSO_ABONO" && movement.tipo === "REVERSO" && amount > 0) ||
    (productor === "CANCELACION_VENTA_CREDITO" && movement.tipo === "REVERSO" && amount < 0) ||
    (productor === "AJUSTE_MANUAL" && movement.tipo === "AJUSTE" && !movement.esIncobrable && amount !== 0) ||
    (productor === "BAJA_INCOBRABLE" && movement.tipo === "AJUSTE" && movement.esIncobrable === true && amount < 0);
  if (!compatible) throw new CreditEvidenceError("E1: productor incompatible con tipo/signo/incobrable.");
  if (movement.tipo === "AJUSTE" && evidence.notaOrigenId == null && !evidence.origenJustificacion) {
    throw new CreditEvidenceError("E1: ajuste sin nota identificada exige justificación de origen.");
  }
  if (productor === "BAJA_INCOBRABLE" && !movement.motivoIncobrable?.trim()) {
    throw new CreditEvidenceError("E1: baja incobrable exige motivo.");
  }
  if (evidence.notaOrigenId != null) {
    const [note] = await tx.select().from(ticketsTable)
      .where(eq(ticketsTable.id, evidence.notaOrigenId)).for("share").limit(1);
    if (!note || note.documentoTipo !== "NOTA" || note.clienteId !== movement.clienteId || note.ubicacionId !== evidence.sitioOrigenId) {
      throw new CreditEvidenceError("E1: nota de origen debe ser NOTA del mismo cliente y sitio atribuido.");
    }
  }
  const [row] = await tx.insert(movimientosCreditoTable).values({
    ...movement, importe, ...evidence, operacionProductor: productor,
  }).returning();
  if (!row) throw new CreditEvidenceError("E1: el movimiento no pudo registrarse.", 500);
  return row;
}

/** Future support only. Guard is before ANY database interaction, including claim.
 * The pending receipt is never an ABONO and never enters FIFO's ledger. */
export async function insertPendingCreditReceiptE1(
  tx: Tx, receipt: typeof cobrosCreditoPendientesE1Table.$inferInsert,
): Promise<typeof cobrosCreditoPendientesE1Table.$inferSelect> {
  if (!CREDIT_PENDING_RECEIPTS_ENABLED) throw new CreditEvidenceError("E1: el modo de cobro retenido permanece deshabilitado.", 403);
  const evidence = readCreditEvidenceInput(receipt);
  assertCreditProducerNature("COBRO_PENDIENTE", evidence.naturaleza);
  assertCreditCaptureEnabled(evidence, receipt.medio);
  assertCreditPhysicalContext(evidence, receipt.medio, receipt.cuentaDestino);
  if (receipt.operacionProductor !== "COBRO_PENDIENTE") throw new CreditEvidenceError("E1: productor exclusivo de cobro pendiente requerido.");
  const importe = canonicalCreditMoney(receipt.importe);
  if (Number(importe) <= 0 || !Number.isFinite(receipt.fechaReal.getTime()) || !(receipt.motivo?.trim() || receipt.referencia?.trim())) {
    throw new CreditEvidenceError("E1: cobro pendiente requiere importe positivo, fecha real y motivo o referencia.");
  }
  const [row] = await tx.insert(cobrosCreditoPendientesE1Table).values({ ...receipt, importe }).returning();
  if (!row) throw new CreditEvidenceError("E1: el cobro pendiente no pudo registrarse.", 500);
  return row;
}