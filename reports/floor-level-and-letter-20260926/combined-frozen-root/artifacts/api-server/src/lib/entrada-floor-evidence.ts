/** Receipt-only evidence. Current roll floors and later inventory counts are not receipt evidence. */
export type EntradaFloorSnapshot = {
  rolloId: number;
  productoId: number;
  pisoId: number | null;
  nombrePiso: string | null;
};

export function entradaFloorLabel(
  rolls: Array<{ id: number; productoId: number }>,
  evidence: unknown,
): string {
  if (!Array.isArray(evidence) || rolls.length === 0) return "Sin evidencia";
  const labels = rolls.map((roll) => {
    const matches = evidence.filter((item) =>
      item && item.rolloId === roll.id && item.productoId === roll.productoId);
    if (matches.length !== 1) return "Sin evidencia";
    const item = matches[0];
    if (item.pisoId === null && item.nombrePiso === null) return "Sin piso";
    if (!Number.isInteger(item.pisoId) || item.pisoId <= 0 ||
        typeof item.nombrePiso !== "string" || !item.nombrePiso.trim()) return "Sin evidencia";
    return item.nombrePiso;
  });
  return [...new Set(labels)].join(", ");
}