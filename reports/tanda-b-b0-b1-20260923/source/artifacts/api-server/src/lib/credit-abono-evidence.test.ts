import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREDIT_ABONO_REFUND_EVIDENCE_ENABLED,
  assertAbonoEvidencePolicy,
  evaluateAbonoEvidence,
  finalizePhysicalAbonoEvidenceCore,
} from "./credit-abono-evidence";

test("A+C evidence remains closed by default and blocks a covered receipt", () => {
  assert.equal(CREDIT_ABONO_REFUND_EVIDENCE_ENABLED, false);
  assert.throws(() => assertAbonoEvidencePolicy(true, false), /captura física permanece bloqueada/);
  assert.doesNotThrow(() => assertAbonoEvidencePolicy(false, false));
});

test("canonical allocations classify whole receipt without changing FIFO", () => {
  assert.deepEqual(evaluateAbonoEvidence(10_000, []), {
    result: "UNUSED", receiptCents: 10_000, appliedCents: 0, allocations: [],
  });
  assert.equal(evaluateAbonoEvidence(10_000, [
    { targetId: 7, appliedCents: 2_500 },
  ]).result, "PARTIAL");
  assert.equal(evaluateAbonoEvidence(10_000, [
    { targetId: 7, appliedCents: 2_500 },
    { targetId: 8, appliedCents: 7_500 },
  ]).result, "FULL");
});

test("invalid or excessive allocation evidence fails closed", () => {
  assert.throws(() => evaluateAbonoEvidence(0, []));
  assert.throws(() => evaluateAbonoEvidence(100, [{ targetId: 1, appliedCents: 101 }]));
  assert.throws(() => evaluateAbonoEvidence(100, [{ targetId: 0, appliedCents: 100 }]));
});

test("enabled covered receipt persists one finalization; non-cash stays unchanged", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const store = { async finalize(input: Record<string, unknown>) { writes.push(input); } };
  const base = {
    movementId: 41,
    productor: "ABONO_ORDINARIO" as const,
    formaPago: "EFECTIVO",
    cuentaDestino: "CAJA_FISICA",
    evidence: {
      sitioOrigenId: 2, sesionCajaId: 7, naturaleza: "INGRESO_FISICO" as const,
      operacionClave: "20000000-0000-4000-8000-000000000001",
    },
    evaluation: evaluateAbonoEvidence(500, []),
  };
  await finalizePhysicalAbonoEvidenceCore(store, base, true);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0]?.result, "UNUSED");
  assert.equal((writes[0]?.evaluation as Record<string, unknown>).projector, "projectCreditLedger");
  await finalizePhysicalAbonoEvidenceCore(store, {
    ...base, formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL",
  }, false);
  assert.equal(writes.length, 1);
});
test("directed provenance describes its full explicit application, never UNUSED or PARTIAL", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const store = { async finalize(input: Record<string, unknown>) { writes.push(input); } };
  const base = {
    movementId: 42, productor: "ABONO_DIRIGIDO" as const,
    formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
    evidence: {
      sitioOrigenId: 2, sesionCajaId: 7, naturaleza: "INGRESO_FISICO" as const,
      operacionClave: "20000000-0000-4000-8000-000000000002",
    },
  };
  for (const evaluation of [
    evaluateAbonoEvidence(500, []),
    evaluateAbonoEvidence(500, [{ targetId: 9, appliedCents: 250 }]),
    { ...evaluateAbonoEvidence(500, []), result: "FULL" as const },
  ]) {
    await assert.rejects(finalizePhysicalAbonoEvidenceCore(store, { ...base, evaluation }, true), /dirigida.*FULL/);
  }
  assert.equal(writes.length, 0);
  await finalizePhysicalAbonoEvidenceCore(store, {
    ...base, evaluation: evaluateAbonoEvidence(500, [{ targetId: 9, appliedCents: 500 }]),
  }, true);
  assert.equal((writes[0]?.evaluation as Record<string, unknown>).projector, "directedApplication");
});

test("finalization failure propagates so the surrounding transaction can roll back", async () => {
  await assert.rejects(finalizePhysicalAbonoEvidenceCore({
    async finalize() { throw new Error("synthetic evidence failure"); },
  }, {
    movementId: 42,
    productor: "ABONO_DIRIGIDO",
    formaPago: "EFECTIVO",
    cuentaDestino: "CAJA_FISICA",
    evidence: {
      sitioOrigenId: 2, sesionCajaId: 7, naturaleza: "INGRESO_FISICO",
      operacionClave: "20000000-0000-4000-8000-000000000002",
    },
    evaluation: evaluateAbonoEvidence(500, [{ targetId: 9, appliedCents: 500 }]),
  }, true), /synthetic evidence failure/);
});

test("ordinary and directed producers finalize only after existing applications", () => {
  const ordinary = readFileSync(new URL("../routes/clientes.ts", import.meta.url), "utf8");
  const directed = readFileSync(new URL("../routes/pagos-dirigidos.ts", import.meta.url), "utf8");
  const ordinaryInsert = ordinary.indexOf("tx.insert(aplicacionesCreditoTable)");
  const ordinaryFinalize = ordinary.indexOf("finalizePhysicalAbonoEvidence", ordinaryInsert);
  assert.ok(ordinaryInsert >= 0 && ordinaryFinalize > ordinaryInsert);
  const directedInsert = directed.indexOf("tx.insert(aplicacionesCreditoTable)");
  const directedFinalize = directed.indexOf("finalizePhysicalAbonoEvidence", directedInsert);
  assert.ok(directedInsert >= 0 && directedFinalize > directedInsert);
  assert.match(directed.slice(directedInsert, directedFinalize), /importe: amount/);
  assert.match(ordinary, /loadCustomerCreditProjectionInTransaction[\s\S]*projection\.allocations[\s\S]*finalizePhysicalAbonoEvidence/);
});

test("refund consumer requires both positive proof and UNUSED finalization", () => {
  const source = readFileSync(new URL("./credit-refund.ts", import.meta.url), "utf8");
  assert.match(source, /JOIN finalizaciones_abono_e2 f ON f\.abono_id=p\.abono_id AND f\.resultado='UNUSED'/);
  assert.match(source, /origen aplicado históricamente/);
  assert.match(source, /hook anterior no puede atestar indiscriminadamente/);
});

test("limited startup binds income activation to the A+C catalog preflight", () => {
  const startup = readFileSync(new URL("./startup-mode.ts", import.meta.url), "utf8");
  const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  const preflight = readFileSync(new URL("./limited-startup-preflight.ts", import.meta.url), "utf8");
  assert.match(startup, /incomeCapture !== creditFeatures\.abonoEvidence/);
  assert.match(index, /requireAbonoEvidence: CREDIT_ABONO_REFUND_EVIDENCE_ENABLED/);
  assert.match(preflight, /ABONO_EVIDENCE_COLUMNS/);
  assert.match(preflight, /e2_abono_finalization_complete/);
  assert.match(preflight, /e2_finalize_new_abono/);
});