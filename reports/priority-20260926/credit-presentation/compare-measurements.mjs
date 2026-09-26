import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const dir = path.join(import.meta.dirname, "measurements");
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name)));
const baseline = [1, 2, 3].map(n => read(`baseline-${n}.json`));
const after = [1, 2, 3].map(n => read(`after-${n}.json`));
const timeout = read("baseline-2-first-attempt-timeout.json");
for (const sample of [...baseline, ...after]) {
  assert.equal(sample.status, "MEASURED");
  assert.equal(sample.apiPid, 1540);
  assert.equal(sample.apiSha256, baseline[0].apiSha256);
  assert.equal(sample.database, baseline[0].database);
  assert.deepEqual(sample.range, baseline[0].range);
  assert.deepEqual(sample.model, baseline[0].model);
  assert.deepEqual(sample.report, baseline[0].report);
}
const bx = baseline[2].exports.find(e => e.format === "xlsx");
const ax = after[2].exports.find(e => e.format === "xlsx");
assert.deepEqual(bx.sheets.map(s => [s.name, s.rowCount]), ax.sheets.map(s => [s.name, s.rowCount]));
const sheets = bx.sheets.map((before, i) => {
  const equal = before.cellsSha256 === ax.sheets[i].cellsSha256;
  if (before.name !== "Periodo") assert.equal(equal, true, `Full business cells changed in ${before.name}`);
  return { name: before.name, rowCount: before.rowCount, allCellsHashEqual: equal };
});
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const times = samples => samples.map(r => ({
  sample: r.sample, actionToVisiblePlusTwoFramesMs: r.durationMs,
  creditRequestDurationMs: r.phaseIntervals.find(p => p.path === "/api/reportes/clientes").requestDurationMs,
  creditResponseEndToVisibleMs: r.phaseIntervals.find(p => p.path === "/api/reportes/clientes").responseEndToVisibleMs,
  creditScreenRowsIncludingEmptyStates: r.browserAtVisible.creditTableRows,
  allReportScreenRowsIncludingEmptyStates: r.browserAtVisible.reportTableRows,
  documentElements: r.browserAtVisible.domElements,
}));
const baselineMedian = median(baseline.map(r => r.durationMs)), afterMedian = median(after.map(r => r.durationMs));
const result = {
  verdict: "Presentation pagination materially faster; financial payload and complete business workbook cells preserved. Not a sub-3-second full-navigation result.",
  baseline: times(baseline), after: times(after),
  completedSampleMedianMs: { baseline: baselineMedian, after: afterMedian, reductionPercent: (1 - afterMedian / baselineMedian) * 100 },
  baselineTimeout: timeout,
  statisticalCaveat: "Medians describe completed samples only. Baseline also had an unresolved 300s harness timeout, retained separately; this is not a clean uninterrupted six-attempt run.",
  sameApiPid: 1540, sameApiSha256: baseline[0].apiSha256, sameDatabase: baseline[0].database,
  origins: { baseline: baseline[0].origin, after: after[0].origin },
  originCaveat: "Frontend proxy origin changes only:18238→18239. Each sample uses a fresh independent browser/session; API18237 process and DB unchanged.",
  financialParity: {
    allSixReportPayloadSummariesEqual: true,
    proof: "Exact equality of KPI values, chart hash, each complete table's row hash/count, columns hash and totals.",
    actualDataRows: baseline[0].report.tables.reduce((n, t) => n + t.rowCount, 0),
    screenEmptyStateRowsAreNotData: true,
  },
  workbookParity: sheets,
  exportCaveat: "All 10 non-metadata sheets have byte-identical serialized cell hashes. Periodo metadata sheet differs; existing exporter includes generation time at B2. Binary XLSX/PDF hashes differ, so whole-file byte equality is NOT claimed. PDF checks: valid PDF signature, successful full-filter request and ~3.57MB download on both sides; no extracted-PDF financial-content equality assertion.",
  paginationUi: after[2].paginationUi,
  printUi: after[2].printUi,
  printCaveat: "Verified actual production-page beforeprint DOM and computed print-media CSS, then afterprint restoration. No physical printer or browser print spool/PDF output tested.",
  noClientListMeasurement: true,
};
fs.writeFileSync(path.join(dir, "comparison.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ baselineMedian, afterMedian, reductionPercent: result.completedSampleMedianMs.reductionPercent, financialParity: true, businessWorkbookSheetsParity: true }));