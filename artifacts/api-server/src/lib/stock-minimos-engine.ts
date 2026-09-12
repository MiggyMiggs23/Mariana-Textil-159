/**
 * Pure state transition for one product/location stock-minimum pair.
 *
 * The database service owns episode persistence. Keeping the transition here
 * makes the "one active episode" rule explicit without coupling it to a
 * particular query or inventory writer.
 */
export type StockMinimumEpisodeAction = "OPEN" | "UPDATE" | "CLOSE" | "NONE";

export type StockMinimumEvaluation = {
  action: StockMinimumEpisodeAction;
  diferencia: number | null;
};

export function evaluateStockMinimum(
  minimo: number | null,
  existencia: number,
  episodioAbierto: boolean,
): StockMinimumEvaluation {
  if (!Number.isFinite(existencia) || existencia < 0) {
    throw new RangeError("La existencia debe ser un número finito no negativo.");
  }

  if (minimo != null && (!Number.isFinite(minimo) || minimo < 0)) {
    throw new RangeError("El mínimo debe ser un número finito no negativo.");
  }

  if (minimo == null) {
    return {
      action: episodioAbierto ? "CLOSE" : "NONE",
      diferencia: null,
    };
  }

  const diferencia = Math.max(0, minimo - existencia);
  if (existencia >= minimo) {
    return {
      action: episodioAbierto ? "CLOSE" : "NONE",
      diferencia: 0,
    };
  }

  return {
    action: episodioAbierto ? "UPDATE" : "OPEN",
    diferencia,
  };
}
