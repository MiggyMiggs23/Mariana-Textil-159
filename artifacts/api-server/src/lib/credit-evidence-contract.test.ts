import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CREDIT_NATURES, CREDIT_PENDING_RECEIPTS_ENABLED, CREDIT_CASH_CAPTURE_ENABLED,
  CreditEvidenceError, readCreditEvidenceInput, canonicalCreditMoney, canonicalCreditContent,
  assertCreditProducerNature, assertCreditPhysicalContext, assertCreditCaptureEnabled,
  assertCreditActorAccess, claimCreditOperationCore,
  type CreditOperationClaim, type CreditOperationRecord, type CreditOperationStore,
} from "./credit-evidence-contract";

// Offline only: imports no @workspace/db, application, server, fixtures or pool.
// Parent's targeted mutant pass must alter the named production branches below;
// none of these tests or mutants has been executed by the implementing agent.
const key = "10000000-0000-4000-8000-000000000001";
const evidence = () => readCreditEvidenceInput({
  sitioOrigenId: 2, naturaleza: "CORRECCION_CONTABLE", operacionClave: key,
  origenJustificacion: "Recaptura documentada",
});
const status = (expected: number) => (error: unknown) => error instanceof CreditEvidenceError && error.status === expected;

test("E1 required metadata rejects legacy, malformed ids, UUIDs and unknown nature", () => {
  for (const body of [null, {}, { ...evidence(), sitioOrigenId: null }, { ...evidence(), sitioOrigenId: "2" },
    { ...evidence(), operacionClave: "invalid" }, { ...evidence(), naturaleza: ["INGRESO_FISICO"] },
    { ...evidence(), naturaleza: "OPERACION_CREDITO_SIN_MOVIMIENTO_DINERO" }]) {
    assert.throws(() => readCreditEvidenceInput(body), status(400));
  }
  assert.throws(() => readCreditEvidenceInput({}), /Actualiza la aplicación/);
});

test("E1 evidence parser whitelists and normalizes without credentials", () => {
  const parsed = readCreditEvidenceInput({
    ...evidence(), operacionClave: key.toUpperCase(), origenJustificacion: "  evidencia  ",
    password: "not-persisted", credencialesAdmin: { password: "not-persisted" }, sessionToken: "not-persisted",
  });
  assert.deepEqual(parsed, { ...evidence(), origenJustificacion: "evidencia" });
  assert.equal(canonicalCreditContent(parsed).includes("not-persisted"), false);
});

test("E1 four exact natures and seven-producer compatibility cannot default to correction", () => {
  assert.deepEqual(CREDIT_NATURES, ["INGRESO_FISICO", "DEVOLUCION_FISICA", "CORRECCION_CONTABLE", "OPERACION_CREDITO_SIN_DINERO"]);
  for (const productor of ["VENTA_CREDITO", "CANCELACION_VENTA_CREDITO"] as const) {
    assert.doesNotThrow(() => assertCreditProducerNature(productor, "OPERACION_CREDITO_SIN_DINERO"));
    assert.throws(() => assertCreditProducerNature(productor, "CORRECCION_CONTABLE"), status(400));
  }
  for (const productor of ["AJUSTE_MANUAL", "BAJA_INCOBRABLE"] as const) {
    assert.doesNotThrow(() => assertCreditProducerNature(productor, "CORRECCION_CONTABLE"));
    assert.throws(() => assertCreditProducerNature(productor, "INGRESO_FISICO"), status(400));
  }
  for (const productor of ["ABONO_ORDINARIO", "ABONO_DIRIGIDO"] as const) {
    assert.doesNotThrow(() => assertCreditProducerNature(productor, "INGRESO_FISICO"));
    assert.throws(() => assertCreditProducerNature(productor, "DEVOLUCION_FISICA"), status(400));
  }
  assert.doesNotThrow(() => assertCreditProducerNature("REVERSO_ABONO", "DEVOLUCION_FISICA"));
  assert.throws(() => assertCreditProducerNature("REVERSO_ABONO", "INGRESO_FISICO"), status(400));
});

test("E1 exact money normalization rejects rounding and overflow", () => {
  assert.equal(canonicalCreditMoney("00012.3"), "12.30");
  assert.equal(canonicalCreditMoney(12.3), "12.30");
  assert.equal(canonicalCreditMoney("-0.00"), "0.00");
  assert.equal(canonicalCreditMoney("-12.30"), "-12.30");
  for (const amount of [NaN, Infinity, "1.005", "10000000000", "1e3", null]) {
    assert.throws(() => canonicalCreditMoney(amount), status(400));
  }
});

test("E1 canonical JSON recursively sorts keys and preserves intent order and exact instants", () => {
  const a = { z: [{ c: 2, a: 1 }], amount: canonicalCreditMoney("12.3"), date: new Date("2026-09-17T12:00:00-06:00") };
  const b = { date: "2026-09-17T18:00:00.000Z", amount: canonicalCreditMoney(12.30), z: [{ a: 1, c: 2 }] };
  assert.equal(canonicalCreditContent(a), canonicalCreditContent(b));
  assert.notEqual(canonicalCreditContent({ x: [1, 2] }), canonicalCreditContent({ x: [2, 1] }));
  assert.notEqual(canonicalCreditContent({ monto: "12.30" }), canonicalCreditContent({ monto: "12.31" }));
});

test("E1 canonical JSON rejects secrets, undefined, cycles and nonfinite values", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const value of [{ password: "x" }, { nested: { credencialesAdmin: {} } }, { sessionToken: "x" },
    { x: undefined }, { x: NaN }, { x: new Date("bad") }, cyclic, { x: new Map() }]) {
    assert.throws(() => canonicalCreditContent(value), status(400));
  }
});

test("E1 correction never invents cash session; physical bank transfer never accepts drawer", () => {
  assert.doesNotThrow(() => assertCreditPhysicalContext(evidence(), "EFECTIVO", "CAJA_FISICA"));
  assert.throws(() => assertCreditPhysicalContext({ ...evidence(), sesionCajaId: 8 }, "EFECTIVO", "CAJA_FISICA"), status(400));
  assert.throws(() => assertCreditPhysicalContext({ ...evidence(), origenJustificacion: null }, "TRANSFERENCIA", "CUENTA_FISCAL"), status(400));
  const physical = { ...evidence(), naturaleza: "INGRESO_FISICO" as const };
  assert.doesNotThrow(() => assertCreditPhysicalContext(physical, "TRANSFERENCIA", "CUENTA_FISCAL"));
  assert.throws(() => assertCreditPhysicalContext(physical, "TRANSFERENCIA", "CAJA_FISICA"), status(400));
  assert.throws(() => assertCreditPhysicalContext({ ...physical, sesionCajaId: 8 }, "FACTURADO", "CUENTA_NO_FISCAL"), status(400));
  assert.throws(() => assertCreditPhysicalContext(physical, "EFECTIVO", "CAJA_FISICA"), status(400));
  assert.throws(() => assertCreditPhysicalContext(physical, "CHEQUE", "CUENTA_FISCAL"), status(400));
});

test("E1 new physical cash receipt and refund remain closed, correction is not physical cash", () => {
  assert.equal(CREDIT_CASH_CAPTURE_ENABLED, false);
  assert.equal(CREDIT_PENDING_RECEIPTS_ENABLED, false);
  for (const naturaleza of ["INGRESO_FISICO", "DEVOLUCION_FISICA"] as const) {
    assert.throws(() => assertCreditCaptureEnabled({ ...evidence(), naturaleza, sesionCajaId: 8 }, "EFECTIVO"), status(403));
  }
  assert.doesNotThrow(() => assertCreditCaptureEnabled(evidence(), "EFECTIVO"));
});

test("E1 current actor/site access rejects role, inactive actor and moved site even on replay", () => {
  assert.doesNotThrow(() => assertCreditActorAccess({ activo: true, rol: "ADMIN", ubicacionId: null }, 2));
  assert.doesNotThrow(() => assertCreditActorAccess({ activo: true, rol: "CAJA", ubicacionId: 2 }, 2));
  for (const actor of [null, { activo: false, rol: "ADMIN", ubicacionId: 2 },
    { activo: true, rol: "CONTADOR", ubicacionId: 2 }, { activo: true, rol: "SISTEMAS", ubicacionId: 2 },
    { activo: true, rol: "SUPERVISOR", ubicacionId: 3 }]) {
    assert.throws(() => assertCreditActorAccess(actor, 2), status(403));
  }
});

function storeFixture() {
  const records = new Map<string, CreditOperationRecord>();
  const movements = new Map<string, { id: number }>();
  let writes = 0;
  const store: CreditOperationStore<{ id: number }> = {
    async loadOperation(producer, id) { return records.get(`${producer}:${id}`) ?? null; },
    async insertOperation(record) {
      const index = `${record.productor}:${record.clave}`;
      if (records.has(index)) return false;
      records.set(index, record);
      writes++;
      return true;
    },
    async loadMovement(producer, id) { return movements.get(`${producer}:${id}`) ?? null; },
  };
  const input: CreditOperationClaim = {
    productor: "ABONO_ORDINARIO", clave: key, naturaleza: "CORRECCION_CONTABLE",
    actorId: 9, contenido: { clienteId: 7, importe: "10.00", evidencia: evidence() },
  };
  return { store, input, records, movements, writes: () => writes };
}

test("E1 same content replays original result before repeated domain validation/side effects", async () => {
  const fixture = storeFixture();
  let effects = 0;
  let sessionOpen = true;
  async function operation() {
    const claim = await claimCreditOperationCore(fixture.store, fixture.input);
    if (claim.replay) return claim.movement;
    assert.equal(sessionOpen, true);
    effects++;
    const movement = { id: 71 };
    fixture.movements.set(`${fixture.input.productor}:${key}`, movement);
    return movement;
  }
  assert.deepEqual(await operation(), { id: 71 });
  sessionOpen = false;
  assert.deepEqual(await operation(), { id: 71 });
  assert.equal(effects, 1);
  assert.equal(fixture.writes(), 1);
});

test("E1 equal UUID across producers is isolated, not deduplicated by nature or UUID alone", async () => {
  const fixture = storeFixture();
  assert.equal((await claimCreditOperationCore(fixture.store, fixture.input)).replay, false);
  assert.equal((await claimCreditOperationCore(fixture.store, { ...fixture.input, productor: "ABONO_DIRIGIDO" })).replay, false);
  assert.equal(fixture.writes(), 2);
});

test("E1 reused key with changed amount, actor, metadata or nature conflicts", async () => {
  const fixture = storeFixture();
  await claimCreditOperationCore(fixture.store, fixture.input);
  fixture.movements.set(`${fixture.input.productor}:${key}`, { id: 71 });
  for (const changed of [
    { ...fixture.input, actorId: 10 },
    { ...fixture.input, naturaleza: "INGRESO_FISICO" as const },
    { ...fixture.input, contenido: { ...fixture.input.contenido, importe: "10.01" } },
    { ...fixture.input, contenido: { ...fixture.input.contenido, evidencia: { ...evidence(), sitioOrigenId: 3 } } },
  ]) await assert.rejects(() => claimCreditOperationCore(fixture.store, changed), status(409));
  assert.equal(fixture.writes(), 1);
});

test("E1 ON CONFLICT loser reloads immutable winner instead of repeating writes", async () => {
  const fixture = storeFixture();
  await claimCreditOperationCore(fixture.store, fixture.input);
  fixture.movements.set(`${fixture.input.productor}:${key}`, { id: 71 });
  let reads = 0;
  const racingStore = {
    ...fixture.store,
    async loadOperation(producer: CreditOperationClaim["productor"], id: string) {
      if (++reads === 1) return null; // another transaction commits between lookup and INSERT
      return fixture.store.loadOperation(producer, id);
    },
  };
  const replay = await claimCreditOperationCore(racingStore, fixture.input);
  assert.deepEqual(replay, { replay: true, movement: { id: 71 } });
  assert.equal(fixture.writes(), 1);
});

test("E1 committed operation without movement fails explicitly, never stub success", async () => {
  const fixture = storeFixture();
  await claimCreditOperationCore(fixture.store, fixture.input);
  await assert.rejects(() => claimCreditOperationCore(fixture.store, fixture.input), status(409));
});

test("E1 retained receipt gate rejects before any storage call and never becomes an ABONO", async () => {
  let calls = 0;
  const store: CreditOperationStore<never> = {
    async loadOperation() { calls++; throw new Error("forbidden"); },
    async insertOperation() { calls++; throw new Error("forbidden"); },
    async loadMovement() { calls++; throw new Error("forbidden"); },
  };
  await assert.rejects(() => claimCreditOperationCore(store, {
    productor: "COBRO_PENDIENTE", clave: key, naturaleza: "INGRESO_FISICO", actorId: 9, contenido: { importe: "10.00" },
  }), status(403));
  assert.equal(calls, 0);
});