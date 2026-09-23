import assert from "node:assert/strict";
import test from "node:test";
import {
  consumirRollosMetreadoSeleccionados,
  validarFuentesRollosMetreado,
} from "./lib/inventario";
import {
  allocateCents,
  allocatePhysicalCostCents,
} from "./lib/supplier-trace";

test("fuentes METRO deben sumar exactamente las milésimas de la línea", () => {
  assert.deepEqual(
    [...validarFuentesRollosMetreado(
      [
        { rolloId: 11, cantidad: "0.375" },
        { rolloId: 12, cantidad: "0.625" },
      ],
      "1.000",
    )],
    [
      [11, 375n],
      [12, 625n],
    ],
  );
  assert.throws(
    () =>
      validarFuentesRollosMetreado(
        [{ rolloId: 11, cantidad: "0.375" }],
        "1.000",
      ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "SOURCE_ROLLO_QUANTITY_MISMATCH",
  );
});

test("la selección METRO rechaza un rollo que desapareció después del lock", async () => {
  const queryChain = () => {
    const chain: Record<string, unknown> = {
      from: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      for: () => chain,
      limit: () => chain,
      then: (resolve: (rows: unknown[]) => unknown) =>
        Promise.resolve([]).then(resolve),
    };
    return chain;
  };
  const mockTx = {
    execute: async () => ({ rows: [] }),
    select: () => queryChain(),
  };

  await assert.rejects(
    consumirRollosMetreadoSeleccionados(mockTx as never, {
      productoId: 501,
      ubicacionId: 10,
      fuentes: [{ rolloId: 11, cantidad: "1.000" }],
      cantidadTotal: "1.000",
      usuarioId: 7,
      documentoId: "ticket-1",
    }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "SOURCE_ROLLO_NOT_FOUND",
  );
});

test("la selección METRO exige proveedor autoritativo antes de mutar inventario", async () => {
  const queryChain = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {
      from: () => chain,
      leftJoin: () => chain,
      innerJoin: () => queryChain([]),
      where: () => chain,
      orderBy: () => chain,
      for: () => chain,
      limit: () => chain,
      then: (resolve: (rows: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    return chain;
  };
  const mockTx = {
    execute: async () => ({ rows: [] }),
    select: () => queryChain([{
      id: 11,
      serie: "R11",
      productoId: 501,
      ubicacionId: 10,
      estado: "DISPONIBLE",
      cantidadActual: "1.000",
      recepcionId: 101,
      recepcionProveedorId: null,
    }]),
  };

  await assert.rejects(
    consumirRollosMetreadoSeleccionados(mockTx as never, {
      productoId: 501,
      ubicacionId: 10,
      fuentes: [{ rolloId: 11, cantidad: "1.000" }],
      cantidadTotal: "1.000",
      usuarioId: 7,
      documentoId: "ticket-2",
    }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "SOURCE_ROLLO_ENTRY_REQUIRED",
  );
});

test("la asignación largest-remainder conserva cada centavo", () => {
  const allocated = allocateCents(1001, [
    { cantidadMilesimas: 500n, rolloId: 11, movimientoId: 101 },
    { cantidadMilesimas: 500n, rolloId: 12, movimientoId: 102 },
  ]);
  assert.deepEqual([...allocated.entries()], [
    [101, 501],
    [102, 500],
  ]);
  assert.equal(
    [...allocated.values()].reduce((sum, value) => sum + value, 0),
    1001,
  );
});

test("el costo físico se redondea por grupo y costos no positivos quedan disponibles", () => {
  const movements = [
    { id: 101, rolloId: 11, cantidadMilesimas: 1n },
    { id: 102, rolloId: 11, cantidadMilesimas: 1n },
  ];
  const rolls = new Map([
    [
      11,
      {
        id: 11,
        recepcionId: 1,
        proveedorId: 1,
        costoUnitario: "5.00",
      },
    ],
  ]);
  const costs = allocatePhysicalCostCents(movements, rolls);
  assert.deepEqual([...costs.entries()], [[101, 1], [102, 0]]);
  assert.equal(
    [...costs.values()].reduce(
      (sum: number, value) => sum + (value ?? 0),
      0,
    ),
    1,
  );

  const unavailableRolls = new Map([
    [
      11,
      {
        id: 11,
        recepcionId: 1,
        proveedorId: 1,
        costoUnitario: "0.00",
      },
    ],
  ]);
  assert.deepEqual(
    [...allocatePhysicalCostCents(movements, unavailableRolls).entries()],
    [[101, null], [102, null]],
  );
});