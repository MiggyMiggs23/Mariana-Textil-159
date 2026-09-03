export type SelectableLabel = { id: number };

export function toggleLabelSelection<T extends SelectableLabel>(
  current: ReadonlyMap<number, T>,
  item: T,
  limit = 50,
): Map<number, T> {
  const next = new Map(current);
  if (next.has(item.id)) {
    next.delete(item.id);
  } else if (next.size < limit) {
    next.set(item.id, item);
  }
  return next;
}

export function updateVisibleLabelSelection<T extends SelectableLabel>(
  current: ReadonlyMap<number, T>,
  visibleItems: readonly T[],
  checked: boolean,
  limit = 50,
): Map<number, T> {
  const next = new Map(current);
  for (const item of visibleItems) {
    if (!checked) {
      next.delete(item.id);
    } else if (next.size < limit) {
      next.set(item.id, item);
    }
  }
  return next;
}