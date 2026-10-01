import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCashDifferenceInCents,
  calculateCashSinFacturaCents,
  formatCentsAsMoney,
  parseMoneyToCents,
} from "./cuentas-destino-financial";

test("parses exact real-cent precision without binary floating point", () => {
  assert.equal(parseMoneyToCents("0.30"), 30n);
  assert.equal(calculateCashSinFacturaCents("0.30", "0.10"), 20n);
  assert.equal(formatCentsAsMoney(20n), "0.20");
});

test("preserves a negative sign and one-place decimals", () => {
  assert.equal(parseMoneyToCents("-1.05"), -105n);
  assert.equal(parseMoneyToCents("7.5"), 750n);
  assert.equal(calculateCashSinFacturaCents("-1.05", "0.05"), -110n);
  assert.equal(formatCentsAsMoney(-110n), "-1.10");
});

test("supports large seven-digit money values exactly", () => {
  assert.equal(parseMoneyToCents("1234567.89"), 123456789n);
  assert.equal(
    formatCentsAsMoney(calculateCashSinFacturaCents("1234567.89", "0.01")),
    "1234567.88",
  );
});

test("rejects values with more precision than cents", () => {
  assert.throws(() => parseMoneyToCents("1.005"), /Importe monetario inválido/);
});

test("rejects an intentionally wrong-cent invariant", () => {
  assert.throws(
    () =>
      assertCashDifferenceInCents({
        cobrado: "10.00",
        facturado: "3.00",
        sinFactura: "7.01",
      }),
    /no coincide/,
  );
});