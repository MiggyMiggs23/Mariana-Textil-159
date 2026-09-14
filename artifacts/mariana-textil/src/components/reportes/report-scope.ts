export type ReportPeriod =
  | "diario"
  | "semanal"
  | "mensual"
  | "trimestral"
  | "semestral"
  | "anual"
  | "personalizado";

export type ReportViewMode = "normal" | "comparar";

export type ReportTabId =
  | "ventas"
  | "que-comprar"
  | "utilidad"
  | "clientes"
  | "control-operativo";

export type ReportTabResolution = {
  tab: ReportTabId;
  legacy: boolean;
  forcedMode?: ReportViewMode;
};

export type ReportDateRange = {
  desde: string;
  hasta: string;
};

export type ReportScope = {
  selectedLocationId: number | null;
  dateRange?: ReportDateRange;
};

export function resolveReportViewMode(
  requestedMode: ReportViewMode,
  selectedLocationId: number | null,
  alcanceConsulta?: string | null,
  rol?: string | null,
): ReportViewMode {
  return requestedMode === "comparar" &&
    selectedLocationId === null &&
    alcanceConsulta === "TODAS" &&
    rol === "ADMIN"
    ? "comparar"
    : "normal";
}

const REPORT_TABS = new Set<ReportTabId>([
  "ventas",
  "que-comprar",
  "utilidad",
  "clientes",
  "control-operativo",
]);

/**
 * Converts report URLs from the former section-per-route layout to the
 * current five composed views. The mapping is pure so route gates and
 * numeric verification can exercise it without a router.
 */
export function resolveReportTab(candidate?: string | null): ReportTabResolution {
  if (!candidate) return { tab: "ventas", legacy: false };
  if (candidate === "pagos-dirigidos") {
    return { tab: "clientes", legacy: true };
  }
  if (candidate === "comparativo") {
    return { tab: "ventas", legacy: true, forcedMode: "comparar" };
  }
  if (candidate === "diferencias") {
    return { tab: "control-operativo", legacy: true };
  }
  if (REPORT_TABS.has(candidate as ReportTabId)) {
    return { tab: candidate as ReportTabId, legacy: false };
  }
  return { tab: "que-comprar", legacy: true };
}

export type CashExportControls = {
  agrupacion: "semana" | "mes";
  umbralCorte: string;
  umbralTienda: string;
};

/**
 * Serializes the complete composed-view export request. The server receives
 * the same report filters as the source queries plus view mode and the cash
 * controls used by Control operativo.
 */
export function buildReportExportParams(
  params: Record<string, unknown>,
  modo: ReportViewMode,
  cashControls: CashExportControls,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  const locationIds = params.ubicacionIds;
  if (
    Array.isArray(locationIds) &&
    locationIds.length === 1 &&
    result.ubicacionId === undefined
  ) {
    result.ubicacionId = String(locationIds[0]);
  }
  result.modo = modo;
  result.agrupacion = cashControls.agrupacion;
  result.umbralCorte = cashControls.umbralCorte;
  result.umbralTienda = cashControls.umbralTienda;
  return result;
}

export function buildComparisonScopeParams(
  params: Record<string, unknown>,
  siteIds: number[],
  dateRange?: ReportDateRange,
): Record<string, unknown>[] {
  return siteIds.map((siteId) =>
    applyReportScope(params, { selectedLocationId: siteId, dateRange }),
  );
}

const TIME_ZONE = "America/Mexico_City";

function mexicoToday(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function calendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Resolves the same calendar range as the reportRange server helper. Dates
 * are calendar days in America/Mexico_City, rather than the browser timezone.
 */
export function resolveReportRange(
  filters: { periodo: string; desde?: string; hasta?: string },
  now = new Date(),
): ReportDateRange | undefined {
  if (filters.periodo === "personalizado") {
    if (!filters.desde || !filters.hasta) return undefined;
    return { desde: filters.desde, hasta: filters.hasta };
  }

  const today = mexicoToday(now);
  const [year, month, day] = today.split("-").map(Number);
  const base = new Date(Date.UTC(year!, month! - 1, day!, 12));
  let startMonth = month! - 1;
  let startDay = 1;

  switch (filters.periodo) {
    case "diario":
      startDay = day!;
      break;
    case "semanal":
      startDay = day! - ((base.getUTCDay() + 6) % 7);
      break;
    case "trimestral":
      startMonth -= startMonth % 3;
      break;
    case "semestral":
      startMonth -= startMonth % 6;
      break;
    case "anual":
      startMonth = 0;
      break;
    case "mensual":
    default:
      break;
  }

  const start = new Date(Date.UTC(year!, startMonth, startDay, 12));
  return {
    desde: calendarDate(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      start.getUTCDate(),
    ),
    hasta: today,
  };
}

/**
 * Applies the header's location and date scope to every report request.
 *
 * `ubicacionIds`/`ubicacionId` are deliberately removed before applying the
 * header value, and dates are replaced by the resolved report range. This
 * prevents an old URL (or any caller-supplied value) from overriding the
 * header scope or period. Null means the allowed global view.
 */
export function applyReportScope(
  params: Record<string, unknown>,
  scope: ReportScope,
): Record<string, unknown> {
  const scoped = Object.fromEntries(
    Object.entries(params).filter(
      ([key]) =>
        key !== "ubicacionIds" &&
        key !== "ubicacionId" &&
        key !== "desde" &&
        key !== "hasta",
    ),
  );

  if (scope.selectedLocationId !== null) {
    scoped.ubicacionIds = [scope.selectedLocationId];
  }
  if (scope.dateRange) {
    scoped.desde = scope.dateRange.desde;
    scoped.hasta = scope.dateRange.hasta;
  }

  return scoped;
}