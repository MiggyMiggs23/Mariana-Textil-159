import { pool } from "@workspace/db";
import { accountedDocumentPredicate } from "./accounted-document";
import { parseMexicoDateQuery } from "./mexico-date";
import { buildCommercialReport } from "./reportes-commercial";
import { buildInventoryReport } from "./reportes-inventory";
import { buildSalesReport } from "./reportes-sales";

export const REPORT_SECTIONS = [
  "ventas",
  "utilidad",
  "inventario",
  "mapas-calor",
  "color",
  "compras",
  "clientes",
  "pagos-dirigidos",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];
export type Report = Record<string, unknown>;

export class ReportInputError extends Error {}

const TIME_ZONE = "America/Mexico_City";
const MIN_REPORT_DATE = new Date("1900-01-01T00:00:00.000Z");
const MAX_REPORT_DATE = new Date("2999-12-31T23:59:59.999Z");
const MAX_REPORT_RANGE_MS = 100 * 366 * 24 * 60 * 60 * 1000;
const ECONOMIC_TEXT = /costo|margen|utilidad|ganancia|venta|importe|precio|capital|ahorro|saldo|cobrar|valor|pago|credito|balance|moneda|facturado|subtotal|amount|revenue/i;

/**
 * Non-economic roles may submit the full report query schema, but financial
 * controls are not part of their report domain. Remove them before builders
 * see the input, so they cannot alter an operational export or be serialized
 * in its filter metadata.
 */
export function omitEconomicReportFilters(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => key === "modalidad" || !ECONOMIC_TEXT.test(key)),
  );
}

export function parseReportBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ReportInputError("El filtro facturado debe ser true o false.");
}

function localDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function reportRange(input: Record<string, unknown>) {
  const period = String(input.periodo ?? "mensual");
  const today = localDate();
  let desdeText = typeof input.desde === "string" ? input.desde : undefined;
  let hastaText = typeof input.hasta === "string" ? input.hasta : undefined;

  if (period === "personalizado" && (!desdeText || !hastaText)) {
    throw new ReportInputError("El periodo personalizado requiere desde y hasta.");
  }

  if (!desdeText || !hastaText) {
    const base = new Date(`${today}T12:00:00Z`);
    const month = base.getUTCMonth();
    const start = new Date(Date.UTC(base.getUTCFullYear(), month, 1));
    if (period === "diario") start.setUTCDate(base.getUTCDate());
    if (period === "semanal") start.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
    if (period === "trimestral") start.setUTCMonth(month - (month % 3));
    if (period === "semestral") start.setUTCMonth(month - (month % 6));
    if (period === "anual") start.setUTCMonth(0);
    desdeText ??= start.toISOString().slice(0, 10);
    hastaText ??= today;
  }

  const desde = parseMexicoDateQuery(desdeText, "start");
  const hasta = parseMexicoDateQuery(hastaText, "end");
  if (!desde || !hasta || desde > hasta) {
    throw new ReportInputError("Rango de fechas inválido.");
  }

  const duration = hasta.getTime() - desde.getTime() + 1;
  if (desde < MIN_REPORT_DATE || hasta > MAX_REPORT_DATE || duration > MAX_REPORT_RANGE_MS) {
    throw new ReportInputError("El rango debe estar entre 1900 y 2999 y no exceder 100 años.");
  }
  const previousHasta = new Date(desde.getTime() - 1);
  const previousDesde = new Date(previousHasta.getTime() - duration + 1);
  const yearAgoDesde = new Date(desde);
  const yearAgoHasta = new Date(hasta);
  yearAgoDesde.setUTCFullYear(yearAgoDesde.getUTCFullYear() - 1);
  yearAgoHasta.setUTCFullYear(yearAgoHasta.getUTCFullYear() - 1);

  return { period, desde, hasta, previousDesde, previousHasta, yearAgoDesde, yearAgoHasta };
}

export function redactEconomic(report: Report): Report {
  const REDACTED = Symbol("redacted economic value");
  const scrub = (value: unknown, inheritedHidden = new Set<string>()): unknown => {
    if (Array.isArray(value)) {
      return value
        .map((item) => scrub(item, inheritedHidden))
        .filter((item) => item !== REDACTED);
    }
    if (!value || typeof value !== "object") return value;

    const source = value as Record<string, unknown>;
    // Economic annotations are authorization boundaries, not presentation hints.
    // Remove the complete descriptor/row/KPI even if a future field has a name
    // that is not covered by the conservative key matcher below.
    if (source.economic === true) return REDACTED;
    const columns = Array.isArray(source.columns)
      ? (source.columns as Array<Record<string, unknown>>)
      : [];
    const series = Array.isArray(source.series)
      ? (source.series as Array<Record<string, unknown>>)
      : [];
    const hidden = new Set(inheritedHidden);
    for (const item of columns) if (item.economic === true) hidden.add(String(item.key));
    for (const item of series) if (item.economic === true) hidden.add(String(item.key));

    const clean: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (key === "economic" || hidden.has(key) || ECONOMIC_TEXT.test(key)) {
        continue;
      }
      if (key === "columns") {
        clean[key] = columns
          .filter(
            (item) =>
              item.economic !== true &&
              !ECONOMIC_TEXT.test(String(item.key ?? "")) &&
              !ECONOMIC_TEXT.test(String(item.label ?? "")),
          )
          .map((item) => scrub(item, hidden));
      } else if (key === "series") {
        clean[key] = series
          .filter(
            (item) =>
              item.economic !== true &&
              !ECONOMIC_TEXT.test(String(item.key ?? "")) &&
              !ECONOMIC_TEXT.test(String(item.label ?? "")),
          )
          .map((item) => scrub(item, hidden));
      } else {
        const cleanedChild = scrub(child, hidden);
        if (cleanedChild !== REDACTED) clean[key] = cleanedChild;
      }
    }
    return clean;
  };

  return scrub(report) as Report;
}

export async function buildReport(
  section: ReportSection,
  input: Record<string, unknown>,
  locations: number[] | undefined,
  economic: boolean,
): Promise<Report> {
  const reportInput = economic ? input : omitEconomicReportFilters(input);
  const range = reportRange(reportInput);
  const context = { input: reportInput, locations, range };
  const content = section === "pagos-dirigidos"
    ? await buildDirectedPaymentsReport(context)
    : section === "ventas" || section === "utilidad"
    ? await buildSalesReport(section, context)
    : section === "inventario" || section === "mapas-calor" || section === "color"
      ? await buildInventoryReport(section, context)
      : await buildCommercialReport(section, context);
  const activeFilters = Object.entries(reportInput)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`);

  const report: Report = {
    section,
    generatedAt: new Date().toISOString(),
    hasEconomicAccess: economic,
    range: {
      desde: range.desde.toISOString(),
      hasta: range.hasta.toISOString(),
      previousDesde: range.previousDesde.toISOString(),
      previousHasta: range.previousHasta.toISOString(),
      yearAgoDesde: range.yearAgoDesde.toISOString(),
      yearAgoHasta: range.yearAgoHasta.toISOString(),
    },
    activeFilters,
    ...content,
  };
  return economic ? report : redactEconomic(report);
}

async function buildDirectedPaymentsReport(context: { input: Record<string, unknown>; locations?: number[]; range: ReturnType<typeof reportRange> }) {
  const requested = typeof context.input.ubicacionIds === "string"
    ? context.input.ubicacionIds.split(",").map(Number).filter(Number.isInteger) : [];
  const locations = context.locations?.length ? context.locations : requested;
  const result = await pool.query(`SELECT COALESCE(s.resuelta_at,s.created_at) fecha,
      COALESCE(s.ubicacion_nombre,u.nombre,'Sin sitio') sitio,s.tipo,
      s.contraparte_nombre contraparte,s.documento_folio documento,s.importe,s.motivo,
      s.solicitante_nombre solicitante,COALESCE(s.autorizador_nombre,'') autorizador,s.estado
    FROM solicitudes_pago_dirigido s LEFT JOIN ubicaciones u ON u.id=s.ubicacion_id
    WHERE s.estado IN ('APROBADA','RECHAZADA')
      AND COALESCE(s.resuelta_at,s.created_at) >= $1 AND COALESCE(s.resuelta_at,s.created_at) <= $2
      AND ($3::int[] IS NULL OR s.ubicacion_id=ANY($3::int[]))
    ORDER BY COALESCE(s.resuelta_at,s.created_at) DESC,s.id DESC`,
    [context.range.desde, context.range.hasta, locations.length ? locations : null]);
  const rows = result.rows.map((row) => ({
    fecha: new Date(row.fecha).toISOString(), sitio: row.sitio, tipo: row.tipo,
    contraparte: row.contraparte, documento: row.documento, importe: Number(row.importe),
    motivo: row.motivo, solicitante: row.solicitante, autorizador: row.autorizador, estado: row.estado,
  }));
  return {
    kpis: [{ id: "solicitudes", label: "Solicitudes resueltas", value: rows.length, kind: "count" }],
    charts: [],
    tables: [{ id: "pagos-dirigidos", title: "Pagos dirigidos resueltos", columns: [
      { key: "fecha", label: "Fecha", kind: "text" }, { key: "sitio", label: "Sitio", kind: "text" },
      { key: "tipo", label: "Tipo", kind: "text" }, { key: "contraparte", label: "Cliente / proveedor", kind: "text" },
      { key: "documento", label: "Documento", kind: "text" }, { key: "importe", label: "Monto", kind: "money", economic: true },
      { key: "motivo", label: "Motivo", kind: "text" }, { key: "solicitante", label: "Solicitante", kind: "text" },
      { key: "autorizador", label: "Autorizador", kind: "text" }, { key: "estado", label: "Estado", kind: "text" },
    ], rows, totals: { importe: rows.reduce((sum, row) => sum + row.importe, 0) } }],
    warnings: ["Incluye únicamente solicitudes aprobadas o rechazadas; las pendientes se atienden desde notificaciones."],
  };
}

export async function getCatalogs(locations?: number[], economic = true) {
  const scope = locations?.length ? " WHERE ubicacion_id=ANY($1::int[])" : "";
  const values = locations?.length ? [locations] : [];
  const [sites, products, users, clients, suppliers, fabrics, colors, units] = await Promise.all([
    pool.query(
      `SELECT id,nombre label FROM ubicaciones${locations?.length ? " WHERE id=ANY($1::int[])" : ""} ORDER BY nombre`,
      values,
    ),
    pool.query(
      `SELECT DISTINCT p.id,(p.sku||' — '||p.tela||' '||p.color) label
       FROM productos p LEFT JOIN rollos r ON r.producto_id=p.id${scope} ORDER BY label`,
      values,
    ),
    pool.query(
      `SELECT id,nombre label FROM usuarios WHERE activo${locations?.length ? " AND ubicacion_id=ANY($1::int[])" : ""} ORDER BY nombre`,
      values,
    ),
    pool.query(
      `SELECT c.id,c.nombre label FROM clientes c WHERE c.activo${locations?.length ? ` AND EXISTS (SELECT 1 FROM tickets t WHERE t.cliente_id=c.id AND ${accountedDocumentPredicate("t")} AND t.ubicacion_id=ANY($1::int[]))` : ""} ORDER BY c.nombre`,
      values,
    ),
    pool.query(
      `SELECT pr.id,pr.nombre label FROM proveedores pr WHERE pr.activo${locations?.length ? " AND EXISTS (SELECT 1 FROM entradas e WHERE e.proveedor_id=pr.id AND e.ubicacion_id=ANY($1::int[]))" : ""} ORDER BY pr.nombre`,
      values,
    ),
    pool.query(
      `SELECT DISTINCT p.tela FROM productos p LEFT JOIN rollos r ON r.producto_id=p.id${scope} ORDER BY p.tela`,
      values,
    ),
    pool.query(
      `SELECT DISTINCT p.color FROM productos p LEFT JOIN rollos r ON r.producto_id=p.id${scope} ORDER BY p.color`,
      values,
    ),
    pool.query(
      `SELECT DISTINCT p.unidad FROM productos p LEFT JOIN rollos r ON r.producto_id=p.id${scope} ORDER BY p.unidad`,
      values,
    ),
  ]);

  return {
    sites: sites.rows.map((row) => ({ id: Number(row.id), label: row.label })),
    products: products.rows.map((row) => ({ id: Number(row.id), label: row.label })),
    fabrics: fabrics.rows.map((row) => row.tela),
    colors: colors.rows.map((row) => row.color),
    units: units.rows.map((row) => row.unidad),
    users: users.rows.map((row) => ({ id: Number(row.id), label: row.label })),
    clients: clients.rows.map((row) => ({ id: Number(row.id), label: row.label })),
    suppliers: suppliers.rows.map((row) => ({ id: Number(row.id), label: row.label })),
    // Payment methods are financial report controls, not operational catalog
    // data. Keep the response shape stable while withholding their labels.
    paymentMethods: economic ? ["EFECTIVO", "TRANSFERENCIA", "CREDITO"] : [],
  };
}