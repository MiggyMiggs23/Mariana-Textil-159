import fs from "node:fs";
const root = "reports/tanda-f/tarea-5";
const summary = [];
for (let n = 1; n <= 10; n++) {
  const r = JSON.parse(fs.readFileSync(`${root}/case-${n}.json`, "utf8"));
  let previous = r.baseline?.balance ?? [];
  const comparisons = r.steps.map(s => {
    const rows = s.snapshot.balance.map(b => {
      const before = previous.find(p => p.ubicacion_id === b.ubicacion_id);
      const discrepancy = Number(b.signed_ledger) - Number(b.inventory_roll_sum);
      const prior = before ? Number(before.signed_ledger) - Number(before.inventory_roll_sum) : 0;
      return { site: b.ubicacion_id, product: b.producto_id, unit: b.unidad,
        cacheEqualsLedger: b.cache !== null && Number(b.cache) === Number(b.signed_ledger),
        ledgerMinusInventoryRolls: discrepancy, discrepancyChangeFromPriorStep: discrepancy-prior };
    });
    previous = s.snapshot.balance;
    return { initiatingStep: s.name, committed: s.committed, comparisons: rows };
  });
  summary.push({ case: n, status: n === 3 ? "BLOCKED_PRODUCT_METREADO_NOT_ENABLED" : n === 10 ? "BLOCKED_NO_HISTORICAL_DEVOLUCION" : "REPRODUCED",
    comparisons });
}
fs.writeFileSync(`${root}/comparisons.json`, JSON.stringify(summary, null, 2));