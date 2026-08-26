import { pool } from "@workspace/db";

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
type ColumnInput = [string, string, string, boolean?, boolean?] | Record<string, unknown>;
const cols = (items: ColumnInput[]) => items.map((item) => {
  if (!Array.isArray(item)) return item;
  const [key, label, kind, economic, estimated] = item;
  return { key, label, kind, ...(economic ? { economic: true } : {}), ...(estimated ? { estimated: true } : {}) };
});
const table = (id: string, title: string, columns: ColumnInput[], rows: Row[]) => ({
  id,
  title,
  columns: cols(columns),
  rows,
  totals: {},
});
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

export function exactFrozenMargin(lines: Array<{ importe: number; rolloId: number | null; costoUnitarioCongelado: number; costoTotalCongelado: number }>) {
  return lines.reduce((result, line) => {
    if (line.rolloId == null || line.costoUnitarioCongelado <= 0 || line.costoTotalCongelado <= 0) return result;
    result.costo += line.costoTotalCongelado;
    result.utilidad += line.importe - line.costoTotalCongelado;
    result.denominador += line.importe;
    return result;
  }, { costo: 0, utilidad: 0, denominador: 0 });
}

/** Ticket subtotal is net of IVA; this makes the report's tax convention explicit. */
export function subtotalBeforeTax(total: number, iva: number): number { return total - iva; }
export function priceRange(minimum: number, maximum: number): number { return Math.max(0, maximum - minimum); }
export function trendDirection(current: number, previous: number): "rising" | "falling" | "flat" {
  return current > previous ? "rising" : current < previous ? "falling" : "flat";
}

function where(ctx: DomainReportContext, range = ctx.range, alias = "t") {
  const args: unknown[] = [range.desde.toISOString(), range.hasta.toISOString()];
  const parts = [`${alias}.created_at >= $1`, `${alias}.created_at <= $2`];
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
  if (typeof ctx.input.facturado === "boolean") { args.push(ctx.input.facturado); parts.push(`${alias}.facturado=$${args.length}`); }
  const payments = values(ctx.input.formasPago);
  if (payments.length) { args.push(payments); parts.push(`EXISTS (SELECT 1 FROM ticket_pagos fp WHERE fp.ticket_id=${alias}.id AND fp.forma_pago::text=ANY($${args.length}::text[]))`); }
  return { text: parts.join(" AND "), values: args };
}

const joins = "FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id JOIN ubicaciones u ON u.id=t.ubicacion_id LEFT JOIN usuarios vendedor ON vendedor.id=t.usuario_terminal_id LEFT JOIN clientes cliente ON cliente.id=t.cliente_id LEFT JOIN rollos r ON r.id=l.rollo_id";
const marginFilter = "l.rollo_id IS NOT NULL AND l.costo_unitario_congelado > 0 AND l.costo_total_congelado > 0";

export async function buildSalesReport(section: "ventas" | "utilidad", ctx: DomainReportContext): Promise<{ kpis: any[]; charts: any[]; tables: any[]; warnings: string[] }> {
  const normal = where(ctx);
  const salesWhere = `${normal.text} AND t.estado='VENDIDO'`;
  const compare = async (range: { desde: Date; hasta: Date }) => {
    const condition = where(ctx, { ...ctx.range, ...range });
    const result = await pool.query(`SELECT COALESCE(SUM(l.importe),0)::float ventas, COUNT(DISTINCT t.id)::int tickets,
      COALESCE(SUM(l.cantidad),0)::float cantidad,
      COALESCE(SUM(l.costo_total_congelado) FILTER (WHERE ${marginFilter}),0)::float costo,
      COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER (WHERE ${marginFilter}),0)::float utilidad,
      COALESCE(SUM(l.importe) FILTER (WHERE ${marginFilter}),0)::float denominador
      ${joins} WHERE ${condition.text} AND t.estado='VENDIDO'`, condition.values);
    return result.rows[0]!;
  };
  const [current, previous, yearAgo] = await Promise.all([
    compare(ctx.range), compare({ desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }),
    compare({ desde: ctx.range.yearAgoDesde, hasta: ctx.range.yearAgoHasta }),
  ]);
  const sales = number(current.ventas), tickets = number(current.tickets), quantity = number(current.cantidad);
  const kpi = (id: string, label: string, value: number, kind: string, old: unknown, ago: unknown, economic = false) =>
    ({ id, label, value, kind, ...(economic ? { economic: true } : {}), comparisonPrevious: safePercent(value, number(old)), comparisonYearAgo: safePercent(value, number(ago)) });
  const warnings: string[] = [];

  const dimensions = async (id: string, title: string, expression: string, group = expression, extra = "") => {
    const result = await pool.query(`SELECT ${expression} dimension,COALESCE(SUM(l.cantidad),0)::float cantidad,
      COALESCE(SUM(l.importe),0)::float ventas,COALESCE(SUM(l.costo_total_congelado) FILTER (WHERE ${marginFilter}),0)::float costo,
      COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER (WHERE ${marginFilter}),0)::float utilidad,
      COALESCE(SUM(l.importe) FILTER (WHERE ${marginFilter}),0)::float denominador,
       COUNT(DISTINCT t.id)::int tickets ${joins} WHERE ${salesWhere} ${extra}
      GROUP BY ${group} ORDER BY ventas DESC LIMIT 250`, normal.values);
    return table(id, title, [["dimension", title, "text"], ["cantidad", "Cantidad", "quantity"], ["tickets", "Tickets", "count"], ["ventas", "Ventas", "money", true], ["costo", "Costo congelado", "money", true], ["utilidad", "Utilidad", "money", true], ["margenPct", "Margen exacto", "percentage", true]],
      result.rows.map((r) => ({ dimension: r.dimension == null ? "Sin dato" : String(r.dimension), cantidad: number(r.cantidad), tickets: number(r.tickets), ventas: number(r.ventas), costo: number(r.costo), utilidad: number(r.utilidad), margenPct: number(r.denominador) ? number(r.utilidad) / number(r.denominador) * 100 : 0 })));
  };

  if (section === "ventas") {
    const [daily, weekday, hour, site, product, fabric, color, seller, client, invoice] = await Promise.all([
      dimensions("ventas-diarias", "Día", `(t.created_at AT TIME ZONE '${zone}')::date::text`),
      dimensions("por-dia-semana", "Día de semana", `trim(to_char(t.created_at AT TIME ZONE '${zone}','Day'))`, `EXTRACT(ISODOW FROM t.created_at AT TIME ZONE '${zone}'),trim(to_char(t.created_at AT TIME ZONE '${zone}','Day'))`),
      dimensions("por-hora", "Hora", `to_char(t.created_at AT TIME ZONE '${zone}','HH24')`),
      dimensions("por-sitio", "Sitio", "u.nombre"), dimensions("por-producto", "Producto", "p.sku", "p.id,p.sku"),
      dimensions("por-tela", "Tela", "p.tela"), dimensions("por-color", "Color", "p.color"),
      dimensions("por-vendedor", "Vendedor", "vendedor.nombre"), dimensions("por-cliente", "Cliente", "cliente.nombre"),
      dimensions("por-factura", "Estado de factura", "CASE WHEN t.facturado THEN 'Facturado' ELSE 'No facturado' END", "t.facturado"),
    ]);
    // Payment needs an actual joined payment method rather than an EXISTS-only label.
    const pay = await pool.query(`WITH filtered_tickets AS (
        SELECT DISTINCT t.id ${joins} WHERE ${salesWhere}
      ) SELECT fp.forma_pago::text dimension,COUNT(DISTINCT ft.id)::int tickets,COALESCE(SUM(fp.importe),0)::float ventas
      FROM filtered_tickets ft JOIN ticket_pagos fp ON fp.ticket_id=ft.id
      GROUP BY fp.forma_pago ORDER BY ventas DESC`, normal.values);
    const paymentTable = table("por-pago", "Forma de pago", [["dimension", "Forma de pago", "text"], ["tickets", "Tickets", "count"], ["ventas", "Importe cobrado", "money", true]],
      pay.rows.map((r) => ({ dimension: String(r.dimension), tickets: number(r.tickets), ventas: number(r.ventas) })));
    const ranked = product.rows as Row[];
    const total = ranked.reduce((sum, row) => sum + number(row.ventas), 0);
    let accumulated = 0;
    const abcRows = ranked.map((row) => { accumulated += number(row.ventas); const cumulativePercent = total === 0 ? 0 : accumulated / total * 100; return { producto: String(row.dimension), ventas: number(row.ventas), porcentajeAcumulado: cumulativePercent, clase: abcClass(cumulativePercent) }; });
    const pairs = await pool.query(`SELECT p1.sku producto_a,p2.sku producto_b,COUNT(DISTINCT l1.ticket_id)::int tickets
      FROM ticket_lineas l1 JOIN ticket_lineas l2 ON l2.ticket_id=l1.ticket_id AND l1.producto_id<l2.producto_id
      JOIN tickets t ON t.id=l1.ticket_id JOIN productos p1 ON p1.id=l1.producto_id JOIN productos p2 ON p2.id=l2.producto_id
      JOIN productos p ON p.id=l1.producto_id LEFT JOIN rollos r ON r.id=l1.rollo_id
      WHERE ${salesWhere} GROUP BY p1.sku,p2.sku ORDER BY tickets DESC LIMIT 100`, normal.values);
    const cancelled = await pool.query(`SELECT t.folio,t.motivo_cancelacion motivo,u.nombre sitio,COALESCE(SUM(l.importe),t.total)::float importe,COUNT(l.id)::int lineas
      ${joins} WHERE ${normal.text} AND t.estado='CANCELADO' GROUP BY t.id,u.nombre ORDER BY t.created_at DESC`, normal.values);
    const cancelledProducts = await pool.query(`SELECT p.sku,p.tela,p.color,COUNT(*)::int lineas,COALESCE(SUM(l.cantidad),0)::float cantidad,COALESCE(SUM(l.importe),0)::float importe
      ${joins} WHERE ${normal.text} AND t.estado='CANCELADO' GROUP BY p.id ORDER BY importe DESC`, normal.values);
    const cancellationSummary = { tickets: cancelled.rows.length, importe: cancelled.rows.reduce((s, r) => s + number(r.importe), 0) };
    return {
      kpis: [kpi("ventas", "Ventas", sales, "money", previous.ventas, yearAgo.ventas, true), kpi("tickets", "Tickets", tickets, "count", previous.tickets, yearAgo.tickets), kpi("cantidad", "Cantidad vendida", quantity, "quantity", previous.cantidad, yearAgo.cantidad), kpi("ticket-promedio", "Ticket promedio", tickets ? sales / tickets : 0, "money", number(previous.tickets) ? number(previous.ventas) / number(previous.tickets) : 0, number(yearAgo.tickets) ? number(yearAgo.ventas) / number(yearAgo.tickets) : 0, true)],
      charts: [chart("timeline", "Ventas diarias", "line", "dimension", [{ key: "ventas", label: "Ventas", kind: "money", economic: true }], daily.rows), chart("horas", "Ventas por hora", "bar", "dimension", [{ key: "ventas", label: "Ventas", kind: "money", economic: true }], hour.rows), chart("semana", "Ventas por día", "bar", "dimension", [{ key: "ventas", label: "Ventas", kind: "money", economic: true }], weekday.rows)],
      tables: [daily, weekday, hour, site, product, fabric, color, seller, client, paymentTable, invoice, table("mejores-productos", "Mejores productos", product.columns as any, ranked.slice(0, 20)), table("peores-productos", "Peores productos", product.columns as any, [...ranked].reverse().slice(0, 20)), table("abc-productos", "Clasificación ABC", [["producto", "Producto", "text"], ["ventas", "Ventas", "money", true], ["porcentajeAcumulado", "% acumulado", "percentage"], ["clase", "Clase", "text"]], abcRows), table("canasta-pares", "Pares de productos en canasta", [["productoA", "Producto A", "text"], ["productoB", "Producto B", "text"], ["tickets", "Tickets", "count"]], pairs.rows.map((r) => ({ productoA: String(r.producto_a), productoB: String(r.producto_b), tickets: number(r.tickets) }))), table("resumen-cancelaciones", "Resumen de cancelaciones", [["tickets", "Tickets cancelados", "count"], ["importe", "Importe cancelado", "money", true]], [cancellationSummary]), table("cancelaciones", "Cancelaciones", [["folio", "Folio", "text"], ["motivo", "Motivo", "text"], ["sitio", "Sitio", "text"], ["lineas", "Líneas", "count"], ["importe", "Importe", "money", true]], cancelled.rows.map((r) => ({ folio: String(r.folio), motivo: r.motivo == null ? null : String(r.motivo), sitio: String(r.sitio), lineas: number(r.lineas), importe: number(r.importe) }))), table("productos-cancelados", "Productos cancelados", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["lineas", "Líneas", "count"], ["cantidad", "Cantidad", "quantity"], ["importe", "Importe", "money", true]], cancelledProducts.rows.map((r) => ({ sku: String(r.sku), tela: String(r.tela), color: String(r.color), lineas: number(r.lineas), cantidad: number(r.cantidad), importe: number(r.importe) })))],
      warnings,
    };
  }

  const [fabric, product, color, site, seller, evolution, quality, prices, crossSite] = await Promise.all([
    dimensions("utilidad-tela", "Tela", "p.tela"), dimensions("utilidad-producto", "Producto", "p.sku", "p.id,p.sku"), dimensions("utilidad-color", "Color", "p.color"), dimensions("utilidad-sitio", "Sitio", "u.nombre"), dimensions("utilidad-vendedor", "Vendedor", "vendedor.nombre"),
    dimensions("evolucion-margen", "Día", `(t.created_at AT TIME ZONE '${zone}')::date::text`),
    pool.query(`SELECT CASE WHEN l.rollo_id IS NULL THEN 'Sin rollo' WHEN l.costo_unitario_congelado<=0 OR l.costo_total_congelado<=0 THEN 'Costo nulo/cero' ELSE 'Válida' END calidad,COUNT(*)::int lineas FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} GROUP BY calidad`, normal.values),
    pool.query(`SELECT p.sku,p.tela,cliente.nombre cliente,vendedor.nombre vendedor,COUNT(*)::int lineas,MIN(l.precio_unitario)::float minimo,MAX(l.precio_unitario)::float maximo,AVG(l.precio_unitario)::float promedio,CASE WHEN SUM(l.cantidad)=0 THEN 0 ELSE SUM(l.precio_unitario*l.cantidad)/SUM(l.cantidad) END::float promedio_ponderado FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN clientes cliente ON cliente.id=t.cliente_id LEFT JOIN usuarios vendedor ON vendedor.id=t.usuario_terminal_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} GROUP BY p.id,cliente.nombre,vendedor.nombre ORDER BY promedio_ponderado DESC`, normal.values),
    pool.query(`WITH by_site AS (
      SELECT p.sku,u.nombre sitio,AVG(l.precio_unitario)::float precio FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id JOIN ubicaciones u ON u.id=t.ubicacion_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} GROUP BY p.sku,u.nombre
    ) SELECT sku,sitio,precio,(MAX(precio) OVER (PARTITION BY sku)-MIN(precio) OVER (PARTITION BY sku))::float diferencia_sitios FROM by_site ORDER BY sku,sitio`, normal.values),
  ]);
  const prevProduct = await pool.query(`SELECT p.sku,COALESCE(SUM(l.importe-l.costo_total_congelado) FILTER (WHERE ${marginFilter}),0)::float utilidad,COALESCE(SUM(l.cantidad),0)::float cantidad ${joins} WHERE ${where(ctx, { ...ctx.range, desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }).text} AND t.estado='VENDIDO' GROUP BY p.sku`, where(ctx, { ...ctx.range, desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta }).values);
  const prior = new Map(prevProduct.rows.map((r) => [String(r.sku), r]));
  const divergent = (product.rows as Row[]).map((r) => {
    const priorRow = prior.get(String(r.dimension));
    const cantidad = number(r.cantidad);
    const utilidad = number(r.utilidad);
    return { producto: String(r.dimension), cantidad, utilidad, divergencia: Math.abs(safePercent(cantidad, number(priorRow?.cantidad)) - safePercent(utilidad, number(priorRow?.utilidad))) };
  }).sort((a, b) => b.divergencia - a.divergencia);
  const changes = (product.rows as Row[]).map((r) => {
    const utilidadActual = number(r.utilidad);
    const utilidadAnterior = number(prior.get(String(r.dimension))?.utilidad);
    return { producto: String(r.dimension), utilidadActual, utilidadAnterior, variacion: utilidadActual - utilidadAnterior, tendencia: trendDirection(utilidadActual, utilidadAnterior) };
  }).sort((a, b) => b.variacion - a.variacion);
  const threshold = number(ctx.input.margenUmbral ?? 15);
  const discounts = await pool.query(`SELECT p.sku,p.tela,l.precio_unitario::float precio,p.precio_sugerido::float sugerido,((p.precio_sugerido-l.precio_unitario)/NULLIF(p.precio_sugerido,0)*100)::float descuento,((l.importe-l.costo_total_congelado)/NULLIF(l.importe,0)*100)::float margen FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${salesWhere} AND p.precio_sugerido>0 AND ((p.precio_sugerido-l.precio_unitario)/p.precio_sugerido*100>30 OR (${marginFilter} AND (l.importe-l.costo_total_congelado)/NULLIF(l.importe,0)*100<$${normal.values.length + 1})) ORDER BY descuento DESC`, [...normal.values, threshold]);
  warnings.push("Los descuentos se calculan contra precio_sugerido ACTUAL de productos; no es un snapshot histórico.");
  warnings.push("Costo, utilidad y margen usan exclusivamente líneas con rollo_id y costo unitario y total congelados positivos; el denominador de margen es sólo el importe de esas líneas.");
  return {
    kpis: [kpi("costo-congelado", "Costo congelado", number(current.costo), "money", previous.costo, yearAgo.costo, true), kpi("utilidad-exacta", "Utilidad exacta", number(current.utilidad), "money", previous.utilidad, yearAgo.utilidad, true), kpi("margen-exacto", "Margen exacto", number(current.denominador) ? number(current.utilidad) / number(current.denominador) * 100 : 0, "percentage", number(previous.denominador) ? number(previous.utilidad) / number(previous.denominador) * 100 : 0, number(yearAgo.denominador) ? number(yearAgo.utilidad) / number(yearAgo.denominador) * 100 : 0, true)],
    charts: [chart("margen-evolucion", "Evolución de utilidad", "line", "dimension", [{ key: "utilidad", label: "Utilidad", kind: "money", economic: true }], evolution.rows)],
    tables: [fabric, product, color, site, seller, table("divergencia-cantidad-utilidad", "Divergencia cantidad vs utilidad", [["producto", "Producto", "text"], ["cantidad", "Cantidad", "quantity"], ["utilidad", "Utilidad", "money", true], ["divergencia", "Divergencia", "percentage", true]], divergent), table("productos-alza", "Productos en alza", [["producto", "Producto", "text"], ["utilidadActual", "Utilidad actual", "money", true], ["utilidadAnterior", "Utilidad anterior", "money", true], ["variacion", "Variación", "money", true], ["tendencia", "Tendencia", "text"]], changes.filter((r) => r.tendencia === "rising")), table("productos-baja", "Productos en baja", [["producto", "Producto", "text"], ["utilidadActual", "Utilidad actual", "money", true], ["utilidadAnterior", "Utilidad anterior", "money", true], ["variacion", "Variación", "money", true], ["tendencia", "Tendencia", "text"]], changes.filter((r) => r.tendencia === "falling")), table("dispersion-precios", "Dispersión de precios", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["cliente", "Cliente", "text"], ["vendedor", "Vendedor", "text"], ["lineas", "Líneas", "count"], ["minimo", "Mínimo", "money", true], ["maximo", "Máximo", "money", true], ["rango", "Rango", "money", true], ["promedio", "Promedio", "money", true], ["promedioPonderado", "Promedio ponderado", "money", true]], prices.rows.map((r) => ({ sku: String(r.sku), tela: String(r.tela), cliente: r.cliente == null ? "Sin dato" : String(r.cliente), vendedor: r.vendedor == null ? "Sin dato" : String(r.vendedor), lineas: number(r.lineas), minimo: number(r.minimo), maximo: number(r.maximo), rango: priceRange(number(r.minimo), number(r.maximo)), promedio: number(r.promedio), promedioPonderado: number(r.promedio_ponderado) }))), table("precios-por-sitio", "Precios por sitio", [["sku", "SKU", "text"], ["sitio", "Sitio", "text"], ["precio", "Precio promedio", "money", true], ["diferenciaSitios", "Diferencia entre sitios", "money", true]], crossSite.rows.map((r) => ({ sku: String(r.sku), sitio: String(r.sitio), precio: number(r.precio), diferenciaSitios: number(r.diferencia_sitios) }))), table("calidad-costos", "Calidad de costos", [["calidad", "Calidad", "text"], ["lineas", "Líneas", "count"]], quality.rows.map((r) => ({ calidad: String(r.calidad), lineas: number(r.lineas) }))), table("descuentos-y-margen", "Descuentos >30% o margen bajo", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["precio", "Precio", "money", true], ["sugerido", "Precio sugerido actual", "money", true], ["descuento", "Descuento", "percentage", true, true], ["margen", "Margen", "percentage", true]], discounts.rows.map((r) => ({ sku: String(r.sku), tela: String(r.tela), precio: number(r.precio), sugerido: number(r.sugerido), descuento: number(r.descuento), margen: number(r.margen) })))],
    warnings,
  };
}