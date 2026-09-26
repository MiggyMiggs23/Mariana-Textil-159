// Offline diagnostic copy; never launch, restart, replay or alter business behavior.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const hash = x => crypto.createHash("sha256").update(x).digest("hex");
const dir = path.resolve("reports/priority-fiscal-20260926");
const config = JSON.parse(fs.readFileSync(path.join(dir, "candidate.json")));
const original = fs.readFileSync(config.apiEntry, "utf8");
if (hash(original) !== "f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97") throw Error("Wrong frozen six-file parent");
const hooks = [
  ["    db = drizzle(pool, { schema: schema_exports });",
    "    globalThis.__fiscalObservePool(pool);\n    db = drizzle(pool, { schema: schema_exports });"],
  ["async function e11Execute(command3) {\n  let workCompleted = false;",
    'async function e11Execute(command3) {\n  globalThis.__fiscalE11Observe("start", command3);\n  let workCompleted = false;'],
  ["      workCompleted = true;\n      return { identity: identity2, payload };",
    '      workCompleted = true;\n      globalThis.__fiscalE11Observe("work-parsed", command3, null, workCompleted);\n      return { identity: identity2, payload };'],
  ["    const pg2 = error41;\n    const code = pg2?.code ?? pg2?.cause?.code ?? \"\";",
    '    globalThis.__fiscalE11Observe("work-transaction-rejected", command3, error41, workCompleted);\n    const pg2 = error41;\n    const code = pg2?.code ?? pg2?.cause?.code ?? "";'],
  ["    if (command3.mutationUuid) throw new E11OutcomeError(command3.mutationUuid, true);",
    '    globalThis.__fiscalE11Observe("delivery-rejected", command3, error41, workCompleted);\n    if (command3.mutationUuid) throw new E11OutcomeError(command3.mutationUuid, true);'],
];
let instrumented = original;
for (const [before, after] of hooks) {
  if (instrumented.split(before).length !== 2) throw Error("Diagnostic hook anchor not unique");
  instrumented = instrumented.replace(before, after);
}
const output = path.join(path.dirname(config.apiEntry), "fiscal-diagnostic-observed.mjs");
if (fs.existsSync(output) && fs.readFileSync(output, "utf8") !== instrumented)
  throw Error("Refusing overwrite changed diagnostic artifact");
if (!fs.existsSync(output)) fs.writeFileSync(output, instrumented);
const diagnostic = { ...config, apiEntry: output, apiSha256: hash(instrumented),
  originalApiEntry: config.apiEntry, originalApiSha256: hash(original),
  diagnosticOnly: true, instrumentation: "Pool lifecycle and E11 error phases only; source map remains uninstrumented parent" };
fs.writeFileSync(path.join(dir, "candidate-observed.json"), JSON.stringify(diagnostic, null, 2));
const bootstrap = fs.readFileSync(path.join(dir, "api-bootstrap.mjs"), "utf8")
  .replace('new URL("./candidate.json", import.meta.url)', 'new URL("./candidate-observed.json", import.meta.url)');
fs.writeFileSync(path.join(dir, "api-bootstrap-observed.mjs"), 'import "./fiscal-observer.mjs";\n' + bootstrap);
const launcher = fs.readFileSync(path.join(dir, "launch-private.mjs"), "utf8")
  .replaceAll("${report}/candidate.json", "${report}/candidate-observed.json")
  .replaceAll("${report}/api-bootstrap.mjs", "${report}/api-bootstrap-observed.mjs");
fs.writeFileSync(path.join(dir, "launch-private-observed.mjs"), launcher);
console.log(JSON.stringify({ diagnosticApi: output, sha256: diagnostic.apiSha256,
  bootstrap: path.join(dir, "api-bootstrap-observed.mjs"), started: false }));