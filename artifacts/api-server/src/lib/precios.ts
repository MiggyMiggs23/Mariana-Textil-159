export type PrecioMetrics = {
  costoUnitarioPonderado: string | null;
  margenPesosUnidad: string | null;
  margenPorcentajeSubtotal: string | null;
  semaforo: "VERDE" | "AMBAR" | "ROJO" | "SIN_COSTO";
};

type CostRow = {
  cantidadActual: string;
  costoUnitario: string | null;
  estado: string;
};

const validMoney = (value: string | null): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Weighted only by physically available quantity, never by number of rolls. */
export function weightedCurrentUnitCost(rows: CostRow[]): string | null {
  let totalQuantity = 0;
  let totalCost = 0;
  for (const row of rows) {
    const quantity = Number(row.cantidadActual);
    const cost = validMoney(row.costoUnitario);
    if (row.estado !== "DISPONIBLE" || !Number.isFinite(quantity) || quantity <= 0 || cost == null) continue;
    totalQuantity += quantity;
    totalCost += cost * quantity;
  }
  return totalQuantity > 0 ? (totalCost / totalQuantity).toFixed(2) : null;
}

export function priceMetrics(price: string | null, cost: string | null): PrecioMetrics {
  if (cost == null) {
    return {
      costoUnitarioPonderado: null,
      margenPesosUnidad: null,
      margenPorcentajeSubtotal: null,
      semaforo: "SIN_COSTO",
    };
  }
  const parsedPrice = Number(price);
  if (price == null || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return {
      costoUnitarioPonderado: Number(cost).toFixed(2),
      margenPesosUnidad: null,
      margenPorcentajeSubtotal: null,
      semaforo: "ROJO",
    };
  }
  const margin = parsedPrice - Number(cost);
  // Margin is expressed over sale subtotal (price), as contracted.
  const percent = (margin / parsedPrice) * 100;
  return {
    costoUnitarioPonderado: Number(cost).toFixed(2),
    margenPesosUnidad: margin.toFixed(2),
    margenPorcentajeSubtotal: percent.toFixed(4),
    semaforo: percent >= 30 ? "VERDE" : percent >= 15 ? "AMBAR" : "ROJO",
  };
}

export function validPositiveMoney(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}