import assert from "node:assert/strict";
import test from "node:test";
import { InventarioError, reserveSeries } from "./inventario";

function mockTransaction(ultimoNumero: number) {
  const inserts: Array<Record<string, number>> = [];
  const updates: Array<Record<string, number>> = [];

  const tx = {
    insert: () => ({
      values: (values: Record<string, number>) => {
        inserts.push(values);
        return {
          onConflictDoNothing: async () => undefined,
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          for: async () => [{ ultimoNumero }],
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, number>) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
  };

  return { tx, inserts, updates };
}

test("reserveSeries genera la primera serie de ocho dígitos con un mock de transacción", async () => {
  const mock = mockTransaction(10000000);
  const series = await reserveSeries(mock.tx as never, 1);

  assert.deepEqual(series, ["10000001"]);
  assert.deepEqual(mock.inserts, [{ id: 1, ultimoNumero: 10000000 }]);
  assert.deepEqual(mock.updates, [{ ultimoNumero: 10000001 }]);
});

test("reserveSeries acepta 99999999 como último número de ocho dígitos", async () => {
  const mock = mockTransaction(99999998);

  assert.deepEqual(await reserveSeries(mock.tx as never, 1), ["99999999"]);
  assert.deepEqual(mock.updates, [{ ultimoNumero: 99999999 }]);
});

test("reserveSeries rechaza el siguiente número sin actualizar el contador", async () => {
  const mock = mockTransaction(99999999);

  await assert.rejects(
    reserveSeries(mock.tx as never, 1),
    (error: unknown) =>
      error instanceof InventarioError &&
      error.code === "SERIES_EXHAUSTED" &&
      (error.details as { maximo?: number } | undefined)?.maximo === 99999999,
  );
  assert.deepEqual(mock.updates, []);
});