export type NumericValue = number | string | bigint | null | undefined;

/** Stable enum values remain technical; only this presentation boundary translates them. */
export const UNIT_LABELS = {
  METRO: "Mts.",
  KILO: "Kg.",
  BOLSA: "Bolsas",
  PIEZA: "Pzas.",
} as const;

export type DisplayUnitCode = keyof typeof UNIT_LABELS;

/**
 * Formats a product unit for screens and generated documents.
 * Unknown values are preserved so historical data is visible rather than mislabeled.
 */
export function formatUnit(value: string | null | undefined, empty = "—"): string {
  if (!value) return empty;
  return UNIT_LABELS[value.trim().toUpperCase() as DisplayUnitCode] ?? value.trim();
}

/** Quantity heading used by the physical QR label. */
export function formatPackageQuantityLabel(value: string | null | undefined): string {
  const unit = value?.trim().toUpperCase();
  if (unit === "BOLSA") return "BOLSAS POR CAJA";
  if (unit === "KILO") return "KILOS DEL ROLLO";
  if (unit === "PIEZA") return "PIEZAS";
  return "METROS DEL ROLLO";
}

/** Stable values used in APIs and persistence for where money is deposited. */
export const ACCOUNT_DESTINATION_CODES = [
  "CAJA_FISICA",
  "CUENTA_NO_FISCAL",
  "CUENTA_FISCAL",
  "CUENTAS_POR_COBRAR",
] as const;

export type AccountDestinationCode = (typeof ACCOUNT_DESTINATION_CODES)[number];

/** The required business/presentation sequence; do not derive this from input. */
export const ACCOUNT_DESTINATION_ORDER = [
  "CAJA_FISICA",
  "CUENTA_NO_FISCAL",
  "CUENTA_FISCAL",
  "CUENTAS_POR_COBRAR",
] as const satisfies readonly AccountDestinationCode[];

export const ACCOUNT_DESTINATION_LABELS: Record<AccountDestinationCode, string> = {
  CAJA_FISICA: "Efectivo",
  CUENTA_NO_FISCAL: "Cuentas No Fiscales",
  CUENTA_FISCAL: "Cuentas Fiscales",
  CUENTAS_POR_COBRAR: "Ventas a Crédito",
};

const accountDestinationAliases: Record<string, AccountDestinationCode> = {
  CAJA_FISICA: "CAJA_FISICA",
  EFECTIVO: "CAJA_FISICA",
  CUENTA_NO_FISCAL: "CUENTA_NO_FISCAL",
  CUENTAS_NO_FISCALES: "CUENTA_NO_FISCAL",
  CUENTA_FISCAL: "CUENTA_FISCAL",
  CUENTAS_FISCALES: "CUENTA_FISCAL",
  CUENTAS_POR_COBRAR: "CUENTAS_POR_COBRAR",
  VENTAS_A_CREDITO: "CUENTAS_POR_COBRAR",
};

function accountDestinationKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Converts codes plus historical visible labels into a canonical destination.
 * Unknown values intentionally return null so callers never misclassify money.
 */
export function normalizeAccountDestination(
  value: string | null | undefined,
): AccountDestinationCode | null {
  if (!value) return null;
  return accountDestinationAliases[accountDestinationKey(value)] ?? null;
}

/** Safe display boundary for destination values returned by old and new APIs. */
export function formatAccountDestination(
  value: string | null | undefined,
  empty = "—",
): string {
  const code = normalizeAccountDestination(value);
  return code ? ACCOUNT_DESTINATION_LABELS[code] : value?.trim() || empty;
}

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
  quantity: "#,##0.00",
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

/**
 * Uses the shared visible quantity precision without locale grouping so the
 * value remains one numeric cell in a comma-delimited CSV.
 */
export function formatQuantityForCsv(value: NumericValue): string {
  return formatNumber(value, { kind: "quantity", empty: "" }).replaceAll(",", "");
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