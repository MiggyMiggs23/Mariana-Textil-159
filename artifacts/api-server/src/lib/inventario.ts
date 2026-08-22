/**
 * Inventory engine for Mariana Textil.
 *
 * CONTRACT:
 *  - Every function that mutates rollos / movimientos / existencias accepts
 *    `tx` as its first argument. Callers (routes, batch handlers) open the
 *    transaction and pass it in – the engine never opens its own.
 *  - Read-only maintenance functions (conciliarTodo, recalcularExistencias)
 *    may own their transactions because they only need consistent snapshots or
 *    sequential repair passes.
 *  - No route handler may write these tables directly.
 *
 * Accounting invariant:
 *  existencias.cantidad_total = SUM(movimientos.cantidad) for each
 *  (producto_id, ubicacion_id) pair. This is enforced by refreshCache()
 *  which is called at the end of every mutating operation.
 */

import { and, eq, sql, desc, count, gte, lte } from "drizzle-orm";
import {
  db,
  existenciasTable,
  movimientosTable,
  productosTable,
  rollosTable,
  seriesConsecutivoTable,
  type EstadoRollo,
  type TipoMovimiento,
} from "@workspace/db";

// ── Drizzle transaction type ──────────────────────────────────────────────────
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Errors ────────────────────────────────────────────────────────────────────

export class InventarioError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "InventarioError";
  }
}

// ── Series allocation ─────────────────────────────────────────────────────────

/** Advisory lock key for series allocation (ASCII "SER" = 0x534552) */
const SERIES_LOCK_KEY = 0x534552;

/**
 * Atomically reserve the next series number for a SKU.
 * Acquires a transaction-scoped advisory lock so concurrent transactions
 * serialize on the same SKU counter. Must be called inside a tx.
 */
async function nextSeriesNumber(tx: Tx, sku: string): Promise<number> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${SERIES_LOCK_KEY})`);

  const [row] = await tx
    .select()
    .from(seriesConsecutivoTable)
    .where(eq(seriesConsecutivoTable.sku, sku))
    .for("update");

  if (row) {
    const next = row.ultimoNumero + 1;
    await tx
      .update(seriesConsecutivoTable)
      .set({ ultimoNumero: next })
      .where(eq(seriesConsecutivoTable.sku, sku));
    return next;
  }

  await tx.insert(seriesConsecutivoTable).values({ sku, ultimoNumero: 1 });
  return 1;
}

/** Build series string: {SKU}-{number zero-padded to 6 digits} */
function buildSerie(sku: string, num: number): string {
  return `${sku}-${String(num).padStart(6, "0")}`;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * Recompute (producto, ubicacion) cache from movements and DISPONIBLE/EN_TRANSITO
 * roll counts. Must be called inside the same tx as the mutation.
 */
async function refreshCache(
  tx: Tx,
  productoId: number,
  ubicacionId: number,
): Promise<void> {
  // cantidad_total = SUM of all movements for this pair
  const [sumRow] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(cantidad), 0)::text`,
    })
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.productoId, productoId),
        eq(movimientosTable.ubicacionId, ubicacionId),
      ),
    );

  // rollos_count = count of rolls in countable states at this location
  const [cntRow] = await tx
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(rollosTable)
    .where(
      and(
        eq(rollosTable.productoId, productoId),
        eq(rollosTable.ubicacionId, ubicacionId),
        sql`${rollosTable.estado} IN ('DISPONIBLE','EN_TRANSITO')`,
      ),
    );

  const cantidadTotal = sumRow?.total ?? "0";
  const rollosCount = cntRow?.cnt ?? 0;

  await tx
    .insert(existenciasTable)
    .values({ productoId, ubicacionId, cantidadTotal, rollosCount })
    .onConflictDoUpdate({
      target: [existenciasTable.productoId, existenciasTable.ubicacionId],
      set: { cantidadTotal, rollosCount },
    });
}

/**
 * Get the latest saldo_posterior from movements for a (producto, ubicacion).
 * Returns "0" if no movements exist yet.
 */
async function getSaldo(
  tx: Tx,
  productoId: number,
  ubicacionId: number,
): Promise<string> {
  const [row] = await tx
    .select({ saldo: movimientosTable.saldoPosterior })
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.productoId, productoId),
        eq(movimientosTable.ubicacionId, ubicacionId),
      ),
    )
    .orderBy(desc(movimientosTable.id))
    .limit(1);

  return row?.saldo ?? "0";
}

/**
 * Record a movement row and return it. Computes saldo_posterior from the
 * current ledger total plus this movement's quantity.
 */
async function insertMovimiento(
  tx: Tx,
  args: {
    rolloId: number;
    productoId: number;
    ubicacionId: number;
    tipo: TipoMovimiento;
    cantidad: string; // signed
    usuarioId: number;
    justificacion?: string | null;
    revisado?: boolean;
    documentoTipo?: string | null;
    documentoId?: string | null;
    movimientoOrigenId?: number | null;
    uuidCliente?: string | null;
  },
): Promise<typeof movimientosTable.$inferSelect> {
  const saldoAntes = await getSaldo(tx, args.productoId, args.ubicacionId);
  const saldoPosterior = (
    parseFloat(saldoAntes) + parseFloat(args.cantidad)
  ).toFixed(3);

  const [mov] = await tx
    .insert(movimientosTable)
    .values({
      rolloId: args.rolloId,
      productoId: args.productoId,
      ubicacionId: args.ubicacionId,
      tipo: args.tipo,
      cantidad: args.cantidad,
      saldoPosterior,
      usuarioId: args.usuarioId,
      justificacion: args.justificacion ?? null,
      revisado: args.revisado ?? true,
      documentoTipo: args.documentoTipo ?? null,
      documentoId: args.documentoId ?? null,
      movimientoOrigenId: args.movimientoOrigenId ?? null,
      uuidCliente: args.uuidCliente ?? null,
    })
    .returning();

  return mov!;
}

// ── State transition guard ────────────────────────────────────────────────────

const VALID_TRANSITIONS: Partial<Record<EstadoRollo, EstadoRollo[]>> = {
  PROGRAMADO: ["DISPONIBLE"],
  DISPONIBLE: ["EN_TRANSITO", "ABIERTO", "VENDIDO", "BAJA"],
  EN_TRANSITO: ["DISPONIBLE", "BAJA"],
  ABIERTO: [], // terminal – cannot transition back
  VENDIDO: [], // terminal
  BAJA: [], // terminal
};

function assertTransition(from: EstadoRollo, to: EstadoRollo): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InventarioError(
      `Transición de estado inválida: ${from} → ${to}`,
      "INVALID_TRANSITION",
    );
  }
}

// ── UUID-client idempotency helper ────────────────────────────────────────────

/**
 * If uuidCliente is provided and a movement with that UUID already exists,
 * return the existing movement (caller should short-circuit and return it).
 * Returns null if no duplicate found.
 */
async function checkUuidCliente(
  tx: Tx,
  uuidCliente: string | null | undefined,
): Promise<typeof movimientosTable.$inferSelect | null> {
  if (!uuidCliente) return null;

  const [existing] = await tx
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.uuidCliente, uuidCliente))
    .limit(1);

  return existing ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENGINE API
// All functions accept tx as the first argument (passed in by the caller).
// ─────────────────────────────────────────────────────────────────────────────

export type CrearRolloInput = {
  productoId: number;
  ubicacionId: number;
  proveedorId?: number | null;
  cantidadInicial: string;
  costoUnitario: string;
  notas?: string | null;
  usuarioId: number;
  estado?: "PROGRAMADO" | "DISPONIBLE";
  uuidCliente?: string | null;
};

export type CrearRolloResult = {
  rollo: typeof rollosTable.$inferSelect;
  movimiento: typeof movimientosTable.$inferSelect | null;
};

/**
 * Create a single roll.
 * - estado DISPONIBLE → records ALTA movement + updates cache
 * - estado PROGRAMADO → no movement, no cache update
 *
 * For batch manual intake, create multiple DISPONIBLE rolls inside ONE caller
 * transaction. Do NOT create PROGRAMADO then activate one-by-one.
 */
export async function crearRollo(
  tx: Tx,
  input: CrearRolloInput,
): Promise<CrearRolloResult> {
  // Idempotency
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, input.uuidCliente);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      return { rollo: rollo!, movimiento: dup };
    }
  }

  const [producto] = await tx
    .select({ sku: productosTable.sku })
    .from(productosTable)
    .where(eq(productosTable.id, input.productoId))
    .limit(1);

  if (!producto) {
    throw new InventarioError("Producto no encontrado.", "PRODUCTO_NOT_FOUND");
  }

  const num = await nextSeriesNumber(tx, producto.sku);
  const serie = buildSerie(producto.sku, num);
  const estado: EstadoRollo = input.estado ?? "PROGRAMADO";

  const costoTotal = (
    parseFloat(input.cantidadInicial) * parseFloat(input.costoUnitario)
  ).toFixed(2);

  const [rollo] = await tx
    .insert(rollosTable)
    .values({
      serie,
      productoId: input.productoId,
      ubicacionId: input.ubicacionId,
      proveedorId: input.proveedorId ?? null,
      estado,
      cantidadInicial: input.cantidadInicial,
      cantidadActual: input.cantidadInicial,
      costoUnitario: input.costoUnitario,
      costoTotal,
      notas: input.notas ?? null,
    })
    .returning();

  let movimiento: typeof movimientosTable.$inferSelect | null = null;

  if (estado === "DISPONIBLE") {
    movimiento = await insertMovimiento(tx, {
      rolloId: rollo!.id,
      productoId: input.productoId,
      ubicacionId: input.ubicacionId,
      tipo: "ALTA",
      cantidad: input.cantidadInicial,
      usuarioId: input.usuarioId,
      uuidCliente: input.uuidCliente ?? null,
    });
    await refreshCache(tx, input.productoId, input.ubicacionId);
  }

  return { rollo: rollo!, movimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type ActivarRolloInput = {
  rolloId: number;
  cantidadReal: string;
  usuarioId: number;
  notas?: string | null;
  uuidCliente?: string | null;
};

export type ActivarRolloResult = {
  rollo: typeof rollosTable.$inferSelect;
  movimiento: typeof movimientosTable.$inferSelect;
};

/**
 * Activate a PROGRAMADO roll: sets state to DISPONIBLE, optionally adjusts
 * cantidadActual / cantidadInicial if cantidadReal differs, records RECEPCION.
 */
export async function activarRollo(
  tx: Tx,
  input: ActivarRolloInput,
): Promise<ActivarRolloResult> {
  // Idempotency
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, input.uuidCliente);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      return { rollo: rollo!, movimiento: dup };
    }
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) {
    throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
  }

  assertTransition(rollo.estado, "DISPONIBLE");

  const cantidadReal = input.cantidadReal;
  const cantidadChanged =
    parseFloat(cantidadReal) !== parseFloat(rollo.cantidadInicial);

  let notas = input.notas ?? rollo.notas;
  if (cantidadChanged && !input.notas) {
    notas = `Recepción con cantidad ajustada: original ${rollo.cantidadInicial}, real ${cantidadReal}`;
  }

  await tx
    .update(rollosTable)
    .set({
      estado: "DISPONIBLE",
      cantidadActual: cantidadReal,
      cantidadInicial: cantidadReal, // align initial to received quantity
      notas,
    })
    .where(eq(rollosTable.id, input.rolloId));

  const movimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: rollo.ubicacionId,
    tipo: "RECEPCION",
    cantidad: cantidadReal,
    usuarioId: input.usuarioId,
    uuidCliente: input.uuidCliente ?? null,
  });

  await refreshCache(tx, rollo.productoId, rollo.ubicacionId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .limit(1);

  return { rollo: updated!, movimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type MoverRolloInput = {
  rolloId: number;
  ubicacionOrigenId: number; // must match rollo.ubicacionId
  ubicacionTransitoId: number;
  usuarioId: number;
  justificacion?: string | null;
  uuidCliente?: string | null;
};

export type MoverRolloResult = {
  rollo: typeof rollosTable.$inferSelect;
  salidaMovimiento: typeof movimientosTable.$inferSelect;
  entradaTransitoMovimiento: typeof movimientosTable.$inferSelect;
};

/**
 * PHASE 1 of a transfer: DISPONIBLE → EN_TRANSITO.
 * Records TRANSFERENCIA_SALIDA at origin and TRANSFERENCIA_ENTRADA at transit.
 * Consolidated quantity is unchanged: one location loses, transit gains.
 */
export async function moverRollo(
  tx: Tx,
  input: MoverRolloInput,
): Promise<MoverRolloResult> {
  // Idempotency
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, `${input.uuidCliente}:salida`);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      const [ent] = await tx
        .select()
        .from(movimientosTable)
        .where(eq(movimientosTable.uuidCliente, `${input.uuidCliente}:entrada_transito`))
        .limit(1);
      return { rollo: rollo!, salidaMovimiento: dup, entradaTransitoMovimiento: ent! };
    }
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
  if (rollo.ubicacionId !== input.ubicacionOrigenId) {
    throw new InventarioError(
      "El rollo no se encuentra en la ubicación de origen indicada.",
      "LOCATION_MISMATCH",
    );
  }

  assertTransition(rollo.estado, "EN_TRANSITO");

  // Move rollo to transit location and set EN_TRANSITO
  await tx
    .update(rollosTable)
    .set({ estado: "EN_TRANSITO", ubicacionId: input.ubicacionTransitoId })
    .where(eq(rollosTable.id, input.rolloId));

  // TRANSFERENCIA_SALIDA at origin (negative)
  const salidaMovimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: input.ubicacionOrigenId,
    tipo: "TRANSFERENCIA_SALIDA",
    cantidad: `-${rollo.cantidadActual}`,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null,
    uuidCliente: input.uuidCliente ? `${input.uuidCliente}:salida` : null,
  });

  // TRANSFERENCIA_ENTRADA at transit location (positive)
  const entradaTransitoMovimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: input.ubicacionTransitoId,
    tipo: "TRANSFERENCIA_ENTRADA",
    cantidad: rollo.cantidadActual,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null,
    uuidCliente: input.uuidCliente ? `${input.uuidCliente}:entrada_transito` : null,
  });

  await refreshCache(tx, rollo.productoId, input.ubicacionOrigenId);
  await refreshCache(tx, rollo.productoId, input.ubicacionTransitoId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .limit(1);

  return { rollo: updated!, salidaMovimiento, entradaTransitoMovimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type RecibirTransferenciaInput = {
  rolloId: number;
  ubicacionDestinoId: number;
  usuarioId: number;
  justificacion?: string | null;
  uuidCliente?: string | null;
};

export type RecibirTransferenciaResult = {
  rollo: typeof rollosTable.$inferSelect;
  salidaTransitoMovimiento: typeof movimientosTable.$inferSelect;
  entradaDestinoMovimiento: typeof movimientosTable.$inferSelect;
};

/**
 * PHASE 2 of a transfer: EN_TRANSITO → DISPONIBLE at destination.
 * Records TRANSFERENCIA_SALIDA at transit and TRANSFERENCIA_ENTRADA at destination.
 */
export async function recibirTransferencia(
  tx: Tx,
  input: RecibirTransferenciaInput,
): Promise<RecibirTransferenciaResult> {
  // Idempotency
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, `${input.uuidCliente}:salida_transito`);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      const [ent] = await tx
        .select()
        .from(movimientosTable)
        .where(eq(movimientosTable.uuidCliente, `${input.uuidCliente}:entrada_destino`))
        .limit(1);
      return { rollo: rollo!, salidaTransitoMovimiento: dup, entradaDestinoMovimiento: ent! };
    }
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
  assertTransition(rollo.estado, "DISPONIBLE");

  if (rollo.estado !== "EN_TRANSITO") {
    throw new InventarioError(
      "El rollo no está EN_TRANSITO.",
      "NOT_IN_TRANSIT",
    );
  }

  const transitoId = rollo.ubicacionId;

  // Move rollo to destination and set DISPONIBLE
  await tx
    .update(rollosTable)
    .set({ estado: "DISPONIBLE", ubicacionId: input.ubicacionDestinoId })
    .where(eq(rollosTable.id, input.rolloId));

  // TRANSFERENCIA_SALIDA at transit (negative)
  const salidaTransitoMovimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: transitoId,
    tipo: "TRANSFERENCIA_SALIDA",
    cantidad: `-${rollo.cantidadActual}`,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null,
    uuidCliente: input.uuidCliente ? `${input.uuidCliente}:salida_transito` : null,
  });

  // TRANSFERENCIA_ENTRADA at destination (positive)
  const entradaDestinoMovimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: input.ubicacionDestinoId,
    tipo: "TRANSFERENCIA_ENTRADA",
    cantidad: rollo.cantidadActual,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null,
    uuidCliente: input.uuidCliente ? `${input.uuidCliente}:entrada_destino` : null,
  });

  await refreshCache(tx, rollo.productoId, transitoId);
  await refreshCache(tx, rollo.productoId, input.ubicacionDestinoId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .limit(1);

  return { rollo: updated!, salidaTransitoMovimiento, entradaDestinoMovimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type SalidaMostradorInput = {
  rolloId: number;
  usuarioId: number;
  justificacion?: string | null;
  uuidCliente?: string | null;
};

/**
 * DISPONIBLE → ABIERTO (terminal). Records SALIDA_MOSTRADOR (negative).
 * An ABIERTO roll can never return to inventory.
 */
export async function salidaMostrador(
  tx: Tx,
  input: SalidaMostradorInput,
): Promise<{
  rollo: typeof rollosTable.$inferSelect;
  movimiento: typeof movimientosTable.$inferSelect;
}> {
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, input.uuidCliente);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      return { rollo: rollo!, movimiento: dup };
    }
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
  assertTransition(rollo.estado, "ABIERTO");

  await tx
    .update(rollosTable)
    .set({ estado: "ABIERTO" })
    .where(eq(rollosTable.id, input.rolloId));

  const movimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: rollo.ubicacionId,
    tipo: "SALIDA_MOSTRADOR",
    cantidad: `-${rollo.cantidadActual}`,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null,
    uuidCliente: input.uuidCliente ?? null,
  });

  await refreshCache(tx, rollo.productoId, rollo.ubicacionId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .limit(1);

  return { rollo: updated!, movimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type VenderRolloInput = {
  rolloId: number;
  usuarioId: number;
  justificacion?: string | null;
  uuidCliente?: string | null;
};

/**
 * DISPONIBLE → VENDIDO. Records VENTA (negative).
 * Must be DISPONIBLE – ABIERTO rolls are already off the shelf.
 */
export async function venderRollo(
  tx: Tx,
  input: VenderRolloInput,
): Promise<{
  rollo: typeof rollosTable.$inferSelect;
  movimiento: typeof movimientosTable.$inferSelect;
}> {
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, input.uuidCliente);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      return { rollo: rollo!, movimiento: dup };
    }
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
  assertTransition(rollo.estado, "VENDIDO");

  await tx
    .update(rollosTable)
    .set({ estado: "VENDIDO" })
    .where(eq(rollosTable.id, input.rolloId));

  const movimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: rollo.ubicacionId,
    tipo: "VENTA",
    cantidad: `-${rollo.cantidadActual}`,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null,
    uuidCliente: input.uuidCliente ?? null,
  });

  await refreshCache(tx, rollo.productoId, rollo.ubicacionId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .limit(1);

  return { rollo: updated!, movimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type AjustarRolloInput = {
  rolloId: number;
  cantidadNueva?: string | null; // null or omitted = BAJA
  justificacion: string; // minimum 10 chars
  usuarioId: number;
  uuidCliente?: string | null;
};

/**
 * Adjust quantity or mark as BAJA.
 * - justificacion must be at least 10 characters.
 * - cantidadNueva must not produce negative current quantity.
 * - Records AJUSTE_POSITIVO / AJUSTE_NEGATIVO with revisado=false.
 * - If cantidadNueva is null/omitted, records AJUSTE_NEGATIVO for full
 *   remaining quantity and sets estado=BAJA.
 */
export async function ajustarRollo(
  tx: Tx,
  input: AjustarRolloInput,
): Promise<{
  rollo: typeof rollosTable.$inferSelect;
  movimiento: typeof movimientosTable.$inferSelect;
}> {
  const justificacion = input.justificacion.trim();
  if (justificacion.length < 10) {
    throw new InventarioError(
      "La justificación debe tener al menos 10 caracteres.",
      "JUSTIFICACION_REQUIRED",
    );
  }

  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, input.uuidCliente);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      return { rollo: rollo!, movimiento: dup };
    }
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");

  if (!["DISPONIBLE", "EN_TRANSITO"].includes(rollo.estado)) {
    throw new InventarioError(
      "Solo se pueden ajustar rollos DISPONIBLES o EN_TRANSITO.",
      "INVALID_ESTADO",
    );
  }

  const esBaja = input.cantidadNueva == null;
  const cantidadAntes = parseFloat(rollo.cantidadActual);

  let diff: number;
  let tipo: TipoMovimiento;
  let cantidadNueva: string;
  let estadoNuevo: EstadoRollo = rollo.estado;

  if (esBaja) {
    diff = -cantidadAntes;
    tipo = "AJUSTE_NEGATIVO";
    cantidadNueva = "0.000";
    estadoNuevo = "BAJA";
  } else {
    const nueva = parseFloat(input.cantidadNueva!);
    if (nueva < 0) {
      throw new InventarioError(
        "La cantidad no puede ser negativa.",
        "NEGATIVE_QUANTITY",
      );
    }
    diff = nueva - cantidadAntes;
    if (diff === 0) {
      throw new InventarioError(
        "La cantidad nueva es igual a la actual.",
        "NO_CHANGE",
      );
    }
    tipo = diff > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";
    cantidadNueva = nueva.toFixed(3);
  }

  await tx
    .update(rollosTable)
    .set({ cantidadActual: cantidadNueva, estado: estadoNuevo })
    .where(eq(rollosTable.id, input.rolloId));

  const movimiento = await insertMovimiento(tx, {
    rolloId: input.rolloId,
    productoId: rollo.productoId,
    ubicacionId: rollo.ubicacionId,
    tipo,
    cantidad: diff.toFixed(3),
    usuarioId: input.usuarioId,
    justificacion,
    revisado: false,
    uuidCliente: input.uuidCliente ?? null,
  });

  await refreshCache(tx, rollo.productoId, rollo.ubicacionId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId))
    .limit(1);

  return { rollo: updated!, movimiento };
}

// ─────────────────────────────────────────────────────────────────────────────

export type RevertirMovimientoInput = {
  movimientoOrigenId: number;
  usuarioId: number;
  justificacion?: string | null;
  uuidCliente?: string | null;
};

/**
 * Reverse a movement by recording a CANCELACION that references the original.
 * Restores rollo state and quantity where applicable.
 * The original movement is never deleted.
 */
export async function revertirMovimiento(
  tx: Tx,
  input: RevertirMovimientoInput,
): Promise<{
  rollo: typeof rollosTable.$inferSelect;
  movimiento: typeof movimientosTable.$inferSelect;
}> {
  if (input.uuidCliente) {
    const dup = await checkUuidCliente(tx, input.uuidCliente);
    if (dup) {
      const [rollo] = await tx
        .select()
        .from(rollosTable)
        .where(eq(rollosTable.id, dup.rolloId))
        .limit(1);
      return { rollo: rollo!, movimiento: dup };
    }
  }

  const [orig] = await tx
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.id, input.movimientoOrigenId))
    .for("update")
    .limit(1);

  if (!orig) {
    throw new InventarioError("Movimiento no encontrado.", "MOVIMIENTO_NOT_FOUND");
  }

  // Check it hasn't already been cancelled
  const [existing] = await tx
    .select({ id: movimientosTable.id })
    .from(movimientosTable)
    .where(eq(movimientosTable.movimientoOrigenId, input.movimientoOrigenId))
    .limit(1);

  if (existing) {
    throw new InventarioError(
      "El movimiento ya fue cancelado.",
      "ALREADY_CANCELLED",
    );
  }

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, orig.rolloId))
    .for("update")
    .limit(1);

  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");

  // Determine restoration: CANCELACION records the inverse signed quantity
  const inversaCantidad = (parseFloat(orig.cantidad) * -1).toFixed(3);

  // Restore roll state where sensible
  // Movements that change state: ALTA/RECEPCION→PROGRAMADO, AJUSTE→restore qty,
  // TRANSFERENCIA_SALIDA→restore origin state, etc.
  // For simplicity: if the movement increased quantity, decrease back; vice-versa.
  // State restoration:
  const estadoAnterior = estadoAntesDe(orig.tipo, rollo.estado);
  const cantidadRestore = (
    parseFloat(rollo.cantidadActual) + parseFloat(inversaCantidad)
  ).toFixed(3);

  await tx
    .update(rollosTable)
    .set({
      cantidadActual: cantidadRestore,
      estado: estadoAnterior,
    })
    .where(eq(rollosTable.id, orig.rolloId));

  const cancelacion = await insertMovimiento(tx, {
    rolloId: orig.rolloId,
    productoId: orig.productoId,
    ubicacionId: orig.ubicacionId,
    tipo: "CANCELACION",
    cantidad: inversaCantidad,
    usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? `Cancelación del movimiento #${input.movimientoOrigenId}`,
    movimientoOrigenId: input.movimientoOrigenId,
    uuidCliente: input.uuidCliente ?? null,
  });

  await refreshCache(tx, orig.productoId, orig.ubicacionId);

  const [updated] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, orig.rolloId))
    .limit(1);

  return { rollo: updated!, movimiento: cancelacion };
}

/**
 * Infer what state the roll should return to when cancelling a given
 * movement type from the current state.
 */
function estadoAntesDe(tipo: TipoMovimiento, estadoActual: EstadoRollo): EstadoRollo {
  switch (tipo) {
    case "ALTA":
    case "RECEPCION":
      return "PROGRAMADO";
    case "VENTA":
      return "DISPONIBLE";
    case "SALIDA_MOSTRADOR":
      return "DISPONIBLE";
    case "TRANSFERENCIA_SALIDA":
      return "DISPONIBLE";
    case "TRANSFERENCIA_ENTRADA":
      return "EN_TRANSITO";
    case "AJUSTE_POSITIVO":
    case "AJUSTE_NEGATIVO":
      return estadoActual === "BAJA" ? "DISPONIBLE" : estadoActual;
    default:
      return estadoActual;
  }
}

// ── Maintenance (own-transaction) ─────────────────────────────────────────────

export type ConciliacionFila = {
  productoId: number;
  ubicacionId: number;
  cantidadMovimientos: string;
  cantidadCache: string;
  rollosMovimientos: number;
  rollosCache: number;
  discrepancia: boolean;
};

/**
 * Compare movements sum vs cache for EVERY (producto, ubicacion) pair that
 * appears in either movements or the cache. Returns all rows including
 * missing-cache discrepancies.
 */
export async function conciliarTodo(
  productoId?: number,
  ubicacionId?: number,
): Promise<ConciliacionFila[]> {
  return db.transaction(async (tx) => {
    // Aggregate movements
    const conditions = [];
    if (productoId !== undefined)
      conditions.push(eq(movimientosTable.productoId, productoId));
    if (ubicacionId !== undefined)
      conditions.push(eq(movimientosTable.ubicacionId, ubicacionId));

    const movAgg = await tx
      .select({
        productoId: movimientosTable.productoId,
        ubicacionId: movimientosTable.ubicacionId,
        total: sql<string>`SUM(cantidad)::text`,
      })
      .from(movimientosTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(movimientosTable.productoId, movimientosTable.ubicacionId);

    // Aggregate cache
    const cacheConditions = [];
    if (productoId !== undefined)
      cacheConditions.push(eq(existenciasTable.productoId, productoId));
    if (ubicacionId !== undefined)
      cacheConditions.push(eq(existenciasTable.ubicacionId, ubicacionId));

    const cacheRows = await tx
      .select()
      .from(existenciasTable)
      .where(cacheConditions.length ? and(...cacheConditions) : undefined);

    // Build union of keys
    type Key = `${number}:${number}`;
    const keyMap = new Map<
      Key,
      { movTotal: string; cacheTotal: string; rollosCache: number }
    >();

    for (const r of movAgg) {
      const k: Key = `${r.productoId}:${r.ubicacionId}`;
      const existing = keyMap.get(k);
      keyMap.set(k, {
        movTotal: r.total,
        cacheTotal: existing?.cacheTotal ?? "0",
        rollosCache: existing?.rollosCache ?? 0,
      });
    }
    for (const r of cacheRows) {
      const k: Key = `${r.productoId}:${r.ubicacionId}`;
      const existing = keyMap.get(k) ?? { movTotal: "0", cacheTotal: "0", rollosCache: 0 };
      keyMap.set(k, {
        movTotal: existing.movTotal,
        cacheTotal: r.cantidadTotal,
        rollosCache: r.rollosCount,
      });
    }

    const results: ConciliacionFila[] = [];
    for (const [key, v] of keyMap) {
      const [pId, uId] = key.split(":").map(Number) as [number, number];
      const movTotalF = parseFloat(v.movTotal).toFixed(3);
      const cacheTotalF = parseFloat(v.cacheTotal).toFixed(3);

      // rollosMovimientos = count of DISPONIBLE/EN_TRANSITO rolls
      const [cntRow] = await tx
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(rollosTable)
        .where(
          and(
            eq(rollosTable.productoId, pId),
            eq(rollosTable.ubicacionId, uId),
            sql`${rollosTable.estado} IN ('DISPONIBLE','EN_TRANSITO')`,
          ),
        );

      results.push({
        productoId: pId,
        ubicacionId: uId,
        cantidadMovimientos: movTotalF,
        cantidadCache: cacheTotalF,
        rollosMovimientos: cntRow?.cnt ?? 0,
        rollosCache: v.rollosCache,
        discrepancia: movTotalF !== cacheTotalF,
      });
    }

    return results;
  });
}

/**
 * Rebuild the existencias cache for a specific (producto, ubicacion) pair
 * from movement sums and countable roll states.
 */
export async function recalcularExistencias(
  productoId: number,
  ubicacionId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await refreshCache(tx, productoId, ubicacionId);
  });
}

// ── Dashboard helper ──────────────────────────────────────────────────────────

export type InventarioUbicacionSummary = {
  ubicacionId: number;
  rollos: number;
  metros: string;
  kilos: string;
};

/**
 * Returns inventory totals per location for dashboard display.
 * Separates METRO and KILO products to avoid mixing units.
 */
export async function getInventarioPorUbicacion(
  ubicacionIds?: number[],
): Promise<InventarioUbicacionSummary[]> {
  const whereClause =
    ubicacionIds && ubicacionIds.length > 0
      ? and(
          sql`${rollosTable.estado} IN ('DISPONIBLE','EN_TRANSITO')`,
          sql`${rollosTable.ubicacionId} = ANY(ARRAY[${sql.join(
            ubicacionIds.map((id) => sql`${id}`),
            sql`,`,
          )}])`,
        )
      : sql`${rollosTable.estado} IN ('DISPONIBLE','EN_TRANSITO')`;

  const rows = await db
    .select({
      ubicacionId: rollosTable.ubicacionId,
      unidad: productosTable.unidad,
      rollos: sql<number>`count(*)::int`,
      cantidad: sql<string>`coalesce(sum(${rollosTable.cantidadActual}),0)::text`,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
    .where(whereClause)
    .groupBy(rollosTable.ubicacionId, productosTable.unidad);

  const map = new Map<
    number,
    { rollos: number; metros: number; kilos: number }
  >();
  for (const row of rows) {
    const cur = map.get(row.ubicacionId) ?? {
      rollos: 0,
      metros: 0,
      kilos: 0,
    };
    cur.rollos += row.rollos;
    if (row.unidad === "METRO") {
      cur.metros += parseFloat(row.cantidad ?? "0");
    } else {
      cur.kilos += parseFloat(row.cantidad ?? "0");
    }
    map.set(row.ubicacionId, cur);
  }

  return Array.from(map.entries()).map(([ubicacionId, v]) => ({
    ubicacionId,
    rollos: v.rollos,
    metros: v.metros.toFixed(3),
    kilos: v.kilos.toFixed(3),
  }));
}

// ── Pending-review count ──────────────────────────────────────────────────────

export async function countAjustesPendientes(): Promise<number> {
  const [row] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(movimientosTable)
    .where(eq(movimientosTable.revisado, false));
  return row?.cnt ?? 0;
}

export async function revisarAjuste(
  movimientoId: number,
  revisorId: number,
): Promise<void> {
  const [mov] = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.id, movimientoId))
    .limit(1);
  if (!mov) throw new InventarioError("Movimiento no encontrado.", "MOVIMIENTO_NOT_FOUND");
  if (mov.revisado) throw new InventarioError("El movimiento ya fue revisado.", "ALREADY_REVIEWED");

  await db
    .update(movimientosTable)
    .set({ revisado: true, revisadoPor: revisorId, revisadoAt: new Date() })
    .where(eq(movimientosTable.id, movimientoId));
}
