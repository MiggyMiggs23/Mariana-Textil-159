// Offline assembly only. MAIN owns process replacement and browser protocols.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const dir = path.resolve("reports/priority-fiscal-20260926");
const release = JSON.parse(fs.readFileSync("reports/priority-20260926/stability-combined-v8/candidate.json"));
const previous = JSON.parse(fs.readFileSync(`${dir}/candidate.json`));
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const original = fs.readFileSync(release.apiEntry, "utf8");
if (hash(original) !== "1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e")
  throw Error("V8 business artifact changed");
const candidate = { ...previous, apiEntry: release.apiEntry, apiSha256: release.apiSha256,
  status: "PG_AND_OFFLINE_VERIFIED_MAIN_BROWSER_PENDING", diagnosticOnly: false,
  sourceDeltas: release.sourceDeltas, v6SourceDeltas: release.v6SourceDeltas,
  verification: { typecheck: "PASS", stableOffline: "baseline4FAIL/candidate5PASS",
    stablePostgres: "baseline4FAIL/candidate5PASS", canonicalProjectionTests: "13PASS",
    sharedAdmissionTests: "2PASS", paymentAndPricesDifferential: "PASS",
    nativeDeferredCommit: "baseline resolver55000; corrected resolver+DAY/WEEK/MONTH PASS",
    livePerformance: "MAIN launch/browser pending" } };
fs.writeFileSync(`${dir}/candidate-v8.json`, JSON.stringify(candidate, null, 2));
const hooks = [
  ["    db = drizzle(pool, { schema: schema_exports });",
    "    globalThis.__fiscalObservePool(pool);\n    db = drizzle(pool, { schema: schema_exports });"],
  ["async function e11Execute(command3) {\n  let workCompleted = false;",
    'async function e11Execute(command3) {\n  globalThis.__fiscalE11Observe("start", command3);\n  let workCompleted = false;'],
  ["      workCompleted = true;\n      return { identity: identity2, payload };",
    '      workCompleted = true;\n      globalThis.__fiscalE11Observe("work-parsed", command3, null, workCompleted);\n      return { identity: identity2, payload };'],
  ['    const pg2 = error41;\n    const code = pg2?.code ?? pg2?.cause?.code ?? "";',
    '    globalThis.__fiscalE11Observe("work-transaction-rejected", command3, error41, workCompleted);\n    const pg2 = error41;\n    const code = pg2?.code ?? pg2?.cause?.code ?? "";'],
  ["    if (command3.mutationUuid) throw new E11OutcomeError(command3.mutationUuid, true);",
    '    globalThis.__fiscalE11Observe("delivery-rejected", command3, error41, workCompleted);\n    if (command3.mutationUuid) throw new E11OutcomeError(command3.mutationUuid, true);'],
];
let observed = original;
for (const [before, after] of hooks) {
  if (observed.split(before).length !== 2) throw Error("Observer hook anchor not unique");
  observed = observed.replace(before, after);
}
const observedEntry = path.join(path.dirname(release.apiEntry), "fiscal-diagnostic-observed.mjs");
fs.writeFileSync(observedEntry, observed);
fs.writeFileSync(`${dir}/candidate-v8-observed.json`, JSON.stringify({
  ...candidate, apiEntry: observedEntry, apiSha256: hash(observed), diagnosticOnly: true,
  originalApiEntry: candidate.apiEntry, originalApiSha256: candidate.apiSha256,
  instrumentation: "Five observational hooks only; diagnostic sourcemap remains business parent",
}, null, 2));
fs.writeFileSync(`${dir}/api-bootstrap-v8.mjs`, 'import "./fiscal-observer.mjs";\n' +
  fs.readFileSync(`${dir}/api-bootstrap.mjs`, "utf8").replace("./candidate.json", "./candidate-v8-observed.json"));
fs.writeFileSync(`${dir}/launch-private-v8.mjs`, fs.readFileSync(`${dir}/launch-private.mjs`, "utf8")
  .replaceAll("${report}/candidate.json", "${report}/candidate-v8-observed.json")
  .replaceAll("${report}/api-bootstrap.mjs", "${report}/api-bootstrap-v8.mjs"));
console.log(JSON.stringify({ businessSha256: candidate.apiSha256, observedSha256: hash(observed),
  launcher: `${dir}/launch-private-v8.mjs`, started: false }));