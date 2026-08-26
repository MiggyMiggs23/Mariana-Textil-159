import { pool } from "@workspace/db";
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
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];
export type Report = Record<string, unknown>;

export class ReportInputError extends Error {}

const TIME_ZONE = "America/Mexico_City";
const MIN_REPORT_DATE = new Date("1900-01-01T00:00:00.000Z");
const MAX_REPORT_DATE = new Date("2999-12-31T23:59:59.999Z");
const MAX_REPORT_RANGE_MS = 100 * 366 * 24 * 60 * 60 * 1000;
const ECONOMIC_TEXT = /costo|margen|utilidad|ganancia|venta|importe|precio|capital|ahorro|saldo|cobrar|valor|pago|credito|balance|moneda|facturado/i;

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
    Object.entries(input).filter(([key]) => !ECONOMIC_TEXT.test(key)),
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
  const scrub = (value: unknown, inheritedHidden = new Set<string>()): unknown => {
    if (Array.isArray(value)) {
      return value
        .filter((item) => !(item && typeof item === "object" && (item as Record<string, unknown>).economic === true))
        .map((item) => scrub(item, inheritedHidden));
    }
    if (!value || typeof value !== "object") return value;

    const source = value as Record<string, unknown>;
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
      if (hidden.has(key) || ECONOMIC_TEXT.test(key)) {
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
        clean[key] = scrub(child, hidden);
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
  const content = section === "ventas" || section === "utilidad"
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
      `SELECT c.id,c.nombre label FROM clientes c WHERE c.activo${locations?.length ? " AND EXISTS (SELECT 1 FROM tickets t WHERE t.cliente_id=c.id AND t.estado='VENDIDO' AND t.ubicacion_id=ANY($1::int[]))" : ""} ORDER BY c.nombre`,
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