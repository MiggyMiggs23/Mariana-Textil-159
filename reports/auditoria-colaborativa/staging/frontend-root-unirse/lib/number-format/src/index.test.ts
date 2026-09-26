import assert from "node:assert/strict";
import test from "node:test";
import {
  EXCEL_NUMBER_FORMAT,
  ACCOUNT_DESTINATION_ORDER,
  formatNumber,
  formatQuantityForCsv,
  formatPackageQuantityLabel,
  formatAccountDestination,
  formatUnit,
  normalizeAccountDestination,
  toExcelNumber,
} from "./index.js";

test("formats every numeric semantic with es-MX rules", () => {
  assert.equal(formatNumber(1250, { kind: "money" }), "$1,250.00");
  assert.equal(formatNumber(19845, { kind: "quantity" }), "19,845.00");
  assert.equal(formatNumber(16, { kind: "percentage" }), "16.00%");
  assert.equal(
    formatNumber(0.16, { kind: "percentage", percentageInput: "ratio" }),
    "16.00%",
  );
  assert.equal(formatNumber(1250, { kind: "count" }), "1,250");
  assert.equal(formatNumber(1000027, { kind: "identifier" }), "1000027");
  assert.equal(formatNumber(2026, { kind: "identifier" }), "2026");
});

test("defines numeric Excel display formats without changing cell values", () => {
  assert.deepEqual(EXCEL_NUMBER_FORMAT, {
    money: '"$"#,##0.00',
    quantity: "#,##0.00",
    percentage: "0.00%",
    count: "#,##0",
    identifier: "0",
  });
});

test("formats signs, presentation rounding, empty values, and identifiers safely", () => {
  assert.equal(formatNumber(-1250.555, { kind: "money" }), "-$1,250.56");
  assert.equal(formatNumber(-47.3254, { kind: "quantity" }), "-47.33");
  assert.equal(formatNumber("001000027", { kind: "identifier" }), "001000027");
  assert.equal(formatNumber(null, { kind: "money" }), "—");
  assert.equal(formatNumber("not-a-number", { kind: "money" }), "—");
});

test("rounds quantity totals only after adding stored precision", () => {
  const storedLines = [1.004, 1.004, 1.004];
  assert.deepEqual(
    storedLines.map((value) => formatNumber(value, { kind: "quantity" })),
    ["1.00", "1.00", "1.00"],
  );
  assert.equal(
    formatNumber(
      storedLines.reduce((sum, value) => sum + value, 0),
      { kind: "quantity" },
    ),
    "3.01",
  );
});

test("uses the shared visible quantity precision in CSV numeric cells", () => {
  assert.equal(formatQuantityForCsv("19845.325"), "19845.33");
  assert.equal(formatQuantityForCsv(null), "");
});

test("keeps Excel cells numeric and rejects unsafe coercions", () => {
  assert.equal(toExcelNumber("19845.325"), 19845.325);
  assert.throws(() => toExcelNumber("not-a-number"), RangeError);
  assert.throws(
    () => toExcelNumber(String(Number.MAX_SAFE_INTEGER + 2)),
    RangeError,
  );
});

test("normalizes destination codes and legacy labels at the presentation boundary", () => {
  assert.deepEqual(ACCOUNT_DESTINATION_ORDER, [
    "CAJA_FISICA",
    "CUENTA_NO_FISCAL",
    "CUENTA_FISCAL",
    "CUENTAS_POR_COBRAR",
  ]);
  assert.equal(normalizeAccountDestination("CAJA_FISICA"), "CAJA_FISICA");
  assert.equal(normalizeAccountDestination("Caja física"), "CAJA_FISICA");
  assert.equal(normalizeAccountDestination("Cuenta no fiscal"), "CUENTA_NO_FISCAL");
  assert.equal(normalizeAccountDestination("Cuentas Fiscales"), "CUENTA_FISCAL");
  assert.equal(normalizeAccountDestination("Cuentas por cobrar"), "CUENTAS_POR_COBRAR");
  assert.equal(formatAccountDestination("CAJA_FISICA"), "Efectivo");
  assert.equal(formatAccountDestination("Cuenta fiscal"), "Cuentas Fiscales");
  assert.equal(formatAccountDestination("Cuentas por cobrar"), "Ventas a Crédito");
  assert.equal(formatAccountDestination("OTRA_CUENTA"), "OTRA_CUENTA");
  assert.equal(formatAccountDestination(null), "—");
});

test("uses one visible product-unit contract", () => {
  assert.equal(formatUnit("METRO"), "Mts.");
  assert.equal(formatUnit("KILO"), "Kg.");
  assert.equal(formatUnit("BOLSA"), "Bolsas");
  assert.equal(formatUnit("PIEZA"), "Pzas.");
  assert.equal(formatUnit("HISTORICA"), "HISTORICA");
  assert.equal(formatPackageQuantityLabel("BOLSA"), "BOLSAS POR CAJA");
  assert.equal(formatPackageQuantityLabel("PIEZA"), "PIEZAS");
});