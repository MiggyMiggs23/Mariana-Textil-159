import { pool } from "@workspace/db";
import {
  accountedDocumentAt,
  accountedDocumentPredicate,
  authorizedCreditPredicate,
  collectedTicketPredicate,
  pendingTicketPredicate,
  unpaidTicketPredicate,
} from "./accounted-document";
import {
  ACCOUNT_DESTINATION_ORDER,
  type AccountDestinationCode,
} from "@workspace/number-format";
import { parseMexicoDateQuery } from "./mexico-date";
import { orderStores } from "./store-order";
import {
  buildRealtimeCancellationReadModel,
  calculateRealtimeCancellationRate,
  realtimeCancellationWindow,
} from "./realtime-cancellations";

export const ANALYTICS_TIME_ZONE = "America/Mexico_City";
export const CANCELLATION_RATE_ALERT_THRESHOLD_PERCENT = 10;

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
  preset?: "hoy" | "semana" | "mes" | "trimestre" | "semestre" | "ano" | "custom";
};

export function previousEqualPeriod(
  filters: AnalyticsFilters,
  now = new Date(),
): AnalyticsFilters {
  if (!filters.desde || !filters.hasta) {
    throw new AnalyticsInputError("El periodo requiere límites para calcular su comparación.");
  }
  const inProgress = now >= filters.desde && now <= filters.hasta;
  const effectiveEnd = inProgress ? now : filters.hasta;
  const [startYear, startMonth, startDay] = dateMexico(filters.desde).split("-").map(Number);
  const [rangeEndYear, rangeEndMonth, rangeEndDay] = dateMexico(filters.hasta).split("-").map(Number);
  const legacyFullCalendarMonth = filters.preset === undefined
    && startDay === 1
    && startYear === rangeEndYear
    && startMonth === rangeEndMonth
    && rangeEndDay === new Date(Date.UTC(rangeEndYear!, rangeEndMonth!, 0)).getUTCDate();
  const calendarMonths = filters.preset === "mes"
    ? 1
    : filters.preset === "trimestre"
      ? 3
      : filters.preset === "ano"
        ? 12
        : legacyFullCalendarMonth
          ? 1
          : null;
  if (inProgress && calendarMonths !== null) {
    const shiftDate = (value: Date, months: number) => {
      const [year, month, day] = dateMexico(value).split("-").map(Number);
      const shiftedMonth = new Date(Date.UTC(year!, month! - 1 + months, 1));
      const shiftedYear = shiftedMonth.getUTCFullYear();
      const shiftedMonthNumber = shiftedMonth.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(shiftedYear, shiftedMonthNumber, 0)).getUTCDate();
      const date = [
        shiftedYear,
        String(shiftedMonthNumber).padStart(2, "0"),
        String(Math.min(day!, lastDay)).padStart(2, "0"),
      ].join("-");
      const shiftedStart = parseMexicoDateQuery(date, "start")!;
      const originalDayStart = parseMexicoDateQuery(dateMexico(value), "start")!;
      return new Date(shiftedStart.getTime() + value.getTime() - originalDayStart.getTime());
    };
    return {
      desde: shiftDate(filters.desde, -calendarMonths),
      hasta: shiftDate(effectiveEnd, -calendarMonths),
      ubicacionId: filters.ubicacionId,
      preset: filters.preset,
    };
  }
  const duration = effectiveEnd.getTime() - filters.desde.getTime() + 1;
  const hasta = new Date(filters.desde.getTime() - 1);
  return {
    desde: new Date(hasta.getTime() - duration + 1),
    hasta,
    ubicacionId: filters.ubicacionId,
    preset: filters.preset,
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
    SELECT p.id, ${accountedDocumentAt("t")} fecha, p.importe importe, p.forma_pago::text "formaPago",
      CASE WHEN p.forma_pago='EFECTIVO' THEN 'CAJA_FISICA'
        WHEN t.facturado THEN 'CUENTA_FISCAL' ELSE 'CUENTA_NO_FISCAL' END::text "cuentaDestino",
      t.id "documentoId", t.folio, t.cliente_id "clienteId", NULL::bigint "movimientoCreditoId",
      t.ubicacion_id "ubicacionId",
      p.usuario_id "registroId", t.facturado, 'POS' fuente
    FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id
    WHERE ($1::timestamptz IS NULL OR ${accountedDocumentAt("t")} >= $1)
      AND ($2::timestamptz IS NULL OR ${accountedDocumentAt("t")} <= $2)
      AND ($3::int IS NULL OR t.ubicacion_id=$3)
      AND ${accountedDocumentPredicate("t")} AND p.forma_pago <> 'CREDITO'
    UNION ALL
    SELECT m.id, ${accountedDocumentAt("t")} fecha, m.importe,
      'CREDITO'::text "formaPago", 'CUENTAS_POR_COBRAR'::text "cuentaDestino",
      t.id "documentoId", t.folio, m.cliente_id "clienteId", m.id "movimientoCreditoId",
      t.ubicacion_id "ubicacionId",
      m.usuario_id "registroId", COALESCE(t.facturado,false) facturado, 'CREDITO' fuente
    FROM movimientos_credito m JOIN tickets t ON t.id=m.ticket_id
    WHERE ($1::timestamptz IS NULL OR ${accountedDocumentAt("t")} >= $1)
      AND ($2::timestamptz IS NULL OR ${accountedDocumentAt("t")} <= $2)
      AND ($3::int IS NULL OR t.ubicacion_id=$3)
      AND m.tipo='VENTA_CREDITO' AND ${accountedDocumentPredicate("t")}
    UNION ALL
    SELECT (m.id * 1000000 + a.id),m.created_at fecha,a.importe,
      COALESCE(m.forma_pago::text,'TRANSFERENCIA') "formaPago",m.cuenta_destino::text "cuentaDestino",
      sale_ticket.id "documentoId",sale_ticket.folio,m.cliente_id "clienteId",m.id "movimientoCreditoId",
      sale_ticket.ubicacion_id "ubicacionId",
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
      m.cliente_id "documentoId",NULL::bigint folio,m.cliente_id "clienteId",m.id "movimientoCreditoId",
      NULL::int "ubicacionId",
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
      sale_ticket.id "documentoId",sale_ticket.folio,original.cliente_id "clienteId",r.id "movimientoCreditoId",
      sale_ticket.ubicacion_id "ubicacionId",
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
      original.cliente_id "documentoId",NULL::bigint folio,original.cliente_id "clienteId",r.id "movimientoCreditoId",
      NULL::int "ubicacionId",
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
     FROM destination_movements
     WHERE "cuentaDestino"=$4
       AND fuente IN ('POS','ABONO','REVERSO_ABONO','ABONO_SALDO_FAVOR','REVERSO_ABONO_SALDO_FAVOR')`,
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

export function percentageChange(current: number, previous: number): string | null {
  if (previous === 0) return current === 0 ? decimal(0) : null;
  return decimal(((current - previous) / previous) * 100);
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
  dateBasis: "ACCOUNTED" | "CREATED",
) {
  const timestamp = dateBasis === "ACCOUNTED" ? accountedDocumentAt(alias) : `${alias}.created_at`;
  return {
    text: `($1::timestamptz IS NULL OR ${timestamp} >= $1)
      AND ($2::timestamptz IS NULL OR ${timestamp} <= $2)
      AND ($3::int IS NULL OR ${alias}.ubicacion_id = $3)`,
    values: [
      filters.desde?.toISOString() ?? null,
      filters.hasta?.toISOString() ?? null,
      filters.ubicacionId ?? null,
    ],
  };
}

export async function getSalesSummary(filters: AnalyticsFilters) {
  const accountedCondition = where(filters, "t", "ACCOUNTED");
  const pendingCondition = where(filters, "t", "CREATED");
  const result = await pool.query(
    `WITH filtered AS (
       SELECT t.id,t.estado,t.cobrado,t.total,t.subtotal,t.iva,t.documento_tipo,t.autorizacion_estado
       FROM tickets t WHERE ${accountedCondition.text}
     ), pending AS (
       SELECT COUNT(*)::int tickets,COALESCE(SUM(t.total),0)::text importe
       FROM tickets t
       WHERE ${pendingCondition.text} AND ${pendingTicketPredicate("t")}
     ), cancellations AS (
       ${buildRealtimeCancellationReadModel("c")}
       AND ${realtimeCancellationWindow("c")}
     ), caja_payments AS (
       SELECT p.ticket_id,
         COALESCE(SUM(p.importe),0) cobrado
       FROM ticket_pagos p JOIN filtered f ON f.id=p.ticket_id
       WHERE f.estado='VENDIDO' AND f.cobrado
          -- Exclude what is not a collection instead of whitelisting known
          -- collection methods, so a new payment method cannot vanish silently.
          AND p.forma_pago <> 'CREDITO'
       GROUP BY p.ticket_id
     ), lines AS (
       SELECT l.ticket_id,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.costo_total_congelado),0) END costo,
          COALESCE(SUM(l.importe),0) importe_margen,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)::int excluidas
       FROM ticket_lineas l JOIN filtered f ON f.id=l.ticket_id
        WHERE f.estado='VENDIDO'
          AND ((f.documento_tipo='TICKET' AND f.cobrado)
            OR (f.documento_tipo='NOTA' AND f.autorizacion_estado='AUTORIZADA'))
        GROUP BY l.ticket_id
     )
     SELECT
       COALESCE(SUM(f.total) FILTER (WHERE f.estado='VENDIDO' AND
         ((f.documento_tipo='TICKET' AND f.cobrado) OR (f.documento_tipo='NOTA' AND f.autorizacion_estado='AUTORIZADA'))),0)::text ventas,
        COALESCE(SUM(f.total) FILTER (WHERE ${collectedTicketPredicate("f")}),0)::text cobrado,
       (SELECT importe FROM pending) pendiente,
       COALESCE(SUM(f.subtotal) FILTER (WHERE f.estado='VENDIDO' AND
         ((f.documento_tipo='TICKET' AND f.cobrado) OR (f.documento_tipo='NOTA' AND f.autorizacion_estado='AUTORIZADA'))),0)::text subtotal,
       COALESCE(SUM(f.iva) FILTER (WHERE f.estado='VENDIDO' AND
         ((f.documento_tipo='TICKET' AND f.cobrado) OR (f.documento_tipo='NOTA' AND f.autorizacion_estado='AUTORIZADA'))),0)::text iva,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.costo),0)::text END costo,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.importe_margen-l.costo),0)::text END margen,
       COUNT(*) FILTER (WHERE f.estado='VENDIDO' AND
         ((f.documento_tipo='TICKET' AND f.cobrado) OR (f.documento_tipo='NOTA' AND f.autorizacion_estado='AUTORIZADA')))::int tickets,
       COUNT(p.ticket_id)::int "ticketsCobrados",
       (SELECT tickets FROM pending) "documentosPendientes",
       (SELECT COUNT(*)::int FROM cancellations) cancelaciones,
       (SELECT COALESCE(SUM(c.importe),0)::text FROM cancellations c) "importeCancelaciones",
       COALESCE(SUM(l.excluidas),0)::int "lineasExcluidasMargen"
     FROM filtered f
     LEFT JOIN lines l ON l.ticket_id=f.id
     LEFT JOIN caja_payments p ON p.ticket_id=f.id`,
    accountedCondition.values,
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
    documentosPendientes: Number(row.documentosPendientes),
    cancelaciones: Number(row.cancelaciones),
    importeCancelaciones: decimal(row.importeCancelaciones),
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
      WHERE t.sesion_caja_id=$1 AND t.estado='VENDIDO'
        AND ((t.documento_tipo='TICKET' AND t.cobrado)
          OR (t.documento_tipo='NOTA' AND t.autorizacion_estado='AUTORIZADA'))`,
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
  const condition = where(filters, "t", "ACCOUNTED");
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
    unidad: row.unidad as "METRO" | "KILO" | "BOLSA" | "PIEZA",
    cantidad: decimal(row.cantidad, 3),
  }));
}

export async function getPending(filters: AnalyticsFilters) {
  const condition = where(filters, "t", "CREATED");
  const result = await pool.query(
    `SELECT COUNT(*)::int tickets,COALESCE(SUM(t.total),0)::text importe,
       COUNT(*) FILTER (WHERE t.documento_tipo='TICKET')::int "ticketsSinCobrar",
       COUNT(*) FILTER (WHERE t.documento_tipo='NOTA')::int "notasSinAutorizar"
     FROM tickets t WHERE ${condition.text}
       AND ${pendingTicketPredicate("t")}`,
    condition.values,
  );
  return {
    tickets: Number(result.rows[0]!.tickets),
    ticketsSinCobrar: Number(result.rows[0]!.ticketsSinCobrar),
    notasSinAutorizar: Number(result.rows[0]!.notasSinAutorizar),
    importe: decimal(result.rows[0]!.importe),
  };
}

export function summarizeRealtimeCredit(
  stores: Array<{ credito: string; creditoOperaciones: number }>,
) {
  return {
    importe: decimal(stores.reduce((sum, store) => sum + Number(store.credito), 0)),
    operaciones: stores.reduce((sum, store) => sum + store.creditoOperaciones, 0),
  };
}

export function summarizeRealtimeCancellations(
  totals: { tickets: number; cancelaciones: number; importeCancelaciones: string },
) {
  const cancellationRate = calculateRealtimeCancellationRate(
    totals.tickets,
    totals.cancelaciones,
  );
  return {
    tickets: totals.cancelaciones,
    importe: decimal(totals.importeCancelaciones),
    tasaCancelacion: decimal(cancellationRate),
    excedeUmbral: cancellationRate > CANCELLATION_RATE_ALERT_THRESHOLD_PERCENT,
  };
}

type RealtimeSalidaConcept =
  | "SALIDAS_EN_TRANSITO"
  | "SALIDAS_CANCELADAS";

const REALTIME_SALIDA_DEFINITIONS = {
  SALIDAS_EN_TRANSITO: {
    estado: "EN_TRANSITO",
    timestamp: "s.enviada_at",
  },
  SALIDAS_CANCELADAS: {
    estado: "CANCELADA",
    timestamp: "s.cancelada_at",
  },
} as const satisfies Record<
  RealtimeSalidaConcept,
  { estado: string; timestamp: string }
>;

const REALTIME_SALIDA_VALUE_JOIN = `LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(sr.cantidad_enviada * p.precio_sugerido),0) importe
  FROM salida_rollos sr
  JOIN rollos r ON r.id=sr.rollo_id
  JOIN productos p ON p.id=r.producto_id
  WHERE sr.salida_id=s.id
) valor ON true`;

function buildRealtimeSalidaOperationalReadModel(
  concepto: RealtimeSalidaConcept,
) {
  const definition = REALTIME_SALIDA_DEFINITIONS[concepto];
  return {
    timestamp: definition.timestamp,
    predicate: `s.estado='${definition.estado}'
      AND ($1::timestamptz IS NULL OR ${definition.timestamp} >= $1)
      AND ($2::timestamptz IS NULL OR ${definition.timestamp} <= $2)
      AND ($3::int IS NULL OR s.origen_id=$3)`,
  };
}

/**
 * Operational salida signals are intentionally read from the salida document
 * state, never from inventory movements, and do not participate in financial
 * dashboard identities.
 */
export async function getRealtimeSalidaSummaries(filters: AnalyticsFilters) {
  const enTransito = buildRealtimeSalidaOperationalReadModel("SALIDAS_EN_TRANSITO");
  const canceladas = buildRealtimeSalidaOperationalReadModel("SALIDAS_CANCELADAS");
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
  ];
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE ${enTransito.predicate}
       )::int "enTransitoConteo",
       COALESCE(SUM(valor.importe) FILTER (
         WHERE ${enTransito.predicate}
       ),0)::text "enTransitoImporte",
       COUNT(*) FILTER (
         WHERE ${canceladas.predicate}
       )::int "canceladasConteo",
       COALESCE(SUM(valor.importe) FILTER (
         WHERE ${canceladas.predicate}
       ),0)::text "canceladasImporte"
     FROM salidas s
     ${REALTIME_SALIDA_VALUE_JOIN}
     WHERE (${enTransito.predicate}) OR (${canceladas.predicate})`,
    values,
  );
  const row = result.rows[0]!;
  return {
    salidasEnTransito: {
      conteo: Number(row.enTransitoConteo),
      importe: decimal(row.enTransitoImporte),
    },
    salidasCanceladas: {
      conteo: Number(row.canceladasConteo),
      importe: decimal(row.canceladasImporte),
    },
  };
}

/** One read model powers both the five-minute dashboard and 30-second poll. */
export async function getRealtimeStores(filters: AnalyticsFilters) {
  const condition = where(filters, "t", "ACCOUNTED");
  const operationalCondition = where(filters, "t", "CREATED");
  const result = await pool.query(
    `WITH filtered AS (
       SELECT t.* FROM tickets t WHERE ${condition.text}
     ), operational AS (
       SELECT t.* FROM tickets t WHERE ${operationalCondition.text}
     ), cancellations AS (
       ${buildRealtimeCancellationReadModel("c")}
       AND ${realtimeCancellationWindow("c")}
     ), line_margin AS (
       SELECT l.ticket_id,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0) END margen,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)::int excluidas,
          COALESCE(SUM(l.importe),0) subtotal
        FROM ticket_lineas l JOIN filtered t ON t.id=l.ticket_id
        WHERE ${accountedDocumentPredicate("t")} GROUP BY l.ticket_id
     ), payment AS (
       SELECT t.id,
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='EFECTIVO'),0) efectivo,
          COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='TRANSFERENCIA'),0) transferencia,
          COALESCE(SUM(p.importe) FILTER (
            WHERE p.forma_pago IN ('EFECTIVO','TRANSFERENCIA','FACTURADO')
          ),0) cobrado
        FROM filtered t JOIN ticket_pagos p ON p.ticket_id=t.id
         WHERE ${collectedTicketPredicate("t")}
          AND p.forma_pago IN ('EFECTIVO','TRANSFERENCIA','FACTURADO')
        GROUP BY t.id
       ), credit_sales AS (
         SELECT t.ubicacion_id,
          COALESCE(SUM(m.importe),0) credito,
          COUNT(DISTINCT m.ticket_id)::int credito_operaciones
        FROM movimientos_credito m JOIN tickets t ON t.id=m.ticket_id
        WHERE m.tipo='VENTA_CREDITO' AND ${authorizedCreditPredicate("t")}
          AND ($1::timestamptz IS NULL OR ${accountedDocumentAt("t")} >= $1)
          AND ($2::timestamptz IS NULL OR ${accountedDocumentAt("t")} <= $2)
          AND ($3::int IS NULL OR t.ubicacion_id=$3)
        GROUP BY t.ubicacion_id
     )
     SELECT u.id "ubicacionId",u.nombre "nombreUbicacion",
       s.id "sesionCajaId",s.abierta_at "abiertaAt",caj.nombre cajero,
       term.nombre "usuarioTerminal",
        COALESCE(SUM(t.total) FILTER (WHERE ${accountedDocumentPredicate("t")}),0)::text vendido,
         COALESCE(SUM(p.cobrado),0)::text cobrado,
       COALESCE(pending.importe,0)::text pendiente,
       COUNT(*) FILTER (WHERE ${accountedDocumentPredicate("t")})::int tickets,
       COALESCE(pending.tickets,0)::int "documentosPendientes",
        COUNT(p.id)::int "ticketsCobrados",
        CASE WHEN COALESCE(SUM(m.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(m.margen),0)::text END margen,
        COALESCE(SUM(m.subtotal),0)::text subtotal,
       COALESCE(SUM(p.efectivo),0)::text efectivo,COALESCE(SUM(p.transferencia),0)::text transferencia,
        COALESCE(cs.credito,0)::text credito,
        COALESCE(cs.credito_operaciones,0)::int "creditoOperaciones",
       COALESCE(pending.antiguos,0)::int "pendientes30Min",
       COALESCE(cancelled.cancelaciones,0)::int cancelaciones
     FROM ubicaciones u
     LEFT JOIN filtered t ON t.ubicacion_id=u.id
     LEFT JOIN line_margin m ON m.ticket_id=t.id
     LEFT JOIN payment p ON p.id=t.id
       LEFT JOIN credit_sales cs ON cs.ubicacion_id=u.id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int cancelaciones
       FROM cancellations c
       WHERE c.ubicacion_id=u.id
     ) cancelled ON true
      LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(ot.total) FILTER (WHERE ${pendingTicketPredicate("ot")}),0) importe,
          COUNT(*) FILTER (WHERE ${pendingTicketPredicate("ot")})::int tickets,
           -- The 30-minute alert is a counter-service urgency for unpaid Tickets;
           -- authorization of a credit Note intentionally has no time alert.
          COUNT(*) FILTER (WHERE ${unpaidTicketPredicate("ot")} AND ot.created_at < now()-interval '30 minutes')::int antiguos
        FROM operational ot WHERE ot.ubicacion_id=u.id
      ) pending ON true
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
       GROUP BY u.id,u.nombre,s.id,s.abierta_at,caj.nombre,term.nombre,cs.credito,cs.credito_operaciones,pending.importe,pending.tickets,pending.antiguos,cancelled.cancelaciones
     ORDER BY u.nombre`,
    condition.values,
  );
  return orderStores(result.rows.map((row) => {
    const sold = Number(row.vendido);
    const collected = Number(row.cobrado);
    const subtotal = Number(row.subtotal);
    const tickets = Number(row.tickets);
    const ticketsCollected = Number(row.ticketsCobrados);
    const cancellationRate = calculateRealtimeCancellationRate(tickets, Number(row.cancelaciones));
    const alerts: string[] = [];
    if (Number(row.pendientes30Min) > 0) alerts.push("PENDIENTE_MAS_30_MIN");
    const mexicoHour = mexicoCityHour();
    if (row.sesionCajaId == null && mexicoHour >= 10) alerts.push("SIN_CAJA_ABIERTA");
    if (row.margen != null && subtotal > 0 && (Number(row.margen) / subtotal) * 100 < 15) alerts.push("MARGEN_BAJO");
    if (cancellationRate > CANCELLATION_RATE_ALERT_THRESHOLD_PERCENT) alerts.push("CANCELACIONES_ALTAS");
    return {
      ...row,
      abiertaAt: row.abiertaAt ? new Date(row.abiertaAt).toISOString() : null,
      vendido: decimal(sold), cobrado: decimal(row.cobrado), pendiente: decimal(row.pendiente),
      ticketPromedio: decimal(ticketsCollected === 0 ? 0 : collected / ticketsCollected),
      margen: row.margen == null ? null : decimal(row.margen),
      margenPorcentaje: row.margen == null ? null : decimal(subtotal === 0 ? 0 : (Number(row.margen) / subtotal) * 100),
      efectivo: decimal(row.efectivo), transferencia: decimal(row.transferencia), credito: decimal(row.credito),
       creditoOperaciones: Number(row.creditoOperaciones),
       tickets, ticketsCobrados: Number(row.ticketsCobrados),
       pendientes30Min: Number(row.pendientes30Min),
      cancelaciones: Number(row.cancelaciones), tasaCancelacion: decimal(cancellationRate), alertas: alerts,
    };
  }));
}

export type RealtimeBreakdownConcept =
  | "COBRADO"
  | "CREDITO"
  | "PENDIENTE"
  | "CANCELADAS"
  | RealtimeSalidaConcept;

async function listRealtimeSalidaBreakdown(
  filters: AnalyticsFilters,
  concepto: RealtimeSalidaConcept,
  page: number,
  pageSize: number,
) {
  const readModel = buildRealtimeSalidaOperationalReadModel(concepto);
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
    pageSize,
    (page - 1) * pageSize,
  ];
  const base = `FROM salidas s
    JOIN ubicaciones origen ON origen.id=s.origen_id
    LEFT JOIN ubicaciones destino ON destino.id=s.destino_id
    LEFT JOIN clientes c ON c.id=s.cliente_id
    ${REALTIME_SALIDA_VALUE_JOIN}
    WHERE ${readModel.predicate}`;
  const [rows, aggregate] = await Promise.all([
    pool.query(
      `SELECT s.id "salidaId",s.folio,s.origen_id "origenId",origen.nombre origen,
         s.destino_id "destinoId",destino.nombre destino,s.cliente_id "clienteId",
         c.nombre cliente,${readModel.timestamp} fecha,valor.importe::text importe
       ${base}
       ORDER BY ${readModel.timestamp} DESC,s.id DESC LIMIT $4 OFFSET $5`,
      values,
    ),
    pool.query(
      `SELECT COUNT(*)::int total,COALESCE(SUM(valor.importe),0)::text "montoTotal" ${base}`,
      values.slice(0, 3),
    ),
  ]);
  return {
    concepto,
    items: rows.rows.map((row) => ({
      salidaId: Number(row.salidaId),
      folio: Number(row.folio),
      origenId: Number(row.origenId),
      origen: String(row.origen),
      destinoId: row.destinoId == null ? null : Number(row.destinoId),
      destino: row.destino == null ? null : String(row.destino),
      clienteId: row.clienteId == null ? null : Number(row.clienteId),
      cliente: row.cliente == null ? null : String(row.cliente),
      fecha: new Date(row.fecha).toISOString(),
      importe: decimal(row.importe),
      href: `/salidas/${Number(row.salidaId)}`,
    })),
    total: Number(aggregate.rows[0]!.total),
    page,
    pageSize,
    montoTotal: decimal(aggregate.rows[0]!.montoTotal),
  };
}

/** Paginated rows behind realtime cards; predicates are shared with their aggregates. */
export async function listRealtimeBreakdown(
  filters: AnalyticsFilters,
  concepto: RealtimeBreakdownConcept,
  page = 1,
  pageSize = 50,
) {
  if (concepto === "SALIDAS_EN_TRANSITO" || concepto === "SALIDAS_CANCELADAS") {
    return listRealtimeSalidaBreakdown(filters, concepto, page, pageSize);
  }
  const cancellation = concepto === "CANCELADAS";
  const predicate = concepto === "COBRADO"
    ? collectedTicketPredicate("t")
    : concepto === "CREDITO"
      ? authorizedCreditPredicate("t")
      : cancellation
        ? ""
        : pendingTicketPredicate("t");
  const timestamp = concepto === "PENDIENTE"
    ? "t.created_at"
    : cancellation
      ? "cancellation.cancelado_at"
      : accountedDocumentAt("t");
  const creditSource = concepto === "CREDITO"
    ? `JOIN (
        SELECT m.ticket_id,COALESCE(SUM(m.importe),0) importe
        FROM movimientos_credito m
        WHERE m.tipo='VENTA_CREDITO'
        GROUP BY m.ticket_id
      ) credit ON credit.ticket_id=t.id`
    : "";
  const cancellationSource = cancellation
    ? `JOIN (${buildRealtimeCancellationReadModel("cancellation")}) cancellation
       ON cancellation.id=t.id`
    : "";
  const amount = concepto === "CREDITO"
    ? "credit.importe"
    : cancellation
      ? "cancellation.importe"
      : "t.total";
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
    pageSize,
    (page - 1) * pageSize,
  ];
  const condition = cancellation
    ? realtimeCancellationWindow("cancellation")
    : `($1::timestamptz IS NULL OR ${timestamp} >= $1)
      AND ($2::timestamptz IS NULL OR ${timestamp} <= $2)
      AND ($3::int IS NULL OR t.ubicacion_id=$3)
      AND ${predicate}`;
  const base = `FROM tickets t
    ${cancellationSource}
    ${creditSource}
    LEFT JOIN clientes c ON c.id=t.cliente_id
    LEFT JOIN usuarios cancelador ON cancelador.id=t.cancelado_por
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT p.forma_pago::text ORDER BY p.forma_pago::text) formas
      FROM ticket_pagos p WHERE p.ticket_id=t.id
    ) pagos ON true
    WHERE ${condition}`;
  const [rows, aggregate] = await Promise.all([
    pool.query(
      `SELECT t.id,t.folio,${timestamp} hora,COALESCE(c.nombre,'Público general') cliente,
        ${amount}::text importe,t.documento_tipo "documentoTipo",t.facturado,
        t.dias_plazo "diasPlazo",t.fecha_vencimiento "fechaVencimiento",pagos.formas,
         cancelador.nombre "nombreUsuarioCancelacion",
         ${cancellation ? "cancellation.cancelado_at" : "t.cancelado_at"} "canceladoAt",t.motivo_cancelacion "motivoCancelacion",
        GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (now()-t.created_at))/60))::int "minutosEspera"
       ${base}
       ORDER BY ${timestamp} DESC,t.id DESC LIMIT $4 OFFSET $5`,
      values,
    ),
    pool.query(
      `SELECT COUNT(*)::int total,COALESCE(SUM(${amount}),0)::text "montoTotal" ${base}`,
      values.slice(0, 3),
    ),
  ]);
  return {
    concepto,
    items: rows.rows.map((row) => {
      const formas = row.formas as string[] | null;
      return {
        id: Number(row.id),
        folio: Number(row.folio),
        hora: new Date(row.hora).toISOString(),
        cliente: String(row.cliente),
        importe: decimal(row.importe),
        formaPago: concepto === "COBRADO"
          ? !formas?.length ? "SIN_COBRO" : formas.length === 1 ? formas[0] : "MIXTO"
          : null,
        facturado: concepto === "COBRADO" ? Boolean(row.facturado) : null,
        diasPlazo: concepto === "CREDITO" ? Number(row.diasPlazo) : null,
        fechaVencimiento: concepto === "CREDITO" && row.fechaVencimiento
          ? row.fechaVencimiento instanceof Date
            ? row.fechaVencimiento.toISOString().slice(0, 10)
            : String(row.fechaVencimiento).slice(0, 10)
          : null,
        documentoTipo: concepto === "PENDIENTE" ? row.documentoTipo : null,
        minutosEspera: concepto === "PENDIENTE" ? Number(row.minutosEspera) : null,
        nombreUsuarioCancelacion: concepto === "CANCELADAS"
          ? String(row.nombreUsuarioCancelacion ?? "Usuario no disponible")
          : null,
        canceladoAt: concepto === "CANCELADAS" && row.canceladoAt
          ? new Date(row.canceladoAt).toISOString()
          : null,
        motivoCancelacion: concepto === "CANCELADAS"
          ? String(row.motivoCancelacion ?? "")
          : null,
      };
    }),
    total: Number(aggregate.rows[0]!.total),
    page,
    pageSize,
    montoTotal: decimal(aggregate.rows[0]!.montoTotal),
  };
}

export async function listStoreSales(
  filters: AnalyticsFilters & { ubicacionId: number },
  formaPago: "EFECTIVO" | "TRANSFERENCIA" | "CREDITO" | undefined,
  page = 1,
  pageSize = 50,
) {
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId,
    formaPago ?? null,
    pageSize,
    (page - 1) * pageSize,
  ];
  const condition = `t.ubicacion_id=$3
    AND ${accountedDocumentPredicate("t")}
    AND ($1::timestamptz IS NULL OR ${accountedDocumentAt("t")} >= $1)
    AND ($2::timestamptz IS NULL OR ${accountedDocumentAt("t")} <= $2)
    AND ($4::text IS NULL OR (
      $4='CREDITO' AND t.documento_tipo='NOTA' AND t.autorizacion_estado='AUTORIZADA'
    ) OR ($4 <> 'CREDITO' AND EXISTS (
      SELECT 1 FROM ticket_pagos fp
      WHERE fp.ticket_id=t.id AND fp.forma_pago=$4::forma_pago_ticket
    )))`;
  const base = `FROM tickets t LEFT JOIN clientes c ON c.id=t.cliente_id
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT p.forma_pago::text ORDER BY p.forma_pago::text) formas
      FROM ticket_pagos p WHERE p.ticket_id=t.id
    ) pagos ON true
    LEFT JOIN LATERAL (
      SELECT CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
        ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END utilidad
      FROM ticket_lineas l WHERE l.ticket_id=t.id
    ) margen ON true
    WHERE ${condition}`;
  const [rows, count, store] = await Promise.all([
    pool.query(`SELECT t.id,${accountedDocumentAt("t")} "createdAt",t.folio,COALESCE(c.nombre,'Público general') cliente,
      t.total::text importe,t.cobrado,t.credito,pagos.formas,margen.utilidad
      ${base} ORDER BY ${accountedDocumentAt("t")} DESC,t.id DESC LIMIT $5 OFFSET $6`, values),
    pool.query(`SELECT COUNT(*)::int total ${base}`, values.slice(0, 4)),
    pool.query(
      `SELECT id,nombre FROM ubicaciones
       WHERE id=$1 AND tipo='TIENDA' AND activa`,
      [filters.ubicacionId],
    ),
  ]);
  if (!store.rows[0]) {
    throw new AnalyticsInputError("La tienda solicitada no existe o está inactiva.");
  }
  return {
    ubicacionId: Number(store.rows[0].id),
    nombreUbicacion: String(store.rows[0].nombre),
    items: rows.rows.map((row) => {
      const forms = row.formas as string[] | null;
      return {
        id: Number(row.id),
        createdAt: new Date(row.createdAt).toISOString(),
        folio: Number(row.folio),
        cliente: String(row.cliente),
        formaPago: row.credito ? "CREDITO" : !forms?.length ? "SIN_COBRO" :
          forms.length === 1 ? forms[0] : "MIXTO",
        importe: decimal(row.importe),
        estadoCobro: row.credito ? "CREDITO" : row.cobrado ? "COBRADO" : "PENDIENTE",
        utilidad: row.utilidad == null ? null : decimal(row.utilidad),
      };
    }),
    total: Number(count.rows[0]!.total),
    page,
    pageSize,
  };
}

type StoreSalesGlobalLine = {
  ticketId: number;
  tela: string;
  color: string;
  tipo: "NORMAL" | "METREADO";
  unidad: "METRO" | "KILO" | "BOLSA" | "PIEZA";
  cantidad: number;
  importe: number;
  allocatedGross: number;
  costoTotal: number | null;
};

type GlobalAggregate = {
  quantities: Map<StoreSalesGlobalLine["unidad"], number>;
  tickets: Set<number>;
  importe: number;
  lines: StoreSalesGlobalLine[];
};

const UNIT_ORDER: StoreSalesGlobalLine["unidad"][] = ["METRO", "KILO", "BOLSA", "PIEZA"];

function aggregateGlobalLines(lines: StoreSalesGlobalLine[]): GlobalAggregate {
  const aggregate: GlobalAggregate = {
    quantities: new Map(),
    tickets: new Set(),
    importe: 0,
    lines,
  };
  for (const line of lines) {
    aggregate.quantities.set(
      line.unidad,
      (aggregate.quantities.get(line.unidad) ?? 0) + line.cantidad,
    );
    aggregate.tickets.add(line.ticketId);
    aggregate.importe += line.allocatedGross;
  }
  return aggregate;
}

function quantities(aggregate: GlobalAggregate) {
  return UNIT_ORDER
    .filter((unit) => aggregate.quantities.has(unit))
    .map((unidad) => ({
      unidad,
      cantidad: decimal(aggregate.quantities.get(unidad), 3),
    }));
}

function utility(lines: StoreSalesGlobalLine[]) {
  const known = lines.filter((line) => line.costoTotal != null);
  const excluded = lines.length - known.length;
  if (known.length === 0) {
    return { value: null, status: "PENDIENTE" as const };
  }
  return {
    value: decimal(known.reduce(
      (sum, line) => sum + line.importe - line.costoTotal!,
      0,
    )),
    status: excluded > 0 ? "PARCIAL" as const : "COMPLETA" as const,
  };
}

function presentGlobalAggregate(aggregate: GlobalAggregate) {
  const lineasSinCosto = aggregate.lines.filter((line) => line.costoTotal == null).length;
  const modalidades = (["NORMAL", "METREADO"] as const).flatMap((tipo) =>
    UNIT_ORDER.flatMap((unidad) => {
      const lines = aggregate.lines.filter(
        (line) => line.tipo === tipo && line.unidad === unidad,
      );
      if (lines.length === 0) return [];
      const bucket = aggregateGlobalLines(lines);
      const result = utility(lines);
      const bucketLinesWithoutCost = lines.filter((line) => line.costoTotal == null).length;
      return [{
        tipo,
        unidad,
        cantidad: decimal(bucket.quantities.get(unidad), 3),
        operaciones: bucket.tickets.size,
        importe: decimal(bucket.importe),
        utilidad: result.value,
        utilidadStatus: result.status,
        lineasSinCosto: bucketLinesWithoutCost,
        lineasExcluidasSinCosto: bucketLinesWithoutCost,
      }];
    })
  );
  const presented: Record<string, unknown> = {
    cantidades: quantities(aggregate),
    operaciones: aggregate.tickets.size,
    importe: decimal(aggregate.importe),
    lineasSinCosto,
    lineasExcluidasSinCosto: lineasSinCosto,
    modalidades,
  };
  const rollos = aggregate.lines.filter((line) => line.tipo === "NORMAL");
  if (rollos.length > 0) {
    const result = utility(rollos);
    presented.utilityRollos = result.value;
    presented.utilityRollosStatus = result.status;
  }
  const metraje = aggregate.lines.filter((line) => line.tipo === "METREADO");
  if (metraje.length > 0) {
    const result = utility(metraje);
    presented.utilityMetraje = result.value;
    presented.utilityMetrajeStatus = result.status;
  }
  return presented;
}

/** Pure hierarchy builder; useful independently of the database read model. */
export function summarizeStoreSalesGlobal(lines: StoreSalesGlobalLine[]) {
  const telas = [...new Set(lines.map((line) => line.tela))]
    .map((tela) => {
      const telaLines = lines.filter((line) => line.tela === tela);
      const colores = [...new Set(telaLines.map((line) => line.color))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((color) => ({
          color,
          ...presentGlobalAggregate(aggregateGlobalLines(
            telaLines.filter((line) => line.color === color),
          )),
        }));
      return {
        tela,
        ...presentGlobalAggregate(aggregateGlobalLines(telaLines)),
        colores,
        sortImporte: aggregateGlobalLines(telaLines).importe,
      };
    })
    .sort((a, b) =>
      b.sortImporte - a.sortImporte ||
      a.tela.localeCompare(b.tela, "es")
    )
    .map(({ sortImporte: _, ...tela }) => tela);
  const period = aggregateGlobalLines(lines);
  const lineasSinCosto = lines.filter((line) => line.costoTotal == null).length;
  const periodPresented = presentGlobalAggregate(period);
  return {
    cantidadesPorUnidad: quantities(period),
    modalidades: periodPresented.modalidades,
    lineasSinCosto,
    lineasExcluidasSinCosto: lineasSinCosto,
    telas,
  };
}

export async function getStoreSalesGlobal(
  filters: AnalyticsFilters & { ubicacionId: number },
) {
  const values = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId,
  ];
  const predicate = `t.ubicacion_id=$3
    AND ${accountedDocumentPredicate("t")}
    AND ($1::timestamptz IS NULL OR ${accountedDocumentAt("t")} >= $1)
    AND ($2::timestamptz IS NULL OR ${accountedDocumentAt("t")} <= $2)`;
  const [store, totals, rows] = await Promise.all([
    pool.query(
      `SELECT id,nombre FROM ubicaciones
       WHERE id=$1 AND tipo='TIENDA' AND activa`,
      [filters.ubicacionId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(t.total),0)::text importe,
         COUNT(DISTINCT t.id)::int operaciones
       FROM tickets t WHERE ${predicate}`,
      values,
    ),
    pool.query(
       `WITH selected AS (
         SELECT t.id,t.total,t.subtotal,COUNT(l.id) OVER (PARTITION BY t.id) line_count,
            ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY l.id) line_number,
            l.id line_id,l.producto_id,l.tipo,l.cantidad,l.importe,l.costo_total_congelado
         FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
         WHERE ${predicate}
       ), shares AS (
         SELECT s.*,ROUND(CASE WHEN s.subtotal <> 0
           THEN s.total*s.importe/s.subtotal
           ELSE s.total/NULLIF(s.line_count,0)
         END,2) rounded_gross
         FROM selected s
       )
       SELECT s.id "ticketId",p.tela,p.color,s.tipo,p.unidad,
         s.cantidad::text,s.importe::text,s.costo_total_congelado::text "costoTotal",
          CASE WHEN s.line_number=s.line_count
            THEN (s.total-COALESCE(SUM(s.rounded_gross) FILTER (
              WHERE s.line_number<s.line_count
            ) OVER (PARTITION BY s.id),0))::text
            ELSE s.rounded_gross::text
         END "allocatedGross"
       FROM shares s JOIN productos p ON p.id=s.producto_id
       ORDER BY p.tela,p.color,s.tipo,p.unidad,s.line_id`,
      values,
    ),
  ]);
  if (!store.rows[0]) {
    throw new AnalyticsInputError("La tienda solicitada no existe o está inactiva.");
  }
  const lines: StoreSalesGlobalLine[] = rows.rows.map((row) => ({
    ticketId: Number(row.ticketId),
    tela: String(row.tela),
    color: String(row.color),
    tipo: row.tipo as StoreSalesGlobalLine["tipo"],
    unidad: row.unidad as StoreSalesGlobalLine["unidad"],
    cantidad: Number(row.cantidad),
    importe: Number(row.importe),
    allocatedGross: Number(row.allocatedGross),
    costoTotal: row.costoTotal == null ? null : Number(row.costoTotal),
  }));
  return {
    ubicacionId: Number(store.rows[0].id),
    nombreUbicacion: String(store.rows[0].nombre),
    totalImporte: decimal(totals.rows[0]!.importe),
    totalOperaciones: Number(totals.rows[0]!.operaciones),
    ...summarizeStoreSalesGlobal(lines),
  };
}

export async function getRealtimeTickets(filters: AnalyticsFilters) {
  const condition = where(filters, "t", "CREATED");
  const result = await pool.query(
    `SELECT t.id,t.folio,t.created_at "createdAt",u.nombre "nombreUbicacion",c.nombre "nombreCliente",
       t.total::text importe,t.cobrado,t.documento_tipo "documentoTipo",
       t.autorizacion_estado "autorizacionEstado",
       CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
         ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END margen
     FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
     LEFT JOIN clientes c ON c.id=t.cliente_id LEFT JOIN ticket_lineas l ON l.ticket_id=t.id
     WHERE ${condition.text} AND t.estado='VENDIDO'
     GROUP BY t.id,u.nombre,c.nombre
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

export async function getDestinationAccounts(filters: AnalyticsFilters, compare = false) {
  // Account destinations are cash-flow reporting: a ticket sold yesterday and
  // charged today belongs to today's collected period.
  const condition = where(filters, "t", "ACCOUNTED");
  const previousFilters = compare ? previousEqualPeriod(filters) : null;
  const accountSql = () => `${destinationReadModel()}
    SELECT (fecha AT TIME ZONE '${ANALYTICS_TIME_ZONE}')::date::text fecha,
      "formaPago",facturado,"cuentaDestino",fuente,SUM(importe)::text importe,COUNT(*)::int operaciones,
      COUNT(DISTINCT (id / 1000000)) FILTER (WHERE fuente='ABONO' AND
        ((facturado AND "cuentaDestino"='CUENTA_NO_FISCAL') OR
         (NOT facturado AND "cuentaDestino"='CUENTA_FISCAL')))::int incongruencias,
      COALESCE(SUM(importe) FILTER (WHERE fuente='ABONO' AND
        ((facturado AND "cuentaDestino"='CUENTA_NO_FISCAL') OR
         (NOT facturado AND "cuentaDestino"='CUENTA_FISCAL'))),0)::text "importeIncongruente"
    FROM destination_movements GROUP BY fecha,"formaPago",facturado,"cuentaDestino",fuente`;
  const currentQueries = await Promise.all([pool.query(
    accountSql(),
    condition.values,
  ), pool.query(
    `SELECT COALESCE(SUM(t.iva),0)::text iva,
       COALESCE(SUM(t.subtotal) FILTER (WHERE t.facturado),0)::text "baseFacturada",
       COALESCE(SUM(t.iva) FILTER (WHERE t.facturado),0)::text "ivaFacturado"
     FROM tickets t WHERE ${condition.text}
       AND ${accountedDocumentPredicate("t")}`,
    condition.values,
   ), pool.query(
     `${destinationReadModel()}
       SELECT u.id "ubicacionId",u.nombre "nombreUbicacion",d."formaPago",d.facturado,d."cuentaDestino",d.fuente,SUM(d.importe)::text importe
      FROM destination_movements d JOIN ubicaciones u ON u.id=d."ubicacionId"
       GROUP BY u.id,u.nombre,d."formaPago",d.facturado,d."cuentaDestino",d.fuente ORDER BY u.nombre`,
    condition.values,
  )]);
  const [result, fiscal, byStore] = currentQueries;
  // compare=false intentionally does not enqueue or execute a previous-period query.
  const prior = previousFilters
    ? await pool.query(accountSql(), [
      previousFilters.desde!.toISOString(),
      previousFilters.hasta!.toISOString(),
      previousFilters.ubicacionId ?? null,
    ])
    : { rows: [] };
  const rows = result.rows;
  const saleSources = new Set(["POS", "CREDITO"]);
  const collectionSources = new Set([
    "POS",
    "ABONO",
    "REVERSO_ABONO",
    "ABONO_SALDO_FAVOR",
    "REVERSO_ABONO_SALDO_FAVOR",
  ]);
  const saleRows = rows.filter((row) => saleSources.has(row.fuente));
  const collectionRows = rows.filter((row) => collectionSources.has(row.fuente));
  const priorSaleRows = prior.rows.filter((row) => saleSources.has(row.fuente));
  const priorCollectionRows = prior.rows.filter((row) => collectionSources.has(row.fuente));
  const priorTotals = new Map<AccountDestination, number>();
  for (const row of priorCollectionRows) {
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
  for (const row of collectionRows) {
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
  const sumSources = (sourceRows: any[], fuentes: string[]) => sourceRows
    .filter((row) => fuentes.includes(row.fuente))
    .reduce((sum, row) => sum + Number(row.importe), 0);
  const contado = sumSources(saleRows, ["POS"]);
  const credito = sumSources(saleRows, ["CREDITO"]);
  const sold = contado + credito;
  // Identity: POS is simultaneously evidence of a cash sale and its collection,
  // so it intentionally belongs to both Vendido and Cobrado without duplication
  // inside either measure.
  const pos = sumSources(collectionRows, ["POS"]);
  const abonos = sumSources(collectionRows, ["ABONO", "REVERSO_ABONO"]);
  const abonosSaldoFavor = sumSources(collectionRows, [
    "ABONO_SALDO_FAVOR",
    "REVERSO_ABONO_SALDO_FAVOR",
  ]);
  const collected = pos + abonos + abonosSaldoFavor;
  // Cobrado + Por cobrar is not an identity for Vendido: Cobrado includes ABONOs
  // settling credit sales from earlier periods, while Por cobrar means only the
  // credit notes created in this reporting period (not their outstanding balance).
  const priorContado = sumSources(priorSaleRows, ["POS"]);
  const priorCredito = sumSources(priorSaleRows, ["CREDITO"]);
  const priorSold = priorContado + priorCredito;
  const priorPos = sumSources(priorCollectionRows, ["POS"]);
  const priorAbonos = sumSources(priorCollectionRows, ["ABONO", "REVERSO_ABONO"]);
  const priorAbonosSaldoFavor = sumSources(priorCollectionRows, [
    "ABONO_SALDO_FAVOR",
    "REVERSO_ABONO_SALDO_FAVOR",
  ]);
  const priorCollected = priorPos + priorAbonos + priorAbonosSaldoFavor;
  const matrix = reconcileDestinationMatrix(saleRows);
  const incongruenceCount = rows.reduce(
    (sum, row) => sum + Number(row.incongruencias ?? 0),
    0,
  );
  const incongruenceAmount = rows.reduce(
    (sum, row) => sum + Number(row.importeIncongruente ?? 0),
    0,
  );
  return {
    resumen: [...summary.values()].map((row) => ({
      ...row,
      importe: decimal(row.importe),
      importeAnterior: compare
        ? decimal(priorTotals.get(row.cuentaDestino as AccountDestination) ?? 0)
        : null,
      variacionPorcentaje: compare
        ? percentageChange(row.importe, priorTotals.get(row.cuentaDestino as AccountDestination) ?? 0)
        : null,
      porcentaje: decimal(collected === 0 ? 0 : (row.importe / collected) * 100),
      cajaFisicaFacturado: decimal(row.cuentaDestino === "CAJA_FISICA"
        ? collectionRows.filter((item) => item.cuentaDestino === "CAJA_FISICA" && item.facturado)
          .reduce((sum, item) => sum + Number(item.importe), 0)
        : 0),
    })),
    tendencia: [...saleRows.reduce((map, row) => {
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
    totalCobrado: decimal(collected),
    encabezado: {
      vendido: {
        contado: decimal(contado),
        credito: decimal(credito),
        total: decimal(sold),
        totalAnterior: compare ? decimal(priorSold) : null,
        variacionPorcentaje: compare ? percentageChange(sold, priorSold) : null,
      },
      porCobrar: {
        periodo: decimal(credito),
        periodoAnterior: compare ? decimal(priorCredito) : null,
        variacionPorcentaje: compare ? percentageChange(credito, priorCredito) : null,
      },
      cobrado: {
        contado: decimal(pos),
        abonos: decimal(abonos),
        saldosFavor: decimal(abonosSaldoFavor),
        total: decimal(collected),
        totalAnterior: compare ? decimal(priorCollected) : null,
        variacionPorcentaje: compare ? percentageChange(collected, priorCollected) : null,
      },
      previousDesde: previousFilters?.desde?.toISOString() ?? null,
      previousHasta: previousFilters?.hasta?.toISOString() ?? null,
    },
    cobrosAnteriores: ACCOUNT_DESTINATION_ORDER.flatMap((cuentaDestino) =>
      (["ABONO", "ABONO_SALDO_FAVOR"] as const).map((fuente) => {
        const sourceNames = fuente === "ABONO"
          ? ["ABONO", "REVERSO_ABONO"]
          : ["ABONO_SALDO_FAVOR", "REVERSO_ABONO_SALDO_FAVOR"];
        const amount = collectionRows
          .filter((row) => row.cuentaDestino === cuentaDestino && sourceNames.includes(row.fuente))
          .reduce((sum, row) => sum + Number(row.importe), 0);
        const priorAmount = priorCollectionRows
          .filter((row) => row.cuentaDestino === cuentaDestino && sourceNames.includes(row.fuente))
          .reduce((sum, row) => sum + Number(row.importe), 0);
        return {
          cuentaDestino,
          fuente,
          importe: decimal(amount),
          importeAnterior: compare ? decimal(priorAmount) : null,
          variacionPorcentaje: compare ? percentageChange(amount, priorAmount) : null,
        };
      }),
    ).filter((row) => Number(row.importe) !== 0 || (compare && Number(row.importeAnterior) !== 0)),
    matriz: matrix,
    ivaFacturado: {
      base: decimal(fiscal.rows[0]!.baseFacturada),
      iva: decimal(fiscal.rows[0]!.ivaFacturado),
    },
    incongruencias: {
      conteo: incongruenceCount,
      importe: decimal(incongruenceAmount),
    },
    porTienda: orderStores([...byStore.rows.reduce((map, row) => {
      const item = map.get(Number(row.ubicacionId)) ?? {
        ubicacionId: Number(row.ubicacionId), nombreUbicacion: String(row.nombreUbicacion),
        cajaFisica: 0, cuentaFiscal: 0, cuentaNoFiscal: 0, cuentasPorCobrar: 0,
      };
      const key = row.cuentaDestino as AccountDestination;
      if (collectionSources.has(row.fuente)) {
        if (key === "CAJA_FISICA") item.cajaFisica += Number(row.importe);
        else if (key === "CUENTA_FISCAL") item.cuentaFiscal += Number(row.importe);
        else if (key === "CUENTA_NO_FISCAL") item.cuentaNoFiscal += Number(row.importe);
      }
      if (row.fuente === "CREDITO") item.cuentasPorCobrar += Number(row.importe);
      map.set(item.ubicacionId, item); return map;
    }, new Map<number, { ubicacionId: number; nombreUbicacion: string; cajaFisica: number; cuentaFiscal: number; cuentaNoFiscal: number; cuentasPorCobrar: number }>()).values()]
      .map((row) => ({
        ...row, cajaFisica: decimal(row.cajaFisica), cuentaFiscal: decimal(row.cuentaFiscal),
        cuentaNoFiscal: decimal(row.cuentaNoFiscal), cuentasPorCobrar: decimal(row.cuentasPorCobrar),
         cobrado: decimal(row.cajaFisica + row.cuentaFiscal + row.cuentaNoFiscal),
         porCobrar: decimal(row.cuentasPorCobrar),
         vendido: decimal(byStore.rows.filter((item) =>
           Number(item.ubicacionId) === row.ubicacionId && saleSources.has(item.fuente))
           .reduce((sum, item) => sum + Number(item.importe), 0)),
         total: decimal(row.cajaFisica + row.cuentaFiscal + row.cuentaNoFiscal),
       }))),
    facturacion: {
      facturadoTotal: decimal(saleRows.filter((r) => r.facturado).reduce((s, r) => s + Number(r.importe), 0)),
      noFacturadoTotal: decimal(saleRows.filter((r) => !r.facturado).reduce((s, r) => s + Number(r.importe), 0)),
      facturadoEfectivo: decimal(saleRows.filter((r) => r.facturado && r.formaPago === "EFECTIVO").reduce((s, r) => s + Number(r.importe), 0)),
      facturadoTransferencia: decimal(saleRows.filter((r) => r.facturado && matrixPaymentCategory(r.formaPago) === "transferencia").reduce((s, r) => s + Number(r.importe), 0)),
      noFacturadoEfectivo: decimal(saleRows.filter((r) => !r.facturado && r.formaPago === "EFECTIVO").reduce((s, r) => s + Number(r.importe), 0)),
      noFacturadoTransferencia: decimal(saleRows.filter((r) => !r.facturado && matrixPaymentCategory(r.formaPago) === "transferencia").reduce((s, r) => s + Number(r.importe), 0)),
    },
  };
}

type DestinationAggregateRow = {
  formaPago: string;
  facturado: boolean;
  cuentaDestino: string;
  importe: string | number;
  [key: string]: unknown;
};

type MatrixCategory = "efectivo" | "transferencia" | "porCobrar" | "otras";

export function matrixPaymentCategory(formaPago: string): MatrixCategory {
  if (formaPago === "EFECTIVO") return "efectivo";
  // FACTURADO is a retired historical payment value. Its destination was
  // always the fiscal bank account, never physical cash.
  if (formaPago === "TRANSFERENCIA" || formaPago === "FACTURADO") return "transferencia";
  if (formaPago === "CREDITO") return "porCobrar";
  return "otras";
}

/** Pure reconciliation boundary used by the report and its integrity tests. */
export function reconcileDestinationMatrix(rows: DestinationAggregateRow[]) {
  const buildRow = (facturado: boolean | null) => {
    const selected = facturado == null ? rows : rows.filter((row) => row.facturado === facturado);
    const cells = Object.fromEntries(([
      "efectivo", "transferencia", "porCobrar", "otras",
    ] as const).map((category) => {
      const members = selected.filter((row) => matrixPaymentCategory(row.formaPago) === category);
      const destinations = [...new Set(members.map((row) => row.cuentaDestino))];
      return [category, {
        importe: decimal(members.reduce((sum, row) => sum + Number(row.importe), 0)),
        cuentaDestino: destinations.length === 1 ? destinations[0] : null,
        formasPago: [...new Set(members.map((row) => row.formaPago))].sort(),
      }];
    })) as Record<MatrixCategory, {
      importe: string;
      cuentaDestino: string | null;
      formasPago: string[];
    }>;
    const total = selected.reduce((sum, row) => sum + Number(row.importe), 0);
    return { facturado, ...cells, total: decimal(total) };
  };
  const filas = [buildRow(true), buildRow(false), buildRow(null)];
  const closes = (row: (typeof filas)[number]) =>
    decimal(Number(row.efectivo.importe) + Number(row.transferencia.importe) +
      Number(row.porCobrar.importe) + Number(row.otras.importe)) === row.total;
  const total = filas[2]!;
  const columnsClose = (["efectivo", "transferencia", "porCobrar", "otras"] as const)
    .every((category) => decimal(
      Number(filas[0]![category].importe) + Number(filas[1]![category].importe),
    ) === total[category].importe);
  return {
    filas,
    cierra: filas.every(closes) && columnsClose &&
      decimal(Number(filas[0]!.total) + Number(filas[1]!.total)) === total.total,
  };
}

export async function listDestinationAccountMovements(
  filters: AnalyticsFilters,
  destination: AccountDestination | "TODAS",
  page = 1,
  pageSize = 50,
  options: {
    facturado?: boolean;
    formaPago?: "EFECTIVO" | "TRANSFERENCIA" | "POR_COBRAR" | "OTRAS";
    incongruente?: boolean;
    fuentes?: Array<"POS" | "CREDITO" | "ABONO" | "ABONO_SALDO_FAVOR">;
  } = {},
) {
  const filterValues = [
    filters.desde?.toISOString() ?? null,
    filters.hasta?.toISOString() ?? null,
    filters.ubicacionId ?? null,
    destination,
  ];
  const readModel = destinationReadModel();
  const joins = `FROM destination_movements d
    LEFT JOIN ubicaciones u ON u.id=d."ubicacionId"
    JOIN usuarios registrador ON registrador.id=d."registroId"
    LEFT JOIN clientes c ON c.id=d."clienteId"`;
  const filtersSql = [
    `($4::text='TODAS' OR d."cuentaDestino"=$4)`,
    `($5::boolean IS NULL OR d.facturado=$5)`,
    options.formaPago === undefined ? "" : options.formaPago === "EFECTIVO"
      ? `d."formaPago"='EFECTIVO'`
      : options.formaPago === "TRANSFERENCIA"
        ? `d."formaPago" IN ('TRANSFERENCIA','FACTURADO')`
        : options.formaPago === "POR_COBRAR"
          ? `d."formaPago"='CREDITO'`
          : `d."formaPago" NOT IN ('EFECTIVO','TRANSFERENCIA','FACTURADO','CREDITO')`,
    options.incongruente === undefined ? "" : options.incongruente
      ? `d.fuente='ABONO' AND ((d.facturado AND d."cuentaDestino"='CUENTA_NO_FISCAL') OR
          (NOT d.facturado AND d."cuentaDestino"='CUENTA_FISCAL'))`
      : `NOT (d.fuente='ABONO' AND ((d.facturado AND d."cuentaDestino"='CUENTA_NO_FISCAL') OR
          (NOT d.facturado AND d."cuentaDestino"='CUENTA_FISCAL')))`,
    `($6::text[] IS NULL OR d.fuente=ANY($6::text[]))`,
  ].filter(Boolean).join(" AND ");
  const rawSources = options.fuentes?.flatMap((source) => {
    if (source === "ABONO") return ["ABONO", "REVERSO_ABONO"];
    if (source === "ABONO_SALDO_FAVOR") {
      return ["ABONO_SALDO_FAVOR", "REVERSO_ABONO_SALDO_FAVOR"];
    }
    return [source];
  });
  const aggregateValues = [
    ...filterValues,
    options.facturado ?? null,
    rawSources?.length ? rawSources : null,
  ];
  const rowValues = [
    ...aggregateValues,
    pageSize,
    (page - 1) * pageSize,
  ];
  const previousFilters = previousEqualPeriod(filters);
  const previousValues = [
    previousFilters.desde!.toISOString(),
    previousFilters.hasta!.toISOString(),
    previousFilters.ubicacionId ?? null,
    destination,
    options.facturado ?? null,
    rawSources?.length ? rawSources : null,
  ];
  const [rows, aggregate, previousAggregate] = await Promise.all([
    pool.query(
       `${readModel} SELECT d.id,d.fecha,
         CASE d."cuentaDestino" WHEN 'CAJA_FISICA' THEN 'Cobro en efectivo'
           WHEN 'CUENTAS_POR_COBRAR' THEN 'Venta a crédito'
           WHEN 'CUENTA_FISCAL' THEN 'Transferencia fiscal' ELSE 'Transferencia no fiscal' END tipo,
         CASE WHEN d.fuente IN ('ABONO','REVERSO_ABONO','ABONO_SALDO_FAVOR','REVERSO_ABONO_SALDO_FAVOR')
           THEN 'MOVIMIENTO_CREDITO' ELSE 'TICKET' END "documentoTipo",
         CASE WHEN d.fuente IN ('ABONO','REVERSO_ABONO','ABONO_SALDO_FAVOR','REVERSO_ABONO_SALDO_FAVOR')
           THEN d."movimientoCreditoId" ELSE d."documentoId" END "documentoId",
         CASE
           WHEN d.fuente IN ('REVERSO_ABONO','REVERSO_ABONO_SALDO_FAVOR')
             THEN ('Reverso de abono #' || d."movimientoCreditoId"::text)
           WHEN d.fuente IN ('ABONO','ABONO_SALDO_FAVOR')
             THEN ('Abono #' || d."movimientoCreditoId"::text)
           ELSE ('Ticket #' || d.folio::text)
         END documento,d."clienteId",c.nombre cliente,
          d."ubicacionId",COALESCE(u.nombre,'Estado de cuenta') sitio,d.importe::text monto,
           d."formaPago",d.facturado,d.fuente,
          (d.fuente='ABONO' AND ((d.facturado AND d."cuentaDestino"='CUENTA_NO_FISCAL') OR
            (NOT d.facturado AND d."cuentaDestino"='CUENTA_FISCAL'))) incongruente,
         registrador.id "registroId",registrador.nombre registro
         ${joins} WHERE ${filtersSql}
         ORDER BY d.fecha DESC,d.id DESC LIMIT $7 OFFSET $8`,
      rowValues,
    ),
    pool.query(
       `${readModel} SELECT COUNT(*)::int total,COALESCE(SUM(d.importe),0)::text "montoTotal"
         ${joins} WHERE ${filtersSql}`,
       aggregateValues,
    ),
    pool.query(
      `${destinationReadModel()}
       SELECT COUNT(*)::int total,COALESCE(SUM(d.importe),0)::text "montoTotal"
       ${joins} WHERE ${filtersSql}`,
      previousValues,
    ),
  ]);
  const currentAmount = Number(aggregate.rows[0]!.montoTotal);
  const previousAmount = Number(previousAggregate.rows[0]!.montoTotal);
  return {
    cuentaDestino: destination,
    items: rows.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      fecha: new Date(row.fecha).toISOString(),
      documentoId: Number(row.documentoId),
       clienteId: row.clienteId == null ? null : Number(row.clienteId),
       ubicacionId: row.ubicacionId == null ? null : Number(row.ubicacionId),
      registroId: Number(row.registroId),
      monto: decimal(row.monto),
    })),
    total: Number(aggregate.rows[0]!.total),
    page,
    pageSize,
    montoTotal: decimal(currentAmount),
    montoTotalAnterior: decimal(previousAmount),
    variacionPorcentaje: percentageChange(currentAmount, previousAmount),
    previousDesde: previousFilters.desde!.toISOString(),
    previousHasta: previousFilters.hasta!.toISOString(),
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
  const condition = where(filters, "t", "ACCOUNTED");
  const effectiveCondition = condition.text.replaceAll("t.created_at", accountedDocumentAt("t"));
  const result = await pool.query(
    `WITH ticket_data AS (
       SELECT t.id,t.ubicacion_id,t.estado,t.facturado,t.total,t.subtotal,t.documento_tipo,t.cobrado,t.autorizacion_estado,t.cobrado_at,t.autorizado_at
       FROM tickets t WHERE ${effectiveCondition}
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
       JOIN productos p ON p.id=l.producto_id WHERE ${accountedDocumentPredicate("t")} GROUP BY l.ticket_id
     )
     SELECT u.id "ubicacionId",u.nombre "nombreUbicacion",
       COALESCE(SUM(t.total) FILTER (WHERE ${accountedDocumentPredicate("t")}),0)::text ventas,
       COALESCE(SUM(t.subtotal) FILTER (WHERE ${accountedDocumentPredicate("t")}),0)::text subtotal,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.costo),0)::text END costo,
        CASE WHEN COALESCE(SUM(l.excluidas),0)>0 THEN NULL ELSE COALESCE(SUM(l.margen_base-l.costo),0)::text END margen,
       COUNT(*) FILTER (WHERE ${accountedDocumentPredicate("t")})::int tickets,
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
       COALESCE(credit.credito,0)::text credito,
       COALESCE(invoice.facturado,0)::text facturado,
       COALESCE(cash.diferencia,0)::text "diferenciaCaja"
     FROM ubicaciones u LEFT JOIN ticket_data t ON t.ubicacion_id=u.id
     LEFT JOIN line_data l ON l.ticket_id=t.id
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='EFECTIVO'),0) efectivo,
          COALESCE(SUM(p.importe) FILTER (WHERE p.forma_pago='TRANSFERENCIA'),0) transferencia
       FROM ticket_data ft JOIN ticket_pagos p ON p.ticket_id=ft.id
        WHERE ft.ubicacion_id=u.id AND ${accountedDocumentPredicate("ft")}
     ) pay ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(m.importe),0) credito
        FROM ticket_data ft JOIN movimientos_credito m ON m.ticket_id=ft.id
        WHERE ft.ubicacion_id=u.id AND ft.documento_tipo='NOTA'
          AND ft.autorizacion_estado='AUTORIZADA' AND m.tipo='VENTA_CREDITO'
      ) credit ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(ft.total),0) facturado FROM ticket_data ft
        WHERE ft.ubicacion_id=u.id AND ${accountedDocumentPredicate("ft")} AND ft.facturado
      ) invoice ON true
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
      GROUP BY u.id,u.nombre,pay.efectivo,pay.transferencia,credit.credito,invoice.facturado,cash.diferencia
     ORDER BY ventas DESC,u.nombre`,
    condition.values,
  );
  const previous = previousEqualPeriod(filters);
  const priorWhere = where(previous, "t", "ACCOUNTED");
  const effectivePriorWhere = priorWhere.text.replaceAll("t.created_at", accountedDocumentAt("t"));
  const [priorRows, dailyRows] = await Promise.all([
    pool.query(
      `SELECT t.ubicacion_id "ubicacionId",COALESCE(SUM(t.total),0)::text ventas
       FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
       WHERE ${effectivePriorWhere} AND ${accountedDocumentPredicate("t")}
         AND u.tipo='TIENDA' AND u.activa
       GROUP BY t.ubicacion_id`,
      priorWhere.values,
    ),
    pool.query(
      `SELECT (${accountedDocumentAt("t")} AT TIME ZONE '${ANALYTICS_TIME_ZONE}')::date::text fecha,
        t.ubicacion_id "ubicacionId",u.nombre "nombreUbicacion",SUM(t.total)::text ventas
       FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
        WHERE ${effectiveCondition} AND ${accountedDocumentPredicate("t")}
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
  const tiendas = orderStores(result.rows.map((row) => {
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
  }));
  const sum = (key: string) => result.rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const facturado = sum("facturado");
  return {
    tiendas,
    promedioGeneralTicket: decimal(globalAverage),
    ventasPorFecha: orderStores(dailyRows.rows.map((row) => ({
      fecha: row.fecha, ubicacionId: Number(row.ubicacionId),
      nombreUbicacion: row.nombreUbicacion, ventas: decimal(row.ventas),
    }))),
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