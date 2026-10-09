export type OrderedFloor = { id: number; nivel: number | null; activo?: boolean };
export function compareFloorLevels(a: OrderedFloor, b: OrderedFloor): number;
export function lowestActiveFloor<T extends OrderedFloor>(floors: readonly T[]): T | null;