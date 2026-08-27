/** MAYOREO applies to each individual metered product-and-color line at 10 meters or more. */
export const MAYOREO_THRESHOLD_METERS = 10;

export type MeteredPriceTier = "MAYOREO" | "MENUDEO";

export function meteredPriceTier(quantity: number): MeteredPriceTier {
  return quantity >= MAYOREO_THRESHOLD_METERS ? "MAYOREO" : "MENUDEO";
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