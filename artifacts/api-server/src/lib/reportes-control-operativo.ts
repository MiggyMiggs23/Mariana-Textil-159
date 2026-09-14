import { pool } from "@workspace/db";
import {
  getDifferences,
  listDestinationAccountMovements,
  type AnalyticsFilters,
} from "./admin-analytics";
import { loadOverdueSalidaRows } from "./admin-alertas";
import {
  loadCancellationRows,
  type DomainReportContext,
} from "./reportes-sales";

type Primitive = string | number | boolean | null;
type ReportRow = Record<string, Primitive>;
type Column = [string, string, string, boolean?] | Record<string, unknown>;

const number = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const ids = (value: unknown): number[] =>
  typeof value === "string"
    ? value.split(",").map(Number).filter(Number.isInteger)
    : Array.isArray(value)
      ? value.map(Number).filter(Number.isInteger)
      : [];

const columns = (items: Column[]) =>
  items.map((item) => {
    if (!Array.isArray(item)) return item;
    const [key, label, kind, economic] = item;
    return {
      key,
      label,
      kind,
      ...(economic ? { economic: true } : {}),
    };
  });

function table(
  id: string,
  title: string,
  definition: Column[],
  rows: ReportRow[],
  totals: Record<string, Primitive> = {},
) {
  return { id, title, columns: columns(definition), rows, totals };
}

function kpi(
  id: string,
  label: string,
  value: Primitive,
  kind: "count" | "quantity" | "money",
  economic = false,
) {
  return { id, label, value, kind, ...(economic ? { economic: true } : {}) };
}

function reportLocationIds(ctx: DomainReportContext): number[] {
  return ctx.locations?.length ? ctx.locations : ids(ctx.input.ubicacionIds);
}

function analyticsFilters(ctx: DomainReportContext): AnalyticsFilters {
  const locationIds = reportLocationIds(ctx);
  return {
    desde: ctx.range.desde,
    hasta: ctx.range.hasta,
    // The existing cash read model accepts a concrete site.  The report
    // header has one site selector; an omitted or multi-site filter remains
    // global, exactly as the existing aggregate endpoint does.
    ubicacionId: locationIds.length === 1 ? locationIds[0] : undefined,
  };
}

async function loadCancelledExits(ctx: DomainReportContext): Promise<ReportRow[]> {
  const locationIds = reportLocationIds(ctx);
  const result = await pool.query(
    `SELECT s.id "salidaId",s.folio,s.cancelada_at "canceladaAt",
        s.motivo_cancelacion "motivoCancelacion",
        s.origen_id "origenId",origen.nombre origen,
        s.destino_id "destinoId",destino.nombre destino,
        s.cliente_id "clienteId",cliente.nombre cliente,
        s.ticket_id "ticketId",t.folio "ticketFolio"
       FROM salidas s
       JOIN ubicaciones origen ON origen.id=s.origen_id
       LEFT JOIN ubicaciones destino ON destino.id=s.destino_id
       LEFT JOIN clientes cliente ON cliente.id=s.cliente_id
       LEFT JOIN tickets t ON t.id=s.ticket_id
      WHERE s.estado='CANCELADA'
        AND s.cancelada_at >= $1 AND s.cancelada_at <= $2
        AND ($3::int[] IS NULL OR s.origen_id=ANY($3::int[]))
      ORDER BY s.cancelada_at DESC,s.id DESC`,
    [
      ctx.range.desde,
      ctx.range.hasta,
      locationIds.length ? locationIds : null,
    ],
  );
  return result.rows.map((row) => ({
    salidaId: Number(row.salidaId),
    folio: Number(row.folio),
    canceladaAt: row.canceladaAt == null
      ? null
      : new Date(row.canceladaAt).toISOString(),
    motivoCancelacion: row.motivoCancelacion == null
      ? null
      : String(row.motivoCancelacion),
    origenId: Number(row.origenId),
    origen: String(row.origen),
    destinoId: row.destinoId == null ? null : Number(row.destinoId),
    destino: row.destino == null ? null : String(row.destino),
    clienteId: row.clienteId == null ? null : Number(row.clienteId),
    cliente: row.cliente == null ? null : String(row.cliente),
    ticketId: row.ticketId == null ? null : Number(row.ticketId),
    ticketFolio: row.ticketFolio == null ? null : Number(row.ticketFolio),
    salidaHref: `/salidas/${Number(row.salidaId)}`,
    ticketHref: row.ticketId == null ? null : `/tickets/${Number(row.ticketId)}`,
    documentoHref: `/salidas/${Number(row.salidaId)}`,
  }));
}

async function loadInventoryAdjustments(
  ctx: DomainReportContext,
): Promise<ReportRow[]> {
  const locationIds = reportLocationIds(ctx);
  const result = await pool.query(
    `SELECT m.id "movimientoId",m.created_at "fecha",m.tipo,
        m.motivo_salida_extraordinaria "motivo",
        m.cantidad::float cantidad,m.saldo_posterior::float "saldoPosterior",
        m.movimiento_origen_id "movimientoOrigenId",
        p.id "productoId",p.sku,p.tela,p.color,p.unidad,
        r.id "rolloId",r.serie,u.id "ubicacionId",u.nombre sitio
       FROM movimientos m
       JOIN productos p ON p.id=m.producto_id
       LEFT JOIN rollos r ON r.id=m.rollo_id
       JOIN ubicaciones u ON u.id=m.ubicacion_id
      WHERE m.created_at >= $1 AND m.created_at <= $2
        AND m.tipo IN ('AJUSTE_POSITIVO','AJUSTE_NEGATIVO','CANCELACION')
        AND ($3::int[] IS NULL OR m.ubicacion_id=ANY($3::int[]))
      ORDER BY m.created_at DESC,m.id DESC`,
    [
      ctx.range.desde,
      ctx.range.hasta,
      locationIds.length ? locationIds : null,
    ],
  );
  return result.rows.map((row) => ({
    movimientoId: Number(row.movimientoId),
    fecha: new Date(row.fecha).toISOString(),
    tipo: String(row.tipo),
    motivo: row.motivo == null ? null : String(row.motivo),
    cantidad: number(row.cantidad),
    saldoPosterior: row.saldoPosterior == null ? null : number(row.saldoPosterior),
    movimientoOrigenId: row.movimientoOrigenId == null
      ? null
      : Number(row.movimientoOrigenId),
    productoId: Number(row.productoId),
    sku: String(row.sku),
    tela: String(row.tela),
    color: String(row.color),
    unidad: String(row.unidad),
    rolloId: row.rolloId == null ? null : Number(row.rolloId),
    serie: row.serie == null ? null : String(row.serie),
    ubicacionId: Number(row.ubicacionId),
    sitio: String(row.sitio),
    rolloHref: row.rolloId == null ? null : `/inventario/rollos/${Number(row.rolloId)}`,
    documentoHref: row.rolloId == null
      ? null
      : `/inventario/rollos/${Number(row.rolloId)}`,
  }));
}

async function loadLabelReprints(ctx: DomainReportContext): Promise<ReportRow[]> {
  const locationIds = reportLocationIds(ctx);
  const result = await pool.query(
    `SELECT re.rollo_id "rolloId",
        COALESCE(MAX(re.serie_snapshot),r.serie) serie,
        COALESCE(MAX(re.sku_snapshot),p.sku) sku,
        COALESCE(MAX(re.producto_snapshot),p.tela || ' ' || p.color) producto,
        COALESCE(MAX(re.tela_snapshot),p.tela) tela,
        COALESCE(MAX(re.color_snapshot),p.color) color,
        COALESCE(MAX(re.sitio_nombre_snapshot),u.nombre) sitio,
        COUNT(*)::int reimpresiones,MAX(re.created_at) "ultimaReimpresionAt"
       FROM reimpresiones_etiqueta re
       JOIN rollos r ON r.id=re.rollo_id
       JOIN productos p ON p.id=r.producto_id
       JOIN ubicaciones u ON u.id=re.sitio_id
      WHERE re.created_at >= $1 AND re.created_at <= $2
        AND ($3::int[] IS NULL OR re.sitio_id=ANY($3::int[]))
      GROUP BY re.rollo_id,r.serie,p.sku,p.tela,p.color,u.nombre
      HAVING COUNT(*) >= 3
      ORDER BY reimpresiones DESC,"ultimaReimpresionAt" DESC,re.rollo_id`,
    [
      ctx.range.desde,
      ctx.range.hasta,
      locationIds.length ? locationIds : null,
    ],
  );
  return result.rows.map((row) => ({
    rolloId: Number(row.rolloId),
    serie: String(row.serie),
    sku: String(row.sku),
    producto: String(row.producto),
    tela: String(row.tela),
    color: String(row.color),
    sitio: String(row.sitio),
    reimpresiones: Number(row.reimpresiones),
    ultimaReimpresionAt: new Date(row.ultimaReimpresionAt).toISOString(),
    rolloHref: `/inventario/rollos/${Number(row.rolloId)}`,
    historialHref: `/etiquetas/rollos/${Number(row.rolloId)}`,
    documentoHref: `/inventario/rollos/${Number(row.rolloId)}`,
  }));
}

export async function buildControlOperativoReport(
  ctx: DomainReportContext,
): Promise<{ kpis: unknown[]; charts: unknown[]; tables: unknown[]; warnings: string[] }> {
  const filters = analyticsFilters(ctx);
  const locationIds = reportLocationIds(ctx);
  const [cash, cancellations, cancelledExits, overdueExits, adjustments, reprints, incongruent] =
    await Promise.all([
      getDifferences(filters),
      loadCancellationRows(ctx),
      loadCancelledExits(ctx),
      loadOverdueSalidaRows({
        desde: ctx.range.desde,
        hasta: ctx.range.hasta,
        ubicacionIds: locationIds,
      }),
      loadInventoryAdjustments(ctx),
      loadLabelReprints(ctx),
      listDestinationAccountMovements(filters, "TODAS", 1, 10_000, {
        incongruente: true,
      }),
    ]);

  const overdueRows: ReportRow[] = overdueExits.map((row) => ({
    salidaId: Number(row.id),
    folio: Number(row.folio),
    enviadaAt: row.enviadaAt == null ? null : new Date(row.enviadaAt).toISOString(),
    horasEnTransito: number(row.horasEnTransito),
    origenId: Number(row.origenId),
    origen: String(row.nombreOrigen),
    destinoId: row.destinoId == null ? null : Number(row.destinoId),
    destino: row.nombreDestino == null ? null : String(row.nombreDestino),
    ticketId: row.ticketId == null ? null : Number(row.ticketId),
    ticketFolio: row.ticketFolio == null ? null : Number(row.ticketFolio),
    salidaFolio: row.salidaFolio == null ? null : Number(row.salidaFolio),
    salidaHref: String(row.salidaHref),
    ticketHref: row.ticketHref == null ? null : String(row.ticketHref),
    documentoHref: String(row.salidaHref),
  }));
  const incongruentRows: ReportRow[] = incongruent.items.map((row) => ({
    movimientoId: Number(row.documentoId),
    fecha: new Date(row.fecha).toISOString(),
    documento: String(row.documento),
    documentoTipo: String(row.documentoTipo),
    clienteId: row.clienteId == null ? null : Number(row.clienteId),
    cliente: row.cliente == null ? null : String(row.cliente),
    sitio: String(row.sitio),
    cuentaDestino: String(row.cuentaDestino),
    importe: number(row.monto),
    fuente: String(row.fuente),
    documentoHref: row.clienteId == null
      ? null
      : `/clientes/${Number(row.clienteId)}?tab=estado&movimientoId=${Number(row.documentoId)}`,
  }));
  const cancelledTicketCount = new Set(
    cancellations.rows.map((row) => row.ticketId),
  ).size;

  const cashColumns: Column[] = [
    ["id", "Identidad", "count"],
    ["nombre", "Nombre", "text"],
    ["cortes", "Cortes", "count"],
    ["exactos", "Cortes exactos", "count"],
    ["faltantes", "Faltantes", "count"],
    ["sobrantes", "Sobrantes", "count"],
    ["importeFaltantes", "Importe faltantes", "money", true],
    ["importeSobrantes", "Importe sobrantes", "money", true],
    ["diferenciaNeta", "Diferencia neta", "money", true],
    ["diferenciaAbsoluta", "Diferencia absoluta", "money", true],
    ["promedio", "Promedio", "money", true],
    ["porcentajeExactos", "% exactos", "percentage"],
  ];
  const cashRows = cash.porCajero.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    cortes: row.cortes,
    exactos: row.exactos,
    faltantes: row.faltantes,
    sobrantes: row.sobrantes,
    importeFaltantes: row.importeFaltantes,
    importeSobrantes: row.importeSobrantes,
    diferenciaNeta: row.diferenciaNeta,
    diferenciaAbsoluta: row.diferenciaAbsoluta,
    promedio: row.promedio,
    porcentajeExactos: row.porcentajeExactos,
  }));
  const cashStoreRows = cash.porTienda.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    cortes: row.cortes,
    exactos: row.exactos,
    faltantes: row.faltantes,
    sobrantes: row.sobrantes,
    importeFaltantes: row.importeFaltantes,
    importeSobrantes: row.importeSobrantes,
    diferenciaNeta: row.diferenciaNeta,
    diferenciaAbsoluta: row.diferenciaAbsoluta,
    promedio: row.promedio,
    porcentajeExactos: row.porcentajeExactos,
  }));
  const cashTrendRows = cash.tendencia.map((row) => ({
    fecha: row.fecha,
    importe: row.importe,
    porcentajeExactos: row.porcentajeExactos,
  }));
  const cashAlertRows = cash.alertas.map((row) => ({
    sesionId: row.sesionId,
    tipo: row.tipo,
    mensaje: row.mensaje,
    importe: row.importe,
    corteHref: row.sesionId > 0 ? `/caja/cortes?sesionId=${row.sesionId}` : null,
  }));

  return {
    kpis: [
      kpi("cortes-caja", "Cortes de caja", cash.resumen.cortes, "count"),
      kpi("faltantes-caja", "Cortes con faltante", cash.resumen.faltantes, "count"),
      kpi("sobrantes-caja", "Cortes con sobrante", cash.resumen.sobrantes, "count"),
      kpi("ajustes-inventario", "Ajustes de inventario", adjustments.length, "count"),
      kpi("salidas-canceladas", "Salidas canceladas", cancelledExits.length, "count"),
      kpi("salidas-vencidas", "Salidas pendientes después de 24 horas", overdueRows.length, "count"),
      kpi("abonos-incongruentes", "Abonos con cuenta destino incongruente", incongruent.total, "count"),
      kpi("reimpresiones-etiqueta", "Rollos con tres o más reimpresiones", reprints.length, "count"),
      kpi("tickets-cancelados", "Tickets cancelados", cancelledTicketCount, "count"),
      kpi("importe-tickets-cancelados", "Subtotal cancelado", cancellations.rows.reduce((sum, row) => sum + row.importe, 0), "money", true),
    ],
    charts: [
      {
        id: "tendencia-diferencia-caja",
        title: "Tendencia de Diferencia Neta",
        type: "line",
        categoryKey: "fecha",
        series: [
          { key: "importe", label: "Diferencia neta", kind: "money", economic: true },
        ],
        rows: cashTrendRows,
      },
      {
        id: "exactitud-caja",
        title: "Porcentaje de Exactitud",
        type: "line",
        categoryKey: "fecha",
        series: [{ key: "porcentajeExactos", label: "% exactos", kind: "percentage" }],
        rows: cashTrendRows,
      },
    ],
    tables: [
      table("alertas-desencuadre", "Alertas de Descuadre Significativo", [
        ["sesionId", "Corte", "count"],
        ["tipo", "Tipo", "text"],
        ["mensaje", "Mensaje", "text"],
        ["importe", "Importe", "money", true],
        ["corteHref", "Corte", "link"],
      ], cashAlertRows),
      table("diferencias-cajero", "Diferencias por Cajero", cashColumns, cashRows),
      table("diferencias-tienda", "Diferencias por Tienda", cashColumns, cashStoreRows),
      table("ajustes-inventario", "Ajustes de inventario", [
        ["movimientoId", "Movimiento", "count"],
        ["fecha", "Fecha", "text"],
        ["tipo", "Tipo", "text"],
        ["motivo", "Motivo", "text"],
        ["sku", "SKU", "text"],
        ["tela", "Tela", "text"],
        ["color", "Color", "text"],
        ["unidad", "Unidad", "text"],
        ["cantidad", "Cantidad", "quantity"],
        ["saldoPosterior", "Saldo posterior", "quantity"],
        ["serie", "Rollo", "text"],
        ["sitio", "Sitio", "text"],
        ["documentoHref", "Documento", "link"],
      ], adjustments),
      table("salidas-canceladas", "Salidas canceladas", [
        ["salidaId", "Salida", "count"],
        ["folio", "Folio", "count"],
        ["canceladaAt", "Cancelada", "text"],
        ["motivoCancelacion", "Motivo", "text"],
        ["origen", "Origen", "text"],
        ["destino", "Destino", "text"],
        ["cliente", "Cliente", "text"],
        ["ticketFolio", "Ticket", "count"],
        ["documentoHref", "Documento", "link"],
      ], cancelledExits),
      table("salidas-vencidas", "Salidas autorizadas no entregadas después de 24 horas", [
        ["salidaId", "Salida", "count"],
        ["salidaFolio", "Folio salida", "count"],
        ["enviadaAt", "Reloj iniciado", "text"],
        ["horasEnTransito", "Horas", "count"],
        ["origen", "Origen", "text"],
        ["destino", "Destino", "text"],
        ["ticketFolio", "Ticket", "count"],
        ["documentoHref", "Documento", "link"],
        ["ticketHref", "Ticket", "link"],
      ], overdueRows),
      table("abonos-incongruentes", "Abonos con cuenta destino incongruente", [
        ["movimientoId", "Abono", "count"],
        ["fecha", "Fecha", "text"],
        ["documento", "Documento", "text"],
        ["cliente", "Cliente", "text"],
        ["sitio", "Sitio", "text"],
        ["cuentaDestino", "Cuenta destino", "text"],
        ["importe", "Importe", "money", true],
        ["documentoHref", "Documento", "link"],
      ], incongruentRows, { importe: Number(incongruent.montoTotal) }),
      table("cancelaciones-control", "Tickets cancelados", [
        ["ticketId", "Ticket", "count"],
        ["folio", "Folio", "text"],
        ["modalidad", "Modalidad", "text"],
        ["motivo", "Motivo", "text"],
        ["sitio", "Sitio", "text"],
        ["canceladoAt", "Cancelado", "text"],
        ["documentoHref", "Documento", "link"],
        ["importe", "Subtotal cancelado", "money", true],
      ], cancellations.rows, {
        importe: cancellations.rows.reduce((sum, row) => sum + row.importe, 0),
      }),
      table("reimpresiones-etiqueta", "Rollos con tres o más reimpresiones", [
        ["rolloId", "Rollo", "count"],
        ["serie", "Serie", "text"],
        ["sku", "SKU", "text"],
        ["producto", "Producto", "text"],
        ["sitio", "Sitio", "text"],
        ["reimpresiones", "Reimpresiones", "count"],
        ["ultimaReimpresionAt", "Última reimpresión", "text"],
        ["documentoHref", "Rollo", "link"],
        ["historialHref", "Historial", "link"],
      ], reprints),
    ],
    warnings: [
      "Las diferencias de caja se leen desde el componente existente de cortes y conservan sus umbrales.",
      "Las salidas vencidas usan la condición administrativa existente: exactamente 24 horas todavía no vence.",
    ],
  };
}