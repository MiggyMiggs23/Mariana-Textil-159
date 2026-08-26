import assert from "node:assert/strict";
import test from "node:test";
import { classifyCoverage, classifyNoMovement, reconciles, reverseDailyCloses } from "./reportes-inventory";

test("coverage honors configurable stock bands and absent demand", () => {
  assert.equal(classifyCoverage(null), "SIN_VENTAS");
  assert.equal(classifyCoverage(7, 7, 15, 45, 90), "CRITICO");
  assert.equal(classifyCoverage(15, 7, 15, 45, 90), "BAJO");
  assert.equal(classifyCoverage(45, 7, 15, 45, 90), "NORMAL");
  assert.equal(classifyCoverage(90, 7, 15, 45, 90), "EXCESO");
});
test("no movement bands use inclusive lower boundaries", () => {
  assert.equal(classifyNoMovement(29), "<30");
  assert.equal(classifyNoMovement(30), "30-59");
  assert.equal(classifyNoMovement(90), "90-179");
  assert.equal(classifyNoMovement(180), "180+");
});
test("reverse daily close undoes movements after each close", () => {
  assert.deepEqual(reverseDailyCloses(12, [{ day: "2025-01-03", quantity: -3 }, { day: "2025-01-02", quantity: 5 }], ["2025-01-01", "2025-01-02", "2025-01-03"]), [{ day: "2025-01-01", quantity: 10 }, { day: "2025-01-02", quantity: 15 }, { day: "2025-01-03", quantity: 12 }]);
  assert.equal(reconciles(10, 10.0005, 10.0005), true);
  assert.equal(reconciles(10, 10.01), false);
});