const MONEY_PATTERN = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a persisted money decimal without passing through a floating point
 * number. The API sends money as decimal strings, so the cent value remains
 * exact even for large amounts and values around a cent boundary.
 */
export function parseMoneyToCents(value: string): bigint {
  const normalized = value.trim();
  const match = MONEY_PATTERN.exec(normalized);
  if (!match) {
    throw new TypeError(`Importe monetario inválido: ${value}`);
  }

  const fraction = (match[3] ?? "").padEnd(2, "0");
  const coefficient = BigInt(`${match[2]}${fraction}`);
  return match[1] === "-" ? -coefficient : coefficient;
}

export function formatCentsAsMoney(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const digits = (cents < 0n ? -cents : cents).toString().padStart(3, "0");
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/**
 * This is the one authorized browser-side financial difference. Keep both
 * operands from the same server response and return integer cents.
 */
export function calculateCashSinFacturaCents(
  cobrado: string,
  facturado: string,
): bigint {
  return parseMoneyToCents(cobrado) - parseMoneyToCents(facturado);
}

/**
 * Checks the independently supplied derived value, rather than recomputing
 * it inside the assertion. This catches a wrong-cent regression in either
 * the parser or the authorized calculation.
 */
export function assertCashDifferenceInCents(values: {
  cobrado: string;
  facturado: string;
  sinFactura: string;
}): void {
  const cobradoCents = parseMoneyToCents(values.cobrado);
  const facturadoCents = parseMoneyToCents(values.facturado);
  const sinFacturaCents = parseMoneyToCents(values.sinFactura);

  if (
    facturadoCents + sinFacturaCents !== cobradoCents ||
    sinFacturaCents !== cobradoCents - facturadoCents
  ) {
    throw new Error(
      "Efectivo facturado + efectivo sin factura no coincide con efectivo cobrado al centavo",
    );
  }
}