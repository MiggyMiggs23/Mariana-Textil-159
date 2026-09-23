import { and, eq, inArray } from "drizzle-orm";
import {
  entradasTable,
  movimientosTable,
  rollosTable,
  ticketLineaConsumosTable,
} from "@workspace/db";
import type { Tx } from "./inventario";
import { isValidUnitCost } from "./unit-cost";

type MovementEvidence = {
  id: number;
  rolloId: number;
  cantidad: string;
};

type RollEvidence = {
  id: number;
  recepcionId: number | null;
  proveedorId: number | null;
  costoUnitario: string | null;
};

export type RecordTicketLineConsumptionInput = {
  ticketId: number;
  ticketLineaId: number;
  cantidad: string;
  ingresoCentavos: number;
  /**
   * NORMAL uses the ticket-line frozen total. METREADO uses each consumed
   * physical roll's cost snapshot, never the averaged line snapshot.
   */
  costoMode: "LINE_FROZEN" | "ROLL_PHYSICAL";
  costoCentavos: number | null;
  movimientos: MovementEvidence[];
  idempotencyPrefix: string;
  /** New inventory paths must fail atomically instead of losing trace. */
  requireCompleteTrace?: boolean;
};

function quantityToThousandths(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) throw new Error(`Cantidad inválida para trazabilidad: ${value}`);
  return (
    BigInt(match[1]!) * 1000n +
    BigInt((match[2] ?? "").padEnd(3, "0"))
  );
}

function cents(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Centavos inválidos para trazabilidad: ${value}`);
  }
  return parsed;
}

type PhysicalAllocation = {
  rolloId: number;
  movimientoId: number;
  cantidadMilesimas: bigint;
  ingresoCentavos: number;
  costoCentavos: number | null;
};

/**
 * Largest-remainder allocation in integer cents. Stable rollo/movement order
 * means a line always reconciles exactly, including repeated fractional sales.
 */
export function allocateCents(
  totalCentavos: number,
  parts: Array<{ cantidadMilesimas: bigint; rolloId: number; movimientoId: number }>,
): Map<number, number> {
  if (!parts.length) return new Map();
  const totalQuantity = parts.reduce(
    (sum, part) => sum + part.cantidadMilesimas,
    0n,
  );
  if (totalQuantity <= 0n) return new Map();
  const floors = parts.map((part) => {
    const numerator = BigInt(totalCentavos) * part.cantidadMilesimas;
    return {
      key: part.movimientoId,
      floor: Number(numerator / totalQuantity),
      remainder: numerator % totalQuantity,
    };
  });
  let remaining = totalCentavos - floors.reduce((sum, row) => sum + row.floor, 0);
  floors.sort(
    (a, b) =>
      Number(b.remainder - a.remainder) ||
      parts.findIndex((part) => part.movimientoId === a.key) -
        parts.findIndex((part) => part.movimientoId === b.key),
  );
  const allocated = new Map<number, number>();
  for (const row of floors) {
    const extra = remaining > 0 ? 1 : 0;
    allocated.set(row.key, row.floor + extra);
    remaining -= extra;
  }
  return allocated;
}

/**
 * Allocate a line's physical costs as a group. Rounding each fragment
 * independently is wrong: two 0.001 fragments at $5.00/m are one cent in
 * total, not two cents. Positive, finite, persistable unit costs are required;
 * all other source costs remain unavailable.
 */
export function allocatePhysicalCostCents(
  movements: Array<{ id: number; rolloId: number; cantidadMilesimas: bigint }>,
  rolls: Map<number, RollEvidence>,
): Map<number, number | null> {
  const result = new Map<number, number | null>(
    movements.map((movement) => [movement.id, null]),
  );
  const parts = movements.flatMap((movement, index) => {
    const roll = rolls.get(movement.rolloId);
    if (!roll || !isValidUnitCost(roll.costoUnitario)) return [];
    const unitCostCents = Math.round(Number(roll.costoUnitario) * 100);
    if (!Number.isSafeInteger(unitCostCents) || unitCostCents <= 0) return [];
    return [{
      movementId: movement.id,
      index,
      numerator: BigInt(unitCostCents) * movement.cantidadMilesimas,
    }];
  });
  if (!parts.length) return result;

  const denominator = 1000n;
  const totalNumerator = parts.reduce(
    (sum, part) => sum + part.numerator,
    0n,
  );
  const target = (totalNumerator + denominator / 2n) / denominator;
  const floors = parts.map((part) => ({
    ...part,
    floor: part.numerator / denominator,
    remainder: part.numerator % denominator,
  }));
  let extras =
    target - floors.reduce((sum, part) => sum + part.floor, 0n);
  floors.sort(
    (a, b) =>
      Number(b.remainder - a.remainder) ||
      a.index - b.index ||
      a.movementId - b.movementId,
  );
  for (const part of floors) {
    const cents = part.floor + (extras > 0n ? 1n : 0n);
    if (extras > 0n) extras -= 1n;
    result.set(part.movementId, Number(cents));
  }
  return result;
}

async function loadRollEvidence(
  tx: Tx,
  rolloIds: number[],
): Promise<Map<number, RollEvidence>> {
  if (!rolloIds.length) return new Map();
  const rows = await tx
    .select({
      id: rollosTable.id,
      recepcionId: rollosTable.recepcionId,
      proveedorId: entradasTable.proveedorId,
      costoUnitario: rollosTable.costoUnitario,
    })
    .from(rollosTable)
    .leftJoin(entradasTable, eq(entradasTable.id, rollosTable.recepcionId))
    .where(inArray(rollosTable.id, rolloIds));
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Persists one line's exact physical consumption. Missing reception/provider
 * evidence intentionally produces no ledger row for legacy callers; new
 * inventory paths set requireCompleteTrace and fail the enclosing transaction
 * instead of silently omitting an allocation.
 */
export async function recordTicketLineConsumption(
  tx: Tx,
  input: RecordTicketLineConsumptionInput,
): Promise<number> {
  const movements = input.movimientos
    .map((movement) => ({
      ...movement,
      movimientoId: movement.id,
      cantidadMilesimas: quantityToThousandths(
        movement.cantidad.replace(/^-/, ""),
      ),
    }))
    .filter((movement) => movement.cantidadMilesimas > 0n);
  if (!movements.length) {
    if (input.requireCompleteTrace) {
      throw new Error(
        `Falta evidencia física para la línea ${input.ticketLineaId}.`,
      );
    }
    return 0;
  }

  const expected = quantityToThousandths(input.cantidad);
  const actual = movements.reduce(
    (sum, movement) => sum + movement.cantidadMilesimas,
    0n,
  );
  if (actual !== expected) {
    throw new Error(
      `La evidencia física no concilia la línea ${input.ticketLineaId}.`,
    );
  }

  const rollMap = await loadRollEvidence(
    tx,
    [...new Set(movements.map((movement) => movement.rolloId))],
  );
  const eligible = movements
    .map((movement) => {
      const roll = rollMap.get(movement.rolloId);
      if (!roll?.recepcionId || roll.proveedorId == null) return null;
      return { movement, roll };
    })
    .filter(
      (
        row,
      ): row is {
        movement: (typeof movements)[number];
        roll: RollEvidence;
      } => row != null,
    );
  // If any physical source lacks authoritative entry evidence, do not write a
  // partial attribution that would silently omit part of a sale.
  if (eligible.length !== movements.length) {
    if (input.requireCompleteTrace) {
      throw new Error(
        `Falta evidencia de entrada/proveedor para la línea ${input.ticketLineaId}.`,
      );
    }
    return 0;
  }

  const revenueByMovement = allocateCents(
    cents(input.ingresoCentavos),
    movements,
  );
  const physicalCostByMovement =
    input.costoMode === "ROLL_PHYSICAL"
      ? allocatePhysicalCostCents(movements, rollMap)
      : null;
  const rows = eligible.map(({ movement, roll }) => {
    const lineCost =
      input.costoMode === "LINE_FROZEN" &&
      input.costoCentavos != null &&
      input.costoCentavos > 0
        ? allocateCents(input.costoCentavos, movements).get(movement.id) ?? 0
        : null;
    return {
      ticketId: input.ticketId,
      ticketLineaId: input.ticketLineaId,
      movimientoId: movement.id,
      rolloId: movement.rolloId,
      entradaId: roll.recepcionId!,
      proveedorId: roll.proveedorId!,
      cantidadMilesimas: Number(movement.cantidadMilesimas),
      ingresoCentavos: revenueByMovement.get(movement.id) ?? 0,
      costoCentavos:
        input.costoMode === "LINE_FROZEN"
          ? lineCost
          : physicalCostByMovement?.get(movement.id) ?? null,
      tipo: "CONSUMO" as const,
      reversaDeId: null,
      idempotencia: `${input.idempotencyPrefix}:mov:${movement.id}`,
    };
  });
  if (!rows.length) return 0;
  await tx
    .insert(ticketLineaConsumosTable)
    .values(rows)
    .onConflictDoNothing({ target: ticketLineaConsumosTable.idempotencia });
  return rows.length;
}

/**
 * Cancellation is append-only and idempotent. Every original allocation gets
 * one REVERSA row; no historical CONSUMO row is updated or deleted.
 */
export async function reverseTicketLineConsumptions(
  tx: Tx,
  ticketId: number,
  cancellationMovementByOriginal: Map<number, number>,
): Promise<number> {
  const originals = await tx
    .select()
    .from(ticketLineaConsumosTable)
    .where(
      and(
        eq(ticketLineaConsumosTable.ticketId, ticketId),
        eq(ticketLineaConsumosTable.tipo, "CONSUMO"),
      ),
    );
  if (!originals.length) return 0;
  const reversed = await tx
    .select({ reversaDeId: ticketLineaConsumosTable.reversaDeId })
    .from(ticketLineaConsumosTable)
    .where(
      and(
        eq(ticketLineaConsumosTable.ticketId, ticketId),
        eq(ticketLineaConsumosTable.tipo, "REVERSA"),
      ),
    );
  const already = new Set(
    reversed
      .map((row) => row.reversaDeId)
      .filter((id): id is number => id != null),
  );
  const rows = originals
    .filter((row) => !already.has(row.id))
    .map((row) => {
      const movimientoId = cancellationMovementByOriginal.get(
        row.movimientoId ?? -1,
      );
      if (movimientoId == null) {
        throw new Error(
          `Falta movimiento de cancelación para la asignación ${row.id}.`,
        );
      }
      return {
        ticketId: row.ticketId,
        ticketLineaId: row.ticketLineaId,
        movimientoId,
        rolloId: row.rolloId,
        entradaId: row.entradaId,
        proveedorId: row.proveedorId,
        cantidadMilesimas: row.cantidadMilesimas,
        ingresoCentavos: row.ingresoCentavos,
        costoCentavos: row.costoCentavos,
        tipo: "REVERSA" as const,
        reversaDeId: row.id,
        idempotencia: `ticket:${ticketId}:reversa:${row.id}`,
      };
    });
  if (!rows.length) return 0;
  await tx
    .insert(ticketLineaConsumosTable)
    .values(rows)
    .onConflictDoNothing({ target: ticketLineaConsumosTable.idempotencia });
  return rows.length;
}
