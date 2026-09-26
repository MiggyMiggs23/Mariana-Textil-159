import type { EstadoRollo } from "@workspace/db";
import { quantityToThousandths } from "./quantity-comparison";

export const REVERSAL_EVIDENCE_ACTION = "INVENTARIO_ESTADO_MOVIMIENTO_V1";

export type PhysicalRollState = {
  id: number;
  productoId: number;
  ubicacionId: number;
  pisoId: number | null;
  estado: EstadoRollo;
  cantidadActual: string;
};

export function physicalRollState(roll: PhysicalRollState): PhysicalRollState {
  return {
    id: roll.id, productoId: roll.productoId, ubicacionId: roll.ubicacionId,
    pisoId: roll.pisoId, estado: roll.estado, cantidadActual: roll.cantidadActual,
  };
}

export function readPhysicalRollState(value: unknown): PhysicalRollState | null {
  if (value === null || typeof value !== "object") return null;
  const state = value as Record<string, unknown>;
  if (!Number.isSafeInteger(state.id) || !Number.isSafeInteger(state.productoId) ||
      !Number.isSafeInteger(state.ubicacionId) ||
      !(state.pisoId === null || Number.isSafeInteger(state.pisoId)) ||
      !["PROGRAMADO", "DISPONIBLE", "EN_TRANSITO", "MOSTRADOR", "VENDIDO", "BAJA"].includes(String(state.estado)) ||
      typeof state.cantidadActual !== "string" ||
      !/^\d+(?:\.\d{1,3})?$/.test(state.cantidadActual)) return null;
  return state as PhysicalRollState;
}

export function samePhysicalRollState(a: PhysicalRollState, b: PhysicalRollState): boolean {
  return a.id === b.id && a.productoId === b.productoId &&
    a.ubicacionId === b.ubicacionId && a.pisoId === b.pisoId &&
    a.estado === b.estado &&
    quantityToThousandths(a.cantidadActual) === quantityToThousandths(b.cantidadActual);
}

/**
 * Only complete inverse pairs cease to be dependencies. A CANCELACION cannot
 * erase a movement preceding the target, nor can arbitrary equal totals prove
 * chronological restoration.
 */
export function hasOutstandingSuccessors(
  movements: ReadonlyArray<{ id: number; tipo: string; movimientoOrigenId: number | null }>,
): boolean {
  const restored = new Set<number>();
  const ids = new Set(movements.map((movement) => movement.id));
  for (const movement of movements) {
    if (movement.tipo !== "CANCELACION") continue;
    if (movement.movimientoOrigenId === null ||
        movement.movimientoOrigenId >= movement.id ||
        !ids.has(movement.movimientoOrigenId) ||
        restored.has(movement.movimientoOrigenId)) return true;
    restored.add(movement.movimientoOrigenId);
    restored.add(movement.id);
  }
  return movements.some((movement) => !restored.has(movement.id));
}