export const REPORT_CATEGORICAL_COLORS = [
  "hsl(var(--report-category-blue))",
  "hsl(var(--report-category-copper))",
  "hsl(var(--report-category-green))",
  "hsl(var(--report-category-violet))",
  "hsl(var(--report-category-teal))",
  "hsl(var(--report-category-amber))",
  "hsl(var(--report-category-red))",
  "hsl(var(--report-category-sky))",
  "hsl(var(--report-category-rose))",
] as const;

export const REPORT_POSITIVE_COLOR = "hsl(var(--report-positive))";
export const REPORT_NEGATIVE_COLOR = "hsl(var(--report-negative))";
export const REPORT_ROLLOS_COLOR = "hsl(var(--report-modality-rollos))";
export const REPORT_METRAJE_COLOR = "hsl(var(--report-modality-metraje))";

const ACCOUNT_DESTINATION_COLOR_INDEX: Record<string, number> = {
  CAJA_FISICA: 0,
  EFECTIVO: 0,
  CUENTA_NO_FISCAL: 1,
  CUENTAS_NO_FISCALES: 1,
  CUENTA_FISCAL: 2,
  CUENTAS_FISCALES: 2,
  CUENTAS_POR_COBRAR: 3,
  VENTAS_A_CREDITO: 3,
};

export function getCategoricalChartColor(index: number): string {
  return REPORT_CATEGORICAL_COLORS[index % REPORT_CATEGORICAL_COLORS.length];
}

export function getAccountDestinationChartColor(
  value: string,
  fallbackIndex: number,
): string {
  const destination = value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return getCategoricalChartColor(
    ACCOUNT_DESTINATION_COLOR_INDEX[destination] ?? fallbackIndex,
  );
}

export function getReportSeriesColor(key: string, index: number): string {
  const normalized = key
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

  if (normalized.includes("ROLLOS")) return REPORT_ROLLOS_COLOR;
  if (normalized.includes("METRAJE") || normalized.includes("METROS")) {
    return REPORT_METRAJE_COLOR;
  }
  if (
    normalized.includes("NEGATIV") ||
    normalized.includes("FALTANTE") ||
    normalized.includes("PERDIDA")
  ) {
    return REPORT_NEGATIVE_COLOR;
  }
  if (
    normalized.includes("POSITIV") ||
    (normalized.includes("UTILIDAD") && !normalized.includes("MARGEN"))
  ) {
    return REPORT_POSITIVE_COLOR;
  }
  return getCategoricalChartColor(index);
}