// SAFE IMPORT ALLOWLIST: Node builtins and the pure E1/E2 contracts only.
// No DB module, app entrypoint, schema initializer or database test helper.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { assertCreditRefundEnabled, readCreditRefundInput, assertRefundReplay, refundSourceKey } from "./credit-refund-contract";
import { assertCreditCaptureEnabled } from "./credit-evidence-contract";
const body = { operacionClave: "20000000-0000-4000-8000-000000000001", origen: "ABONO",
  abonoId: 3, importe: "25.00", motivo: "Cliente solicita devolución", sitioOrigenId: 2, sesionCajaId: 4 };
test("gate cannot be opened by environment or body", () => {
  process.env.CREDIT_REFUNDS_ENABLED = "true";
  assert.throws(assertCreditRefundEnabled, /pendiente/);
  assert.equal(readCreditRefundInput(1, { ...body, enabled: true }).importe, "25.00");
  assert.throws(assertCreditRefundEnabled, /pendiente/);
  delete process.env.CREDIT_REFUNDS_ENABLED;
});
test("canonical DTO, origin exclusivity, reason and identifiers", () => {
  assert.equal(refundSourceKey(readCreditRefundInput(1, body)), "ABONO:3");
  for (const patch of [{ motivo: "" }, { importe: "0" }, { abonoId: -1 }, { origen: "AJUSTE" },
    { sesionCajaId: null }, { cobroClave: body.operacionClave }]) {
    assert.throws(() => readCreditRefundInput(1, { ...body, ...patch }));
  }
  const retained = readCreditRefundInput(1, { ...body, origen: "COBRO_RETENIDO", abonoId: null, cobroClave: body.operacionClave });
  assert.equal(refundSourceKey(retained), `COBRO_RETENIDO:${body.operacionClave}`);
});
test("idempotency rejects any changed canonical field", () => {
  const input = readCreditRefundInput(1, body);
  assertRefundReplay(JSON.parse(JSON.stringify(input)), input);
  for (const field of Object.keys(input)) assert.throws(() => assertRefundReplay({ ...input, [field]: "changed" }, input), /UUID/);
});
test("original E1 cash rejection survives E2", () => {
  assert.throws(() => assertCreditCaptureEnabled({ naturaleza: "DEVOLUCION_FISICA",
    sitioOrigenId: 2, sesionCajaId: 4, operacionClave: body.operacionClave, notaOrigenId: null,
    origenJustificacion: body.motivo }, "EFECTIVO", "REVERSO_ABONO", "REVERSO"), /deshabilitada/);
});
// Isolated source copies are never imported/executed. Negative mutations prove
// these safety architecture assertions fail if the reviewed barriers disappear.
const service = readFileSync(new URL("./credit-refund.ts", import.meta.url), "utf8");
const ddl = readFileSync(new URL("../../../../reports/e2/sql/credit-refunds-prepared.sql", import.meta.url), "utf8");
function safetyChecks(text: string) {
  assert.match(text, /assertCreditRefundEnabled\(\);\s*return db.transaction/);
  assert.match(text, /assertCreditCaptureEnabled\(evidence, "EFECTIVO", "REVERSO_ABONO", "REVERSO"\)/);
  assert.match(text, /loadCustomerCreditProjectionInTransaction/);
  assert.match(text, /SELECT id FROM aplicaciones_credito WHERE abono_movimiento_id/);
  assert.match(text, /FROM evidencia_no_aplicada_e2 p/);
  assert.match(text, /JOIN finalizaciones_abono_e2 f[\s\S]*f\.resultado='UNUSED'/);
  assert.match(text, /assertRefundReplay/);
}
test("source barriers and isolated negative proofs", () => {
  safetyChecks(service);
  for (const token of ["assertCreditRefundEnabled();\n  return db.transaction", 'assertCreditCaptureEnabled(evidence, "EFECTIVO", "REVERSO_ABONO", "REVERSO")',
    "FROM evidencia_no_aplicada_e2 p", "SELECT id FROM aplicaciones_credito WHERE abono_movimiento_id"]) {
    assert.throws(() => safetyChecks(service.replace(token, "REMOVED")));
  }
});
test("DDL reuses exact original guard on proof and refund; no E1 replacement", () => {
  assert.equal((ddl.match(/EXECUTE FUNCTION public.e1_guard_cash_capture_closed\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(ddl, /CREATE OR REPLACE|DISABLE TRIGGER|DROP TRIGGER/);
  assert.match(ddl, /source_xid::bigint <> \(txid_current\(\) % 4294967296\)/);
});