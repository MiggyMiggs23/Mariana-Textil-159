export type NumericValue = number | string | bigint | null | undefined;

export type NumberFormatKind =
  | "money"
  | "quantity"
  | "percentage"
  | "count"
  | "identifier";

export interface NumberFormatOptions {
  kind: NumberFormatKind;
  /** Use "ratio" only when 0.16 represents 16%; the default expects 16. */
  percentageInput?: "percent" | "ratio";
  empty?: string;
}

export const EXCEL_NUMBER_FORMAT = {
  money: '"$"#,##0.00',
  quantity: "#,##0.000",
  percentage: "0.00%",
  count: "#,##0",
  identifier: "0",
} as const;

const numberFormatters = {
  money: new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  quantity: new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
  percentage: new Intl.NumberFormat("es-MX", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  count: new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
} as const;

function numeric(value: Exclude<NumericValue, null | undefined>): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return parsed;
}

/** The single presentation boundary for all numeric values in Mariana Textil. */
export function formatNumber(
  value: NumericValue,
  options: NumberFormatOptions,
): string {
  const empty = options.empty ?? "—";
  if (value === null || value === undefined || value === "") return empty;
  if (options.kind === "identifier") return String(value);

  const parsed = numeric(value);
  if (!Number.isFinite(parsed)) return empty;

  if (options.kind === "percentage") {
    const ratio = options.percentageInput === "ratio" ? parsed : parsed / 100;
    return numberFormatters.percentage.format(ratio);
  }
  return numberFormatters[options.kind].format(parsed);
}

/** Converts a database decimal to a real Excel numeric cell without silent invalid values. */
export function toExcelNumber(
  value: Exclude<NumericValue, null | undefined>,
): number {
  const parsed = numeric(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`Excel numeric value is invalid or unsafe: ${String(value)}`);
  }
  return parsed;
}