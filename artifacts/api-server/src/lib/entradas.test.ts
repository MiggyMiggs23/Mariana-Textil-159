/**
 * Focused integration tests for the whole-entry engine operation (crearEntrada).
 *
 * Run with:
 *   cd /home/runner/workspace/artifacts/api-server && \
 *   DATABASE_URL="postgres://postgres:password@helium:5432/heliumdb" \
 *   pnpm tsx src/lib/entradas.test.ts
 *
 * Covers: multi-product totals/linkage, RECEPCION movements, existence cache,
 * idempotency by uuid_cliente, and rollback with no burned series.
 * All created rows are cleaned up after the run, even on failure.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  entradasTable,
  existenciasTable,
  movimientosTable,
  pagosProveedorTable,
  productosTable,
  proveedoresTable,
  rollosTable,
  seriesConsecutivoTable,
  ubicacionesTable,
} from "@workspace/db";
import {
  capturarCostosEntrada,
  crearEntrada,
  InventarioError,
} from "./inventario";

// ── Test harness ──────────────────────────────────────────────────────────────

const RUN = `E${Date.now()}`;
let passed = 0;
let failed = 0;

const createdProductoIds: number[] = [];
const createdUbicacionIds: number[] = [];
const createdEntradaIds: number[] = [];
const createdProveedorIds: number[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(
      `  ✗ ${name}\n    ${(err as Error).stack ?? (err as Error).message}\n`,
    );
    failed++;
  }
}

let seq = 0;
async function mkProducto(): Promise<{ id: number; sku: string }> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(productosTable)
    .values({
      sku: `ENT${tag}`.slice(0, 64),
      tela: `Tela ${tag}`,
      color: `Color ${tag}`,
      unidad: "METRO" as const,
      precioSugerido: "100.00",
    })
    .returning();
  createdProductoIds.push(row!.id);
  return { id: row!.id, sku: row!.sku };
}

async function mkUbicacion(): Promise<number> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `UbEnt ${tag}`.slice(0, 120),
      iniciales: `E${String.fromCharCode(65 + (seq % 26))}`,
      tipo: "BODEGA" as const,
    })
    .returning();
  createdUbicacionIds.push(row!.id);
  return row!.id;
}

async function mkProveedor(): Promise<number> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(proveedoresTable)
    .values({ nombre: `Prov ${tag}`.slice(0, 200), tipo: "NACIONAL" as const })
    .returning();
  createdProveedorIds.push(row!.id);
  return row!.id;
}

async function readExistencia(
  productoId: number,
  ubicacionId: number,
): Promise<{ cantidadTotal: number; rollosCount: number } | null> {
  const [row] = await db
    .select()
    .from(existenciasTable)
    .where(
      and(
        eq(existenciasTable.productoId, productoId),
        eq(existenciasTable.ubicacionId, ubicacionId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    cantidadTotal: parseFloat(row.cantidadTotal),
    rollosCount: row.rollosCount,
  };
}

// =============================================================================
// E-01: Multi-product entry → totals, linkage, RECEPCION, existence cache
// =============================================================================

await test(
  "E-01: Entrada multi-producto → totales, enlace recepcion_id, RECEPCION, existencias y COMPRA proveedor",
  async () => {
    const { id: prodA } = await mkProducto();
    const { id: prodB } = await mkProducto();
    const ubicacionId = await mkUbicacion();
    const proveedorId = await mkProveedor();
    const USUARIO = 1;

    const result = await db.transaction(async (tx) =>
      crearEntrada(tx, {
        ubicacionId,
        proveedorId,
        usuarioId: USUARIO,
        uuidCliente: randomUUID(),
        lineas: [
          { productoId: prodA, costoUnitario: "50.00", cantidades: ["10.0", "20.0"] },
          { productoId: prodB, costoUnitario: "30.00", cantidades: ["5.0"] },
        ],
      }),
    );
    createdEntradaIds.push(result.id);

    // Header totals: 3 rolls, cost = (10+20)*50 + 5*30 = 1500 + 150 = 1650.00
    assert.equal(result.totalRollos, 3, `totalRollos debe ser 3, got ${result.totalRollos}`);
    assert.equal(result.totalCosto, "1650.00", `totalCosto debe ser 1650.00, got ${result.totalCosto}`);
    assert.ok(result.folio >= 1, `folio debe ser >= 1, got ${result.folio}`);
    assert.equal(
      result.folioFormateado,
      `${result.inicialesSitio}-${String(result.folio).padStart(6, "0")}`,
    );

    // Lines grouped by product
    assert.equal(result.lineas.length, 2, "Debe haber 2 líneas agrupadas");
    const lineaA = result.lineas.find((l) => l.productoId === prodA)!;
    const lineaB = result.lineas.find((l) => l.productoId === prodB)!;
    assert.equal(lineaA.rollosCount, 2, "Línea A: 2 rollos");
    assert.equal(parseFloat(lineaA.cantidadTotal), 30.0, "Línea A: 30 total");
    assert.equal(lineaA.costoTotal, "1500.00", "Línea A: 1500 costo");
    assert.equal(lineaB.rollosCount, 1, "Línea B: 1 rollo");
    assert.equal(parseFloat(lineaB.cantidadTotal), 5.0, "Línea B: 5 total");

    // All rolls linked by recepcion_id
    const rollos = await db
      .select()
      .from(rollosTable)
      .where(eq(rollosTable.recepcionId, result.id));
    assert.equal(rollos.length, 3, "3 rollos enlazados por recepcion_id");
    for (const r of rollos) {
      assert.equal(r.estado, "DISPONIBLE", `Rollo ${r.serie} debe ser DISPONIBLE`);
      assert.match(r.serie, /^\d+$/, `serie numérica: ${r.serie}`);
    }

    // Movements are RECEPCION (not ALTA)
    const rolloIds = rollos.map((r) => r.id);
    const movs = await db
      .select()
      .from(movimientosTable)
      .where(inArray(movimientosTable.rolloId, rolloIds));
    assert.equal(movs.length, 3, "3 movimientos");
    for (const m of movs) {
      assert.equal(m.tipo, "RECEPCION", `Movimiento debe ser RECEPCION, got ${m.tipo}`);
    }

    // Existence cache refreshed
    const exA = await readExistencia(prodA, ubicacionId);
    const exB = await readExistencia(prodB, ubicacionId);
    assert.ok(exA && exB, "Existencias deben existir");
    assert.equal(exA!.cantidadTotal, 30.0, "Existencia A = 30");
    assert.equal(exA!.rollosCount, 2, "Existencia A rollosCount = 2");
    assert.equal(exB!.cantidadTotal, 5.0, "Existencia B = 5");
    assert.equal(exB!.rollosCount, 1, "Existencia B rollosCount = 1");

    // COMPRA row inserted in pagos_proveedor (idempotente)
    const compras = await db
      .select()
      .from(pagosProveedorTable)
      .where(
        and(
          eq(pagosProveedorTable.entradaId, result.id),
          eq(pagosProveedorTable.tipo, "COMPRA"),
        ),
      );
    assert.equal(compras.length, 1, "Debe existir exactamente 1 COMPRA en pagos_proveedor");
    assert.equal(compras[0]!.importe, "1650.00", "COMPRA importe = 1650.00");
    assert.equal(compras[0]!.proveedorId, proveedorId, "COMPRA proveedor_id correcto");
  },
);

// =============================================================================
// E-02: Idempotency by uuid_cliente → repeated entry returns original
// =============================================================================

await test("E-02: uuid_cliente repetido → no duplica, retorna entrada original", async () => {
  const { id: prod } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;
  const uuid = randomUUID();

  const first = await db.transaction(async (tx) =>
    crearEntrada(tx, {
      ubicacionId,
      usuarioId: USUARIO,
      uuidCliente: uuid,
      lineas: [{ productoId: prod, costoUnitario: "10.00", cantidades: ["7.0", "8.0"] }],
    }),
  );
  createdEntradaIds.push(first.id);

  const second = await db.transaction(async (tx) =>
    crearEntrada(tx, {
      ubicacionId,
      usuarioId: USUARIO,
      uuidCliente: uuid,
      lineas: [{ productoId: prod, costoUnitario: "10.00", cantidades: ["7.0", "8.0"] }],
    }),
  );

  assert.equal(second.id, first.id, "Segunda llamada retorna la misma entrada");
  assert.equal(second.folio, first.folio, "Mismo folio");

  // Only one entry row, two rolls, two movements
  const entradas = await db
    .select()
    .from(entradasTable)
    .where(eq(entradasTable.uuidCliente, uuid));
  assert.equal(entradas.length, 1, "Solo una entrada persistida");

  const rollos = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.recepcionId, first.id));
  assert.equal(rollos.length, 2, "Solo 2 rollos");

  const ex = await readExistencia(prod, ubicacionId);
  assert.equal(ex!.cantidadTotal, 15.0, "Existencia total = 15 (no duplicada)");
});

// =============================================================================
// E-03: Rollback → aborted entry burns no series and leaves no rows
// =============================================================================

await test("E-03: Rollback → no quema series ni deja filas", async () => {
  const { id: prod } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  // Read the current global series counter
  const [before] = await db
    .select()
    .from(seriesConsecutivoTable)
    .where(eq(seriesConsecutivoTable.id, 1))
    .limit(1);
  const serieAntes = before?.ultimoNumero ?? 1000000;

  const [folioBeforeRow] = await db.execute(
    sql`SELECT ultimo_folio FROM entrada_folio WHERE ubicacion_id = ${ubicacionId}`,
  ).then((r) => (r as unknown as { rows: { ultimo_folio: number }[] }).rows ?? []);
  const folioAntes = folioBeforeRow?.ultimo_folio ?? 0;

  const uuid = randomUUID();
  await assert.rejects(
    () =>
      db.transaction(async (tx) => {
        await crearEntrada(tx, {
          ubicacionId,
          usuarioId: USUARIO,
          uuidCliente: uuid,
          lineas: [{ productoId: prod, costoUnitario: "10.00", cantidades: ["5.0"] }],
        });
        // Force a rollback after the entry work has been done in-tx
        throw new Error("forced-rollback");
      }),
    /forced-rollback/,
    "La transacción debe abortar",
  );

  // Series counter must be unchanged (rollback un-reserves the range)
  const [after] = await db
    .select()
    .from(seriesConsecutivoTable)
    .where(eq(seriesConsecutivoTable.id, 1))
    .limit(1);
  const serieDespues = after?.ultimoNumero ?? 1000000;
  assert.equal(
    serieDespues,
    serieAntes,
    `El contador de series no debe avanzar: antes ${serieAntes}, después ${serieDespues}`,
  );

  // Folio counter must be unchanged
  const [folioAfterRow] = await db.execute(
    sql`SELECT ultimo_folio FROM entrada_folio WHERE ubicacion_id = ${ubicacionId}`,
  ).then((r) => (r as unknown as { rows: { ultimo_folio: number }[] }).rows ?? []);
  const folioDespues = folioAfterRow?.ultimo_folio ?? 0;
  assert.equal(
    folioDespues,
    folioAntes,
    `El contador de folios no debe avanzar: antes ${folioAntes}, después ${folioDespues}`,
  );

  // No entry, roll, or movement persisted for this uuid
  const entradas = await db
    .select()
    .from(entradasTable)
    .where(eq(entradasTable.uuidCliente, uuid));
  assert.equal(entradas.length, 0, "No debe existir la entrada abortada");

  // A subsequent successful entry proves the next series is consecutive
  const ok = await db.transaction(async (tx) =>
    crearEntrada(tx, {
      ubicacionId,
      usuarioId: USUARIO,
      uuidCliente: randomUUID(),
      lineas: [{ productoId: prod, costoUnitario: "10.00", cantidades: ["5.0"] }],
    }),
  );
  createdEntradaIds.push(ok.id);
  assert.equal(
    Number(ok.rollos[0]!.serie),
    serieAntes + 1,
    `La siguiente serie debe ser consecutiva: esperado ${serieAntes + 1}, got ${ok.rollos[0]!.serie}`,
  );
});

// =============================================================================
// E-04: Empty entry rejected by the engine
// =============================================================================

await test("E-04: Entrada sin rollos → InventarioError", async () => {
  const ubicacionId = await mkUbicacion();
  await assert.rejects(
    () =>
      db.transaction(async (tx) =>
        crearEntrada(tx, {
          ubicacionId,
          usuarioId: 1,
          uuidCliente: randomUUID(),
          lineas: [],
        }),
      ),
    (err: Error) => {
      assert.ok(err instanceof InventarioError, `Expected InventarioError, got ${err.constructor.name}`);
      return true;
    },
    "Entrada vacía debe lanzar InventarioError",
  );
});

await test("E-06: costos pendientes requieren capability y se capturan sin movimientos nuevos", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const proveedorId = await mkProveedor();
  const uuidCliente = randomUUID();

  await assert.rejects(
    db.transaction((tx) =>
      crearEntrada(tx, {
        ubicacionId,
        proveedorId,
        usuarioId: 1,
        uuidCliente: randomUUID(),
        lineas: [{ productoId, costoUnitario: null, cantidades: ["4.000"] }],
      }),
    ),
    (error: unknown) =>
      error instanceof InventarioError && error.code === "INVALID_UNIT_COST",
  );

  const pending = await db.transaction((tx) =>
    crearEntrada(tx, {
      ubicacionId,
      proveedorId,
      usuarioId: 1,
      uuidCliente,
      allowPendingCosts: true,
      lineas: [{ productoId, costoUnitario: null, cantidades: ["4.000", "6.000"] }],
    }),
  );
  createdEntradaIds.push(pending.id);
  assert.equal(pending.totalCosto, null);
  assert.equal(pending.rollos.length, 2);
  assert.ok(pending.rollos.every((rollo) => rollo.costoUnitario === null));
  const pendingRolloIds = pending.rollos.map((rollo) => rollo.id);
  const movementsBefore = await db
    .select()
    .from(movimientosTable)
    .where(inArray(movimientosTable.rolloId, pendingRolloIds));
  assert.equal(movementsBefore.length, 2);
  assert.ok(movementsBefore.every((movement) => movement.tipo === "RECEPCION"));
  const comprasBefore = await db
    .select()
    .from(pagosProveedorTable)
    .where(eq(pagosProveedorTable.entradaId, pending.id));
  assert.equal(comprasBefore.length, 0);

  await assert.rejects(
    db.transaction((tx) =>
      capturarCostosEntrada(tx, {
        entradaId: pending.id,
        usuarioId: 1,
        costosProductos: [],
        costosRollos: [
          { rolloId: pending.rollos[0]!.id, costoUnitario: "25.00" },
        ],
      }),
    ),
    (error: unknown) =>
      error instanceof InventarioError && error.code === "INVALID_UNIT_COST",
  );
  const afterRejectedCapture = await db
    .select()
    .from(rollosTable)
    .where(inArray(rollosTable.id, pendingRolloIds));
  assert.ok(
    afterRejectedCapture.every(
      (rollo) => rollo.costoUnitario === null && rollo.costoTotal === null,
    ),
    "missing defaults and overrides must reject without partially costing rolls",
  );
  const [headerAfterRejectedCapture] = await db
    .select({ totalCosto: entradasTable.totalCosto })
    .from(entradasTable)
    .where(eq(entradasTable.id, pending.id));
  assert.equal(headerAfterRejectedCapture?.totalCosto, null);

  const captured = await db.transaction((tx) =>
    capturarCostosEntrada(tx, {
      entradaId: pending.id,
      usuarioId: 1,
      costosProductos: [],
      costosRollos: [
        { rolloId: pending.rollos[0]!.id, costoUnitario: "25.00" },
        { rolloId: pending.rollos[1]!.id, costoUnitario: "30.00" },
      ],
    }),
  );
  assert.equal(captured.totalCosto, "280.00");
  assert.equal(captured.rollos[0]?.costoUnitario, "25.00");
  assert.equal(captured.rollos[1]?.costoUnitario, "30.00");
  const movementsAfter = await db
    .select()
    .from(movimientosTable)
    .where(inArray(movimientosTable.rolloId, pendingRolloIds));
  assert.equal(movementsAfter.length, 2, "capture must not add movements");
  const comprasAfter = await db
    .select()
    .from(pagosProveedorTable)
    .where(eq(pagosProveedorTable.entradaId, pending.id));
  assert.equal(comprasAfter.length, 1);
  assert.equal(comprasAfter[0]!.importe, "280.00");
});

// =============================================================================
// Cleanup
// =============================================================================

process.stdout.write(`\n─────────────────────────────────────────────\n`);
process.stdout.write(`Results: ${passed} passed, ${failed} failed\n`);

try {
  await db.transaction(async (tx) => {
    // Delete pagos_proveedor first (FK to entradas)
    if (createdEntradaIds.length > 0) {
      await tx
        .delete(pagosProveedorTable)
        .where(inArray(pagosProveedorTable.entradaId, createdEntradaIds));
    }
    if (createdProveedorIds.length > 0) {
      await tx
        .delete(pagosProveedorTable)
        .where(inArray(pagosProveedorTable.proveedorId, createdProveedorIds));
    }

    if (createdEntradaIds.length > 0) {
      const rollos = await tx
        .select({ id: rollosTable.id })
        .from(rollosTable)
        .where(inArray(rollosTable.recepcionId, createdEntradaIds));
      const rolloIds = rollos.map((r) => r.id);
      if (rolloIds.length > 0) {
        await tx
          .delete(movimientosTable)
          .where(inArray(movimientosTable.rolloId, rolloIds));
        await tx.delete(rollosTable).where(inArray(rollosTable.id, rolloIds));
      }
      await tx
        .delete(entradasTable)
        .where(inArray(entradasTable.id, createdEntradaIds));
    }

    if (createdProductoIds.length > 0) {
      await tx
        .delete(existenciasTable)
        .where(inArray(existenciasTable.productoId, createdProductoIds));
      // Any stray rolls/movements for these products (e.g. rolled-back safety)
      const strayRollos = await tx
        .select({ id: rollosTable.id })
        .from(rollosTable)
        .where(inArray(rollosTable.productoId, createdProductoIds));
      const strayIds = strayRollos.map((r) => r.id);
      if (strayIds.length > 0) {
        await tx
          .delete(movimientosTable)
          .where(inArray(movimientosTable.rolloId, strayIds));
        await tx.delete(rollosTable).where(inArray(rollosTable.id, strayIds));
      }
      await tx
        .delete(productosTable)
        .where(inArray(productosTable.id, createdProductoIds));
    }

    if (createdUbicacionIds.length > 0) {
      await tx
        .delete(ubicacionesTable)
        .where(inArray(ubicacionesTable.id, createdUbicacionIds));
    }

    if (createdProveedorIds.length > 0) {
      await tx
        .delete(proveedoresTable)
        .where(inArray(proveedoresTable.id, createdProveedorIds));
    }
  });
  process.stdout.write(`Cleanup: OK\n`);
} catch (cleanErr) {
  process.stderr.write(`Cleanup ERROR: ${(cleanErr as Error).message}\n`);
}

process.exit(failed > 0 ? 1 : 0);
