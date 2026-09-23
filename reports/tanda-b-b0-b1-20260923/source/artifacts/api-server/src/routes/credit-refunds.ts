import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { assertCreditRefundEnabled, readCreditRefundInput, CREDIT_REFUND_INACTIVE_COPY,
  CREDIT_REFUND_OPTIONS_WARNING, type CreditRefundOptions } from "../lib/credit-refund-contract";
import { CreditEvidenceError } from "../lib/credit-evidence-contract";
import { refundCreditReceipt } from "../lib/credit-refund";
const router = Router();
router.get("/clientes/:id/devoluciones-credito/opciones", requireSession,
  requierePermiso("clientes_finanzas", "ver"),
  requierePermiso("clientes_finanzas", "autorizar"), async (req, res, next) => {
    try {
      if (!req.auth?.user) throw new CreditEvidenceError("E2: sesión requerida.", 401);
      const clienteId = Number(req.params.id);
      if (!Number.isSafeInteger(clienteId) || clienteId < 1 || clienteId > 2147483647) {
        throw new CreditEvidenceError("E2: cliente inválido.", 400);
      }
      // Re-read active role instead of trusting a stale auth snapshot. ADMIN's
      // financial scope is global; every source query is still customer-scoped.
      const actor = await db.execute<{ activo: boolean; rol: string }>(sql`
        SELECT activo,rol FROM usuarios WHERE id=${req.auth.user.id}`);
      if (!actor.rows[0]?.activo || actor.rows[0].rol !== "ADMIN") {
        throw new CreditEvidenceError("E2: sólo ADMIN activo puede consultar opciones.", 403);
      }
      const customer = await db.execute(sql`SELECT id FROM clientes WHERE id=${clienteId}`);
      if (!customer.rows.length) throw new CreditEvidenceError("E2: cliente no encontrado.", 404);
      // Read ONLY installed E1 tables. Positive E2 proof and economic eligibility
      // belong to the gated mutation, never inferred from this document list.
      const sources = await db.execute<CreditRefundOptions["candidatas"][number]>(sql`
        SELECT 'ABONO'::text AS origen,m.id AS "abonoId",NULL::text AS "cobroClave",
          t.folio,m.referencia,(-m.importe)::text AS importe,
          m.sitio_origen_id AS "sitioOrigenId",u.nombre AS "sitioNombre"
        FROM movimientos_credito m
        JOIN ubicaciones u ON u.id=m.sitio_origen_id AND u.activa AND u.tipo='TIENDA'
        LEFT JOIN tickets t ON t.id=COALESCE(m.nota_origen_id,m.ticket_id)
          AND t.cliente_id=m.cliente_id AND t.ubicacion_id=m.sitio_origen_id
        WHERE m.cliente_id=${clienteId} AND m.tipo='ABONO' AND m.importe<0
          AND m.naturaleza='INGRESO_FISICO' AND m.forma_pago='EFECTIVO'
          AND m.cuenta_destino='CAJA_FISICA' AND m.sesion_caja_id IS NOT NULL
        UNION ALL
        SELECT 'COBRO_RETENIDO'::text AS origen,NULL::integer AS "abonoId",
          c.operacion_clave::text AS "cobroClave",NULL::integer AS folio,c.referencia,c.importe::text,
          c.sitio_origen_id AS "sitioOrigenId",u.nombre AS "sitioNombre"
        FROM cobros_credito_pendientes_e1 c
        JOIN ubicaciones u ON u.id=c.sitio_origen_id AND u.activa AND u.tipo='TIENDA'
        WHERE c.cliente_id=${clienteId} AND c.operacion_productor='COBRO_PENDIENTE'
          AND c.naturaleza='INGRESO_FISICO' AND c.medio='EFECTIVO' AND c.importe>0
          AND c.cuenta_destino='CAJA_FISICA' AND c.sesion_caja_id IS NOT NULL
        ORDER BY "sitioOrigenId",origen,"abonoId","cobroClave"`);
      // ADMIN may return an original receipt from another store. Session/site
      // must agree for the NEW outflow, not with the original receipt's site.
      const sessions = await db.execute<CreditRefundOptions["sesiones"][number]>(sql`
        SELECT s.id,s.ubicacion_id AS "sitioOrigenId",u.nombre AS "sitioNombre",
          to_char(s.abierta_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "abiertaAt"
        FROM sesiones_caja s JOIN ubicaciones u ON u.id=s.ubicacion_id AND u.activa AND u.tipo='TIENDA'
        WHERE s.estado='ABIERTA' AND s.cerrada_at IS NULL
          AND s.fecha_operativa=(transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date
        ORDER BY s.ubicacion_id,s.id`);
      const response: CreditRefundOptions = { enabled: false, motivoInactivo: CREDIT_REFUND_INACTIVE_COPY,
        advertencia: CREDIT_REFUND_OPTIONS_WARNING, candidatas: sources.rows, sesiones: sessions.rows };
      res.status(200).json(response);
    } catch (error) { next(error); }
  });
router.post("/clientes/:id/devoluciones-credito", requireSession,
  requierePermiso("clientes_finanzas", "autorizar"), async (req, res, next) => {
    try {
      assertCreditRefundEnabled();
      const input = readCreditRefundInput(Number(req.params.id), req.body);
      res.status(200).json(await refundCreditReceipt(req, input));
    } catch (error) { next(error); }
  });
export default router;