import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  activarRollo,
  InventarioError,
  revertirMovimiento,
  type Tx,
} from "./inventario";

type Estado = "PROGRAMADO" | "DISPONIBLE" | "EN_TRANSITO" | "MOSTRADOR" | "VENDIDO" | "BAJA";

const messages: Record<Exclude<Estado, "PROGRAMADO">, string> = {
  BAJA:
    "Solo un rollo PROGRAMADO puede activarse a DISPONIBLE. El rollo está en BAJA. Si la baja se registró por error, usa el reverso del movimiento por su vía correspondiente; si un faltante de auditoría reapareció, usa Reactivación de faltante.",
  VENDIDO:
    "Solo un rollo PROGRAMADO puede activarse a DISPONIBLE. El rollo está VENDIDO. Si la venta se registró por error, usa el reverso por su vía correspondiente; si pertenece a un ticket, cancela ese ticket.",
  EN_TRANSITO:
    "Solo un rollo PROGRAMADO puede activarse a DISPONIBLE. El rollo está EN_TRANSITO; recibe o cancela su traslado.",
  DISPONIBLE:
    "Solo un rollo PROGRAMADO puede activarse a DISPONIBLE. El rollo ya está DISPONIBLE; no registres una recepción duplicada.",
  MOSTRADOR:
    "Solo un rollo PROGRAMADO puede activarse a DISPONIBLE. El rollo está en MOSTRADOR, un estado terminal.",
};

function fixture(
  estado: Estado,
  options: { becomeBajaWhileWaiting?: boolean; existingReceipt?: boolean } = {},
) {
  const dialect = new PgDialect();
  const rollo = {
    id: 7,
    serie: "10000007",
    productoId: 10,
    ubicacionId: 3,
    pisoId: 30,
    estado,
    cantidadActual: estado === "BAJA" ? "0.000" : "50.000",
    cantidadInicial: "50.000",
    costoUnitario: "12.50",
    costoTotal: "625.00",
    notas: "Lote íntegro",
  };
  const baja = {
    id: 55,
    rolloId: 7,
    productoId: 10,
    ubicacionId: 3,
    tipo: "AJUSTE_NEGATIVO",
    cantidad: "-50.000",
    saldoPosterior: "0.000",
    motivoSalidaExtraordinaria: null,
    documentoTipo: "AUDITORIA_INVENTARIO",
    documentoId: "8",
    salidaId: null,
    movimientoOrigenId: null,
    uuidCliente: null,
  };
  const recepcionHistorica = {
    id: 54,
    rolloId: 7,
    productoId: 10,
    ubicacionId: 3,
    tipo: "RECEPCION",
    cantidad: "50.000",
    saldoPosterior: "50.000",
    motivoSalidaExtraordinaria: null,
    documentoTipo: "ENTRADA",
    documentoId: "4",
    salidaId: null,
    movimientoOrigenId: null,
    uuidCliente: null,
  };
  const receiptUuid = "8f99d012-aab5-41e8-a600-37199fd4d86f";
  const movements: Array<Record<string, unknown>> = options.existingReceipt
    ? [{
      id: 70,
      rolloId: 7,
      productoId: 10,
      ubicacionId: 3,
      tipo: "RECEPCION",
      cantidad: "50.000",
      saldoPosterior: "50.000",
      uuidCliente: receiptUuid,
    }]
    : estado === "BAJA"
      ? [structuredClone(recepcionHistorica), structuredClone(baja)]
      : [];
  const cacheWrites: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  let rollReads = 0;
  let updates = 0;

  const tx = {
    execute: async (statement: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const query = dialect.sqlToQuery(statement);
      if (query.sql.includes("SELECT producto_id, ubicacion_id")) {
        return { rows: [{ producto_id: 10, ubicacion_id: 3 }] };
      }
      if (query.sql.includes("auditoria_faltante_reactivaciones")) {
        return { rows: [] };
      }
      events.push("pair-lock");
      return { rows: [] };
    },
    select: (fields?: Record<string, unknown>) => {
      let table = "";
      const resolve = () => {
        if (table === "rollos") {
          rollReads++;
          if (options.becomeBajaWhileWaiting && rollReads === 2) {
            rollo.estado = "BAJA";
            rollo.cantidadActual = "0.000";
          }
          if (fields?.cnt) {
            return [{ cnt: rollo.estado === "DISPONIBLE" ? 1 : 0 }];
          }
          return [structuredClone(rollo)];
        }
        if (table === "productos") return [{ unidad: "METRO" }];
        if (table === "movimientos") {
          if (fields?.saldo) {
            return [{ saldo: movements.at(-1)?.saldoPosterior ?? "0.000" }];
          }
          if (fields?.total) {
            const total = movements.reduce(
              (sum, movement) => sum + Number(movement.cantidad),
              0,
            );
            return [{ total: total.toFixed(3) }];
          }
          if (fields?.id) {
            const cancellation = movements.find(
              (movement) => movement.movimientoOrigenId === 55,
            );
            return cancellation ? [{ id: cancellation.id }] : [];
          }
          if (options.existingReceipt) {
            return [structuredClone(movements[0])];
          }
          return movements.length ? [structuredClone(baja)] : [];
        }
        return [];
      };
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "limit", "orderBy"]) {
        chain[method] = () => chain;
      }
      chain.for = () => {
        events.push(`${table}-for-update`);
        return chain;
      };
      chain.from = (tableValue: Parameters<typeof getTableName>[0]) => {
        table = getTableName(tableValue);
        return chain;
      };
      chain.then = (
        fulfilled: (value: unknown) => unknown,
        rejected: (error: unknown) => unknown,
      ) => Promise.resolve(resolve()).then(fulfilled, rejected);
      return chain;
    },
    update: () => ({
      set: (values: object) => ({
        where: async () => {
          updates++;
          Object.assign(rollo, values);
          return [];
        },
      }),
    }),
    insert: (tableValue: Parameters<typeof getTableName>[0]) => ({
      values: (values: Record<string, unknown>) => {
        const table = getTableName(tableValue);
        if (table === "existencias") {
          cacheWrites.push(structuredClone(values));
          return {
            onConflictDoUpdate: async () => [],
            then: (fulfilled: (value: unknown) => unknown) =>
              Promise.resolve([]).then(fulfilled),
          };
        }
        const inserted = table === "movimientos"
          ? { id: 100 + movements.length, ...values }
          : values;
        if (table === "movimientos") movements.push(inserted);
        return {
          returning: async () => [inserted],
          onConflictDoUpdate: async () => [],
          then: (fulfilled: (value: unknown) => unknown) =>
            Promise.resolve([]).then(fulfilled),
        };
      },
    }),
  } as unknown as Tx;

  return {
    tx,
    rollo,
    movements,
    cacheWrites,
    events,
    receiptUuid,
    get updates() {
      return updates;
    },
  };
}

const activationInput = {
  rolloId: 7,
  cantidadReal: "50.000",
  usuarioId: 9,
  notas: "Lote íntegro",
};

async function activationError(state: ReturnType<typeof fixture>) {
  const error = await activarRollo(state.tx, activationInput).then(
    () => null,
    (reason: unknown) => reason,
  );
  assert.ok(error instanceof InventarioError);
  return error;
}

test("PROGRAMADO activa una sola RECEPCION sin alterar cantidad, costo, notas ni ubicación y refresca cache", async () => {
  const state = fixture("PROGRAMADO");
  const result = await activarRollo(state.tx, activationInput);

  assert.equal(result.rollo.estado, "DISPONIBLE");
  assert.equal(state.rollo.cantidadInicial, "50.000");
  assert.equal(state.rollo.cantidadActual, "50.000");
  assert.equal(state.rollo.costoUnitario, "12.50");
  assert.equal(state.rollo.costoTotal, "625.00");
  assert.equal(state.rollo.notas, "Lote íntegro");
  assert.equal(state.rollo.ubicacionId, 3);
  assert.equal(state.movements.length, 1);
  assert.deepEqual(
    {
      tipo: result.movimiento.tipo,
      cantidad: result.movimiento.cantidad,
      productoId: result.movimiento.productoId,
      ubicacionId: result.movimiento.ubicacionId,
    },
    { tipo: "RECEPCION", cantidad: "50.000", productoId: 10, ubicacionId: 3 },
  );
  assert.deepEqual(state.cacheWrites, [{
    productoId: 10,
    ubicacionId: 3,
    cantidadTotal: "50.000",
    rollosCount: 1,
  }]);
});

test("BAJA, VENDIDO y EN_TRANSITO explican el flujo correcto sin mutación", async () => {
  for (const estado of ["BAJA", "VENDIDO", "EN_TRANSITO"] as const) {
    const state = fixture(estado);
    const before = structuredClone(state.rollo);
    const error = await activationError(state);
    assert.equal(error.code, "ACTIVATION_REQUIRES_PROGRAMADO", estado);
    assert.equal(error.message, messages[estado], estado);
    assert.deepEqual(state.rollo, before, estado);
    assert.equal(state.updates, 0, estado);
    assert.equal(state.movements.length, estado === "BAJA" ? 2 : 0, estado);
    assert.equal(state.cacheWrites.length, 0, estado);
  }
});

test("DISPONIBLE niega recepción duplicada y MOSTRADOR se declara terminal", async () => {
  for (const estado of ["DISPONIBLE", "MOSTRADOR"] as const) {
    const state = fixture(estado);
    const before = structuredClone(state.rollo);
    const error = await activationError(state);
    assert.equal(error.code, "ACTIVATION_REQUIRES_PROGRAMADO");
    assert.equal(error.message, messages[estado]);
    assert.deepEqual(state.rollo, before);
    assert.equal(state.updates, 0);
    assert.equal(state.movements.length, 0);
    assert.equal(state.cacheWrites.length, 0);
  }
});

test("BAJA bloqueada conserva el saldo para que el reverso ordinario restaure 50, no 100", async () => {
  const state = fixture("BAJA");
  const activationOutcome = await activarRollo(state.tx, activationInput).then(
    () => null,
    (reason: unknown) => reason,
  );
  const result = await revertirMovimiento(state.tx, {
    movimientoOrigenId: 55,
    usuarioId: 9,
  });

  assert.equal(result.rollo.estado, "DISPONIBLE");
  assert.equal(result.rollo.cantidadActual, "50.000");
  assert.deepEqual(state.cacheWrites.at(-1), {
    productoId: 10,
    ubicacionId: 3,
    cantidadTotal: "50.000",
    rollosCount: 1,
  });
  assert.ok(activationOutcome instanceof InventarioError);
  assert.equal(activationOutcome.code, "ACTIVATION_REQUIRES_PROGRAMADO");
  assert.equal(state.movements.length, 3);
  assert.equal(result.movimiento.tipo, "CANCELACION");
  assert.equal(result.movimiento.cantidad, "50.000");
});

test("reintento exitoso con el mismo UUID retorna la RECEPCION existente sin nueva transición", async () => {
  const state = fixture("DISPONIBLE", { existingReceipt: true });
  const result = await activarRollo(state.tx, {
    ...activationInput,
    uuidCliente: state.receiptUuid,
  });

  assert.equal(result.movimiento.id, 70);
  assert.equal(result.movimiento.tipo, "RECEPCION");
  assert.equal(result.rollo.estado, "DISPONIBLE");
  assert.equal(state.movements.length, 1);
  assert.equal(state.updates, 0);
  assert.equal(state.cacheWrites.length, 0);
});

test("la decisión usa el estado releído con FOR UPDATE tras esperar el lock", async () => {
  const state = fixture("PROGRAMADO", { becomeBajaWhileWaiting: true });
  const error = await activationError(state);

  assert.equal(error.code, "ACTIVATION_REQUIRES_PROGRAMADO");
  assert.equal(error.message, messages.BAJA);
  assert.equal(state.rollo.estado, "BAJA");
  assert.equal(state.rollo.cantidadActual, "0.000");
  assert.equal(state.updates, 0);
  assert.equal(state.movements.length, 0);
  assert.ok(state.events.includes("rollos-for-update"));
});