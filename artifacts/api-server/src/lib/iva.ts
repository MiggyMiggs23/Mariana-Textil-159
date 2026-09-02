/** IVA expressed in basis points to keep money calculations integer-only. */
export const IVA_RATE_BASIS_POINTS = 1600;

const BASIS_POINTS_PER_WHOLE = 10_000;

/**
 * Splits a tax-inclusive cent amount into subtotal and IVA. The subtotal is
 * rounded half-up to the nearest cent and IVA receives the remainder, so both
 * parts always recompose the originally captured amount exactly.
 */
export function breakdownIvaIncluded(totalCents: number): {
  subtotalCents: number;
  ivaCents: number;
} {
  if (!Number.isSafeInteger(totalCents)) {
    throw new Error("El importe debe expresarse en centavos enteros seguros.");
  }
  const divisor = BASIS_POINTS_PER_WHOLE + IVA_RATE_BASIS_POINTS;
  const sign = totalCents < 0 ? -1 : 1;
  const absoluteTotal = Math.abs(totalCents);
  const subtotalCents =
    Math.floor(
      (absoluteTotal * BASIS_POINTS_PER_WHOLE + Math.floor(divisor / 2)) /
        divisor,
    ) * sign;
  return { subtotalCents, ivaCents: totalCents - subtotalCents };
}