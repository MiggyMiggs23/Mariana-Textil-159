import { pool } from "@workspace/db";
import {
  ACCOUNT_DESTINATION_ORDER,
  type AccountDestinationCode,
} from "@workspace/number-format";
import { parseMexicoDateQuery } from "./mexico-date";

export const ANALYTICS_TIME_ZONE = "America/Mexico_City";

/** Testable timing boundary used by routes to surface KPI query duration. */
export async function measureKpi<T>(
  name: string,
  query: () => Promise<T>,
): Promise<{ value: T; name: string; durationMs: number }> {
  const started = performance.now();
  const value = await query();
  return { value, name, durationMs: performance.now() - started };
}

export type AnalyticsFilters = {
  desde?: Date;
  hasta?: Date;
  ubicacionId?: number;
};

export function previousEqualPeriod(filters: AnalyticsFilters): AnalyticsFilters {
  if (!filters.desde || !filters.hasta) {
    throw new AnalyticsInputError("El periodo requiere límites para calcular su comparación.");
  }
  const duration = filters.hasta.getTime() - filters.desde.getTime() + 1;
  const hasta = new Date(filters.desde.getTime() - 1);
  return {
    desde: new Date(hasta.getTime() - duration + 1),
    hasta,
    ubicacionId: filters.ubicacionId,
  };
}

type QueryInput = {
  desde?: string | Date;
  hasta?: string | Date;
  ubicacionId?: number;
};

export class AnalyticsInputError extends Error {}

export type AccountDestination = AccountDestinationCode;

/** Canonical payment/facturado-derived destination rule, shared by reports. */
export function accountDestination(
  formaPago: "EFECTIVO" | "TRANSFERENCIA" | "CREDITO",
  facturado: boolean,
): AccountDestination {
  if (formaPago === "EFECTIVO") return "CAJA_FISICA";
  if (formaPago === "CREDITO") return "CUENTAS_POR_COBRAR";
  return facturado ? "CUENTA_FISCAL" : "CUENTA_NO_FISCAL";
}

export function isAccountDestination(value: string): value is AccountDestination {
  return ACCOUNT_DESTINATION_ORDER.includes(value as AccountDestination);
}

/**
 * Canonical destination cash-flow read model.  A credit sale is represented
 * once by its VENTA_CREDITO ledger row; subsequent ABONOs are separate cash
 * entries and always use the destination explicitly recorded on the ledger.
 * POS payments deliberately exclude CREDITO to avoid counting that sale twice.
 */
function destinationReadModel() {
  return `WITH destination_movements AS (
    SELECT p.id, p.created_at fecha, p.importe importe, p.forma_pago::text "formaPago",
      CASE WHEN p.forma_pago='EFECTIVO' THEN 'CAJA_FISICA'
        WHEN t.facturado THEN 'CUENTA_FISCAL' ELSE 'CUENTA_NO_FISCAL' END::text "cuentaDestino",
      t.id "documentoId", t.folio, t.cliente_id "clienteId", t.ubicacion_id "ubicacionId",
      p.usuario_id "registroId", t.facturado, 'POS' fuente
    FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id
    WHERE ($1::timestamptz IS NULL OR p.created_at >= $1)
      AND ($2::timestamptz IS NULL OR p.created_at <= $2)
      AND ($3::int IS NULL OR t.ubicacion_id=$3)
      AND t.estado='VENDIDO' AND t.cobrado AND p.forma_pago <> 'CREDITO'
    UNION ALL
    SELECT m.id, m.created_at fecha, m.importe,
      'CREDITO'::text "formaPago", 'CUENTAS_POR_COBRAR'::text "cuentaDestino",
      t.id "documentoId", t.folio, m.cliente_id "clienteId", t.ubicacion_id "ubicacionId",
      m.usuario_id "registroId", COALESCE(t.facturado,false) facturado, 'CREDITO' fuente
    FROM movimientos_credito m JOIN tickets t ON t.id=m.ticket_id
    WHERE ($1::timestamptz IS NULL OR m.created_at >= $1)
      AND ($2::timestamptz IS NULL OR m.created_at <= $2)
      AND ($3::int IS NULL OR t.ubicacion_id=$3)
      AND m.tipo='VENTA_CREDITO' AND t.estado='VENDIDO'
    UNION ALL
    SELECT (m.id * 1000000 + a.id),m.created_at fecha,a.importe,
      COALESCE(m.forma_pago::text,'TRANSFERENCIA') "formaPago",m.cuenta_destino::text "cuentaDestino",
      sale_ticket.id "documentoId",sale_ticket.folio,m.cliente_id "clienteId",sale_ticket.ubicacion_id "ubicacionId",
      m.usuario_id "registroId",COALESCE(sale_ticket.facturado,false) facturado,'ABONO' fuente
    FROM movimientos_credito m JOIN aplicaciones_credito a ON a.abono_movimiento_id=m.id
    JOIN movimientos_credito sale ON sale.id=a.venta_movimiento_id
    JOIN tickets sale_ticket ON sale_ticket.id=sale.ticket_id
    WHERE ($1::timestamptz IS NULL OR m.created_at >= $1)
      AND ($2::timestamptz IS NULL OR m.created_at <= $2)
      AND ($3::int IS NULL OR sale_ticket.ubicacion_id=$3)
      AND m.tipo='ABONO' AND m.cuenta_destino IS NOT NULL AND sale_ticket.estado='VENDIDO'
    UNION ALL
    SELECT (m.id * 1000000),m.created_at fecha,
      -m.importe-COALESCE(aplicado.importe,0),
      COALESCE(m.forma_pago::text,'TRANSFERENCIA') "formaPago",m.cuenta_destino::text "cuentaDestino",
      m.cliente_id "documentoId",NULL::bigint folio,m.cliente_id "clienteId",NULL::int "ubicacionId",
      m.usuario_id "registroId",false facturado,'ABONO_SALDO_FAVOR' fuente
    FROM movimientos_credito m LEFT JOIN LATERAL (
      SELECT SUM(a.importe) importe
      FROM aplicaciones_credito a
      JOIN movimientos_credito sale ON sale.id=a.venta_movimiento_id
      JOIN tickets sale_ticket ON sale_ticket.id=sale.ticket_id
      WHERE a.abono_movimiento_id=m.id AND sale_ticket.estado='VENDIDO'
    ) aplicado ON true
    WHERE ($1::timestamptz IS NULL OR m.created_at >= $1)
      AND ($2::timestamptz IS NULL OR m.created_at <= $2)
      AND $3::int IS NULL
      AND m.tipo='ABONO' AND m.cuenta_destino IS NOT NULL
      AND -m.importe > COALESCE(aplicado.importe,0)
    UNION ALL
    SELECT (r.id * 1000000 + a.id),r.created_at fecha,-a.importe,
      COALESCE(original.forma_pago::text,'TRANSFERENCIA') "formaPago",original.cuenta_destino::text "cuentaDestino",
      sale_ticket.id "documentoId",sale_ticket.folio,original.cliente_id "clienteId",sale_ticket.ubicacion_id "ubicacionId",
      r.usuario_id "registroId",COALESCE(sale_ticket.facturado,false) facturado,'REVERSO_ABONO' fuente
    FROM movimientos_credito r JOIN movimientos_credito original ON original.id=r.movimiento_origen_id
    JOIN aplicaciones_credito a ON a.abono_movimiento_id=original.id
    JOIN movimientos_credito sale ON sale.id=a.venta_movimiento_id
    JOIN tickets sale_ticket ON sale_ticket.id=sale.ticket_id
    WHERE ($1::timestamptz IS NULL OR r.created_at >= $1)
      AND ($2::timestamptz IS NULL OR r.created_at <= $2)
      AND ($3::int IS NULL OR sale_ticket.ubicacion_id=$3)
      AND r.tipo='REVERSO' AND original.tipo='ABONO' AND original.cuenta_destino IS NOT NULL
      AND sale_ticket.estado='VENDIDO'
    UNION ALL
    SELECT (r.id * 1000000),r.created_at fecha,
      -( -original.importe-COALESCE(aplicado.importe,0) ),
      COALESCE(original.forma_pago::text,'TRANSFERENCIA') "formaPago",original.cuenta_destino::text "cuentaDestino",
      original.cliente_id "documentoId",NULL::bigint folio,original.cliente_id "clienteId",NULL::int "ubicacionId",
      r.usuario_id "registroId",false facturado,'REVERSO_ABONO_SALDO_FAVOR' fuente
    FROM movimientos_credito r JOIN movimientos_credito original ON original.id=r.movimiento_origen_id
    LEFT JOIN LATERAL (
      SELECT SUM(a.importe) importe
      FROM aplicaciones_credito a
      JOIN movimientos_credito sale ON sale.id=a.venta_movimiento_id
      JOIN tickets sale_ticket ON sale_ticket.id=sale.ticket_id
      WHERE a.abono_movimiento_id=original.id AND sale_ticket.estado='VENDIDO'
    ) aplicado ON true
    WHERE ($1::timestamptz IS NULL OR r.created_at >= $1)
      AND ($2::timestamptz IS NULL OR r.created_at <= $2)
      AND $3::int IS NULL
      AND r.tipo='REVERSO' AND original.tipo='ABONO' AND original.cuenta_destino IS NOT NULL
      AND -original.importe > COALESCE(aplicado.importe,0)
  )`;
}

/** Sum from the same canonical rows used by cards, detail and exports. */
export async function getDestinationCollectedAmount(
  filters: AnalyticsFilters,
  destination: AccountDestination,
) {
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
  ];
  const result = await pool.query(
    `${destinationReadModel()}
     SELECT COALESCE(SUM(importe),0)::text amount
     FROM destination_movements WHERE "cuentaDestino"=$4`,
    [...values, destination],
  );
  return decimal(result.rows[0]!.amount);
}

export function calculateFrozenMargin(
  lines: Array<{
    importe: string | number;
    costoTotalCongelado: string | number | null;
    costoUnitarioCongelado: string | number | null;
    rolloId: number | null;
  }>,
) {
  let costo = 0;
  const subtotal = lines.reduce((sum, line) => sum + Number(line.importe), 0);
  let lineasExcluidasMargen = 0;
  for (const line of lines) {
    if (
      line.costoTotalCongelado == null
    ) {
      lineasExcluidasMargen += 1;
      continue;
    }
    costo += Number(line.costoTotalCongelado);
  }
  const complete = lineasExcluidasMargen === 0;
  const margen = complete ? subtotal - costo : null;
  return {
    costo: complete ? decimal(costo) : null,
    margen: margen == null ? null : decimal(margen),
    margenPorcentaje: margen == null
      ? null
      : decimal(subtotal === 0 ? 0 : (margen / subtotal) * 100),
    lineasExcluidasMargen,
  };
}

export function parseAnalyticsFilters(input: QueryInput): AnalyticsFilters {
  const desde = input.desde instanceof Date
    ? parseMexicoDateQuery(input.desde.toISOString().slice(0, 10), "start")
    : parseMexicoDateQuery(input.desde, "start");
  const hasta = input.hasta instanceof Date
    ? parseMexicoDateQuery(input.hasta.toISOString().slice(0, 10), "end")
    : parseMexicoDateQuery(input.hasta, "end");
  if (desde === null || hasta === null) {
    throw new AnalyticsInputError("Las fechas deben usar el formato YYYY-MM-DD.");
  }
  if (desde && hasta && desde > hasta) {
    throw new AnalyticsInputError("La fecha desde no puede ser posterior a hasta.");
  }
  // Dashboard/analytics without explicit controls always means the current
  // business day, never an accidental all-time scan.
  if (desde === undefined && hasta === undefined) {
    return {
      desde: parseMexicoDateQuery(dateMexico(), "start")!,
      hasta: parseMexicoDateQuery(dateMexico(), "end")!,
      ubicacionId: input.ubicacionId,
    };
  }
  return { desde, hasta, ubicacionId: input.ubicacionId };
}

function decimal(value: unknown, scale = 2): string {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toFixed(scale);
}

function dateMexico(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${field("year")}-${field("month")}-${field("day")}`;
}

export function mexicoCityHour(value = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(value));
}

function where(
  filters: AnalyticsFilters,
  alias = "t",
  timestampColumn = "created_at",
) {
  return {
    text: `($1::timestamptz IS NULL OR ${alias}.${timestampColumn} >= $1)
      AND ($2::timestamptz IS NULL OR ${alias}.${timestampColumn} <= $2)
      AND ($3::int IS NULL OR ${alias}.ubicacion_id = $3)`,
    values: [
      filters.desde?.toISOString() ?? null,
      filters.hasta?.toISOString() ?? null,
      filters.ubicacionId ?? null,
    ],
  };
}

export async function getSalesSummary(filters: AnalyticsFilters) {
  const condition = where(filters);
  const result = await pool.query(
    `WITH filtered AS (
       SELECT t.id,t.estado,t.cobrado,t.total,t.subtotal,t.iva
       FROM tickets t WHERE ${condition.text}
     ), lines AS (
       SELECT l.ticket_id,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.costo_total_congelado),0) END costo,
          COALESCE(SUM(l.importe),0) importe_margen,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)::int excluidas
       FROM ticket_lineas l JOIN filtered f ON f.id=l.ticket_id
       WHERE f.estado='VENDIDO' GROUP BY l.ticket_id
     )
     SELECT
       COALESCE(SUM(f.total) FILTER (WHERE f.estado='VENDIDO'),0)::text ventas,
       COALESCE(SUM(f.total) FILTER (WHERE f.estado='VENDIDO' AND f.cobrado),0)::text cobrado,
       COALESCE(SUM(f.total) FILTER (WHERE f.estado='VENDIDO' AND NOT f.cobrado),0)::text pendiente,
       COALESCE(SUM(f.subtotal) FILTER (WHERE f.estado='VENDIDO'),0)::text subtotal,
       COALESCE(SUM(f.iva) FILTER (WHERE f.estado='VENDIDO'),0)::text iva,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.costo),0)::text END costo,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.importe_margen-l.costo),0)::text END margen,
       COUNT(*) FILTER (WHERE f.estado='VENDIDO')::int tickets,
       COUNT(*) FILTER (WHERE f.estado='VENDIDO' AND f.cobrado)::int "ticketsCobrados",
       COUNT(*) FILTER (WHERE f.estado='VENDIDO' AND NOT f.cobrado)::int "ticketsPendientes",
       COUNT(*) FILTER (WHERE f.estado='CANCELADO')::int cancelaciones,
       COALESCE(SUM(l.excluidas),0)::int "lineasExcluidasMargen"
     FROM filtered f LEFT JOIN lines l ON l.ticket_id=f.id`,
    condition.values,
  );
  const row = result.rows[0]!;
  const subtotal = Number(row.subtotal);
  const margin = row.margen == null ? null : Number(row.margen);
  return {
    ventas: decimal(row.ventas),
    cobrado: decimal(row.cobrado),
    pendiente: decimal(row.pendiente),
    subtotal: decimal(subtotal),
    iva: decimal(row.iva),
    costo: row.costo == null ? null : decimal(row.costo),
    margen: margin == null ? null : decimal(margin),
    margenPorcentaje: margin == null ? null : decimal(subtotal === 0 ? 0 : (margin / subtotal) * 100),
    tickets: Number(row.tickets),
    ticketsCobrados: Number(row.ticketsCobrados),
    ticketsPendientes: Number(row.ticketsPendientes),
    cancelaciones: Number(row.cancelaciones),
    lineasExcluidasMargen: Number(row.lineasExcluidasMargen),
  };
}

export async function getSessionMargin(sesionId: number) {
  const result = await pool.query(
    `SELECT
       CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
         ELSE COALESCE(SUM(l.costo_total_congelado),0)::text END costo,
       CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
         ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END margen,
        COALESCE(SUM(l.importe),0)::text subtotal,
       COUNT(*) FILTER
          (WHERE l.costo_total_congelado IS NULL)::int excluidas
     FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
     WHERE t.sesion_caja_id=$1 AND t.estado='VENDIDO'`,
    [sesionId],
  );
  const row = result.rows[0]!;
  const margin = row.margen == null ? null : Number(row.margen);
  const subtotal = Number(row.subtotal);
  return {
    costo: row.costo == null ? null : decimal(row.costo),
    margen: margin == null ? null : decimal(margin),
    margenPorcentaje: margin == null ? null : decimal(subtotal === 0 ? 0 : (margin / subtotal) * 100),
    lineasExcluidasMargen: Number(row.excluidas),
  };
}

export async function getQuantities(filters: AnalyticsFilters) {
  const condition = where(filters);
  const result = await pool.query(
    `SELECT l.tipo,p.unidad,COALESCE(SUM(l.cantidad),0)::text cantidad
     FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
     JOIN productos p ON p.id=l.producto_id
     WHERE ${condition.text} AND t.estado='VENDIDO'
      GROUP BY l.tipo,p.unidad ORDER BY l.tipo,p.unidad`,
    condition.values,
  );
  return result.rows.map((row) => ({
    modalidad: row.tipo === "METREADO" ? "METRAJE" as const : "ROLLOS" as const,
    tipo: row.tipo as "NORMAL" | "METREADO",
    unidad: row.unidad as "METRO" | "KILO" | "BOLSA",
    cantidad: decimal(row.cantidad, 3),
  }));
}

export async function getPending(filters: AnalyticsFilters) {
  const condition = where(filters);
  const result = await pool.query(
    `SELECT COUNT(*)::int tickets,COALESCE(SUM(t.total),0)::text importe
     FROM tickets t WHERE ${condition.text}
       AND t.estado='VENDIDO' AND NOT t.cobrado`,
    condition.values,
  );
  return {
    tickets: Number(result.rows[0]!.tickets),
    importe: decimal(result.rows[0]!.importe),
  };
}

/** One read model powers both the five-minute dashboard and 30-second poll. */
export async function getRealtimeStores(filters: AnalyticsFilters) {
  const condition = where(filters);
  const result = await pool.query(
    `WITH filtered AS (
       SELECT t.* FROM tickets t WHERE ${condition.text}
     ), line_margin AS (
       SELECT l.ticket_id,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0) END margen,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)::int excluidas,
          COALESCE(SUM(l.importe),0) subtotal
       FROM ticket_lineas l JOIN filtered t ON t.id=l.ticket_id GROUP BY l.ticket_id
     ), payment AS (
       SELECT t.id,
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='EFECTIVO'),0) efectivo,
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='TRANSFERENCIA'),0) transferencia,
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='CREDITO'),0) credito
       FROM filtered t LEFT JOIN ticket_pagos p ON p.ticket_id=t.id
       WHERE t.estado='VENDIDO' AND t.cobrado GROUP BY t.id
     )
     SELECT u.id "ubicacionId",u.nombre "nombreUbicacion",
       s.id "sesionCajaId",s.abierta_at "abiertaAt",caj.nombre cajero,
       term.nombre "usuarioTerminal",
       COALESCE(SUM(t.total) FILTER (WHERE t.estado='VENDIDO'),0)::text vendido,
       COALESCE(SUM(t.total) FILTER (WHERE t.estado='VENDIDO' AND t.cobrado),0)::text cobrado,
       COALESCE(SUM(t.total) FILTER (WHERE t.estado='VENDIDO' AND NOT t.cobrado),0)::text pendiente,
       COUNT(*) FILTER (WHERE t.estado='VENDIDO')::int tickets,
        CASE WHEN COALESCE(SUM(m.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(m.margen),0)::text END margen,
        COALESCE(SUM(m.subtotal),0)::text subtotal,
       COALESCE(SUM(p.efectivo),0)::text efectivo,COALESCE(SUM(p.transferencia),0)::text transferencia,
       COALESCE(SUM(p.credito),0)::text credito,
       COUNT(*) FILTER (WHERE t.estado='VENDIDO' AND NOT t.cobrado AND t.created_at < now()-interval '30 minutes')::int "pendientes30Min",
       COUNT(*) FILTER (WHERE t.estado='CANCELADO')::int cancelaciones
     FROM ubicaciones u
     LEFT JOIN filtered t ON t.ubicacion_id=u.id
     LEFT JOIN line_margin m ON m.ticket_id=t.id
     LEFT JOIN payment p ON p.id=t.id
     LEFT JOIN LATERAL (
       SELECT sc.* FROM sesiones_caja sc WHERE sc.ubicacion_id=u.id AND sc.estado='ABIERTA'
       ORDER BY sc.abierta_at DESC LIMIT 1
     ) s ON true
     LEFT JOIN usuarios caj ON caj.id=s.usuario_id
     LEFT JOIN LATERAL (
       SELECT ut.nombre FROM filtered ft JOIN usuarios ut ON ut.id=ft.usuario_terminal_id
       WHERE ft.ubicacion_id=u.id ORDER BY ft.created_at DESC LIMIT 1
     ) term ON true
     WHERE u.tipo='TIENDA' AND u.activa
     GROUP BY u.id,u.nombre,s.id,s.abierta_at,caj.nombre,term.nombre
     ORDER BY u.nombre`,
    condition.values,
  );
  return result.rows.map((row) => {
    const sold = Number(row.vendido);
    const subtotal = Number(row.subtotal);
    const tickets = Number(row.tickets);
    const cancellationRate = tickets + Number(row.cancelaciones) === 0 ? 0 :
      (Number(row.cancelaciones) / (tickets + Number(row.cancelaciones))) * 100;
    const alerts: string[] = [];
    if (Number(row.pendientes30Min) > 0) alerts.push("PENDIENTE_MAS_30_MIN");
    const mexicoHour = mexicoCityHour();
    if (row.sesionCajaId == null && mexicoHour >= 10) alerts.push("SIN_CAJA_ABIERTA");
    if (row.margen != null && subtotal > 0 && (Number(row.margen) / subtotal) * 100 < 15) alerts.push("MARGEN_BAJO");
    if (cancellationRate > 10) alerts.push("CANCELACIONES_ALTAS");
    return {
      ...row,
      abiertaAt: row.abiertaAt ? new Date(row.abiertaAt).toISOString() : null,
      vendido: decimal(sold), cobrado: decimal(row.cobrado), pendiente: decimal(row.pendiente),
      ticketPromedio: decimal(tickets === 0 ? 0 : sold / tickets),
      margen: row.margen == null ? null : decimal(row.margen),
      margenPorcentaje: row.margen == null ? null : decimal(subtotal === 0 ? 0 : (Number(row.margen) / subtotal) * 100),
      efectivo: decimal(row.efectivo), transferencia: decimal(row.transferencia), credito: decimal(row.credito),
      tickets, pendientes30Min: Number(row.pendientes30Min),
      cancelaciones: Number(row.cancelaciones), tasaCancelacion: decimal(cancellationRate), alertas: alerts,
    };
  });
}

export async function getRealtimeTickets(filters: AnalyticsFilters) {
  const condition = where(filters);
  const result = await pool.query(
    `SELECT t.id,t.folio,t.created_at "createdAt",u.nombre "nombreUbicacion",c.nombre "nombreCliente",
       t.total::text importe,t.cobrado,
       CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
         ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END margen
     FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
     LEFT JOIN clientes c ON c.id=t.cliente_id LEFT JOIN ticket_lineas l ON l.ticket_id=t.id
     WHERE ${condition.text} GROUP BY t.id,u.nombre,c.nombre
     ORDER BY t.created_at DESC LIMIT 20`,
    condition.values,
  );
  return result.rows.map((row) => ({
    ...row, createdAt: new Date(row.createdAt).toISOString(),
    importe: decimal(row.importe), margen: row.margen == null ? null : decimal(row.margen),
  }));
}

export async function listCuts(
  filters: AnalyticsFilters,
  page = 1,
  pageSize = 50,
  extra: { cajeroId?: number; numeroCorte?: number; soloConDiferencia?: boolean } = {},
) {
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
    extra.cajeroId ?? null,
    extra.numeroCorte ?? null,
    extra.soloConDiferencia ?? false,
    pageSize,
    (page - 1) * pageSize,
  ];
  const base = `($1::timestamptz IS NULL OR s.abierta_at >= $1)
    AND ($2::timestamptz IS NULL OR s.abierta_at <= $2)
    AND ($3::int IS NULL OR s.ubicacion_id=$3)`;
  const extraWhere = `AND ($4::int IS NULL OR s.usuario_id=$4)
    AND ($5::int IS NULL OR s.id=$5)
    AND (NOT $6::boolean OR (s.efectivo_contado IS NOT NULL AND
      s.efectivo_contado-s.fondo_inicial-COALESCE(x.efectivo,0) <> 0))`;
  const lateral = `LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(t.total) FILTER (WHERE t.estado='VENDIDO'),0) vendido,
      COALESCE(SUM(p.importe) FILTER (WHERE t.estado='VENDIDO'),0) total,
      COALESCE(SUM(p.importe) FILTER (WHERE t.estado='VENDIDO' AND p.forma_pago='EFECTIVO'),0) efectivo,
      COUNT(DISTINCT t.id) FILTER (WHERE t.estado='VENDIDO' AND t.cobrado) cobrados,
      COUNT(DISTINCT t.id) FILTER (WHERE t.estado='CANCELADO') cancelados
    FROM tickets t LEFT JOIN ticket_pagos p ON p.ticket_id=t.id WHERE t.sesion_caja_id=s.id
  ) x ON true`;
  const [rows, count, totals] = await Promise.all([
    pool.query(
      `SELECT s.id,s.ubicacion_id "ubicacionId",u.nombre "nombreUbicacion",
        s.usuario_id "usuarioId",usr.nombre "nombreUsuario",s.abierta_at "abiertaAt",
        s.cerrada_at "cerradaAt",s.estado,s.fondo_inicial::text "fondoInicial",
        COALESCE(x.vendido,0)::text vendido,COALESCE(x.total,0)::text "totalCobrado",
        (s.fondo_inicial+COALESCE(x.efectivo,0))::text "efectivoEsperado",
        s.efectivo_contado::text "efectivoContado",
        CASE WHEN s.efectivo_contado IS NULL THEN NULL
          ELSE (s.efectivo_contado-s.fondo_inicial-COALESCE(x.efectivo,0))::text END diferencia,
        COALESCE(x.cobrados,0)::int "ticketsCobrados",
        COALESCE(x.cancelados,0)::int "ticketsCancelados"
       FROM sesiones_caja s JOIN ubicaciones u ON u.id=s.ubicacion_id
       JOIN usuarios usr ON usr.id=s.usuario_id
       ${lateral} WHERE ${base} ${extraWhere}
       ORDER BY s.abierta_at DESC LIMIT $7 OFFSET $8`,
      values,
    ),
    pool.query(`SELECT COUNT(*)::int total FROM sesiones_caja s ${lateral}
      WHERE ${base} ${extraWhere}`, values.slice(0, 6)),
    pool.query(`SELECT COALESCE(SUM(x.vendido),0)::text vendido,
      COALESCE(SUM(x.total),0)::text cobrado,
      COALESCE(SUM(s.fondo_inicial+x.efectivo),0)::text "efectivoEsperado",
      COALESCE(SUM(s.efectivo_contado),0)::text "efectivoContado",
      COALESCE(SUM(s.efectivo_contado-s.fondo_inicial-x.efectivo),0)::text diferencia,
      COALESCE(SUM(x.cobrados),0)::int tickets
      FROM sesiones_caja s ${lateral} WHERE ${base} ${extraWhere}`, values.slice(0, 6)),
  ]);
  return {
    items: rows.rows.map((row) => ({
      ...row,
      abiertaAt: new Date(row.abiertaAt).toISOString(),
      cerradaAt: row.cerradaAt ? new Date(row.cerradaAt).toISOString() : null,
      fondoInicial: decimal(row.fondoInicial),
      vendido: decimal(row.vendido),
      totalCobrado: decimal(row.totalCobrado),
      efectivoEsperado: decimal(row.efectivoEsperado),
      efectivoContado: row.efectivoContado == null ? null : decimal(row.efectivoContado),
      diferencia: row.diferencia == null ? null : decimal(row.diferencia),
    })),
    total: Number(count.rows[0]!.total),
    page,
    pageSize,
    totales: {
      vendido: decimal(totals.rows[0]!.vendido),
      cobrado: decimal(totals.rows[0]!.cobrado),
      efectivoEsperado: decimal(totals.rows[0]!.efectivoEsperado),
      efectivoContado: decimal(totals.rows[0]!.efectivoContado),
      diferencia: decimal(totals.rows[0]!.diferencia),
      tickets: Number(totals.rows[0]!.tickets),
    },
  };
}

export async function getDestinationAccounts(filters: AnalyticsFilters) {
  // Account destinations are cash-flow reporting: a ticket sold yesterday and
  // charged today belongs to today's collected period.
  const condition = where(filters, "t", "created_at");
  const priorCondition = where(previousEqualPeriod(filters), "t", "created_at");
  const accountSql = () => `${destinationReadModel()}
    SELECT (fecha AT TIME ZONE '${ANALYTICS_TIME_ZONE}')::date::text fecha,
      "formaPago",facturado,"cuentaDestino",SUM(importe)::text importe,COUNT(*)::int operaciones
    FROM destination_movements GROUP BY fecha,"formaPago",facturado,"cuentaDestino"`;
  const [result, fiscal, prior, byStore] = await Promise.all([pool.query(
    accountSql(),
    condition.values,
  ), pool.query(
    `SELECT COALESCE(SUM(t.iva),0)::text iva
     FROM tickets t WHERE ${condition.text}
       AND t.estado='VENDIDO' AND t.cobrado`,
    condition.values,
   ), pool.query(accountSql(), priorCondition.values),
   pool.query(
     `${destinationReadModel()}
      SELECT u.id "ubicacionId",u.nombre "nombreUbicacion",d."formaPago",d.facturado,d."cuentaDestino",SUM(d.importe)::text importe
      FROM destination_movements d JOIN ubicaciones u ON u.id=d."ubicacionId"
      GROUP BY u.id,u.nombre,d."formaPago",d.facturado,d."cuentaDestino" ORDER BY u.nombre`,
    condition.values,
  )]);
  const rows = result.rows.map((row) => ({
    ...row,
     cuentaDestino: row.cuentaDestino,
  }));
  const priorTotals = new Map<AccountDestination, number>();
  for (const row of prior.rows) {
     const destination = row.cuentaDestino as AccountDestination;
    priorTotals.set(destination, (priorTotals.get(destination) ?? 0) + Number(row.importe));
  }
  const destinationPaymentMethod: Record<AccountDestination, string> = {
    CAJA_FISICA: "EFECTIVO",
    CUENTA_NO_FISCAL: "TRANSFERENCIA",
    CUENTA_FISCAL: "TRANSFERENCIA",
    CUENTAS_POR_COBRAR: "CREDITO",
  };
  const summary = new Map<string, { cuentaDestino: string; formaPago: string; importe: number; operaciones: number }>(
    ACCOUNT_DESTINATION_ORDER.map((cuentaDestino) => [
      cuentaDestino,
      { cuentaDestino, formaPago: destinationPaymentMethod[cuentaDestino], importe: 0, operaciones: 0 },
    ]),
  );
  for (const row of rows) {
    const current = summary.get(row.cuentaDestino) ?? {
      cuentaDestino: row.cuentaDestino,
      formaPago: row.formaPago,
      importe: 0,
      operaciones: 0,
    };
    current.importe += Number(row.importe);
    current.operaciones += Number(row.operaciones);
    summary.set(row.cuentaDestino, current);
  }
  const total = [...summary.values()].reduce((sum, row) => sum + row.importe, 0);
  return {
    resumen: [...summary.values()].map((row) => ({
      ...row,
      importe: decimal(row.importe),
      importeAnterior: decimal(priorTotals.get(row.cuentaDestino as AccountDestination) ?? 0),
      variacionPorcentaje: decimal((priorTotals.get(row.cuentaDestino as AccountDestination) ?? 0) === 0
        ? (row.importe === 0 ? 0 : 100)
        : ((row.importe - (priorTotals.get(row.cuentaDestino as AccountDestination) ?? 0)) /
          (priorTotals.get(row.cuentaDestino as AccountDestination) ?? 1)) * 100),
      porcentaje: decimal(total === 0 ? 0 : (row.importe / total) * 100),
    })),
    tendencia: [...rows.reduce((map, row) => {
      const key = `${row.fecha}|${row.cuentaDestino}`;
      const current = map.get(key) ?? {
        fecha: row.fecha,
        cuentaDestino: row.cuentaDestino,
        importe: 0,
      };
      current.importe += Number(row.importe);
      map.set(key, current);
      return map;
    }, new Map<string, { fecha: string; cuentaDestino: string; importe: number }>()).values()]
      .map((row) => ({ ...row, importe: decimal(row.importe) })),
    ivaCobrado: decimal(fiscal.rows[0]!.iva),
    totalCobrado: decimal(total),
    porTienda: [...byStore.rows.reduce((map, row) => {
      const item = map.get(Number(row.ubicacionId)) ?? {
        ubicacionId: Number(row.ubicacionId), nombreUbicacion: String(row.nombreUbicacion),
        cajaFisica: 0, cuentaFiscal: 0, cuentaNoFiscal: 0, cuentasPorCobrar: 0,
      };
       const key = row.cuentaDestino as AccountDestination;
      if (key === "CAJA_FISICA") item.cajaFisica += Number(row.importe);
      else if (key === "CUENTA_FISCAL") item.cuentaFiscal += Number(row.importe);
      else if (key === "CUENTA_NO_FISCAL") item.cuentaNoFiscal += Number(row.importe);
      else item.cuentasPorCobrar += Number(row.importe);
      map.set(item.ubicacionId, item); return map;
    }, new Map<number, { ubicacionId: number; nombreUbicacion: string; cajaFisica: number; cuentaFiscal: number; cuentaNoFiscal: number; cuentasPorCobrar: number }>()).values()]
      .map((row) => ({
        ...row, cajaFisica: decimal(row.cajaFisica), cuentaFiscal: decimal(row.cuentaFiscal),
        cuentaNoFiscal: decimal(row.cuentaNoFiscal), cuentasPorCobrar: decimal(row.cuentasPorCobrar),
        total: decimal(row.cajaFisica + row.cuentaFiscal + row.cuentaNoFiscal + row.cuentasPorCobrar),
      })),
    facturacion: {
      facturadoTotal: decimal(rows.filter((r) => r.facturado).reduce((s, r) => s + Number(r.importe), 0)),
      noFacturadoTotal: decimal(rows.filter((r) => !r.facturado).reduce((s, r) => s + Number(r.importe), 0)),
      facturadoEfectivo: decimal(rows.filter((r) => r.facturado && r.formaPago === "EFECTIVO").reduce((s, r) => s + Number(r.importe), 0)),
      facturadoTransferencia: decimal(rows.filter((r) => r.facturado && r.formaPago === "TRANSFERENCIA").reduce((s, r) => s + Number(r.importe), 0)),
      noFacturadoEfectivo: decimal(rows.filter((r) => !r.facturado && r.formaPago === "EFECTIVO").reduce((s, r) => s + Number(r.importe), 0)),
      noFacturadoTransferencia: decimal(rows.filter((r) => !r.facturado && r.formaPago === "TRANSFERENCIA").reduce((s, r) => s + Number(r.importe), 0)),
    },
  };
}

export async function listDestinationAccountMovements(
  filters: AnalyticsFilters,
  destination: AccountDestination,
  page = 1,
  pageSize = 50,
) {
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
    destination,
    pageSize,
    (page - 1) * pageSize,
  ];
  const condition = `($1::timestamptz IS NULL OR t.created_at >= $1)
    AND ($2::timestamptz IS NULL OR t.created_at <= $2)
    AND ($3::int IS NULL OR t.ubicacion_id = $3)`;
  const readModel = destinationReadModel();
  const joins = `FROM destination_movements d
    LEFT JOIN ubicaciones u ON u.id=d."ubicacionId"
    JOIN usuarios registrador ON registrador.id=d."registroId"
    LEFT JOIN clientes c ON c.id=d."clienteId"`;
  const [rows, aggregate] = await Promise.all([
    pool.query(
       `${readModel} SELECT d.id,d.fecha,
         CASE d."cuentaDestino" WHEN 'CAJA_FISICA' THEN 'Cobro en efectivo'
           WHEN 'CUENTAS_POR_COBRAR' THEN 'Venta a crédito'
           WHEN 'CUENTA_FISCAL' THEN 'Transferencia fiscal' ELSE 'Transferencia no fiscal' END tipo,
         CASE WHEN d.fuente IN ('ABONO_SALDO_FAVOR','REVERSO_ABONO_SALDO_FAVOR') THEN 'CLIENTE' ELSE 'TICKET' END "documentoTipo",d."documentoId",
         CASE WHEN d.fuente IN ('ABONO_SALDO_FAVOR','REVERSO_ABONO_SALDO_FAVOR') THEN ('Cliente #' || d."clienteId"::text) ELSE ('Ticket #' || d.folio::text) END documento,c.nombre cliente,
         d."ubicacionId",COALESCE(u.nombre,'Estado de cuenta') sitio,d.importe::text monto,
         registrador.id "registroId",registrador.nombre registro
        ${joins} WHERE d."cuentaDestino"=$4
        ORDER BY d.fecha DESC,d.id DESC LIMIT $5 OFFSET $6`,
      values,
    ),
    pool.query(
       `${readModel} SELECT COUNT(*)::int total,COALESCE(SUM(d.importe),0)::text "montoTotal"
        ${joins} WHERE d."cuentaDestino"=$4`,
      values.slice(0, 4),
    ),
  ]);
  return {
    cuentaDestino: destination,
    items: rows.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      fecha: new Date(row.fecha).toISOString(),
      documentoId: Number(row.documentoId),
       ubicacionId: row.ubicacionId == null ? null : Number(row.ubicacionId),
      registroId: Number(row.registroId),
      monto: decimal(row.monto),
    })),
    total: Number(aggregate.rows[0]!.total),
    page,
    pageSize,
    montoTotal: decimal(aggregate.rows[0]!.montoTotal),
  };
}

export async function getDifferences(
  filters: AnalyticsFilters,
  options: { umbralCorte?: number; umbralTienda?: number; agrupacion?: "semana" | "mes" } = {},
) {
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
  ];
  const result = await pool.query(
    `WITH cuts AS (
       SELECT s.id,s.usuario_id,s.ubicacion_id,usr.nombre cajero,u.nombre tienda,
         (s.cerrada_at AT TIME ZONE '${ANALYTICS_TIME_ZONE}')::date::text fecha,
         s.efectivo_contado-s.fondo_inicial-COALESCE(SUM(p.importe)
           FILTER (WHERE t.estado='VENDIDO' AND p.forma_pago='EFECTIVO'),0) diferencia
       FROM sesiones_caja s JOIN usuarios usr ON usr.id=s.usuario_id
       JOIN ubicaciones u ON u.id=s.ubicacion_id
       LEFT JOIN tickets t ON t.sesion_caja_id=s.id
       LEFT JOIN ticket_pagos p ON p.ticket_id=t.id
       WHERE s.estado='CERRADA' AND s.efectivo_contado IS NOT NULL
         AND ($1::timestamptz IS NULL OR s.cerrada_at >= $1)
         AND ($2::timestamptz IS NULL OR s.cerrada_at <= $2)
         AND ($3::int IS NULL OR s.ubicacion_id=$3)
       GROUP BY s.id,usr.nombre,u.nombre
     ) SELECT * FROM cuts ORDER BY fecha,id`,
    values,
  );
  const group = (key: "usuario_id" | "ubicacion_id", name: "cajero" | "tienda") => {
    const map = new Map<number, { id: number; nombre: string; values: number[] }>();
    for (const row of result.rows) {
      const id = Number(row[key]);
      const item = map.get(id) ?? {
        id,
        nombre: String(row[name]),
        values: [] as number[],
      };
      item.values.push(Number(row.diferencia));
      map.set(id, item);
    }
    return [...map.values()].map((item) => {
      const total = item.values.reduce((sum, value) => sum + value, 0);
      const shortages = item.values.filter((value) => value < 0).map(Math.abs);
      const surpluses = item.values.filter((value) => value > 0);
      const net = shortages.reduce((sum, value) => sum + value, 0) -
        surpluses.reduce((sum, value) => sum + value, 0);
      return {
        id: item.id,
        nombre: item.nombre,
        cortes: item.values.length,
        exactos: item.values.filter((value) => value === 0).length,
        faltantes: shortages.length,
        sobrantes: surpluses.length,
        importeFaltantes: decimal(shortages.reduce((sum, value) => sum + value, 0)),
        importeSobrantes: decimal(surpluses.reduce((sum, value) => sum + value, 0)),
        diferencia: decimal(net),
        diferenciaNeta: decimal(net),
        diferenciaAbsoluta: decimal(item.values.reduce((sum, value) => sum + Math.abs(value), 0)),
        promedio: decimal(total / item.values.length),
        porcentajeExactos: decimal(
          (item.values.filter((value) => value === 0).length / item.values.length) * 100,
        ),
      };
    });
  };
  const trends = new Map<string, number[]>();
  for (const row of result.rows) {
    const local = new Date(`${row.fecha}T12:00:00Z`);
    const date = options.agrupacion === "mes"
      ? row.fecha.slice(0, 7) + "-01"
      : new Date(local.getTime() - ((local.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
    const valuesForPeriod = trends.get(date) ?? [];
    valuesForPeriod.push(Number(row.diferencia));
    trends.set(date, valuesForPeriod);
  }
  const differences = result.rows.map((row) => Number(row.diferencia));
  const exactos = differences.filter((value) => value === 0).length;
  const faltantes = differences.filter((value) => value < 0).map(Math.abs);
  const sobrantes = differences.filter((value) => value > 0);
  const groupedCashiers = group("usuario_id", "cajero");
  const thresholdAlerts = result.rows.filter((row) => Math.abs(Number(row.diferencia)) >= (options.umbralCorte ?? 500)).map((row) => {
    const amount = Number(row.diferencia);
    return {
      sesionId: Number(row.id),
      tipo: amount < 0 ? "FALTANTE" as const : "SOBRANTE" as const,
      mensaje: `${amount < 0 ? "Faltante" : "Sobrante"} en ${row.tienda} por ${row.cajero}`,
      importe: decimal(amount),
    };
  });
  const monthRows = await pool.query(
    `SELECT s.usuario_id,COUNT(*) FILTER (WHERE s.efectivo_contado-s.fondo_inicial-COALESCE(x.efectivo,0)<0)::int faltantes
     FROM sesiones_caja s LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(p.importe) FILTER (WHERE t.estado='VENDIDO' AND p.forma_pago='EFECTIVO'),0) efectivo
       FROM tickets t LEFT JOIN ticket_pagos p ON p.ticket_id=t.id WHERE t.sesion_caja_id=s.id
     ) x ON true WHERE s.estado='CERRADA' AND s.efectivo_contado IS NOT NULL
       AND s.cerrada_at >= date_trunc('month', now() AT TIME ZONE '${ANALYTICS_TIME_ZONE}') AT TIME ZONE '${ANALYTICS_TIME_ZONE}'
     GROUP BY s.usuario_id`,
  );
  const monthlyShortages = new Map(monthRows.rows.map((row) => [Number(row.usuario_id), Number(row.faltantes)]));
  const repeatedAlerts = groupedCashiers
    .filter((cashier) => (monthlyShortages.get(cashier.id) ?? 0) > 3)
    .map((cashier) => ({
      sesionId: 0,
      tipo: "FALTANTE" as const,
      mensaje: `${cashier.nombre} acumula más de tres cortes con faltante`,
      importe: cashier.diferencia,
    }));
  return {
    resumen: {
      cortes: differences.length,
      exactos,
      faltantes: faltantes.length,
      sobrantes: sobrantes.length,
      importeFaltantes: decimal(faltantes.reduce((sum, value) => sum + value, 0)),
      importeSobrantes: decimal(sobrantes.reduce((sum, value) => sum + value, 0)),
      diferenciaNeta: decimal(faltantes.reduce((sum, value) => sum + value, 0) - sobrantes.reduce((sum, value) => sum + value, 0)),
      diferenciaAbsoluta: decimal(differences.reduce((sum, value) => sum + Math.abs(value), 0)),
      porcentajeExactos: decimal(differences.length === 0 ? 0 : (exactos / differences.length) * 100),
    },
    porCajero: groupedCashiers,
    porTienda: group("ubicacion_id", "tienda"),
    tendencia: [...trends].map(([fecha, valuesForPeriod]) => ({
      fecha,
      importe: decimal(valuesForPeriod.filter((v) => v < 0).reduce((s, v) => s + Math.abs(v), 0) -
        valuesForPeriod.filter((v) => v > 0).reduce((s, v) => s + v, 0)),
      diferenciaAbsoluta: decimal(valuesForPeriod.reduce((s, v) => s + Math.abs(v), 0)),
      cortes: valuesForPeriod.length,
      exactos: valuesForPeriod.filter((v) => v === 0).length,
      porcentajeExactos: decimal(valuesForPeriod.length === 0 ? 0 :
        (valuesForPeriod.filter((v) => v === 0).length / valuesForPeriod.length) * 100),
    })),
    alertas: [...thresholdAlerts, ...repeatedAlerts,
      ...group("ubicacion_id", "tienda").filter((store) =>
        store.diferenciaAbsoluta && Number(store.diferenciaAbsoluta) >= (options.umbralTienda ?? 500),
      ).map((store) => ({ sesionId: 0, tipo: "FALTANTE" as const, mensaje: `${store.nombre} supera umbral acumulado`, importe: store.diferenciaAbsoluta }))],
  };
}

function localParts(date: Date) {
  const [year, month, day] = dateMexico(date).split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function calendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function comparisonRange(
  periodo: string,
  desde?: string | Date,
  hasta?: string | Date,
) {
  if (periodo === "personalizado") {
    if (!desde || !hasta) throw new AnalyticsInputError("El periodo personalizado requiere desde y hasta.");
    parseAnalyticsFilters({ desde, hasta });
    return {
      desde: desde instanceof Date ? desde.toISOString().slice(0, 10) : desde,
      hasta: hasta instanceof Date ? hasta.toISOString().slice(0, 10) : hasta,
    };
  }
  if (desde != null || hasta != null) {
    throw new AnalyticsInputError("desde y hasta solo se aceptan para periodo personalizado.");
  }
  const now = new Date();
  const p = localParts(now);
  let month = p.month;
  let day = p.day;
  if (periodo === "semanal") {
    const weekday = Number(new Intl.DateTimeFormat("en-US", { timeZone: ANALYTICS_TIME_ZONE, weekday: "short" })
      .format(now) === "Sun" ? 7 : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone: ANALYTICS_TIME_ZONE, weekday: "short" }).format(now),
      ) + 1);
    const start = new Date(Date.UTC(p.year, p.month - 1, p.day - weekday + 1));
    return { desde: start.toISOString().slice(0, 10), hasta: dateMexico(now) };
  }
  if (periodo === "mensual") day = 1;
  else if (periodo === "trimestral") { month = Math.floor((month - 1) / 3) * 3 + 1; day = 1; }
  else if (periodo === "semestral") { month = month <= 6 ? 1 : 7; day = 1; }
  else if (periodo === "anual") { month = 1; day = 1; }
  else if (periodo !== "diario") throw new AnalyticsInputError("Periodo inválido.");
  return { desde: calendarDate(p.year, month, day), hasta: dateMexico(now) };
}

export async function compareStores(filters: AnalyticsFilters) {
  const condition = where(filters);
  const result = await pool.query(
    `WITH ticket_data AS (
       SELECT t.id,t.ubicacion_id,t.estado,t.facturado,t.total,t.subtotal
       FROM tickets t WHERE ${condition.text}
     ), line_data AS (
       SELECT l.ticket_id,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.costo_total_congelado),0) END costo,
          COALESCE(SUM(l.importe),0) margen_base,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)::int excluidas,
         COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='METRO'),0) metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='KILO'),0) kilos,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='BOLSA'),0) bolsas,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='METRO'),0) rollos_metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='KILO'),0) rollos_kilos,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='BOLSA'),0) rollos_bolsas,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='METRO'),0) metraje_metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='BOLSA'),0) metraje_bolsas
       FROM ticket_lineas l JOIN ticket_data t ON t.id=l.ticket_id
       JOIN productos p ON p.id=l.producto_id WHERE t.estado='VENDIDO' GROUP BY l.ticket_id
     )
     SELECT u.id "ubicacionId",u.nombre "nombreUbicacion",
       COALESCE(SUM(t.total) FILTER (WHERE t.estado='VENDIDO'),0)::text ventas,
       COALESCE(SUM(t.subtotal) FILTER (WHERE t.estado='VENDIDO'),0)::text subtotal,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.costo),0)::text END costo,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.margen_base-l.costo),0)::text END margen,
       COUNT(*) FILTER (WHERE t.estado='VENDIDO')::int tickets,
       COUNT(*) FILTER (WHERE t.estado='CANCELADO')::int cancelaciones,
       COALESCE(SUM(l.excluidas),0)::int "lineasExcluidasMargen",
         COALESCE(SUM(l.metros),0)::text metros,COALESCE(SUM(l.kilos),0)::text kilos,COALESCE(SUM(l.bolsas),0)::text bolsas,
        COALESCE(SUM(l.rollos_metros),0)::text "rollosMetros",
        COALESCE(SUM(l.rollos_kilos),0)::text "rollosKilos",
         COALESCE(SUM(l.rollos_bolsas),0)::text "rollosBolsas",
        COALESCE(SUM(l.metraje_metros),0)::text "metrajeMetros",
         COALESCE(SUM(l.metraje_bolsas),0)::text "metrajeBolsas",
       COALESCE(pay.efectivo,0)::text efectivo,
       COALESCE(pay.transferencia,0)::text transferencia,
       COALESCE(pay.credito,0)::text credito,
       COALESCE(pay.facturado,0)::text facturado,
       COALESCE(cash.diferencia,0)::text "diferenciaCaja"
     FROM ubicaciones u LEFT JOIN ticket_data t ON t.ubicacion_id=u.id
     LEFT JOIN line_data l ON l.ticket_id=t.id
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='EFECTIVO'),0) efectivo,
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='TRANSFERENCIA'),0) transferencia,
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='CREDITO'),0) credito,
         COALESCE(SUM(p.importe) FILTER (WHERE ft.facturado),0) facturado
       FROM ticket_data ft JOIN ticket_pagos p ON p.ticket_id=ft.id
       WHERE ft.ubicacion_id=u.id AND ft.estado='VENDIDO'
     ) pay ON true
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(s.efectivo_contado-s.fondo_inicial-x.efectivo),0) diferencia
       FROM sesiones_caja s LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(p.importe) FILTER
           (WHERE ct.estado='VENDIDO' AND p.forma_pago='EFECTIVO'),0) efectivo
         FROM tickets ct LEFT JOIN ticket_pagos p ON p.ticket_id=ct.id
         WHERE ct.sesion_caja_id=s.id
       ) x ON true
       WHERE s.ubicacion_id=u.id AND s.estado='CERRADA' AND s.efectivo_contado IS NOT NULL
         AND ($1::timestamptz IS NULL OR s.cerrada_at >= $1)
         AND ($2::timestamptz IS NULL OR s.cerrada_at <= $2)
      ) cash ON true WHERE u.tipo='TIENDA' AND u.activa
     GROUP BY u.id,u.nombre,pay.efectivo,pay.transferencia,pay.credito,pay.facturado,cash.diferencia
     ORDER BY ventas DESC,u.nombre`,
    condition.values,
  );
  const previous = previousEqualPeriod(filters);
  const priorWhere = where(previous);
  const [priorRows, dailyRows] = await Promise.all([
    pool.query(
      `SELECT t.ubicacion_id "ubicacionId",COALESCE(SUM(t.total),0)::text ventas
       FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
       WHERE ${priorWhere.text} AND t.estado='VENDIDO'
         AND u.tipo='TIENDA' AND u.activa
       GROUP BY t.ubicacion_id`,
      priorWhere.values,
    ),
    pool.query(
      `SELECT (t.created_at AT TIME ZONE '${ANALYTICS_TIME_ZONE}')::date::text fecha,
        t.ubicacion_id "ubicacionId",u.nombre "nombreUbicacion",SUM(t.total)::text ventas
       FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
        WHERE ${condition.text} AND t.estado='VENDIDO'
          AND u.tipo='TIENDA' AND u.activa
       GROUP BY fecha,t.ubicacion_id,u.nombre ORDER BY fecha,u.nombre`,
      condition.values,
    ),
  ]);
  const totalSales = result.rows.reduce((sum, row) => sum + Number(row.ventas), 0);
  const totalTickets = result.rows.reduce((sum, row) => sum + Number(row.tickets), 0);
  const globalAverage = totalTickets === 0 ? 0 : totalSales / totalTickets;
  const priorMap = new Map(priorRows.rows.map((row) => [Number(row.ubicacionId), Number(row.ventas)]));
  const dailyMap = new Map<number, Array<{ fecha: string; ventas: number }>>();
  for (const row of dailyRows.rows) {
    const items = dailyMap.get(Number(row.ubicacionId)) ?? [];
    items.push({ fecha: row.fecha, ventas: Number(row.ventas) });
    dailyMap.set(Number(row.ubicacionId), items);
  }
  const tiendas = result.rows.map((row) => {
    const sales = Number(row.ventas);
    const tickets = Number(row.tickets);
    const average = tickets === 0 ? 0 : sales / tickets;
    const priorSales = priorMap.get(Number(row.ubicacionId)) ?? 0;
    const days = dailyMap.get(Number(row.ubicacionId)) ?? [];
    const sorted = [...days].sort((a, b) => a.ventas - b.ventas);
    return {
      ...row,
      ventas: decimal(sales), subtotal: decimal(row.subtotal),
      costo: row.costo == null ? null : decimal(row.costo),
      margen: row.margen == null ? null : decimal(row.margen),
      metros: decimal(row.metros, 3), kilos: decimal(row.kilos, 3), bolsas: decimal(row.bolsas, 3),
      rollosMetros: decimal(row.rollosMetros, 3),
      rollosKilos: decimal(row.rollosKilos, 3),
      rollosBolsas: decimal(row.rollosBolsas, 3),
      metrajeMetros: decimal(row.metrajeMetros, 3),
      metrajeBolsas: decimal(row.metrajeBolsas, 3),
      ticketPromedio: decimal(average),
      diferenciaTicketPromedio: decimal(average - globalAverage),
      tendenciaPorcentaje: decimal(priorSales === 0 ? (sales === 0 ? 0 : 100) : ((sales - priorSales) / priorSales) * 100),
      mejorDia: sorted.length === 0 ? { fecha: null, ventas: "0.00" } :
        { fecha: sorted[sorted.length - 1]!.fecha, ventas: decimal(sorted[sorted.length - 1]!.ventas) },
      peorDia: sorted.length === 0 ? { fecha: null, ventas: "0.00" } :
        { fecha: sorted[0]!.fecha, ventas: decimal(sorted[0]!.ventas) },
      efectivo: decimal(row.efectivo), transferencia: decimal(row.transferencia),
      credito: decimal(row.credito),
      porcentajeFacturado: decimal(sales === 0 ? 0 : (Number(row.facturado) / sales) * 100),
      diferenciaCaja: decimal(row.diferenciaCaja),
      participacion: decimal(totalSales === 0 ? 0 : (sales / totalSales) * 100),
    };
  });
  const sum = (key: string) => result.rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const facturado = sum("facturado");
  return {
    tiendas,
    promedioGeneralTicket: decimal(globalAverage),
    ventasPorFecha: dailyRows.rows.map((row) => ({
      fecha: row.fecha, ubicacionId: Number(row.ubicacionId),
      nombreUbicacion: row.nombreUbicacion, ventas: decimal(row.ventas),
    })),
    totales: {
      ventas: decimal(totalSales), subtotal: decimal(sum("subtotal")),
      costo: result.rows.some((row) => row.costo == null) ? null : decimal(sum("costo")),
      margen: result.rows.some((row) => row.margen == null) ? null : decimal(sum("margen")),
      tickets: totalTickets, ticketPromedio: decimal(globalAverage),
      cancelaciones: sum("cancelaciones"), lineasExcluidasMargen: sum("lineasExcluidasMargen"),
      metros: decimal(sum("metros"), 3), kilos: decimal(sum("kilos"), 3), bolsas: decimal(sum("bolsas"), 3),
      rollosMetros: decimal(sum("rollosMetros"), 3),
      rollosKilos: decimal(sum("rollosKilos"), 3),
      rollosBolsas: decimal(sum("rollosBolsas"), 3),
      metrajeMetros: decimal(sum("metrajeMetros"), 3),
      metrajeBolsas: decimal(sum("metrajeBolsas"), 3),
      efectivo: decimal(sum("efectivo")), transferencia: decimal(sum("transferencia")),
      credito: decimal(sum("credito")),
      porcentajeFacturado: decimal(totalSales === 0 ? 0 : (facturado / totalSales) * 100),
      diferenciaCaja: decimal(sum("diferenciaCaja")), participacion: decimal(totalSales === 0 ? 0 : 100),
    },
  };
}