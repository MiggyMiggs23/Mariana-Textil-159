import assert from "node:assert/strict";
import test from "node:test";
import { agingBucket, concentration, fifoAllocateAging, isCostRiseOverTenPercent, riskFromFrequency, weightedUnitCost } from "./reportes-commercial";

test("FIFO leaves the newest charge partially outstanding after earlier charges", () => {
  const aged = fifoAllocateAging([{ id: 1, amount: 100 }, { id: 2, amount: 80 }, { id: 3, amount: 25 }], 145);
  assert.deepEqual(aged, [{ id: 2, amount: 80, outstanding: 35 }, { id: 3, amount: 25, outstanding: 25 }]);
});
test("frequency risk requires a meaningful prior period", () => {
  assert.equal(riskFromFrequency(1, 4), "RIESGO_ALTO");
  assert.equal(riskFromFrequency(2, 4), "ESTABLE");
  assert.equal(riskFromFrequency(8, 0), "SIN_HISTORIAL");
});
test("concentration handles normal and zero totals", () => {
  assert.equal(concentration([20, 50, 30]), 50);
  assert.equal(concentration([0, -4]), 0);
});
test("aging buckets have exact boundary behavior", () => {
  assert.equal(agingBucket("2024-01-10", "2024-01-10"), "Vigente");
  assert.equal(agingBucket("2023-12-11", "2024-01-10"), "1-30");
  assert.equal(agingBucket("2023-11-11", "2024-01-10"), "31-60");
  assert.equal(agingBucket("2023-10-12", "2024-01-10"), "61-90");
  assert.equal(agingBucket("2023-10-11", "2024-01-10"), "91+");
});
test("weighted cost and rise threshold do not use an unweighted average", () => {
  assert.equal(weightedUnitCost([{ cost: 100, quantity: 1 }, { cost: 900, quantity: 9 }]), 100);
  assert.equal(isCostRiseOverTenPercent(100, 110), false);
  assert.equal(isCostRiseOverTenPercent(100, 110.01), true);
});