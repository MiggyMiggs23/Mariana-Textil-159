/**
 * MAIN ONLY, background: node reports/e9/run-frontend-node-mutants.mjs [--ids E9-...,...]
 * No app/Vite/listener/DB; physical snapshots + native node:test + semantic RED.
 * Accepted E12 guard/build/DOM/reporter are copied byte-for-byte, never edited.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cases } from "./frontend-mutants-cases.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, "../..");
const app = "artifacts/mariana-textil", testFile = "src/components/e9-node.dom.test.tsx";
const baselineDir = path.join(root, "reports/tanda-b-20260922/e12");
const helpers = ["frontend-offline-guard.cjs", "frontend-node-dom.cjs", "frontend-node-reporter.mjs", "frontend-node-build.mjs"];
const hash = value => createHash("sha256").update(value).digest("hex");
const require = createRequire(path.join(root, app, "package.json"));
const ts = require("typescript");
// Resolve esbuild through Vite's installed dependencies; never import/run Vite.
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
const binary = fs.realpathSync(createRequire(compiler).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const originals = new Map(), excludedTestSources = [];
function collect(rel) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const file = path.join(rel, entry.name);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) && file !== `${app}/${testFile}`) {
      excludedTestSources.push(file); continue;
    }
    if (entry.isSymbolicLink()) throw Error(`E9_SOURCE_SYMLINK ${file}`);
    if (entry.isDirectory()) collect(file);
    else originals.set(file, fs.readFileSync(path.join(root, file)));
  }
}
collect(`${app}/src`); collect("lib");
for (const file of [`${app}/package.json`, "tsconfig.base.json"]) originals.set(file, fs.readFileSync(path.join(root, file)));
const declared = [...originals.get(`${app}/${testFile}`).toString().matchAll(/\btest\("([^"]+)"/g)].map(m => m[1]);
if (!cases.length || declared.length !== cases.length || new Set(cases.map(c => c.id)).size !== cases.length ||
    cases.some(c => !/^E9-[A-Z0-9-]+$/.test(c.id) || declared.filter(id => id === c.id).length !== 1))
  throw Error("E9_EXPLICIT_ONE_TO_ONE_NATIVE_MANIFEST_REQUIRED");
for (const c of cases) {
  if (!/^src\/(?:components|pages|lib)\/.+\.[jt]sx?$/.test(c.file) ||
      /(?:test|fixture|harness)/.test(c.file) || !c.before || c.before === c.after || c.assertion !== c.id)
    throw Error(`E9_INVALID_PRODUCTIVE_MUTANT ${c.id}`);
  const source = originals.get(`${app}/${c.file}`)?.toString();
  if (!source || source.split(c.before).length !== 2) throw Error(`E9_NONUNIQUE_ANCHOR ${c.id}`);
  if (ts.createSourceFile(c.file, source.replace(c.before, c.after), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length)
    throw Error(`E9_MUTANT_SYNTAX ${c.id}`);
}
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--ids")) throw Error("Usage: runner [--ids E9-ID,E9-ID]; no discovery/resume");
const ids = args.length ? args[1].split(",") : cases.map(c => c.id);
if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !cases.some(c => c.id === id)))
  throw Error("E9_SELECTION_MUST_BE_EXPLICIT_UNIQUE_KNOWN_IDS");
const selected = ids.map(id => cases.find(c => c.id === id));
const evidence = path.join(dir, `frontend-node-mutants-${new Date().toISOString().replaceAll(":", "-")}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e9-node-"));
fs.mkdirSync(evidence);
const helperBytes = new Map(helpers.map(f => [f, fs.readFileSync(path.join(baselineDir, f))]));
const manifest = {
  status: "PREPARED_NOT_EXECUTED", mode: "NODE_TEST_ESBUILD_JSDOM_NO_VITE_NO_SERVER",
  sandbox, testFile, cases: [], plannedCases: selected, selectedIds: ids,
  omittedIds: cases.filter(c => !ids.includes(c.id)).map(c => c.id),
  totalObligations: cases.length, selectedCount: selected.length,
  coverageScope: selected.length === cases.length ? "FULL_E9_UI_MANIFEST_NOT_BACKEND" : "EXPLICIT_PARTIAL_NOT_FULL_E9",
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])), excludedTestSources,
  harnessHashes: {
    ...Object.fromEntries([...helperBytes].map(([f, b]) => [`reports/tanda-b-20260922/e12/${f}`, hash(b)])),
    ...Object.fromEntries(["run-frontend-node-mutants.mjs", "frontend-mutants-cases.mjs"].map(f => [`reports/e9/${f}`, hash(fs.readFileSync(path.join(dir, f)))])),
  },
  baseline: "E12 accepted native infrastructure; E12 closure 4c5a9d263949f79709c28a2cc9102db368d07b32; E4/E12 evidence read-only",
  isolation: "E4_* environment keys are the byte-preserved offline infrastructure protocol; values exclusively point to E9 snapshots",
};
const save = () => fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify(manifest, null, 2));
save();
function modules(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "@workspace") continue;
    const input = path.join(from, entry.name), output = path.join(to, entry.name);
    if (entry.name.startsWith("@")) { modules(input, output); continue; }
    const real = fs.realpathSync(input);
    if (!real.includes("/node_modules/")) throw Error(`E9_EXTERNAL_SOURCE_ESCAPE ${input}`);
    fs.symlinkSync(real, output, "dir");
  }
}
function snapshot(name, mutation) {
  const dest = path.join(sandbox, name); fs.mkdirSync(dest);
  for (const [file, bytes] of originals) {
    const out = path.join(dest, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, bytes);
  }
  const cwd = path.join(dest, app), aliases = { "@": path.join(cwd, "src") };
  for (const file of [...originals.keys()].filter(f => /^lib\/[^/]+\/package.json$/.test(f))) {
    const json = JSON.parse(originals.get(file)), exp = json.exports?.["."];
    const entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") aliases[json.name] = path.resolve(dest, path.dirname(file), entry);
    const deps = path.join(root, path.dirname(file), "node_modules");
    if (fs.existsSync(deps)) modules(deps, path.join(dest, path.dirname(file), "node_modules"));
  }
  modules(path.join(root, app, "node_modules"), path.join(cwd, "node_modules"));
  for (const [file, bytes] of helperBytes) fs.writeFileSync(path.join(cwd, file), bytes);
  const harness = path.join(cwd, "src/components/e9-node-test-harness.tsx");
  const generated = fs.readFileSync(path.join(dest, "lib/api-client-react/src/generated/api.ts"), "utf8");
  const hooks = [...new Set([...generated.matchAll(/export\s+(?:function|const)\s+(use[A-Z]\w*)/g)].map(m => m[1]))];
  for (const hook of ["useGetCurrentUser", "useGetE9Disponibilidad", "useListE9Entregas", "useGetE9Entrega",
    "useCreateE9Entrega", "useCreateE9Conteo", "useAuthorizeE9Recepcion", "useCloseE9Investigacion", "useObtenerCorteCaja"])
    if (!hooks.includes(hook)) throw Error(`E9_MISSING_ACTUAL_HOOK ${hook}`);
  const api = path.join(cwd, "frontend-node-api.ts");
  fs.writeFileSync(api, `export * from ${JSON.stringify(aliases["@workspace/api-client-react"])};\n` +
    `import { dispatchHook } from ${JSON.stringify(harness)};\n` +
    hooks.map(hook => `export const ${hook} = (...args) => dispatchHook(${JSON.stringify(hook)}, args);`).join("\n"));
  Object.assign(aliases, {
    "@workspace/api-client-react": api, "@/lib/e9-feature-flags": harness,
    "@/lib/location-scope": harness, "@/components/layout/app-layout": harness,
  });
  if (mutation) {
    const out = path.join(cwd, mutation.file);
    if (!fs.realpathSync(out).startsWith(dest + path.sep) || fs.lstatSync(out).isSymbolicLink()) throw Error("E9_MUTATION_ESCAPE");
    const text = fs.readFileSync(out, "utf8");
    if (text.split(mutation.before).length !== 2) throw Error(`E9_NONUNIQUE_SNAPSHOT_ANCHOR ${mutation.id}`);
    fs.writeFileSync(out, text.replace(mutation.before, mutation.after));
  }
  const plan = { test: path.join(cwd, testFile), output: path.join(cwd, "case.test.cjs"),
    metafile: path.join(cwd, "build-inputs.json"), aliases };
  fs.writeFileSync(path.join(cwd, "build-plan.json"), JSON.stringify(plan, null, 2));
  return { dest, cwd, plan };
}
function processLog(tree, argv, name) {
  const file = path.join(evidence, `${name}.log`), fd = fs.openSync(file, "wx");
  let result;
  try {
    result = spawnSync(process.execPath, argv, {
      cwd: tree.cwd, timeout: 60000, stdio: ["ignore", fd, fd],
      env: { PATH: path.dirname(process.execPath), HOME: tree.dest, TMPDIR: tree.dest,
        NODE_ENV: "test", LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1",
        E4_SANDBOX: tree.dest, E4_LIVE_ROOT: root, E4_ESBUILD: binary, E4_ESBUILD_MODULE: compiler,
        NODE_OPTIONS: `--require=${path.join(tree.cwd, "frontend-offline-guard.cjs")}` },
    });
  } finally { fs.closeSync(fd); }
  if (result.error || result.signal) throw Error(`E9_PROCESS_FAILURE ${name}: ${result.error ?? result.signal}`);
  return { exit: result.status, log: fs.readFileSync(file, "utf8") };
}
function execute(tree, c, phase) {
  const prefix = `${c.id}-${phase}`;
  const build = processLog(tree, [path.join(tree.cwd, "frontend-node-build.mjs"), path.join(tree.cwd, "build-plan.json")], `${prefix}-build`);
  if (build.exit !== 0) throw Error(`E9_BUILD_FAILURE_NOT_SEMANTIC_RED ${prefix}`);
  fs.copyFileSync(tree.plan.metafile, path.join(evidence, `${prefix}-inputs.json`));
  const resultFile = path.join(tree.cwd, `${prefix}.json`);
  const argv = ["--require", path.join(tree.cwd, "frontend-node-dom.cjs"), "--test", "--test-isolation=none",
    "--test-name-pattern", `^${c.id}$`, "--test-reporter=tap", "--test-reporter-destination=stdout",
    `--test-reporter=${path.join(tree.cwd, "frontend-node-reporter.mjs")}`, `--test-reporter-destination=${resultFile}`, tree.plan.output];
  const result = processLog(tree, argv, prefix);
  if (!fs.existsSync(resultFile)) throw Error(`E9_MISSING_NATIVE_REPORT ${prefix}`);
  const raw = fs.readFileSync(resultFile, "utf8");
  fs.writeFileSync(path.join(evidence, `${prefix}.json`), raw);
  const report = JSON.parse(raw), executed = report.tests.filter(t => !t.skipped);
  if (executed.length !== 1 || executed[0].name !== c.id) throw Error(`E9_WRONG_NATIVE_SELECTION ${prefix}`);
  const actual = executed[0];
  if (/E4_OFFLINE|E4_.*ESCAPE|E9_UNCONFIGURED|SyntaxError|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(result.log))
    throw Error(`E9_INFRASTRUCTURE_FAILURE_NOT_RED ${prefix}`);
  if (phase === "red") {
    const wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
    const code = wrapped ? actual.causeCode : actual.code, message = wrapped ? actual.causeMessage : actual.message;
    if (result.exit !== 1 || actual.status !== "failed" || code !== "ERR_ASSERTION" || !message?.includes(c.assertion))
      throw Error(`E9_SPECIFIC_NATIVE_ASSERTION_RED_REQUIRED ${prefix}`);
  } else if (result.exit !== 0 || actual.status !== "passed") throw Error(`E9_GREEN_FAILED ${prefix}`);
  return { exit: result.exit, actual, args: argv, bundleHash: hash(fs.readFileSync(tree.plan.output)),
    caseSourceHash: hash(fs.readFileSync(path.join(tree.cwd, c.file))) };
}
try {
  for (const c of selected) {
    const green = snapshot(`${c.id}-green`);
    const result = { id: c.id, obligation: c.title, assertion: c.assertion, testFile,
      mode: "E9_GREEN_SEMANTIC_RED_RESTORED", testHash: hash(originals.get(`${app}/${testFile}`)),
      originalHash: hash(originals.get(`${app}/${c.file}`)), greenSandbox: green.dest };
    manifest.cases.push(result); save();
    result.green = execute(green, c, "green"); save();
    const red = snapshot(`${c.id}-red`, c);
    result.redSandbox = red.dest; result.mutantHash = hash(fs.readFileSync(path.join(red.cwd, c.file))); save();
    result.red = execute(red, c, "red"); save();
    fs.writeFileSync(path.join(red.cwd, c.file), originals.get(`${app}/${c.file}`));
    result.restored = execute(red, c, "restored"); save();
  }
  manifest.status = selected.length === cases.length ? "PASS_E9_UI_MUTATIONS" : "PASS_SELECTED_CASES";
} catch (error) {
  manifest.status = "FAIL_NOT_ACCEPTED"; manifest.error = String(error); process.exitCode = 1;
} finally {
  const changed = [...originals].filter(([f, b]) => hash(fs.readFileSync(path.join(root, f))) !== hash(b)).map(([f]) => f);
  const changedHarness = Object.entries(manifest.harnessHashes).filter(([f, h]) => hash(fs.readFileSync(path.join(root, f))) !== h).map(([f]) => f);
  if (changed.length || changedHarness.length) {
    manifest.status = "FAIL_SOURCE_CHANGED"; manifest.changed = changed; manifest.changedHarness = changedHarness; process.exitCode = 1;
  }
  manifest.finishedAt = new Date().toISOString(); save();
  console.log(`Evidence: ${path.relative(root, evidence)} (${manifest.status})`);
}