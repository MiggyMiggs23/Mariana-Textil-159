import { db, pool } from "@workspace/db";
import { meteredReferenceCost } from "./metered-reference-cost";
import { loadCustomerCreditProjections } from "./credit-aging-read-model";
import { accountedDocumentAt, accountedDocumentPredicate } from "./accounted-document";

type Primitive = string | number | boolean | null;
type Row = Record<string, Primitive>;
export interface DomainReportContext {
  input: Record<string, unknown>;
  locations?: number[];
  range: { desde: Date; hasta: Date; previousDesde: Date; previousHasta: Date; yearAgoDesde: Date; yearAgoHasta: Date };
}
export type CommercialReport = { kpis: any[]; charts: any[]; tables: any[]; warnings: string[] };

const number = (value: unknown) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};
const csv = (value: unknown) => typeof value === "string"
  ? value.split(",").map((part) => part.trim()).filter(Boolean) : [];
const ids = (value: unknown) => csv(value).map(Number).filter(Number.isInteger);
const columns = (items: Array<[string, string, string, boolean?]>) =>
  items.map(([key, label, kind, economic]) => ({ key, label, kind, ...(economic ? { economic: true } : {}) }));
const table = (id: string, title: string, fields: Array<[string, string, string, boolean?]>, rows: Row[], sumKeys: string[] = []) => {
  const resolvedColumns = columns(fields);
  const units = new Set(rows.map((row) => row.unidad).filter((unit) => unit != null));
  const totals = Object.fromEntries(resolvedColumns.flatMap((column) => {
    if (!sumKeys.includes(column.key) || (column.kind === "quantity" && units.size !== 1)) return [];
    return [[column.key, rows.reduce((sum, row) => sum + number(row[column.key]), 0)]];
  }));
  return { id, title, columns: resolvedColumns, rows, totals };
};

export function riskFromFrequency(currentTickets: number, previousTickets: number): "SIN_HISTORIAL" | "ESTABLE" | "RIESGO_ALTO" {
  if (previousTickets <= 0) return "SIN_HISTORIAL";
  return currentTickets / previousTickets < 0.5 ? "RIESGO_ALTO" : "ESTABLE";
}

export function concentration(values: number[]): number {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  return total === 0 ? 0 : (Math.max(0, ...values) / total) * 100;
}
export function weightedUnitCost(receipts: Array<{ cost: number; quantity: number }>): number {
  const quantity = receipts.reduce((sum, receipt) => sum + Math.max(0, receipt.quantity), 0);
  return quantity === 0 ? 0 : receipts.reduce((sum, receipt) => sum + receipt.cost, 0) / quantity;
}
export function isCostRiseOverTenPercent(previous: number, current: number): boolean {
  return previous > 0 && current > previous * 1.1;
}
export function agingBucket(dueDate: string | null, today: string): string {
  if (!dueDate) return "Sin plazo";
  const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000);
  return days <= 0 ? "Vigente" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "91+";
}

function purchaseWhere(ctx: DomainReportContext) {
  const values: unknown[] = [ctx.range.desde, ctx.range.hasta];
  const where = ["e.fecha >= $1", "e.fecha <= $2"];
  const add = (field: string, valuesToAdd: unknown[], cast = "int[]") => {
    if (valuesToAdd.length) { values.push(valuesToAdd); where.push(`${field}=ANY($${values.length}::${cast})`); }
  };
  add("e.ubicacion_id", ctx.locations?.length ? ctx.locations : ids(ctx.input.ubicacionIds));
  add("e.usuario_id", ids(ctx.input.usuarioIds));
  add("e.proveedor_id", ids(ctx.input.proveedorIds));
  add("r.producto_id", ids(ctx.input.productoIds));
  add("p.tela", csv(ctx.input.telas), "text[]");
  add("p.color", csv(ctx.input.colores), "text[]");
  add("p.unidad::text", csv(ctx.input.unidades), "text[]");
  return { text: where.join(" AND "), values };
}
function salesWhere(ctx: DomainReportContext, dates = ctx.range) {
  const values: unknown[] = [dates.desde, dates.hasta];
  const where = [`${accountedDocumentAt("t")} >= $1`, `${accountedDocumentAt("t")} <= $2`, accountedDocumentPredicate("t")];
  const add = (field: string, input: unknown[], cast = "int[]") => {
    if (input.length) { values.push(input); where.push(`${field}=ANY($${values.length}::${cast})`); }
  };
  add("t.ubicacion_id", ctx.locations?.length ? ctx.locations : ids(ctx.input.ubicacionIds));
  add("t.usuario_terminal_id", ids(ctx.input.usuarioIds));
  add("t.cliente_id", ids(ctx.input.clienteIds));
  if (typeof ctx.input.facturado === "boolean") { values.push(ctx.input.facturado); where.push(`t.facturado=$${values.length}`); }
  const productIds = ids(ctx.input.productoIds); const telas = csv(ctx.input.telas); const colores = csv(ctx.input.colores); const unidades = csv(ctx.input.unidades);
  const productClauses: string[] = [];
  if (productIds.length) { values.push(productIds); productClauses.push(`l.producto_id=ANY($${values.length}::int[])`); }
  if (telas.length) { values.push(telas); productClauses.push(`p.tela=ANY($${values.length}::text[])`); }
  if (colores.length) { values.push(colores); productClauses.push(`p.color=ANY($${values.length}::text[])`); }
  if (unidades.length) { values.push(unidades); productClauses.push(`p.unidad::text=ANY($${values.length}::text[])`); }
  if (ctx.input.modalidad === "ROLLOS" || ctx.input.modalidad === "METRAJE") {
    values.push(ctx.input.modalidad === "METRAJE" ? "METREADO" : "NORMAL");
    productClauses.push(`l.tipo::text=$${values.length}`);
  }
  const suppliers = ids(ctx.input.proveedorIds);
  if (suppliers.length) { values.push(suppliers); productClauses.push(`r.proveedor_id=ANY($${values.length}::int[])`); }
  if (productClauses.length) where.push(`EXISTS (SELECT 1 FROM ticket_lineas l JOIN productos p ON p.id=l.producto_id LEFT JOIN rollos r ON r.id=l.rollo_id WHERE l.ticket_id=t.id AND ${productClauses.join(" AND ")})`);
  const payments = csv(ctx.input.formasPago);
  if (payments.length) { values.push(payments); where.push(`EXISTS (SELECT 1 FROM ticket_pagos fp WHERE fp.ticket_id=t.id AND fp.forma_pago::text=ANY($${values.length}::text[]))`); }
  return { text: where.join(" AND "), values };
}

async function purchases(ctx: DomainReportContext): Promise<CommercialReport> {
  const where = purchaseWhere(ctx);
  const [rollsResult, bySupplier, byProduct, byFabric, byColor, increases] = await Promise.all([
    pool.query(`SELECT e.folio,u.iniciales,e.fecha,pr.nombre proveedor,p.id producto_id,p.sku,p.tela,p.color,p.unidad,r.serie,
      r.cantidad_inicial cantidad,r.costo_unitario costo_unitario,r.costo_total costo_total
      FROM entradas e JOIN rollos r ON r.recepcion_id=e.id JOIN productos p ON p.id=r.producto_id
       JOIN ubicaciones u ON u.id=e.ubicacion_id
      LEFT JOIN proveedores pr ON pr.id=e.proveedor_id WHERE ${where.text} ORDER BY e.fecha,r.id`, where.values),
    pool.query(`SELECT COALESCE(pr.nombre,'Sin proveedor') proveedor,p.unidad,COALESCE(SUM(r.costo_total),0) costo,COUNT(*)::int rollos
      FROM entradas e JOIN rollos r ON r.recepcion_id=e.id LEFT JOIN proveedores pr ON pr.id=e.proveedor_id
      JOIN productos p ON p.id=r.producto_id WHERE ${where.text} GROUP BY pr.nombre,p.unidad ORDER BY costo DESC`, where.values),
    pool.query(`SELECT p.id producto_id,p.sku,p.tela,p.color,p.unidad,COALESCE(SUM(r.cantidad_inicial),0) cantidad,COALESCE(SUM(r.costo_total),0) costo,COUNT(*)::int rollos
      FROM entradas e JOIN rollos r ON r.recepcion_id=e.id JOIN productos p ON p.id=r.producto_id WHERE ${where.text} GROUP BY p.id ORDER BY costo DESC`, where.values),
    pool.query(`SELECT p.tela,p.unidad,COALESCE(SUM(r.cantidad_inicial),0) cantidad,COALESCE(SUM(r.costo_total),0) costo,COUNT(*)::int rollos FROM entradas e JOIN rollos r ON r.recepcion_id=e.id JOIN productos p ON p.id=r.producto_id WHERE ${where.text} GROUP BY p.tela,p.unidad ORDER BY costo DESC`, where.values),
    pool.query(`SELECT p.color,p.unidad,COALESCE(SUM(r.cantidad_inicial),0) cantidad,COALESCE(SUM(r.costo_total),0) costo,COUNT(*)::int rollos FROM entradas e JOIN rollos r ON r.recepcion_id=e.id JOIN productos p ON p.id=r.producto_id WHERE ${where.text} GROUP BY p.color,p.unidad ORDER BY costo DESC`, where.values),
    pool.query(`WITH receipt AS (SELECT e.fecha,p.sku,pr.nombre proveedor,r.costo_unitario,
       LAG(r.costo_unitario) OVER (PARTITION BY r.producto_id ORDER BY e.fecha,r.id) anterior
       FROM entradas e JOIN rollos r ON r.recepcion_id=e.id JOIN productos p ON p.id=r.producto_id LEFT JOIN proveedores pr ON pr.id=e.proveedor_id)
       SELECT * FROM receipt WHERE fecha >= $1 AND fecha <= $2 AND anterior>0 AND costo_unitario > anterior*1.1 ORDER BY fecha DESC`, [ctx.range.desde, ctx.range.hasta]),
  ]);
  const rolls = rollsResult.rows.map((r): Row => ({ folio: `${r.iniciales}-${String(r.folio).padStart(6, "0")}`, fecha: new Date(r.fecha).toISOString(), proveedor: r.proveedor ?? "Sin proveedor", sku: r.sku, tela: r.tela, color: r.color, unidad: r.unidad, serie: r.serie, cantidad: number(r.cantidad), costoUnitario: number(r.costo_unitario), costoTotal: number(r.costo_total) }));
  const alternatives = await pool.query(`WITH scoped AS (
      SELECT r.producto_id,p.sku,p.tela,p.color,p.unidad,pr.nombre proveedor,r.costo_unitario
      FROM entradas e JOIN rollos r ON r.recepcion_id=e.id JOIN productos p ON p.id=r.producto_id LEFT JOIN proveedores pr ON pr.id=e.proveedor_id WHERE ${where.text}
    ), costs AS (SELECT producto_id,sku,tela,color,unidad,proveedor,MIN(costo_unitario) costo FROM scoped GROUP BY producto_id,sku,tela,color,unidad,proveedor),
    ranked AS (SELECT *,MIN(costo) OVER(PARTITION BY producto_id) minimo,MAX(costo) OVER(PARTITION BY producto_id) maximo FROM costs)
    SELECT * FROM ranked WHERE maximo>minimo ORDER BY sku,costo`, where.values);
  const references = await Promise.all(byProduct.rows.map(async (r) => ({
    productoId: number(r.producto_id),
    reference: await meteredReferenceCost(db, number(r.producto_id), ctx.range.hasta),
  })));
  const referenceByProduct = new Map(references.map(({ productoId, reference }) => [productoId, reference]));
  const supplierRows = bySupplier.rows.map((r): Row => ({ proveedor: r.proveedor, unidad: r.unidad, costo: number(r.costo), rollos: number(r.rollos), concentracion: 0 }));
  const totalCost = supplierRows.reduce((sum, r) => sum + number(r.costo), 0);
  for (const unit of new Set(supplierRows.map((r) => String(r.unidad)))) {
    const unitRows = supplierRows.filter((r) => r.unidad === unit);
    const unitTotal = unitRows.reduce((sum, row) => sum + number(row.costo), 0);
    unitRows.forEach((r) => { r.concentracion = unitTotal === 0 ? 0 : number(r.costo) / unitTotal * 100; });
  }
  // This deliberately weights by received quantity.  The roll-detail table above
  // remains the source for individual costs; it is never averaged per roll.
  const trendMap = new Map<string, { fecha: string; sku: string; unidad: string; costo: number; cantidad: number }>();
  for (const roll of rolls) {
    const key = `${roll.fecha}|${roll.sku}|${roll.unidad}`;
    const point = trendMap.get(key) ?? { fecha: String(roll.fecha), sku: String(roll.sku), unidad: String(roll.unidad), costo: 0, cantidad: 0 };
    point.costo += number(roll.costoTotal); point.cantidad += number(roll.cantidad);
    trendMap.set(key, point);
  }
  const costTrend = [...trendMap.values()].map((point) => ({ fecha: point.fecha, sku: point.sku, unidad: point.unidad, costoUnitario: point.cantidad === 0 ? 0 : point.costo / point.cantidad }));
  const quantitiesByUnit = new Map<string, number>();
  for (const roll of rolls) {
    const unit = String(roll.unidad);
    quantitiesByUnit.set(unit, (quantitiesByUnit.get(unit) ?? 0) + number(roll.cantidad));
  }
  return {
    kpis: [{ id: "compras", label: "Compras", value: totalCost, kind: "money", economic: true }, { id: "costo", label: "Costo recibido", value: totalCost, kind: "money", economic: true }, ...[...quantitiesByUnit.entries()].map(([unidad, cantidad]) => ({ id: `cantidad-${unidad.toLowerCase()}`, label: `Cantidad recibida · ${unidad}`, value: cantidad, kind: "quantity" })), { id: "rollos", label: "Rollos recibidos", value: rolls.length, kind: "count" }, { id: "concentracion", label: "Concentración principal por unidad", value: Math.max(0, ...supplierRows.map((r) => number(r.concentracion))), kind: "percentage", economic: true }],
    charts: [{ id: "costo-por-rollo", title: "Costo unitario por rollo", type: "line", categoryKey: "fecha", series: [{ key: "costoUnitario", label: "Costo unitario", kind: "money", economic: true }], rows: costTrend }],
    tables: [
      table("compras-por-rollo", "Costo unitario por rollo y compra", [["folio", "Folio", "text"], ["fecha", "Fecha", "text"], ["proveedor", "Proveedor", "text"], ["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["unidad", "Unidad", "text"], ["serie", "Rollo", "text"], ["cantidad", "Cantidad", "quantity"], ["costoUnitario", "Costo unitario", "money", true], ["costoTotal", "Costo total", "money", true]], rolls, ["cantidad", "costoTotal"]),
      table("proveedores", "Compras por proveedor", [["proveedor", "Proveedor", "text"], ["unidad", "Unidad", "text"], ["rollos", "Rollos", "count"], ["costo", "Costo", "money", true], ["concentracion", "Concentración por unidad", "percentage", true]], supplierRows, ["costo"]),
      table("productos", "Compras por producto (siempre por rollo)", [["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"], ["rollos", "Rollos", "count"], ["costo", "Costo", "money", true], ["costoReferencia12Meses", "Costo referencia metreado (12 meses)", "money", true], ["estadoCostoReferencia", "Estado costo referencia", "text"], ["rollosReferencia", "Rollos incluidos referencia", "count"]], byProduct.rows.map((r): Row => { const reference = referenceByProduct.get(number(r.producto_id))!; return { sku:r.sku,tela:r.tela,color:r.color,unidad:r.unidad,cantidad:number(r.cantidad),rollos:number(r.rollos),costo:number(r.costo),costoReferencia12Meses:reference.cost == null ? null : number(reference.cost),estadoCostoReferencia:reference.status,rollosReferencia:reference.rollsIncluded }; }), ["cantidad", "costo"]),
      table("telas", "Compras por tela y unidad", [["tela", "Tela", "text"], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"], ["rollos", "Rollos", "count"], ["costo", "Costo", "money", true]], byFabric.rows.map((r): Row => ({ tela:r.tela,unidad:r.unidad,cantidad:number(r.cantidad),rollos:number(r.rollos),costo:number(r.costo) })), ["cantidad", "costo"]),
      table("colores", "Compras por color y unidad", [["color", "Color", "text"], ["unidad", "Unidad", "text"], ["cantidad", "Cantidad", "quantity"], ["rollos", "Rollos", "count"], ["costo", "Costo", "money", true]], byColor.rows.map((r): Row => ({ color:r.color,unidad:r.unidad,cantidad:number(r.cantidad),rollos:number(r.rollos),costo:number(r.costo) })), ["cantidad", "costo"]),
      table("incrementos", "Aumentos mayores a 10%", [["fecha","Fecha","text"],["sku","SKU","text"],["proveedor","Proveedor","text"],["anterior","Costo anterior","money",true],["actual","Costo actual","money",true],["incremento","Incremento","percentage",true]], increases.rows.map((r): Row => ({ fecha:new Date(r.fecha).toISOString(),sku:r.sku,proveedor:r.proveedor ?? "Sin proveedor",anterior:number(r.anterior),actual:number(r.costo_unitario),incremento:(number(r.costo_unitario)/number(r.anterior)-1)*100 }))),
      table("alternativas-proveedor", "Alternativas de proveedor", [["sku","SKU","text"],["tela","Tela","text"],["color","Color","text"],["unidad","Unidad","text"],["proveedor","Proveedor","text"],["costo","Costo unitario","money",true],["ahorroPotencial","Ahorro potencial unitario","money",true]], alternatives.rows.map((r): Row => ({ sku:r.sku,tela:r.tela,color:r.color,unidad:r.unidad,proveedor:r.proveedor ?? "Sin proveedor",costo:number(r.costo),ahorroPotencial:number(r.maximo)-number(r.costo) }))),
    ], warnings: ["Las compras no tienen modalidad: toda recepción es por rollo. El filtro ROLLOS/METRAJE no se aplica a esta sección.", "El costo de referencia metreado es el promedio simple no ponderado de rollos con costo válido recibidos en los 12 meses anteriores a la fecha final; ignora costos nulos, usa el último costo conocido si está vencido y queda sin costo si no existe uno."],
  };
}

async function clients(ctx: DomainReportContext): Promise<CommercialReport> {
  const where = salesWhere(ctx); const previous = salesWhere(ctx, { ...ctx.range, desde: ctx.range.previousDesde, hasta: ctx.range.previousHasta });
  const selectedClientIds = ids(ctx.input.clienteIds);
  const selectedLineCondition = ctx.input.modalidad === "ROLLOS" ? "l.tipo='NORMAL'"
    : ctx.input.modalidad === "METRAJE" ? "l.tipo='METREADO'" : "TRUE";
  const [summary, clientRows, publicRows, payments, credit, directedPayments, creditCustomers] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int tickets,COALESCE(SUM(x.ventas),0) ventas,
      CASE WHEN COUNT(*) FILTER (WHERE x.pendientes>0)>0 THEN NULL ELSE COALESCE(SUM(x.utilidad),0) END utilidad
      FROM tickets t LEFT JOIN LATERAL (SELECT COALESCE(SUM(l.importe),0) ventas,SUM(l.importe-l.costo_total_congelado) utilidad,
        COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL) pendientes
        FROM ticket_lineas l WHERE l.ticket_id=t.id AND ${selectedLineCondition}) x ON true WHERE ${where.text}`, where.values),
    pool.query(`SELECT c.id,c.nombre,c.es_sistema,COUNT(*)::int tickets,COALESCE(SUM(x.ventas),0) ventas,
      COALESCE(SUM(x.ventas_rollos),0) ventas_rollos,COALESCE(SUM(x.ventas_metraje),0) ventas_metraje,
      CASE WHEN COUNT(*) FILTER (WHERE x.pendientes>0)>0 THEN NULL ELSE COALESCE(SUM(x.utilidad),0) END utilidad,MAX(t.created_at) ultima
      FROM tickets t JOIN clientes c ON c.id=t.cliente_id LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(l.importe),0) ventas,SUM(l.importe-l.costo_total_congelado) utilidad,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL) pendientes,
          COALESCE(SUM(l.importe) FILTER (WHERE l.tipo='NORMAL' AND ${selectedLineCondition}),0) ventas_rollos,
          COALESCE(SUM(l.importe) FILTER (WHERE l.tipo='METREADO' AND ${selectedLineCondition}),0) ventas_metraje
        FROM ticket_lineas l WHERE l.ticket_id=t.id AND ${selectedLineCondition}
      ) x ON true WHERE ${where.text} GROUP BY c.id ORDER BY ventas DESC`, where.values),
    pool.query(`SELECT c.es_sistema,COUNT(DISTINCT t.id)::int tickets,COALESCE(SUM(l.importe),0) ventas FROM tickets t JOIN clientes c ON c.id=t.cliente_id JOIN ticket_lineas l ON l.ticket_id=t.id WHERE ${where.text} AND ${selectedLineCondition} GROUP BY c.es_sistema`, where.values),
    pool.query(`WITH filtered_components AS (
        SELECT t.id,l.tipo,t.subtotal::numeric ticket_subtotal,SUM(l.importe)::numeric component_subtotal
        FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
        WHERE ${where.text} AND ${selectedLineCondition}
        GROUP BY t.id,l.tipo,t.subtotal
      )
      SELECT tp.forma_pago,fc.tipo,COUNT(DISTINCT tp.id)::int operaciones,
        COALESCE(SUM(tp.importe*fc.component_subtotal/NULLIF(fc.ticket_subtotal,0)),0)::float importe
      FROM filtered_components fc JOIN ticket_pagos tp ON tp.ticket_id=fc.id
      GROUP BY tp.forma_pago,fc.tipo ORDER BY importe DESC`, where.values),
    pool.query(`SELECT mc.id,mc.cliente_id,mc.ticket_id,mc.tipo,mc.importe,mc.fecha_vencimiento,mc.es_incobrable,mc.notas,mc.created_at FROM movimientos_credito mc JOIN tickets t ON t.id=mc.ticket_id WHERE ${where.text} ORDER BY mc.cliente_id,mc.created_at,mc.id`, where.values),
    pool.query(`SELECT COALESCE(s.fecha_efectiva,s.created_at) fecha,s.tipo,s.importe,s.motivo,
        s.solicitante_nombre solicitante,s.autorizador_nombre autorizador,
        s.contraparte_nombre contraparte,s.documento_folio documento
      FROM solicitudes_pago_dirigido s
      WHERE s.estado='APROBADA' AND s.created_at >= $1 AND s.created_at <= $2 ORDER BY s.created_at DESC`,
      [ctx.range.desde, ctx.range.hasta]),
    pool.query<{ id: number }>(
      `SELECT id FROM clientes
       WHERE activo AND NOT es_sistema
         AND ($1::int[] IS NULL OR id=ANY($1::int[]))
       ORDER BY id`,
      [selectedClientIds.length ? selectedClientIds : null],
    ),
  ]);
  const current = new Map<number, number>(); const prior = new Map<number, number>();
  clientRows.rows.forEach((r) => current.set(number(r.id), number(r.tickets)));
  const previousRows = await pool.query(`SELECT t.cliente_id,COUNT(DISTINCT t.id)::int tickets FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id WHERE ${previous.text} GROUP BY t.cliente_id`, previous.values);
  previousRows.rows.forEach((r) => prior.set(number(r.cliente_id), number(r.tickets)));
  const clientTable = clientRows.rows.map((r): Row => ({ cliente:r.nombre, tickets:number(r.tickets), ventas:number(r.ventas), comprasRollos:number(r.ventas_rollos), comprasMetraje:number(r.ventas_metraje), utilidad:r.utilidad == null ? null : number(r.utilidad), ticketPromedio:number(r.tickets) ? number(r.ventas)/number(r.tickets) : 0, frecuencia:number(r.tickets), ultimaCompra:r.ultima ? new Date(r.ultima).toISOString() : null, riesgo: riskFromFrequency(number(r.tickets), prior.get(number(r.id)) ?? 0) }));
  const totalSales = number(summary.rows[0]?.ventas); const tickets = number(summary.rows[0]?.tickets);
  const now = new Date().toISOString().slice(0, 10);
  const projections = await loadCustomerCreditProjections(
    creditCustomers.rows.map((row) => Number(row.id)),
  );
  const aged: Row[] = [...projections].flatMap(([clienteId, projection]) => projection.charges
    .map((charge) => {
      const bucket = agingBucket(charge.dueAt, now);
      return { clienteId, fechaVencimiento:charge.dueAt, saldo:charge.pendienteCents / 100, cubeta:bucket,
        vencida:["1-30","31-60","61-90","91+"].includes(bucket), notas:charge.notas };
    }));
  const firstPurchases = await pool.query(`SELECT DISTINCT t.cliente_id FROM tickets t WHERE ${where.text}
    AND NOT EXISTS (SELECT 1 FROM tickets prior_ticket WHERE prior_ticket.cliente_id=t.cliente_id AND ${accountedDocumentPredicate("prior_ticket")} AND prior_ticket.created_at<$1)`, where.values);
  const newClients = firstPurchases.rows.length;
  return { kpis: [{ id:"ventas-clientes",label:"Ventas",value:totalSales,kind:"money",economic:true },{ id:"utilidad-clientes",label:"Utilidad exacta",value:summary.rows[0]?.utilidad == null ? null : number(summary.rows[0].utilidad),kind:"money",economic:true},{id:"ticket-promedio",label:"Ticket promedio",value:tickets ? totalSales/tickets : 0,kind:"money",economic:true},{id:"clientes-nuevos",label:"Clientes nuevos",value:newClients,kind:"count"}],
    charts: [{ id:"clientes-top",title:"Ventas por cliente",type:"bar",categoryKey:"cliente",series:[{key:"ventas",label:"Ventas",kind:"money",economic:true}],rows:clientTable }],
    tables: [table("clientes","Clientes", [["cliente","Cliente","text"],["tickets","Tickets","count"],["ventas","Ventas","money",true],["comprasRollos","Compras ROLLOS","money",true],["comprasMetraje","Compras METRAJE","money",true],["utilidad","Utilidad exacta","money",true],["ticketPromedio","Ticket promedio","money",true],["frecuencia","Frecuencia","count"],["ultimaCompra","Última compra","text"],["riesgo","Riesgo","text"]],clientTable,["ventas","comprasRollos","comprasMetraje","utilidad"]), table("publico-registrado","Público vs registrado",[["tipo","Tipo","text"],["tickets","Tickets","count"],["ventas","Ventas","money",true]],publicRows.rows.map((r):Row=>({tipo:r.es_sistema?"Público":"Registrado",tickets:number(r.tickets),ventas:number(r.ventas)})),["ventas"]),table("formas-pago","Métodos de pago por modalidad",[["formaPago","Forma de pago","text"],["modalidad","Modalidad","text"],["operaciones","Operaciones","count"],["importe","Cobro asignado por subtotal","money",true]],payments.rows.map((r):Row=>({formaPago:r.forma_pago,modalidad:r.tipo==="NORMAL"?"ROLLOS":"METRAJE",operaciones:number(r.operaciones),importe:number(r.importe)})),["importe"]),table("cuentas-por-cobrar-fifo","Cuentas por cobrar FIFO",[["clienteId","Cliente","count"],["fechaVencimiento","Vencimiento","text"],["saldo","Saldo","money",true],["cubeta","Antigüedad","text"],["vencida","Vencida","boolean"],["notas","Notas","text"]],aged,["saldo"]), table("pagos-dirigidos","Pagos dirigidos",[["fecha","Fecha","text"],["tipo","Tipo","text"],["clienteProveedor","Cliente / proveedor","text"],["documento","Nota / compra","text"],["importe","Monto","money",true],["motivo","Motivo","text"],["solicitante","Solicitante","text"],["autorizador","Autorizador","text"]],directedPayments.rows.map((r):Row=>({fecha:new Date(r.fecha).toISOString(),tipo:r.tipo,clienteProveedor:r.contraparte,documento:r.documento,importe:number(r.importe),motivo:r.motivo,solicitante:r.solicitante,autorizador:r.autorizador ?? ""})),["importe"]), table("castigos-y-reversos","Castigos y reversos de crédito",[["clienteId","Cliente","count"],["tipo","Tipo","text"],["importe","Importe","money",true],["notas","Notas","text"],["fecha","Fecha","text"]],credit.rows.filter((r) => r.es_incobrable || r.tipo === "REVERSO").map((r): Row => ({clienteId:number(r.cliente_id),tipo:r.es_incobrable ? "INCOBRABLE" : r.tipo,importe:number(r.importe),notas:r.notas ?? null,fecha:new Date(r.created_at).toISOString()})),["importe"])], warnings:["Las compras de cada cliente se separan por ROLLOS y METRAJE y respetan el filtro de modalidad en el servidor.", "Los filtros de producto, tela, color, unidad y proveedor seleccionan tickets que contienen al menos una línea coincidente. Ventas y utilidad aplican además el corte de modalidad a sus líneas; los pagos de tickets mixtos se asignan proporcionalmente por subtotal de línea. El crédito conserva el ticket completo para no alterar su semántica financiera.", "Las cuentas por cobrar son una foto global de la proyección autorizada y no cambian por periodo, ubicación, producto o modalidad; únicamente respetan una selección explícita de clientes."] };
}

export async function buildCommercialReport(section: "compras" | "clientes", ctx: DomainReportContext): Promise<CommercialReport> {
  return section === "compras" ? purchases(ctx) : clients(ctx);
}