import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  InventarioError,
  inventarioErrorEnvelope,
  reactivarFaltanteAuditoria,
  revertirMovimiento,
  type Tx,
} from "./inventario";

const reactivationInput = {
  rolloId: 7,
  auditoriaOrigenId: 3,
  origen: "AUDITORIA" as const,
  ubicacionId: 2,
  pisoId: 20,
  motivo: "Reapareció físicamente durante la revisión",
  uuidCliente: "2d7f9c01-5c28-4aa3-9f37-4d665b861e12",
  usuarioId: 8,
  rol: "ADMIN",
  ip: "unit-test",
};

type Provenance = {
  movimiento_baja_id: number;
  rollo_id: number;
  movimiento_reactivacion_id: number;
};

/**
 * Stateful transaction double only: no connection, users, sessions, or database
 * writes. It executes both real inventory engine operations and preserves their
 * in-memory quantity/movement effects between calls.
 */
function fixture(
  initialProvenance?: Provenance,
  options: { reverseDuringLockWait?: boolean } = {},
) {
  const dialect = new PgDialect();
  const rollo = {
    id: 7,
    serie: "100007",
    productoId: 10,
    ubicacionId: 1,
    pisoId: 10,
    estado: "BAJA",
    cantidadActual: "0.000",
    cantidadInicial: "50.125",
    costoUnitario: "12.50",
    costoTotal: "626.56",
    recepcionId: 91,
    proveedorId: 92,
  };
  const original = {
    id: 55,
    rolloId: 7,
    productoId: 10,
    ubicacionId: 1,
    tipo: "AJUSTE_NEGATIVO",
    cantidad: "-50.125",
    documentoTipo: "AUDITORIA_INVENTARIO",
    documentoId: "3",
    motivoSalidaExtraordinaria: null,
    salidaId: null,
  };
  const movements: Array<Record<string, unknown>> = [structuredClone(original)];
  const events: string[] = [];
  let rollReads = 0;
  let provenance = initialProvenance
    ? structuredClone(initialProvenance)
    : undefined;

  const tx = {
    execute: async (statement: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const query = dialect.sqlToQuery(statement);
      if (query.sql.includes("SELECT producto_id, ubicacion_id")) {
        return { rows: [{ producto_id: 10, ubicacion_id: 1 }] };
      }
      if (query.sql.includes("SELECT * FROM auditoria_faltante_reactivaciones")) {
        return { rows: [] };
      }
      if (query.sql.includes("SELECT r.*, p.sku")) {
        const reversed = movements.find(
          (movement) =>
            movement.tipo === "CANCELACION" &&
            movement.movimientoOrigenId === original.id &&
            movement.rolloId === rollo.id,
        );
        return {
          rows: [{
            id: rollo.id,
            serie: rollo.serie,
            estado: rollo.estado,
            cantidad_actual: rollo.cantidadActual,
            costo_unitario: rollo.costoUnitario,
            recepcion_id: rollo.recepcionId,
            proveedor_id: rollo.proveedorId,
            sku: "TEL-A",
            tela: "Tela",
            color: "Azul",
            unidad: "METRO",
            proveedor_nombre: "Proveedor",
            entrada_folio: 4,
            entrada_iniciales: "ORI",
            movimiento_baja_id: original.id,
            cantidad_baja: original.cantidad,
            ubicacion_baja_id: 1,
            ubicacion_baja: "Origen",
            auditoria_origen_id: 3,
            auditoria_estado: "CONFIRMADA",
            cerrada_at: new Date("2026-01-01T12:00:00Z"),
            ultimo_movimiento_id: Number(movements.at(-1)!.id),
            ya_reactivada: provenance != null,
            ya_revertida: reversed != null,
          }],
        };
      }
      if (query.sql.includes("SELECT id, ubicacion_id, folio, cerrada_at")) {
        return { rows: [] };
      }
      if (query.sql.includes("SELECT id") &&
          query.sql.includes("movimiento_origen_id") &&
          query.sql.includes("tipo='CANCELACION'")) {
        events.push("reversal-lookup");
        const match = movements.find(
          (movement) =>
            movement.tipo === "CANCELACION" &&
            movement.movimientoOrigenId === Number(query.params[0]) &&
            movement.rolloId === Number(query.params[1]),
        );
        return { rows: match ? [{ id: match.id }] : [] };
      }
      if (query.sql.includes("SELECT movimiento_reactivacion_id")) {
        events.push("reactivation-lookup");
        const exact =
          provenance?.movimiento_baja_id === Number(query.params[0]) &&
          (!query.sql.includes("AND rollo_id") ||
            provenance?.rollo_id === Number(query.params[1]));
        return { rows: exact ? [provenance] : [] };
      }
      if (query.sql.includes("SELECT sr.id FROM salida_rollos")) {
        return { rows: [] };
      }
      if (query.sql.includes("INSERT INTO auditoria_faltante_reactivaciones")) {
        provenance = {
          rollo_id: Number(query.params[0]),
          movimiento_baja_id: Number(query.params[2]),
          movimiento_reactivacion_id: Number(query.params[3]),
        };
      }
      return { rows: [] };
    },
    select: (fields?: Record<string, unknown>) => {
      let table = "";
      const resolve = () => {
        if (table === "rollos") {
          if (fields?.cnt) {
            return [{ cnt: rollo.estado === "DISPONIBLE" ? 1 : 0 }];
          }
          rollReads++;
          if (options.reverseDuringLockWait && rollReads === 2) {
            rollo.estado = "DISPONIBLE";
            rollo.cantidadActual = "50.125";
            movements.push({
              id: 99,
              rolloId: rollo.id,
              productoId: original.productoId,
              ubicacionId: original.ubicacionId,
              tipo: "CANCELACION",
              cantidad: "50.125",
              movimientoOrigenId: original.id,
            });
          }
          return [structuredClone(rollo)];
        }
        if (table === "movimientos") {
          if (fields?.id) {
            const cancellation = movements.find(
              (movement) =>
                movement.tipo === "CANCELACION" &&
                movement.movimientoOrigenId === original.id,
            );
            return cancellation ? [{ id: cancellation.id }] : [];
          }
          if (fields) return [{ saldo: "0.000", total: "50.125" }];
          return [structuredClone(original)];
        }
        if (table === "ubicaciones") {
          return [{ id: 2, activa: true, tipo: "BODEGA", nombre: "Destino" }];
        }
        if (table === "pisos") {
          return [{ id: 20, ubicacionId: 2, activo: true }];
        }
        return [];
      };
      const chain: Record<string, unknown> = {};
      for (const method of [
        "where",
        "limit",
        "orderBy",
        "innerJoin",
        "leftJoin",
      ]) {
        chain[method] = () => chain;
      }
      chain.for = () => {
        if (table === "rollos") events.push("roll-lock");
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
          Object.assign(rollo, values);
          return [];
        },
      }),
    }),
    insert: (tableValue: Parameters<typeof getTableName>[0]) => ({
      values: (values: Record<string, unknown>) => {
        const table = getTableName(tableValue);
        const result = table === "movimientos"
          ? { id: movements.length === 1 ? 99 : 100, ...values }
          : values;
        if (table === "movimientos") movements.push(result);
        return {
          returning: async () => [result],
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
    events,
    get provenance() {
      return provenance;
    },
  };
}

function related(error: unknown) {
  assert.ok(error instanceof InventarioError);
  return error;
}

test("reactivación primero impide revertir su baja exacta y conserva cantidad", async () => {
  const state = fixture();
  await reactivarFaltanteAuditoria(state.tx, reactivationInput);
  assert.equal(state.rollo.cantidadActual, "50.125");

  const error = related(await revertirMovimiento(state.tx, {
    movimientoOrigenId: 55,
    usuarioId: 8,
  }).then(() => null, (reason: unknown) => reason));

  assert.equal(error.code, "AUDIT_WRITEOFF_ALREADY_REACTIVATED");
  assert.equal(
    error.message,
    "Esta baja de auditoría no puede revertirse porque el mismo rollo ya fue reactivado desde ella. Consulta el movimiento de reactivación relacionado.",
  );
  assert.deepEqual(error.movimientoRelacionado, {
    rolloId: 7,
    movimientoId: 99,
    href: "/inventario/rollos/7?movimientoId=99",
  });
  assert.deepEqual(inventarioErrorEnvelope(error), {
    error: error.message,
    code: "AUDIT_WRITEOFF_ALREADY_REACTIVATED",
    movimientoRelacionado: error.movimientoRelacionado,
  });
  assert.equal(state.rollo.cantidadActual, "50.125");
  assert.equal(state.movements.length, 2);
  assert.ok(
    state.events.lastIndexOf("roll-lock") <
      state.events.lastIndexOf("reactivation-lookup"),
    "la consulta de proveniencia debe ocurrir después del FOR UPDATE del rollo",
  );
});

test("reverso primero impide reactivar su baja exacta y conserva cantidad", async () => {
  const state = fixture();
  await revertirMovimiento(state.tx, {
    movimientoOrigenId: 55,
    usuarioId: 8,
  });
  assert.equal(state.rollo.cantidadActual, "50.125");

  const error = related(await reactivarFaltanteAuditoria(
    state.tx,
    reactivationInput,
  ).then(() => null, (reason: unknown) => reason));

  assert.equal(error.code, "AUDIT_WRITEOFF_ALREADY_REVERSED");
  assert.equal(
    error.message,
    "Este faltante de auditoría no puede reactivarse porque su baja ya fue revertida. Consulta el movimiento de reversión relacionado.",
  );
  assert.deepEqual(error.movimientoRelacionado, {
    rolloId: 7,
    movimientoId: 99,
    href: "/inventario/rollos/7?movimientoId=99",
  });
  assert.deepEqual(inventarioErrorEnvelope(error), {
    error: error.message,
    code: "AUDIT_WRITEOFF_ALREADY_REVERSED",
    movimientoRelacionado: error.movimientoRelacionado,
  });
  assert.equal(state.rollo.cantidadActual, "50.125");
  assert.equal(state.movements.length, 2);
  assert.ok(
    state.events.lastIndexOf("roll-lock") <
      state.events.lastIndexOf("reversal-lookup"),
    "la consulta del reverso debe ocurrir después del FOR UPDATE del rollo",
  );
});

test("reverso ordinario sigue permitido sin reactivación dedicada", async () => {
  const state = fixture();
  const result = await revertirMovimiento(state.tx, {
    movimientoOrigenId: 55,
    usuarioId: 8,
  });
  assert.equal(result.movimiento.tipo, "CANCELACION");
  assert.equal(state.rollo.estado, "DISPONIBLE");
  assert.equal(state.rollo.cantidadActual, "50.125");
});

test("proveniencia de otra baja o de otro rollo no bloquea el reverso", async () => {
  for (const provenance of [
    { movimiento_baja_id: 54, rollo_id: 7, movimiento_reactivacion_id: 90 },
    { movimiento_baja_id: 55, rollo_id: 8, movimiento_reactivacion_id: 91 },
  ]) {
    const state = fixture(provenance);
    const result = await revertirMovimiento(state.tx, {
      movimientoOrigenId: 55,
      usuarioId: 8,
    });
    assert.equal(result.movimiento.tipo, "CANCELACION");
    assert.equal(state.rollo.cantidadActual, "50.125");
  }
});

test("reverso completado durante espera del lock produce explicación relacionada antes de STALE_ROLL", async () => {
  const state = fixture(undefined, { reverseDuringLockWait: true });
  const error = related(await reactivarFaltanteAuditoria(
    state.tx,
    reactivationInput,
  ).then(() => null, (reason: unknown) => reason));

  assert.equal(error.code, "AUDIT_WRITEOFF_ALREADY_REVERSED");
  assert.deepEqual(error.movimientoRelacionado, {
    rolloId: 7,
    movimientoId: 99,
    href: "/inventario/rollos/7?movimientoId=99",
  });
  assert.equal(state.rollo.estado, "DISPONIBLE");
  assert.equal(state.rollo.cantidadActual, "50.125");
  assert.equal(state.movements.length, 2);
  assert.ok(
    state.events.lastIndexOf("roll-lock") <
      state.events.lastIndexOf("reversal-lookup"),
  );
});