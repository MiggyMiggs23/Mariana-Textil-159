export const CANONICAL_STORE_ORDER = ["Mariana", "Coco", "Cruces"] as const;

type Store = { ubicacionId: number; nombreUbicacion: string };

/**
 * Stable operational ordering. Known stores remain in their agreed display
 * order; newly created stores are never dropped and sort by name then id.
 */
export function orderStores<T extends Store>(stores: readonly T[]): T[] {
  const rank = new Map<string, number>(CANONICAL_STORE_ORDER.map((name, index) => [name, index]));
  return [...stores].sort((left, right) => {
    const leftRank = rank.get(left.nombreUbicacion);
    const rightRank = rank.get(right.nombreUbicacion);
    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      if (leftRank !== rightRank) return leftRank - rightRank;
    }
    const name = left.nombreUbicacion.localeCompare(right.nombreUbicacion, "es", {
      sensitivity: "base",
    });
    return name || left.ubicacionId - right.ubicacionId;
  });
}