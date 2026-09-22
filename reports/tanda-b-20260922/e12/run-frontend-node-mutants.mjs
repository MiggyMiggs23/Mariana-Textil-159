/**
 * MAIN ONLY: node reports/tanda-b-20260922/e12/run-frontend-node-mutants.mjs
 * Explicit native node:test files/name filters, as frontend-test-runner.mjs.
 * Esbuild aliases infrastructure only; JSDOM mounts actual React components.
 * No Vite, browser/server/listen, pools, tsx CLI or live-source mutation.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cases as obligations } from "./frontend-mutants-cases.mjs";
import { regressions } from "./frontend-e4-regressions.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const app = "artifacts/mariana-textil";
const testFile = "src/components/e12-node.dom.test.tsx";
const nativeTests = new Set([`${app}/${testFile}`, `${app}/src/components/e4-node.dom.test.tsx`]);
const hash = v => createHash("sha256").update(v).digest("hex");
const require = createRequire(path.join(root, app, "package.json"));
const ts = require("typescript");
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
// Resolution only; Vite itself is NEVER imported or executed.
const binary = fs.realpathSync(createRequire(compiler).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const originals = new Map();
const excludedTestSources = [];
function collect(rel) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const f = path.join(rel, entry.name);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) && !nativeTests.has(f)) {
      excludedTestSources.push(f);
      continue;
    }
    if (entry.isSymbolicLink()) throw Error(`Source symlink forbidden: ${f}`);
    if (entry.isDirectory()) collect(f);
    else originals.set(f, fs.readFileSync(path.join(root, f)));
  }
}
collect(`${app}/src`); collect("lib");
for (const rel of [`${app}/package.json`, "tsconfig.base.json"])
  originals.set(rel, fs.readFileSync(path.join(root, rel)));
const e12Cases = obligations.map(c => ({ ...c, mode: "E12_GREEN_SEMANTIC_RED_RESTORED", obligation: c.title, title: c.id, suite: null, testFile }));
const cases = [...e12Cases, ...regressions.map(c => ({ ...c, obligation: c.title, title: c.id, suite: null }))];
const nativeSource = originals.get(`${app}/${testFile}`);
if (!nativeSource) throw Error("E12 mounted native suite is not prepared; no tests executed");
const declared = [...nativeSource.toString().matchAll(/\btest\("([^"]+)"/g)].map(m => m[1]);
if (!e12Cases.length || declared.length !== e12Cases.length ||
    new Set(cases.map(c => c.id)).size !== cases.length ||
    e12Cases.some(c => !/^E12-[A-Z0-9-]+$/.test(c.id) || declared.filter(n => n === c.id).length !== 1))
  throw Error("Explicit E12 obligations, unique native tests and paired negative controls required; no discovery");
for (const entry of regressions) {
  const source = originals.get(`${app}/${entry.testFile}`)?.toString() ?? "";
  if ([...source.matchAll(/\btest\("([^"]+)"/g)].filter(m => m[1] === entry.id).length !== 1)
    throw Error(`Unknown/duplicate native E4 regression: ${entry.id}`);
}
for (const entry of e12Cases) {
  if (!/^src\/(?:components|pages|lib)\/.+\.[jt]sx?$/.test(entry.file) ||
      /(?:test|harness|fixture)/.test(entry.file) || !entry.before || entry.before === entry.after)
    throw Error(`Invalid productive mutation target: ${entry.id}`);
  const content = originals.get(`${app}/${entry.file}`)?.toString();
  if (!content || content.split(entry.before).length !== 2)
    throw Error(`Unstable/nonunique productive anchor: ${entry.id}`);
  const changed = content.replace(entry.before, entry.after);
  if (ts.createSourceFile(entry.file, changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length)
    throw Error(`Invalid mutant syntax before any execution: ${entry.id}`);
}
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--ids"))
  throw Error("Usage: run-frontend-node-mutants.mjs [--ids ID1,ID2,...]; no implicit discovery or resume");
const selectedIds = args.length ? args[1].split(",") : cases.map(c => c.id);
if (!selectedIds.length || selectedIds.some(id => !id || !cases.some(c => c.id === id)) ||
    new Set(selectedIds).size !== selectedIds.length)
  throw Error("Explicit IDs must be nonempty, unique and present in the E12 manifest");
const selectedCases = selectedIds.map(id => cases.find(c => c.id === id));
const evidence = path.join(dir, `frontend-node-mutants-${new Date().toISOString().replaceAll(":", "-")}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e12-node-"));
fs.mkdirSync(evidence);
const harnessFiles = ["frontend-offline-guard.cjs", "frontend-node-dom.cjs", "frontend-node-reporter.mjs",
  "frontend-node-build.mjs", "frontend-e4-off-flags.mjs"];
const manifest = {
  status: "PREPARED_NOT_EXECUTED", mode: "NODE_TEST_ESBUILD_JSDOM_NO_VITE_NO_SERVER",
  sandbox, cases: [], plannedCases: selectedCases, selectedIds,
  omittedIds: cases.filter(c => !selectedIds.includes(c.id)).map(c => c.id),
  totalObligations: cases.length, selectedCount: selectedCases.length,
  e12PairedMutationObligations: e12Cases.length, e4ExistingGreenRegressions: regressions.length,
  coverageScope: selectedCases.length === cases.length ? "FULL_E12_UI_MANIFEST_NOT_BACKEND" : "EXPLICIT_PARTIAL_SELECTION_NOT_FULL_E12",
  excludedTestSources,
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])),
  harnessHashes: Object.fromEntries([...harnessFiles, "run-frontend-node-mutants.mjs", "frontend-mutants-cases.mjs", "frontend-e4-regressions.mjs", "../e4/frontend-mutants-cases.mjs"]
    .map(f => [f, hash(fs.readFileSync(path.join(dir, f)))])),
  baseline: "E4 native infrastructure accepted at 95aa2bcc89fd5f7d6a5ea142ba6c9d403ac18000; E4 evidence is read-only",
  isolation: "E4_* child env keys retained solely for the byte-preserved E4 guard/build protocol; values point to E12 snapshots",
};
const save = () => fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify(manifest, null, 2));
save();
function modules(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    if (ent.name.startsWith(".") || ent.name === "@workspace") continue;
    const input = path.join(from, ent.name), output = path.join(to, ent.name);
    if (ent.name.startsWith("@")) { modules(input, output); continue; }
    const real = fs.realpathSync(input);
    if (!real.includes("/node_modules/")) throw Error(`External source escape: ${input}`);
    fs.symlinkSync(real, output, "dir");
  }
}
function snapshot(id, entry, mutation) {
  const dest = path.join(sandbox, id); fs.mkdirSync(dest);
  for (const [f, b] of originals) {
    const out = path.join(dest, f);
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, b);
  }
  const cwd = path.join(dest, app);
  const aliases = { "@": path.join(cwd, "src") };
  for (const f of [...originals.keys()].filter(f => /^lib\/[^/]+\/package.json$/.test(f))) {
    const json = JSON.parse(originals.get(f));
    const exp = json.exports?.["."];
    const entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") aliases[json.name] = path.resolve(dest, path.dirname(f), entry);
    const deps = path.join(root, path.dirname(f), "node_modules");
    if (fs.existsSync(deps)) modules(deps, path.join(dest, path.dirname(f), "node_modules"));
  }
  modules(path.join(root, app, "node_modules"), path.join(cwd, "node_modules"));
  for (const f of harnessFiles) fs.copyFileSync(path.join(dir, f), path.join(cwd, f));
  const isE4 = entry.mode === "EXISTING_E4_GREEN_ONLY";
  const harness = path.join(cwd, `src/components/${isE4 ? "e4" : "e12"}-node-test-harness.tsx`);
  const actual = aliases["@workspace/api-client-react"];
  const generated = fs.readFileSync(path.join(dest, "lib/api-client-react/src/generated/api.ts"), "utf8");
  const hookNames = [...new Set([...generated.matchAll(/export\s+(?:function|const)\s+(use[A-Z]\w*)/g)].map(m => m[1]))];
  for (const required of ["useGetCurrentUser", "useGetOpcionesPagoEfectivoProveedor", "useRegistrarPagoProveedor",
    "useReversarPagoProveedor", "useCreateSolicitudPagoDirigido", "useAprobarSolicitudPagoDirigido"])
    if (!hookNames.includes(required)) throw Error(`Actual hook manifest missing: ${required}`);
  const api = path.join(cwd, "frontend-node-api.ts");
  fs.writeFileSync(api, `export * from ${JSON.stringify(actual)};\nimport { dispatchHook } from ${JSON.stringify(harness)};\n` +
    hookNames.map(name => `export const ${name} = (...args) => dispatchHook(${JSON.stringify(name)}, args);`).join("\n"));
  Object.assign(aliases, {
    "@workspace/api-client-react": api, "@e12/harness": harness,
    "@/lib/e12-feature-flags": isE4 ? path.join(cwd, "frontend-e4-off-flags.mjs") : harness,
    "@/lib/e4-feature-flags": harness, "@/lib/location-scope": harness,
    "@/components/layout/app-layout": harness,
  });
  if (mutation) {
    const out = path.join(cwd, mutation.file);
    if (!fs.realpathSync(out).startsWith(dest + path.sep) || fs.lstatSync(out).isSymbolicLink()) throw Error("Mutation escaped physical source");
    const content = fs.readFileSync(out, "utf8");
    if (content.split(mutation.before).length !== 2) throw Error(`Nonunique anchor: ${mutation.id}`);
    const changed = content.replace(mutation.before, mutation.after);
    if (ts.createSourceFile(out, changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length)
      throw Error(`Invalid syntax mutant: ${mutation.id}`);
    fs.writeFileSync(out, changed);
  }
  const plan = { test: path.join(cwd, entry.testFile), output: path.join(cwd, "case.test.cjs"),
    metafile: path.join(cwd, "build-inputs.json"), aliases };
  fs.writeFileSync(path.join(cwd, "build-plan.json"), JSON.stringify(plan, null, 2));
  return { dest, cwd, plan };
}
function env(tree) {
  return { PATH: path.dirname(process.execPath), HOME: tree.dest, TMPDIR: tree.dest,
    NODE_ENV: "test", LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1",
    E4_SANDBOX: tree.dest, E4_LIVE_ROOT: root, E4_ESBUILD: binary, E4_ESBUILD_MODULE: compiler,
    NODE_OPTIONS: `--require=${path.join(tree.cwd, "frontend-offline-guard.cjs")}` };
}
function processLog(tree, args, name) {
  const logfile = path.join(evidence, `${name}.log`);
  const fd = fs.openSync(logfile, "wx");
  let result;
  try { result = spawnSync(process.execPath, args, { cwd: tree.cwd, env: env(tree), timeout: 60000, stdio: ["ignore", fd, fd] }); }
  finally { fs.closeSync(fd); }
  if (result.error || result.signal) throw Error(`Process failure ${name}: ${result.error ?? result.signal}`);
  return { exit: result.status, log: fs.readFileSync(logfile, "utf8"), args };
}
function execute(tree, entry, phase) {
  const prefix = `${entry.id}-${phase}`;
  const built = processLog(tree, [path.join(tree.cwd, "frontend-node-build.mjs"), path.join(tree.cwd, "build-plan.json")], `${prefix}-build`);
  if (built.exit !== 0) throw Error(`Build failure NOT accepted red: ${prefix}`);
  fs.copyFileSync(tree.plan.metafile, path.join(evidence, `${prefix}-inputs.json`));
  const resultFile = path.join(tree.cwd, `${prefix}.json`);
  const args = ["--require", path.join(tree.cwd, "frontend-node-dom.cjs"), "--test", "--test-isolation=none",
    "--test-name-pattern", `^${entry.id}$`, "--test-reporter=tap", "--test-reporter-destination=stdout",
    `--test-reporter=${path.join(tree.cwd, "frontend-node-reporter.mjs")}`, `--test-reporter-destination=${resultFile}`, tree.plan.output];
  const result = processLog(tree, args, prefix);
  if (!fs.existsSync(resultFile)) throw Error(`Missing native test report: ${prefix}`);
  const raw = fs.readFileSync(resultFile, "utf8");
  fs.writeFileSync(path.join(evidence, `${prefix}.json`), raw);
  const report = JSON.parse(raw);
  const executed = report.tests.filter(t => !t.skipped);
  if (executed.length !== 1 || executed[0].name !== entry.id) throw Error(`Wrong/zero selection: ${prefix}`);
  const actual = executed[0];
  if (/E4_OFFLINE|E4_.*ESCAPE|SyntaxError|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(result.log))
    throw Error(`Infrastructure failure NOT accepted red: ${prefix}`);
  if (phase === "red") {
    // Node may wrap testCodeFailure in ERR_TEST_FAILURE; accept its native
    // assertion cause only for that explicit wrapper, never hook/setup failures.
    const wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
    const code = wrapped ? actual.causeCode : actual.code;
    const message = wrapped ? actual.causeMessage : actual.message;
    if (result.exit !== 1 || actual.status !== "failed" || code !== "ERR_ASSERTION" || !message?.includes(entry.assertion))
      throw Error(`Expected specific native AssertionError absent: ${prefix}`);
  } else if (result.exit !== 0 || actual.status !== "passed") throw Error(`GREEN failed: ${prefix}`);
  return { exit: result.exit, actual, args, bundleHash: hash(fs.readFileSync(tree.plan.output)),
    caseSourceHash: hash(fs.readFileSync(path.join(tree.cwd, entry.file))) };
}
try {
  for (const entry of selectedCases) {
    const green = snapshot(`${entry.id}-green`, entry);
    const result = { id: entry.id, mode: entry.mode, testFile: entry.testFile, obligation: entry.obligation, testHash: hash(originals.get(`${app}/${entry.testFile}`)),
      originalHash: hash(originals.get(`${app}/${entry.file}`)), greenSandbox: green.dest };
    manifest.cases.push(result); save();
    result.green = execute(green, entry, "green"); save();
    if (entry.mode === "EXISTING_E4_GREEN_ONLY") continue;
    const red = snapshot(`${entry.id}-red`, entry, entry);
    result.redSandbox = red.dest; result.mutantHash = hash(fs.readFileSync(path.join(red.cwd, entry.file))); save();
    result.red = execute(red, entry, "red"); save();
    fs.writeFileSync(path.join(red.cwd, entry.file), originals.get(`${app}/${entry.file}`));
    result.restored = execute(red, entry, "restored"); save();
  }
  manifest.status = selectedCases.length === cases.length ? "PASS_E12_MUTATIONS_AND_SCOPED_E4_GREEN" : "PASS_SELECTED_CASES";
} catch (error) {
  manifest.status = "FAIL_NOT_ACCEPTED"; manifest.error = String(error); process.exitCode = 1;
} finally {
  const changed = [...originals].filter(([f, b]) => hash(fs.readFileSync(path.join(root, f))) !== hash(b)).map(([f]) => f);
  if (changed.length) { manifest.status = "FAIL_SOURCE_CHANGED"; manifest.changed = changed; process.exitCode = 1; }
  manifest.finishedAt = new Date().toISOString(); save();
  console.log(`Evidence: ${path.relative(root, evidence)} (${manifest.status})`);
}