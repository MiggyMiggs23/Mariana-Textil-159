export class PriceFloorError extends Error {
  constructor(readonly code: "PRECIO_BAJO_COSTO" | "COSTO_INVALIDO") {
    super(code === "PRECIO_BAJO_COSTO"
      ? "El precio de lista no puede ser menor al costo."
      : "El costo registrado es inválido; no se puede calcular el precio mínimo.");
  }
}

/** Cost comes from the existing locked, mode-specific cost calculation. */
export function assertPriceFloor(price: string, cost: string | null): void {
  if (cost === null) return;
  if (!Number.isFinite(Number(cost))) {
    throw new PriceFloorError("COSTO_INVALIDO");
  }
  if (Number(price) < Number(cost)) throw new PriceFloorError("PRECIO_BAJO_COSTO");
}