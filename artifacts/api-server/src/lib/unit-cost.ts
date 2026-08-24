/**
 * A unit cost is usable only if the database will persist it as a positive
 * value in its two-decimal numeric column.
 */
export function isValidUnitCost(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }

  const normalized = typeof value === "string" ? value.trim() : value;
  if (
    normalized === "" ||
    (typeof normalized === "string" &&
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized))
  ) {
    return false;
  }

  const parsed = Number(normalized);
  return (
    Number.isFinite(parsed) &&
    parsed > 0 &&
    Number(parsed.toFixed(2)) > 0
  );
}

export function rollWithoutValidUnitCostMessage(serie: string): string {
  return `El rollo serie ${serie} no tiene un costo unitario válido. Contacta a administración.`;
}