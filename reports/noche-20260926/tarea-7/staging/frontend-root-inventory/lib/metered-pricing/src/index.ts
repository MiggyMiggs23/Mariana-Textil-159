/** Initial MAYOREO threshold for each loose-unit product-and-color line. */
export const MAYOREO_THRESHOLD_UNITS = 10;
/** Named aliases keep the applicable physical unit explicit at call sites. */
export const MAYOREO_THRESHOLD_METERS = MAYOREO_THRESHOLD_UNITS;
export const MAYOREO_THRESHOLD_BAGS = MAYOREO_THRESHOLD_UNITS;

export type MeteredPriceTier = "MAYOREO" | "MENUDEO";
export type MeteredPricingUnit = "METRO" | "BOLSA";

/**
 * Returns the applicable wholesale threshold. Unspecified and historical
 * units retain the former metre-based behavior for backwards compatibility.
 */
export function mayoreoThresholdForUnit(
  unit?: string | null,
): number {
  return unit?.trim().toUpperCase() === "BOLSA"
    ? MAYOREO_THRESHOLD_BAGS
    : MAYOREO_THRESHOLD_METERS;
}

export function meteredPriceTier(
  quantity: number,
  unit?: string | null,
): MeteredPriceTier {
  return quantity >= mayoreoThresholdForUnit(unit) ? "MAYOREO" : "MENUDEO";
}

/** Selects the prefilled metered price for the line's current quantity. */
export function suggestedMeteredPrice(
  quantity: number,
  prices: { precioMayoreo: string | null; precioMenudeo: string | null },
  unit?: string | null,
): { tier: MeteredPriceTier; price: string | null } {
  const tier = meteredPriceTier(quantity, unit);
  return {
    tier,
    price: tier === "MAYOREO" ? prices.precioMayoreo : prices.precioMenudeo,
  };
}