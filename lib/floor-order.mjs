/** Persisted ordering only: names are presentation, never physical position. */
export function compareFloorLevels(a, b) {
  const aValid = Number.isInteger(a.nivel);
  const bValid = Number.isInteger(b.nivel);
  if (aValid !== bValid) return aValid ? -1 : 1;
  return (aValid ? a.nivel - b.nivel : 0) || a.id - b.id;
}

/** An unknown active level could be lower: never silently choose around it. */
export function lowestActiveFloor(floors) {
  const active = floors.filter((floor) => floor.activo !== false);
  if (!active.length || active.some((floor) => !Number.isInteger(floor.nivel))) return null;
  return [...active].sort(compareFloorLevels)[0];
}