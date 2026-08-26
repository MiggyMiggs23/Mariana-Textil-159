/**
 * Inventory engine for Mariana Textil.
 *
 * CONTRACT:
 *  - Every function that mutates rollos / movimientos / existencias accepts
 *    `tx` as its first argument. Callers (routes, batch handlers) open the
 *    transaction and pass it in – the engine never opens its own.
 *  - Maintenance functions (conciliarTodo, recalcularExistencias,
 *    reconstruirCacheExistencias)
 *    may own their transactions because they only need consistent snapshots or
 *    sequential repair passes.
 *  - No route handler may write these tables directly.
 *
 * Accounting invariant:
 *  existencias.cantidad_total = SUM(movimientos.cantidad) for each
 *  (producto_id, ubicacion_id) pair. This is enforced by refreshCache()
 *  which is called at the end of every mutating operation.
 */

import { createHash } from "node:crypto";
import { and, eq, sql, desc, count, gte, inArray, lte } from "drizzle-orm";
import {
  auditoriaTable,
  contenedoresTable,
  db,
  entradasTable,
  entradaFolioTable,
  existenciasTable,
  movimientosTable,
  pagosProveedorTable,
  productosTable,
  proveedoresTable,
  rollosTable,
  seriesConsecutivoTable,
  ubicacionesTable,
  usuariosTable,
  type EstadoRollo,
  type TipoMovimiento,
} from "@workspace/db";
import {
  isValidUnitCost,
  rollWithoutValidUnitCostMessage,
} from "./unit-cost";
import {
  formatQuantityThousandths,
  quantityToThousandths,
} from "./quantity-comparison";

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

/** Single-row control table id for the global series counter. */
const SERIES_ROW_ID = 1;

/**
 * Atomically reserve the next N global series numbers.
 * Locks the single control row FOR UPDATE so concurrent transactions serialize,
 * guaranteeing globally consecutive numbers that are never reused. The counter
 * is seeded with 1000000 so the first series is 1000001. Must be called inside
 * a tx. Returns the numeric strings in allocation order.
 */
async function reserveSeries(tx: Tx, quantity: number): Promise<string[]> {
  await tx
    .insert(seriesConsecutivoTable)
    .values({ id: SERIES_ROW_ID, ultimoNumero: 1000000 })
    .onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(seriesConsecutivoTable)
    .where(eq(seriesConsecutivoTable.id, SERIES_ROW_ID))
    .for("update");

  const start = row!.ultimoNumero;
  const next = start + quantity;

  await tx
    .update(seriesConsecutivoTable)
    .set({ ultimoNumero: next })
    .where(eq(seriesConsecutivoTable.id, SERIES_ROW_ID));

  const series: string[] = [];
  for (let i = 1; i <= quantity; i++) {
    series.push(String(start + i));
  }
  return series;
}

/**
 * Atomically reserve the next entry folio at a site. The site counter is
 * created at zero, so a new site starts at folio 1.
 */
async function reserveFolio(tx: Tx, ubicacionId: number): Promise<number> {
  await tx
    .insert(entradaFolioTable)
    .values({ ubicacionId, ultimoFolio: 0 })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(entradaFolioTable)
    .where(eq(entradaFolioTable.ubicacionId, ubicacionId))
    .for("update");

  const next = row!.ultimoFolio + 1;
  await tx
    .update(entradaFolioTable)
    .set({ ultimoFolio: next })
    .where(eq(entradaFolioTable.ubicacionId, ubicacionId));

  return next;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * Recompute (producto, ubicacion) cache from the signed movement sum and the
 * count of DISPONIBLE rolls at that location. Must be called inside the same tx
 * as the mutation.
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

  // rollos_count = count of DISPONIBLE rolls physically on hand at this location
  const [cntRow] = await tx
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(rollosTable)
    .where(
      and(
        eq(rollosTable.productoId, productoId),
        eq(rollosTable.ubicacionId, ubicacionId),
        eq(rollosTable.estado, "DISPONIBLE"),
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
  PROGRAMADO: ["DISPONIBLE", "BAJA"],
  DISPONIBLE: ["EN_TRANSITO", "ABIERTO", "VENDIDO", "BAJA", "PROGRAMADO"],
  EN_TRANSITO: ["DISPONIBLE", "BAJA"],
  ABIERTO: [], // terminal – cannot transition back, not even by reversal
  VENDIDO: ["DISPONIBLE"], // reversal: cancel sale / register return
  BAJA: ["DISPONIBLE"], // reversal: undo erroneous write-off
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

  if (!isValidUnitCost(input.costoUnitario)) {
    throw new InventarioError(
      "El costo unitario debe ser mayor a cero.",
      "INVALID_UNIT_COST",
    );
  }

  const [producto] = await tx
    .select({ sku: productosTable.sku })
    .from(productosTable)
    .where(eq(productosTable.id, input.productoId))
    .limit(1);

  if (!producto) {
    throw new InventarioError("Producto no encontrado.", "PRODUCTO_NOT_FOUND");
  }

  const [serie] = await reserveSeries(tx, 1);
  const estado: EstadoRollo = input.estado ?? "PROGRAMADO";

  const costoTotal = (
    parseFloat(input.cantidadInicial) * parseFloat(input.costoUnitario)
  ).toFixed(2);

  const [rollo] = await tx
    .insert(rollosTable)
    .values({
      serie: serie!,
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
// ENTRADA (whole entry) — high-level engine operation
// ─────────────────────────────────────────────────────────────────────────────

export type CrearEntradaLineaInput = {
  productoId: number;
  costoUnitario: string | null;
  cantidades: string[];
};

export type CrearEntradaInput = {
  ubicacionId: number;
  proveedorId?: number | null;
  observaciones?: string | null;
  usuarioId: number;
  ip?: string | null;
  uuidCliente: string;
  contenedorId?: number | null;
  lineas: CrearEntradaLineaInput[];
  /** Server-owned capability; routes may enable it only for BODEGA. */
  allowPendingCosts?: boolean;
};

export type EntradaRolloResult = {
  id: number;
  serie: string;
  productoId: number;
  cantidadInicial: string;
  costoUnitario: string | null;
  costoTotal: string | null;
};

export type EntradaLineaResult = {
  productoId: number;
  skuProducto: string;
  telaProducto: string;
  colorProducto: string;
  unidadProducto: string;
  costoUnitario: string | null;
  rollosCount: number;
  cantidadTotal: string;
  costoTotal: string | null;
};

export type EntradaResult = {
  id: number;
  folio: number;
  inicialesSitio: string;
  folioFormateado: string;
  ubicacionId: number;
  nombreUbicacion: string;
  proveedorId: number | null;
  nombreProveedor: string | null;
  usuarioId: number;
  nombreUsuario: string;
  fecha: string;
  observaciones: string | null;
  totalRollos: number;
  totalCosto: string | null;
  uuidCliente: string;
  createdAt: string;
  lineas: EntradaLineaResult[];
  rollos: EntradaRolloResult[];
};

/**
 * Create an entire entry (recepción) atomically.
 *
 * Accepts an active transaction as the first argument. In one all-or-nothing
 * unit it:
 *   1. allocates a rollback-safe global folio,
 *   2. inserts the immutable entrada header,
 *   3. reserves all global series in one locked range,
 *   4. inserts every DISPONIBLE roll linked by recepcion_id,
 *   5. writes one RECEPCION movement per roll,
 *   6. refreshes the existence cache per (producto, ubicacion) pair,
 *   7. writes the audit trail.
 *
 * Idempotent by uuid_cliente: a repeated uuid returns the existing entry
 * without creating anything new.
 *
 * Business validation (products exist/active, provider active, location type,
 * positive quantities, duplicate lines) is performed by the caller/route.
 * Positive unit cost is also enforced here so direct engine callers cannot
 * create rolls whose persisted two-decimal cost would be zero.
 */
export async function crearEntrada(
  tx: Tx,
  input: CrearEntradaInput,
): Promise<EntradaResult> {
  // Serialize retries of the same client id before checking idempotency. This
  // prevents two concurrent requests from both observing no entrada and trying
  // to link the same container.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${input.uuidCliente}))`,
  );
  // Idempotency by entry uuid_cliente
  const [dup] = await tx
    .select()
    .from(entradasTable)
    .where(eq(entradasTable.uuidCliente, input.uuidCliente))
    .limit(1);
  if (dup) {
    return buildEntradaResult(tx, dup.id);
  }

  let contenedor: typeof contenedoresTable.$inferSelect | null = null;
  if (input.contenedorId != null) {
    const [locked] = await tx
      .select()
      .from(contenedoresTable)
      .where(eq(contenedoresTable.id, input.contenedorId))
      .for("update")
      .limit(1);
    if (!locked) {
      throw new InventarioError(
        "Contenedor no encontrado.",
        "CONTENEDOR_NOT_FOUND",
      );
    }
    if (locked.estado !== "EN_TRANSITO" || locked.entradaId != null) {
      throw new InventarioError(
        "El contenedor ya no está disponible.",
        "CONTENEDOR_NOT_AVAILABLE",
      );
    }
    if (locked.sitioDestinoId !== input.ubicacionId) {
      throw new InventarioError(
        "El contenedor pertenece a otro sitio.",
        "CONTENEDOR_SITE_MISMATCH",
      );
    }
    if (
      input.proveedorId == null ||
      locked.proveedorId !== input.proveedorId
    ) {
      throw new InventarioError(
        "El proveedor de la entrada no coincide con el contenedor.",
        "CONTENEDOR_PROVIDER_MISMATCH",
      );
    }
    contenedor = locked;
  }

  const hasPendingCosts = input.lineas.some(
    (linea) => linea.costoUnitario == null,
  );
  if (hasPendingCosts && !input.allowPendingCosts) {
    throw new InventarioError(
      "El costo unitario debe ser mayor a cero.",
      "INVALID_UNIT_COST",
    );
  }
  if (
    input.lineas.some(
      (linea) =>
        linea.costoUnitario != null &&
        !isValidUnitCost(linea.costoUnitario),
    )
  ) {
    throw new InventarioError(
      "El costo unitario debe ser mayor a cero.",
      "INVALID_UNIT_COST",
    );
  }

  if (input.lineas.length === 0) {
    throw new InventarioError(
      "La entrada debe incluir al menos una línea.",
      "EMPTY_ENTRY",
    );
  }

  const totalRollos = input.lineas.reduce(
    (acc, l) => acc + l.cantidades.length,
    0,
  );
  if (totalRollos === 0) {
    throw new InventarioError(
      "La entrada debe incluir al menos un rollo.",
      "EMPTY_ENTRY",
    );
  }

  // Compute total cost across all lines/rolls
  let totalCosto = 0;
  for (const l of input.lineas) {
    if (l.costoUnitario == null) continue;
    for (const c of l.cantidades) {
      totalCosto += parseFloat(c) * parseFloat(l.costoUnitario);
    }
  }
  const totalCostoStr = hasPendingCosts ? null : totalCosto.toFixed(2);

  // Server-side date — never from the client
  const fechaServidor = new Date();

  // 1) Rollback-safe folio
  const folio = await reserveFolio(tx, input.ubicacionId);

  // 2) Immutable header
  const [entrada] = await tx
    .insert(entradasTable)
    .values({
      folio,
      ubicacionId: input.ubicacionId,
      proveedorId: input.proveedorId ?? null,
      usuarioId: input.usuarioId,
      fecha: fechaServidor,
      observaciones: input.observaciones ?? null,
      totalRollos,
      totalCosto: totalCostoStr,
      uuidCliente: input.uuidCliente,
    })
    .returning();

  // 3) Reserve all series in one locked range
  const series = await reserveSeries(tx, totalRollos);
  let serieIdx = 0;

  // 4 & 5) Create DISPONIBLE rolls + RECEPCION movements
  for (const linea of input.lineas) {
    for (const cantidad of linea.cantidades) {
      const costoTotal =
        linea.costoUnitario == null
          ? null
          : (parseFloat(cantidad) * parseFloat(linea.costoUnitario)).toFixed(2);

      const [rollo] = await tx
        .insert(rollosTable)
        .values({
          serie: series[serieIdx++]!,
          productoId: linea.productoId,
          ubicacionId: input.ubicacionId,
          proveedorId: input.proveedorId ?? null,
          recepcionId: entrada!.id,
          estado: "DISPONIBLE",
          cantidadInicial: cantidad,
          cantidadActual: cantidad,
          costoUnitario: linea.costoUnitario,
          costoTotal,
        })
        .returning();

      await insertMovimiento(tx, {
        rolloId: rollo!.id,
        productoId: linea.productoId,
        ubicacionId: input.ubicacionId,
        tipo: "RECEPCION",
        cantidad,
        usuarioId: input.usuarioId,
        documentoTipo: "ENTRADA",
        documentoId: String(entrada!.id),
      });
    }
  }

  // 6) Refresh existence cache per distinct producto at this location
  const productoIds = Array.from(
    new Set(input.lineas.map((l) => l.productoId)),
  );
  for (const productoId of productoIds) {
    await refreshCache(tx, productoId, input.ubicacionId);
  }

  // 7) Audit trail
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "CREAR",
    entidad: "entradas",
    entidadId: String(entrada!.id),
    datosDespues: {
      folio: entrada!.folio,
      ubicacionId: input.ubicacionId,
      proveedorId: input.proveedorId ?? null,
      totalRollos,
      totalCosto: totalCostoStr,
    } as Record<string, unknown>,
    ip: input.ip ?? "desconocida",
  });

  // 8) Register COMPRA in pagos_proveedor (idempotent via partial unique index)
  if (input.proveedorId != null && totalCostoStr != null) {
    await tx
      .insert(pagosProveedorTable)
      .values({
        proveedorId: input.proveedorId,
        entradaId: entrada!.id,
        importe: totalCostoStr,
        tipo: "COMPRA",
        fecha: fechaServidor,
        usuarioId: input.usuarioId,
      })
      .onConflictDoNothing();
  }

  if (contenedor) {
    const fechaRealLlegada = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(fechaServidor);
    const [received] = await tx
      .update(contenedoresTable)
      .set({
        estado: "RECIBIDO",
        entradaId: entrada!.id,
        fechaRealLlegada,
        updatedAt: fechaServidor,
      })
      .where(
        and(
          eq(contenedoresTable.id, contenedor.id),
          eq(contenedoresTable.estado, "EN_TRANSITO"),
        ),
      )
      .returning({ id: contenedoresTable.id });
    if (!received) {
      throw new InventarioError(
        "El contenedor ya no está disponible.",
        "CONTENEDOR_NOT_AVAILABLE",
      );
    }
  }

  return buildEntradaResult(tx, entrada!.id);
}

/**
 * Build the full entry response/detail: header + names, lines grouped by
 * product, and all rolls with final series/quantities. Reads via the passed tx.
 */
export async function buildEntradaResult(
  tx: Tx,
  entradaId: number,
): Promise<EntradaResult> {
  const [entrada] = await tx
    .select({
      id: entradasTable.id,
      folio: entradasTable.folio,
      ubicacionId: entradasTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      inicialesSitio: ubicacionesTable.iniciales,
      proveedorId: entradasTable.proveedorId,
      usuarioId: entradasTable.usuarioId,
      fecha: entradasTable.fecha,
      observaciones: entradasTable.observaciones,
      totalRollos: entradasTable.totalRollos,
      totalCosto: entradasTable.totalCosto,
      uuidCliente: entradasTable.uuidCliente,
      createdAt: entradasTable.createdAt,
    })
    .from(entradasTable)
    .innerJoin(
      ubicacionesTable,
      eq(entradasTable.ubicacionId, ubicacionesTable.id),
    )
    .where(eq(entradasTable.id, entradaId))
    .limit(1);

  if (!entrada) {
    throw new InventarioError("Entrada no encontrada.", "ENTRADA_NOT_FOUND");
  }

  const [usuario] = await tx
    .select({ nombre: usuariosTable.nombre })
    .from(usuariosTable)
    .where(eq(usuariosTable.id, entrada.usuarioId))
    .limit(1);

  let nombreProveedor: string | null = null;
  if (entrada.proveedorId != null) {
    const [prov] = await tx
      .select({ nombre: proveedoresTable.nombre })
      .from(proveedoresTable)
      .where(eq(proveedoresTable.id, entrada.proveedorId))
      .limit(1);
    nombreProveedor = prov?.nombre ?? null;
  }

  const rolloRows = await tx
    .select({
      id: rollosTable.id,
      serie: rollosTable.serie,
      productoId: rollosTable.productoId,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      cantidadInicial: rollosTable.cantidadInicial,
      costoUnitario: rollosTable.costoUnitario,
      costoTotal: rollosTable.costoTotal,
    })
    .from(rollosTable)
    .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
    .where(eq(rollosTable.recepcionId, entradaId))
    .orderBy(rollosTable.id);

  const rollos: EntradaRolloResult[] = rolloRows.map((r) => ({
    id: r.id,
    serie: r.serie,
    productoId: r.productoId,
    cantidadInicial: r.cantidadInicial,
    costoUnitario: r.costoUnitario,
    costoTotal: r.costoTotal,
  }));

  // Group lines by product
  type Group = {
    productoId: number;
    skuProducto: string;
    telaProducto: string;
    colorProducto: string;
    unidadProducto: string;
    costoUnitario: string | null;
    rollosCount: number;
    cantidadTotal: number;
    costoTotal: number | null;
  };
  const groups = new Map<number, Group>();
  for (const r of rolloRows) {
    const g = groups.get(r.productoId) ?? {
      productoId: r.productoId,
      skuProducto: r.sku,
      telaProducto: r.tela,
      colorProducto: r.color,
      unidadProducto: r.unidad,
      costoUnitario: r.costoUnitario,
      rollosCount: 0,
      cantidadTotal: 0,
      costoTotal: r.costoTotal == null ? null : 0,
    };
    g.rollosCount += 1;
    g.cantidadTotal += parseFloat(r.cantidadInicial);
    if (r.costoTotal == null) g.costoTotal = null;
    else if (g.costoTotal != null) g.costoTotal += parseFloat(r.costoTotal);
    groups.set(r.productoId, g);
  }

  const lineas: EntradaLineaResult[] = Array.from(groups.values()).map((g) => ({
    productoId: g.productoId,
    skuProducto: g.skuProducto,
    telaProducto: g.telaProducto,
    colorProducto: g.colorProducto,
    unidadProducto: g.unidadProducto,
    costoUnitario: g.costoUnitario,
    rollosCount: g.rollosCount,
    cantidadTotal: g.cantidadTotal.toFixed(3),
    costoTotal: g.costoTotal == null ? null : g.costoTotal.toFixed(2),
  }));

  return {
    id: entrada.id,
    folio: entrada.folio,
    inicialesSitio: entrada.inicialesSitio,
    folioFormateado: `${entrada.inicialesSitio}-${String(entrada.folio).padStart(6, "0")}`,
    ubicacionId: entrada.ubicacionId,
    nombreUbicacion: entrada.nombreUbicacion,
    proveedorId: entrada.proveedorId ?? null,
    nombreProveedor,
    usuarioId: entrada.usuarioId,
    nombreUsuario: usuario?.nombre ?? "",
    fecha: entrada.fecha.toISOString(),
    observaciones: entrada.observaciones ?? null,
    totalRollos: entrada.totalRollos,
    totalCosto: entrada.totalCosto,
    uuidCliente: entrada.uuidCliente,
    createdAt: entrada.createdAt.toISOString(),
    lineas,
    rollos,
  };
}

export type CapturarCostosEntradaInput = {
  entradaId: number;
  usuarioId: number;
  ip?: string | null;
  costosProductos: Array<{ productoId: number; costoUnitario: string }>;
  costosRollos?: Array<{ rolloId: number; costoUnitario: string }>;
};

/**
 * Completes a pending reception without touching inventory quantities,
 * movements, states, or the existence cache.
 */
export async function capturarCostosEntrada(
  tx: Tx,
  input: CapturarCostosEntradaInput,
): Promise<EntradaResult> {
  const [entrada] = await tx
    .select()
    .from(entradasTable)
    .where(eq(entradasTable.id, input.entradaId))
    .for("update")
    .limit(1);
  if (!entrada) {
    throw new InventarioError("Entrada no encontrada.", "ENTRADA_NOT_FOUND");
  }

  const rollos = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.recepcionId, input.entradaId))
    .orderBy(rollosTable.id)
    .for("update");
  const pendientes = rollos.filter((rollo) => rollo.costoUnitario == null);
  if (pendientes.length === 0) {
    throw new InventarioError(
      "La entrada ya tiene todos sus costos registrados.",
      "COSTS_ALREADY_CAPTURED",
    );
  }

  const defaults = new Map(
    input.costosProductos.map((item) => [item.productoId, item.costoUnitario]),
  );
  const overrides = new Map(
    (input.costosRollos ?? []).map((item) => [item.rolloId, item.costoUnitario]),
  );
  for (const [rolloId] of overrides) {
    const rollo = rollos.find((item) => item.id === rolloId);
    if (!rollo) {
      throw new InventarioError(
        `El rollo ${rolloId} no pertenece a la entrada.`,
        "ROLLO_NOT_IN_ENTRY",
      );
    }
    if (rollo.costoUnitario != null) {
      throw new InventarioError(
        `El rollo serie ${rollo.serie} ya tiene costo registrado.`,
        "ROLLO_COST_ALREADY_CAPTURED",
      );
    }
  }

  for (const rollo of pendientes) {
    const costo = overrides.get(rollo.id) ?? defaults.get(rollo.productoId);
    if (!isValidUnitCost(costo)) {
      throw new InventarioError(
        `Falta un costo positivo para el producto ${rollo.productoId}.`,
        "INVALID_UNIT_COST",
      );
    }
    const costoTotal = (
      Number(rollo.cantidadInicial) * Number(costo)
    ).toFixed(2);
    await tx
      .update(rollosTable)
      .set({ costoUnitario: costo, costoTotal })
      .where(eq(rollosTable.id, rollo.id));
  }

  const [totalRow] = await tx
    .select({
      total: sql<string | null>`
        CASE WHEN COUNT(*) FILTER (WHERE costo_total IS NULL) > 0 THEN NULL
        ELSE SUM(costo_total)::text END`,
    })
    .from(rollosTable)
    .where(eq(rollosTable.recepcionId, input.entradaId));
  if (totalRow?.total == null) {
    throw new InventarioError(
      "No fue posible completar todos los costos de la entrada.",
      "PENDING_COSTS_REMAIN",
    );
  }
  const totalCosto = Number(totalRow.total).toFixed(2);
  await tx
    .update(entradasTable)
    .set({ totalCosto })
    .where(eq(entradasTable.id, input.entradaId));

  if (entrada.proveedorId != null) {
    await tx.execute(sql`
      INSERT INTO pagos_proveedor
        (proveedor_id, entrada_id, importe, tipo, fecha, usuario_id)
      VALUES
        (${entrada.proveedorId}, ${entrada.id}, ${totalCosto}, 'COMPRA',
         ${entrada.fecha}, ${input.usuarioId})
      ON CONFLICT (entrada_id) WHERE tipo = 'COMPRA' AND entrada_id IS NOT NULL
      DO UPDATE SET
        proveedor_id = EXCLUDED.proveedor_id,
        importe = EXCLUDED.importe,
        fecha = EXCLUDED.fecha,
        usuario_id = EXCLUDED.usuario_id
    `);
  }

  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "EDITAR",
    entidad: "entradas_costos",
    entidadId: String(entrada.id),
    datosAntes: { totalCosto: entrada.totalCosto },
    datosDespues: {
      totalCosto,
      rollosActualizados: pendientes.length,
    },
    ip: input.ip ?? "desconocida",
  });
  return buildEntradaResult(tx, entrada.id);
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

  if (!isValidUnitCost(rollo.costoUnitario)) {
    throw new InventarioError(
      rollWithoutValidUnitCostMessage(rollo.serie),
      "ROLLO_SIN_COSTO",
    );
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
  documentoTipo?: string | null;
  documentoId?: string | null;
  uuidCliente?: string | null;
};

/**
 * Atomic, direct site-to-site transfer.  This deliberately does not share the
 * two-stage transfer implementation: salidas are already received at their
 * destination when their document is registered and must never occupy the
 * technical TRANSITO location.
 */
export type TransferirRolloInmediatoInput = {
  rolloId: number;
  ubicacionOrigenId: number;
  ubicacionDestinoId: number;
  usuarioId: number;
  justificacion?: string | null;
  documentoTipo: string;
  documentoId: string;
  /** Stable operation UUID; :salida and :entrada are ledger idempotency keys. */
  uuidCliente?: string | null;
};

export type TransferirRolloInmediatoResult = {
  rollo: typeof rollosTable.$inferSelect;
  salidaMovimiento: typeof movimientosTable.$inferSelect;
  entradaMovimiento: typeof movimientosTable.$inferSelect;
};

function deriveUuid(base: string, label: string): string {
  const bytes = Buffer.from(createHash("sha256").update(`${base}\0${label}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function transferirRolloInmediato(
  tx: Tx,
  input: TransferirRolloInmediatoInput,
): Promise<TransferirRolloInmediatoResult> {
  if (input.ubicacionOrigenId === input.ubicacionDestinoId) {
    throw new InventarioError("El origen y destino deben ser diferentes.", "SAME_LOCATION");
  }
  const salidaUuid = input.uuidCliente ? deriveUuid(input.uuidCliente, "salida") : null;
  const entradaUuid = input.uuidCliente ? deriveUuid(input.uuidCliente, "entrada") : null;
  if (salidaUuid) {
    const duplicate = await checkUuidCliente(tx, salidaUuid);
    if (duplicate) {
      const [[rollo], [entrada]] = await Promise.all([
        tx.select().from(rollosTable).where(eq(rollosTable.id, duplicate.rolloId)).limit(1),
        tx.select().from(movimientosTable).where(eq(movimientosTable.uuidCliente, entradaUuid!)).limit(1),
      ]);
      if (rollo && entrada) {
        return { rollo, salidaMovimiento: duplicate, entradaMovimiento: entrada };
      }
      throw new InventarioError("Transferencia incompleta con UUID duplicado.", "IDEMPOTENCY_CONFLICT");
    }
  }
  const [rollo] = await tx.select().from(rollosTable)
    .where(eq(rollosTable.id, input.rolloId)).for("update").limit(1);
  if (!rollo) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
  if (rollo.ubicacionId !== input.ubicacionOrigenId) {
    throw new InventarioError("El rollo no se encuentra en la ubicación de origen indicada.", "LOCATION_MISMATCH");
  }
  if (rollo.estado !== "DISPONIBLE") {
    throw new InventarioError("El rollo no está DISPONIBLE.", "ROLLO_UNAVAILABLE");
  }
  await tx.update(rollosTable).set({ ubicacionId: input.ubicacionDestinoId, estado: "DISPONIBLE" })
    .where(eq(rollosTable.id, rollo.id));
  const salidaMovimiento = await insertMovimiento(tx, {
    rolloId: rollo.id, productoId: rollo.productoId, ubicacionId: input.ubicacionOrigenId,
    tipo: "TRANSFERENCIA_SALIDA", cantidad: `-${rollo.cantidadActual}`, usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null, documentoTipo: input.documentoTipo,
    documentoId: input.documentoId, uuidCliente: salidaUuid,
  });
  const entradaMovimiento = await insertMovimiento(tx, {
    rolloId: rollo.id, productoId: rollo.productoId, ubicacionId: input.ubicacionDestinoId,
    tipo: "TRANSFERENCIA_ENTRADA", cantidad: rollo.cantidadActual, usuarioId: input.usuarioId,
    justificacion: input.justificacion ?? null, documentoTipo: input.documentoTipo,
    documentoId: input.documentoId, uuidCliente: entradaUuid,
  });
  await refreshCache(tx, rollo.productoId, input.ubicacionOrigenId);
  await refreshCache(tx, rollo.productoId, input.ubicacionDestinoId);
  const [updated] = await tx.select().from(rollosTable).where(eq(rollosTable.id, rollo.id)).limit(1);
  return { rollo: updated!, salidaMovimiento, entradaMovimiento };
}

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
    documentoTipo: input.documentoTipo ?? null,
    documentoId: input.documentoId ?? null,
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
    documentoTipo: input.documentoTipo ?? null,
    documentoId: input.documentoId ?? null,
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
  documentoTipo?: string | null;
  documentoId?: string | null;
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
    documentoTipo: input.documentoTipo ?? null,
    documentoId: input.documentoId ?? null,
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
    documentoTipo: input.documentoTipo ?? null,
    documentoId: input.documentoId ?? null,
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
 *
 * Temporary legacy behavior: the state changes but cantidad_actual remains Q,
 * while the ledger records -Q. ABIERTO and this operation must be removed
 * together in Parte 2; see docs/abierto-retirement.md.
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
  documentoTipo?: string | null;
  documentoId?: string | null;
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
  if (!isValidUnitCost(rollo.costoUnitario)) {
    throw new InventarioError(
      rollWithoutValidUnitCostMessage(rollo.serie),
      "ROLLO_SIN_COSTO",
    );
  }
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
    documentoTipo: input.documentoTipo ?? null,
    documentoId: input.documentoId ?? null,
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
  /** Salidas documenta diferencias sin abrir un movimiento administrativo pendiente. */
  revisado?: boolean;
  documentoTipo?: string | null;
  documentoId?: string | null;
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

  // Guard state change through the transition machine (only applies when BAJA)
  if (estadoNuevo !== rollo.estado) {
    assertTransition(rollo.estado, estadoNuevo);
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
    revisado: input.revisado ?? false,
    documentoTipo: input.documentoTipo ?? null,
    documentoId: input.documentoId ?? null,
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

  // Restore roll state where sensible.
  // estadoAntesDe throws for SALIDA_MOSTRADOR (ABIERTO is terminal).
  const estadoAnterior = estadoAntesDe(orig.tipo, rollo.estado);

  // Guard: every state change must pass through the transition machine.
  if (estadoAnterior !== rollo.estado) {
    assertTransition(rollo.estado, estadoAnterior);
  }

  // Only restore cantidadActual when the original movement actually mutated it.
  // VENTA, SALIDA_MOSTRADOR, TRANSFERENCIA_SALIDA/ENTRADA leave cantidadActual
  // untouched in the roll row; adding the inverse would corrupt the quantity.
  const movsThatChangeCantidad: TipoMovimiento[] = [
    "ALTA",
    "RECEPCION",
    "AJUSTE_POSITIVO",
    "AJUSTE_NEGATIVO",
  ];
  const cantidadRestore = movsThatChangeCantidad.includes(orig.tipo)
    ? (parseFloat(rollo.cantidadActual) + parseFloat(inversaCantidad)).toFixed(3)
    : rollo.cantidadActual;

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
 *
 * SALIDA_MOSTRADOR is intentionally not handled: ABIERTO is terminal and
 * reverting it is forbidden. Callers must check for this case before calling
 * assertTransition so the error is explicit.
 */
function estadoAntesDe(tipo: TipoMovimiento, estadoActual: EstadoRollo): EstadoRollo {
  switch (tipo) {
    case "ALTA":
    case "RECEPCION":
      return "PROGRAMADO";
    case "VENTA":
      return "DISPONIBLE";
    case "SALIDA_MOSTRADOR":
      // ABIERTO is terminal — reverting a SALIDA_MOSTRADOR is not allowed.
      // Throw now so assertTransition never gets a chance to bypass the rule.
      throw new InventarioError(
        "No se puede revertir una SALIDA_MOSTRADOR: el rollo ya salió a piso (ABIERTO es terminal). " +
          "Registra un ajuste para dejar rastro.",
        "ABIERTO_TERMINAL",
      );
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
  ubicacionNombre: string;
  ubicacionActiva: boolean;
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

    const ubicacionIds = Array.from(
      new Set(Array.from(keyMap.keys()).map((key) => Number(key.split(":")[1]))),
    );
    const ubicaciones =
      ubicacionIds.length > 0
        ? await tx
            .select({
              id: ubicacionesTable.id,
              nombre: ubicacionesTable.nombre,
              activa: ubicacionesTable.activa,
            })
            .from(ubicacionesTable)
            .where(inArray(ubicacionesTable.id, ubicacionIds))
        : [];
    const ubicacionesMap = new Map(
      ubicaciones.map((ubicacion) => [ubicacion.id, ubicacion]),
    );

    const results: ConciliacionFila[] = [];
    for (const [key, v] of keyMap) {
      const [pId, uId] = key.split(":").map(Number) as [number, number];
      const ubicacion = ubicacionesMap.get(uId);
      const movTotal = quantityToThousandths(v.movTotal);
      const cacheTotal = quantityToThousandths(v.cacheTotal);
      const movTotalF = formatQuantityThousandths(movTotal);
      const cacheTotalF = formatQuantityThousandths(cacheTotal);

      // rollosMovimientos = count of DISPONIBLE rolls physically on hand
      const [cntRow] = await tx
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(rollosTable)
        .where(
          and(
            eq(rollosTable.productoId, pId),
            eq(rollosTable.ubicacionId, uId),
            eq(rollosTable.estado, "DISPONIBLE"),
          ),
        );

      const rollosMovimientos = cntRow?.cnt ?? 0;
      results.push({
        productoId: pId,
        ubicacionId: uId,
        ubicacionNombre: ubicacion?.nombre ?? `Ubicación ${uId}`,
        ubicacionActiva: ubicacion?.activa ?? false,
        cantidadMovimientos: movTotalF,
        cantidadCache: cacheTotalF,
        rollosMovimientos,
        rollosCache: v.rollosCache,
        discrepancia:
          movTotal !== cacheTotal || rollosMovimientos !== v.rollosCache,
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

/**
 * Rebuild every existing cache pair in one all-or-nothing transaction.
 *
 * The key set is the union of cache, kardex and roll pairs so stale cache rows
 * are reset to zero rather than silently retained. cantidad_total deliberately
 * remains the signed kardex SUM; only rollos_count comes from DISPONIBLE rolls.
 */
export async function reconstruirCacheExistencias(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      WITH pairs AS (
        SELECT producto_id, ubicacion_id FROM existencias
        UNION
        SELECT producto_id, ubicacion_id FROM movimientos
        UNION
        SELECT producto_id, ubicacion_id FROM rollos
      ),
      movement_totals AS (
        SELECT producto_id, ubicacion_id, COALESCE(SUM(cantidad), 0) AS cantidad_total
        FROM movimientos
        GROUP BY producto_id, ubicacion_id
      ),
      available_rolls AS (
        SELECT producto_id, ubicacion_id, COUNT(*)::int AS rollos_count
        FROM rollos
        WHERE estado = 'DISPONIBLE'
        GROUP BY producto_id, ubicacion_id
      )
      INSERT INTO existencias (producto_id, ubicacion_id, cantidad_total, rollos_count)
      SELECT pairs.producto_id, pairs.ubicacion_id,
             COALESCE(movement_totals.cantidad_total, 0),
             COALESCE(available_rolls.rollos_count, 0)
      FROM pairs
      LEFT JOIN movement_totals USING (producto_id, ubicacion_id)
      LEFT JOIN available_rolls USING (producto_id, ubicacion_id)
      ON CONFLICT (producto_id, ubicacion_id) DO UPDATE
      SET cantidad_total = EXCLUDED.cantidad_total,
          rollos_count = EXCLUDED.rollos_count
    `);
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
          eq(rollosTable.estado, "DISPONIBLE"),
          inArray(rollosTable.ubicacionId, ubicacionIds),
        )
      : eq(rollosTable.estado, "DISPONIBLE");

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
