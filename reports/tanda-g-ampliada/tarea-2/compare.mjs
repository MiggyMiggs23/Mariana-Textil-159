import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "reports/tanda-g-ampliada/tarea-2";
const load = name => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, "utf8"));
const baseline = load("results-baseline").results.filter(r => r.transport);
const checked = load("results-check").results.filter(r => r.transport);
const key = r => [r.transport, r.site, r.unit, r.producer, r.quantity].join(":");
const byKey = new Map(checked.map(r => [key(r), r]));
assert.equal(baseline.length, 280); assert.equal(byKey.size, 280);
const comparisons = baseline.map(before => {
  const after = byKey.get(key(before)); assert.ok(after);
  return {
    key: key(before),
    baseline: { accepted: before.accepted, status: before.status, code: before.code, physical: before.after?.cantidad_actual },
    check: { accepted: after.accepted, status: after.status, code: after.code, physical: after.after?.cantidad_actual },
  };
});
const negativeApi = comparisons.filter(r => r.key.startsWith("API:") && r.key.endsWith(":-2"));
assert.equal(negativeApi.length, 8);
assert.ok(negativeApi.every(r => Number(r.check.physical) >= 0));
assert.equal(negativeApi.filter(r => Number(r.baseline.physical) === -2).length, 4);
const output = {
  pairedCases: comparisons.length, negativeApi,
  baselineAssertions: load("results-baseline").results.at(-1).comparisons,
  checkAssertions: load("results-check").results.at(-1).comparisons,
  chainsCheck: { total: load("chains-check").records.length, allPass: load("chains-check").records.every(r => r.pass) },
  chainsBaseline: { total: load("chains-baseline").records.length, allPass: load("chains-baseline").records.every(r => r.pass) },
  comparisons,
};
fs.writeFileSync(`${dir}/comparison.json`, JSON.stringify(output, null, 2));