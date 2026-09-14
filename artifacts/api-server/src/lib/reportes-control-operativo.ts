import { pool } from "@workspace/db";
import {
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
      ...(kind === "link" ? { hrefKey: key } : {}),
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

const mexicoDate = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

function scopedReportQuery(
  ctx: DomainReportContext,
  locationId?: number | null,
): string {
  const params = new URLSearchParams({
    desde: typeof ctx.input.desde === "string"
      ? ctx.input.desde
      : mexicoDate(ctx.range.desde),
    hasta: typeof ctx.input.hasta === "string"
      ? ctx.input.hasta
      : mexicoDate(ctx.range.hasta),
  });
  const scopedLocationId = locationId ?? (ctx.locations?.length === 1
    ? ctx.locations[0]
    : undefined);
  if (scopedLocationId != null) params.set("ubicacionId", String(scopedLocationId));
  return params.toString();
}

function analyticsFilters(
  ctx: DomainReportContext,
  ubicacionId?: number,
): AnalyticsFilters {
  return {
    desde: ctx.range.desde,
    hasta: ctx.range.hasta,
    ...(ubicacionId === undefined ? {} : { ubicacionId }),
  };
}

type DestinationMovements = Awaited<
  ReturnType<typeof listDestinationAccountMovements>
>;

const DESTINATION_PAGE_SIZE = 1_000;

function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

function percentageChange(current: number, previous: number): string | null {
  if (previous === 0) return current === 0 ? money(0) : null;
  return money(((current - previous) / previous) * 100);
}

/**
 * Read incongruent abonos through the canonical destination query without
 * collapsing an authorized multi-site scope into `ubicacionId = undefined`.
 *
 * The source endpoint is deliberately called once per authorized site.  Each
 * call retains the endpoint's date/source filters and aggregate counts.  The
 * page loop is required because the control table is an all-rows signal and
 * must not silently discard rows at an arbitrary page-size boundary.
 */
export async function loadIncongruentDestinationMovements(
  ctx: DomainReportContext,
  read: typeof listDestinationAccountMovements = listDestinationAccountMovements,
): Promise<DestinationMovements> {
  const locationIds = [...new Set(reportLocationIds(ctx))];
  const siteFilters = locationIds.length > 1
    ? locationIds.map((ubicacionId) => analyticsFilters(ctx, ubicacionId))
    : [analyticsFilters(ctx, locationIds[0])];

  const readAllPages = async (
    filters: AnalyticsFilters,
  ): Promise<DestinationMovements> => {
    const first = await read(filters, "TODAS", 1, DESTINATION_PAGE_SIZE, {
      incongruente: true,
    });
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page += 1) {
      const next = await read(filters, "TODAS", page, DESTINATION_PAGE_SIZE, {
        incongruente: true,
      });
      items.push(...next.items);
      if (next.items.length === 0) break;
    }
    if (items.length !== first.total) {
      throw new Error(
        `No se pudieron leer todos los abonos incongruentes del sitio (${items.length}/${first.total}).`,
      );
    }
    return { ...first, items, page: 1, pageSize: DESTINATION_PAGE_SIZE };
  };

  const reports = await Promise.all(siteFilters.map(readAllPages));
  if (reports.length === 1) return reports[0]!;

  const items = reports
    .flatMap((report) => report.items)
    .sort((left, right) => {
      const byDate = new Date(right.fecha).getTime() - new Date(left.fecha).getTime();
      return byDate || right.id - left.id;
    });
  const total = reports.reduce((sum, report) => sum + report.total, 0);
  const montoTotal = reports.reduce((sum, report) => sum + Number(report.montoTotal), 0);
  const montoTotalAnterior = reports.reduce(
    (sum, report) => sum + Number(report.montoTotalAnterior),
    0,
  );
  if (items.length !== total) {
    throw new Error(
      `La lectura multi-sitio de abonos incongruentes no está completa (${items.length}/${total}).`,
    );
  }
  return {
    ...reports[0]!,
    items,
    total,
    page: 1,
    pageSize: DESTINATION_PAGE_SIZE,
    montoTotal: money(montoTotal),
    montoTotalAnterior: money(montoTotalAnterior),
    variacionPorcentaje: percentageChange(montoTotal, montoTotalAnterior),
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
    documentoHref: `/inventario/ajustes?movementId=${Number(row.movimientoId)}`,
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
    documentoHref: `/inventario/rollos/${Number(row.rolloId)}`,
  }));
}

export async function buildControlOperativoReport(
  ctx: DomainReportContext,
  dependencies: Partial<{
    loadCancellationRows: typeof loadCancellationRows;
    loadCancelledExits: typeof loadCancelledExits;
    loadOverdueSalidaRows: typeof loadOverdueSalidaRows;
    loadInventoryAdjustments: typeof loadInventoryAdjustments;
    loadLabelReprints: typeof loadLabelReprints;
    listDestinationAccountMovements: typeof listDestinationAccountMovements;
  }> = {},
): Promise<{ kpis: unknown[]; charts: unknown[]; tables: unknown[]; warnings: string[] }> {
  const locationIds = reportLocationIds(ctx);
  const cancelledExitReader = dependencies.loadCancelledExits ?? loadCancelledExits;
  const overdueReader = dependencies.loadOverdueSalidaRows ?? loadOverdueSalidaRows;
  const adjustmentReader = dependencies.loadInventoryAdjustments ?? loadInventoryAdjustments;
  const reprintReader = dependencies.loadLabelReprints ?? loadLabelReprints;
  const [cancellations, cancelledExits, overdueExits, adjustments, reprints, incongruent] =
    await Promise.all([
      dependencies.loadCancellationRows
        ? dependencies.loadCancellationRows(ctx)
        : loadCancellationRows(ctx),
      cancelledExitReader(ctx),
      overdueReader({
        desde: ctx.range.desde,
        hasta: ctx.range.hasta,
        ubicacionIds: locationIds,
      }),
      adjustmentReader(ctx),
      reprintReader(ctx),
      loadIncongruentDestinationMovements(
        ctx,
        dependencies.listDestinationAccountMovements ?? listDestinationAccountMovements,
      ),
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
  const incongruentRows: ReportRow[] = incongruent.items.map((row) => {
    // The destination read model's id is the canonical movement identity.
    // documentoId identifies the source document only; these values can
    // legitimately differ and Number() would destroy opaque movement IDs.
    const movementId = String(row.id);
    const destination = row.cuentaDestino === "CUENTA_FISCAL"
      ? "CUENTA_FISCAL"
      : "CUENTA_NO_FISCAL";
    const query = new URLSearchParams(scopedReportQuery(ctx, row.ubicacionId));
    query.set("incongruente", "true");
    query.set("movimientoId", movementId);
    return {
      movimientoId: movementId,
      fecha: new Date(row.fecha).toISOString(),
      documento: String(row.documento),
      documentoTipo: String(row.documentoTipo),
      clienteId: row.clienteId == null ? null : Number(row.clienteId),
      cliente: row.cliente == null ? null : String(row.cliente),
      sitio: String(row.sitio),
      cuentaDestino: String(row.cuentaDestino),
      importe: number(row.monto),
      fuente: String(row.fuente),
      documentoHref: `/caja/cuentas-destino/${destination}?${query.toString()}`,
    };
  });
  const cancelledTicketCount = new Set(
    cancellations.rows.map((row) => row.ticketId),
  ).size;

  return {
    kpis: [
      kpi("ajustes-inventario", "Ajustes de inventario", adjustments.length, "count"),
      kpi("salidas-canceladas", "Salidas canceladas", cancelledExits.length, "count"),
      kpi("salidas-vencidas", "Salidas pendientes después de 24 horas", overdueRows.length, "count"),
      kpi("abonos-incongruentes", "Abonos con cuenta destino incongruente", incongruent.total, "count"),
      kpi("reimpresiones-etiqueta", "Rollos con tres o más reimpresiones", reprints.length, "count"),
      kpi("tickets-cancelados", "Tickets cancelados", cancelledTicketCount, "count"),
      kpi("importe-tickets-cancelados", "Subtotal cancelado", cancellations.rows.reduce((sum, row) => sum + row.importe, 0), "money", true),
    ],
    charts: [],
    tables: [
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
      ], reprints),
    ],
    warnings: [
      "Las salidas vencidas usan la condición administrativa existente: exactamente 24 horas todavía no vence.",
    ],
  };
}