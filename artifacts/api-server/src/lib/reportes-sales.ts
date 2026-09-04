import { pool } from "@workspace/db";
import { accountedDocumentAt, accountedDocumentPredicate } from "./accounted-document";

export interface DomainReportContext {
  input: Record<string, unknown>;
  locations?: number[];
  range: { desde: Date; hasta: Date; previousDesde: Date; previousHasta: Date; yearAgoDesde: Date; yearAgoHasta: Date };
}

type Primitive = string | number | boolean | null;
type Row = Record<string, Primitive>;
const zone = "America/Mexico_City";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const parseFilterValues = (value: unknown): string[] => typeof value === "string" ? value.split(",").map((v) => v.trim()).filter(Boolean) : Array.isArray(value) ? value.map(String).map((v) => v.trim()).filter(Boolean) : [];
const values = parseFilterValues;
const ids = (value: unknown) => values(value).map(Number).filter(Number.isInteger);
export type ReportModality = "TODO" | "ROLLOS" | "METRAJE";
export function reportModality(value: unknown): ReportModality {
  return value === "ROLLOS" || value === "METRAJE" ? value : "TODO";
}
const modalityLabel = (type: unknown) => type === "METREADO" ? "METRAJE" : "ROLLOS";
export type FrozenCostProvenance =
  | "AVERAGE_12_MONTHS"
  | "STALE_LAST_KNOWN"
  | "NO_COST"
  | null;
export function costSourceLabel(
  modality: "ROLLOS" | "METRAJE",
  provenance: FrozenCostProvenance,
): string {
  if (modality === "ROLLOS") return "Costo exacto del rollo vendido";
  if (provenance === "AVERAGE_12_MONTHS") return "Promedio simple por rollo recibido (12 meses)";
  if (provenance === "STALE_LAST_KNOWN") return "Último costo conocido (sin recepciones en 12 meses)";
  if (provenance === "NO_COST") return "Sin costo conocido";
  return "Proveniencia histórica desconocida";
}
export function groupedCostSourceLabel(
  modality: "ROLLOS" | "METRAJE",
  staleLines: number,
  unknownLines: number,
  noCostLines: number,
): string {
  if (modality === "ROLLOS") return costSourceLabel(modality, null);
  if (noCostLines > 0) return "Sin costo conocido en al menos una línea";
  if (staleLines > 0) return costSourceLabel(modality, "STALE_LAST_KNOWN");
  if (unknownLines > 0) return costSourceLabel(modality, null);
  return costSourceLabel(modality, "AVERAGE_12_MONTHS");
}
type ColumnInput = [string, string, string, boolean?, boolean?] | Record<string, unknown>;
const cols = (items: ColumnInput[]) => items.map((item) => {
  if (!Array.isArray(item)) return item;
  const [key, label, kind, economic, estimated] = item;
  return { key, label, kind, ...(economic ? { economic: true } : {}), ...(estimated ? { estimated: true } : {}) };
});
const table = (id: string, title: string, columns: ColumnInput[], rows: Row[], sumKeys: string[] = []) => {
  const resolvedColumns = cols(columns) as Array<Record<string, unknown>>;
  const units = new Set(rows.map((row) => row.unidad).filter((unit) => unit != null));
  const totals = Object.fromEntries(resolvedColumns.flatMap((column) => {
    const kind = String(column.kind);
    const key = String(column.key);
    if (
      !sumKeys.includes(key) ||
      (kind === "quantity" && units.size !== 1) ||
      rows.some((row) => row[key] == null)
    ) return [];
    return [[key, rows.reduce((sum, row) => sum + number(row[key]), 0)]];
  }));
  return { id, title, columns: resolvedColumns, rows, totals };
};
const chart = (id: string, title: string, type: string, categoryKey: string, series: any[], rows: Row[]) => ({ id, title, type, categoryKey, series, rows });

/** Percentage change with an explicit, stable zero-denominator convention. */
export function safePercent(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** ABC class based on the cumulative percentage after this item is included. */
export function abcClass(cumulativePercent: number): "A" | "B" | "C" {
  if (cumulativePercent <= 80) return "A";
  if (cumulativePercent <= 95) return "B";
  return "C";
}

export function exactFrozenMargin(lines: Array<{ importe: number; costoTotalCongelado: number | null }>) {
  const subtotal = lines.reduce((sum, line) => sum + line.importe, 0);
  if (lines.some((line) => line.costoTotalCongelado == null)) {
    return { costo: null, utilidad: null, denominador: subtotal };
  }
  const costo = lines.reduce((sum, line) => sum + line.costoTotalCongelado!, 0);
  return { costo, utilidad: subtotal - costo, denominador: subtotal };
}

/** Ticket subtotal is net of IVA; this makes the report's tax convention explicit. */
export function subtotalBeforeTax(total: number, iva: number): number { return total - iva; }
export function priceRange(minimum: number, maximum: number): number { return Math.max(0, maximum - minimum); }
export function trendDirection(current: number, previous: number): "rising" | "falling" | "flat" {
  return current > previous ? "rising" : current < previous ? "falling" : "flat";
}

function where(ctx: DomainReportContext, range = ctx.range, alias = "t") {
  const args: unknown[] = [range.desde.toISOString(), range.hasta.toISOString()];
  const parts = [`${accountedDocumentAt(alias)} >= $1`, `${accountedDocumentAt(alias)} <= $2`];
  const add = (column: string, data: unknown[], cast = "int[]") => {
    if (data.length) { args.push(data); parts.push(`${column}=ANY($${args.length}::${cast})`); }
  };
  add(`${alias}.ubicacion_id`, ctx.locations?.length ? ctx.locations : ids(ctx.input.ubicacionIds));
  add("l.producto_id", ids(ctx.input.productoIds));
  add(`${alias}.usuario_terminal_id`, ids(ctx.input.usuarioIds));
  add(`${alias}.cliente_id`, ids(ctx.input.clienteIds));
  add("r.proveedor_id", ids(ctx.input.proveedorIds));
  add("p.tela", values(ctx.input.telas), "text[]");
  add("p.color", values(ctx.input.colores), "text[]");
  add("p.unidad::text", values(ctx.input.unidades), "text[]");
  const modality = reportModality(ctx.input.modalidad);
  if (modality !== "TODO") {
    args.push(modality === "METRAJE" ? "METREADO" : "NORMAL");
    parts.push(`l.tipo::text=$${args.length}`);
  }
  if (typeof ctx.input.facturado === "boolean") { args.push(ctx.input.facturado); parts.push(`${alias}.facturado=$${args.length}`); }
  const payments = values(ctx.input.formasPago);
  if (payments.length) { args.push(payments); parts.push(`EXISTS (SELECT 1 FROM ticket_pagos fp WHERE fp.ticket_id=${alias}.id AND fp.forma_pago::text=ANY($${args.length}::text[]))`); }
  return { text: parts.join(" AND "), values: args };
}

const joins = "FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id JOIN ubicaciones u ON u.id=t.ubicacion_id LEFT JOIN usuarios vendedor ON vendedor.id=t.usuario_terminal_id LEFT JOIN clientes cliente ON cliente.id=t.cliente_id LEFT JOIN rollos r ON r.id=l.rollo_id";
const pendingCost = "l.costo_total_congelado IS NULL";

export async function buildSalesReport(section: "ventas" | "utilidad", ctx: DomainReportContext): Promise<{ kpis: any[]; charts: any[]; tables: any[]; warnings: string[] }> {
  const normal = where(ctx);
  const salesWhere = `${normal.text} AND ${accountedDocumentPredicate("t")}`;
  const compare = async (range: { desde: Date; hasta: Date }) => {
    const condition = where(ctx, { ...ctx.range, ...range });
    const result = await pool.query(`SELECT COALESCE(SUM(l.importe),0)::float ventas, COUNT(DISTINCT t.id)::int tickets,
      CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.costo_total_congelado),0)::float END costo,
      CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::float END utilidad,
      COALESCE(SUM(l.importe),0)::float denominador
      ${joins} WHERE ${condition.text} AND ${accountedDocumentPredicate("t")}`, condition.values);
    return result.rows[0]!;
  };
  const compareModalities = async (range: { desde: Date; hasta: Date }) => {
    const condition = where(ctx, { ...ctx.range, ...range });
    const result = await pool.query(`SELECT l.tipo,COALESCE(SUM(l.importe),0)::float ventas,COUNT(DISTINCT t.id)::int tickets,
      CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.costo_total_congelado),0)::float END costo,
      CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::float END utilidad,
      COALESCE(SUM(l.importe),0)::float denominador,
      COUNT(*) FILTER (WHERE l.tipo='METREADO' AND l.costo_referencia_estado='STALE_LAST_KNOWN')::int lineas_costo_vencido,
      COUNT(*) FILTER (WHERE l.tipo='METREADO' AND l.costo_referencia_estado IS NULL)::int lineas_proveniencia_desconocida,
      COUNT(*) FILTER (WHERE l.tipo='METREADO' AND l.costo_referencia_estado='NO_COST')::int lineas_sin_costo
      ${joins} WHERE ${condition.text} AND ${accountedDocumentPredicate("t")} GROUP BY l.tipo`, condition.values);
    return new Map(result.rows.map((row) => [modalityLabel(row.tipo), row]));
  };
  const [current, previous, yearAgo, currentModalities, previousModalities, yearAgoModalities] = await Promise.all([
    compare(ctx.range), compare({ desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }),
    compare({ desde: ctx.range.yearAgoDesde, hasta: ctx.range.yearAgoHasta }),
    compareModalities(ctx.range), compareModalities({ desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }),
    compareModalities({ desde: ctx.range.yearAgoDesde, hasta: ctx.range.yearAgoHasta }),
  ]);
  const sales = number(current.ventas), tickets = number(current.tickets);
  const kpi = (id: string, label: string, value: number | null, kind: string, old: unknown, ago: unknown, economic = false) =>
    ({ id, label, value, kind, ...(economic ? { economic: true } : {}),
      comparisonPrevious: value == null || old == null ? null : safePercent(value, number(old)),
      comparisonYearAgo: value == null || ago == null ? null : safePercent(value, number(ago)) });
  const visibleModalities = reportModality(ctx.input.modalidad) === "TODO"
    ? ["ROLLOS", "METRAJE"] as const
    : [reportModality(ctx.input.modalidad)] as Array<"ROLLOS" | "METRAJE">;
  const modalityKpis = visibleModalities.flatMap((modality) => {
    const row = currentModalities.get(modality);
    const old = previousModalities.get(modality);
    const ago = yearAgoModalities.get(modality);
    const modalitySales = number(row?.ventas);
    const modalityTickets = number(row?.tickets);
    return [
      kpi(`ventas-${modality.toLowerCase()}`, `Ventas · ${modality}`, modalitySales, "money", old?.ventas, ago?.ventas, true),
      kpi(`tickets-${modality.toLowerCase()}`, `Tickets con ${modality}`, modalityTickets, "count", old?.tickets, ago?.tickets),
      kpi(`ticket-promedio-${modality.toLowerCase()}`, `Subtotal promedio · ${modality}`, modalityTickets ? modalitySales / modalityTickets : 0, "money",
        number(old?.tickets) ? number(old?.ventas) / number(old?.tickets) : 0,
        number(ago?.tickets) ? number(ago?.ventas) / number(ago?.tickets) : 0, true),
    ];
  });
  const warnings: string[] = [];

  const dimensions = async (id: string, title: string, expression: string, group = expression, extra = "") => {
    const result = await pool.query(`SELECT ${expression} dimension,l.tipo,p.unidad,COALESCE(SUM(l.cantidad),0)::float cantidad,
      COALESCE(SUM(l.importe),0)::float ventas,
      CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.costo_total_congelado),0)::float END costo,
      CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::float END utilidad,
      COALESCE(SUM(l.importe),0)::float denominador,
       COUNT(DISTINCT t.id)::int tickets,
       COUNT(*) FILTER (WHERE l.tipo='METREADO' AND l.costo_referencia_estado='STALE_LAST_KNOWN')::int lineas_costo_vencido,
       COUNT(*) FILTER (WHERE l.tipo='METREADO' AND l.costo_referencia_estado IS NULL)::int lineas_proveniencia_desconocida,
       COUNT(*) FILTER (WHERE l.tipo='METREADO' AND l.costo_referencia_estado='NO_COST')::int lineas_sin_costo
       ${joins} WHERE ${salesWhere} ${extra}
      GROUP BY ${group},l.tipo,p.unidad ORDER BY ventas DESC LIMIT 250`, normal.values);
    return table(id, title, [["dimension", title, "text"], ["modalidad", "Modalidad", "text"], ["costoFuente", "Fuente del costo", "text", true], ["lineasCostoVencido", "Líneas con último costo conocido", "count", true], ["lineasProvenienciaDesconocida", "Líneas con fuente histórica desconocida", "count", true], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"], ["tickets", "Tickets", "count"], ["ventas", "Subtotal sin IVA", "money", true], ["costo", "Costo congelado", "money", true], ["utilidad", "Utilidad", "money", true], ["margenPct", "Margen exacto", "percentage", true]],
      result.rows.map((r) => {
        const utilidad = r.utilidad == null ? null : number(r.utilidad);
        const modalidad = modalityLabel(r.tipo);
        const stale = number(r.lineas_costo_vencido);
        const unknown = number(r.lineas_proveniencia_desconocida);
        return { dimension: r.dimension == null ? "Sin dato" : String(r.dimension), modalidad, costoFuente: groupedCostSourceLabel(modalidad, stale, unknown, number(r.lineas_sin_costo)), lineasCostoVencido: stale, lineasProvenienciaDesconocida: unknown, unidad: String(r.unidad), cantidad: number(r.cantidad), tickets: number(r.tickets), ventas: number(r.ventas), costo: r.costo == null ? null : number(r.costo), utilidad, margenPct: utilidad == null ? null : (number(r.denominador) ? utilidad / number(r.denominador) * 100 : 0) };
      }),
      ["cantidad", "ventas", "costo", "utilidad"]);
  };

  if (section === "ventas") {
    const [daily, weekday, hour, site, product, fabric, color, seller, client, invoice] = await Promise.all([
       dimensions("ventas-diarias", "Día", `(${accountedDocumentAt("t")} AT TIME ZONE '${zone}')::date::text`),
       dimensions("por-dia-semana", "Día de semana", `trim(to_char(${accountedDocumentAt("t")} AT TIME ZONE '${zone}','Day'))`, `EXTRACT(ISODOW FROM ${accountedDocumentAt("t")} AT TIME ZONE '${zone}'),trim(to_char(${accountedDocumentAt("t")} AT TIME ZONE '${zone}','Day'))`),
       dimensions("por-hora", "Hora", `to_char(${accountedDocumentAt("t")} AT TIME ZONE '${zone}','HH24')`),
      dimensions("por-sitio", "Sitio", "u.nombre"), dimensions("por-producto", "Producto", "p.sku", "p.id,p.sku"),
      dimensions("por-tela", "Tela", "p.tela"), dimensions("por-color", "Color", "p.color"),
      dimensions("por-vendedor", "Vendedor", "vendedor.nombre"), dimensions("por-cliente", "Cliente", "cliente.nombre"),
      dimensions("por-factura", "Estado de factura", "CASE WHEN t.facturado THEN 'Facturado' ELSE 'No facturado' END", "t.facturado"),
    ]);
    // Payment needs an actual joined payment method rather than an EXISTS-only label.
    const pay = await pool.query(`WITH filtered_components AS (
        SELECT t.id,l.tipo,t.subtotal::numeric ticket_subtotal,SUM(l.importe)::numeric component_subtotal
        ${joins} WHERE ${salesWhere} GROUP BY t.id,l.tipo,t.subtotal
      ) SELECT fp.forma_pago::text dimension,fc.tipo,COUNT(DISTINCT fc.id)::int tickets,
        COALESCE(SUM(fp.importe*fc.component_subtotal/NULLIF(fc.ticket_subtotal,0)),0)::float ventas
      FROM filtered_components fc JOIN ticket_pagos fp ON fp.ticket_id=fc.id
      GROUP BY fp.forma_pago,fc.tipo ORDER BY ventas DESC`, normal.values);
    const paymentTable = table("por-pago", "Forma de pago", [["dimension", "Forma de pago", "text"], ["modalidad", "Modalidad", "text"], ["tickets", "Tickets", "count"], ["ventas", "Cobro asignado por subtotal", "money", true]],
      pay.rows.map((r) => ({ dimension: String(r.dimension), modalidad: modalityLabel(r.tipo), tickets: number(r.tickets), ventas: number(r.ventas) })), ["ventas"]);
    const ranked = product.rows as Row[];
    const total = ranked.reduce((sum, row) => sum + number(row.ventas), 0);
    let accumulated = 0;
    const abcRows = ranked.map((row) => { accumulated += number(row.ventas); const cumulativePercent = total === 0 ? 0 : accumulated / total * 100; return { producto: String(row.dimension), modalidad: row.modalidad, unidad: row.unidad, ventas: number(row.ventas), porcentajeAcumulado: cumulativePercent, clase: abcClass(cumulativePercent) }; });
    const pairs = await pool.query(`WITH filtered_lines AS (
        SELECT l.ticket_id,l.producto_id,l.tipo ${joins} WHERE ${salesWhere}
      ) SELECT p1.sku producto_a,p2.sku producto_b,fl1.tipo tipo_a,fl2.tipo tipo_b,COUNT(DISTINCT fl1.ticket_id)::int tickets
      FROM filtered_lines fl1 JOIN filtered_lines fl2 ON fl2.ticket_id=fl1.ticket_id AND fl1.producto_id<fl2.producto_id
      JOIN productos p1 ON p1.id=fl1.producto_id JOIN productos p2 ON p2.id=fl2.producto_id
      GROUP BY p1.sku,p2.sku,fl1.tipo,fl2.tipo ORDER BY tickets DESC LIMIT 100`, normal.values);
    const cancelled = await pool.query(`SELECT t.id ticket_id,t.folio,t.motivo_cancelacion motivo,u.nombre sitio,l.tipo,COALESCE(SUM(l.importe),0)::float importe,COUNT(l.id)::int lineas
      ${joins} WHERE ${normal.text} AND t.estado='CANCELADO' GROUP BY t.id,u.nombre,l.tipo ORDER BY t.created_at DESC`, normal.values);
    const cancelledProducts = await pool.query(`SELECT p.sku,p.tela,p.color,l.tipo,p.unidad,COUNT(*)::int lineas,COALESCE(SUM(l.cantidad),0)::float cantidad,COALESCE(SUM(l.importe),0)::float importe
      ${joins} WHERE ${normal.text} AND t.estado='CANCELADO' GROUP BY p.id,l.tipo,p.unidad ORDER BY importe DESC`, normal.values);
    const quantities = await pool.query(`SELECT l.tipo,p.unidad,COALESCE(SUM(l.cantidad),0)::float cantidad
      ${joins} WHERE ${salesWhere} GROUP BY l.tipo,p.unidad ORDER BY l.tipo,p.unidad`, normal.values);
    const cancellationSummary = [...new Map(cancelled.rows.map((row) => [modalityLabel(row.tipo), modalityLabel(row.tipo)])).values()].map((modalidad) => {
      const rows = cancelled.rows.filter((row) => modalityLabel(row.tipo) === modalidad);
      return { modalidad, tickets: new Set(rows.map((row) => String(row.ticket_id))).size, importe: rows.reduce((sum, row) => sum + number(row.importe), 0) };
    });
    return {
      kpis: [kpi("ventas", "Ventas totales", sales, "money", previous.ventas, yearAgo.ventas, true), kpi("tickets", "Tickets totales", tickets, "count", previous.tickets, yearAgo.tickets), ...modalityKpis, ...quantities.rows.map((r) => ({ id: `cantidad-${String(r.tipo).toLowerCase()}-${String(r.unidad).toLowerCase()}`, label: `${modalityLabel(r.tipo)} · ${r.unidad}`, value: number(r.cantidad), kind: "quantity", unit: String(r.unidad) }))],
      charts: [chart("timeline", "Ventas diarias", "line", "dimension", [{ key: "ventas", label: "Ventas", kind: "money", economic: true }], daily.rows), chart("horas", "Ventas por hora", "bar", "dimension", [{ key: "ventas", label: "Ventas", kind: "money", economic: true }], hour.rows), chart("semana", "Ventas por día", "bar", "dimension", [{ key: "ventas", label: "Ventas", kind: "money", economic: true }], weekday.rows)],
      tables: [daily, weekday, hour, site, product, fabric, color, seller, client, paymentTable, invoice, table("mejores-productos", "Mejores productos", product.columns as any, ranked.slice(0, 20)), table("peores-productos", "Peores productos", product.columns as any, [...ranked].reverse().slice(0, 20)), table("abc-productos", "Clasificación ABC", [["producto", "Producto", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["ventas", "Ventas", "money", true], ["porcentajeAcumulado", "% acumulado", "percentage"], ["clase", "Clase", "text"]], abcRows), table("canasta-pares", "Pares de productos en canasta", [["productoA", "Producto A", "text"], ["modalidadA", "Modalidad A", "text"], ["productoB", "Producto B", "text"], ["modalidadB", "Modalidad B", "text"], ["tickets", "Tickets", "count"]], pairs.rows.map((r) => ({ productoA: String(r.producto_a), modalidadA: modalityLabel(r.tipo_a), productoB: String(r.producto_b), modalidadB: modalityLabel(r.tipo_b), tickets: number(r.tickets) }))), table("resumen-cancelaciones", "Resumen de cancelaciones", [["modalidad", "Modalidad", "text"], ["tickets", "Tickets cancelados", "count"], ["importe", "Subtotal cancelado", "money", true]], cancellationSummary), table("cancelaciones", "Cancelaciones", [["folio", "Folio", "text"], ["modalidad", "Modalidad", "text"], ["motivo", "Motivo", "text"], ["sitio", "Sitio", "text"], ["lineas", "Líneas", "count"], ["importe", "Subtotal cancelado", "money", true]], cancelled.rows.map((r) => ({ folio: String(r.folio), modalidad: modalityLabel(r.tipo), motivo: r.motivo == null ? null : String(r.motivo), sitio: String(r.sitio), lineas: number(r.lineas), importe: number(r.importe) }))), table("productos-cancelados", "Productos cancelados", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["lineas", "Líneas", "count"], ["cantidad", "Cantidad", "quantity"], ["importe", "Importe", "money", true]], cancelledProducts.rows.map((r) => ({ sku: String(r.sku), tela: String(r.tela), color: String(r.color), modalidad: modalityLabel(r.tipo), unidad: String(r.unidad), lineas: number(r.lineas), cantidad: number(r.cantidad), importe: number(r.importe) })))],
      warnings,
    };
  }

  const [fabric, product, color, site, seller, evolution, quality, prices, crossSite] = await Promise.all([
    dimensions("utilidad-tela", "Tela", "p.tela"), dimensions("utilidad-producto", "Producto", "p.sku", "p.id,p.sku"), dimensions("utilidad-color", "Color", "p.color"), dimensions("utilidad-sitio", "Sitio", "u.nombre"), dimensions("utilidad-vendedor", "Vendedor", "vendedor.nombre"),
     dimensions("evolucion-margen", "Día", `(${accountedDocumentAt("t")} AT TIME ZONE '${zone}')::date::text`),
    pool.query(`SELECT l.tipo,CASE WHEN l.costo_total_congelado IS NULL THEN 'Costo pendiente' WHEN l.tipo='METREADO' AND l.costo_referencia_estado='STALE_LAST_KNOWN' THEN 'Último costo conocido (vencido)' WHEN l.tipo='METREADO' AND l.costo_referencia_estado IS NULL THEN 'Proveniencia histórica desconocida' WHEN l.costo_unitario_congelado<=0 OR l.costo_total_congelado<=0 THEN 'Costo nulo/cero' ELSE 'Válida' END calidad,COUNT(*)::int lineas FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} GROUP BY l.tipo,calidad`, normal.values),
    pool.query(`SELECT p.sku,p.tela,l.tipo,p.unidad,cliente.nombre cliente,vendedor.nombre vendedor,COUNT(*)::int lineas,MIN(l.precio_unitario)::float minimo,MAX(l.precio_unitario)::float maximo,AVG(l.precio_unitario)::float promedio,CASE WHEN SUM(l.cantidad)=0 THEN 0 ELSE SUM(l.precio_unitario*l.cantidad)/SUM(l.cantidad) END::float promedio_ponderado FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN clientes cliente ON cliente.id=t.cliente_id LEFT JOIN usuarios vendedor ON vendedor.id=t.usuario_terminal_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} GROUP BY p.id,l.tipo,p.unidad,cliente.nombre,vendedor.nombre ORDER BY promedio_ponderado DESC`, normal.values),
    pool.query(`WITH by_site AS (
      SELECT p.sku,l.tipo,p.unidad,u.nombre sitio,AVG(l.precio_unitario)::float precio FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id JOIN ubicaciones u ON u.id=t.ubicacion_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} GROUP BY p.sku,l.tipo,p.unidad,u.nombre
    ) SELECT sku,tipo,unidad,sitio,precio,(MAX(precio) OVER (PARTITION BY sku,tipo,unidad)-MIN(precio) OVER (PARTITION BY sku,tipo,unidad))::float diferencia_sitios FROM by_site ORDER BY sku,tipo,unidad,sitio`, normal.values),
  ]);
  const prevProduct = await pool.query(`SELECT p.sku,l.tipo,p.unidad,
    CASE WHEN COUNT(*) FILTER (WHERE ${pendingCost})>0 THEN NULL ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::float END utilidad,
    COALESCE(SUM(l.cantidad),0)::float cantidad ${joins}
    WHERE ${where(ctx, { ...ctx.range, desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }).text}
       AND ${accountedDocumentPredicate("t")} GROUP BY p.sku,l.tipo,p.unidad`,
  where(ctx, { ...ctx.range, desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }).values);
  const productKey = (sku: unknown, tipo: unknown, unidad: unknown) => `${String(sku)}:${String(tipo)}:${String(unidad)}`;
  const prior = new Map(prevProduct.rows.map((r) => [productKey(r.sku, r.tipo, r.unidad), r]));
  const divergent = (product.rows as Row[]).map((r) => {
    const priorRow = prior.get(productKey(r.dimension, r.modalidad === "METRAJE" ? "METREADO" : "NORMAL", r.unidad));
    const cantidad = number(r.cantidad);
    const utilidad = r.utilidad == null ? null : number(r.utilidad);
    return { producto: String(r.dimension), modalidad: r.modalidad, unidad: r.unidad, cantidad, utilidad, divergencia: utilidad == null || priorRow?.utilidad == null ? null : Math.abs(safePercent(cantidad, number(priorRow.cantidad)) - safePercent(utilidad, number(priorRow.utilidad))) };
  }).sort((a, b) => number(b.divergencia) - number(a.divergencia));
  const changes = (product.rows as Row[]).map((r) => {
    const priorRow = prior.get(productKey(r.dimension, r.modalidad === "METRAJE" ? "METREADO" : "NORMAL", r.unidad));
    const utilidadActual = r.utilidad == null ? null : number(r.utilidad);
    const utilidadAnterior = priorRow?.utilidad == null ? null : number(priorRow.utilidad);
    return { producto: String(r.dimension), modalidad: r.modalidad, unidad: r.unidad, utilidadActual, utilidadAnterior, variacion: utilidadActual == null || utilidadAnterior == null ? null : utilidadActual - utilidadAnterior, tendencia: utilidadActual == null || utilidadAnterior == null ? "pendiente" : trendDirection(utilidadActual, utilidadAnterior) };
  }).sort((a, b) => number(b.variacion) - number(a.variacion));
  const threshold = number(ctx.input.margenUmbral ?? 15);
  const discounts = await pool.query(`SELECT p.sku,p.tela,l.tipo,p.unidad,l.precio_unitario::float precio,p.precio_sugerido::float sugerido,((p.precio_sugerido-l.precio_unitario)/NULLIF(p.precio_sugerido,0)*100)::float descuento,((l.importe-l.costo_total_congelado)/NULLIF(l.importe,0)*100)::float margen FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} AND p.precio_sugerido>0 AND ((p.precio_sugerido-l.precio_unitario)/p.precio_sugerido*100>30 OR (l.costo_total_congelado IS NOT NULL AND (l.importe-l.costo_total_congelado)/NULLIF(l.importe,0)*100<$${normal.values.length + 1})) ORDER BY descuento DESC`, [...normal.values, threshold]);
  warnings.push("Los descuentos se calculan contra precio_sugerido ACTUAL de productos; no es un snapshot histórico.");
  warnings.push("Costo, utilidad y margen quedan pendientes cuando cualquier línea del grupo no tiene costo congelado; el margen se calcula contra el subtotal sin IVA.");
  warnings.push("ROLLOS usa el costo exacto congelado del rollo vendido. METRAJE usa el promedio simple por rollo recibido en 12 meses, congelado al emitir el ticket.");
  warnings.push("Las líneas de METRAJE marcadas con último costo conocido no tuvieron recepciones en los 12 meses previos; su margen es menos confiable. Las líneas históricas sin proveniencia permanecen como desconocidas y no se infieren.");
  const utilityByModality = visibleModalities.map((modalidad) => {
    const row = currentModalities.get(modalidad);
    const ventas = number(row?.ventas);
    const costo = row?.costo == null && row ? null : number(row?.costo);
    const utilidad = row?.utilidad == null && row ? null : number(row?.utilidad);
    return {
      modalidad,
      costoFuente: groupedCostSourceLabel(modalidad, number(row?.lineas_costo_vencido), number(row?.lineas_proveniencia_desconocida), number(row?.lineas_sin_costo)),
      lineasCostoVencido: number(row?.lineas_costo_vencido),
      lineasProvenienciaDesconocida: number(row?.lineas_proveniencia_desconocida),
      ventas,
      costo,
      utilidad,
      margenPct: utilidad == null ? null : (ventas ? utilidad / ventas * 100 : 0),
    };
  });
  const utilityModalityKpis = visibleModalities.flatMap((modalidad) => {
    const row = currentModalities.get(modalidad);
    const old = previousModalities.get(modalidad);
    const ago = yearAgoModalities.get(modalidad);
    const utilidad = row?.utilidad == null && row ? null : number(row?.utilidad);
    const costo = row?.costo == null && row ? null : number(row?.costo);
    const margen = utilidad == null ? null : (number(row?.denominador) ? utilidad / number(row?.denominador) * 100 : 0);
    const oldMargin = old?.utilidad == null ? null : (number(old.denominador) ? number(old.utilidad) / number(old.denominador) * 100 : 0);
    const agoMargin = ago?.utilidad == null ? null : (number(ago.denominador) ? number(ago.utilidad) / number(ago.denominador) * 100 : 0);
    return [
      kpi(`costo-${modalidad.toLowerCase()}`, `Costo · ${modalidad} · ${modalidad === "ROLLOS" ? "rollo exacto" : "promedio simple 12 meses"}`, costo, "money", old?.costo, ago?.costo, true),
      kpi(`utilidad-${modalidad.toLowerCase()}`, `Utilidad · ${modalidad}`, utilidad, "money", old?.utilidad, ago?.utilidad, true),
      kpi(`margen-${modalidad.toLowerCase()}`, `Margen · ${modalidad}`, margen, "percentage", oldMargin, agoMargin, true),
      ...(modalidad === "METRAJE" ? [
        kpi("lineas-costo-vencido-metraje", "METRAJE · líneas con último costo conocido", number(row?.lineas_costo_vencido), "count", old?.lineas_costo_vencido, ago?.lineas_costo_vencido, true),
        kpi("lineas-fuente-desconocida-metraje", "METRAJE · fuente histórica desconocida", number(row?.lineas_proveniencia_desconocida), "count", old?.lineas_proveniencia_desconocida, ago?.lineas_proveniencia_desconocida, true),
      ] : []),
    ];
  });
  return {
    kpis: [...utilityModalityKpis, ...(current.costo == null || current.utilidad == null
      ? [
          { id: "costo-congelado", label: "Costo total congelado", value: null, kind: "money", economic: true },
          { id: "utilidad-exacta", label: "Utilidad total exacta", value: null, kind: "money", economic: true },
          { id: "margen-exacto", label: "Margen total exacto", value: null, kind: "percentage", economic: true },
        ]
      : [kpi("costo-congelado", "Costo total congelado", number(current.costo), "money", previous.costo, yearAgo.costo, true), kpi("utilidad-exacta", "Utilidad total exacta", number(current.utilidad), "money", previous.utilidad, yearAgo.utilidad, true), kpi("margen-exacto", "Margen total exacto", number(current.denominador) ? number(current.utilidad) / number(current.denominador) * 100 : 0, "percentage", previous.utilidad == null ? null : (number(previous.denominador) ? number(previous.utilidad) / number(previous.denominador) * 100 : 0), yearAgo.utilidad == null ? null : (number(yearAgo.denominador) ? number(yearAgo.utilidad) / number(yearAgo.denominador) * 100 : 0), true)])],
    charts: [chart("margen-evolucion", "Evolución de utilidad", "line", "dimension", [{ key: "utilidad", label: "Utilidad", kind: "money", economic: true }], evolution.rows)],
    tables: [
      table("utilidad-por-modalidad", "Utilidad por modalidad", [["modalidad", "Modalidad", "text"], ["costoFuente", "Fuente del costo", "text", true], ["lineasCostoVencido", "Líneas con último costo conocido", "count", true], ["lineasProvenienciaDesconocida", "Líneas con fuente histórica desconocida", "count", true], ["ventas", "Subtotal sin IVA", "money", true], ["costo", "Costo congelado", "money", true], ["utilidad", "Utilidad", "money", true], ["margenPct", "Margen exacto", "percentage", true]], utilityByModality, ["ventas", "costo", "utilidad"]),
      fabric, product, color, site, seller,
      table("divergencia-cantidad-utilidad", "Divergencia cantidad vs utilidad", [["producto", "Producto", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"], ["utilidad", "Utilidad", "money", true], ["divergencia", "Divergencia", "percentage", true]], divergent),
      table("productos-alza", "Productos en alza", [["producto", "Producto", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["utilidadActual", "Utilidad actual", "money", true], ["utilidadAnterior", "Utilidad anterior", "money", true], ["variacion", "Variación", "money", true], ["tendencia", "Tendencia", "text"]], changes.filter((r) => r.tendencia === "rising")),
      table("productos-baja", "Productos en baja", [["producto", "Producto", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["utilidadActual", "Utilidad actual", "money", true], ["utilidadAnterior", "Utilidad anterior", "money", true], ["variacion", "Variación", "money", true], ["tendencia", "Tendencia", "text"]], changes.filter((r) => r.tendencia === "falling")),
      table("dispersion-precios", "Dispersión de precios", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["cliente", "Cliente", "text"], ["vendedor", "Vendedor", "text"], ["lineas", "Líneas", "count"], ["minimo", "Mínimo", "money", true], ["maximo", "Máximo", "money", true], ["rango", "Rango", "money", true], ["promedio", "Promedio", "money", true], ["promedioPonderado", "Promedio ponderado", "money", true]], prices.rows.map((r) => ({ sku: String(r.sku), tela: String(r.tela), modalidad: modalityLabel(r.tipo), unidad: String(r.unidad), cliente: r.cliente == null ? "Sin dato" : String(r.cliente), vendedor: r.vendedor == null ? "Sin dato" : String(r.vendedor), lineas: number(r.lineas), minimo: number(r.minimo), maximo: number(r.maximo), rango: priceRange(number(r.minimo), number(r.maximo)), promedio: number(r.promedio), promedioPonderado: number(r.promedio_ponderado) }))),
      table("precios-por-sitio", "Precios por sitio", [["sku", "SKU", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["sitio", "Sitio", "text"], ["precio", "Precio promedio", "money", true], ["diferenciaSitios", "Diferencia entre sitios", "money", true]], crossSite.rows.map((r) => ({ sku: String(r.sku), modalidad: modalityLabel(r.tipo), unidad: String(r.unidad), sitio: String(r.sitio), precio: number(r.precio), diferenciaSitios: number(r.diferencia_sitios) }))),
      { ...table("calidad-costos", "Calidad de costos", [["modalidad", "Modalidad", "text"], ["calidad", "Calidad", "text"], ["lineas", "Líneas", "count"]], quality.rows.map((r) => ({ modalidad: modalityLabel(r.tipo), calidad: String(r.calidad), lineas: number(r.lineas) }))), economic: true },
      table("descuentos-y-margen", "Descuentos >30% o margen bajo", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["modalidad", "Modalidad", "text"], ["unidad", "Unidad", "text"], ["precio", "Precio", "money", true], ["sugerido", "Precio sugerido actual", "money", true], ["descuento", "Descuento", "percentage", true, true], ["margen", "Margen", "percentage", true]], discounts.rows.map((r) => ({ sku: String(r.sku), tela: String(r.tela), modalidad: modalityLabel(r.tipo), unidad: String(r.unidad), precio: number(r.precio), sugerido: number(r.sugerido), descuento: number(r.descuento), margen: r.margen == null ? null : number(r.margen) }))),
    ],
    warnings,
  };
}