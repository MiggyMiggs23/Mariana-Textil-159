/**
 * Pure state transition for one product/location stock-minimum pair.
 *
 * The database service owns episode persistence. Keeping the transition here
 * makes the "one active episode" rule explicit without coupling it to a
 * particular query or inventory writer.
 */
export type StockMinimumEpisodeAction = "OPEN" | "UPDATE" | "CLOSE" | "NONE";

/**
 * The episode keeps two different facts separate:
 *
 * - MOVIMIENTO means the latest ledger movement is enough to prove a crossing
 *   from at/above the minimum to below it.
 * - CONFIGURACION means enabling the site or changing the minimum exposed a
 *   breach that was already present.
 * - SNAPSHOT means the evaluator observed a breach but the available movement
 *   snapshot cannot establish when the crossing happened.
 *
 * In particular, a movement_id stored on an episode is provenance for the
 * observation. It is not, by itself, proof that the movement caused the
 * breach.
 */
export type StockMinimumEpisodeCause =
  | "MOVIMIENTO"
  | "CONFIGURACION"
  | "SNAPSHOT";

export type StockMinimumMovementSnapshot = {
  id: number;
  cantidad: number | string;
  saldoPosterior: number | string;
};

export type StockMinimumConfigurationTrigger =
  | { kind: "SITE" }
  | { kind: "PRODUCT"; productoId: number }
  | null;

export function configurationTriggerApplies(
  trigger: StockMinimumConfigurationTrigger,
  productoId: number,
): boolean {
  return trigger?.kind === "SITE" ||
    (trigger?.kind === "PRODUCT" && trigger.productoId === productoId);
}

export type StockMinimumEvaluation = {
  action: StockMinimumEpisodeAction;
  diferencia: number | null;
};

/**
 * Classify the evidence available when a new episode is opened.
 *
 * `movement` is deliberately only the latest product/site movement snapshot.
 * A negative movement proves a crossing only when its saldo before the
 * movement was at or above the configured minimum and its saldo afterwards is
 * below it. Anything else is honestly reported as a snapshot, rather than
 * inventing a historic crossing.
 */
export function classifyStockMinimumEpisodeCause(input: {
  minimo: number;
  movement: StockMinimumMovementSnapshot | null;
  configurationTriggered: boolean;
}): StockMinimumEpisodeCause {
  if (input.configurationTriggered) return "CONFIGURACION";
  if (!input.movement) return "SNAPSHOT";

  const cantidad = Number(input.movement.cantidad);
  const saldoPosterior = Number(input.movement.saldoPosterior);
  if (
    !Number.isFinite(cantidad) ||
    !Number.isFinite(saldoPosterior) ||
    cantidad >= 0 ||
    saldoPosterior >= input.minimo ||
    saldoPosterior - cantidad < input.minimo
  ) {
    return "SNAPSHOT";
  }
  return "MOVIMIENTO";
}

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
