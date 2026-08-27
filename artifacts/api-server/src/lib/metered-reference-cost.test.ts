import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMeteredReferenceCost,
  type MeteredCostRow,
} from "./metered-reference-cost";

const asOf = new Date("2025-06-15T12:00:00.000Z");
const row = (
  rollId: number,
  costPerUnit: string | null,
  receptionDate: string,
): MeteredCostRow => ({
  rollId,
  costPerUnit,
  receptionDate: new Date(receptionDate),
});

test("averages multiple received rolls simply, so 30m and 60m weigh equally", () => {
  // Quantities are intentionally not accepted by the calculator. These rows
  // represent a 30m roll costing 10/m and a 60m roll costing 20/m.
  const result = calculateMeteredReferenceCost(
    [
      row(1, "10.00", "2025-01-10T00:00:00.000Z"),
      row(2, "20.00", "2025-02-10T00:00:00.000Z"),
    ],
    asOf,
  );

  assert.deepEqual(
    { cost: result.cost, status: result.status, rollsIncluded: result.rollsIncluded },
    { cost: "15.00", status: "AVERAGE_12_MONTHS", rollsIncluded: 2 },
  );
  assert.notEqual(result.cost, "16.67", "must not use the 30m/60m weighted average");
});

test("uses one received roll as the current twelve-month average", () => {
  const result = calculateMeteredReferenceCost(
    [row(1, "13.25", "2024-06-15T12:00:00.000Z")],
    asOf,
  );

  assert.equal(result.cost, "13.25");
  assert.equal(result.status, "AVERAGE_12_MONTHS");
  assert.equal(result.isOlderThan12Months, false);
});

test("falls back to the most recently received known cost and marks it stale", () => {
  const result = calculateMeteredReferenceCost(
    [
      row(1, "8.50", "2022-01-01T00:00:00.000Z"),
      row(2, "9.75", "2024-05-01T00:00:00.000Z"),
      row(3, null, "2025-05-01T00:00:00.000Z"),
    ],
    asOf,
  );

  assert.equal(result.cost, "9.75");
  assert.equal(result.status, "STALE_LAST_KNOWN");
  assert.equal(result.isOlderThan12Months, true);
});

test("returns explicit no-cost status rather than zero when no cost ever existed", () => {
  const result = calculateMeteredReferenceCost(
    [
      row(1, null, "2025-01-01T00:00:00.000Z"),
      row(2, null, "2020-01-01T00:00:00.000Z"),
    ],
    asOf,
  );

  assert.deepEqual(result, {
    cost: null,
    status: "NO_COST",
    isOlderThan12Months: false,
    rollsIncluded: 0,
    latestReceptionDate: null,
  });
});

test("ignores null-cost rolls mixed with valid received rolls", () => {
  const result = calculateMeteredReferenceCost(
    [
      row(1, null, "2025-05-01T00:00:00.000Z"),
      row(2, "11.00", "2025-04-01T00:00:00.000Z"),
      row(3, null, "2025-03-01T00:00:00.000Z"),
      row(4, "15.00", "2025-02-01T00:00:00.000Z"),
    ],
    asOf,
  );

  assert.equal(result.cost, "13.00");
  assert.equal(result.rollsIncluded, 2);
});