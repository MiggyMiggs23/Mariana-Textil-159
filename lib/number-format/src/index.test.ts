import assert from "node:assert/strict";
import test from "node:test";
import {
  EXCEL_NUMBER_FORMAT,
  formatNumber,
  toExcelNumber,
} from "./index.js";

test("formats every numeric semantic with es-MX rules", () => {
  assert.equal(formatNumber(1250, { kind: "money" }), "$1,250.00");
  assert.equal(formatNumber(19845, { kind: "quantity" }), "19,845.000");
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
    quantity: "#,##0.000",
    percentage: "0.00%",
    count: "#,##0",
    identifier: "0",
  });
});

test("formats signs, presentation rounding, empty values, and identifiers safely", () => {
  assert.equal(formatNumber(-1250.555, { kind: "money" }), "-$1,250.56");
  assert.equal(formatNumber(-47.3254, { kind: "quantity" }), "-47.325");
  assert.equal(formatNumber("001000027", { kind: "identifier" }), "001000027");
  assert.equal(formatNumber(null, { kind: "money" }), "—");
  assert.equal(formatNumber("not-a-number", { kind: "money" }), "—");
});

test("keeps Excel cells numeric and rejects unsafe coercions", () => {
  assert.equal(toExcelNumber("19845.325"), 19845.325);
  assert.throws(() => toExcelNumber("not-a-number"), RangeError);
  assert.throws(
    () => toExcelNumber(String(Number.MAX_SAFE_INTEGER + 2)),
    RangeError,
  );
});