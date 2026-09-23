import test from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  E11Error, e11Advance, e11Canonical, e11Capability, e11Cents, e11ErrorBody, e11Hash, e11Money,
  e11Paginate, e11Period, e11Range, type E11Identity,
} from "./e11";
import {
  createE11Service, e11FiscalClients, e11FiscalSales, e11Periods, e11ProfileHistory, e11Replay,
  e11SecurityLock, e11Snapshot, e11SnapshotSales, e11UserRoleChange, E11RecoveryTarget, type E11Sql,
} from "./e11-repository";
import { createE11LegacyBoundary, e11LegacyAllowed } from "../middlewares/e11-legacy";
import type { E11RuntimeOptions } from "./e11-runtime";
import {
  E11_ENABLED, E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED, E11_E5_PREPARATION_ENABLED,
} from "./e11-feature";
import { e5Capabilities, type E5Actor } from "./e5";

// Synthetic SQL request capture only: no driver, network, PostgreSQL, users or application server.
const dialect = new PgDialect();
const identity = (perfil: "A" | "F" = "F", version = 1): E11Identity => ({
  usuarioId: 7, rolBase: "CONTADOR", perfil, perfilVersion: version,
  permisosVersion: `p-${version}`, capacidades: perfil === "F" ? ["FISCAL_LEER"] : ["FINANZAS_LIMITADAS_LEER"],
});
function spySequence(...results: Record<string, unknown>[][]) {
  const queries: { sql: string; params: unknown[] }[] = []; let call = 0;
  const tx: E11Sql = { execute: async query => {
    const request = dialect.sqlToQuery(query); queries.push(request);
    return { rows: results[call++] ?? [] };
  } };
  return { tx, queries };
}
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
const allFlags = { enabled: true, profiles: true, reconciliation: true, preparation: true,
  e5Enabled: true, e5ContadorA: true };
const fixedNow = new Date("2026-09-22T12:00:00.000Z");
const ids = Array.from({ length: 30 }, (_, n) => `10000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`);
const request = (query: Parameters<E11Sql["execute"]>[0]) => dialect.sqlToQuery(query);
function routedTx(route: (sql: string, params: unknown[]) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx: E11Sql = { execute: async query => {
    const q = request(query); queries.push(q); return { rows: await route(q.sql, q.params) };
  } };
  return { tx, queries };
}
function identityRoute(profile: "A" | "F" | null, version = 1, role = "CONTADOR") {
  return (text: string) => {
    if (/FROM usuarios WHERE id=.*FOR SHARE/.test(text)) return [{ id: role === "ADMIN" ? 1 : 7, rol: role, activo: true }];
    if (/FROM sesiones /.test(text)) return [{ id: "session" }];
    if (/FROM e11_perfiles /.test(text)) return profile === null ? [] : [{ perfil: profile, version }];
    return [];
  };
}
function service(options: E11RuntimeOptions = {}) {
  let uuid = 0;
  return createE11Service({ flags: allFlags, now: () => fixedNow, uuid: () => ids[uuid++]!,
    transaction: async work => work(spySequence().tx), ledger: async () => [], ...options });
}
function decisionDatabase() {
  const baseSale = sale(), snapshot = frozen([baseSale]);
  let state = { decisions: [] as Record<string, unknown>[], avisos: 0, notifications: 0,
    operations: new Map<string, { solicitud_hash: string; respuesta: unknown }>() };
  let failNotification = true;
  const transaction = async <T>(work: (tx: E11Sql) => Promise<T>) => {
    const draft = structuredClone(state);
    const db = routedTx((text, params) => {
      if (/FROM usuarios WHERE id=.*FOR SHARE/.test(text)) return [{ id: 7, rol: "CONTADOR", activo: true }];
      if (/FROM sesiones /.test(text)) return [{ id: "session" }];
      if (/FROM e11_perfiles /.test(text)) return [{ perfil: "F", version: 2 }];
      if (/SELECT solicitud_hash,respuesta(?:,estado)? FROM e11_operaciones/.test(text)) {
        const prior = draft.operations.get(String(params[2])); return prior ? [prior] : [];
      }
      if (/INSERT INTO e11_operaciones/.test(text)) {
        draft.operations.set(String(params[2]), { solicitud_hash: String(params[3]), respuesta: JSON.parse(String(params[4])) }); return [];
      }
      if (/SELECT datos FROM e11_conciliaciones/.test(text)) return [{ datos: snapshot }];
      if (/SELECT datos FROM e11_decisiones/.test(text)) return draft.decisions.map(datos => ({ datos }));
      if (/FROM tickets t JOIN clientes/.test(text)) return [{ id: 8, folio: "F-8", cliente_id: 3,
        nombre: "Cliente", total: "10.00", fecha: "2026-01-02T00:00:00.000Z" }];
      if (/SELECT id FROM e11_conciliaciones/.test(text)) return [{ id: snapshot.id }];
      if (/INSERT INTO e11_decisiones/.test(text)) { draft.decisions.push(JSON.parse(String(params[5]))); return []; }
      if (/INSERT INTO e11_avisos/.test(text)) { draft.avisos++; return []; }
      if (/INSERT INTO notificaciones_sistema/.test(text)) {
        if (failNotification) { failNotification = false; throw new Error("SYNTHETIC_NOTIFICATION_FAILURE"); }
        draft.notifications++; return [];
      }
      return [];
    });
    try { const result = await work(db.tx); state = draft; return result; }
    catch (error) { throw error; }
  };
  return { transaction, snapshot, get state() { return state; } };
}
function recoveryDatabase() {
  type Operation = { solicitud_hash: string; respuesta: unknown; estado: "CONFIRMADA" | "CERRADA_SIN_EFECTO" };
  type Resolution = { id: string; actor: number; action: string; original: string; admin: number;
    resolver: string; solicitud_hash: string; respuesta: unknown; created_at: string };
  let state = { operations: new Map<string, Operation>(), resolutions: [] as Resolution[], businessEffects: 0 };
  const locks: string[] = [];
  const key = (actor: unknown, action: unknown, uuid: unknown) =>
    `${Number(actor)}:${String(action)}:${String(uuid).toLowerCase()}`;
  const transaction = async <T>(work: (tx: E11Sql) => Promise<T>) => {
    const draft = structuredClone(state);
    const db = routedTx((text, params) => {
      if (/hashtextextended/.test(text) && typeof params[0] === "string") locks.push(String(params[0]));
      if (/SELECT id,rol,activo FROM usuarios/.test(text)) {
        const id = Number(params[0]); return [{ id, rol: id === 1 ? "ADMIN" : "CONTADOR", activo: true }];
      }
      if (/FROM sesiones /.test(text)) return [{ id: "session" }];
      if (/SELECT perfil,version FROM e11_perfiles/.test(text)) return [];
      if (/SELECT id FROM usuarios WHERE id=/.test(text)) return [{ id: Number(params[0]) }];
      if (/SELECT estado FROM e11_operaciones/.test(text)) {
        const row = draft.operations.get(key(params[0], params[1], params[2])); return row ? [{ estado: row.estado }] : [];
      }
      if (/SELECT id,created_at FROM e11_resoluciones/.test(text)) {
        const row = draft.resolutions.find(r => key(r.actor, r.action, r.original) === key(params[0], params[1], params[2]));
        return row ? [{ id: row.id, created_at: row.created_at }] : [];
      }
      if (/SELECT solicitud_hash,respuesta FROM e11_resoluciones/.test(text)) {
        const row = draft.resolutions.find(r => r.admin === Number(params[0]) &&
          r.resolver === String(params[1]).toLowerCase());
        return row ? [{ solicitud_hash: row.solicitud_hash, respuesta: row.respuesta }] : [];
      }
      if (/SELECT solicitud_hash,respuesta,estado FROM e11_operaciones/.test(text)) {
        const row = draft.operations.get(key(params[0], params[1], params[2]));
        return row ? [row] : [];
      }
      if (/INSERT INTO e11_operaciones/.test(text)) {
        draft.operations.set(key(params[0], params[1], params[2]), {
          solicitud_hash: String(params[3]), respuesta: JSON.parse(String(params[4])),
          estado: text.includes("CERRADA_SIN_EFECTO") ? "CERRADA_SIN_EFECTO" : "CONFIRMADA",
        });
        return [];
      }
      if (/INSERT INTO e11_resoluciones/.test(text)) {
        draft.resolutions.push({ id: String(params[0]), actor: Number(params[1]), action: String(params[2]),
          original: String(params[3]).toLowerCase(), admin: Number(params[4]),
          resolver: String(params[5]).toLowerCase(), solicitud_hash: String(params[6]),
          respuesta: JSON.parse(String(params[11])), created_at: String(params[12]) });
        return [];
      }
      if (/INSERT INTO synthetic_business_effect/.test(text)) { draft.businessEffects++; return []; }
      return [];
    });
    const result = await work(db.tx); state = draft; return result;
  };
  return { transaction, locks, get state() { return state; } };
}
const sale = (id = 8, total = "10.00") => ({
  facturaId: id, ventaId: id, folioFactura: `F-${id}`, cliente: { clienteId: 3, nombre: "Cliente" },
  fechaFacturacion: "2026-01-02T00:00:00.000Z", totalFacturado: total, moneda: "MXN", estado: "VIGENTE",
});
const frozen = (items = [sale()]) => ({
  id: "00000000-0000-4000-8000-000000000010", uuid: "00000000-0000-4000-8000-000000000011",
  periodo: { tipo: "DIA", inicio: "2026-01-02", finExclusivo: "2026-01-03", zona: "America/Mexico_City",
    obligatorio: false, estado: "CONGELADO", ultimaConciliacionId: "00000000-0000-4000-8000-000000000010" },
  revision: 1, anteriorId: null, fuenteRevision: e11Hash(items), vigente: true,
  congeladoEn: "2026-01-04T00:00:00.000Z", actorId: 7, totalFacturado: "10.00",
  cantidadVentas: items.length, evidenciaHash: e11Hash(items), decisiones: [],
});

test("E11-OFF-ALL-GATES", () => {
  assert.deepEqual([E11_ENABLED, E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED,
    E11_E5_PREPARATION_ENABLED], [false, false, false, false]);
});
test("E11-OFF-SECURITY-NO-SQL", async () => {
  const s = spySequence();
  await assert.doesNotReject(() => e11SecurityLock(s.tx));
  assert.equal(s.queries.length, 0);
});
test("E11-OFF-ROLE-CHANGE-NO-SQL", async () => {
  const s = spySequence();
  await assert.doesNotReject(() => e11UserRoleChange(s.tx, 2, "CONTADOR", true, 1));
  assert.equal(s.queries.length, 0);
});
test("E11-CANONICAL-KEY-ORDER", () => {
  assert.equal(e11Canonical({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});
test("E11-HASH-CONTENT-SENSITIVE", () => {
  assert.equal(e11Hash({ a: 1, b: 2 }), e11Hash({ b: 2, a: 1 }));
  assert.notEqual(e11Hash({ a: 1 }), e11Hash({ a: 2 }));
});
test("E11-MONEY-EXACT-CENTS", () => {
  assert.equal(e11Cents("123.45"), 12345n);
  assert.equal(e11Money(-12345n), "-123.45");
});
test("E11-MONEY-REJECTS-NONCANONICAL", () => {
  assert.throws(() => e11Cents("1.2"), code("DEPENDENCIA_NO_DISPONIBLE"));
});
test("E11-CALENDAR-DAY-OPTIONAL", () => {
  const p = e11Period("DIA", "2026-01-02", new Date("2026-02-01T00:00:00Z"));
  assert.deepEqual([p.finExclusivo, p.obligatorio], ["2026-01-03", false]);
});
test("E11-CALENDAR-WEEK-MONDAY", () => {
  let p!: ReturnType<typeof e11Period>;
  assert.doesNotThrow(() => { p = e11Period("SEMANA", "2026-01-05", new Date("2026-02-01T00:00:00Z")); });
  assert.deepEqual([p.finExclusivo, p.obligatorio], ["2026-01-12", true]);
  assert.throws(() => e11Period("SEMANA", "2026-01-06"), code("VALIDACION"));
});
test("E11-CALENDAR-MONTH-BOUNDARY", () => {
  let p!: ReturnType<typeof e11Period>;
  assert.doesNotThrow(() => { p = e11Period("MES", "2026-02-01", new Date("2026-04-01T00:00:00Z")); });
  assert.deepEqual([p.finExclusivo, p.obligatorio], ["2026-03-01", true]);
  assert.throws(() => e11Period("MES", "2026-02-02"), code("VALIDACION"));
});
test("E11-CALENDAR-NO-DEADLINES", () => {
  const p = e11Period("SEMANA", "2025-01-06", new Date("2026-09-22T00:00:00Z"));
  assert.deepEqual(Object.keys(p).sort(), ["estado", "finExclusivo", "inicio", "obligatorio", "tipo",
    "ultimaConciliacionId", "zona"].sort());
});
test("E11-PERIOD-OPEN", () => {
  assert.equal(e11Period("DIA", "2099-01-01", new Date("2026-01-01T00:00:00Z")).estado, "ABIERTO");
});
test("E11-RANGE-NONEMPTY", () => {
  assert.doesNotThrow(() => e11Range("2026-01-01", "2026-01-02"));
  assert.throws(() => e11Range("2026-01-01", "2026-01-01"), code("VALIDACION"));
});
test("E11-ADVANCE-CALENDAR", () => {
  assert.equal(e11Advance("2024-02-28", 1), "2024-02-29");
});
test("E11-CAPABILITY-EXPLICIT", () => {
  assert.doesNotThrow(() => e11Capability(identity("F"), "FISCAL_LEER"));
  assert.throws(() => e11Capability(identity("F"), "FINANZAS_LIMITADAS_LEER"), code("PERFIL_DENEGADO"));
});
test("E11-CURSOR-BINDS-IDENTITY-VERSION", () => {
  const first = e11Paginate([1, 2], { limit: 1 }, identity("F", 1), { route: "f" }, "source-1");
  assert.throws(() => e11Paginate([1, 2], { limit: 1, cursor: first.nextCursor! },
    identity("F", 2), { route: "f" }, "source-1"), code("FUENTE_CAMBIADA"));
});
test("E11-CURSOR-BINDS-FILTERS", () => {
  const first = e11Paginate([1, 2], { limit: 1 }, identity(), { clienteId: 1 }, "source-1");
  assert.throws(() => e11Paginate([1, 2], { limit: 1, cursor: first.nextCursor! },
    identity(), { clienteId: 2 }, "source-1"), code("FUENTE_CAMBIADA"));
});
test("E11-CURSOR-BINDS-SOURCE", () => {
  const first = e11Paginate([1, 2], { limit: 1 }, identity(), {}, "source-1");
  assert.throws(() => e11Paginate([1, 2], { limit: 1, cursor: first.nextCursor! },
    identity(), {}, "source-2"), code("FUENTE_CAMBIADA"));
});
test("E11-PAGINATION-LIMIT", () => {
  const page = e11Paginate([1, 2, 3], { limit: 1 }, identity(), {}, "source");
  assert.deepEqual(page.items, [1]); assert.ok(page.nextCursor);
});
test("E11-REPLAY-LOCK-NAMESPACE", async () => {
  const s = spySequence([], []);
  await e11Replay(s.tx, identity(), "DECISION", "00000000-0000-4000-8000-000000000001", { x: 1 }, async () => "ok");
  assert.match(s.queries[0]!.sql, /hashtextextended/);
  assert.equal(s.queries[0]!.params.some(value => String(value).startsWith("E11:7:DECISION:")), true);
});
test("E11-REPLAY-SAME-BODY-NO-WORK", async () => {
  const s = spySequence([], [{ solicitud_hash: e11Hash({ x: 1 }), respuesta: { accepted: true } }]);
  let calls = 0;
  const result = await e11Replay(s.tx, identity(), "DECISION", "00000000-0000-4000-8000-000000000001",
    { x: 1 }, async () => { calls++; return { accepted: false }; });
  assert.deepEqual(result, { accepted: true }); assert.equal(calls, 0); assert.equal(s.queries.length, 2);
});
test("E11-REPLAY-DIFFERENT-BODY-DENIED", async () => {
  const s = spySequence([], [{ solicitud_hash: e11Hash({ x: 1 }), respuesta: { private: true } }]);
  await assert.rejects(() => e11Replay(s.tx, identity(), "DECISION",
    "00000000-0000-4000-8000-000000000001", { x: 2 }, async () => "new"), code("UUID_REUTILIZADO"));
});
test("E11-FISCAL-FACTURADO-NOT-COBRADO", async () => {
  const s = spySequence([{ id: 8, folio: "F-8", cliente_id: 3, nombre: "Cliente",
    total: "10.00", fecha: "2026-01-02T00:00:00.000Z" }]);
  const result = await e11FiscalSales(s.tx);
  assert.match(s.queries[0]!.sql, /t\.facturado=true/);
  assert.match(s.queries[0]!.sql, /documento_tipo='TICKET' AND t\.cobrado=true/);
  assert.doesNotMatch(s.queries[0]!.sql, /\b(?:pagos|aplicaciones_credito|solicitudes_pago_dirigido)\b/i);
  assert.equal(result.totalFacturado, "10.00");
});
test("E11-FISCAL-DTO-WHITELIST", async () => {
  const s = spySequence([{ id: 8, folio: "F-8", cliente_id: 3, nombre: "Cliente",
    total: "10.00", fecha: "2026-01-02T00:00:00.000Z", saldo: "999.00", direccion: "secreta" }]);
  const item = (await e11FiscalSales(s.tx)).items[0]!;
  assert.deepEqual(Object.keys(item).sort(), ["cliente", "estado", "facturaId", "fechaFacturacion",
    "folioFactura", "moneda", "totalFacturado", "ventaId"].sort());
  assert.deepEqual(Object.keys(item.cliente).sort(), ["clienteId", "nombre"]);
});
test("E11-FISCAL-TOTAL-ALL-DOCUMENTS", async () => {
  const row = (id: number, total: string) => ({ id, folio: `F-${id}`, cliente_id: 3, nombre: "Cliente",
    total, fecha: "2026-01-02T00:00:00.000Z" });
  assert.equal((await e11FiscalSales(spySequence([row(1, "10.00"), row(2, "2.50")]).tx)).totalFacturado, "12.50");
});
test("E11-FISCAL-CLIENTS-DISTINCT-SOURCE", async () => {
  const s = spySequence([{ id: 3, nombre: "Cliente" }]);
  assert.deepEqual(await e11FiscalClients(s.tx), [{ clienteId: 3, nombre: "Cliente" }]);
  assert.match(s.queries[0]!.sql, /SELECT DISTINCT[\s\S]*t\.facturado=true/);
});
test("E11-PROFILE-HISTORY-APPEND-ORDER", async () => {
  const events = [{ revision: 1, anterior: "F", posterior: "A" }, { revision: 2, anterior: "A", posterior: "F" }];
  const s = spySequence([{ id: 7 }], events.map(datos => ({ datos })));
  assert.deepEqual(await e11ProfileHistory(s.tx, 7), events);
  assert.match(s.queries[1]!.sql, /ORDER BY revision,id/);
});
test("E11-SNAPSHOT-SOURCE-CHANGE-REQUIRES-REVISION", async () => {
  const old = frozen(), current = { id: 9, folio: "F-9", cliente_id: 3, nombre: "Cliente",
    total: "11.00", fecha: "2026-01-02T00:00:00.000Z" };
  const s = spySequence([{ datos: old }], [], [current], [{ id: old.id }]);
  const result = await e11Snapshot(s.tx, old.id);
  assert.equal(result.vigente, false); assert.equal(result.periodo.estado, "REQUIERE_REVISION");
  assert.equal(result.totalFacturado, "10.00");
});
test("E11-SNAPSHOT-FROZEN-SALES", async () => {
  const items = [sale()], snapshot = frozen(items);
  const current = { id: 8, folio: "F-8", cliente_id: 3, nombre: "Cliente",
    total: "10.00", fecha: "2026-01-02T00:00:00.000Z" };
  const s = spySequence([{ datos: snapshot }], [], [current], [{ id: snapshot.id }],
    items.map(datos => ({ datos })));
  assert.deepEqual((await e11SnapshotSales(s.tx, snapshot.id)).items, items);
  assert.doesNotMatch(s.queries[4]!.sql, /AND false/);
});
test("E11-SNAPSHOT-EVIDENCE-CAS", async () => {
  const items = [sale()], snapshot = { ...frozen(items), evidenciaHash: e11Hash([sale(99)]) };
  const current = { id: 8, folio: "F-8", cliente_id: 3, nombre: "Cliente",
    total: "10.00", fecha: "2026-01-02T00:00:00.000Z" };
  const s = spySequence([{ datos: snapshot }], [], [current], [{ id: snapshot.id }],
    items.map(datos => ({ datos })));
  await assert.rejects(() => e11SnapshotSales(s.tx, snapshot.id), code("DEPENDENCIA_NO_DISPONIBLE"));
});
test("E11-PERIOD-LIST-SEPARATE-OBLIGATIONS", async () => {
  const periods = await e11Periods(spySequence([]).tx, "2026-06-01", "2026-06-02");
  assert.deepEqual(periods.map(p => [p.tipo, p.obligatorio]),
    [["DIA", false], ["SEMANA", true], ["MES", true]]);
});
test("E11-IDENTITY-CONTADOR-DEFAULT-F", async () => {
  const db = routedTx(identityRoute(null, 0));
  const value = await service().identity(db.tx, 7);
  assert.equal(value.perfil, "F"); assert.equal(value.perfilVersion, 0);
  assert.deepEqual(value.capacidades.sort(), ["FISCAL_CONCILIAR", "FISCAL_LEER"]);
});
test("E11-IDENTITY-A-EXPLICIT-CURRENT-VERSION", async () => {
  const db = routedTx(identityRoute("A", 4));
  const value = await service().identity(db.tx, 7);
  assert.equal(value.perfil, "A"); assert.equal(value.perfilVersion, 4);
  assert.deepEqual(value.capacidades.sort(), ["E5_PREPARAR", "FINANZAS_LIMITADAS_LEER"]);
});
test("E11-ASSIGN-ADMIN-CAS-HISTORY", async () => {
  let profile: { perfil: string; version: number } | undefined;
  const events: unknown[] = [], operations = new Map<string, { solicitud_hash: string; respuesta: unknown }>();
  const db = routedTx((text, params) => {
    if (/FROM usuarios WHERE id=.*FOR SHARE/.test(text)) {
      const user = Number(params[0]); return [{ id: user, rol: user === 1 ? "ADMIN" : "CONTADOR", activo: true }];
    }
    if (/FROM usuarios WHERE id=.*FOR UPDATE/.test(text)) return [{ id: 7, rol: "CONTADOR", activo: true }];
    if (/FROM e11_perfiles .*FOR SHARE/.test(text)) return [];
    if (/FROM e11_perfiles .*FOR UPDATE/.test(text)) return profile ? [profile] : [];
    if (/SELECT solicitud_hash,respuesta(?:,estado)? FROM e11_operaciones/.test(text)) {
      const prior = operations.get(String(params[2])); return prior ? [prior] : [];
    }
    if (/INSERT INTO e11_perfiles/.test(text)) { profile = { perfil: String(params[1]), version: Number(params[2]) }; return []; }
    if (/INSERT INTO e11_perfil_eventos/.test(text)) { events.push(JSON.parse(String(params[5]))); return []; }
    if (/INSERT INTO e11_operaciones/.test(text)) {
      operations.set(String(params[2]), { solicitud_hash: String(params[3]), respuesta: JSON.parse(String(params[4])) }); return [];
    }
    return [];
  });
  const api = service(), admin = await api.identity(db.tx, 1);
  const input = { uuid: "20000000-0000-4000-8000-000000000001", revisionEsperada: 0,
    perfil: "A" as const, motivo: "Asignación expresa" };
  const result = await api.assignProfile(db.tx, admin, 7, input);
  assert.deepEqual(profile, { perfil: "A", version: 1 }); assert.equal(events.length, 1);
  assert.equal(result.posterior, "A"); assert.equal(result.actorId, 1);
  const replay = await api.assignProfile(db.tx, admin, 7, input);
  assert.deepEqual(replay, result); assert.equal(events.length, 1);
});
test("E11-ASSIGN-STALE-CAS-NO-WRITE", async () => {
  const db = routedTx((text, params) => {
    if (/FROM usuarios WHERE id=.*FOR SHARE/.test(text)) return [{ id: 1, rol: "ADMIN", activo: true }];
    if (/FROM usuarios WHERE id=.*FOR UPDATE/.test(text)) return [{ id: 7, rol: "CONTADOR", activo: true }];
    if (/FROM e11_perfiles .*FOR SHARE/.test(text)) return [];
    if (/FROM e11_perfiles .*FOR UPDATE/.test(text)) return [{ perfil: "F", version: 2 }];
    return [];
  });
  const api = service(), admin = await api.identity(db.tx, 1);
  await assert.rejects(() => api.assignProfile(db.tx, admin, 7, {
    uuid: "20000000-0000-4000-8000-000000000002", revisionEsperada: 1,
    perfil: "A", motivo: "stale",
  }), code("REVISION_OBSOLETA"));
  assert.equal(db.queries.some(q => /INSERT INTO e11_perfiles/.test(q.sql)), false);
});
test("E11-ROLE-CHANGE-REVOKES-A", async () => {
  const writes: unknown[][] = [];
  const db = routedTx((text, params) => {
    if (/SELECT rol,activo FROM usuarios/.test(text)) return [{ rol: "CONTADOR", activo: true }];
    if (/SELECT perfil,version FROM e11_perfiles/.test(text)) return [{ perfil: "A", version: 6 }];
    if (/INSERT INTO e11_perfiles|INSERT INTO e11_perfil_eventos/.test(text)) { writes.push(params); return []; }
    return [];
  });
  await service().userRoleChange(db.tx, 7, "CAJA", true, 1);
  assert.equal(writes[0]![1], null); assert.equal(writes[0]![2], 7);
  const event = JSON.parse(String(writes[1]![5]));
  assert.deepEqual([event.anterior, event.posterior, event.revision], ["A", null, 7]);
});
test("E11-ROLE-REENTRY-STARTS-F", async () => {
  const writes: unknown[][] = [];
  const db = routedTx((text, params) => {
    if (/SELECT rol,activo FROM usuarios/.test(text)) return [{ rol: "CAJA", activo: true }];
    if (/SELECT perfil,version FROM e11_perfiles/.test(text)) return [{ perfil: "A", version: 7 }];
    if (/INSERT INTO e11_perfiles|INSERT INTO e11_perfil_eventos/.test(text)) { writes.push(params); return []; }
    return [];
  });
  await service().userRoleChange(db.tx, 7, "CONTADOR", true, 1);
  assert.equal(writes[0]![1], "F"); assert.equal(writes[0]![2], 8);
});
test("E11-RECOVERY-QUERY-PENDING-NOT-404", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const result = await database.transaction(tx => api.recovery(tx, admin, {
    actorId: 7, accion: "DECISION", uuidOriginal: "60000000-0000-4000-8000-000000000001",
  }));
  assert.deepEqual([result.estado, result.resolucionId, result.resueltoEn], ["PENDIENTE", null, null]);
  assert.match(result.revision, /^[a-f0-9]{64}$/);
});
test("E11-RECOVERY-NORMALIZES-ORIGINAL-UUID", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const result = await database.transaction(tx => api.recovery(tx, admin, {
    actorId: 7, accion: "SNAPSHOT", uuidOriginal: "AAAAAAAA-0000-4000-8000-000000000002",
  }));
  assert.equal(result.uuidOriginal, "aaaaaaaa-0000-4000-8000-000000000002");
});
test("E11-RECOVERY-USES-PRODUCER-REPLAY-NAMESPACE", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  await database.transaction(tx => api.recovery(tx, admin, {
    actorId: 7, accion: "PREPARACION", uuidOriginal: "60000000-0000-4000-8000-000000000003",
  }));
  assert.equal(database.locks.includes("E11:7:PREPARACION:60000000-0000-4000-8000-000000000003"), true);
  assert.equal(database.locks.some(lock => lock.startsWith("E11:recovery:")), false);
});
test("E11-RECOVERY-REQUIRES-FRESH-ADMIN", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const contador = await database.transaction(tx => api.identity(tx, 7));
  await assert.rejects(() => database.transaction(tx => api.recovery(tx, contador, {
    actorId: 7, accion: "PERFIL", uuidOriginal: "60000000-0000-4000-8000-000000000004",
  })), code("ADMIN_REQUERIDO"));
});
test("E11-RECOVERY-RESOLVE-WRITES-TOMBSTONE-NO-EFFECT", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const target = { actorId: 7, accion: "DECISION" as const,
    uuidOriginal: "60000000-0000-4000-8000-000000000005" };
  const pending = await database.transaction(tx => api.recovery(tx, admin, target));
  const result = await database.transaction(tx => api.resolve(tx, admin, target, {
    uuid: "60000000-0000-4000-8000-000000000105", revisionEsperada: pending.revision,
    identidadVersion: admin.permisosVersion, motivo: "Cerrar intención no observada",
  }));
  assert.equal(result.estado, "CERRADA_SIN_EFECTO");
  assert.deepEqual([database.state.operations.size, database.state.resolutions.length,
    database.state.businessEffects], [1, 1, 0]);
});
test("E11-RECOVERY-RESOLVE-CONFIRMED-WITHOUT-TOMBSTONE", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  await database.transaction(tx => e11Replay(tx, identity("F", 0), "SNAPSHOT",
    "60000000-0000-4000-8000-000000000015", { original: true }, async () => ({ private: "original" })));
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const target = { actorId: 7, accion: "SNAPSHOT" as const,
    uuidOriginal: "60000000-0000-4000-8000-000000000015" };
  const confirmed = await database.transaction(tx => api.recovery(tx, admin, target));
  const result = await database.transaction(tx => api.resolve(tx, admin, target, {
    uuid: "60000000-0000-4000-8000-000000000115", revisionEsperada: confirmed.revision,
    identidadVersion: admin.permisosVersion, motivo: "Confirmar metadata existente",
  }));
  assert.equal(result.estado, "CONFIRMADA");
  assert.deepEqual([database.state.operations.size, database.state.resolutions.length], [1, 1]);
  assert.deepEqual([...database.state.operations.values()][0]!.respuesta, { private: "original" });
});
test("E11-RECOVERY-RESOLVE-REJECTS-STALE-ADMIN-VERSION", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const target = { actorId: 7, accion: "PERFIL" as const,
    uuidOriginal: "60000000-0000-4000-8000-000000000016" };
  const pending = await database.transaction(tx => api.recovery(tx, admin, target));
  await assert.rejects(() => database.transaction(tx => api.resolve(tx, admin, target, {
    uuid: "60000000-0000-4000-8000-000000000116", revisionEsperada: pending.revision,
    identidadVersion: "0".repeat(64), motivo: "Identidad ADMIN obsoleta",
  })), code("PERFIL_CAMBIADO"));
  assert.deepEqual([database.state.operations.size, database.state.resolutions.length], [0, 0]);
});
test("E11-RECOVERY-RESOLVE-CAS-NO-WRITE", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  await assert.rejects(() => database.transaction(tx => api.resolve(tx, admin, {
    actorId: 7, accion: "DECISION", uuidOriginal: "60000000-0000-4000-8000-000000000006",
  }, {
    uuid: "60000000-0000-4000-8000-000000000106", revisionEsperada: "0".repeat(64),
    identidadVersion: admin.permisosVersion, motivo: "CAS obsoleto",
  })), code("REVISION_OBSOLETA"));
  assert.deepEqual([database.state.operations.size, database.state.resolutions.length], [0, 0]);
});
test("E11-RECOVERY-RESOLUTION-REPLAY-IDEMPOTENT", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const target = { actorId: 7, accion: "SNAPSHOT" as const,
    uuidOriginal: "60000000-0000-4000-8000-000000000007" };
  const pending = await database.transaction(tx => api.recovery(tx, admin, target));
  const input = { uuid: "60000000-0000-4000-8000-000000000107", revisionEsperada: pending.revision,
    identidadVersion: admin.permisosVersion, motivo: "Resolución idempotente" };
  const first = await database.transaction(tx => api.resolve(tx, admin, target, input));
  let replay: typeof first | undefined;
  await assert.doesNotReject(async () => { replay = await database.transaction(tx => api.resolve(tx, admin, target, input)); });
  assert.deepEqual(replay, first);
  assert.deepEqual([database.state.operations.size, database.state.resolutions.length], [1, 1]);
});
test("E11-RECOVERY-TOMBSTONE-BLOCKS-LATE-REQUEST", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const target = { actorId: 7, accion: "DECISION" as const,
    uuidOriginal: "60000000-0000-4000-8000-000000000008" };
  const pending = await database.transaction(tx => api.recovery(tx, admin, target));
  await database.transaction(tx => api.resolve(tx, admin, target, {
    uuid: "60000000-0000-4000-8000-000000000108", revisionEsperada: pending.revision,
    identidadVersion: admin.permisosVersion, motivo: "Bloquear request tardía",
  }));
  let work = 0;
  await assert.rejects(() => database.transaction(tx => e11Replay(tx, identity("F", 0), "DECISION",
    target.uuidOriginal.toUpperCase(), { late: true }, async () => { work++; return { accepted: true }; })),
  code("OPERACION_CERRADA_SIN_EFECTO"));
  assert.equal(work, 0); assert.equal(database.state.businessEffects, 0);
});
test("E11-RECOVERY-POSTCOMMIT-PRIVATE-NONRECURSIVE", async () => {
  const database = recoveryDatabase(), api = service({ transaction: database.transaction });
  const admin = await database.transaction(tx => api.identity(tx, 1));
  const target = { actorId: 7, accion: "PREPARACION" as const,
    uuidOriginal: "60000000-0000-4000-8000-000000000009" };
  const pending = await database.transaction(tx => api.recovery(tx, admin, target));
  const resolver = "60000000-0000-4000-8000-000000000109";
  let outcome!: E11Error;
  await assert.rejects(() => api.execute({
    userId: 1, sessionId: "60000000-0000-4000-8000-000000000209", capability: "FISCAL_LEER",
    mutationUuid: resolver,
    work: (tx, actor) => api.resolve(tx, actor, target, { uuid: resolver,
      revisionEsperada: pending.revision, identidadVersion: admin.permisosVersion, motivo: "Entrega cerrada" }),
    parse: value => value as { estado: string }, deliver: () => { throw new Error("PRIVATE_DELIVERY_DETAIL"); },
  }), error => { outcome = error as E11Error; return code("RESULTADO_CONFIRMADO_NO_CONSULTABLE")(error); });
  const body = e11ErrorBody(outcome);
  assert.deepEqual(Object.keys(body).sort(), ["code", "message", "requestId", "uuid"].sort());
  assert.equal(body.uuid, resolver); assert.doesNotMatch(JSON.stringify(body), /PRIVATE_DELIVERY_DETAIL/);
  assert.deepEqual([database.state.operations.size, database.state.resolutions.length], [1, 1]);
});
test("E11-RECOVERY-TARGET-REJECTS-RECURSIVE-QUARANTINE", () => {
  assert.equal(E11RecoveryTarget.safeParse({
    actorId: 1, accion: "RESOLUCION", uuidOriginal: "60000000-0000-4000-8000-000000000010",
  }).success, false);
});
test("E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY", async () => {
  let transaction = 0, delivered = 0, committedEffects = 0;
  const api = service({ transaction: async work => {
    transaction++;
    let draftEffects = committedEffects;
    const identityHandler = identityRoute(transaction === 1 ? "A" : "F", transaction === 1 ? 4 : 5) as
      (text: string, params: unknown[]) => Record<string, unknown>[];
    const db = routedTx((text, params) => {
      if (/INSERT INTO synthetic_effect/.test(text)) { draftEffects++; return []; }
      return identityHandler(text, params);
    });
    const result = await work(db.tx); committedEffects = draftEffects; return result;
  } });
  await assert.rejects(() => api.execute({
    userId: 7, sessionId: "30000000-0000-4000-8000-000000000001", capability: "FINANZAS_LIMITADAS_LEER",
    mutationUuid: "30000000-0000-4000-8000-000000000011",
    work: async tx => { await tx.execute(sql`INSERT INTO synthetic_effect VALUES (1)`); return { private: "A" }; },
    parse: value => value as { private: string },
    deliver: () => { delivered++; },
  }), error => code("RESULTADO_CONFIRMADO_NO_CONSULTABLE")(error) &&
    (error as { uuid?: string }).uuid === "30000000-0000-4000-8000-000000000011");
  assert.equal(transaction, 2); assert.equal(delivered, 0); assert.equal(committedEffects, 1);
});
test("E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION", async () => {
  let committedEffects = 0;
  const api = service({ transaction: async work => {
    let draft = committedEffects;
    const handler = identityRoute("F", 2) as
      (text: string, params: unknown[]) => Record<string, unknown>[];
    const db = routedTx((text, params) => {
      if (/INSERT INTO synthetic_effect/.test(text)) { draft++; return []; }
      return handler(text, params);
    });
    const result = await work(db.tx); committedEffects = draft; return result;
  } });
  await assert.rejects(() => api.execute({
    userId: 7, sessionId: "30000000-0000-4000-8000-000000000002", capability: "FISCAL_LEER",
    work: async tx => { await tx.execute(sql`INSERT INTO synthetic_effect VALUES (1)`); return { invalid: true }; },
    parse: () => { throw new Error("bad dto"); }, deliver: () => assert.fail("must not deliver"),
  }), code("DEPENDENCIA_NO_DISPONIBLE"));
  assert.equal(committedEffects, 0);
});
test("E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT", async () => {
  let committedEffects = 0;
  const api = service({ transaction: async work => {
    let draft = committedEffects;
    const handler = identityRoute("F", 2) as
      (text: string, params: unknown[]) => Record<string, unknown>[];
    const db = routedTx((text, params) => {
      if (/INSERT INTO synthetic_effect/.test(text)) { draft++; return []; }
      return handler(text, params);
    });
    const result = await work(db.tx); committedEffects = draft; return result;
  } });
  await assert.rejects(() => api.execute({
    userId: 7, sessionId: "30000000-0000-4000-8000-000000000003", capability: "FISCAL_LEER",
    mutationUuid: "30000000-0000-4000-8000-000000000013",
    work: async tx => { await tx.execute(sql`INSERT INTO synthetic_effect VALUES (1)`); return { ok: true }; },
    parse: value => value as { ok: boolean }, deliver: () => { throw new Error("SYNTHETIC_SOCKET_CLOSED"); },
  }), error => code("RESULTADO_CONFIRMADO_NO_CONSULTABLE")(error) &&
    (error as { uuid?: string }).uuid === "30000000-0000-4000-8000-000000000013");
  assert.equal(committedEffects, 1);
});
test("E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY", async () => {
  const database = decisionDatabase(), api = service({ transaction: database.transaction });
  const input = { uuid: "40000000-0000-4000-8000-000000000001", perfilVersion: 2,
    revisionEsperada: 1, fuenteRevision: database.snapshot.fuenteRevision, resultado: "NO_CUADRA" as const,
    totalExterno: "9.00", referenciaExterna: "LIBRO-1", observacion: "Composición distinta" };
  const command = () => api.execute({
    userId: 7, sessionId: "30000000-0000-4000-8000-000000000004", capability: "FISCAL_CONCILIAR",
    mutationUuid: input.uuid,
    work: (tx: E11Sql, actor: E11Identity) => api.decideSnapshot(tx, actor, database.snapshot.id, input),
    parse: value => value as typeof database.snapshot, deliver: () => {},
  });
  await assert.rejects(command, /SYNTHETIC_NOTIFICATION_FAILURE/);
  assert.deepEqual([database.state.decisions.length, database.state.avisos, database.state.notifications], [0, 0, 0]);
  await assert.doesNotReject(command);
  assert.deepEqual([database.state.decisions.length, database.state.avisos, database.state.notifications], [1, 1, 1]);
});
test("E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION", async () => {
  const database = decisionDatabase(), api = service({ transaction: database.transaction });
  const input = { uuid: "40000000-0000-4000-8000-000000000002", perfilVersion: 2,
    revisionEsperada: 1, fuenteRevision: database.snapshot.fuenteRevision, resultado: "NO_CUADRA" as const,
    totalExterno: "10.00", referenciaExterna: "LIBRO-2", observacion: "Difiere composición" };
  const command = () => api.execute({
    userId: 7, sessionId: "30000000-0000-4000-8000-000000000005", capability: "FISCAL_CONCILIAR",
    mutationUuid: input.uuid,
    work: (tx: E11Sql, actor: E11Identity) => api.decideSnapshot(tx, actor, database.snapshot.id, input),
    parse: value => value as typeof database.snapshot, deliver: () => {},
  });
  await assert.rejects(command, /SYNTHETIC_NOTIFICATION_FAILURE/);
  await assert.doesNotReject(command); await assert.doesNotReject(command);
  assert.deepEqual([database.state.decisions.length, database.state.avisos, database.state.notifications], [1, 1, 1]);
});
test("E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY", async () => {
  const cobroId = "50000000-0000-4000-8000-000000000001";
  let detail: any = {
    id: cobroId, revision: 1, clienteId: 3, clienteNombre: "Cliente", ubicacionId: 2, ubicacionNombre: "Tienda",
    importeRecibido: "10.00", importeAplicado: "0.00", importePendiente: "10.00", importeDevuelto: "0.00",
    fechaRecepcion: "2026-09-20T12:00:00.000Z", formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL",
    estado: "PENDIENTE", algunaVezAplicado: false, receptor: { id: 1, nombre: "ADMIN" },
    evidenciaRecepcion: { descripcion: "Origen real previo", referencias: ["R-1"] },
    notasIndicadas: [], propuestas: [], aplicaciones: [], rechazos: [],
    reciboId: "50000000-0000-4000-8000-000000000002", antiguedadDias: 0, avisoAdmin: false, capacidades: {},
  };
  const ledger = [{ id: 100, ticketId: 10, tipo: "VENTA_CREDITO" as const, importe: "10.00",
    createdAt: new Date("2026-09-01T12:00:00.000Z") }];
  const db = routedTx((text, params) => {
    if (/SELECT id,rol,activo FROM usuarios/.test(text)) return [{ id: 7, rol: "CONTADOR", activo: true }];
    if (/SELECT perfil,version FROM e11_perfiles/.test(text)) return [{ perfil: "A", version: 3 }];
    if (/SELECT nombre,ubicacion_id FROM usuarios/.test(text)) return [{ nombre: "Contador A", ubicacion_id: 2 }];
    if (/SELECT id,rol,ubicacion_id FROM usuarios/.test(text)) return [{ id: 7, rol: "CONTADOR", ubicacion_id: 2 }];
    if (/SELECT detail FROM e5_cobros/.test(text)) return [{ detail: structuredClone(detail) }];
    if (/SELECT actor_id AS "actorId",content,response FROM e5_operaciones/.test(text)) return [];
    if (/SELECT c.nombre,u.nombre AS sitio/.test(text)) return [{ nombre: "Cliente", sitio: "Tienda" }];
    if (/FROM tickets t JOIN movimientos_credito m/.test(text)) return [{
      id: 10, folio: "N-10", facturado: true, total: "10.00", movimiento: 100,
      movement_id: 100, ubicacion_id: 2,
    }];
    if (/SELECT id,nombre,telefono,correo,limite_credito/.test(text))
      return [{ id: 3, nombre: "Cliente", telefono: null, correo: "c@example.test", limite_credito: "100.00" }];
    if (/UPDATE e5_cobros SET detail/.test(text)) { detail = JSON.parse(String(params[0])); return [{ id: cobroId }]; }
    if (/SELECT solicitud_hash,respuesta(?:,estado)? FROM e11_operaciones/.test(text)) return [];
    return [];
  });
  const api = service({ ledger: async () => ledger });
  const actor = await api.identity(db.tx, 7);
  const before = await api.preparation(db.tx, actor, cobroId);
  let result: typeof before | undefined;
  await assert.doesNotReject(async () => {
    result = await api.prepare(db.tx, actor, cobroId, {
      uuid: "50000000-0000-4000-8000-000000000003", perfilVersion: 3, revisionEsperada: 1,
      fuenteRevision: before.fuenteRevision,
      asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "10.00" }],
    }, "offline");
  });
  assert.equal(result!.propuestaId, detail.propuestaVigenteId); assert.equal(detail.revision, 2);
  const sqlText = db.queries.map(q => q.sql).join("\n");
  assert.match(sqlText, /INSERT INTO e5_operaciones[\s\S]*INSERT INTO auditoria/);
  assert.doesNotMatch(sqlText, /INSERT INTO e5_aplicaciones|e5_devoluciones|e5_recepciones|salidas_dinero/);
});
test("E11-A-PREPARATION-DUPLICATE-NOTES-DENIED", async () => {
  const db = routedTx((text) => {
    if (/SELECT id,rol,activo FROM usuarios/.test(text)) return [{ id: 7, rol: "CONTADOR", activo: true }];
    if (/SELECT perfil,version FROM e11_perfiles/.test(text)) return [{ perfil: "A", version: 3 }];
    if (/SELECT nombre,ubicacion_id FROM usuarios/.test(text)) return [{ nombre: "Contador A", ubicacion_id: 2 }];
    return [];
  });
  const api = service(), actor = await api.identity(db.tx, 7);
  await assert.rejects(() => api.prepare(db.tx, actor, "50000000-0000-4000-8000-000000000001", {
    uuid: "50000000-0000-4000-8000-000000000004", perfilVersion: 3, revisionEsperada: 1,
    fuenteRevision: "source", asignaciones: [
      { notaId: 10, movimientoVentaId: 100, importe: "5.00" },
      { notaId: 10, movimientoVentaId: 100, importe: "5.00" },
    ],
  }, "offline"), code("VALIDACION"));
});
test("E11-LEGACY-DEFAULT-DENY-POLICY", () => {
  assert.equal(e11LegacyAllowed(true, "CONTADOR", "/clientes"), false);
  assert.equal(e11LegacyAllowed(true, "CONTADOR", "/auth/me"), true);
  assert.equal(e11LegacyAllowed(true, "ADMIN", "/clientes"), true);
  assert.equal(e11LegacyAllowed(false, "CONTADOR", "/clientes"), true);
});
test("E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES", async () => {
  let nextCalls = 0, status = 0, body: unknown;
  const boundary = createE11LegacyBoundary(true, ((req: { auth?: unknown }, _res: unknown, next: () => void) => {
    req.auth = { user: { rol: "CONTADOR" } } as never; next();
  }) as never);
  await boundary({ path: "/clientes" } as never, {
    status(value: number) { status = value; return this; }, json(value: unknown) { body = value; return this; },
  } as never, (() => { nextCalls++; }) as never);
  assert.equal(status, 403); assert.equal((body as { code: string }).code, "PERFIL_DENEGADO");
  assert.equal(nextCalls, 0);
});
test("E11-E5-A-CLOSED-WHILE-OFF", () => {
  const actor: E5Actor = { id: 7, nombre: "A sintético", rol: "CONTADOR", ubicacionId: null, ip: "",
    ver: true, recibirCaja: false, recibirCliente: false, todas: true, capacidadAE11: true, e11PerfilVersion: 2 };
  assert.equal(e5Capabilities(actor).puedePreparar, false);
  assert.equal(e5Capabilities(actor).puedeRecibir, false);
});
test("E11-ERROR-BODY-IS-PRIVATE", () => {
  const error = Object.assign(new E11Error("FUENTE_CAMBIADA", "La fuente cambió."), { private: "secreto" });
  const body = e11ErrorBody(error);
  assert.deepEqual(Object.keys(body).sort(), ["code", "message", "requestId"].sort());
  assert.equal((body as unknown as { private?: unknown }).private, undefined);
});