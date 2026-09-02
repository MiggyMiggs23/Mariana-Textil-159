import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber } from "@workspace/number-format";
import { calculateGroupedInventoryTotals } from "./inventory-global-totals";

const filteredGroups = [
  {
    rollosCount: 3,
    totalMetros: "10.004",
    totalKilos: "2.125",
    totalBolsas: "1.000",
  },
  {
    rollosCount: 4,
    totalMetros: "0.004",
    totalKilos: "3.375",
    totalBolsas: "2.500",
  },
] as const;

test("mantiene metros, kilos, bolsas y rollos separados en una suma mixta", () => {
  assert.deepEqual(calculateGroupedInventoryTotals(filteredGroups), {
    rollosCount: 7,
    totalMetros: "10.008",
    totalKilos: "5.500",
    totalBolsas: "3.500",
  });
});

test("suma strings guardados antes de aplicar el redondeo visible", () => {
  const totals = calculateGroupedInventoryTotals(filteredGroups);

  assert.equal(formatNumber(totals.totalMetros, { kind: "quantity" }), "10.01");
  assert.notEqual(
    formatNumber(filteredGroups[0].totalMetros, { kind: "quantity" }),
    formatNumber(totals.totalMetros, { kind: "quantity" }),
  );
});

test("un subconjunto filtrado no incluye filas ausentes", () => {
  const unfilteredGroups = [
    ...filteredGroups,
    {
      rollosCount: 99,
      totalMetros: "900.000",
      totalKilos: "800.000",
      totalBolsas: "700.000",
    },
  ];

  assert.deepEqual(
    calculateGroupedInventoryTotals(unfilteredGroups.slice(0, 2)),
    calculateGroupedInventoryTotals(filteredGroups),
  );
});