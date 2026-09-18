import assert from "node:assert/strict";
import net from "node:net";
import { mock, test } from "node:test";
import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Tx } from "./inventario";
import type { Request } from "express";
import type { CreditEvidenceInput, CreditOperationClaim, CreditProducer } from "./credit-evidence-contract";

// Never consult real configuration. Set a deliberately unreachable test-only
// value BEFORE dynamic import; isolated-database initializers are forbidden.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://e1_disabled:e1_disabled@127.0.0.1:1/e1_disabled";
process.env.APPLICATION_DATABASE_URL = "";
process.env.TEST_DATABASE_URL = "";
process.env.REQUIRE_ISOLATED_TEST_DATABASE = "0";
mock.method(net.Socket.prototype, "connect", () => {
  throw new Error("E1 mocked tests prohibit all network connections");
});
const schema = await import("@workspace/db");
mock.method(schema.pool, "query", () => { throw new Error("E1 singleton SQL is forbidden"); });
mock.method(schema.pool, "connect", () => { throw new Error("E1 singleton connections are forbidden"); });
const helpers = await import("./credit-evidence");
const { AutorizarNotaBody, CancelarTicketBody, CancelarSalidaBody } = await import("@workspace/api-zod");
const {
  claimCreditOperation, insertCreditMovementE1, insertPendingCreditReceiptE1,
  assertCreditEvidenceAccess, assertCreditEvidenceScope, CreditEvidenceError,
} = helpers;

// The actual production Drizzle adapter executes against this in-memory query
// protocol. It does not replace claimCreditOperation or the pure claim core.
// No users/sessions are inserted, even in the mock. Actor is a plain auth-read
// snapshot; operations/movements are the only mocked persisted records.
type Row = Record<string, unknown>;
const dialect = new PgDialect();
const names = {
  operations: getTableName(schema.operacionesCreditoE1Table),
  movements: getTableName(schema.movimientosCreditoTable),
  actors: getTableName(schema.usuariosTable),
  sites: getTableName(schema.ubicacionesTable),
  sessions: getTableName(schema.sesionesCajaTable),
  notes: getTableName(schema.ticketsTable),
};
const property = (column: string) => column.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
function predicate(where: SQL | undefined): (row: Row) => boolean {
  if (!where) return () => true;
  const query = dialect.sqlToQuery(where);
  // Interpret the real adapter's equality/AND predicates, not source-code text.
  // Missing producer filtering really changes which stored operation is found.
  const bindings = [...query.sql.matchAll(/"[^"]+"\."([^"]+)" = \$(\d+)/g)];
  if (!bindings.length || /\bor\b/i.test(query.sql)) throw new Error(`Unsupported mock predicate: ${query.sql}`);
  return row => bindings.every(match => row[property(match[1]!)] === query.params[Number(match[2]) - 1]);
}
const key = "20000000-0000-4000-8000-000000000001";
const req = { auth: { user: { id: 9, rol: "CAJA", ubicacionId: 2 } } } as unknown as Request;
const evidence = (naturaleza: CreditEvidenceInput["naturaleza"] = "CORRECCION_CONTABLE"): CreditEvidenceInput => ({
  sitioOrigenId: 2, naturaleza, operacionClave: key, sesionCajaId: null, notaOrigenId: null,
  origenJustificacion: naturaleza === "CORRECCION_CONTABLE" ? "Corrección documentada" : null,
});
const input = (productor: CreditProducer = "ABONO_ORDINARIO"): CreditOperationClaim => ({
  productor, clave: key, naturaleza: "CORRECCION_CONTABLE", actorId: 9,
  contenido: { clienteId: 7, importe: "10.00", evidencia: evidence() },
});
const status = (expected: number) => (error: unknown) => error instanceof CreditEvidenceError && error.status === expected;

function fixture() {
  const rows = new Map<string, Row[]>([
    [names.operations, []], [names.movements, []],
    [names.actors, [{ id: 9, activo: true, rol: "CAJA", ubicacionId: 2 }]],
    [names.sites, [{ id: 2, activa: true, tipo: "TIENDA" }]],
    [names.sessions, []], [names.notes, []],
  ]);
  const effects = { insertAttempts: 0, movementInserts: 0, selectCalls: 0, conflicts: 0 };
  const control = { completeWinner: false, missingReservation: false };
  const tx = {
    select() {
      let table = "", where: SQL | undefined;
      const query = {
        from(value: Parameters<typeof getTableName>[0]) { table = getTableName(value); return query; },
        where(value: SQL) { where = value; return query; },
        for(_lock: string) { return query; },
        async limit(limit: number) {
          effects.selectCalls++;
          return (rows.get(table) ?? []).filter(predicate(where)).slice(0, limit);
        },
      };
      return query;
    },
    insert(table: Parameters<typeof getTableName>[0]) {
      const name = getTableName(table);
      let row: Row, ignoreConflict = false;
      const insert = {
        values(value: Row) { row = value; return insert; },
        onConflictDoNothing(options: { target: unknown[] }) {
          // Exercise the actual production conflict target, including ordering.
          assert.deepEqual(options.target, [schema.operacionesCreditoE1Table.productor, schema.operacionesCreditoE1Table.clave]);
          ignoreConflict = true;
          return insert;
        },
        async returning() {
          if (name !== names.operations && name !== names.movements) throw new Error(`Forbidden mock insert: ${name}`);
          if (name === names.operations) {
            effects.insertAttempts++;
            if (control.missingReservation) return [];
            const existing = rows.get(name)!.find(value => value.productor === row.productor && value.clave === row.clave);
            if (existing) {
              if (!ignoreConflict) throw new Error("23505: missing atomic ON CONFLICT behavior");
              effects.conflicts++;
              return [];
            }
            rows.get(name)!.push({ ...row! });
            if (control.completeWinner) rows.get(names.movements)!.push({
              id: 71, operacionProductor: row!.productor, operacionClave: row!.clave, usuarioId: row!.usuarioId,
            });
            return [{ ...row! }];
          }
          effects.movementInserts++;
          const movement = { id: 71, ...row! };
          rows.get(name)!.push(movement);
          return [movement];
        },
      };
      return insert;
    },
  } as unknown as Tx;
  return { tx, rows, effects, control };
}

test("actual claim adapter atomically inserts once and replays immutable movement without another write", async () => {
  const f = fixture();
  f.control.completeWinner = true;
  assert.deepEqual(await claimCreditOperation(f.tx, input()), { replay: false, movement: null });
  const replay = await claimCreditOperation(f.tx, input());
  assert.equal(replay.replay, true);
  assert.equal(replay.movement?.id, 71);
  assert.equal(f.effects.insertAttempts, 1);
  assert.equal(f.rows.get(names.operations)!.length, 1);
});

test("actual credit request adapter reports legacy update-app error before required generated-schema validation", () => {
  let parses = 0;
  for (const legacy of [{}, { aplicarSaldoAFavor: "0.00" }, { sitioOrigenId: 2, naturaleza: null }]) {
    assert.throws(() => helpers.readCreditEvidenceBeforeBody(legacy, value => {
      parses++;
      return AutorizarNotaBody.parse(value);
    }), error => error instanceof CreditEvidenceError && error.status === 400 && /Actualiza la aplicación/.test(error.message));
  }
  assert.equal(parses, 0);
  const parsed = helpers.readCreditEvidenceBeforeBody(evidence("OPERACION_CREDITO_SIN_DINERO"), value => AutorizarNotaBody.parse(value));
  assert.equal(parsed.evidence.sitioOrigenId, 2);
  // Cancellation schemas intentionally keep E1 optional for noncredit flows.
  assert.doesNotThrow(() => CancelarTicketBody.parse({ motivo: "Cancelación documentada" }));
  assert.doesNotThrow(() => CancelarSalidaBody.parse({ motivo: "Cancelación documentada" }));
});

test("actual claim adapter conflicts on changed actor, nature or whitelisted intent", async () => {
  const f = fixture();
  f.control.completeWinner = true;
  await claimCreditOperation(f.tx, input());
  for (const changed of [
    { ...input(), actorId: 10 },
    { ...input(), naturaleza: "INGRESO_FISICO" as const },
    { ...input(), contenido: { ...input().contenido, importe: "10.01" } },
    { ...input(), contenido: { ...input().contenido, evidencia: { ...evidence(), sitioOrigenId: 3 } } },
  ]) await assert.rejects(() => claimCreditOperation(f.tx, changed), status(409));
  assert.equal(f.effects.insertAttempts, 1);
});

test("actual claim adapter isolates equal UUID across producers in both claim and movement lookup", async () => {
  const f = fixture();
  f.control.completeWinner = true;
  await claimCreditOperation(f.tx, input("ABONO_ORDINARIO"));
  await claimCreditOperation(f.tx, input("ABONO_DIRIGIDO"));
  const movements = f.rows.get(names.movements)!;
  movements[1]!.id = 72;
  const ordinary = await claimCreditOperation(f.tx, input("ABONO_ORDINARIO"));
  const directed = await claimCreditOperation(f.tx, input("ABONO_DIRIGIDO"));
  assert.equal(ordinary.movement?.id, 71);
  assert.equal(directed.movement?.id, 72);
  assert.equal(f.rows.get(names.operations)!.length, 2);
});

test("actual claim adapter loses composite uniqueness race and reloads the completed winner", async () => {
  const f = fixture();
  f.control.completeWinner = true; // simulate committed winner before loser reload
  const results = await Promise.all([claimCreditOperation(f.tx, input()), claimCreditOperation(f.tx, input())]);
  assert.equal(results.filter(result => result.replay).length, 1);
  assert.equal(results.find(result => result.replay)?.movement?.id, 71);
  assert.equal(f.effects.conflicts, 1);
  assert.equal(f.rows.get(names.operations)!.length, 1);
});

test("actual claim adapter rejects missing movement and incomplete operation reservation", async () => {
  const f = fixture();
  await claimCreditOperation(f.tx, input());
  await assert.rejects(() => claimCreditOperation(f.tx, input()), status(409));
  const lost = fixture();
  lost.control.missingReservation = true;
  await assert.rejects(() => claimCreditOperation(lost.tx, input()), status(409));
});

test("actual access/scope adapters check current site and role before replay without requiring open session", async () => {
  const f = fixture();
  f.control.completeWinner = true;
  await claimCreditOperation(f.tx, input());
  await assertCreditEvidenceAccess(req, evidence(), f.tx);
  assert.equal((await claimCreditOperation(f.tx, input())).replay, true);
  f.rows.get(names.actors)![0]!.ubicacionId = 3;
  await assert.rejects(() => assertCreditEvidenceAccess(req, evidence(), f.tx), status(403));
  f.rows.get(names.actors)![0]!.ubicacionId = 2;
  f.rows.get(names.actors)![0]!.rol = "CONTADOR";
  await assert.rejects(() => assertCreditEvidenceAccess(req, evidence(), f.tx), status(403));
  f.rows.get(names.actors)![0]!.rol = "CAJA";
  f.rows.get(names.sites)![0]!.activa = false;
  await assert.rejects(() => assertCreditEvidenceScope(req, evidence(), f.tx), status(400));
  assert.equal(f.effects.insertAttempts, 1);
});

const producers: Array<{
  productor: CreditProducer; tipo: "VENTA_CREDITO" | "ABONO" | "REVERSO" | "AJUSTE";
  importe: string; naturaleza: CreditEvidenceInput["naturaleza"]; extra?: Row;
}> = [
  { productor: "VENTA_CREDITO", tipo: "VENTA_CREDITO", importe: "10.00", naturaleza: "OPERACION_CREDITO_SIN_DINERO" },
  { productor: "CANCELACION_VENTA_CREDITO", tipo: "REVERSO", importe: "-10.00", naturaleza: "OPERACION_CREDITO_SIN_DINERO", extra: { movimientoOrigenId: 61 } },
  { productor: "ABONO_ORDINARIO", tipo: "ABONO", importe: "-10.00", naturaleza: "CORRECCION_CONTABLE" },
  { productor: "ABONO_DIRIGIDO", tipo: "ABONO", importe: "-10.00", naturaleza: "CORRECCION_CONTABLE" },
  { productor: "REVERSO_ABONO", tipo: "REVERSO", importe: "10.00", naturaleza: "CORRECCION_CONTABLE", extra: { movimientoOrigenId: 62 } },
  { productor: "AJUSTE_MANUAL", tipo: "AJUSTE", importe: "10.00", naturaleza: "CORRECCION_CONTABLE" },
  { productor: "BAJA_INCOBRABLE", tipo: "AJUSTE", importe: "-10.00", naturaleza: "CORRECCION_CONTABLE", extra: { esIncobrable: true, motivoIncobrable: "Baja documentada" } },
];
for (const producer of producers) {
  test(`actual E1 insertion adapter stores explicit scope/nature/key for ${producer.productor}`, async () => {
    const f = fixture();
    const e1 = evidence(producer.naturaleza);
    const movement = {
      clienteId: 7, usuarioId: 9, tipo: producer.tipo, importe: producer.importe,
      formaPago: "CREDITO" as const, notas: "Evidencia", ...producer.extra,
    };
    await assertCreditEvidenceAccess(req, e1, f.tx);
    const claim = await claimCreditOperation(f.tx, {
      ...input(producer.productor), naturaleza: producer.naturaleza,
      contenido: { clienteId: 7, importe: producer.importe, evidencia: e1 },
    });
    assert.equal(claim.replay, false);
    await assertCreditEvidenceScope(req, e1, f.tx);
    const row = await insertCreditMovementE1(f.tx, movement, e1, producer.productor);
    assert.equal(row.sitioOrigenId, 2);
    assert.equal(row.naturaleza, producer.naturaleza);
    assert.equal(row.operacionClave, key);
    assert.equal(row.operacionProductor, producer.productor);
    assert.equal(row.usuarioId, 9);
    assert.equal(row.sesionCajaId, null);
    assert.equal(row.notaOrigenId, null);
    assert.equal(row.origenJustificacion, e1.origenJustificacion);
    assert.equal(row.importe, producer.importe);
    if (producer.productor === "BAJA_INCOBRABLE") {
      assert.equal(row.esIncobrable, true);
      assert.equal(row.motivoIncobrable, "Baja documentada");
    }
    assert.equal(f.effects.movementInserts, 1);
  });
}

test("actual insertion adapters reject new physical cash and pending receipt before any query/write", async () => {
  const f = fixture();
  await assert.rejects(() => insertCreditMovementE1(f.tx, {
    clienteId: 7, usuarioId: 9, tipo: "ABONO", importe: "-10.00", formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
  }, { ...evidence("INGRESO_FISICO"), sesionCajaId: 8 }, "ABONO_ORDINARIO"), status(403));
  await assert.rejects(() => insertPendingCreditReceiptE1(f.tx, {
    operacionProductor: "COBRO_PENDIENTE", operacionClave: key, naturaleza: "INGRESO_FISICO",
    clienteId: 7, usuarioId: 9, importe: "10.00", fechaReal: new Date("2026-09-17T18:00:00Z"),
    sitioOrigenId: 2, medio: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL", motivo: "En espera",
  }), status(403));
  assert.equal(f.effects.selectCalls, 0);
  assert.equal(f.effects.insertAttempts, 0);
  assert.equal(f.effects.movementInserts, 0);
});

test("actual movement helper validates explicit note identity rather than inferring its site", async () => {
  const f = fixture();
  f.rows.get(names.notes)!.push({ id: 21, documentoTipo: "NOTA", clienteId: 7, ubicacionId: 3 });
  await assert.rejects(() => insertCreditMovementE1(f.tx, {
    clienteId: 7, usuarioId: 9, tipo: "AJUSTE", importe: "10.00",
  }, { ...evidence(), notaOrigenId: 21 }, "AJUSTE_MANUAL"), status(400));
  assert.equal(f.effects.movementInserts, 0);
});