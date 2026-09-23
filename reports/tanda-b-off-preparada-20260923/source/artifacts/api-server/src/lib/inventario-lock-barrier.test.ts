import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  existenciasTable,
  movimientosTable,
  pool,
  productosTable,
  rollosTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import {
  crearRollo,
  inventoryConcurrencyTestSeam,
  type InventoryPair,
} from "./inventario";

// Must stay well below the pool's 30-second statement_timeout. On corrected
// code, timing out here means the second transaction is waiting at the lock,
// which is exactly the behavior this regression proves.
const BARRIER_TIMEOUT_MS = 2_000;

let releaseFirst!: () => void;
const firstMayContinue = new Promise<void>((resolve) => {
  releaseFirst = resolve;
});

let signalFirstReached!: () => void;
const firstReached = new Promise<void>((resolve) => {
  signalFirstReached = resolve;
});
let arrivals = 0;
const observedBalances: string[] = [];

const afterSaldoRead = async (_pair: InventoryPair, saldoAntes: string) => {
  arrivals += 1;
  observedBalances.push(saldoAntes);
  if (arrivals === 1) {
    signalFirstReached();
    await firstMayContinue;
  }
};

const createdProductIds: number[] = [];
const createdLocationIds: number[] = [];
const createdRolloIds: number[] = [];

try {
  const [user] = await db.select({ id: usuariosTable.id }).from(usuariosTable).limit(1);
  assert.ok(user, "La prueba requiere un usuario del seed.");

  const initialsResult = await pool.query<{ iniciales: string }>(
    `SELECT candidate AS iniciales
     FROM (
       SELECT chr(a) || chr(b) || chr(c) AS candidate
       FROM generate_series(65,90) AS a
       CROSS JOIN generate_series(65,90) AS b
       CROSS JOIN generate_series(65,90) AS c
     ) AS candidates
     WHERE NOT EXISTS (
       SELECT 1 FROM ubicaciones WHERE iniciales = candidates.candidate
     )
     ORDER BY candidate
     LIMIT 1`,
  );
  const initials = initialsResult.rows[0]?.iniciales;
  assert.ok(initials, "No hay iniciales disponibles para la prueba.");
  const [location] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `Barrera kardex ${randomUUID()}`,
      iniciales: initials,
      tipo: "TIENDA",
    })
    .returning();
  assert.ok(location);
  createdLocationIds.push(location.id);

  const productTag = randomUUID();
  const [product] = await db
    .insert(productosTable)
    .values({
      sku: `LOCK-${randomUUID()}`,
      tela: `Prueba barrera ${productTag}`,
      color: `Determinista ${productTag}`,
      unidad: "METRO",
      precioSugerido: "100.00",
      precioMayoreo: "100.00",
      precioMenudeo: "100.00",
      seVendePorMetro: true,
    })
    .returning();
  assert.ok(product);
  createdProductIds.push(product.id);

  const rollos = await db.transaction(async (tx) => {
    const first = await crearRollo(tx, {
      productoId: product.id,
      ubicacionId: location.id,
      cantidadInicial: "1.000",
      costoUnitario: "10.00",
      usuarioId: user.id,
      estado: "DISPONIBLE",
    });
    const second = await crearRollo(tx, {
      productoId: product.id,
      ubicacionId: location.id,
      cantidadInicial: "1.000",
      costoUnitario: "10.00",
      usuarioId: user.id,
      estado: "DISPONIBLE",
    });
    return [first, second];
  });
  createdRolloIds.push(...rollos.map(({ rollo }) => rollo.id));

  const write = (rolloId: number) =>
    db.transaction((tx) =>
      inventoryConcurrencyTestSeam.insertMovimiento(
        tx,
        {
          rolloId,
          productoId: product.id,
          ubicacionId: location.id,
          tipo: "VENTA",
          cantidad: "-1.000",
          usuarioId: user.id,
        },
        afterSaldoRead,
      ),
    );

  const first = write(rollos[0]!.rollo.id);
  await firstReached;
  const second = write(rollos[1]!.rollo.id);
  await new Promise((resolve) => setTimeout(resolve, BARRIER_TIMEOUT_MS));
  const secondWasBlockedBeforeReading = arrivals === 1;

  releaseFirst();
  await Promise.all([first, second]);

  assert.equal(
    secondWasBlockedBeforeReading,
    true,
    "La segunda transacción alcanzó la barrera: leyó el saldo antes de esperar el candado.",
  );
  assert.deepEqual(
    observedBalances,
    ["2.000", "1.000"],
    "Cada transacción debe leer el saldo confirmado por su predecesora.",
  );

  const movements = await db
    .select({
      cantidad: movimientosTable.cantidad,
      saldoPosterior: movimientosTable.saldoPosterior,
    })
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.productoId, product.id),
        eq(movimientosTable.ubicacionId, location.id),
      ),
    )
    .orderBy(asc(movimientosTable.id));
  assert.deepEqual(
    movements.map((movement) => [
      movement.cantidad,
      movement.saldoPosterior,
    ]),
    [
      ["1.000", "1.000"],
      ["1.000", "2.000"],
      ["-1.000", "1.000"],
      ["-1.000", "0.000"],
    ],
  );
  process.stdout.write(
    `PASS deterministic inventory lock barrier: arrivals-before-release=1 timeout=${BARRIER_TIMEOUT_MS}ms\n`,
  );
} finally {
  releaseFirst();
  if (createdRolloIds.length > 0) {
    await db
      .delete(movimientosTable)
      .where(inArray(movimientosTable.rolloId, createdRolloIds));
    await db.delete(rollosTable).where(inArray(rollosTable.id, createdRolloIds));
  }
  if (createdProductIds.length > 0) {
    await db
      .delete(existenciasTable)
      .where(inArray(existenciasTable.productoId, createdProductIds));
    await db
      .delete(productosTable)
      .where(inArray(productosTable.id, createdProductIds));
  }
  if (createdLocationIds.length > 0) {
    await db
      .delete(ubicacionesTable)
      .where(inArray(ubicacionesTable.id, createdLocationIds));
  }
  await pool.end();
}