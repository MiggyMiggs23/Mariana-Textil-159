import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";

// Build only. No database connection, server, activation, or old-proof mutation.
const root = process.cwd();
const baseReport = path.join(root, "reports/receipt-terminal-print-20261001");
const report = process.argv.includes("--revision-2") ? path.join(baseReport, "revision-2") : baseReport;
const apiBase = path.join(root, "reports/driver-multiple-phones-20261001/frozen-root");
const uiBase = path.join(root, "reports/sidebar-order-20261001/frozen-root");
const frozen = path.join(report, "frozen-root");
const api = "artifacts/api-server", ui = "artifacts/mariana-textil";
const head = "045ca8283cf553cf3378e470298723a9013df6aa";
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const read = file => fs.readFileSync(file, "utf8");
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const json = (name, value) => write(path.join(report, name), JSON.stringify(value, null, 2) + "\n");
const skip = name => name === "node_modules" || name === ".vite" || name === ".vite-temp" || name.endsWith(".tsbuildinfo");
function inventory(dir) {
  const result = {};
  function walk(current) {
    for (const e of fs.readdirSync(current, { withFileTypes: true })) {
      if (skip(e.name)) continue;
      const file = path.join(current, e.name);
      if (e.isDirectory()) walk(file);
      else if (e.isFile()) result[path.relative(dir, file)] = sha(fs.readFileSync(file));
      else result[path.relative(dir, file)] = { link: fs.readlinkSync(file) };
    }
  }
  walk(dir); return result;
}
const guards = () => ({
  apiSource: inventory(apiBase), uiSource: inventory(uiBase),
  servedApi: inventory(path.join(root, api, "dist-driver-phones-20261001")),
  servedUi: inventory(path.join(root, ui, "dist-sidebar-order-20261001")),
});
const beforeGuards = guards();
if (fs.existsSync(path.join(report, "build-manifest.json"))) {
  const prior = JSON.parse(read(path.join(report, "build-manifest.json")));
  assert.equal(prior.status, "VALIDATION_FAILED_NOT_ACTIVATED", "Successful candidate is immutable");
  const failed = fs.mkdtempSync(path.join(report, "failed-build-"));
  for (const file of fs.readdirSync(report).filter(n => n.endsWith(".log") || n.endsWith(".json")))
    fs.copyFileSync(path.join(report, file), path.join(failed, file));
}
fs.rmSync(frozen, { recursive: true, force: true });
fs.cpSync(apiBase, frozen, { recursive: true, filter: file => !skip(path.basename(file)) });
fs.rmSync(path.join(frozen, ui), { recursive: true, force: true });
fs.cpSync(path.join(uiBase, ui), path.join(frozen, ui), { recursive: true, filter: file => !skip(path.basename(file)) });
// Sidebar-order changed only frontend navigation. Shared libraries remain the driver-phones baseline.
for (const lib of ["api-client-react", "api-zod", "number-format", "metered-pricing", "scanned-code"]) {
  assert.deepEqual(inventory(path.join(apiBase, "lib", lib)), inventory(path.join(uiBase, "lib", lib)));
}
if (!fs.existsSync(path.join(frozen, "attached_assets")) && fs.existsSync(path.join(uiBase, "attached_assets")))
  fs.cpSync(path.join(uiBase, "attached_assets"), path.join(frozen, "attached_assets"), { recursive: true });
// Runtime fonts were retained beside the accepted API bundle, not in its source extraction.
fs.cpSync(path.join(root, api, "dist-driver-phones-20261001/assets"), path.join(frozen, api, "assets"), { recursive: true });
const baseline = inventory(frozen);
const production = [
  `${api}/src/lib/e3-repository.ts`, `${api}/src/lib/e5-repository.ts`, `${api}/src/lib/e5.ts`, `${api}/src/lib/permisos.ts`,
  `${api}/src/routes/e3-collections.ts`, `${api}/src/routes/e5.ts`,
  `${ui}/src/App.tsx`, `${ui}/src/lib/permisos.ts`, `${ui}/src/hooks/use-e3.ts`,
  `${ui}/src/components/layout/app-navigation.ts`,
  `${ui}/src/pages/caja/recibo-e3.tsx`, `${ui}/src/pages/e5-documento.tsx`,
  `${ui}/src/pages/permisos.tsx`, `${ui}/src/pages/pos.tsx`,
  "lib/db/src/lib/caja-permissions-schema.ts", "lib/api-spec/openapi.yaml",
];
const additions = [
  `${ui}/src/components/receipt-discovery.tsx`, `${api}/src/lib/receipt-permissions.test.ts`,
  `${ui}/src/pages/recibos-abonos.tsx`,
  `${ui}/src/components/receipt-discovery.test.tsx`, `${ui}/vitest.receipts.config.ts`,
  "lib/db/src/lib/seed-permissions.mjs", "lib/db/src/lib/caja-permissions-schema.test.ts",
];
const sourceProof = [];
for (const file of production) {
  const original = execFileSync("git", ["show", `${head}:${file}`], { cwd: root });
  assert.equal(sha(original), baseline[file], `Unrelated HEAD changes in ${file}; cannot overlay whole file`);
  fs.copyFileSync(path.join(root, file), path.join(frozen, file));
  sourceProof.push({ file, before: baseline[file], after: sha(fs.readFileSync(path.join(root, file))), originalCommit: head });
}
for (const file of additions) {
  assert.ok(!baseline[file], `New input unexpectedly exists in baseline: ${file}`);
  fs.mkdirSync(path.dirname(path.join(frozen, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(frozen, file));
}

// Publish only receipt declarations from canonical generated output. Never replace
// whole generated libraries: active baseline intentionally excludes unrelated HEAD contracts.
const generated = new Set();
function emit(file, transform) {
  const target = path.join(frozen, file);
  write(target, transform(read(target), read(path.join(root, file))));
  generated.add(file);
}
function section(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing generated section ${start} / ${end}`);
  return text.slice(a, b);
}
function replaceSection(old, current, start, end) {
  return old.replace(section(old, start, end), section(current, start, end));
}
emit("lib/api-client-react/src/generated/api.schemas.ts", (old, current) => {
  old = replaceSection(old, current, "export type ListCajaRecibosE3Params =", "export type ");
  return old + "\n" + section(current, "export type ListE5RecibosParams =", "export type ");
});
emit("lib/api-client-react/src/generated/api.ts", (old, current) => {
  old = old.replace("  ListE5CobrosParams,", "  ListE5CobrosParams,\n  ListE5RecibosParams,");
  assert.ok(old.includes("  ListE5RecibosParams,"));
  old = replaceSection(old, current, "export const getListCajaRecibosE3Url", "export const getRecordReciboE3PrintUrl");
  return old + "\n" + section(current, "export const getListE5RecibosUrl", "export const getGetE5DocumentoUrl");
});
emit("lib/api-zod/src/generated/api.ts", (old, current) => {
  const start = "export const ListCajaRecibosE3QueryParams";
  old = old.replace(section(old, start, "export const RecordReciboE3PrintParams"),
    section(current, "export const listCajaRecibosE3QueryBuscarMax", "export const RecordReciboE3PrintParams"));
  return old + "\n" + section(current, "export const listE5RecibosQueryBuscarMax", "export const GetE5DocumentoParams");
});
for (const file of ["lib/api-zod/src/generated/types/listE5RecibosParams.ts", "lib/api-zod/src/generated/types/listCajaRecibosE3Params.ts"]) {
  fs.copyFileSync(path.join(root, file), path.join(frozen, file)); generated.add(file);
}
for (const file of ["lib/api-zod/src/index.ts", "lib/api-zod/src/generated/types/index.ts"]) {
  const prefix = file.endsWith("/src/index.ts") ? "./generated/types/" : "./";
  const dest = path.join(frozen, file);
  write(dest, read(dest) + `\nexport * from "${prefix}listE5RecibosParams";\n`); generated.add(file);
}
const after = inventory(frozen);
const deltas = [...new Set([...Object.keys(baseline), ...Object.keys(after)])]
  .filter(file => JSON.stringify(baseline[file]) !== JSON.stringify(after[file]))
  .map(file => ({ file, before: baseline[file] ?? null, after: after[file] ?? null }));
const approved = new Set([...production, ...additions, ...generated]);
assert.ok(deltas.every(d => approved.has(d.file)), "Unscoped candidate source drift");
json("source-delta-audit.json", { sourceProof, deltas, exactPreservationOutsideApprovedFiles: true, generatedPolicy: "Only receipt operation/type sections from canonical Orval output; all other retained generated bytes preserved." });

const libraries = fs.readdirSync(path.join(frozen, "lib"), { withFileTypes: true })
  .filter(e => e.isDirectory() && fs.existsSync(path.join(frozen, "lib", e.name, "package.json"))).map(e => e.name);
for (const pkg of [api, ui, ...libraries.map(n => `lib/${n}`)]) {
  const nm = path.join(frozen, pkg, "node_modules"), installed = path.join(root, pkg, "node_modules");
  fs.mkdirSync(nm, { recursive: true });
  if (fs.existsSync(installed)) for (const entry of fs.readdirSync(installed))
    if (entry !== "@workspace") fs.symlinkSync(path.join(installed, entry), path.join(nm, entry));
  fs.mkdirSync(path.join(nm, "@workspace"), { recursive: true });
  for (const lib of libraries) fs.symlinkSync(path.join(frozen, "lib", lib), path.join(nm, "@workspace", lib));
}
const checks = [];
function run(name, command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 30e6,
    env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/", ...extraEnv } });
  write(path.join(report, `${name}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`);
  checks.push({ name, command: [command, ...args], status: result.status, signal: result.signal });
  console.log(name, result.status);
  return result.status;
}
const tsc = path.join(root, "node_modules/.bin/tsc");
run("libs-typecheck", tsc, ["--build", ...libraries.map(n => path.join(frozen, "lib", n))], frozen);
run("api-typecheck", tsc, ["--noEmit", "--incremental", "false", "-p", path.join(frozen, api)], frozen);
run("ui-typecheck", tsc, ["--noEmit", "--incremental", "false", "-p", path.join(frozen, ui)], frozen);
run("receipt-mounted-tests", path.join(root, api, "node_modules/.bin/tsx"), ["--test", "src/lib/receipt-permissions.test.ts"], path.join(frozen, api));
run("permission-default-tests", path.join(root, api, "node_modules/.bin/tsx"), ["--test", "lib/db/src/lib/caja-permissions-schema.test.ts"], frozen);
run("receipt-ui-mounted-tests", path.join(root, ui, "node_modules/.bin/vitest"), ["run", "--config", "vitest.receipts.config.ts"], path.join(frozen, ui), { NODE_ENV: "test" });
run("api-build", process.execPath, ["build.mjs"], path.join(frozen, api), { API_BUILD_OUTPUT_DIR: path.join(report, "api") });
run("ui-build", path.join(root, ui, "node_modules/.bin/vite"), ["build", "--config", "vite.config.ts", "--outDir", path.join(report, "web")], path.join(frozen, ui));
assert.deepEqual(guards(), beforeGuards, "Old frozen proof or active bundle changed");
json("baseline-provenance.json", { head, apiBase, uiBase, baseline, guards: beforeGuards });
json("build-manifest.json", { status: checks.every(c => c.status === 0) ? "BUILT_NOT_ACTIVATED" : "VALIDATION_FAILED_NOT_ACTIVATED",
  checks, frozen, sourceDeltas: deltas, api: inventory(path.join(report, "api")), web: inventory(path.join(report, "web")),
  noDatabaseAccess: true, noServerStarted: true, noActivation: true, baselinePreserved: true, recipeSha256: sha(read(import.meta.filename)) });
assert.ok(checks.every(c => c.status === 0), "Candidate validation failures; inspect report logs");