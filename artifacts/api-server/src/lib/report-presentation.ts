import { formatNumber, formatUnit } from "@workspace/number-format";

export const REPORT_TIME_ZONE = "America/Mexico_City";
export type ReportValueKind = "money" | "quantity" | "percentage" | "count" | "days" | "text";

export type ReportCatalogItem = { id: number; label: string };
export type ReportPresentationCatalogs = {
  sites?: ReportCatalogItem[];
  comparisonLocations?: ReportCatalogItem[];
  products?: ReportCatalogItem[];
  users?: ReportCatalogItem[];
  clients?: ReportCatalogItem[];
  suppliers?: ReportCatalogItem[];
};

const FILTER_LABELS: Record<string, string> = {
  periodo: "Periodo",
  desde: "Desde",
  hasta: "Hasta",
  ubicacionId: "Ubicación",
  ubicacionIds: "Ubicaciones",
  comparisonLocations: "Ubicaciones comparadas",
  productoIds: "Productos",
  telas: "Telas",
  colores: "Colores",
  unidades: "Unidades",
  usuarioIds: "Usuarios",
  clienteIds: "Clientes",
  proveedorIds: "Proveedores",
  formasPago: "Formas de pago",
  facturado: "Facturado",
  modalidad: "Modalidad",
  margenUmbral: "Umbral de margen",
  coberturaCritico: "Cobertura crítica",
  coberturaBajo: "Cobertura baja",
  coberturaNormal: "Cobertura normal",
  coberturaExceso: "Cobertura exceso",
  modo: "Modo",
  umbralCorte: "Umbral de corte",
  umbralTienda: "Umbral de tienda",
  agrupacion: "Agrupación",
};

const PERIOD_LABELS: Record<string, string> = {
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  personalizado: "Personalizado",
};

const MODE_LABELS: Record<string, string> = {
  normal: "Normal",
  comparar: "Comparar",
};

const MODALITY_LABELS: Record<string, string> = {
  TODO: "Todas las modalidades",
  ROLLOS: "Rollos",
  METRAJE: "Metraje",
};

const CATALOG_BY_FILTER: Record<string, keyof ReportPresentationCatalogs> = {
  ubicacionId: "sites",
  ubicacionIds: "sites",
  comparisonLocations: "comparisonLocations",
  productoIds: "products",
  usuarioIds: "users",
  clienteIds: "clients",
  proveedorIds: "suppliers",
};

function valueForCatalog(
  key: string,
  value: string,
  catalogs: ReportPresentationCatalogs | undefined,
): string {
  const catalogKey = CATALOG_BY_FILTER[key];
  const catalog = catalogKey ? catalogs?.[catalogKey] : undefined;
  if (!catalog) return value;
  const labels = new Map(catalog.map((item) => [String(item.id), item.label]));
  const values = value.split(",").map((item) => item.trim()).filter(Boolean);
  return values
    .map((item) => {
      const label = labels.get(item);
      return label ? label : /^\d+$/.test(item) ? `ID ${item}` : item;
    })
    .join(", ");
}

export function labelForReportKey(key: string): string {
  if (FILTER_LABELS[key]) return FILTER_LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function formatReportFilter(
  key: string,
  rawValue: unknown,
  catalogs?: ReportPresentationCatalogs,
): string {
  const value = String(rawValue ?? "");
  let display = valueForCatalog(key, value, catalogs);
  if (key === "periodo") display = PERIOD_LABELS[display] ?? display;
  if (key === "desde" || key === "hasta") {
    const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(display)
      ? `${display}T12:00:00.000Z`
      : display;
    display = formatReportDate(dateValue);
  }
  if (key === "modo") display = MODE_LABELS[display] ?? display;
  if (key === "modalidad") display = MODALITY_LABELS[display] ?? display;
  if (key === "facturado") display = display === "true" ? "Sí" : display === "false" ? "No" : display;
  if (key === "unidades") display = display.split(", ").map((item) => formatUnit(item, item)).join(", ");
  return `${labelForReportKey(key)}: ${display || "—"}`;
}

export function formatReportFilters(
  activeFilters: unknown,
  catalogs?: ReportPresentationCatalogs,
): string[] {
  if (!Array.isArray(activeFilters)) return [];
  return activeFilters.flatMap((filter) => {
    const text = String(filter);
    const equals = text.indexOf("=");
    if (equals <= 0) return [];
    const key = text.slice(0, equals);
    if (key === "previousDesde" || key === "previousHasta" || key === "yearAgoDesde" || key === "yearAgoHasta") {
      return [];
    }
    return [formatReportFilter(key, text.slice(equals + 1), catalogs)];
  });
}

function dateParts(value: unknown): { day: string; month: string; year: string } | null {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: REPORT_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const result = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!result.day || !result.month || !result.year) return null;
  return { day: result.day, month: result.month, year: result.year };
}

export function formatReportDate(value: unknown, withTime = false): string {
  if (value === undefined || value === null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: REPORT_TIME_ZONE,
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function formatReportRange(range: unknown): string {
  if (!range || typeof range !== "object") return "Periodo no especificado";
  const source = range as Record<string, unknown>;
  const desde = dateParts(source.desde);
  const hasta = dateParts(source.hasta);
  if (!desde || !hasta) return "Periodo no especificado";
  if (desde.year === hasta.year && desde.month === hasta.month) {
    return `Del ${desde.day} al ${hasta.day} de ${desde.month} de ${desde.year}`;
  }
  if (desde.year === hasta.year) {
    return `Del ${desde.day} de ${desde.month} al ${hasta.day} de ${hasta.month} de ${desde.year}`;
  }
  return `Del ${desde.day} de ${desde.month} de ${desde.year} al ${hasta.day} de ${hasta.month} de ${hasta.year}`;
}

export function formatReportValue(
  value: unknown,
  kind: ReportValueKind = "text",
): string {
  if (value === undefined || value === null || value === "") return "—";
  if (kind === "money" || kind === "quantity" || kind === "percentage" || kind === "count") {
    return formatNumber(value as string | number, { kind });
  }
  if (kind === "days") return formatNumber(value as string | number, { kind: "quantity" });
  if (value instanceof Date) return formatReportDate(value);
  return String(value);
}

export function hasMeaningfulTotals(totals: unknown): totals is Record<string, unknown> {
  if (!totals || typeof totals !== "object") return false;
  return Object.values(totals as Record<string, unknown>).some(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

export function reportTotalLabel(
  columns: Array<{ key: string; kind: string }>,
  totals: Record<string, unknown>,
): { key: string; value: string } | null {
  const explicit = columns.find((column) =>
    column.kind === "text" &&
    typeof totals[column.key] === "string" &&
    totals[column.key] !== "",
  );
  if (explicit) return { key: explicit.key, value: String(totals[explicit.key]) };
  const textColumn = columns.find((column) => column.kind === "text");
  return textColumn ? { key: textColumn.key, value: "Total general" } : null;
}