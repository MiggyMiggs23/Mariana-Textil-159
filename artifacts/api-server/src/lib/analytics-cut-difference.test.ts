import assert from "node:assert/strict";
import test from "node:test";
import { analyticsCutDifference } from "./analytics-cut-difference";
import { calculateCash } from "./caja-cash-ledger";

test("commercial refund cash cut uses frozen actual outflow, not live ticket-only arithmetic", () => {
  const efectivoDesglose = calculateCash([
    { origen: "FONDO_INICIAL", id: "91", folio: null, importe: "500.00", href: null },
    { origen: "SALIDA", id: "19", folio: null, importe: "300.00", href: null },
  ]);
  const snapshot = { version: "E2", sesionId: 91, efectivoContado: "200.00", diferencia: "0.00", efectivoDesglose };
  assert.equal(analyticsCutDifference({ id: 91, diferencia: "-300.00", cash_snapshots: [snapshot] }), "0.00");
  assert.throws(() => analyticsCutDifference({ id: 91, diferencia: "-300.00", cash_snapshots: [snapshot, snapshot] }), /duplicado/);
  assert.throws(() => analyticsCutDifference({ id: 91, diferencia: "-300.00", cash_snapshots: [{ ...snapshot, diferencia: "300.00" }] }), /inválido/);
});

test("legacy cuts retain their original surface arithmetic; invalid snapshots never fall back", () => {
  assert.equal(analyticsCutDifference({ id: 91, diferencia: "-37.12", cash_snapshots: null }), "-37.12");
  for (const cash_snapshots of [[], {}, [null]]) {
    assert.throws(() => analyticsCutDifference({ id: 91, diferencia: "0.00", cash_snapshots }));
  }
});