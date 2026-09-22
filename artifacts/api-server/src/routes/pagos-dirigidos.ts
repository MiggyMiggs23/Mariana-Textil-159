import { Router, type IRouter } from "express";
import { E12_SUPPLIER_CASH_ENABLED, E12Error, requireE12, payE12, e12Scope, type E12Actor, type E12Split } from "../lib/e12-supplier-cash";
import { e12Actor, e12CaptureInput, e12NumberAmount, e12ApprovedSplit } from "../lib/e12-http";
import { e12Repository, readE12Detail } from "../lib/e12-supplier-cash-repository";
import { beginE12Directed, saveE12Directed, readE12Directed } from "../lib/e12-directed";
import { assertE3DirectedExact } from "../lib/e3-collection";
import { sql } from "drizzle-orm";
import { CreateSolicitudPagoDirigidoBody, CreateSolicitudPagoDirigidoResponse, AprobarSolicitudPagoDirigidoParams, AprobarSolicitudPagoDirigidoResponse, RechazarSolicitudPagoDirigidoParams, RechazarSolicitudPagoDirigidoBody, RechazarSolicitudPagoDirigidoResponse, ListSolicitudesPagoDirigidoResponse } from "@workspace/api-zod";
import {
  aplicacionesCreditoTable,
  aplicacionesPagoProveedorTable,
  auditoriaTable,
  db,
  movimientosCreditoTable,
  notificacionesSistemaTable,
  pagosProveedorTable,
  solicitudesPagoDirigidoTable,
} from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import { requireRole, requireSession } from "../middlewares/auth";
import { resolvePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { loadCustomerCreditProjectionInTransaction } from "../lib/credit-aging-read-model";
import { centsToMoney, moneyToCents } from "../lib/credit-allocation";
import type { Tx } from "../lib/inventario";
import {
  readCreditEvidenceInput, canonicalCreditContent, canonicalCreditMoney,
  assertCreditProducerNature, assertCreditCaptureEnabled, assertCreditEvidenceScope,
  assertCreditEvidenceAccess, assertCreditPhysicalContext,
  claimCreditOperation, insertCreditMovementE1, CreditEvidenceError,
  type CreditEvidenceInput,
} from "../lib/credit-evidence";
import {
  evaluateAbonoEvidence,
  finalizePhysicalAbonoEvidence,
} from "../lib/credit-abono-evidence";

const router: IRouter = Router();
router.use("/pagos-dirigidos", requireSession);

type Kind = "CLIENTE" | "PROVEEDOR";
type Payment = { tipo: Kind; entidadId: number; documentoMovimientoId: number; importe: number; formaPago: string; cuentaDestino?: string | null; fechaEfectiva?: Date | null; referencia?: string | null; notas?: string | null; motivo: string };
type DirectedPaymentRequest = Pick<
  typeof solicitudesPagoDirigidoTable.$inferSelect,
  "id" | "tipo" | "entidadId" | "documentoMovimientoId" | "importe" | "formaPago" |
  "cuentaDestino" | "fechaEfectiva" | "referencia" | "notas" | "motivo"
>;
type DirectedPaymentInput = Omit<DirectedPaymentRequest, "importe"> & {
  importe: string | number;
};
type DirectedDocumentRow = {
  id: number; ticket_id?: number | null; importe: string;
};
type SupplierAppliedTotalRow = { total: string };
type UserNameRow = { nombre: string };
type DirectedSnapshotRow = {
  contraparte: string; folio: string | null; ubicacion_id: number | null;
  ubicacion_nombre: string | null;
};
type DirectedRequestRow = typeof solicitudesPagoDirigidoTable.$inferSelect;
type DirectedRequestRawRow = {
  id: number; tipo: Kind; entidad_id: number; documento_movimiento_id: number;
  importe: string; forma_pago: string; cuenta_destino: string | null;
  fecha_efectiva: Date | null; referencia: string | null; notas: string | null;
  motivo: string; motivo_rechazo: string | null; solicitante_id: number;
  solicitante_nombre: string; autorizador_id: number | null;
  autorizador_nombre: string | null; contraparte_nombre: string;
  documento_folio: string | null; ubicacion_id: number | null;
  ubicacion_nombre: string | null; movimiento_id: number | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA"; created_at: Date;
};

/** Deliberately whitelist monetary intent; never persist raw HTTP/auth fields. */
export function directedCreditIntent(data: Payment, evidence: CreditEvidenceInput) {
  return {
    tipo: data.tipo, entidadId: data.entidadId, documentoMovimientoId: data.documentoMovimientoId,
    importe: canonicalCreditMoney(data.importe), formaPago: data.formaPago,
    destinos: [{ ventaMovimientoId: data.documentoMovimientoId, importe: canonicalCreditMoney(data.importe) }],
    cuentaDestino: data.cuentaDestino ?? null,
    fechaEfectiva: data.fechaEfectiva ? new Date(data.fechaEfectiva).toISOString() : null,
    referencia: data.referencia ?? null, notas: data.notas ?? null, motivo: data.motivo,
    ...evidence,
  };
}

type DirectedE1 = { evidence: CreditEvidenceInput; intent: ReturnType<typeof directedCreditIntent> };
async function loadDirectedEvidence(tx: Tx, id: number): Promise<DirectedE1> {
  const audit = await tx.execute<{ e1: DirectedE1 }>(sql`
    SELECT datos_despues->'e1' e1 FROM auditoria
    WHERE entidad='solicitudes_pago_dirigido' AND entidad_id=${String(id)}
      AND accion IN ('SOLICITAR_PAGO_DIRIGIDO','APROBAR_APLICAR_PAGO_DIRIGIDO')
      AND datos_despues->'e1' IS NOT NULL ORDER BY id LIMIT 1`);
  if (!audit.rows[0]?.e1) throw new CreditEvidenceError("Solicitud antigua sin origen E1. Actualiza la aplicación y registra una nueva solicitud.", 400);
  return audit.rows[0].e1;
}

export function assertDirectedApprovalIdentity(stored: DirectedE1, supplied: CreditEvidenceInput) {
  if (canonicalCreditContent(stored.evidence) !== canonicalCreditContent(supplied)) {
    throw new CreditEvidenceError("La identidad y el origen deben coincidir con la solicitud dirigida original.", 409);
  }
}

async function notifyRequesterResolved(
  tx: Tx,
  request: { id: number; solicitanteId: number; estado: "APROBADA" | "RECHAZADA" },
) {
  const approved = request.estado === "APROBADA";
  await tx.insert(notificacionesSistemaTable).values({
    tipo: "PAGO_DIRIGIDO_RESUELTO",
    titulo: `Pago dirigido ${approved ? "aprobado" : "rechazado"}`,
    mensaje: `Tu solicitud de pago dirigido fue ${approved ? "aprobada" : "rechazada"}.`,
    entidad: "solicitudes_pago_dirigido",
    entidadId: String(request.id),
    destinatarioUsuarioId: request.solicitanteId,
  }).onConflictDoNothing();
}
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
function parsePayment(body: unknown): Payment | null {
  const parsed = CreateSolicitudPagoDirigidoBody.safeParse(body);
  if (!parsed.success || parsed.data.motivo.trim().length < 10) return null;
  return {
    tipo: parsed.data.tipo, entidadId: parsed.data.entidadId,
    documentoMovimientoId: parsed.data.documentoMovimientoId, importe: parsed.data.importe,
    formaPago: parsed.data.formaPago, motivo: parsed.data.motivo.trim(),
    referencia: parsed.data.referencia ?? null, notas: parsed.data.notas ?? null,
    cuentaDestino: parsed.data.cuentaDestino ?? null, fechaEfectiva: parsed.data.fechaEfectiva ?? null,
  };
}

async function assertDocumentBalance(tx: Tx, request: Pick<DirectedPaymentInput, "tipo" | "entidadId" | "documentoMovimientoId" | "importe">, exactCustomerBalance = false) {
  const supplier = request.tipo === "PROVEEDOR";
  await transactionAdvisoryLock(
    tx,
    supplier
      ? ADVISORY_LOCK_NAMESPACES.SUPPLIER_LEDGER
      : ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
    request.entidadId,
  );
  const document = await tx.execute<DirectedDocumentRow>(supplier ? sql`
    SELECT p.id,p.importe::text FROM pagos_proveedor p WHERE p.id=${request.documentoMovimientoId}
      AND p.proveedor_id=${request.entidadId} AND p.tipo='COMPRA' FOR UPDATE`
    : sql`SELECT m.id,m.ticket_id,m.importe::text FROM movimientos_credito m WHERE m.id=${request.documentoMovimientoId}
      AND m.cliente_id=${request.entidadId} AND m.tipo='VENTA_CREDITO' FOR UPDATE`);
  const doc = document.rows[0];
  if (!doc) throw new Error("DIRECTED_DOCUMENT_NOT_FOUND");
  let availableCents: number;
  if (supplier) {
    const used = await tx.execute<SupplierAppliedTotalRow>(sql`
      SELECT COALESCE(SUM(a.importe),0)::text total
      FROM aplicaciones_pago_proveedor a
      JOIN pagos_proveedor p ON p.id=a.pago_proveedor_id
      WHERE a.compra_proveedor_id=${doc.id}
        AND NOT EXISTS (
          SELECT 1 FROM pagos_proveedor r
          WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=p.id
        )
    `);
    availableCents =
      moneyToCents(doc.importe) -
      moneyToCents(used.rows[0]?.total ?? "0");
  } else {
    const projection = await loadCustomerCreditProjectionInTransaction(
      request.entidadId,
      tx,
    );
    availableCents =
      projection.allCharges.find(
        (charge) => charge.movimientoId === Number(doc.id),
      )?.pendienteCents ?? 0;
  }
  const requestedCents = moneyToCents(request.importe);
  if (exactCustomerBalance && request.tipo === "CLIENTE") {
    try { assertE3DirectedExact(false, requestedCents, [availableCents]); }
    catch { throw new CreditEvidenceError("P6: sin ADMIN el pago dirigido exige el saldo pendiente exacto.", 409); }
  }
  if (requestedCents > availableCents) throw new Error("DIRECTED_AMOUNT_EXCEEDS_DOCUMENT");
  return doc;
}

async function apply(tx: Tx, request: DirectedPaymentRequest, userId: number, evidence?: CreditEvidenceInput, e12?: { actor: E12Actor; split: E12Split }) {
  const supplier = request.tipo === "PROVEEDOR";
  if (supplier && request.formaPago === "EFECTIVO" && E12_SUPPLIER_CASH_ENABLED) {
    if (!e12) throw new E12Error("E12_REQUEST_ORIGIN_REQUIRED", "La solicitud requiere origen E12 persistido.");
    return (await payE12(e12Repository(tx), e12.actor, {
      proveedorId: request.entidadId, importe: e12NumberAmount(Number(request.importe)), split: e12.split,
      documentoDirigidoId: request.documentoMovimientoId,
      fecha: request.fechaEfectiva ? new Date(request.fechaEfectiva).toISOString() : null,
      referencia: request.referencia, notas: request.notas,
    })).pago;
  }
  const doc = await assertDocumentBalance(tx, request);
  const requestedCents = moneyToCents(request.importe);
  const amount = centsToMoney(requestedCents);
  if (!supplier && !evidence) throw new CreditEvidenceError("Falta el origen E1. Actualiza la aplicación.", 400);
  const movement = supplier
    ? (await tx.insert(pagosProveedorTable).values({ proveedorId: request.entidadId, importe: `-${amount}`, tipo: "PAGO", formaPago: request.formaPago as "EFECTIVO" | "TRANSFERENCIA" | "FACTURADO", referencia: request.referencia, notas: request.notas, fecha: request.fechaEfectiva ? new Date(request.fechaEfectiva) : new Date(), usuarioId: userId }).returning())[0]!
    : await insertCreditMovementE1(tx, { clienteId: request.entidadId, ticketId: doc.ticket_id!, importe: `-${amount}`, tipo: "ABONO", formaPago: request.formaPago as "EFECTIVO" | "TRANSFERENCIA" | "FACTURADO", cuentaDestino: request.cuentaDestino, referencia: request.referencia, notas: request.notas, usuarioId: userId, createdAt: request.fechaEfectiva ? new Date(request.fechaEfectiva) : new Date(), metadata: JSON.stringify({ origen: "PAGO_DIRIGIDO", solicitudId: request.id, motivo: request.motivo }) }, evidence!, "ABONO_DIRIGIDO");
  if (supplier) await tx.insert(aplicacionesPagoProveedorTable).values({ pagoProveedorId: movement.id, compraProveedorId: doc.id, importe: amount });
  else {
    await tx.insert(aplicacionesCreditoTable).values({ abonoMovimientoId: movement.id, ventaMovimientoId: doc.id, importe: amount });
    await finalizePhysicalAbonoEvidence(tx, {
      movementId: movement.id,
      productor: "ABONO_DIRIGIDO",
      formaPago: request.formaPago,
      cuentaDestino: request.cuentaDestino,
      evidence: evidence!,
      evaluation: evaluateAbonoEvidence(requestedCents, [{
        targetId: Number(doc.id),
        appliedCents: requestedCents,
      }]),
    });
  }
  return movement;
}

async function snapshots(tx: Tx, data: Payment, userId: number) {
  const user = await tx.execute<UserNameRow>(sql`SELECT nombre FROM usuarios WHERE id=${userId}`);
  const document = await tx.execute<DirectedSnapshotRow>(data.tipo === "CLIENTE" ? sql`
    SELECT c.nombre contraparte, CONCAT('Nota ',t.folio) folio, t.ubicacion_id, u.nombre ubicacion_nombre FROM movimientos_credito m
    JOIN clientes c ON c.id=m.cliente_id JOIN tickets t ON t.id=m.ticket_id JOIN ubicaciones u ON u.id=t.ubicacion_id
    WHERE m.id=${data.documentoMovimientoId} AND m.cliente_id=${data.entidadId} AND m.tipo='VENTA_CREDITO'`
    : sql`SELECT p.nombre contraparte, CONCAT('Compra ',e.folio) folio, e.ubicacion_id, u.nombre ubicacion_nombre FROM pagos_proveedor pp
    JOIN proveedores p ON p.id=pp.proveedor_id LEFT JOIN entradas e ON e.id=pp.entrada_id LEFT JOIN ubicaciones u ON u.id=e.ubicacion_id
    WHERE pp.id=${data.documentoMovimientoId} AND pp.proveedor_id=${data.entidadId} AND pp.tipo='COMPRA'`);
  if (!document.rows[0]) throw new Error("DIRECTED_DOCUMENT_NOT_FOUND");
  const rawLocationId = document.rows[0].ubicacion_id;
  return { solicitanteNombre: String(user.rows[0]?.nombre ?? ""), contraparteNombre: String(document.rows[0].contraparte), documentoFolio: String(document.rows[0].folio ?? "Sin folio"), ubicacionId: rawLocationId == null ? null : Number(rawLocationId), ubicacionNombre: document.rows[0].ubicacion_nombre == null ? null : String(document.rows[0].ubicacion_nombre) };
}

function present(row: DirectedRequestRow | DirectedRequestRawRow) {
  if ("entidadId" in row) {
    return {
      id: Number(row.id), tipo: row.tipo, entidadId: Number(row.entidadId),
      documentoMovimientoId: Number(row.documentoMovimientoId),
      importe: String(row.importe), formaPago: row.formaPago,
      cuentaDestino: row.cuentaDestino ?? null, fechaEfectiva: row.fechaEfectiva ?? null,
      referencia: row.referencia ?? null, notas: row.notas ?? null, motivo: row.motivo,
      motivoRechazo: row.motivoRechazo ?? null,
      solicitanteId: Number(row.solicitanteId), solicitanteNombre: row.solicitanteNombre,
      autorizadorId: row.autorizadorId ?? null, autorizadorNombre: row.autorizadorNombre ?? null,
      contraparteNombre: row.contraparteNombre, documentoFolio: row.documentoFolio,
      ubicacionId: row.ubicacionId ?? null, ubicacionNombre: row.ubicacionNombre ?? null,
      movimientoId: row.movimientoId ?? null, estado: row.estado, createdAt: row.createdAt,
    };
  }
  return {
    id: Number(row.id), tipo: row.tipo, entidadId: Number(row.entidad_id),
    documentoMovimientoId: Number(row.documento_movimiento_id),
    importe: String(row.importe), formaPago: row.forma_pago,
    cuentaDestino: row.cuenta_destino ?? null, fechaEfectiva: row.fecha_efectiva ?? null,
    referencia: row.referencia ?? null, notas: row.notas ?? null, motivo: row.motivo,
    motivoRechazo: row.motivo_rechazo ?? null,
    solicitanteId: Number(row.solicitante_id), solicitanteNombre: row.solicitante_nombre,
    autorizadorId: row.autorizador_id ?? null, autorizadorNombre: row.autorizador_nombre ?? null,
    contraparteNombre: row.contraparte_nombre, documentoFolio: row.documento_folio,
    ubicacionId: row.ubicacion_id ?? null, ubicacionNombre: row.ubicacion_nombre ?? null,
    movimientoId: row.movimiento_id ?? null, estado: row.estado, createdAt: row.created_at,
  };
}

router.get("/pagos-dirigidos", async (req, res, next): Promise<void> => {
  try {
    const raw = req.query as Record<string, unknown>;
    const entityId = raw.entidadId == null ? undefined : positiveId(raw.entidadId);
    const tipo = raw.tipo === "CLIENTE" || raw.tipo === "PROVEEDOR" ? raw.tipo : undefined;
    const estado = raw.estado === "PENDIENTE" || raw.estado === "APROBADA" || raw.estado === "RECHAZADA" ? raw.estado : undefined;
    if ((raw.entidadId != null && !entityId) || (raw.tipo != null && !tipo) || (raw.estado != null && !estado)) { res.status(400).json({ error: "Filtros inválidos." }); return; }
    const filters = { entidadId: entityId, tipo, estado };
    let visible: Kind[] = ["CLIENTE", "PROVEEDOR"];
    if (req.auth!.user.rol !== "ADMIN") {
      const [cliente, proveedor] = await Promise.all([
        resolvePermiso(req.auth!.user.id, req.auth!.user.rol, "clientes_finanzas"),
        resolvePermiso(req.auth!.user.id, req.auth!.user.rol, "proveedores_finanzas"),
      ]);
      visible = ([cliente?.puedeVer || cliente?.puedeCrear ? "CLIENTE" : null, proveedor?.puedeVer || proveedor?.puedeCrear ? "PROVEEDOR" : null].filter(Boolean) as Kind[]);
    }
    if (!visible.length) { res.json(ListSolicitudesPagoDirigidoResponse.parse({ solicitudes: [] })); return; }
    const rows = await db.execute<DirectedRequestRawRow>(sql`SELECT * FROM solicitudes_pago_dirigido WHERE tipo = ANY(ARRAY[${sql.join(visible.map((v) => sql`${v}`), sql`, `)}]::tipo_solicitud_pago_dirigido[])
      ${filters.tipo ? sql`AND tipo=${filters.tipo}` : sql``}
      ${filters.entidadId ? sql`AND entidad_id=${filters.entidadId}` : sql``}
      ${filters.estado ? sql`AND estado=${filters.estado}` : sql``}
      ${req.auth!.user.rol === "ADMIN" ? sql`` : sql`AND solicitante_id=${req.auth!.user.id}`}
      ORDER BY created_at DESC, id DESC`);
    const response = ListSolicitudesPagoDirigidoResponse.parse({ solicitudes: rows.rows.map(present) });
    const requests = await Promise.all(response.solicitudes.map(async (request) => {
      if (request.tipo !== "CLIENTE") {
        const split = await readE12Directed(db, request.id, req.auth!.user.rol);
        return split ? { ...request, efectivoE12: split } : request;
      }
      const audit = await db.execute<{ evidence: CreditEvidenceInput }>(sql`
        SELECT datos_despues->'e1'->'evidence' evidence FROM auditoria
        WHERE entidad='solicitudes_pago_dirigido' AND entidad_id=${String(request.id)}
          AND datos_despues->'e1' IS NOT NULL ORDER BY id LIMIT 1`);
      return { ...request, ...(audit.rows[0]?.evidence ?? {}) };
    }));
    res.json({ ...response, solicitudes: requests });
  } catch (error) { next(error); }
});

router.post("/pagos-dirigidos", async (req, res, next): Promise<void> => {
  try {
    // Validate legacy customer producers before generated schemas can mask the
    // actionable update-app error. Supplier payment behavior is unchanged.
    const rawEvidence = req.body?.tipo === "CLIENTE" ? readCreditEvidenceInput(req.body) : undefined;
    const data = parsePayment(req.body);
    if (!data) { res.status(400).json({ error: "Datos inválidos; motivo de al menos 10 caracteres es obligatorio." }); return; }
    if (data.tipo === "CLIENTE" && (req.body.efectivoE12 !== undefined || req.body.aprobacionE12 !== undefined))
      throw new E12Error("E12_PAYMENT_METHOD", "E12 no corresponde a pagos de cliente.");
    const splitE12 = data.tipo === "PROVEEDOR" ? e12CaptureInput(data.formaPago, req.body.efectivoE12) : undefined;
    const actorE12 = e12Actor(req.auth!.user, getRequestIp(req));
    if (E12_SUPPLIER_CASH_ENABLED && data.tipo === "PROVEEDOR") e12Scope(actorE12);
    if (req.auth!.user.rol !== "ADMIN") {
      const permission = await resolvePermiso(req.auth!.user.id, req.auth!.user.rol, data.tipo === "CLIENTE" ? "clientes_finanzas" : "proveedores_finanzas");
      if (!permission?.puedeCrear) { res.status(403).json({ error: "No tienes permiso para solicitar este pago dirigido." }); return; }
    }
    const evidence = data.tipo === "CLIENTE" ? rawEvidence ?? readCreditEvidenceInput(req.body) : undefined;
    const e1 = evidence ? { evidence, intent: directedCreditIntent(data, evidence) } : undefined;
    const effectiveDate = data.fechaEfectiva ? new Date(data.fechaEfectiva) : new Date();
    if (Number.isNaN(effectiveDate.getTime()) || effectiveDate > new Date() || Math.round(data.importe * 100) < 1) { res.status(400).json({ error: "Fecha efectiva inválida o futura, o monto menor a un centavo." }); return; }
    const valid = data.tipo === "CLIENTE"
      ? ["EFECTIVO", "TRANSFERENCIA", "FACTURADO"].includes(data.formaPago) && ((data.formaPago === "EFECTIVO" && data.cuentaDestino === "CAJA_FISICA") || (data.formaPago === "TRANSFERENCIA" && ["CUENTA_FISCAL", "CUENTA_NO_FISCAL"].includes(data.cuentaDestino ?? "")) || (data.formaPago === "FACTURADO" && data.cuentaDestino === "CUENTA_FISCAL"))
      : ["EFECTIVO", "TRANSFERENCIA", "FACTURADO"].includes(data.formaPago);
    if (!valid || (data.tipo === "CLIENTE" && data.formaPago === "TRANSFERENCIA" && !data.referencia)) { res.status(400).json({ error: "Forma de pago, cuenta destino o referencia inválida." }); return; }
    const result = await db.transaction(async (tx) => {
      const isAdmin = req.auth!.user.rol === "ADMIN";
      const claimE12 = splitE12 ? await beginE12Directed(tx, actorE12, data.entidadId, e12NumberAmount(data.importe), splitE12, data) : undefined;
      if (claimE12?.previousId) {
        const [previous] = await tx.select().from(solicitudesPagoDirigidoTable).where(sql`${solicitudesPagoDirigidoTable.id}=${claimE12.previousId}`);
        if (!previous) throw new E12Error("E12_NOT_FOUND", "La solicitud original no está disponible.", 409);
        return { request: previous, movement: null };
      }
      if (!isAdmin && req.auth!.user.alcanceConsulta !== "TODAS") {
        const site = await tx.execute(data.tipo === "CLIENTE" ? sql`
          SELECT t.ubicacion_id FROM movimientos_credito m
          JOIN tickets t ON t.id=m.ticket_id
          WHERE m.id=${data.documentoMovimientoId} AND m.cliente_id=${data.entidadId}`
          : sql`SELECT e.ubicacion_id FROM pagos_proveedor p
          JOIN entradas e ON e.id=p.entrada_id
          WHERE p.id=${data.documentoMovimientoId} AND p.proveedor_id=${data.entidadId}`);
        if (Number(site.rows[0]?.ubicacion_id) !== req.auth!.user.ubicacionId) {
          throw new Error("DIRECTED_DOCUMENT_OUT_OF_SCOPE");
        }
      }
      if (e1) {
        await assertCreditEvidenceAccess(req, e1.evidence, tx);
        // Submission is an authorization request, NOT a receipt. Serialize its UUID
        // and retain its identity in the same existing immutable audit transaction.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('E1_ABONO_DIRIGIDO'), hashtext(${e1.evidence.operacionClave}))`);
        const previous = await tx.execute<{ request_id: string; actor: number; e1: DirectedE1 }>(sql`
          SELECT entidad_id request_id, usuario_id actor, datos_despues->'e1' e1 FROM auditoria
          WHERE entidad='solicitudes_pago_dirigido'
            AND datos_despues->'e1'->'evidence'->>'operacionClave'=${e1.evidence.operacionClave}
            AND accion IN ('SOLICITAR_PAGO_DIRIGIDO','APROBAR_APLICAR_PAGO_DIRIGIDO')
          ORDER BY id LIMIT 1`);
        if (previous.rows[0]) {
          const old = previous.rows[0];
          if (Number(old.actor) !== req.auth!.user.id || canonicalCreditContent(old.e1.intent) !== canonicalCreditContent(e1.intent)) {
            throw new CreditEvidenceError("La clave de operación ya identifica otro contenido de pago dirigido.", 409);
          }
          const existing = await tx.select().from(solicitudesPagoDirigidoTable)
            .where(sql`${solicitudesPagoDirigidoTable.id}=${Number(old.request_id)}`).limit(1);
          if (!existing[0]) throw new CreditEvidenceError("La solicitud original ya no está disponible.", 409);
          return { request: existing[0], movement: null };
        }
        if (isAdmin) {
          const claim = await claimCreditOperation(tx, {
            productor: "ABONO_DIRIGIDO", clave: e1.evidence.operacionClave,
            naturaleza: e1.evidence.naturaleza, actorId: req.auth!.user.id,
            contenido: e1.intent,
          });
          if (claim.replay) throw new CreditEvidenceError("La operación pertenece a otra solicitud.", 409);
        }
        assertCreditProducerNature("ABONO_DIRIGIDO", e1.evidence.naturaleza);
        await assertCreditEvidenceScope(req, e1.evidence, tx);
        assertCreditCaptureEnabled(e1.evidence, data.formaPago, "ABONO_DIRIGIDO", "ABONO");
        assertCreditPhysicalContext(e1.evidence, data.formaPago, data.cuentaDestino);
      }
      await assertDocumentBalance(tx, data, !isAdmin);
      const snapshot = await snapshots(tx, data, req.auth!.user.id);
      const [request] = await tx.insert(solicitudesPagoDirigidoTable).values({
        ...data, importe: data.importe.toFixed(2), solicitanteId: req.auth!.user.id,
        ...snapshot, estado: "PENDIENTE",
      }).returning();
      if (claimE12 && splitE12) await saveE12Directed(tx, request!.id, actorE12, splitE12, claimE12);
      const movement = isAdmin ? await apply(tx, request!, req.auth!.user.id, evidence, splitE12 ? { actor: actorE12, split: splitE12 } : undefined) : null;
      let saved = request!;
      if (movement) {
        const authorizer = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${req.auth!.user.id}`);
        [saved] = await tx.update(solicitudesPagoDirigidoTable).set({ estado: "APROBADA", autorizadorId: req.auth!.user.id, autorizadorNombre: String(authorizer.rows[0]?.nombre ?? ""), movimientoId: movement.id, resueltaAt: new Date() }).where(sql`${solicitudesPagoDirigidoTable.id}=${request!.id}`).returning();
        await notifyRequesterResolved(tx, {
          id: saved!.id,
          solicitanteId: saved!.solicitanteId,
          estado: "APROBADA",
        });
      }
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: isAdmin ? "APROBAR_APLICAR_PAGO_DIRIGIDO" : "SOLICITAR_PAGO_DIRIGIDO", entidad: "solicitudes_pago_dirigido", entidadId: String(request!.id), datosDespues: { ...data, ...(e1 ? { e1 } : {}), movimientoId: movement?.id ?? null }, ip: getRequestIp(req) });
      return { request: saved, movement };
    });
    const sourceE12 = await readE12Directed(db, result.request!.id, req.auth!.user.rol);
    res.status(201).json({ ...CreateSolicitudPagoDirigidoResponse.parse(present(result.request)), ...(evidence ?? {}), ...(sourceE12 ? { efectivoE12: sourceE12 } : {}) });
  } catch (error) {
    if (error instanceof CreditEvidenceError) { res.status(error.statusCode).json({ error: error.message }); return; }
    if (error instanceof Error && error.message === "DIRECTED_DOCUMENT_NOT_FOUND") { res.status(404).json({ error: "Documento no encontrado." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_DOCUMENT_OUT_OF_SCOPE") { res.status(403).json({ error: "El documento no pertenece a tu sitio." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_AMOUNT_EXCEEDS_DOCUMENT") { res.status(409).json({ error: "El monto excede el saldo del documento." }); return; }
    next(error);
  }
});

router.post("/pagos-dirigidos/:id/aprobar", requireRole("ADMIN"), async (req, res, next): Promise<void> => {
  try {
    if (req.body?.aprobacionE12 !== undefined) requireE12();
    const params = AprobarSolicitudPagoDirigidoParams.safeParse(req.params); if (!params.success) { res.status(400).json({ error: params.error.message }); return; } const id = params.data.id;
    const result = await db.transaction(async (tx) => {
      const found = await tx.execute<DirectedRequestRawRow>(sql`SELECT * FROM solicitudes_pago_dirigido WHERE id=${id} FOR UPDATE`);
      const request = found.rows[0]; if (!request) throw new Error("REQUEST_NOT_FOUND");
      let e12: { actor: E12Actor; split: E12Split } | undefined;
      if (req.body?.aprobacionE12 !== undefined && (request.tipo !== "PROVEEDOR" || request.forma_pago !== "EFECTIVO"))
        throw new E12Error("E12_PAYMENT_METHOD", "E12 solo corresponde a proveedor en efectivo.");
      if (E12_SUPPLIER_CASH_ENABLED && request.tipo === "PROVEEDOR" && request.forma_pago === "EFECTIVO") {
        const source = await readE12Directed(tx, id, "ADMIN");
        if (!source) throw new E12Error("E12_REQUEST_ORIGIN_REQUIRED", "No se puede reconstruir origen de una solicitud histórica.", 409);
        const approvedSplit = e12ApprovedSplit(source, req.body?.aprobacionE12);
        e12 = { actor: e12Actor(req.auth!.user, getRequestIp(req)), split: approvedSplit };
        if (request.estado === "APROBADA") {
          const previous = await e12Repository(tx).replay(approvedSplit.claveOperacion);
          if (!previous || previous.result.pago.id !== request.movimiento_id) throw new Error("REQUEST_ALREADY_RESOLVED");
          return apply(tx, { ...request, entidadId: request.entidad_id, documentoMovimientoId: request.documento_movimiento_id,
            formaPago: request.forma_pago, fechaEfectiva: request.fecha_efectiva, cuentaDestino: request.cuenta_destino }, req.auth!.user.id, undefined, e12);
        }
      }
      let evidence: CreditEvidenceInput | undefined;
      if (request.tipo === "CLIENTE") {
        evidence = readCreditEvidenceInput(req.body);
        const e1 = await loadDirectedEvidence(tx, id);
        assertDirectedApprovalIdentity(e1, evidence);
        await assertCreditEvidenceAccess(req, evidence, tx);
        const claim = await claimCreditOperation(tx, {
          productor: "ABONO_DIRIGIDO", clave: evidence.operacionClave,
          naturaleza: evidence.naturaleza, actorId: req.auth!.user.id,
          contenido: e1.intent,
        });
        if (claim.replay) {
          if (request.movimiento_id !== claim.movement.id) throw new CreditEvidenceError("La operación pertenece a otra solicitud.", 409);
          return claim.movement;
        }
        await assertCreditEvidenceScope(req, evidence, tx);
        const currentIntent = directedCreditIntent({
          tipo: request.tipo, entidadId: request.entidad_id,
          documentoMovimientoId: request.documento_movimiento_id,
          importe: Number(request.importe), formaPago: request.forma_pago,
          cuentaDestino: request.cuenta_destino, fechaEfectiva: request.fecha_efectiva,
          referencia: request.referencia, notas: request.notas, motivo: request.motivo,
        }, evidence);
        if (canonicalCreditContent(currentIntent) !== canonicalCreditContent(e1.intent)) {
          throw new CreditEvidenceError("El contenido de la solicitud cambió desde su captura.", 409);
        }
      }
      if (request.estado !== "PENDIENTE") throw new Error("REQUEST_ALREADY_RESOLVED");
      const movement = await apply(tx, {
        ...request,
        entidadId: request.entidad_id,
        documentoMovimientoId: request.documento_movimiento_id,
        formaPago: request.forma_pago,
        cuentaDestino: request.cuenta_destino,
        fechaEfectiva: request.fecha_efectiva,
      }, req.auth!.user.id, evidence, e12);
      const authorizer = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${req.auth!.user.id}`);
      await tx.update(solicitudesPagoDirigidoTable).set({ estado: "APROBADA", autorizadorId: req.auth!.user.id, autorizadorNombre: String(authorizer.rows[0]?.nombre ?? ""), movimientoId: movement.id, resueltaAt: new Date() }).where(sql`${solicitudesPagoDirigidoTable.id}=${id}`);
      await notifyRequesterResolved(tx, {
        id,
        solicitanteId: Number(request.solicitante_id),
        estado: "APROBADA",
      });
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: "APROBAR_APLICAR_PAGO_DIRIGIDO", entidad: "solicitudes_pago_dirigido", entidadId: String(id), datosDespues: { movimientoId: movement.id }, ip: getRequestIp(req) });
      return movement;
    });
    const detailE12 = await readE12Detail(db, result.id, req.auth!.user.rol);
    res.status(201).json(AprobarSolicitudPagoDirigidoResponse.parse({ solicitudId: id, movimientoId: result.id, estado: "APROBADA", ...(detailE12 ? { efectivoE12: detailE12 } : {}) }));
  } catch (error) {
    if (error instanceof CreditEvidenceError) { res.status(error.statusCode).json({ error: error.message }); return; }
    if (error instanceof Error && error.message === "REQUEST_NOT_FOUND") { res.status(404).json({ error: "Solicitud no encontrada." }); return; }
    if (error instanceof Error && error.message === "REQUEST_ALREADY_RESOLVED") { res.status(409).json({ error: "La solicitud ya fue resuelta." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_DOCUMENT_NOT_FOUND") { res.status(404).json({ error: "Documento no encontrado." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_AMOUNT_EXCEEDS_DOCUMENT") { res.status(409).json({ error: "El monto excede el saldo del documento." }); return; }
    next(error);
  }
});

router.post("/pagos-dirigidos/:id/rechazar", requireRole("ADMIN"), async (req, res, next): Promise<void> => {
  try {
    const params = RechazarSolicitudPagoDirigidoParams.safeParse(req.params); if (!params.success) { res.status(400).json({ error: params.error.message }); return; } const id = params.data.id;
    const body = RechazarSolicitudPagoDirigidoBody.safeParse(req.body);
    if (!body.success || body.data.motivoRechazo.trim().length < 10) { res.status(400).json({ error: "El motivo de rechazo debe tener al menos 10 caracteres." }); return; }
    const row = await db.transaction(async (tx) => {
      const before = await tx.execute(sql`SELECT * FROM solicitudes_pago_dirigido WHERE id=${id} FOR UPDATE`);
      if (!before.rows[0]) throw new Error("REQUEST_NOT_FOUND");
      const authorizer = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${req.auth!.user.id}`);
      const updated = await tx.update(solicitudesPagoDirigidoTable).set({ estado: "RECHAZADA", autorizadorId: req.auth!.user.id, autorizadorNombre: String(authorizer.rows[0]?.nombre ?? ""), motivoRechazo: body.data.motivoRechazo.trim(), resueltaAt: new Date() }).where(sql`${solicitudesPagoDirigidoTable.id}=${id} AND ${solicitudesPagoDirigidoTable.estado}='PENDIENTE'`).returning();
      if (!updated[0]) throw new Error("REQUEST_NOT_PENDING");
      await notifyRequesterResolved(tx, {
        id,
        solicitanteId: updated[0].solicitanteId,
        estado: "RECHAZADA",
      });
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: "RECHAZAR_PAGO_DIRIGIDO", entidad: "solicitudes_pago_dirigido", entidadId: String(id), datosAntes: before.rows[0], datosDespues: present(updated[0]), ip: getRequestIp(req) });
      return updated[0];
    });
    res.json(RechazarSolicitudPagoDirigidoResponse.parse(present(row)));
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_NOT_FOUND") { res.status(404).json({ error: "Solicitud no encontrada." }); return; }
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") { res.status(409).json({ error: "La solicitud no está pendiente." }); return; }
    next(error);
  }
});

export default router;