import { pool } from "@workspace/db";
import { pendingTicketPredicate } from "./accounted-document";
import { loadCustomerCreditProjections } from "./credit-aging-read-model";

const MEXICO_CITY_TIME_ZONE = "America/Mexico_City";
/**
 * Operational threshold for an inter-site exit to be considered overdue.
 * Keep this named value here so the business can tune it without changing SQL.
 */
export const SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS = 24;
/**
 * A pending customer charge becomes actionable three calendar days before it
 * is due. This gives ADMIN time to follow up without turning every distant
 * credit sale into a permanent alert.
 */
export const CREDIT_RISK_ALERT_LEAD_DAYS = 3;

export function isCreditRiskCharge(
  charge: { pendienteCents: number; dueAt: string | null },
  thresholdDate: string,
): boolean {
  return charge.pendienteCents > 0 &&
    charge.dueAt != null &&
    charge.dueAt <= thresholdDate;
}

/** Strict boundary rule shared by focused tests; exactly 24 hours is not overdue. */
export function isSalidaEnTransitoOverdue(enviadaAt: Date, now = new Date()): boolean {
  return now.getTime() - enviadaAt.getTime() >
    SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS * 60 * 60 * 1000;
}

function money(value: unknown): string {
  return Number(value ?? 0).toFixed(2);
}

function calendarDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

/**
 * Live read model for actionable administrator alerts. It deliberately reads
 * the ticket and FIFO ledger sources directly and never uses the persistent
 * credit-notification review queue.
 */
export async function getAdminAlertas() {
  const [pendingResult, creditResult, transitResult] = await Promise.all([
    pool.query(`
      SELECT t.id, t.folio, t.created_at AS "createdAt",
        FLOOR(EXTRACT(EPOCH FROM (now() - t.created_at)) / 60)::int AS "minutosTranscurridos",
        u.id AS "ubicacionId", u.nombre AS "nombreUbicacion",
        c.id AS "clienteId", c.nombre AS "nombreCliente",
        t.total::text AS importe,
        creator.id AS "creadorId", creator.nombre AS "nombreCreador"
      FROM tickets t
      JOIN ubicaciones u ON u.id = t.ubicacion_id
      JOIN clientes c ON c.id = t.cliente_id
      JOIN usuarios creator ON creator.id = t.usuario_terminal_id
      WHERE ${pendingTicketPredicate("t")}
        AND t.created_at < now() - interval '30 minutes'
      ORDER BY t.created_at ASC, t.id ASC
    `),
    pool.query(`SELECT c.id AS "clienteId",c.nombre AS "nombreCliente",m.id AS "movimientoId",
      m.notas AS nota,t.folio AS "ticketFolio" FROM clientes c JOIN movimientos_credito m ON m.cliente_id=c.id
      LEFT JOIN tickets t ON t.id=m.ticket_id WHERE m.tipo IN ('VENTA_CREDITO','AJUSTE')`),
    pool.query(`
       SELECT s.id, s.folio,
         CASE WHEN s.modalidad = 'VENTA_CLIENTE'
           THEN CASE WHEN t.documento_tipo = 'TICKET' THEN t.cobrado_at ELSE t.autorizado_at END
           ELSE s.enviada_at END AS "enviadaAt",
        FLOOR(EXTRACT(EPOCH FROM (now() - CASE WHEN s.modalidad = 'VENTA_CLIENTE'
          THEN CASE WHEN t.documento_tipo = 'TICKET' THEN t.cobrado_at ELSE t.autorizado_at END
          ELSE s.enviada_at END)) / 3600)::int
          AS "horasEnTransito",
        origen.id AS "origenId", origen.nombre AS "nombreOrigen",
         destino.id AS "destinoId", destino.nombre AS "nombreDestino",
         s.ticket_id AS "ticketId", t.folio AS "ticketFolio", s.folio AS "salidaFolio",
         ('/salidas/' || s.id) AS "salidaHref",
         CASE WHEN s.ticket_id IS NULL THEN NULL ELSE ('/tickets/' || s.ticket_id) END AS "ticketHref"
       FROM salidas s
      JOIN ubicaciones origen ON origen.id = s.origen_id
       LEFT JOIN ubicaciones destino ON destino.id = s.destino_id
       LEFT JOIN tickets t ON t.id = s.ticket_id
       WHERE (
          (s.modalidad <> 'VENTA_CLIENTE' AND s.estado = 'EN_TRANSITO' AND s.enviada_at < now() - ($1::int * interval '1 hour'))
         OR
         (s.modalidad = 'VENTA_CLIENTE' AND s.estado = 'RECIBIDA'
          AND (CASE WHEN t.documento_tipo = 'TICKET' THEN t.cobrado_at ELSE t.autorizado_at END)
              < now() - ($1::int * interval '1 hour')
           AND t.estado <> 'CANCELADO'
           AND (t.cobrado = true OR t.autorizacion_estado = 'AUTORIZADA'))
       )
      ORDER BY s.enviada_at ASC, s.id ASC
    `, [SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS]),
  ]);

  const ticketsPendientes = pendingResult.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    folio: Number(row.folio),
    createdAt: new Date(row.createdAt).toISOString(),
    minutosTranscurridos: Number(row.minutosTranscurridos),
    ubicacionId: Number(row.ubicacionId),
    clienteId: Number(row.clienteId),
    importe: money(row.importe),
    creadorId: Number(row.creadorId),
  }));
  const projections = await loadCustomerCreditProjections([...new Set(creditResult.rows.map((row) => Number(row.clienteId)))]);
  const byMovement = new Map(creditResult.rows.map((row) => [Number(row.movimientoId), row]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: MEXICO_CITY_TIME_ZONE });
  const creditThreshold = new Date(
    Date.parse(`${today}T00:00:00Z`) + CREDIT_RISK_ALERT_LEAD_DAYS * 86_400_000,
  ).toISOString().slice(0, 10);
  const creditos = [...projections].flatMap(([clienteId, projection]) => projection.charges
    .filter((charge) => isCreditRiskCharge(charge, creditThreshold))
    .map((charge) => {
      const row = byMovement.get(charge.movimientoId);
      if (!row || charge.dueAt == null) {
        throw new Error(`Missing credit movement metadata: ${charge.movimientoId}`);
      }
      return {
        ...row,
        movimientoId: charge.movimientoId,
        clienteId,
        ticketFolio: row.ticketFolio == null ? null : Number(row.ticketFolio),
        importe: money(charge.pendienteCents / 100),
        fechaVencimiento: charge.dueAt,
        diasRestantes: Math.floor(
          (Date.parse(`${charge.dueAt}T00:00:00Z`) -
            Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
        ),
      };
    }))
    .sort((a, b) =>
      a.fechaVencimiento.localeCompare(b.fechaVencimiento) ||
      a.movimientoId - b.movimientoId,
    );
  const salidasEnTransito = transitResult.rows.filter((row) => row.ticketId == null).map((row) => ({
    ...row,
    id: Number(row.id),
    folio: Number(row.folio),
    enviadaAt: new Date(row.enviadaAt).toISOString(),
    horasEnTransito: Number(row.horasEnTransito),
    origenId: Number(row.origenId),
    destinoId: row.destinoId == null ? null : Number(row.destinoId),
    ticketId: row.ticketId == null ? null : Number(row.ticketId),
    salidaHref: row.salidaHref,
    ticketHref: row.ticketHref,
  }));
  const ventasAutorizadasSinEntregar = transitResult.rows
    .filter((row) => row.ticketId != null && row.salidaHref != null)
    .map((row) => ({
      ticketId: Number(row.ticketId),
      ticketFolio: Number(row.ticketFolio),
      salidaId: Number(row.id),
      salidaFolio: Number(row.salidaFolio),
      horasSinEntregar: Number(row.horasEnTransito),
      ticketHref: row.ticketHref,
      salidaHref: row.salidaHref,
    }));

  return {
    generatedAt: new Date().toISOString(),
    total: ticketsPendientes.length + creditos.length + salidasEnTransito.length + ventasAutorizadasSinEntregar.length,
    ticketsPendientes,
    creditos,
    salidasEnTransito,
    ventasAutorizadasSinEntregar,
  };
}