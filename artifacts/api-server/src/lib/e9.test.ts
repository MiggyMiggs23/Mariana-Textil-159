import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { calculateCash } from "./caja-cash-ledger";
import { e9FrozenCut, readE9FrozenCut, type E9Sql } from "./e9-cut";
import { e9Command, e9View, e9Capabilities, e9Cents, e9Decimal,
  type E9Repository, type E9Detail, type E9Operation, type E9Actor, type E9Action } from "./e9";
import { e9Repository, readE9Detail, listE9 } from "./e9-repository";
import { assertE9NoIndependentInverse, readE9FundOrigin } from "./e9-fondo";
import { createE9OffBoundary } from "./e9-http";
import { E9_ENABLED, E9_FONDO_INGRESS_ENABLED } from "./e9-feature";

// Synthetic actors and transaction model, never PostgreSQL/seed/locking proof.
const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin: E9Actor = { id: 10, nombre: "ADMIN sintético", rol: "ADMIN", ubicacionId: null, ip: "offline", puedeEnviar: true };
const supervisor: E9Actor = { ...admin, id: 11, rol: "SUPERVISOR", ubicacionId: 2 };
const evidence = { descripcion: "Comprobante sintético offline", referencias: [] };
const session = { id: 7, ubicacionId: 2, estado: "CERRADA", fechaOperativa: "2026-09-19", cerradaAt: "2026-09-20T18:00:00.000Z", efectivoContado: "10.00" };
const snapshot = { version: "E2", sesionId: 7, efectivoContado: "10.00", diferencia: "0.00",
  efectivoDesglose: calculateCash([{ origen: "FONDO_INICIAL", id: "7", folio: null, href: null, importe: "10.00" }]) };
const frozen = e9FrozenCut(session, [snapshot])!;
const send = (n = 1) => ({ claveOperacion: key(n), corteId: 7, versionCorte: frozen.versionCorte, evidencia: evidence });
const count = (amount = "8.00", n = 2) => ({ claveOperacion: key(n), importeRecibido: amount, evidencia: evidence });
const close = (n = 4) => ({ claveOperacion: key(n), conclusion: "Conclusión documental sintética, diferencia preservada", evidencia: evidence });
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
class Memory implements E9Repository {
  state = { records: new Map<string, { revision: number; detail: E9Detail }>(), ops: new Map<string, E9Operation>() };
  cutValue = { ...frozen, ubicacionId: 2, ubicacionNombre: "Tienda sintética" };
  locks = 0; reads = 0; failOperation = false;
  private queue = Promise.resolve();
  async tx<T>(fn: () => Promise<T>) {
    const previous = this.queue; let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; }); await previous;
    const saved = structuredClone(this.state);
    try { return await fn(); } catch (error) { this.state = saved; throw error; } finally { release(); }
  }
  async lockKey() { this.locks++; }
  async replay(k: string) { this.reads++; return this.state.ops.get(k); }
  async cut() { this.reads++; return this.cutValue; }
  async sent(cut: number) { return [...this.state.records.values()].some(r => r.detail.corteId === cut); }
  async load(id: string) { return structuredClone(this.state.records.get(id)); }
  async save(detail: E9Detail, revision: number | null) {
    this.state.records.set(detail.id, { revision: (revision ?? 0) + 1, detail: structuredClone(detail) });
  }
  async operation(k: string, _action: E9Action, content: string, result: E9Detail, actor: E9Actor) {
    if (this.failOperation) throw new Error("SYNTHETIC_HISTORY_FAILURE");
    this.state.ops.set(k, { actorId: actor.id, content, result: structuredClone(result) });
  }
}
const run = (m: Memory, action: E9Action, raw: unknown, id?: string, actor = admin) =>
  m.tx(() => e9Command(m, actor, action, raw, id, true));
async function setup(amount = "8.00") {
  const m = new Memory(); const sent = await run(m, "ENVIAR", send(), undefined, supervisor);
  const counted = await run(m, "CONTAR", count(amount), sent.id);
  return { m, sent, counted, auth: { claveOperacion: key(3), conteoId: counted.conteoVigenteId!, motivo: "Autorizar efectivo real sin ajustar diferencia" } };
}
async function authorized() { const x = await setup(); return { ...x, result: await run(x.m, "AUTORIZAR", x.auth, x.sent.id) }; }
const dialect = new PgDialect();
function spy(rows: Record<string, unknown>[] = []) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx: E9Sql = { execute: async query => { queries.push(dialect.sqlToQuery(query)); return { rows }; } };
  return { tx, queries };
}
test("E9-PRODUCTION-GATES", () => {
  assert.equal(E9_ENABLED, true);
  assert.equal(E9_FONDO_INGRESS_ENABLED, false);
});
test("E9-OFF-WRITE", async () => { const m = new Memory(); await assert.rejects(() => e9Command(m, admin, "ENVIAR", send(), undefined, false), code("E9_DISABLED")); assert.equal(m.reads, 0); });
test("E9-OFF-HTTP-OPTIONS", () => { let next = 0; let body: unknown;
  createE9OffBoundary(false)({ method: "GET", path: "/disponibilidad" } as never, { json: (v: unknown) => { body = v; } } as never, () => { next++; });
  assert.equal(next, 0); assert.equal((body as { enabled: boolean }).enabled, false);
});
test("E9-OFF-HTTP-MUTATION", () => { let next = 0; let status = 0; let body: unknown;
  const res = { status: (v: number) => { status = v; return res; }, json: (v: unknown) => { body = v; } };
  createE9OffBoundary(false)({ method: "POST", path: "/entregas" } as never, res as never, () => { next++; });
  assert.equal(next, 0); assert.equal(status, 403); assert.equal((body as { error: { code: string } }).error.code, "E9_DISABLED");
});
test("E9-OFF-CUT", async () => { const s = spy([{ snapshot }]); assert.equal(await readE9FrozenCut(s.tx, session, false), undefined); assert.equal(s.queries.length, 0); });
test("E9-OFF-DETAIL", async () => { const s = spy(); await assert.rejects(() => readE9Detail(s.tx, key(1), admin, false), code("E9_DISABLED")); assert.equal(s.queries.length, 0); });
test("E9-OFF-LIST", async () => { const s = spy(); await assert.rejects(() => listE9(s.tx, admin, { ubicacionId: 2, limit: 25 }, false), code("E9_DISABLED")); assert.equal(s.queries.length, 0); });
test("E9-OFF-FUND-ORIGIN", async () => { let reads = 0; await readE9FundOrigin({ query: async () => { reads++; return { rows: [] }; } }, key(1)); assert.equal(reads, 0); });
test("E9-OFF-INVERSE-READ", async () => { let reads = 0; await assertE9NoIndependentInverse({ query: async () => { reads++; return { rows: [] }; } }, key(1)); assert.equal(reads, 0); });
test("E9-CUT-CLOSED", () => { assert.equal(e9FrozenCut({ ...session, estado: "ABIERTA" }, [snapshot]), undefined); });
test("E9-CUT-NO-INFERENCE", () => { assert.equal(e9FrozenCut(session, []), undefined); });
test("E9-CUT-DUPLICATE", () => { assert.throws(() => e9FrozenCut(session, [snapshot, snapshot]), /duplicada/); });
test("E9-CUT-MISMATCH", () => { assert.throws(() => e9FrozenCut({ ...session, efectivoContado: "11.00" }, [snapshot]), /no coinciden/); });
test("E9-CUT-FULL-HASH", () => { const changed = structuredClone(snapshot); changed.efectivoDesglose.documentos[0]!.folio = "Otro comprobante";
  assert.notEqual(e9FrozenCut(session, [changed])!.versionCorte, frozen.versionCorte);
  assert.equal(e9FrozenCut(session, [snapshot])!.versionCorte, frozen.versionCorte); assert.equal(frozen.corteId, session.id);
});
test("E9-CUT-PHYSICAL-NOT-SALES", () => {
  const cash = calculateCash([
    { origen: "FONDO_INICIAL", id: "7", folio: null, href: null, importe: "2.00" },
    { origen: "TICKET", id: "8", folio: null, href: null, importe: "3.00" },
    { origen: "COBRO_RETENIDO", id: key(9), folio: null, href: null, importe: "5.00" },
  ]);
  assert.equal(e9FrozenCut(session, [{ ...snapshot, efectivoDesglose: cash }])!.importeEnviado, "10.00");
});
test("E9-CUT-ORIGINAL-PERIOD", () => {
  assert.equal(frozen.fechaOperativa, "2026-09-19");
  assert.notEqual(e9FrozenCut({ ...session, fechaOperativa: "2026-09-20" }, [snapshot])!.versionCorte, frozen.versionCorte);
});
test("E9-DECIMAL", () => { assert.equal(e9Decimal(e9Cents("0.03") - e9Cents("0.02")), "0.01"); });
test("E9-NO-PARTIAL-INPUT", async () => { await assert.rejects(() => run(new Memory(), "ENVIAR", { ...send(), importeEnviado: "5.00" }), { name: "ZodError" }); });
test("E9-SEND-COMPLETE", async () => { const m = new Memory(); const d = await run(m, "ENVIAR", send(), undefined, supervisor); assert.equal(d.importeEnviado, "10.00"); assert.equal(d.fechaCorte, session.cerradaAt); assert.equal(d.corteHref, "/caja/cortes?sesionId=7"); });
test("E9-SEND-SCOPE", async () => { await assert.rejects(() => run(new Memory(), "ENVIAR", send(), undefined, { ...supervisor, ubicacionId: 3 }), code("E9_NOT_FOUND")); });
test("E9-SEND-ROLE", async () => { await assert.rejects(() => run(new Memory(), "ENVIAR", send(), undefined, { ...supervisor, rol: "CAJA" }), code("E9_FORBIDDEN")); });
test("E9-SEND-PERMISSION", async () => { await assert.rejects(() => run(new Memory(), "ENVIAR", send(), undefined, { ...supervisor, puedeEnviar: false }), code("E9_FORBIDDEN")); });
test("E9-CUT-VERSION", async () => { await assert.rejects(() => run(new Memory(), "ENVIAR", { ...send(), versionCorte: "stale" }), code("E9_CORTE_STALE")); });
test("E9-CUT-ZERO", async () => { const m = new Memory(); m.cutValue.importeEnviado = "0.00"; await assert.rejects(() => run(m, "ENVIAR", send()), code("E9_VALIDATION")); });
test("E9-CUT-ONCE", async () => { const m = new Memory(); await run(m, "ENVIAR", send()); await assert.rejects(() => run(m, "ENVIAR", send(8)), code("E9_CORTE_ALREADY_SENT")); });
test("E9-REPLAY", async () => { const m = new Memory(); const d = await run(m, "ENVIAR", send()); let replay: unknown; await assert.doesNotReject(async () => { replay = await run(m, "ENVIAR", send()); }); assert.deepEqual(replay, d); assert.equal(m.state.records.size, 1); });
test("E9-REPLAY-CONTENT", async () => { const m = new Memory(); await run(m, "ENVIAR", send()); await assert.rejects(() => run(m, "ENVIAR", { ...send(), evidencia: { ...evidence, descripcion: "Otro" } }), code("E9_IDEMPOTENCY_CONFLICT")); });
test("E9-CONCURRENT-SEND-MODEL", async () => { const m = new Memory(); const results = await Promise.allSettled([run(m, "ENVIAR", send()), run(m, "ENVIAR", send(8))]); assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(m.state.records.size, 1); });
test("E9-COUNT-ADMIN", async () => { const m = new Memory(); const d = await run(m, "ENVIAR", send()); await assert.rejects(() => run(m, "CONTAR", count(), d.id, supervisor), code("E9_FORBIDDEN")); });
test("E9-COUNT-DEFICIT", async () => { const x = await setup("8.00"); assert.equal(x.counted.conteos[0]!.diferencia, "-2.00"); assert.equal(x.counted.investigacion?.estado, "ABIERTA"); });
test("E9-COUNT-SURPLUS", async () => { const x = await setup("12.00"); assert.equal(x.counted.conteos[0]!.diferencia, "2.00"); assert.equal(x.counted.investigacion?.estado, "ABIERTA"); });
test("E9-COUNT-ZERO", async () => { const x = await setup("0.00"); assert.equal(x.counted.investigacion?.estado, "ABIERTA"); assert.equal(x.counted.estado, "CONTADA"); });
test("E9-COUNT-HISTORY", async () => { const x = await setup(); const d = await run(x.m, "CONTAR", count("9.00", 6), x.sent.id); assert.equal(d.conteos.length, 2); assert.deepEqual(d.conteos[0], x.counted.conteos[0]); assert.deepEqual(d.investigacion, x.counted.investigacion); });
test("E9-STALE-COUNT", async () => { const x = await setup(); await run(x.m, "CONTAR", count("9.00", 6), x.sent.id); await assert.rejects(() => run(x.m, "AUTORIZAR", x.auth, x.sent.id), code("E9_CONTEO_STALE")); });
test("E9-ZERO-NO-SEAT", async () => { const x = await setup("0.00"); await assert.rejects(() => run(x.m, "AUTORIZAR", x.auth, x.sent.id), code("E9_RECEIVED_ZERO")); assert.equal(x.m.state.records.get(x.sent.id)!.detail.estado, "CONTADA"); });
test("E9-AUTH-ROLE", async () => { const x = await setup(); await assert.rejects(() => run(x.m, "AUTORIZAR", x.auth, x.sent.id, supervisor), code("E9_FORBIDDEN")); });
test("E9-AUTH-EXACT-DOCUMENTARY", async () => { const x = await authorized(); assert.equal(x.result.autorizacion!.importeRecibido, "8.00"); assert.equal(x.result.investigacion?.estado, "ABIERTA"); assert.equal(x.result.fondo, undefined); });
test("E9-AUTH-REASON", async () => { const x = await setup(); await assert.rejects(() => run(x.m, "AUTORIZAR", { claveOperacion: key(3), conteoId: x.auth.conteoId }, x.sent.id), code("E9_VALIDATION")); });
test("E9-AUTH-ONCE", async () => { const x = await authorized(); await assert.rejects(() => run(x.m, "AUTORIZAR", { ...x.auth, claveOperacion: key(9) }, x.sent.id), code("E9_ALREADY_AUTHORIZED")); });
test("E9-CONCURRENT-AUTH-MODEL", async () => { const x = await setup(); const results = await Promise.allSettled([run(x.m, "AUTORIZAR", x.auth, x.sent.id), run(x.m, "AUTORIZAR", { ...x.auth, claveOperacion: key(9) }, x.sent.id)]); assert.equal(results.filter(r => r.status === "fulfilled").length, 1); });
test("E9-AUTH-ROLLBACK-MODEL", async () => { const x = await setup(); x.m.failOperation = true; await assert.rejects(() => run(x.m, "AUTORIZAR", x.auth, x.sent.id), /SYNTHETIC_HISTORY_FAILURE/); assert.equal(x.m.state.records.get(x.sent.id)!.detail.estado, "CONTADA"); });
test("E9-RECOUNT-AUTHORIZED", async () => { const x = await authorized(); await assert.rejects(() => run(x.m, "CONTAR", count("20.00", 7), x.sent.id), code("E9_ALREADY_AUTHORIZED")); });
test("E9-CLOSE-ROLE", async () => { const x = await authorized(); await assert.rejects(() => run(x.m, "CERRAR", close(), x.sent.id, supervisor), code("E9_FORBIDDEN")); });
test("E9-CLOSE-NONFINANCIAL", async () => { const x = await authorized(); const d = await run(x.m, "CERRAR", close(), x.sent.id); assert.equal(d.investigacion!.estado, "CERRADA_DOCUMENTAL"); assert.deepEqual(d.conteos, x.result.conteos); assert.deepEqual(d.autorizacion, x.result.autorizacion); assert.equal(d.importeEnviado, "10.00"); assert.equal(d.investigacion!.cierre!.evidencia.descripcion, evidence.descripcion); });
test("E9-CLOSE-EVIDENCE", async () => { const x = await authorized(); await assert.rejects(() => run(x.m, "CERRAR", { ...close(), evidencia: { descripcion: "", referencias: [] } }, x.sent.id), { name: "ZodError" }); });
test("E9-CLOSE-STATE", async () => { const x = await setup(); await assert.rejects(() => run(x.m, "CERRAR", close(), x.sent.id), code("E9_STATE_CONFLICT")); });
test("E9-CLOSE-ONCE", async () => { const x = await authorized(); await run(x.m, "CERRAR", close(), x.sent.id); await assert.rejects(() => run(x.m, "CERRAR", close(8), x.sent.id), code("E9_STATE_CONFLICT")); });
test("E9-PRIVACY", async () => { const x = await authorized(); const view = e9View(x.result, supervisor); assert.equal("fondo" in view, false); assert.equal(JSON.stringify(view).includes(key(900)), false); assert.equal(e9Capabilities(supervisor, x.result).puedeAutorizar, false); });
test("E9-CAS", async () => { const x = await authorized(); const s = spy(); await assert.rejects(() => e9Repository(s.tx).save(x.result, 2), code("E9_STATE_CONFLICT")); });
test("E9-KEY-LOCK", async () => { const s = spy(); await e9Repository(s.tx).lockKey(key(1)); assert.equal(s.queries.length, 1); assert.match(s.queries[0]!.sql, /pg_advisory_xact_lock/); assert.deepEqual(s.queries[0]!.params, ["E9:" + key(1)]); });
test("E9-RECEIPT-LOCK-REQUEST", async () => { const s = spy(); await e9Repository(s.tx).load(key(1)); assert.match(s.queries[0]!.sql, /FOR UPDATE/); });
test("E9-CUT-LOCK-REQUEST", async () => { const queries: string[] = [];
  const tx: E9Sql = { execute: async q => { const text = dialect.sqlToQuery(q).sql; queries.push(text); return { rows: text.includes("FROM sesiones_caja") ? [{ ...session, ubicacionNombre: "Tienda sintética" }] : [{ snapshot }] }; } };
  await e9Repository(tx).cut(7, admin); assert.match(queries[0]!, /FOR UPDATE OF s/);
});
test("E9-LIST-SCOPE", async () => { const s = spy(); await assert.rejects(() => listE9(s.tx, supervisor, { ubicacionId: 3, limit: 25 }, true), code("E9_NOT_FOUND")); assert.equal(s.queries.length, 0); });
test("E9-FONDO-BRIDGE-CLOSED", async () => {
  let reads = 0;
  const tx = { query: async <T>() => { reads++; return { rows: [{}] as T[] }; } };
  await assertE9NoIndependentInverse(tx, key(900));
  assert.equal(await readE9FundOrigin(tx, key(900)), undefined);
  assert.equal(reads, 0);
});
test("E9-AUDIT-OWN-MODULE", async () => { const x = await authorized(); const s = spy(); await e9Repository(s.tx).operation(key(3), "AUTORIZAR", "{}", x.result, admin);
  assert.match(s.queries.at(-1)!.sql, /'E9'/); assert.doesNotMatch(s.queries.at(-1)!.sql, /'FONDO'/);
});
test("E9-AUTHORIZATION-REPOSITORY-HAS-NO-FONDO-WRITE", async () => { const x = await authorized(), s = spy([{ id: x.result.id }]);
  await e9Repository(s.tx).save(x.result, 2);
  await e9Repository(s.tx).operation(key(3), "AUTORIZAR", "{}", x.result, admin);
  assert.equal(s.queries.some(q => /fondo_movimientos|fondo_mariana/.test(q.sql)), false);
});
test("E9-NO-SECOND-CASH-WITHDRAWAL", async () => { const x = await setup(), s = spy();
  await e9Repository(s.tx).save(x.sent, null);
  assert.equal(s.queries.some(q => /UPDATE sesiones_caja|INSERT INTO salidas_dinero_caja/.test(q.sql)), false);
});