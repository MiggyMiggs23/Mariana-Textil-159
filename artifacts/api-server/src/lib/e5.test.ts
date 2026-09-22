import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { e5Command, e5Preview, e5Capabilities, e5View, e5Cents, validateE5Allocations,
  type E5Repository, type E5Actor, type E5Context, type E5Cobro, type E5Operation, type E5Action } from "./e5";
import { e5Repository, listE5Cobros, readE5Document, e5RefundOptions, type E5Sql } from "./e5-repository";
import { e5OffBoundary, e5DatabaseError } from "./e5-http";
import { assertE5NoIndependentInverse } from "./e5-fondo";
import { e5DestinationRows } from "./e5-destination-reader";
import { creditCashDocuments, calculateCash } from "./caja-cash-ledger";
import { getTableConfig } from "drizzle-orm/pg-core";
import { operacionesCreditoE1Table } from "../../../../lib/db/src/schema/pos";

// Entirely synthetic transaction model. It neither connects to PostgreSQL nor proves its locks.
const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const evidence = { descripcion: "Evidencia sintética", referencias: ["REF-1"] };
const admin: E5Actor = { id: 1, nombre: "ADMIN sintético", rol: "ADMIN", ubicacionId: null, ip: "offline",
  ver: true, recibirCaja: true, recibirCliente: true, todas: true, capacidadAE11: false };
const cashier: E5Actor = { ...admin, id: 2, nombre: "CAJA sintética", rol: "CAJA", ubicacionId: 2,
  todas: false, capacidadAE11: false };
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
const note = (notaId: number, movimientoVentaId: number, saldoPendiente: string) => ({
  notaId, movimientoVentaId, folio: `N-${notaId}`, ubicacionId: 2, fecha: "2026-09-20T00:00:00.000Z",
  saldoPendiente, facturada: false,
});
const context = (notes = [note(10, 100, "10.00")], debt = "10.00"): E5Context => ({
  clienteId: 7, clienteNombre: "Cliente sintético", ubicacionId: 2, ubicacionNombre: "Tienda sintética",
  versionContexto: "opaque-v1", consultadoAt: "2026-09-20T00:00:00.000Z", notas: notes, sesiones: [],
  capacidades: e5Capabilities(admin), deudaGlobal: debt,
});
const receive = (n = 1) => ({ claveOperacion: key(n), clienteId: 7, ubicacionId: 2, versionContexto: "opaque-v1",
  entrada: "CAJA" as const, importe: "10.00", formaPago: "TRANSFERENCIA" as const,
  cuentaDestino: "CUENTA_FISCAL" as const, sesionOperativaId: 9, notasIndicadas: [10], evidencia: evidence });

class Memory implements E5Repository {
  state = { detail: undefined as E5Cobro | undefined, ops: new Map<string, E5Operation>(), docs: [] as any[],
    effects: [] as string[] };
  ctx = context(); failOperation = false; sessionsChecked = 0; applyCalls = 0; refundCalls = 0;
  private queue = Promise.resolve();
  async tx<T>(fn: () => Promise<T>) {
    const prior = this.queue; let release!: () => void;
    this.queue = new Promise<void>(r => { release = r; }); await prior;
    const saved = structuredClone(this.state);
    try { return await fn(); } catch (error) { this.state = saved; throw error; } finally { release(); }
  }
  async lockKey() {}
  async replay(k: string) { return this.state.ops.get(k); }
  async load() { return this.state.detail ? structuredClone(this.state.detail) : undefined; }
  async context() { return structuredClone(this.ctx); }
  async sessions() { this.sessionsChecked++; }
  async receive() { this.state.effects.push("RECEIVE"); }
  async apply() { this.applyCalls++; this.state.effects.push("APPLY"); }
  async refund() { this.refundCalls++; this.state.effects.push("REFUND"); return { salidaId: 88 }; }
  async save(d: E5Cobro) { this.state.detail = structuredClone(d); }
  async document(d: any) { this.state.docs.push(structuredClone(d)); }
  async operation(k: string, _a: E5Action, content: string, d: E5Cobro, a: E5Actor) {
    if (this.failOperation) throw new Error("SYNTHETIC_HISTORY_FAILURE");
    this.state.ops.set(k, { actorId: a.id, content, response: structuredClone(d) });
  }
}
const run = (m: Memory, action: E5Action, raw: unknown, id?: string, actor = admin) =>
  m.tx(() => e5Command(m, actor, action, raw, id, true));
async function pending(m = new Memory(), actor = admin, input: any = receive()) {
  const detail = await run(m, "RECIBIR", input, undefined, actor); return { m, detail };
}
async function proposed() {
  const x = await pending(); const proposal = await run(x.m, "PROPONER", {
    claveOperacion: key(2), revisionEsperada: 1, versionContexto: "opaque-v1",
    asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "10.00" }], evidencia: evidence,
  }, x.detail.id);
  return { ...x, proposal, proposalId: proposal.propuestaVigenteId! };
}

test("E5-OFF-COMMAND", async () => {
  await assert.rejects(() => e5Command(new Memory(), admin, "RECIBIR", receive()), code("E5_DISABLED"));
});
test("E5-OFF-PREVIEW", async () => {
  const m = new Memory(); await assert.rejects(() => e5Preview(m, admin, receive()), code("E5_DISABLED"));
  assert.equal(m.sessionsChecked, 0);
});
test("E5-OFF-HTTP", () => {
  let status = 0, body: any; e5OffBoundary({ method: "POST", path: "/cobros" } as any,
    { status(n: number) { status = n; return this; }, json(v: any) { body = v; } } as any, () => assert.fail());
  assert.equal(status, 403); assert.equal(body.error.code, "E5_DISABLED");
});
test("E5-OFF-AVAILABILITY", () => {
  let body: any; e5OffBoundary({ method: "GET", path: "/disponibilidad" } as any,
    { status() { assert.fail(); }, json(v: any) { body = v; } } as any, () => assert.fail());
  assert.equal(body.enabled, false); assert.equal(Object.values(body.capacidades).every(v => v === false), true);
});
test("E5-MONEY-POSITIVE", async () => {
  assert.equal(e5Cents("10.09"), 1009n);
  await assert.rejects(() => run(new Memory(), "RECIBIR", { ...receive(), importe: "0.00" }), code("E5_VALIDATION"));
});
test("E5-EXACT-MULTICHARGE", async () => {
  const m = new Memory(); m.ctx = context([note(10, 100, "4.00"), note(10, 101, "6.00")]);
  let d!: E5Cobro;
  await assert.doesNotReject(async () => { d = await run(m, "RECIBIR", receive(), undefined, cashier); });
  assert.deepEqual(d.notasIndicadas.map((n: { movimientoVentaId: number }) => n.movimientoVentaId), [100, 101]);
});
test("E5-EXACT-NONADMIN", async () => {
  await assert.rejects(() => run(new Memory(), "RECIBIR", { ...receive(), importe: "9.00" }, undefined, cashier), code("E5_EXACT_REQUIRED"));
});
test("E5-ALLOCATION-EXACT-MOVEMENT", () => {
  assert.throws(() => validateE5Allocations([{ notaId: 10, movimientoVentaId: 999, importe: "1.00" }],
    context(), "10.00"), code("E5_NOTA_STALE"));
});
test("E5-ALLOCATION-NO-DUPLICATE", () => {
  assert.throws(() => validateE5Allocations([{ notaId: 10, movimientoVentaId: 100, importe: "1.00" },
    { notaId: 10, movimientoVentaId: 100, importe: "1.00" }], context(), "10.00"), code("E5_VALIDATION"));
});
test("E5-RECEIVE-PERMISSION", async () => {
  await assert.rejects(() => run(new Memory(), "RECIBIR", receive(), undefined,
    { ...cashier, recibirCaja: false }), code("E5_FORBIDDEN"));
});
test("E5-RECEIVE-SCOPE", async () => {
  await assert.rejects(() => run(new Memory(), "RECIBIR", receive(), undefined,
    { ...cashier, ubicacionId: 3 }), code("E5_NOT_FOUND"));
});
test("E5-MEDIUM-SESSIONS", async () => {
  await assert.rejects(() => run(new Memory(), "RECIBIR", { ...receive(), sesionCajaId: 9 }), code("E5_VALIDATION"));
});
test("E5-ADMIN-APPLY-NOW", async () => {
  const x = await pending(new Memory(), admin, { ...receive(), aplicarAhora:
    [{ notaId: 10, movimientoVentaId: 100, importe: "6.00" }] });
  assert.equal(x.detail.estado, "PARCIAL"); assert.equal(x.detail.importePendiente, "4.00");
  assert.equal(x.m.applyCalls, 1); assert.deepEqual(x.m.state.docs.map(d => d.tipo), ["RECIBO", "CONSTANCIA"]);
});
test("E5-NONADMIN-NO-APPLY-NOW", async () => {
  await assert.rejects(() => pending(new Memory(), cashier, { ...receive(), aplicarAhora:
    [{ notaId: 10, movimientoVentaId: 100, importe: "10.00" }] }), code("E5_FORBIDDEN"));
});
test("E5-PROPOSAL-EXPLICIT-FUTURE", async () => {
  const x = await proposed(); assert.equal(x.proposal.aplicaciones.length, 0);
  assert.equal(x.proposal.importePendiente, "10.00"); assert.equal(x.m.applyCalls, 0);
});
test("E5-PREPARE-ADMIN-OR-A", () => {
  assert.equal(e5Capabilities(admin).puedePreparar, true);
  assert.equal(e5Capabilities({ ...cashier, rol: "CONTADOR", capacidadAE11: false }).puedePreparar, false);
});
test("E5-ADMIN-AUTHORIZE-NOW-CAPABILITY", async () => {
  assert.equal(e5Capabilities(admin).puedeAutorizar, true);
  const x = await pending(); assert.equal(e5Capabilities(admin, x.detail).puedeAutorizar, false);
});
test("E5-AUTHORIZE-ADMIN-ONLY", async () => {
  const x = await proposed(); const raw = { claveOperacion: key(3), revisionEsperada: 2,
    versionContexto: "opaque-v1", propuestaId: x.proposalId,
    asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "5.00" }], evidencia: evidence };
  await assert.rejects(() => run(x.m, "AUTORIZAR", raw, x.detail.id, cashier), code("E5_FORBIDDEN"));
});
test("E5-AUTHORIZE-SUBSET-ONLY", async () => {
  const x = await proposed(); x.m.state.detail!.propuestas[0]!.asignaciones[0]!.importe = "5.00";
  await assert.rejects(() => run(x.m, "AUTORIZAR", { claveOperacion: key(3),
    revisionEsperada: 2, versionContexto: "opaque-v1", propuestaId: x.proposalId,
    asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "6.00" }], evidencia: evidence }, x.detail.id),
  code("E5_STATE_CONFLICT"));
});
test("E5-PARTIAL-RESOLVES-PROPOSAL", async () => {
  const x = await proposed(); const d = await run(x.m, "AUTORIZAR", { claveOperacion: key(3), revisionEsperada: 2,
    versionContexto: "opaque-v1", propuestaId: x.proposalId,
    asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "4.00" }], evidencia: evidence }, x.detail.id);
  assert.equal(d.estado, "PARCIAL"); assert.equal(d.propuestaVigenteId, undefined); assert.equal(d.importePendiente, "6.00");
});
test("E5-PAID-TARGET-FREEZES", async () => {
  const m = new Memory(); m.ctx = context([note(10, 100, "5.00"), note(11, 101, "5.00")]);
  const d = await run(m, "RECIBIR", { ...receive(), notasIndicadas: [10, 11] });
  const p = await run(m, "PROPONER", { claveOperacion: key(2), revisionEsperada: 1,
    versionContexto: "opaque-v1", asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "5.00" },
      { notaId: 11, movimientoVentaId: 101, importe: "5.00" }], evidencia: evidence }, d.id);
  m.ctx = context([note(11, 101, "5.00")], "5.00");
  await assert.rejects(() => run(m, "AUTORIZAR", { claveOperacion: key(3), revisionEsperada: 2,
    versionContexto: "opaque-v1", propuestaId: p.propuestaVigenteId!,
    asignaciones: [{ notaId: 11, movimientoVentaId: 101, importe: "5.00" }], evidencia: evidence }, d.id),
  code("E5_NOTA_STALE"));
});
test("E5-REJECT-KEEPS-MONEY", async () => {
  const x = await proposed(); const d = await run(x.m, "RECHAZAR", { claveOperacion: key(3), revisionEsperada: 2,
    propuestaId: x.proposalId, motivo: "Cliente pidió revisar" }, x.detail.id);
  assert.equal(d.estado, "PENDIENTE"); assert.equal(d.importePendiente, "10.00");
  assert.equal(d.rechazos.length, 1); assert.equal(d.propuestaVigenteId, undefined);
});
test("E5-FAVOR-EXPLICIT-ADMIN-ZERODEBT", () => {
  assert.equal(validateE5Allocations([{ notaId: 10, movimientoVentaId: 100, importe: "10.00" }],
    context([note(10, 100, "10.00")], "10.00"), "12.00", "2.00"), "12.00");
});
test("E5-FAVOR-NO-AUTO-WITH-DEBT", () => {
  assert.throws(() => validateE5Allocations([{ notaId: 10, movimientoVentaId: 100, importe: "4.00" }],
    context([note(10, 100, "10.00")], "10.00"), "10.00", "6.00"), code("E5_STATE_CONFLICT"));
});
test("E5-REFUND-NEVER-APPLIED-FULL", async () => {
  const x = await pending(); const d = await run(x.m, "DEVOLVER", { claveOperacion: key(4), revisionEsperada: 1,
    peticionCliente: "Solicitud expresa del cliente", evidencia: evidence,
    fuente: { tipo: "CAJA", ubicacionId: 2, sesionCajaId: 22, cuentaOrigen: "CAJA_FISICA" } }, x.detail.id);
  assert.equal(d.estado, "DEVUELTO"); assert.equal(d.importeDevuelto, "10.00"); assert.equal(x.m.refundCalls, 1);
});
test("E5-REFUND-AFTER-PARTIAL-NO", async () => {
  const x = await proposed(); await run(x.m, "AUTORIZAR", { claveOperacion: key(3), revisionEsperada: 2,
    versionContexto: "opaque-v1", propuestaId: x.proposalId,
    asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "4.00" }], evidencia: evidence }, x.detail.id);
  await assert.rejects(() => run(x.m, "DEVOLVER", { claveOperacion: key(4), revisionEsperada: 3,
    peticionCliente: "Petición", evidencia: evidence, fuente: { tipo: "CAJA", ubicacionId: 2, sesionCajaId: 2,
      cuentaOrigen: "CAJA_FISICA" } }, x.detail.id), code("E5_REFUND_INELIGIBLE"));
});
test("E5-IDEMPOTENCY-CONTENT", async () => {
  const x = await pending(); const replay = await run(x.m, "RECIBIR", receive());
  assert.equal(replay.id, x.detail.id); assert.equal(x.m.state.effects.length, 1);
  await assert.rejects(() => run(x.m, "RECIBIR", { ...receive(), importe: "9.00" }), code("E5_IDEMPOTENCY_CONFLICT"));
});
test("E5-REVISION-CAS-MODEL", async () => {
  const x = await pending(); await assert.rejects(() => run(x.m, "PROPONER", { claveOperacion: key(2),
    revisionEsperada: 99, versionContexto: "opaque-v1", asignaciones:
    [{ notaId: 10, movimientoVentaId: 100, importe: "1.00" }], evidencia: evidence }, x.detail.id), code("E5_VERSION_STALE"));
});
test("E5-ROLLBACK-SYNTHETIC", async () => {
  const m = new Memory(); m.failOperation = true;
  await assert.rejects(() => run(m, "RECIBIR", receive()), /SYNTHETIC_HISTORY_FAILURE/);
  assert.equal(m.state.detail, undefined); assert.deepEqual(m.state.effects, []);
});
test("E5-TWO-DATES-AND-DOC-IMMUTABLE", async () => {
  const x = await proposed(); const receipt = structuredClone(x.m.state.docs[0]);
  x.m.state.detail!.fechaRecepcion = "2020-01-01T00:00:00.000Z";
  const d = await run(x.m, "AUTORIZAR", { claveOperacion: key(3), revisionEsperada: 2,
    versionContexto: "opaque-v1", propuestaId: x.proposalId,
    asignaciones: [{ notaId: 10, movimientoVentaId: 100, importe: "5.00" }], evidencia: evidence }, x.detail.id);
  assert.deepEqual(x.m.state.docs[0], receipt); assert.equal(x.m.state.docs[1].fechaRecepcion, d.fechaRecepcion);
  assert.equal(x.m.state.docs[1].fechaEmision, x.m.state.docs[1].fechaAplicacion);
  assert.ok(x.m.state.docs[1].fechaAplicacion > d.fechaRecepcion);
});
test("E5-ALERT-THREE-DAYS", async () => {
  const x = await pending(); const viewed = e5View({ ...x.detail, fechaRecepcion: "2026-09-20T00:00:00.000Z" },
    admin, new Date("2026-09-23T00:00:00.000Z"));
  assert.equal(viewed.antiguedadDias, 3); assert.equal(viewed.avisoAdmin, true);
});
test("E5-REFUND-PRIVACY", async () => {
  const x = await pending(); const full: any = { ...x.detail, devolucion: { id: key(8), importe: "10.00",
    fecha: "2026-09-20T01:00:00Z", actor: { id: 1, nombre: "A" }, peticionCliente: "dato privado",
    evidencia: evidence, fuente: { tipo: "FONDO", ubicacionId: 2 }, movimientoFondoId: key(9) } };
  const visible: any = e5View(full, cashier);
  assert.equal(visible.devolucion.fuente, undefined); assert.equal(visible.devolucion.movimientoFondoId, undefined);
  assert.equal(visible.devolucion.evidencia.referencias.length, 0);
});
test("E5-RECEPTION-PAID-CHARGE-OMITTED", async () => {
  const m = new Memory(); m.ctx = context([note(10, 100, "0.00"), note(10, 101, "6.00")], "6.00");
  const d = await run(m, "RECIBIR", { ...receive(), importe: "6.00" }, undefined, cashier);
  assert.deepEqual(d.notasIndicadas.map((n: { movimientoVentaId: number }) => n.movimientoVentaId), [101]);
});
test("E5-DEPENDENCY-ERROR-SANITIZED", () => {
  const error = e5DatabaseError({ cause: { code: "23514", constraint: "operaciones_productor_naturaleza_ck_e1",
    message: "private SQL payload" } });
  assert.equal(error?.code, "E5_DEPENDENCY_DISABLED"); assert.doesNotMatch(error!.message, /private|SQL/);
});
test("E5-FUND-GUARD-OFF-NO-QUERY", async () => {
  let queries = 0;
  await assert.doesNotReject(() =>
    assertE5NoIndependentInverse({ query: async () => { queries++; return { rows: [{}] }; } } as any, key(9), false));
  assert.equal(queries, 0);
});
test("E5-FUND-INVERSE-GUARD", async () => {
  await assert.rejects(() => assertE5NoIndependentInverse({
    query: async () => ({ rows: [{}] }),
  } as any, key(9), true), (error: unknown) => (error as { code?: string }).code === "E5_DEVOLUCION_INMUTABLE");
});
test("E5-DESTINATION-OFF-NO-SQL", () => {
  assert.equal(e5DestinationRows(false), "");
});
test("E5-DESTINATION-MONEY-ONLY", () => {
  const rows = e5DestinationRows(true);
  assert.match(rows, /E5_RECEPCION/); assert.match(rows, /E5_DEVOLUCION/);
  assert.doesNotMatch(rows, /e5_aplicaciones|FONDO/);
});
test("E5-CASH-RETAINED-WITHOUT-APPLICATION", () => {
  const retained = creditCashDocuments(9, [{ id: 1, clienteId: 7, sesionCajaId: 9,
    naturaleza: "OPERACION_CREDITO_SIN_DINERO", formaPago: null, cuentaDestino: null, tipo: "ABONO",
    importe: "-10.00", operacionProductor: "E5_APLICACION_RETENIDA", operacionClave: key(2) }],
  [{ sesionCajaId: 9, naturaleza: "INGRESO_FISICO",
    medio: "EFECTIVO", cuentaDestino: "CAJA_FISICA", operacionProductor: "COBRO_PENDIENTE",
    operacionClave: key(1), importe: "10.00" }]);
  const total = calculateCash(retained);
  assert.deepEqual(retained.map(document => document.origen), ["COBRO_RETENIDO"]);
  assert.equal(total.cobrosRetenidos, "10.00"); assert.equal(total.abonosFisicos, "0.00");
});
test("E5-DRIZZLE-PRODUCER-METADATA", () => {
  const config = getTableConfig(operacionesCreditoE1Table);
  const check = config.checks.find(item => item.name === "operaciones_productor_naturaleza_ck_e1");
  assert.ok(check); const query = dialect.sqlToQuery(check!.value);
  assert.match(query.sql, /E5_APLICACION_RETENIDA/); assert.match(query.sql, /OPERACION_CREDITO_SIN_DINERO/);
});

const dialect = new PgDialect();
function spy(rows: Record<string, unknown>[] = []) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx: E5Sql = { execute: async q => { const x = dialect.sqlToQuery(q); queries.push(x); return { rows }; } };
  return { tx, queries };
}
function spySequence(...results: Record<string, unknown>[][]) {
  const queries: { sql: string; params: unknown[] }[] = []; let call = 0;
  const tx: E5Sql = { execute: async q => {
    const x = dialect.sqlToQuery(q); queries.push(x); return { rows: results[call++] ?? [] };
  } };
  return { tx, queries };
}
const deps = { ledger: async () => [], cash: async () => "100.00" };
test("E5-KEY-LOCK-REQUEST", async () => {
  const s = spy(); await e5Repository(s.tx, deps).lockKey(key(1)); assert.match(s.queries[0]!.sql, /pg_advisory_xact_lock/);
});
test("E5-LOAD-FOR-UPDATE", async () => {
  const s = spySequence([{ id: admin.id, rol: admin.rol, ubicacion_id: admin.ubicacionId }], []);
  await e5Repository(s.tx, deps).load(key(1), admin);
  assert.match(s.queries[0]!.sql, /FROM usuarios[\s\S]*FOR SHARE/);
  assert.match(s.queries[1]!.sql, /FROM e5_cobros[\s\S]*FOR UPDATE/);
});
test("E5-SAVE-CAS", async () => {
  const x = await pending(); const s = spy(); await assert.rejects(() => e5Repository(s.tx, deps).save(x.detail, 1), code("E5_VERSION_STALE"));
});
test("E5-E1-CORRECT-PRODUCER", async () => {
  const x = await pending(); const s = spySequence(
    [{ id: admin.id, rol: admin.rol, ubicacion_id: admin.ubicacionId }], [], [], []);
  await e5Repository(s.tx, deps).receive(x.detail, receive(), admin);
  assert.match(s.queries[0]!.sql, /FROM usuarios[\s\S]*FOR SHARE/);
  const e1 = s.queries.filter(q => /operaciones_credito_e1|cobros_credito_pendientes_e1/.test(q.sql));
  assert.equal(e1.length, 2); assert.match(e1[0]!.sql, /COBRO_PENDIENTE/);
});
test("E5-APPLICATION-NO-SECOND-MONEY", async () => {
  const x = await proposed(); const s = spy(); await e5Repository(s.tx, deps).save(x.proposal, null);
  assert.equal(s.queries.some(q => /cobros_credito_pendientes_e1|salidas_dinero_caja/.test(q.sql)), false);
});
test("E5-LIST-SCOPE", async () => {
  const s = spy(); await assert.rejects(() => listE5Cobros(s.tx, cashier, { ubicacionId: 3, limit: 25 }, false, true),
    code("E5_NOT_FOUND")); assert.equal(s.queries.length, 0);
});
test("E5-DOCUMENT-ADMIN-ONLY", async () => {
  const s = spy(); await assert.rejects(() => readE5Document(s.tx, key(1), key(2), cashier, true), code("E5_FORBIDDEN"));
  assert.equal(s.queries.length, 0);
});
test("E5-REFUND-OPTIONS-NO-ORIGINAL-CASH", async () => {
  const x = await pending(); let calls = 0;
  const tx: E5Sql = { execute: async () => ({ rows: calls++ === 0 ? [{ detail: x.detail }] : [] }) };
  const result = await e5RefundOptions(tx, key(1), admin, true);
  assert.equal(result.fuentes.some(f => f.tipo === "CAJA"), false);
});
test("E5-APPEND-AUDIT-PRIVATE", async () => {
  const x = await pending(); const s = spy(); await e5Repository(s.tx, deps).operation(key(8), "DEVOLVER", "{}", x.detail, admin);
  assert.equal(s.queries.length, 2); assert.match(s.queries[1]!.sql, /'FONDO'/);
});