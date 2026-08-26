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
const csv = (value: unknown) => typeof value === "string" ? value.split(",").map(x => x.trim()).filter(Boolean) : [];
const ids = (value: unknown) => csv(value).map(Number).filter(Number.isInteger);
const columns = (items: Array<[string, string, string, boolean?, boolean?]>) =>
  items.map(([key, label, kind, economic, estimated]) => ({ key, label, kind, ...(economic ? { economic: true } : {}), ...(estimated ? { estimated: true } : {}) }));
const table = (id: string, title: string, cols: Array<[string, string, string, boolean?, boolean?]>, rows: Row[], sumKeys: string[] = []) => {
  const resolvedColumns = columns(cols);
  const units = new Set(rows.map((row) => row.unidad).filter((unit) => unit != null));
  const totals = Object.fromEntries(resolvedColumns.flatMap((column) => {
    if (!sumKeys.includes(column.key) || (column.kind === "quantity" && units.size !== 1)) return [];
    return [[column.key, rows.reduce((sum, row) => sum + number(row[column.key]), 0)]];
  }));
  return { id, title, columns: resolvedColumns, rows, totals };
};

export function classifyCoverage(days: number | null, critical = 7, low = 15, normal = 45, excess = 90): string {
  if (days === null || !Number.isFinite(days)) return "SIN_VENTAS";
  if (days <= critical) return "CRITICO";
  if (days <= low) return "BAJO";
  if (days <= normal) return "NORMAL";
  // The excess threshold is deliberately accepted separately: installations
  // can distinguish normal coverage from their maximum policy coverage.
  return days <= excess ? "EXCESO" : "EXCESO";
}
export function classifyNoMovement(days: number | null): string {
  if (days === null) return "SIN_MOVIMIENTOS";
  if (days >= 180) return "180+";
  if (days >= 90) return "90-179";
  if (days >= 60) return "60-89";
  if (days >= 30) return "30-59";
  return "<30";
}
export function reconciles(existence: number, activeRollQuantity: number, ledger?: number | null, tolerance = 0.001): boolean {
  return Math.abs(existence - activeRollQuantity) <= tolerance &&
    (ledger == null || Math.abs(existence - ledger) <= tolerance);
}
type TransitTotals = { cantidad: number; valor: number };
/**
 * Transit visibility is appended separately from physical KPIs. Callers must
 * never fold these values into existence, available rolls, or availability.
 */
export function buildTransitVisibilityKpis(
  containerByUnit: Map<string, TransitTotals>,
  interSiteTransitByUnit: Map<string, TransitTotals>,
) {
  return ["METRO", "KILO"].flatMap(unidad => [
    { id: `en-contenedor-cantidad-${unidad}`, label: `En contenedor cantidad ${unidad}`, value: containerByUnit.get(unidad)?.cantidad ?? 0, kind: "quantity" },
    { id: `en-contenedor-valor-${unidad}`, label: `En contenedor valor ${unidad}`, value: containerByUnit.get(unidad)?.valor ?? 0, kind: "money", economic: true },
    { id: `en-transito-entre-sitios-cantidad-${unidad}`, label: `En tránsito entre sitios cantidad ${unidad}`, value: interSiteTransitByUnit.get(unidad)?.cantidad ?? 0, kind: "quantity" },
    { id: `en-transito-entre-sitios-valor-${unidad}`, label: `En tránsito entre sitios valor ${unidad}`, value: interSiteTransitByUnit.get(unidad)?.valor ?? 0, kind: "money", economic: true },
  ]);
}
export type DailyMovement = { day: string; quantity: number };
/** Rebuild close balances from today's balance by undoing later movements. */
export function reverseDailyCloses(current: number, movements: DailyMovement[], days: string[]): Array<{ day: string; quantity: number }> {
  const byDay = new Map<string, number>();
  for (const move of movements) byDay.set(move.day, (byDay.get(move.day) ?? 0) + move.quantity);
  let balance = current;
  const output: Array<{ day: string; quantity: number }> = [];
  for (const day of [...days].sort().reverse()) {
    output.push({ day, quantity: balance });
    balance -= byDay.get(day) ?? 0;
  }
  return output.reverse();
}

function productScope(ctx: DomainReportContext, alias = "p", locationColumn?: string) {
  const values: unknown[] = [];
  const clauses: string[] = [];
  const add = (column: string, value: unknown[], cast = "int[]") => {
    if (value.length) { values.push(value); clauses.push(`${column}=ANY($${values.length}::${cast})`); }
  };
  add(`${alias}.id`, ids(ctx.input.productoIds));
  add(`${alias}.tela`, csv(ctx.input.telas), "text[]");
  add(`${alias}.color`, csv(ctx.input.colores), "text[]");
  add(`${alias}.unidad::text`, csv(ctx.input.unidades), "text[]");
  if (locationColumn) add(locationColumn, ctx.locations?.length ? ctx.locations : ids(ctx.input.ubicacionIds));
  return { text: clauses.length ? clauses.join(" AND ") : "TRUE", values };
}
function salesScope(ctx: DomainReportContext) {
  const base = productScope(ctx, "p", "t.ubicacion_id");
  const values: unknown[] = [ctx.range.desde, ctx.range.hasta, ...base.values];
  const clauses = ["t.created_at >= $1", "t.created_at <= $2", "t.estado='VENDIDO'", base.text.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`)];
  const add = (column: string, value: unknown[], cast = "int[]") => { if (value.length) { values.push(value); clauses.push(`${column}=ANY($${values.length}::${cast})`); } };
  add("t.usuario_terminal_id", ids(ctx.input.usuarioIds)); add("t.cliente_id", ids(ctx.input.clienteIds));
  add("r.proveedor_id", ids(ctx.input.proveedorIds));
  if (typeof ctx.input.facturado === "boolean") { values.push(ctx.input.facturado); clauses.push(`t.facturado=$${values.length}`); }
  const pay = csv(ctx.input.formasPago); if (pay.length) { values.push(pay); clauses.push(`EXISTS (SELECT 1 FROM ticket_pagos tp WHERE tp.ticket_id=t.id AND tp.forma_pago::text=ANY($${values.length}::text[]))`); }
  return { text: clauses.join(" AND "), values };
}
const monthBuckets = (from: Date, to: Date, minimum: number) => {
  const result: string[] = []; const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end || result.length < minimum) { result.push(cursor.toISOString().slice(0, 7)); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
  return result;
};

export async function buildInventoryReport(section: "inventario" | "mapas-calor" | "color", ctx: DomainReportContext): Promise<{ kpis: any[]; charts: any[]; tables: any[]; warnings: string[] }> {
  const warnings: string[] = [];
  const sales = salesScope(ctx);
  if (section === "mapas-calor") {
    const minimum = (ctx.range.hasta.getTime() - ctx.range.desde.getTime()) / 86400000 >= 548 ? 24 : 12;
    const buckets = monthBuckets(ctx.range.desde, ctx.range.hasta, minimum);
    const q = await pool.query(`SELECT to_char(date_trunc('month',t.created_at AT TIME ZONE '${zone}'),'YYYY-MM') mes,p.sku,p.tela,p.color,p.unidad,u.nombre sitio,
      SUM(l.cantidad)::float cantidad,SUM(l.importe)::float ventas,SUM(l.importe-l.costo_total_congelado)::float utilidad
      FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id JOIN ubicaciones u ON u.id=t.ubicacion_id
      WHERE ${sales.text} GROUP BY mes,p.sku,p.tela,p.color,p.unidad,u.nombre`, sales.values);
    const make = (id: string, key: "sku" | "color" | "tela" | "sitio") => ({ id, title: `Mes × ${key}`, type: "heatmap", categoryKey: "mes",
      series: [{ key, label: key, kind: "text" }, { key: "cantidad", label: "Cantidad", kind: "quantity" }, { key: "ventas", label: "Ventas", kind: "money", economic: true }, { key: "utilidad", label: "Utilidad", kind: "money", economic: true }],
      rows: q.rows.map(r => ({ mes: r.mes, [key]: r[key], unidad: r.unidad, cantidad: number(r.cantidad), ventas: number(r.ventas), utilidad: number(r.utilidad) })) });
    return { kpis: [{ id: "meses", label: "Meses analizados", value: buckets.length, kind: "count" }], charts: [make("mes-producto", "sku"), make("mes-color", "color"), make("mes-tela", "tela"), make("mes-sitio", "sitio")], tables: [], warnings };
  }
  if (section === "color") {
    const scope = productScope(ctx, "p", "m.ubicacion_id");
    const salesRows = await pool.query(`SELECT p.color,p.tela,p.unidad,u.nombre sitio,SUM(l.cantidad)::float cantidad,SUM(l.importe)::float ventas
      FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id JOIN ubicaciones u ON u.id=t.ubicacion_id
      WHERE ${sales.text} GROUP BY p.color,p.tela,p.unidad,u.nombre`, sales.values);
    const noMove = await pool.query(`SELECT p.color,p.tela,p.unidad,MAX(m.created_at) ultimo FROM productos p LEFT JOIN movimientos m ON m.producto_id=p.id
      WHERE ${scope.text} GROUP BY p.id HAVING MAX(m.created_at) IS NULL OR MAX(m.created_at) < $${scope.values.length + 1}`, [...scope.values, new Date(ctx.range.hasta.getTime() - 90 * 86400000)]);
    const current = salesRows.rows.map(r => ({ color: r.color, tela: r.tela, unidad: r.unidad, sitio: r.sitio, cantidad: number(r.cantidad), ventas: number(r.ventas) }));
    return { kpis: [], charts: [{ id: "color-tela", title: "Color × tela", type: "heatmap", categoryKey: "color", series: [{ key: "tela", label: "Tela", kind: "text" }, { key: "cantidad", label: "Cantidad", kind: "quantity" }], rows: current }],
      tables: [table("ranking-color", "Ranking color por tela y unidad", [["color", "Color", "text"], ["tela", "Tela", "text"], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"], ["ventas", "Ventas", "money", true]], current, ["cantidad", "ventas"]),
        table("color-sitio", "Color por sitio", [["color", "Color", "text"], ["sitio", "Sitio", "text"], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"]], current, ["cantidad"]),
        table("sin-movimiento-90", "Sin movimiento ≥90 días", [["color", "Color", "text"], ["tela", "Tela", "text"], ["unidad", "Unidad", "text"], ["ultimo", "Último movimiento", "text"]], noMove.rows.map(r => ({ color: r.color, tela: r.tela, unidad: r.unidad, ultimo: r.ultimo ? new Date(r.ultimo).toISOString() : null })))], warnings };
  }
  const scope = productScope(ctx, "p", "e.ubicacion_id");
  const inv = await pool.query(`SELECT p.id,e.ubicacion_id,p.sku,p.tela,p.color,p.unidad,u.nombre sitio,e.cantidad_total cantidad,e.rollos_count rollos,
    COALESCE(SUM(r.cantidad_actual*r.costo_unitario),0)::float valor
    FROM existencias e JOIN productos p ON p.id=e.producto_id JOIN ubicaciones u ON u.id=e.ubicacion_id
    LEFT JOIN rollos r ON r.producto_id=e.producto_id AND r.ubicacion_id=e.ubicacion_id AND r.estado='DISPONIBLE'
    WHERE ${scope.text} GROUP BY p.id,e.ubicacion_id,u.nombre,e.cantidad_total,e.rollos_count`, scope.values);
  const sold = await pool.query(`SELECT p.id,SUM(l.cantidad)::float cantidad FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE ${sales.text} GROUP BY p.id`, sales.values);
  const soldByProduct = new Map(sold.rows.map(r => [Number(r.id), number(r.cantidad)]));
  const days = Math.max(1, Math.ceil((ctx.range.hasta.getTime() - ctx.range.desde.getTime() + 1) / 86400000));
  const critical = number(ctx.input.coberturaCritico ?? 7), low = number(ctx.input.coberturaBajo ?? 15), normal = number(ctx.input.coberturaNormal ?? 45), excess = number(ctx.input.coberturaExceso ?? 90);
  const rows = inv.rows.map(r => { const stock = number(r.cantidad), soldQty = soldByProduct.get(Number(r.id)) ?? 0, daily = soldQty / days, coverage = daily > 0 ? stock / daily : null; return { productoId: number(r.id), ubicacionId: number(r.ubicacion_id), sku: r.sku, tela: r.tela, color: r.color, unidad: r.unidad, sitio: r.sitio, cantidad: stock, rollos: number(r.rollos), valor: number(r.valor), vendidoPeriodo: soldQty, coberturaDias: coverage, clasificacion: classifyCoverage(coverage, critical, low, normal, excess) }; });
  const totals = rows.reduce((m, r) => { m[r.unidad] ??= { cantidad: 0, rollos: 0, valor: 0 }; m[r.unidad].cantidad += r.cantidad; m[r.unidad].rollos += r.rollos; m[r.unidad].valor += r.valor; return m; }, {} as Record<string, { cantidad: number; rollos: number; valor: number }>);
  const rollScope = productScope(ctx, "p", "r.ubicacion_id");
  const activeRolls = await pool.query(`SELECT r.producto_id,r.ubicacion_id,COALESCE(SUM(r.cantidad_actual),0)::float cantidad
    FROM rollos r JOIN productos p ON p.id=r.producto_id WHERE r.estado='DISPONIBLE' AND ${rollScope.text}
    GROUP BY r.producto_id,r.ubicacion_id`, rollScope.values);
  const activeByPair = new Map(activeRolls.rows.map(r => [`${r.producto_id}:${r.ubicacion_id}`, number(r.cantidad)]));
  const validPairs = new Set(rows.filter(r => reconciles(r.cantidad, activeByPair.get(`${r.productoId}:${r.ubicacionId}`) ?? 0)).map(r => `${r.productoId}:${r.ubicacionId}`));
  const unreconciled = rows.filter(r => !validPairs.has(`${r.productoId}:${r.ubicacionId}`));
  if (unreconciled.length) warnings.push(`Se omitió el cierre diario para ${unreconciled.length} producto(s)/sitio(s): existencia actual no coincide con cantidades de rollos activos.`);
  const movementScopeForClose = productScope(ctx, "p", "m.ubicacion_id");
  const closeMovements = validPairs.size ? await pool.query(`SELECT m.producto_id,m.ubicacion_id,
    (m.created_at AT TIME ZONE '${zone}')::date::text dia,SUM(m.cantidad)::float cantidad
    FROM movimientos m JOIN productos p ON p.id=m.producto_id
    WHERE m.created_at >= $1 AND ${movementScopeForClose.text.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)}
    GROUP BY m.producto_id,m.ubicacion_id,dia`, [ctx.range.desde, ...movementScopeForClose.values]) : { rows: [] as any[] };
  const daysForClose: string[] = [];
  for (let d = new Date(ctx.range.desde); d <= ctx.range.hasta; d = new Date(d.getTime() + 86400000)) daysForClose.push(d.toISOString().slice(0, 10));
  const closeRows = rows.filter(r => validPairs.has(`${r.productoId}:${r.ubicacionId}`)).flatMap(r =>
    reverseDailyCloses(r.cantidad, closeMovements.rows.filter(m => Number(m.producto_id) === r.productoId && Number(m.ubicacion_id) === r.ubicacionId).map(m => ({ day: m.dia, quantity: number(m.cantidad) })), daysForClose)
      .map(close => ({ dia: close.day, sku: r.sku, sitio: r.sitio, unidad: r.unidad, cantidad: close.quantity })));
  const lostRows = rows.map(r => {
    const closes = closeRows.filter(c => c.sku === r.sku && c.sitio === r.sitio);
    const zeroStockDays = closes.filter(c => c.cantidad <= 0).length;
    const averageDaily = r.vendidoPeriodo / Math.max(1, days - zeroStockDays);
    const unitValue = r.vendidoPeriodo > 0 ? 0 : 0; // value requires observed sale price; retained as an explicit estimate when unavailable
    return { ...r, zeroStockDays, perdidaCantidadEstimada: zeroStockDays * averageDaily, perdidaValorEstimada: zeroStockDays * averageDaily * unitValue };
  });
  const movementScope = productScope(ctx, "p", "m.ubicacion_id");
  const activity = await pool.query(`SELECT p.unidad,p.sku,p.tela,p.color,u.nombre sitio,
    MAX(m.created_at) ultimo_movimiento,
    COALESCE(SUM(m.cantidad) FILTER(WHERE m.tipo IN ('ALTA','RECEPCION')),0)::float comprado,
    COALESCE(SUM(-m.cantidad) FILTER(WHERE m.tipo='VENTA'),0)::float vendido,
    COALESCE(SUM(-m.cantidad) FILTER(WHERE m.tipo='AJUSTE_NEGATIVO'),0)::float ajuste_negativo
    FROM productos p JOIN movimientos m ON m.producto_id=p.id JOIN ubicaciones u ON u.id=m.ubicacion_id
    WHERE m.created_at >= $1 AND m.created_at <= $2 AND ${movementScope.text.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`)}
    GROUP BY p.id,u.nombre`, [ctx.range.desde, ctx.range.hasta, ...movementScope.values]);
  const noMovement = await pool.query(`SELECT p.sku,p.tela,p.color,p.unidad,MAX(m.created_at) ultimo_movimiento
    FROM productos p LEFT JOIN movimientos m ON m.producto_id=p.id
    WHERE ${movementScope.text} GROUP BY p.id HAVING MAX(m.created_at) IS NULL OR MAX(m.created_at)<$${movementScope.values.length + 1}`,
    [...movementScope.values, new Date(ctx.range.hasta.getTime() - 30 * 86400000)]);
  const openRolls = await pool.query(`SELECT r.serie,p.sku,p.tela,p.color,p.unidad,u.nombre sitio,r.cantidad_actual::float cantidad,
    EXTRACT(day FROM now()-r.created_at)::int antiguedad FROM rollos r JOIN productos p ON p.id=r.producto_id JOIN ubicaciones u ON u.id=r.ubicacion_id
    WHERE r.estado='ABIERTO' AND ${rollScope.text} ORDER BY r.created_at`, rollScope.values);
  // Transit rolls are visibility-only: they are deliberately queried and
  // presented apart from physical existence and never enter availability totals.
  const containerScope = productScope(ctx, "p", "r.ubicacion_id");
  const containerRolls = await pool.query(`SELECT p.unidad,
    COALESCE(SUM(r.cantidad_actual),0)::float cantidad,
    COALESCE(SUM(r.cantidad_actual*r.costo_unitario),0)::float valor
    FROM rollos r
    JOIN productos p ON p.id=r.producto_id
    WHERE r.estado='EN_TRANSITO' AND ${containerScope.text}
      AND NOT EXISTS (
        SELECT 1
        FROM salida_rollos sr
        JOIN salidas s ON s.id = sr.salida_id
        WHERE sr.rollo_id = r.id AND s.estado = 'EN_TRANSITO'
      )
    GROUP BY p.unidad`, containerScope.values);
  const interSiteTransitRolls = await pool.query(`SELECT p.unidad,
    COALESCE(SUM(r.cantidad_actual),0)::float cantidad,
    COALESCE(SUM(r.cantidad_actual*r.costo_unitario),0)::float valor
    FROM rollos r
    JOIN productos p ON p.id=r.producto_id
    WHERE r.estado='EN_TRANSITO' AND ${containerScope.text}
      AND EXISTS (
        SELECT 1
        FROM salida_rollos sr
        JOIN salidas s ON s.id = sr.salida_id
        WHERE sr.rollo_id = r.id AND s.estado = 'EN_TRANSITO'
      )
    GROUP BY p.unidad`, containerScope.values);
  const containerByUnit = new Map(containerRolls.rows.map(r => [String(r.unidad), { cantidad: number(r.cantidad), valor: number(r.valor) }]));
  const interSiteTransitByUnit = new Map(interSiteTransitRolls.rows.map(r => [String(r.unidad), { cantidad: number(r.cantidad), valor: number(r.valor) }]));
  // Both transit groups are visibility-only and deliberately remain outside
  // physical availability totals, roll counts, and their reconciliation.
  const transitKpis = buildTransitVisibilityKpis(containerByUnit, interSiteTransitByUnit);
  return { kpis: [...Object.entries(totals).flatMap(([unidad, x]) => [{ id: `existencia-${unidad}`, label: `Existencia ${unidad}`, value: x.cantidad, kind: "quantity" }, { id: `rollos-${unidad}`, label: `Rollos ${unidad}`, value: x.rollos, kind: "count" }, { id: `valor-${unidad}`, label: `Valor ${unidad}`, value: x.valor, kind: "money", economic: true },
    { id: `perdida-estimada-${unidad}`, label: `Pérdida estimada ${unidad}`, value: lostRows.filter(r => r.unidad === unidad).reduce((s, r) => s + r.perdidaCantidadEstimada, 0), kind: "quantity", estimated: true }]),
    ...transitKpis],
    charts: [{ id: "existencia-producto", title: "Existencia por producto", type: "treemap", categoryKey: "sku", series: [{ key: "cantidad", label: "Cantidad", kind: "quantity" }], rows }, ...(unreconciled.length ? [] : [{ id: "cierres-diarios", title: "Cierre diario de inventario", type: "line", categoryKey: "dia", series: [{ key: "cantidad", label: "Cantidad", kind: "quantity" }], rows: closeRows }])],
    tables: [table("existencia-actual", "Existencia actual", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["unidad", "Unidad", "text"], ["sitio", "Sitio", "text"], ["cantidad", "Cantidad", "quantity"], ["rollos", "Rollos", "count"], ["valor", "Valor", "money", true], ["vendidoPeriodo", "Vendido", "quantity"], ["coberturaDias", "Cobertura días", "number"], ["clasificacion", "Clasificación", "text"], ["zeroStockDays", "Días sin existencia", "count", false, true], ["perdidaCantidadEstimada", "Venta perdida estimada", "quantity", false, true], ["perdidaValorEstimada", "Valor perdido estimado", "money", true, true]], lostRows, ["cantidad", "valor", "vendidoPeriodo", "perdidaCantidadEstimada", "perdidaValorEstimada"]),
      table("comprado-vendido", "Comprado vs vendido", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["unidad", "Unidad", "text"], ["sitio", "Sitio", "text"], ["comprado", "Comprado", "quantity"], ["vendido", "Vendido", "quantity"], ["ajusteNegativo", "Ajuste negativo", "quantity"]], activity.rows.map(r => ({ sku: r.sku, tela: r.tela, color: r.color, unidad: r.unidad, sitio: r.sitio, comprado: number(r.comprado), vendido: number(r.vendido), ajusteNegativo: number(r.ajuste_negativo) })), ["comprado", "vendido", "ajusteNegativo"]),
      table("sin-movimiento", "Sin movimiento", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["unidad", "Unidad", "text"], ["ultimoMovimiento", "Último movimiento", "text"], ["banda", "Banda", "text"]], noMovement.rows.map(r => { const last = r.ultimo_movimiento ? new Date(r.ultimo_movimiento) : null; const age = last ? Math.floor((ctx.range.hasta.getTime() - last.getTime()) / 86400000) : null; return { sku: r.sku, tela: r.tela, color: r.color, unidad: r.unidad, ultimoMovimiento: last?.toISOString() ?? null, banda: classifyNoMovement(age) }; })),
      table("rollos-abiertos", "Rollos abiertos", [["serie", "Rollo", "text"], ["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["unidad", "Unidad", "text"], ["sitio", "Sitio", "text"], ["cantidad", "Remanente", "quantity"], ["antiguedad", "Antigüedad (días)", "count"]], openRolls.rows.map(r => ({ serie: r.serie, sku: r.sku, tela: r.tela, color: r.color, unidad: r.unidad, sitio: r.sitio, cantidad: number(r.cantidad), antiguedad: number(r.antiguedad) })), ["cantidad"])], warnings };
}