/** Initial MAYOREO threshold for each loose-unit product-and-color line. */
export const MAYOREO_THRESHOLD_UNITS = 10;
/** Named aliases keep the applicable physical unit explicit at call sites. */
export const MAYOREO_THRESHOLD_METERS = MAYOREO_THRESHOLD_UNITS;
export const MAYOREO_THRESHOLD_BAGS = MAYOREO_THRESHOLD_UNITS;

export type MeteredPriceTier = "MAYOREO" | "MENUDEO";

export function meteredPriceTier(quantity: number): MeteredPriceTier {
  return quantity >= MAYOREO_THRESHOLD_UNITS ? "MAYOREO" : "MENUDEO";
}

/** Selects the prefilled metered price for the line's current quantity. */
export function suggestedMeteredPrice(
  quantity: number,
  prices: { precioMayoreo: string | null; precioMenudeo: string | null },
): { tier: MeteredPriceTier; price: string | null } {
  const tier = meteredPriceTier(quantity);
  return {
    tier,
    price: tier === "MAYOREO" ? prices.precioMayoreo : prices.precioMenudeo,
  };
}