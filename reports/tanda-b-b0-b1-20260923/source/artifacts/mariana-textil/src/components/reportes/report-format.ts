import { formatNumber, type NumberFormatKind, type NumericValue } from "@workspace/number-format";

const dayFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const numericKinds = new Set<NumberFormatKind>([
  "money",
  "quantity",
  "percentage",
  "count",
  "identifier",
]);

export function formatReportValue(value: unknown, kind: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "text") return String(value);
  if (kind === "days") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${dayFormatter.format(parsed)} días` : "—";
  }

  const numberKind = numericKinds.has(kind as NumberFormatKind)
    ? kind as NumberFormatKind
    : "count";
  return formatNumber(value as NumericValue, {
    kind: numberKind,
    percentageInput: numberKind === "percentage" ? "percent" : undefined,
  });
}