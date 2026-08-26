import { pool } from "@workspace/db";

const MEXICO_CITY_TIME_ZONE = "America/Mexico_City";
/**
 * Operational threshold for an inter-site exit to be considered overdue.
 * Keep this named value here so the business can tune it without changing SQL.
 */
export const SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS = 24;

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
      WHERE t.estado = 'VENDIDO'
        AND NOT t.cobrado
        AND t.created_at < now() - interval '30 minutes'
      ORDER BY t.created_at ASC, t.id ASC
    `),
    pool.query(`
      SELECT aging.movimiento_id AS "movimientoId",
        c.id AS "clienteId", c.nombre AS "nombreCliente",
        movement.notas AS nota, t.folio AS "ticketFolio",
        aging.pendiente::text AS importe,
        aging.due_at AS "fechaVencimiento",
        (aging.due_at - (now() AT TIME ZONE '${MEXICO_CITY_TIME_ZONE}')::date)::int
          AS "diasRestantes"
      FROM clientes c
      JOIN LATERAL credit_fifo_aging(c.id) aging ON true
      JOIN movimientos_credito movement ON movement.id = aging.movimiento_id
      LEFT JOIN tickets t ON t.id = aging.ticket_id
      WHERE aging.due_at IS NOT NULL
        AND aging.due_at <=
          (now() AT TIME ZONE '${MEXICO_CITY_TIME_ZONE}')::date + 3
      ORDER BY aging.due_at ASC, aging.created_at ASC, aging.movimiento_id ASC
    `),
    pool.query(`
      SELECT s.id, s.folio, s.enviada_at AS "enviadaAt",
        FLOOR(EXTRACT(EPOCH FROM (now() - s.enviada_at)) / 3600)::int
          AS "horasEnTransito",
        origen.id AS "origenId", origen.nombre AS "nombreOrigen",
        destino.id AS "destinoId", destino.nombre AS "nombreDestino"
      FROM salidas s
      JOIN ubicaciones origen ON origen.id = s.origen_id
      JOIN ubicaciones destino ON destino.id = s.destino_id
      WHERE s.estado = 'EN_TRANSITO'
        AND s.enviada_at < now() - ($1::int * interval '1 hour')
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
  const creditos = creditResult.rows.map((row) => ({
    ...row,
    movimientoId: Number(row.movimientoId),
    clienteId: Number(row.clienteId),
    ticketFolio: row.ticketFolio == null ? null : Number(row.ticketFolio),
    importe: money(row.importe),
    fechaVencimiento: calendarDate(row.fechaVencimiento),
    diasRestantes: Number(row.diasRestantes),
  }));
  const salidasEnTransito = transitResult.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    folio: Number(row.folio),
    enviadaAt: new Date(row.enviadaAt).toISOString(),
    horasEnTransito: Number(row.horasEnTransito),
    origenId: Number(row.origenId),
    destinoId: Number(row.destinoId),
  }));

  return {
    generatedAt: new Date().toISOString(),
    total: ticketsPendientes.length + creditos.length + salidasEnTransito.length,
    ticketsPendientes,
    creditos,
    salidasEnTransito,
  };
}