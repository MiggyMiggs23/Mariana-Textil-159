import type { Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, clientesTable, usuariosTable, movimientosCreditoTable, auditoriaTable, salidasDineroCajaTable } from "@workspace/db";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "@workspace/db/advisory-locks";
import type { Tx } from "./inventario";
import { assertCreditEvidenceAccess, assertCreditEvidenceScope, assertCreditCaptureEnabled, insertCreditMovementE1, claimCreditOperation, CreditEvidenceError } from "./credit-evidence";
import { loadCustomerCreditProjectionInTransaction, loadCustomerCreditLedgerInTransaction } from "./credit-aging-read-model";
import { moneyToCents, projectCreditLedger } from "./credit-allocation";
import { getRequestIp } from "./request";
import { assertCreditRefundEnabled, assertRefundReplay, refundSourceKey, type CreditRefundInput, type CreditRefundReply } from "./credit-refund-contract";

/**
 * Future producer hook: same transaction as a NEW retained receipt, never a backfill.
 * The prepared SQL verifies transaction identity, source and original E1 cash guard.
 * No endpoint calls this hook; activation and SQL application require separate authorization.
 */
export async function attestNewRetainedReceiptForRefund(tx: Tx, cobroClave: string): Promise<void> {
  assertCreditRefundEnabled();
  await tx.execute(sql`SELECT e2_attest_new_retained(${cobroClave}::uuid)`);
}
export async function attestNewAbonoForRefund(tx: Tx, abonoId: number): Promise<void> {
  void tx;
  throw new CreditEvidenceError(
    `E2: el hook anterior no puede atestar indiscriminadamente el abono ${abonoId}; usa la finalización A+C posterior a la proyección.`,
    409,
  );
}

/** Sole public execution entry. Gate precedes even opening a DB transaction. */
export async function refundCreditReceipt(req: Request, input: CreditRefundInput): Promise<CreditRefundReply> {
  assertCreditRefundEnabled();
  return db.transaction(async (tx) => {
    if (!req.auth?.user) throw new CreditEvidenceError("E2: sesión de usuario requerida.", 401);
    const [actor] = await tx.select().from(usuariosTable).where(eq(usuariosTable.id, req.auth!.user.id)).for("share").limit(1);
    if (!actor?.activo || actor.rol !== "ADMIN") throw new CreditEvidenceError("E2: sólo ADMIN activo puede devolver.", 403);
    const evidence = { naturaleza: "DEVOLUCION_FISICA" as const, operacionClave: input.operacionClave,
      sitioOrigenId: input.sitioOrigenId, sesionCajaId: input.sesionCajaId, notaOrigenId: null, origenJustificacion: input.motivo };
    // Current access on replay too; a replay performs no new cash movement and
    // returns its persisted result even after that session subsequently closes.
    await assertCreditEvidenceAccess(req, evidence, tx);
    // Serialize identical UUIDs even when their payloads name different customers.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.operacionClave}, 20260918))`);
    const key = refundSourceKey(input);
    const prior = await tx.execute<any>(sql`SELECT contenido, respuesta, actor_id FROM devoluciones_credito_e2 WHERE clave=${input.operacionClave}::uuid`);
    if (prior.rows[0]) {
      assertRefundReplay(prior.rows[0].contenido, input);
      if (prior.rows[0].actor_id !== actor.id) throw new CreditEvidenceError("E2: operación de otro actor.", 409);
      return prior.rows[0].respuesta as CreditRefundReply;
    }
    // SHARE conflicts with close's UPDATE and stays held through commit.
    await assertCreditEvidenceScope(req, evidence, tx);
    const today = await tx.execute(sql`SELECT id FROM sesiones_caja WHERE id=${input.sesionCajaId}
      AND fecha_operativa=(transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date`);
    if (!today.rows.length) throw new CreditEvidenceError("E2: requiere la sesión abierta de hoy.", 409);
    await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT, input.clienteId);
    // Same order as ordinary ABONO: session SHARE -> advisory -> customer UPDATE.
    // Manual AJUSTE writers use this row lock, not the advisory namespace.
    const [customer] = await tx.select().from(clientesTable)
      .where(eq(clientesTable.id, input.clienteId)).for("update").limit(1);
    if (!customer) throw new CreditEvidenceError("E2: cliente no encontrado.", 404);
    // Positive producer evidence is mandatory; no inference from absent applications.
    const proof = await tx.execute<any>(sql`SELECT p.* FROM evidencia_no_aplicada_e2 p
      JOIN finalizaciones_abono_e2 f ON f.abono_id=p.abono_id AND f.resultado='UNUSED'
      WHERE p.fuente=${key} AND p.cliente_id=${input.clienteId}
        AND p.importe=${input.importe}::numeric FOR UPDATE OF p,f`);
    if (!proof.rows[0]) throw new CreditEvidenceError("E2: falta prueba positiva de recepción íntegra nunca aplicada.", 409);
    let original: typeof movimientosCreditoTable.$inferSelect | undefined;
    if (input.origen === "ABONO") {
      [original] = await tx.select().from(movimientosCreditoTable).where(and(eq(movimientosCreditoTable.id, input.abonoId!), eq(movimientosCreditoTable.clienteId, input.clienteId))).for("update").limit(1);
      if (!original || original.tipo !== "ABONO" || original.naturaleza !== "INGRESO_FISICO" ||
          original.formaPago !== "EFECTIVO" || original.cuentaDestino !== "CAJA_FISICA" || !original.sesionCajaId ||
          !original.sitioOrigenId || moneyToCents(original.importe) !== -moneyToCents(input.importe)) {
        throw new CreditEvidenceError("E2: abono físico original incompatible.", 409);
      }
      const apps = await tx.execute(sql`SELECT id FROM aplicaciones_credito WHERE abono_movimiento_id=${input.abonoId}`);
      const reversals = await tx.execute(sql`SELECT id FROM movimientos_credito WHERE movimiento_origen_id=${input.abonoId} AND tipo='REVERSO'`);
      if (apps.rows.length || reversals.rows.length) throw new CreditEvidenceError("E2: el abono tuvo aplicaciones o reverso.", 409);
      const projection = await loadCustomerCreditProjectionInTransaction(input.clienteId, tx);
      const available = projection.overpaymentSources.find(s => s.movementId === input.abonoId)?.availableCents;
      if (available !== moneyToCents(input.importe)) throw new CreditEvidenceError("E2: no queda íntegro el origen exacto.", 409);
      // Even a later restored balance cannot erase a historical implicit application.
      const ledger = (await loadCustomerCreditLedgerInTransaction(input.clienteId, tx))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
      const start = ledger.findIndex(m => m.id === input.abonoId);
      for (let n = start + 1; n <= ledger.length; n++) {
        if (projectCreditLedger(ledger.slice(0, n)).overpaymentSources.find(s => s.movementId === input.abonoId)?.availableCents !== moneyToCents(input.importe)) {
          throw new CreditEvidenceError("E2: origen aplicado históricamente.", 409);
        }
      }
    } else {
      const source = await tx.execute<any>(sql`SELECT * FROM cobros_credito_pendientes_e1
        WHERE operacion_productor='COBRO_PENDIENTE' AND operacion_clave=${input.cobroClave}::uuid FOR UPDATE`);
      const row = source.rows[0];
      if (!row || row.cliente_id !== input.clienteId || !row.sitio_origen_id ||
          row.naturaleza !== "INGRESO_FISICO" || row.medio !== "EFECTIVO" || row.cuenta_destino !== "CAJA_FISICA" ||
          !row.sesion_caja_id || moneyToCents(row.importe) !== moneyToCents(input.importe)) {
        throw new CreditEvidenceError("E2: cobro retenido original incompatible.", 409);
      }
    }
    // Deliberately retain E1 rejection. A different table/nature is NOT a bypass.
    assertCreditCaptureEnabled(evidence, "EFECTIVO", "REVERSO_ABONO", "REVERSO");
    const reserved = await tx.execute(sql`INSERT INTO disposiciones_credito_e2(fuente, clave, destino)
      VALUES (${key}, ${input.operacionClave}::uuid, 'DEVOLUCION') ON CONFLICT DO NOTHING RETURNING fuente`);
    if (!reserved.rows.length) throw new CreditEvidenceError("E2: origen u operación ya utilizado.", 409);
    let reversoId: number | null = null;
    if (original) {
      const claim = await claimCreditOperation(tx, { productor: "REVERSO_ABONO", clave: input.operacionClave,
        naturaleza: "DEVOLUCION_FISICA", actorId: actor.id, contenido: input });
      if (claim.replay) throw new CreditEvidenceError("E2: UUID ya utilizado fuera de esta devolución.", 409);
      const reversal = await insertCreditMovementE1(tx, { clienteId: input.clienteId, tipo: "REVERSO",
        importe: input.importe, movimientoOrigenId: original.id, usuarioId: actor.id,
        notas: input.motivo, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA" }, evidence, "REVERSO_ABONO");
      reversoId = reversal.id;
    }
    const [outflow] = await tx.insert(salidasDineroCajaTable).values({ sesionCajaId: input.sesionCajaId,
      monto: input.importe, motivo: input.motivo, cuentaOrigen: "CAJA_FISICA", creadoPorId: actor.id }).returning();
    const reply: CreditRefundReply = { operacionClave: input.operacionClave, salidaId: outflow.id, reversoId,
      importe: input.importe, sesionCajaId: input.sesionCajaId };
    await tx.insert(auditoriaTable).values({ usuarioId: actor.id, accion: "DEVOLUCION_CREDITO_E2",
      entidad: "devoluciones_credito_e2", entidadId: input.operacionClave, ip: getRequestIp(req),
      datosAntes: { fuente: key, prueba: proof.rows[0] }, datosDespues: { ...reply, motivo: input.motivo } });
    await tx.execute(sql`INSERT INTO devoluciones_credito_e2(clave, fuente, actor_id, contenido, respuesta, salida_id, reverso_id)
      VALUES (${input.operacionClave}::uuid, ${key}, ${actor.id}, ${JSON.stringify(input)}::jsonb,
      ${JSON.stringify(reply)}::jsonb, ${outflow.id}, ${reversoId})`);
    return reply;
  });
}