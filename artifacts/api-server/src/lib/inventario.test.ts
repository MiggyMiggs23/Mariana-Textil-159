/**
 * 12 integration tests for the inventory engine (inventario.ts).
 *
 * Run with:
 *   cd /home/runner/workspace/artifacts/api-server && \
 *   DATABASE_URL="postgres://postgres:password@helium:5432/heliumdb" \
 *   pnpm tsx src/lib/inventario.test.ts
 *
 * All tests use their own (producto, ubicacion) pair so they are fully
 * isolated. After ALL tests complete, a cleanup transaction deletes every
 * row created during the run.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  existenciasTable,
  movimientosTable,
  productosTable,
  rollosTable,
  ubicacionesTable,
} from "@workspace/db";
import {
  crearRollo,
  crearEntrada,
  activarRollo,
  moverRollo,
  recibirTransferencia,
  salidaMostrador,
  venderRollo,
  ajustarRollo,
  revertirMovimiento,
  conciliarTodo,
  InventarioError,
  type Tx,
} from "./inventario";

// ── Test harness ──────────────────────────────────────────────────────────────

const RUN = `T${Date.now()}`;
let passed = 0;
let failed = 0;

const createdProductoIds: number[] = [];
const createdUbicacionIds: number[] = [];
const createdRolloSeries: string[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`  ✗ ${name}\n    ${(err as Error).stack ?? (err as Error).message}\n`);
    failed++;
  }
}

let seq = 0;
async function mkProducto(): Promise<{ id: number; sku: string }> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(productosTable)
    .values({
      sku: `TST${tag}`.slice(0, 64),
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
    .values({ nombre: `UbTst ${tag}`.slice(0, 120), tipo: "BODEGA" as const })
    .returning();
  createdUbicacionIds.push(row!.id);
  return row!.id;
}

function trackRollo(serie: string) {
  createdRolloSeries.push(serie);
}

// ── Helper: read existencias ──────────────────────────────────────────────────

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

// ── Helper: sum movements for (producto, ubicacion) ──────────────────────────

async function sumMovimientos(
  productoId: number,
  ubicacionId: number,
): Promise<number> {
  const [row] = await db
    .select({ s: sql<string>`COALESCE(SUM(cantidad),0)::text` })
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.productoId, productoId),
        eq(movimientosTable.ubicacionId, ubicacionId),
      ),
    );
  return parseFloat(row?.s ?? "0");
}

// =============================================================================
// T-01: Create single roll → existencias = 47.3, rollos_count = 1
// =============================================================================

await test("T-01: Crear rollo DISPONIBLE → existencias 47.3, rollos_count 1", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "47.3",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  const ex = await readExistencia(productoId, ubicacionId);
  assert.ok(ex, "Existencia debe existir");
  assert.equal(ex.cantidadTotal, 47.3, `cantidadTotal debe ser 47.3, got ${ex.cantidadTotal}`);
  assert.equal(ex.rollosCount, 1, `rollosCount debe ser 1, got ${ex.rollosCount}`);
});

// =============================================================================
// T-02: Create 3 rolls in one tx → total 149.2, rollos_count 3
// =============================================================================

await test("T-02: Crear 3 rollos en 1 tx → total 149.2, rollos_count 3", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  const cantidades = ["47.3", "52.1", "49.8"];

  const rollos = await db.transaction(async (tx) => {
    const results = [];
    for (const cant of cantidades) {
      const { rollo } = await crearRollo(tx, {
        productoId,
        ubicacionId,
        cantidadInicial: cant,
        costoUnitario: "50.00",
        usuarioId: USUARIO,
        estado: "DISPONIBLE",
      });
      results.push(rollo);
    }
    return results;
  });

  for (const r of rollos) trackRollo(r.serie);

  const ex = await readExistencia(productoId, ubicacionId);
  assert.ok(ex, "Existencia debe existir");
  // 47.3 + 52.1 + 49.8 = 149.2
  assert.equal(
    ex.cantidadTotal,
    149.2,
    `total debe ser 149.2, got ${ex.cantidadTotal}`,
  );
  assert.equal(ex.rollosCount, 3, `rollosCount debe ser 3, got ${ex.rollosCount}`);
});

// =============================================================================
// T-03: salidaMostrador → remaining 101.9; roll stays ABIERTO (terminal)
// =============================================================================

await test("T-03: salidaMostrador → ABIERTO terminal, existencias decrements", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  // Create 3 rolls: 47.3 + 52.1 + 49.8 = 149.2
  const cantidades = ["47.3", "52.1", "49.8"];
  let rolloPulled: number | null = null;

  const rollos = await db.transaction(async (tx) => {
    const arr = [];
    for (const cant of cantidades) {
      const { rollo } = await crearRollo(tx, {
        productoId,
        ubicacionId,
        cantidadInicial: cant,
        costoUnitario: "50.00",
        usuarioId: USUARIO,
        estado: "DISPONIBLE",
      });
      arr.push(rollo);
    }
    return arr;
  });
  for (const r of rollos) trackRollo(r.serie);

  // Pull the first roll (47.3) to mostrador
  rolloPulled = rollos[0]!.id;
  const { rollo: abierto } = await db.transaction(async (tx) =>
    salidaMostrador(tx, {
      rolloId: rolloPulled!,
      usuarioId: USUARIO,
    }),
  );

  assert.equal(abierto.estado, "ABIERTO", "Roll must be ABIERTO");

  // Remaining: 52.1 + 49.8 = 101.9
  const ex = await readExistencia(productoId, ubicacionId);
  assert.ok(ex, "Existencia debe existir");
  // -47.3 → 149.2 - 47.3 = 101.9
  assert.equal(
    ex.cantidadTotal,
    101.9,
    `remaining should be 101.9, got ${ex.cantidadTotal}`,
  );
  assert.equal(ex.rollosCount, 2, `rollosCount debe ser 2, got ${ex.rollosCount}`);

  // ABIERTO cannot transition anywhere — salidaMostrador on it must fail
  await assert.rejects(
    () =>
      db.transaction(async (tx) =>
        salidaMostrador(tx, { rolloId: rolloPulled!, usuarioId: USUARIO }),
      ),
    (err: Error) => {
      assert.ok(
        err instanceof InventarioError,
        `Expected InventarioError, got ${err.constructor.name}: ${err.message}`,
      );
      return true;
    },
    "Re-pulling ABIERTO roll must throw InventarioError",
  );
});

// =============================================================================
// T-04: Transfer out → consolidated total unchanged (EN_TRANSITO stage)
// =============================================================================

await test("T-04: Transferencia salida → total consolidado invariante", async () => {
  const { id: productoId } = await mkProducto();
  const origen = await mkUbicacion();
  const transito = 8; // "En tránsito" real location id

  const USUARIO = 1;
  const CANTIDAD = "35.5";

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId: origen,
      cantidadInicial: CANTIDAD,
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  const totalAntes = (await readExistencia(productoId, origen))!.cantidadTotal;

  await db.transaction(async (tx) =>
    moverRollo(tx, {
      rolloId: rollo.id,
      ubicacionOrigenId: origen,
      ubicacionTransitoId: transito,
      usuarioId: USUARIO,
    }),
  );

  const exOrigen = await readExistencia(productoId, origen);
  const exTransito = await readExistencia(productoId, transito);

  const totalDespues =
    (exOrigen?.cantidadTotal ?? 0) + (exTransito?.cantidadTotal ?? 0);

  assert.equal(
    parseFloat(totalDespues.toFixed(3)),
    parseFloat(totalAntes.toFixed(3)),
    `Total consolidado debe mantenerse: ${totalAntes} → origen ${exOrigen?.cantidadTotal} + transito ${exTransito?.cantidadTotal}`,
  );
});

// =============================================================================
// T-05: Receive transfer → consolidated total still unchanged
// =============================================================================

await test("T-05: Recibir transferencia → total consolidado invariante", async () => {
  const { id: productoId } = await mkProducto();
  const origen = await mkUbicacion();
  const transito = 8;
  const destino = await mkUbicacion();

  const USUARIO = 1;
  const CANTIDAD = "28.7";

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId: origen,
      cantidadInicial: CANTIDAD,
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  await db.transaction(async (tx) =>
    moverRollo(tx, {
      rolloId: rollo.id,
      ubicacionOrigenId: origen,
      ubicacionTransitoId: transito,
      usuarioId: USUARIO,
    }),
  );

  await db.transaction(async (tx) =>
    recibirTransferencia(tx, {
      rolloId: rollo.id,
      ubicacionDestinoId: destino,
      usuarioId: USUARIO,
    }),
  );

  const exOrigen = await readExistencia(productoId, origen);
  const exTransito = await readExistencia(productoId, transito);
  const exDestino = await readExistencia(productoId, destino);

  const total =
    (exOrigen?.cantidadTotal ?? 0) +
    (exTransito?.cantidadTotal ?? 0) +
    (exDestino?.cantidadTotal ?? 0);

  assert.equal(
    parseFloat(total.toFixed(3)),
    parseFloat(CANTIDAD),
    `Total consolidado must equal original ${CANTIDAD}, got ${total}`,
  );

  // Roll should now be DISPONIBLE at destino
  const [r] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id))
    .limit(1);
  assert.equal(r!.estado, "DISPONIBLE", "Roll should be DISPONIBLE at destination");
  assert.equal(r!.ubicacionId, destino, "Roll should be at destination");
});

// =============================================================================
// T-06: Concurrent same-roll operation → one wins, one fails
// =============================================================================

await test("T-06: Operaciones concurrentes en mismo rollo → una gana, otra falla", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "30.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  // Both try to salidaMostrador the same roll concurrently
  const race = await Promise.allSettled([
    db.transaction(async (tx) =>
      salidaMostrador(tx, { rolloId: rollo.id, usuarioId: USUARIO }),
    ),
    db.transaction(async (tx) =>
      salidaMostrador(tx, { rolloId: rollo.id, usuarioId: USUARIO }),
    ),
  ]);

  const wins = race.filter((r) => r.status === "fulfilled");
  const losses = race.filter((r) => r.status === "rejected");

  assert.equal(wins.length, 1, `Exactly 1 operation should succeed, got ${wins.length}`);
  assert.equal(losses.length, 1, `Exactly 1 operation should fail, got ${losses.length}`);

  // Roll should be ABIERTO
  const [r] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id))
    .limit(1);
  assert.equal(r!.estado, "ABIERTO", "Roll must be ABIERTO after the winning operation");
});

// =============================================================================
// T-07: Concurrent series creation → global distinct consecutive numbers
// =============================================================================

await test("T-07: Series concurrentes → números globales distintos y consecutivos", async () => {
  // Use TWO distinct products to prove the counter is GLOBAL, not per-SKU.
  const { id: productoA } = await mkProducto();
  const { id: productoB } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;
  const N = 12;

  const promises = Array.from({ length: N }, (_, i) =>
    db.transaction(async (tx) =>
      crearRollo(tx, {
        productoId: i % 2 === 0 ? productoA : productoB,
        ubicacionId,
        cantidadInicial: "1.000",
        costoUnitario: "1.00",
        usuarioId: USUARIO,
        estado: "DISPONIBLE",
      }),
    ),
  );

  const results = await Promise.all(promises);
  const series = results.map((r) => r.rollo.serie);
  for (const s of series) trackRollo(s);

  // All series are numeric-only strings (no SKU prefix)
  for (const s of series) {
    assert.match(s, /^\d+$/, `Series must be numeric only: ${s}`);
  }

  // All distinct globally (across both products)
  const nums = series.map((s) => Number(s));
  const unique = new Set(nums);
  assert.equal(
    unique.size,
    N,
    `All ${N} series must be globally distinct, got ${unique.size}: ${series.join(", ")}`,
  );

  // Consecutive: sorted numbers form a run with no gaps
  const sorted = [...nums].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assert.equal(
      sorted[i]! - sorted[i - 1]!,
      1,
      `Series must be consecutive with no gaps: ${sorted.join(", ")}`,
    );
  }

  // First allocated series must be >= 1000001 (counter starts at 1000001)
  assert.ok(
    sorted[0]! >= 1000001,
    `Series must start at or after 1000001, got ${sorted[0]}`,
  );
});

// =============================================================================
// T-08: Reversal restores exact previous existencia
// =============================================================================

await test("T-08: Revertir movimiento restaura existencia exacta previa", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  const { rollo, movimiento: altaMov } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "40.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  const exBefore = await readExistencia(productoId, ubicacionId);
  assert.ok(exBefore, "existencia antes debe existir");
  const cantidadBefore = exBefore.cantidadTotal;

  // Reverse the ALTA movement
  const { movimiento: cancelacion } = await db.transaction(async (tx) =>
    revertirMovimiento(tx, {
      movimientoOrigenId: Number(altaMov!.id),
      usuarioId: USUARIO,
      justificacion: "Test reversal T-08",
    }),
  );

  assert.equal(cancelacion.tipo, "CANCELACION", "Cancellation must be CANCELACION type");
  assert.equal(
    cancelacion.movimientoOrigenId,
    Number(altaMov!.id),
    "Must reference original movement",
  );

  const exAfter = await readExistencia(productoId, ubicacionId);
  assert.ok(exAfter !== null, "existencia table row should still exist");
  // After reversal of ALTA, quantity should be 0 (or the original was 40, inverse is -40)
  assert.equal(
    parseFloat(exAfter!.cantidadTotal.toFixed(3)),
    0,
    `cantidadTotal debe ser 0 después de revertir, got ${exAfter?.cantidadTotal}`,
  );

  // Original movement still exists (immutable)
  const [orig] = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.id, altaMov!.id))
    .limit(1);
  assert.ok(orig, "Original movement must still exist (immutable)");
});

// =============================================================================
// T-09: Adjustment with <10-char justification is rejected
// =============================================================================

await test("T-09: Ajuste con justificación <10 chars es rechazado", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "20.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  // Short justification (< 10 chars)
  await assert.rejects(
    () =>
      db.transaction(async (tx) =>
        ajustarRollo(tx, {
          rolloId: rollo.id,
          cantidadNueva: "10.0",
          justificacion: "short",
          usuarioId: USUARIO,
        }),
      ),
    (err: Error) => {
      assert.ok(err instanceof InventarioError, `Expected InventarioError, got ${err.constructor.name}`);
      assert.equal(
        (err as InventarioError).code,
        "JUSTIFICACION_REQUIRED",
        "Error code must be JUSTIFICACION_REQUIRED",
      );
      return true;
    },
    "Short justification must throw InventarioError",
  );

  // Valid adjustment (≥ 10 chars) should succeed
  const { rollo: adjusted } = await db.transaction(async (tx) =>
    ajustarRollo(tx, {
      rolloId: rollo.id,
      cantidadNueva: "15.0",
      justificacion: "Conteo físico reveló diferencia",
      usuarioId: USUARIO,
    }),
  );
  assert.equal(parseFloat(adjusted.cantidadActual), 15.0, "Quantity should be 15.0 after valid adjustment");
});

// =============================================================================
// T-10: SUM(movimientos.cantidad) = cache for every (producto, ubicacion) pair
// =============================================================================

await test("T-10: SUM(movimientos.cantidad) = cache para todo par", async () => {
  // Create several operations to generate varied (producto, ubicacion) pairs
  const { id: productoId } = await mkProducto();
  const ubicacion1 = await mkUbicacion();
  const ubicacion2 = await mkUbicacion();
  const USUARIO = 1;

  await db.transaction(async (tx) => {
    const { rollo: r1 } = await crearRollo(tx, {
      productoId,
      ubicacionId: ubicacion1,
      cantidadInicial: "10.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    });
    const { rollo: r2 } = await crearRollo(tx, {
      productoId,
      ubicacionId: ubicacion2,
      cantidadInicial: "20.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    });
    trackRollo(r1.serie);
    trackRollo(r2.serie);
  });

  const conciliacion = await conciliarTodo(productoId);
  assert.ok(conciliacion.length >= 2, "Should have at least 2 pairs");

  for (const row of conciliacion) {
    assert.ok(
      !row.discrepancia,
      `Discrepancia en (producto=${row.productoId}, ubicacion=${row.ubicacionId}): movimientos=${row.cantidadMovimientos} vs cache=${row.cantidadCache}`,
    );
    assert.equal(
      row.cantidadMovimientos,
      row.cantidadCache,
      `SUM movimientos (${row.cantidadMovimientos}) debe igualar cache (${row.cantidadCache})`,
    );
  }
});

// =============================================================================
// T-11: Repeated uuid_cliente → no second movement, returns original
// =============================================================================

await test("T-11: uuid_cliente repetido → no duplica movimiento, retorna original", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;
  // Must be a valid UUID for the uuid column
  const UUID = "550e8400-e29b-41d4-a716-446655440000";

  // First call
  const { rollo: r1, movimiento: m1 } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "25.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
      uuidCliente: UUID,
    }),
  );
  trackRollo(r1.serie);
  assert.ok(m1, "First call should produce a movement");

  // Second call with same uuid_cliente
  const { rollo: r2, movimiento: m2 } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "25.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
      uuidCliente: UUID,
    }),
  );

  // Second call returns the original result, does NOT create a new movement
  assert.equal(r2.id, r1.id, "Second call must return original roll");
  assert.equal(Number(m2!.id), Number(m1!.id), "Second call must return original movement");

  // Only 1 movement should exist for this roll
  const movs = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.rolloId, r1.id));
  assert.equal(movs.length, 1, `Only 1 movement should exist, got ${movs.length}`);

  // Existencias should reflect exactly 1 ALTA
  const ex = await readExistencia(productoId, ubicacionId);
  assert.ok(ex, "Existencia debe existir");
  assert.equal(ex.cantidadTotal, 25.0, `cantidadTotal debe ser 25.0, got ${ex.cantidadTotal}`);
});

// =============================================================================
// T-12: PROGRAMADO roll absent from existencias; after activation present
// =============================================================================

await test("T-12: Rollo PROGRAMADO ausente de existencias; tras activación presente", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  // Create a PROGRAMADO roll (no movement, no cache)
  const { rollo, movimiento } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "30.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "PROGRAMADO",
    }),
  );
  trackRollo(rollo.serie);

  assert.equal(rollo.estado, "PROGRAMADO", "Roll should be PROGRAMADO");
  assert.equal(movimiento, null, "PROGRAMADO roll must not have a movement");

  // Existencias must NOT include this roll
  const exBefore = await readExistencia(productoId, ubicacionId);
  assert.equal(
    exBefore?.cantidadTotal ?? 0,
    0,
    `PROGRAMADO roll should not appear in existencias, got ${exBefore?.cantidadTotal}`,
  );

  // Activate the roll
  const { rollo: activated } = await db.transaction(async (tx) =>
    activarRollo(tx, {
      rolloId: rollo.id,
      cantidadReal: "30.0",
      usuarioId: USUARIO,
    }),
  );

  assert.equal(activated.estado, "DISPONIBLE", "After activation, roll must be DISPONIBLE");

  const exAfter = await readExistencia(productoId, ubicacionId);
  assert.ok(exAfter, "Existencia must exist after activation");
  assert.equal(
    exAfter.cantidadTotal,
    30.0,
    `cantidadTotal debe ser 30.0, got ${exAfter.cantidadTotal}`,
  );
  assert.equal(exAfter.rollosCount, 1, `rollosCount debe ser 1, got ${exAfter.rollosCount}`);
});

// =============================================================================
// T-13: Revertir SALIDA_MOSTRADOR falla; rollo permanece ABIERTO
// =============================================================================

await test("T-13: Revertir SALIDA_MOSTRADOR falla; rollo permanece ABIERTO", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "30.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  const { movimiento: salidaMov } = await db.transaction(async (tx) =>
    salidaMostrador(tx, { rolloId: rollo.id, usuarioId: USUARIO }),
  );

  // Attempt to reverse the SALIDA_MOSTRADOR — must fail with a clear error
  await assert.rejects(
    () =>
      db.transaction(async (tx) =>
        revertirMovimiento(tx, {
          movimientoOrigenId: Number(salidaMov.id),
          usuarioId: USUARIO,
          justificacion: "Test reversal T-13",
        }),
      ),
    (err: Error) => {
      assert.ok(
        err instanceof InventarioError,
        `Expected InventarioError, got ${err.constructor.name}: ${err.message}`,
      );
      assert.equal(
        (err as InventarioError).code,
        "ABIERTO_TERMINAL",
        `Expected ABIERTO_TERMINAL, got ${(err as InventarioError).code}`,
      );
      return true;
    },
    "Reverting SALIDA_MOSTRADOR must throw InventarioError with ABIERTO_TERMINAL",
  );

  // Roll must still be ABIERTO
  const [r] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id))
    .limit(1);
  assert.equal(r!.estado, "ABIERTO", "Roll must remain ABIERTO after failed reversal");
});

// =============================================================================
// T-14: Revertir VENTA → rollo regresa a DISPONIBLE con existencia exacta
// =============================================================================

await test("T-14: Revertir VENTA → rollo DISPONIBLE, existencia restaurada", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;
  const CANTIDAD = "22.5";

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: CANTIDAD,
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  const exBefore = await readExistencia(productoId, ubicacionId);
  assert.ok(exBefore, "existencia must exist before venta");
  assert.equal(exBefore.cantidadTotal, 22.5, "cantidadTotal before venta must be 22.5");

  const { movimiento: ventaMov } = await db.transaction(async (tx) =>
    venderRollo(tx, { rolloId: rollo.id, usuarioId: USUARIO }),
  );

  const exAfterVenta = await readExistencia(productoId, ubicacionId);
  assert.equal(
    exAfterVenta?.cantidadTotal ?? 0,
    0,
    "existencia must be 0 after venta",
  );

  // Reverse the VENTA
  await db.transaction(async (tx) =>
    revertirMovimiento(tx, {
      movimientoOrigenId: Number(ventaMov.id),
      usuarioId: USUARIO,
      justificacion: "Test reversal T-14",
    }),
  );

  // Roll must be DISPONIBLE again
  const [r] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id))
    .limit(1);
  assert.equal(r!.estado, "DISPONIBLE", "Roll must be DISPONIBLE after reversing VENTA");
  assert.equal(
    parseFloat(r!.cantidadActual),
    22.5,
    `cantidadActual must be restored to ${CANTIDAD}, got ${r!.cantidadActual}`,
  );

  // Existencia must be restored to exact original quantity
  const exAfterRevert = await readExistencia(productoId, ubicacionId);
  assert.ok(exAfterRevert, "existencia must exist after revert");
  assert.equal(
    exAfterRevert.cantidadTotal,
    22.5,
    `existencia must be restored to ${CANTIDAD}, got ${exAfterRevert.cantidadTotal}`,
  );
});

// =============================================================================
// T-15: Revertir ajuste BAJA → rollo DISPONIBLE con cantidad exacta
// =============================================================================

await test("T-15: Revertir ajuste BAJA → rollo DISPONIBLE, cantidad restaurada", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;
  const CANTIDAD = "18.0";

  const { rollo } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: CANTIDAD,
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);

  // Write the roll off (BAJA)
  const { movimiento: bajaMov } = await db.transaction(async (tx) =>
    ajustarRollo(tx, {
      rolloId: rollo.id,
      cantidadNueva: null, // BAJA
      justificacion: "Merma detectada en almacén",
      usuarioId: USUARIO,
    }),
  );

  const [afterBaja] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id))
    .limit(1);
  assert.equal(afterBaja!.estado, "BAJA", "Roll must be BAJA after adjustment");

  // Reverse the BAJA-producing adjustment
  await db.transaction(async (tx) =>
    revertirMovimiento(tx, {
      movimientoOrigenId: Number(bajaMov.id),
      usuarioId: USUARIO,
      justificacion: "Reversal T-15 baja equivocada",
    }),
  );

  const [r] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id))
    .limit(1);
  assert.equal(r!.estado, "DISPONIBLE", "Roll must be DISPONIBLE after reverting BAJA adjustment");
  assert.equal(
    parseFloat(r!.cantidadActual),
    parseFloat(CANTIDAD),
    `cantidadActual must be restored to ${CANTIDAD}, got ${r!.cantidadActual}`,
  );

  const ex = await readExistencia(productoId, ubicacionId);
  assert.ok(ex, "existencia must exist after revert");
  assert.equal(
    ex.cantidadTotal,
    parseFloat(CANTIDAD),
    `existencia must equal ${CANTIDAD}, got ${ex.cantidadTotal}`,
  );
});

// =============================================================================
// T-16: Después de cada reverso, suma kardex = caché (invariante)
// =============================================================================

await test("T-16: Tras reversos, SUM(movimientos) = caché para todo par", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const USUARIO = 1;

  // Create two rolls
  const { rollo: r1 } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "10.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  const { rollo: r2 } = await db.transaction(async (tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "15.0",
      costoUnitario: "50.00",
      usuarioId: USUARIO,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(r1.serie);
  trackRollo(r2.serie);

  // Sell r1
  const { movimiento: ventaMov } = await db.transaction(async (tx) =>
    venderRollo(tx, { rolloId: r1.id, usuarioId: USUARIO }),
  );

  // Write off r2 (BAJA)
  const { movimiento: bajaMov } = await db.transaction(async (tx) =>
    ajustarRollo(tx, {
      rolloId: r2.id,
      cantidadNueva: null,
      justificacion: "Merma por ajuste T-16 test",
      usuarioId: USUARIO,
    }),
  );

  // Reverse both
  await db.transaction(async (tx) =>
    revertirMovimiento(tx, {
      movimientoOrigenId: Number(ventaMov.id),
      usuarioId: USUARIO,
      justificacion: "Reversal venta T-16",
    }),
  );
  await db.transaction(async (tx) =>
    revertirMovimiento(tx, {
      movimientoOrigenId: Number(bajaMov.id),
      usuarioId: USUARIO,
      justificacion: "Reversal baja T-16 test data",
    }),
  );

  // Invariant: SUM(movimientos) must equal cache
  const movSum = await sumMovimientos(productoId, ubicacionId);
  const ex = await readExistencia(productoId, ubicacionId);
  assert.ok(ex, "existencia must exist");
  assert.equal(
    parseFloat(movSum.toFixed(3)),
    parseFloat(ex.cantidadTotal.toFixed(3)),
    `SUM movimientos (${movSum}) must equal cache (${ex.cantidadTotal})`,
  );

  // Verify conciliarTodo finds no discrepancies for this product
  const conciliacion = await conciliarTodo(productoId, ubicacionId);
  for (const row of conciliacion) {
    assert.ok(
      !row.discrepancia,
      `Discrepancy after reversals: movimientos=${row.cantidadMovimientos} vs cache=${row.cantidadCache}`,
    );
  }
});

await test("T-20A: creación rechaza costos faltante, cero, negativo y menor a precisión DB", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const invalidCosts = [undefined, "", "0", "-1", "0.004"];

  for (const [index, costoUnitario] of invalidCosts.entries()) {
    await assert.rejects(
      () =>
        db.transaction((tx) =>
          crearRollo(tx, {
            productoId,
            ubicacionId,
            cantidadInicial: "10",
            costoUnitario: costoUnitario as string,
            usuarioId: 1,
            estado: "DISPONIBLE",
          }),
        ),
      (error: unknown) =>
        error instanceof InventarioError &&
        error.code === "INVALID_UNIT_COST",
    );

    await assert.rejects(
      () =>
        db.transaction((tx) =>
          crearEntrada(tx, {
            ubicacionId,
            usuarioId: 1,
            uuidCliente: randomUUID(),
            lineas: [
              {
                productoId,
                costoUnitario: costoUnitario as string,
                cantidades: ["10"],
              },
            ],
          }),
        ),
      (error: unknown) =>
        error instanceof InventarioError &&
        error.code === "INVALID_UNIT_COST",
    );
  }
});

await test("T-20B: activación rechaza rollo legado sin costo antes de mutar", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const { rollo } = await db.transaction((tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "10",
      costoUnitario: "20.00",
      usuarioId: 1,
      estado: "PROGRAMADO",
    }),
  );
  trackRollo(rollo.serie);
  await db
    .update(rollosTable)
    .set({ costoUnitario: "0.00" })
    .where(eq(rollosTable.id, rollo.id));
  const expectedMessage = `El rollo serie ${rollo.serie} no tiene un costo unitario válido. Contacta a administración.`;

  await assert.rejects(
    () =>
      db.transaction((tx) =>
        activarRollo(tx, {
          rolloId: rollo.id,
          cantidadReal: "10",
          usuarioId: 1,
        }),
      ),
    (error: unknown) =>
      error instanceof InventarioError &&
      error.code === "ROLLO_SIN_COSTO" &&
      error.message === expectedMessage &&
      !error.message.includes("0.00"),
  );

  const [unchanged] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(unchanged!.estado, "PROGRAMADO");
  const movimientos = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.rolloId, rollo.id));
  assert.equal(movimientos.length, 0);
});

await test("T-20C: venta directa rechaza rollo legado sin costo antes de mutar", async () => {
  const { id: productoId } = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const { rollo } = await db.transaction((tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: "10",
      costoUnitario: "20.00",
      usuarioId: 1,
      estado: "DISPONIBLE",
    }),
  );
  trackRollo(rollo.serie);
  await db
    .update(rollosTable)
    .set({ costoUnitario: "0.00" })
    .where(eq(rollosTable.id, rollo.id));
  const expectedMessage = `El rollo serie ${rollo.serie} no tiene un costo unitario válido. Contacta a administración.`;

  await assert.rejects(
    () =>
      db.transaction((tx) =>
        venderRollo(tx, { rolloId: rollo.id, usuarioId: 1 }),
      ),
    (error: unknown) =>
      error instanceof InventarioError &&
      error.code === "ROLLO_SIN_COSTO" &&
      error.message === expectedMessage &&
      !error.message.includes("0.00"),
  );

  const [unchanged] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(unchanged!.estado, "DISPONIBLE");
  const movimientos = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.rolloId, rollo.id));
  assert.equal(movimientos.length, 1);
  assert.equal(movimientos[0]!.tipo, "ALTA");
});

// =============================================================================
// Cleanup
// =============================================================================

process.stdout.write(`\n─────────────────────────────────────────────\n`);
process.stdout.write(`Results: ${passed} passed, ${failed} failed\n`);

// Always cleanup, even on failures
try {
  await db.transaction(async (tx) => {
    // Delete movements referencing test rolls
    if (createdRolloSeries.length > 0) {
      const rollos = await tx
        .select({ id: rollosTable.id })
        .from(rollosTable)
        .where(
          inArray(rollosTable.serie, createdRolloSeries),
        );
      const rolloIds = rollos.map((r) => r.id);
      if (rolloIds.length > 0) {
        await tx
          .delete(movimientosTable)
          .where(inArray(movimientosTable.rolloId, rolloIds));
      }
    }

    // Delete test rolls
    if (createdRolloSeries.length > 0) {
      await tx
        .delete(rollosTable)
        .where(inArray(rollosTable.serie, createdRolloSeries));
    }

    // Delete existencias for test products
    if (createdProductoIds.length > 0) {
      await tx
        .delete(existenciasTable)
        .where(inArray(existenciasTable.productoId, createdProductoIds));
    }

    // Delete test products
    if (createdProductoIds.length > 0) {
      await tx
        .delete(productosTable)
        .where(inArray(productosTable.id, createdProductoIds));
    }

    // Delete test ubicaciones
    if (createdUbicacionIds.length > 0) {
      await tx
        .delete(ubicacionesTable)
        .where(inArray(ubicacionesTable.id, createdUbicacionIds));
    }
  });
  process.stdout.write(`Cleanup: OK\n`);
} catch (cleanErr) {
  process.stderr.write(`Cleanup ERROR: ${(cleanErr as Error).message}\n`);
}

process.exit(failed > 0 ? 1 : 0);
