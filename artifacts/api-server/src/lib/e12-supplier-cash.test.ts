import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  payE12, returnE12, e12CashGuard, e12Money, e12Format, omitE12PrivateFields,
  E12_SUPPLIER_CASH_ENABLED,
  type E12Repository, type E12Actor, type E12Input, type E12Detail, type E12Result,
  type E12Payment, type E12ReturnKind,
} from "./e12-supplier-cash";
import { readE12Returns } from "./e12-cash-ledger";
import { e12FondoExecutor } from "./e12-fondo-executor";
import { calculateCash, resolveSessionCash, type CashDocument } from "./caja-cash-ledger";
import { e4CashOutRepository } from "./e4-cash-out-repository";
import { e12CaptureInput, e12NumberAmount, e12ApprovedSplit } from "./e12-http";
import { movimientoProveedorFondoEnTransaccion, type FondoExecutor } from "./fondo";

const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin: E12Actor = { id: 10, nombre: "Actor sintético", rol: "ADMIN", ubicacionId: null, ip: "offline" };
const cashier: E12Actor = { ...admin, id: 11, rol: "CAJA", ubicacionId: 1 };
const input = (caja = "247000.00", fondo = "1000000.00", n = 1): E12Input => ({
  proveedorId: 7, importe: e12Format(e12Money(caja) + e12Money(fondo)),
  split: { claveOperacion: key(n), caja, fondo, ...(caja !== "0.00" ? { sesionCajaId: 1 } : {}) },
});
const recovery = (pagoId: number, n = 2, naturaleza: E12ReturnKind = "RECUPERACION_EFECTIVO") =>
  ({ proveedorId: 7, pagoId, claveOperacion: key(n), naturaleza, motivo: "Retorno sintético documentado" });
/** Synthetic serial transaction model, NOT proof of PostgreSQL locking/DDL. */
class Memory implements E12Repository {
  state = { cash: 30000000n, fund: 110000000n, payments: [] as E12Payment[],
    cashOut: [] as string[], cashIn: [] as string[], fundRows: [] as { amount: string; original?: string; kind?: E12ReturnKind }[],
    details: new Map<number, E12Detail>(), operations: new Map<string, { actorId: number; content: string; result: E12Result }>() };
  closed = false; active = true; failFund = false; currentSession = 1; sessionCalls = 0; fundCalls = 0; lockCalls = 0;
  private queue = Promise.resolve();
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone(this.state);
    try { return await fn(); } catch (error) { this.state = snapshot; throw error; } finally { release(); }
  }
  async lock() { this.lockCalls++; }
  async replay(k: string) { return this.state.operations.get(k); }
  async provider() { return this.active; }
  async session(id: number | null) {
    this.sessionCalls++;
    return { id: id ?? this.currentSession, ubicacionId: 1, estado: this.closed ? "CERRADA" : "ABIERTA" };
  }
  async cashBalance() { return e12Format(this.state.cash); }
  async fundBalance() { this.fundCalls++; return { saldo: e12Format(this.state.fund), versionSaldo: null }; }
  async payment(value: E12Input, actor: E12Actor) {
    const pago: E12Payment = { id: this.state.payments.length + 1, proveedorId: value.proveedorId,
      importe: `-${value.importe}`, tipo: "PAGO", formaPago: "EFECTIVO", fecha: new Date(0), createdAt: new Date(0), usuarioId: actor.id };
    this.state.payments.push(pago); return pago;
  }
  async outflow(_s: number, amount: string) { this.state.cashOut.push(amount); this.state.cash -= e12Money(amount); return this.state.cashOut.length; }
  async fund(amount: string, _key: string, _actor: E12Actor, _reason: string, original?: string, kind?: E12ReturnKind) {
    if (this.failFund) throw new Error("SYNTHETIC_FUND_FAILURE");
    this.state.fundRows.push({ amount, original, kind });
    this.state.fund += e12Money(amount) * (original ? 1n : -1n);
    return key(this.state.fundRows.length + 100);
  }
  async save(detail: E12Detail, actor: E12Actor, k: string, content: string, result: E12Result) {
    this.state.details.set(detail.pagoProveedorId, detail);
    this.state.operations.set(k, { actorId: actor.id, content, result: structuredClone(result) });
  }
  async original(id: number) { return this.state.details.get(id); }
  async reverse(id: number, supplier: number, _reason: string, actor: E12Actor) {
    const original = this.state.payments.find(row => row.id === id)!;
    const pago = { ...original, id: this.state.payments.length + 1, proveedorId: supplier, tipo: "REVERSO", importe: original.importe.slice(1), usuarioId: actor.id };
    this.state.payments.push(pago); return pago;
  }
  async income(_s: number, amount: string) { this.state.cashIn.push(amount); this.state.cash += e12Money(amount); return this.state.cashIn.length; }
  saveReturn = this.save;
}
const pay = (m: Memory, value = input(), actor = admin) => m.transaction(() => payE12(m, actor, value, true));
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
test("E12-OFF-PAY", async () => { const m = new Memory(); await assert.rejects(() => payE12(m, admin, input()), code("E12_DISABLED")); assert.equal(m.lockCalls, 0); });
test("E12-OFF-RETURN", async () => { const m = new Memory(); const p = await pay(m); await assert.rejects(() => returnE12(m, admin, recovery(p.pago.id)), code("E12_DISABLED")); });
test("E12-OFF-READ", async () => { let reads = 0; assert.deepEqual(await readE12Returns({ execute: async () => { reads++; return { rows: [] }; } }, 1), []); assert.equal(reads, 0); });
test("E12-OFF-HTTP", () => { assert.throws(() => e12CaptureInput("EFECTIVO", input().split), code("E12_DISABLED")); });
test("E12-DECIMAL", async () => { const m = new Memory(); const p = await pay(m, input("0.01", "0.02")); assert.equal(p.pago.importe, "-0.03"); assert.deepEqual(m.state.cashOut, ["0.01"]); });
test("E12-PRECISION", () => { assert.throws(() => e12NumberAmount(1.001), code("E12_AMOUNT")); });
test("E12-NEGATIVE", () => { assert.throws(() => e12Money("-0.01"), code("E12_AMOUNT")); });
test("E12-SUM", async () => { const m = new Memory(); await assert.rejects(() => pay(m, { ...input(), importe: "1.00" }), code("E12_SPLIT")); assert.equal(m.state.payments.length, 0); });
test("E12-MIXED-EXAMPLE", async () => { const m = new Memory(); const p = await pay(m); assert.equal(p.pago.importe, "-1247000.00"); assert.deepEqual(m.state.cashOut, ["247000.00"]); assert.equal(m.state.fundRows[0]!.amount, "1000000.00"); assert.equal(m.state.payments.length, 1); });
test("E12-CASH-ONLY", async () => { const m = new Memory(); await pay(m, input("10.00", "0.00"), cashier); assert.equal(m.fundCalls, 0); assert.equal(m.state.fundRows.length, 0); });
test("E12-FUND-NO-SESSION", async () => { const m = new Memory(); m.closed = true; await assert.doesNotReject(() => pay(m, input("0.00", "10.00"))); assert.equal(m.sessionCalls, 0); assert.equal(m.state.cashOut.length, 0); });
test("E12-SESSION", async () => { const m = new Memory(); m.closed = true; await assert.rejects(() => pay(m), code("E12_SESSION_CLOSED")); });
test("E12-SCOPE", async () => { await assert.rejects(() => pay(new Memory(), input("10.00", "0.00"), { ...cashier, ubicacionId: 2 }), code("E12_FORBIDDEN")); });
test("E12-PRIVACY", async () => { const m = new Memory(); await assert.rejects(() => pay(m, input(), cashier), code("E12_FORBIDDEN")); assert.equal(m.fundCalls, 0); });
test("E12-JSON-PRIVACY", () => { const value = { pago: { id: 1, efectivoE12: { fondo: "1000000.00" } }, items: [{ e12DesbloqueoCaja: { motivo: "Motivo" }, pagoProveedorIdE12: 1, monto: "10.00" }] };
  assert.deepEqual(omitE12PrivateFields(value, "CAJA"), { pago: { id: 1 }, items: [{ monto: "10.00" }] }); assert.equal(omitE12PrivateFields(value, "ADMIN"), value);
});
test("E12-PROVIDER", async () => { const m = new Memory(); m.active = false; await assert.rejects(() => pay(m), code("E12_PROVIDER")); });
test("E12-CASH-INSUFFICIENT", async () => { const m = new Memory(); m.state.cash = 0n; await assert.rejects(() => pay(m), code("E12_CAJA_INSUFICIENTE")); });
test("E12-OVERRIDE-ADMIN", async () => { const m = new Memory(); m.state.cash = 0n; const value = input(); value.split.desbloqueoCaja = { motivo: "Excepción motivada" }; const p = await pay(m, value); assert.equal(p.efectivoE12.desbloqueoCaja?.usuarioId, admin.id); assert.equal(m.state.cash, -24700000n); });
test("E12-OVERRIDE-ROLE", () => { assert.throws(() => e12CashGuard("0.00", "1.00", cashier, { motivo: "Intento operador" }), code("E12_FORBIDDEN")); });
test("E12-OVERRIDE-REASON", () => { assert.throws(() => e12CashGuard("0.00", "1.00", admin, { motivo: " " }), code("E12_REASON")); });
test("E12-FUND-INSUFFICIENT", async () => { const m = new Memory(); m.state.fund = 0n; await assert.rejects(() => pay(m), code("E12_FONDO_INSUFICIENTE")); assert.equal(m.state.payments.length, 0); });
test("E12-REPLAY", async () => { const m = new Memory(); const p = await pay(m); m.closed = true; let replay: E12Result | undefined; await assert.doesNotReject(async () => { replay = await pay(m); }); assert.deepEqual(replay, p); assert.equal(m.state.payments.length, 1); });
test("E12-REPLAY-CONTENT", async () => { const m = new Memory(); await pay(m); await assert.rejects(() => pay(m, { ...input(), notas: "Cambio de intención" }), code("E12_IDEMPOTENCY_CONFLICT")); });
test("E12-FAILURE-ROLLBACK", async () => { const m = new Memory(); m.failFund = true; await assert.rejects(() => pay(m), /SYNTHETIC_FUND_FAILURE/); assert.equal(m.state.payments.length, 0); assert.equal(m.state.cashOut.length, 0); assert.equal(m.state.operations.size, 0); });
test("E12-CONCURRENT-MODEL", async () => { const m = new Memory(); m.state.fund = 1000n; const results = await Promise.allSettled([pay(m, input("0.00", "10.00")), pay(m, input("0.00", "10.00", 2))]); assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(m.state.fund, 0n); });
test("E12-RETURN-EXACT", async () => { const m = new Memory(); const p = await pay(m); m.currentSession = 2; const r = await m.transaction(() => returnE12(m, admin, recovery(p.pago.id), true)); assert.equal(r.efectivoE12.retorno?.sesionCajaId, 2); assert.equal(r.efectivoE12.retorno?.caja, "247000.00"); assert.equal(m.state.cash, 30000000n); assert.equal(m.state.fund, 110000000n); });
test("E12-RETURN-KIND", async () => { const m = new Memory(); const p = await pay(m); await m.transaction(() => returnE12(m, admin, recovery(p.pago.id, 2, "CORRECCION_CAPTURA"), true)); assert.equal(m.state.fundRows.at(-1)?.kind, "CORRECCION_CAPTURA"); });
test("E12-RETURN-ONCE", async () => { const m = new Memory(); const p = await pay(m); await m.transaction(() => returnE12(m, admin, recovery(p.pago.id), true)); await assert.rejects(() => m.transaction(() => returnE12(m, admin, recovery(p.pago.id, 3), true)), code("E12_ALREADY_RETURNED")); });
test("E12-RETURN-FUND-ONLY", async () => { const m = new Memory(); const p = await pay(m, input("0.00", "10.00")); m.closed = true; await assert.doesNotReject(() => m.transaction(() => returnE12(m, admin, recovery(p.pago.id), true))); assert.equal(m.sessionCalls, 0); });
test("E12-RETURN-PRIVACY", async () => { const m = new Memory(); const p = await pay(m); await assert.rejects(() => m.transaction(() => returnE12(m, cashier, recovery(p.pago.id), true)), code("E12_FORBIDDEN")); });
test("E12-CASH-RETURNS", () => { const docs: CashDocument[] = [
  { origen: "FONDO_INICIAL", id: "1", folio: null, href: null, importe: "100.00" },
  { origen: "SALIDA", id: "2", folio: null, href: null, importe: "50.00" },
  { origen: "RETORNO_PROVEEDOR", id: "3", folio: null, href: null, importe: "20.00" },
]; const cash = calculateCash(docs); assert.equal(cash.efectivoEsperado, "70.00"); assert.equal(cash.retornosProveedor, "20.00"); });
test("E12-CLOSED-FROZEN", async () => { let reads = 0; const legacy = { efectivoEsperado: "70.00", diferencia: "0.00" }; const result = await resolveSessionCash({ id: 1, estado: "CERRADA", efectivoContado: "70.00" }, [], legacy, async () => { reads++; return calculateCash([]); }); assert.deepEqual(result, legacy); assert.equal(reads, 0); });
test("E12-PARAMETER-ADAPTER", async () => { const dialect = new PgDialect(); let query: { sql: string; params: unknown[] } | undefined;
  const tx = e12FondoExecutor({ execute: async value => { query = dialect.sqlToQuery(value); return { rows: [{ id: 1 }] }; } });
  const dangerous = "'; DELETE FROM fondo_movimientos; --";
  await tx.query("SELECT $1::text motivo, $2::integer actor", [dangerous, 10]);
  assert.equal(query!.sql.includes(dangerous), false); assert.deepEqual(query!.params, [dangerous, 10]);
});
test("E12-E4-DECOUPLED", () => {
  assert.equal(E12_SUPPLIER_CASH_ENABLED, false);
  assert.equal(e4CashOutRepository.length, 1);
});
test("E12-DIRECTED-SOURCE", () => { const source = input().split; const approved = e12ApprovedSplit(source, { claveOperacion: key(2) });
  assert.equal(approved.caja, source.caja); assert.equal(approved.fondo, source.fondo); assert.equal(approved.sesionCajaId, source.sesionCajaId); assert.equal(source.claveOperacion, key(1));
});
test("E12-DIRECTED-NO-REPARTITION", () => { assert.throws(() => e12ApprovedSplit(input().split, { claveOperacion: key(2), caja: "0.00", fondo: "1247000.00" })); });
/** Synthetic SQL executor: exercises actual E10 composition without a pool/driver. */
function fundExecutor(balance = "10000") {
  const queries: string[] = [], inserts: unknown[][] = [];
  let row = { id: key(100), ordinal: "1", fondo_id: key(90), naturaleza: "RETIRO", categoria: "RETIRO",
    importe_centavos: "1000", motivo: "Retiro sintético", autor_id: 10, autor_nombre: admin.nombre,
    original_id: null as string | null, inverso_id: null, created_at: new Date(0), conciliacion_inicial: null };
  const tx: FondoExecutor = { async query<T>(text: string, values: readonly unknown[] = []) {
    queries.push(text);
    let rows: unknown[] = [];
    if (text.includes("FROM fondo_mariana")) rows = [{ id: key(90), ubicacion_id: 1, ubicacion_nombre: "Mariana" }];
    else if (text.includes("COALESCE(SUM")) rows = [{ saldo: balance, version: key(100), total: "1", ultima_fecha: new Date(0) }];
    else if (text.includes("INSERT INTO fondo_movimientos")) {
      inserts.push([...values]);
      row = { ...row, id: key(101), naturaleza: String(values[1]), categoria: String(values[2]), importe_centavos: String(values[3]),
        original_id: text.includes("autor_id,original_id") ? String(values[6]) : null };
      rows = [{ id: row.id }];
    } else if (text.includes("SELECT m.id,m.ordinal")) rows = [row];
    return { rows: rows as T[] };
  } };
  return { tx, queries, inserts };
}
test("E12-FONDO-SAME-TRANSACTION", async () => {
  const fake = fundExecutor();
  const result = await movimientoProveedorFondoEnTransaccion(fake.tx, admin, { importe: "10.00", clave: key(5), motivo: "Pago sintético" });
  assert.equal(result.value.importeFirmado, "-10.00"); assert.equal(fake.inserts.length, 1);
  assert.equal(fake.queries.some(q => /\b(BEGIN|COMMIT|ROLLBACK)\b/.test(q)), false);
  assert.ok(fake.queries.some(q => q.includes("pg_advisory_xact_lock")));
});
test("E12-FONDO-RECOVERY-PHYSICAL", async () => {
  const fake = fundExecutor();
  const result = await movimientoProveedorFondoEnTransaccion(fake.tx, admin, { importe: "10.00", clave: key(5), motivo: "Recuperación real sintética", original: key(100), naturalezaRetorno: "RECUPERACION_EFECTIVO" });
  assert.equal(result.value.naturaleza, "INGRESO"); assert.equal(result.value.esInverso, false); assert.equal(result.value.advertencia, null);
});
test("E12-FONDO-CORRECTION-NOT-PHYSICAL", async () => {
  const fake = fundExecutor();
  const result = await movimientoProveedorFondoEnTransaccion(fake.tx, admin, { importe: "10.00", clave: key(5), motivo: "Error sintético", original: key(100), naturalezaRetorno: "CORRECCION_CAPTURA" });
  assert.equal(result.value.originalId, key(100)); assert.equal(result.value.esInverso, true); assert.match(result.value.advertencia!, /no representa un movimiento físico/);
});
test("E12-FONDO-REAL-WITHDRAWAL-GUARD", async () => {
  const fake = fundExecutor("0");
  await assert.rejects(() => movimientoProveedorFondoEnTransaccion(fake.tx, admin, { importe: "10.00", clave: key(5), motivo: "Insuficiencia sintética" }), code("FONDO_SALDO_INSUFICIENTE"));
  assert.equal(fake.inserts.length, 0);
});