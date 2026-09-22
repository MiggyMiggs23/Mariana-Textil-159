export type ProductWithSuggestedPrice = {
  precioSugerido?: string | null;
};

export const PRODUCT_WITHOUT_PRICE_TITLE = "Producto sin precio";
export const PRODUCT_WITHOUT_PRICE_DESCRIPTION =
  "Captura el precio en el módulo de Precios antes de agregarlo al carrito.";

export function hasCapturedSuggestedPrice<T extends ProductWithSuggestedPrice>(
  product: T,
): product is T & { precioSugerido: string };
export function hasCapturedSuggestedPrice(
  product: ProductWithSuggestedPrice,
): boolean {
  return product.precioSugerido != null;
}