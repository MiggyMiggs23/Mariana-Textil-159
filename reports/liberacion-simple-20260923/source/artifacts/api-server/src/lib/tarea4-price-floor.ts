export class PriceFloorError extends Error {
  constructor(readonly code: "PRECIO_BAJO_COSTO" | "COSTO_PENDIENTE_DECISION") {
    super(code === "PRECIO_BAJO_COSTO"
      ? "El precio de lista no puede ser menor al costo."
      : "Costo desconocido: este caso requiere decisión del propietario antes de liberar.");
  }
}

/** Cost comes from the existing locked, mode-specific cost calculation. */
export function assertPriceFloor(price: string, cost: string | null): void {
  if (cost === null || !Number.isFinite(Number(cost))) {
    // A release blocker, NOT a new business rule for unknown costs.
    throw new PriceFloorError("COSTO_PENDIENTE_DECISION");
  }
  if (Number(price) < Number(cost)) throw new PriceFloorError("PRECIO_BAJO_COSTO");
}