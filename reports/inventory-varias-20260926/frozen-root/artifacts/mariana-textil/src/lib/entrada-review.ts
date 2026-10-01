export type EntradaReviewLine = {
  productoName: string;
  productoUnidad: string;
  cantidades: readonly string[];
};

export type EntradaReviewTotals = {
  lineCount: number;
  rollCount: number;
  quantitiesByUnit: Readonly<Record<string, number>>;
  products: readonly string[];
  invalidQuantities: readonly EntradaReviewInvalidQuantity[];
};

export type EntradaReviewInvalidQuantity = {
  lineIndex: number;
  quantityIndex: number;
  value: string;
};

const normalizeUnit = (unit: string): string => unit.trim().toUpperCase() || "SIN UNIDAD";

export const isValidReviewQuantity = (value: string): boolean => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
};

export const shouldPreserveProvider = (capturedLineCount: number): boolean => (
  capturedLineCount > 0
);

/**
 * Builds the values shown before an entrada is persisted. Quantities are
 * intentionally grouped by unit: adding meters to kilos (or pieces) would
 * produce a misleading total.
 */
export const buildEntradaReviewTotals = (
  lineas: readonly EntradaReviewLine[],
): EntradaReviewTotals => {
  const quantitiesByUnit: Record<string, number> = {};
  const products: string[] = [];
  const invalidQuantities: EntradaReviewInvalidQuantity[] = [];

  for (const [lineIndex, linea] of lineas.entries()) {
    const unit = normalizeUnit(linea.productoUnidad);
    const validQuantities: number[] = [];
    for (const [quantityIndex, cantidad] of linea.cantidades.entries()) {
      if (!isValidReviewQuantity(cantidad)) {
        invalidQuantities.push({ lineIndex, quantityIndex, value: cantidad });
      } else {
        validQuantities.push(Number(cantidad));
      }
    }
    quantitiesByUnit[unit] = (quantitiesByUnit[unit] || 0) + validQuantities.reduce(
      (total, cantidad) => total + cantidad,
      0,
    );
    products.push(linea.productoName);
  }

  return {
    lineCount: lineas.length,
    rollCount: lineas.reduce((total, linea) => total + linea.cantidades.length, 0),
    quantitiesByUnit,
    products,
    invalidQuantities,
  };
};