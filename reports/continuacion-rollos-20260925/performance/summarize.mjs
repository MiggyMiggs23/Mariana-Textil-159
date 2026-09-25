import fs from "node:fs";

const dir = `${process.cwd()}/reports/continuacion-rollos-20260925/performance`;
const seed = JSON.parse(fs.readFileSync(`${dir}/seed-result.json`, "utf8"));
const report = {
  fixture: seed.fixture,
  seedMs: seed.seedMs,
  meaning: "Browser ready includes network and render; HTTP TTFB/response are not SQL/query timings. TaskDuration is browser main-thread CPU seconds. No SQL plan measured.",
  operations: {}
};
for (const kind of ["credit", "cut", "account", "collection"]) {
  report.operations[kind] = [0, 1, 2].map(sample => {
    const data = JSON.parse(fs.readFileSync(`${dir}/${kind}-${sample}.json`, "utf8"));
    return {
      sample, ready: data.ready, error: data.error ?? null,
      routeReadyMs: data.routeReadyMs ?? null, preClickReadyMs: data.preClickReadyMs ?? null,
      clickReadyMs: data.clickReadyMs ?? null, visibleRange: data.visibleRange ?? null,
      http: data.http ?? [], render: data.render ?? null
    };
  });
  const threshold = kind === "credit" ? 3000 : kind === "cut" ? 2000 : null;
  if (threshold) {
    report.operations[kind + "Target"] = {
      thresholdMs: threshold, measuredFrom: kind === "cut" ? "Realizar Corte click" : "report route navigation",
      eachSamplePasses: report.operations[kind].every(x => x.ready &&
        (kind === "cut" ? x.clickReadyMs : x.routeReadyMs) < threshold)
    };
  }
}
fs.writeFileSync(`${dir}/summary.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  fixture: report.fixture,
  status: Object.fromEntries(["credit", "cut", "account", "collection"]
    .map(k => [k, report.operations[k].map(x => ({
      sample: x.sample, ready: x.ready, routeReadyMs: x.routeReadyMs,
      clickReadyMs: x.clickReadyMs, error: x.error
    }))])),
  targets: { credit: report.operations.creditTarget, cut: report.operations.cutTarget }
}, null, 2));