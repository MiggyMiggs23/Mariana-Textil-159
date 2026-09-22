import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendCreditAttribution,
  assertAttributionSiteScope,
  assertHistoricalAttributionGate,
  assertHistoricalPreparationAccess,
  assertMovementIdentity,
  buildCreditEvidenceReadQuery,
  CREDIT_HISTORICAL_ATTRIBUTION_ENABLED,
  CreditAttributionError,
  loadCreditEvidence,
  presentCreditEvidence,
  readAttributionInput,
  type AttributionInput,
  type CreditAttribution,
  type CreditEvidenceRow,
  type EvidenceActor,
  type EvidenceDatabase,
} from "./credit-evidence-read";

// Entirely in-memory fixtures. This module imports no application/database code.
const admin: EvidenceActor = { id: 7, rol: "ADMIN", activo: true, ubicacionId: null };
const supervisor: EvidenceActor = { id: 8, rol: "SUPERVISOR", activo: true, ubicacionId: 2 };
const input: AttributionInput = {
  id: "11111111-1111-4111-8111-111111111111",
  movimientoId: 91,
  movimientoCreatedAt: "2026-09-15 12:30:00.123456+00",
  identidadSnapshot: {
    cliente_id: 10, tipo: "ABONO", importe: -25000,
    ticket_id: null, movimiento_origen_id: null,
  },
  sitioOrigenId: 2,
  evidencia: "Documento físico conservado por el propietario",
  motivo: "Atribución documentada",
  anteriorId: null,
};
const original: CreditEvidenceRow = {
  movimientoId: input.movimientoId,
  movimientoCreatedAt: input.movimientoCreatedAt,
  identidadSnapshot: input.identidadSnapshot,
  sitioOrigenOriginalId: null,
  naturalezaOriginal: null,
  ultimaAtribucion: null,
  sitioNombre: null,
};
const stored: CreditAttribution = {
  ...input, usuarioId: admin.id, createdAt: "2026-09-17 12:31:00.654321+00",
};
const isStatus = (status: number) => (error: unknown) =>
  error instanceof CreditAttributionError && error.status === status;

type ExpectedQuery = { contains: string; rows: unknown[]; inspect?: (values: readonly unknown[]) => void };
function mockDatabase(steps: ExpectedQuery[]) {
  const calls: { text: string; values: readonly unknown[] }[] = [];
  const database: EvidenceDatabase = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      const step = steps[calls.length];
      assert.ok(step, `Unexpected query: ${text}`);
      assert.ok(text.includes(step.contains), `Expected ${step.contains}, got ${text}`);
      calls.push({ text, values });
      step.inspect?.(values);
      return { rows: step.rows as T[] };
    },
  };
  return { database, calls, done: () => assert.equal(calls.length, steps.length) };
}

test("attribution remains closed for ADMIN and SUPERVISOR; roles fail first", () => {
  assert.equal(CREDIT_HISTORICAL_ATTRIBUTION_ENABLED, false);
  for (const actor of [admin, supervisor]) {
    assert.throws(() => assertHistoricalAttributionGate(actor), (error: unknown) =>
      isStatus(403)(error) && (error as Error).message.includes("deshabilitada"));
  }
  for (const rol of ["CAJA", "VENTAS", "CONTADOR", "ALMACEN", "CHOFER"]) {
    assert.throws(() => assertHistoricalAttributionGate({ ...admin, rol }), (error: unknown) =>
      isStatus(403)(error) && (error as Error).message.includes("Sólo ADMIN"));
  }
  assert.throws(() => assertHistoricalAttributionGate({ ...admin, activo: false }), isStatus(403));
});

test("unknown historical preparation requires privileged role AND existing credit access", () => {
  assert.doesNotThrow(() => assertHistoricalPreparationAccess(admin, true));
  assert.doesNotThrow(() => assertHistoricalPreparationAccess(supervisor, true));
  assert.throws(() => assertHistoricalPreparationAccess(admin, false), isStatus(403));
  assert.throws(() => assertHistoricalPreparationAccess({ ...admin, rol: "CAJA" }, true), isStatus(403));
});

test("supervisor attribution is limited to assigned site even with global read scope", () => {
  assert.doesNotThrow(() => assertAttributionSiteScope(supervisor, 2));
  assert.doesNotThrow(() => assertAttributionSiteScope(admin, 3));
  assert.throws(() => assertAttributionSiteScope(supervisor, 3), isStatus(403));
  assert.throws(() => assertAttributionSiteScope({ ...supervisor, ubicacionId: null }, 2), isStatus(403));
});

test("whitelisted required evidence rejects credentials, missing predecessor and truncated identity", () => {
  assert.deepEqual(readAttributionInput(input), input);
  for (const patch of [
    { anteriorId: undefined }, { evidencia: " " }, { motivo: "" },
    { movimientoCreatedAt: "2026-09-15T12:30:00.123Z" },
    { identidadSnapshot: { cliente_id: 10, importe: -25000 } },
    { identidadSnapshot: { ...input.identidadSnapshot, usuario_id: 7 } },
    { identidadSnapshot: { ...input.identidadSnapshot, importe: "-25000" } },
    { password: "never-stored" }, { adminPassword: "never-stored" },
    { sessionToken: "never-stored" }, { naturaleza: "INGRESO_FISICO" },
  ]) {
    assert.throws(() => readAttributionInput({ ...input, ...patch }), isStatus(400));
  }
});

test("exact timestamp and all five snapshot fields prevent movement ID reuse", () => {
  assert.doesNotThrow(() => assertMovementIdentity(original, input, 10));
  const wrongInputs = [
    { ...input, movimientoCreatedAt: "2026-09-15 12:30:00.123457+00" },
    { ...input, movimientoId: 92 },
    ...[
      { cliente_id: 11 }, { tipo: "AJUSTE" }, { importe: -24999.99 },
      { ticket_id: 15 }, { movimiento_origen_id: 8 },
    ].map((patch) => ({ ...input, identidadSnapshot: { ...input.identidadSnapshot, ...patch } })),
  ];
  for (const wrong of wrongInputs) {
    assert.throws(() => assertMovementIdentity(original, wrong, 10), isStatus(409));
  }
  assert.throws(() => assertMovementIdentity(original, input, 11), isStatus(409));
});

test("read evidence never infers original site/nature and excludes unknown from ordinary scope", () => {
  assert.equal(presentCreditEvidence(original, { sitioIds: null, incluirHistoricosSinSitio: false }), null);
  const presented = presentCreditEvidence(original, { sitioIds: [2], incluirHistoricosSinSitio: true });
  assert.equal(presented?.sitioEtiqueta, "Sin sitio determinado");
  assert.equal(presented?.sitioOrigenOriginalId, null);
  assert.equal(presented?.naturalezaOriginal, null);
  assert.equal(presented?.movimientoCreatedAt, "2026-09-15 12:30:00.123456+00");
});

test("latest attribution is separate and cross-site latest attribution is not leaked", () => {
  const row = { ...original, ultimaAtribucion: stored, sitioNombre: "Tienda 2" };
  const result = presentCreditEvidence(row, { sitioIds: [2], incluirHistoricosSinSitio: false });
  assert.equal(result?.sitioOrigenOriginalId, null);
  assert.equal(result?.naturalezaOriginal, null);
  assert.equal(result?.ultimaAtribucion?.id, input.id);
  assert.equal(result?.sitioDeterminadoId, 2);
  assert.equal(presentCreditEvidence(row, { sitioIds: [3], incluirHistoricosSinSitio: true }), null);
  assert.throws(() => presentCreditEvidence({
    ...row, ultimaAtribucion: { ...stored, movimientoCreatedAt: "2026-09-15 12:30:00.123457+00" },
  }, { sitioIds: [2], incluirHistoricosSinSitio: true }), isStatus(409));
});

test("read loader applies defensive scope to returned rows and exposes disabled activation", async () => {
  const mock = mockDatabase([{
    contains: "LEFT JOIN LATERAL",
    rows: [original, { ...original, ultimaAtribucion: stored }],
    inspect(values) { assert.deepEqual(values, [10, [3], false]); },
  }]);
  const result = await loadCreditEvidence(mock.database, 10,
    { sitioIds: [3], incluirHistoricosSinSitio: false });
  assert.deepEqual(result, { clienteId: 10, atribucionHabilitada: false, movimientos: [] });
  mock.done();
  // Supplementary structural guard, not the sole evidence for read behavior.
  const query = buildCreditEvidenceReadQuery(10, { sitioIds: [2], incluirHistoricosSinSitio: true });
  assert.ok(query.text.includes("a.movimiento_created_at=m.created_at"));
  assert.ok(query.text.includes("a.identidad_snapshot=jsonb_build_object"));
  assert.ok(query.text.includes("AT TIME ZONE 'UTC')::text"));
  assert.ok(query.text.includes('=ANY($2::int[])'));
});

test("identical UUID replay precedes original/site/chain checks and has no INSERT", async () => {
  const mock = mockDatabase([
    { contains: "pg_advisory_xact_lock", rows: [] },
    { contains: "WHERE a.id=$1::uuid", rows: [stored] },
  ]);
  const result = await appendCreditAttribution(mock.database, admin, 10, input);
  assert.deepEqual(result, { replay: true, atribucion: stored });
  mock.done(); // Any mutable-state query would fail the mock before this assertion.
});

test("UUID replay conflicts on changed content or actor, without business writes", async () => {
  for (const changed of [
    { ...input, evidencia: "Otro documento" }, { ...input, motivo: "Otro motivo" },
    { ...input, sitioOrigenId: 3 }, { ...input, anteriorId: input.id },
    { ...input, movimientoCreatedAt: "2026-09-15 12:30:00.123457+00" },
    { ...input, identidadSnapshot: { ...input.identidadSnapshot, importe: -1 } },
  ]) {
    const mock = mockDatabase([
      { contains: "pg_advisory_xact_lock", rows: [] },
      { contains: "WHERE a.id=$1::uuid", rows: [stored] },
    ]);
    await assert.rejects(appendCreditAttribution(mock.database, admin, 10, changed), isStatus(409));
    mock.done();
  }
  const mock = mockDatabase([
    { contains: "pg_advisory_xact_lock", rows: [] },
    { contains: "WHERE a.id=$1::uuid", rows: [stored] },
  ]);
  await assert.rejects(appendCreditAttribution(mock.database, { ...admin, id: 99 }, 10, input), isStatus(409));
});

function newAppendSteps(row: CreditEvidenceRow = original): ExpectedQuery[] {
  return [
    { contains: "pg_advisory_xact_lock", rows: [] },
    { contains: "WHERE a.id=$1::uuid", rows: [] },
    { contains: "pg_advisory_xact_lock", rows: [] },
    { contains: "FROM movimientos_credito m WHERE m.id=$1 FOR SHARE", rows: [row] },
  ];
}

test("new attribution validates snapshot before insertion and rejects nonhistorical original", async () => {
  for (const row of [
    { ...original, movimientoCreatedAt: "2026-09-15 12:30:00.123457+00" },
    { ...original, sitioOrigenOriginalId: 2 },
    { ...original, identidadSnapshot: { ...input.identidadSnapshot, ticket_id: 99 } },
  ]) {
    const mock = mockDatabase(newAppendSteps(row));
    await assert.rejects(appendCreditAttribution(mock.database, admin, 10, input), isStatus(409));
    mock.done();
  }
});

test("root append inserts only attribution with exact identity and no monetary/session row", async () => {
  const mock = mockDatabase([
    ...newAppendSteps(),
    { contains: "FROM ubicaciones", rows: [{ id: 2 }] },
    { contains: "WHERE a.movimiento_id=$1", rows: [] },
    {
      contains: "INSERT INTO atribuciones_credito_e1 AS a",
      rows: [stored],
      inspect(values) {
        assert.deepEqual(values, [
          input.id, 91, "2026-09-15 12:30:00.123456+00",
          JSON.stringify(input.identidadSnapshot), 2, input.evidencia, input.motivo, 7, null,
        ]);
      },
    },
  ]);
  assert.deepEqual(await appendCreditAttribution(mock.database, admin, 10, input),
    { replay: false, atribucion: stored });
  mock.done();
  assert.equal(mock.calls.filter((call) => call.text.startsWith("INSERT")).length, 1);
  assert.ok(mock.calls.every((call) => !/\bUPDATE\b|\bDELETE\b/.test(call.text)));
});

test("rectification requires current head, keeps predecessor intact and replays old root", async () => {
  const next = { ...input, id: "22222222-2222-4222-8222-222222222222", anteriorId: stored.id };
  const nextStored = { ...stored, ...next };
  const mock = mockDatabase([
    ...newAppendSteps(),
    { contains: "FROM ubicaciones", rows: [{ id: 2 }] },
    { contains: "WHERE a.movimiento_id=$1", rows: [stored] },
    { contains: "INSERT INTO atribuciones_credito_e1", rows: [nextStored] },
  ]);
  assert.equal((await appendCreditAttribution(mock.database, admin, 10, next)).replay, false);
  mock.done();
  const stale = mockDatabase([
    ...newAppendSteps(),
    { contains: "FROM ubicaciones", rows: [{ id: 2 }] },
    { contains: "WHERE a.movimiento_id=$1", rows: [stored, nextStored] },
  ]);
  await assert.rejects(appendCreditAttribution(stale.database, admin, 10,
    { ...next, id: "33333333-3333-4333-8333-333333333333" }), isStatus(409));
  stale.done();
});

test("missing/invalid site and cross-site actor cannot cause an attribution insert", async () => {
  const noCalls = mockDatabase([]);
  await assert.rejects(appendCreditAttribution(noCalls.database, supervisor, 10,
    { ...input, sitioOrigenId: 3 }), isStatus(403));
  noCalls.done();
  const missingSite = mockDatabase([
    ...newAppendSteps(), { contains: "FROM ubicaciones", rows: [] },
  ]);
  await assert.rejects(appendCreditAttribution(missingSite.database, admin, 10, input), isStatus(400));
  missingSite.done();
});