// MAIN owns execution. Helpers may invoke only --build-only (zero cases).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cases, coverageStatus, hookCoverage, limits } from "./frontend-mutants-cases.mjs";
const root = process.cwd(), app = "artifacts/mariana-textil", testFile = "src/components/e7-node.dom.test.tsx";
const infrastructure = "reports/tanda-b-20260922/e12", builder = "reports/e11/frontend-node-build.mjs";
const helpers = ["frontend-offline-guard.cjs", "frontend-node-dom.cjs", "frontend-node-reporter.mjs"];
const need = (ok, message) => { if (!ok) throw Error(message); };
const hash = b => createHash("sha256").update(b).digest("hex");
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
const binary = fs.realpathSync(createRequire(compiler).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const args = process.argv.slice(2), buildOnly = args.length === 1 && args[0] === "--build-only";
need(buildOnly || args.length === 2 && args[0] === "--ids", "MAIN: --ids E7-ID,...; helper: --build-only. No implicit all-case execution.");
const ids = buildOnly ? cases.map(c => c.id) : args[1].split(",");
need(ids.length && new Set(ids).size === ids.length && ids.every(id => cases.some(c => c.id === id)), "E7_INVALID_SELECTION");
const originals = new Map(), excluded = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "build", ".git"].includes(entry.name)) continue;
    const file = `${dir}/${entry.name}`;
    need(!entry.isSymbolicLink(), `E7_SOURCE_SYMLINK ${file}`);
    if (entry.isDirectory()) collect(file);
    else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) && file !== `${app}/${testFile}`) excluded.push(file);
    else originals.set(file, fs.readFileSync(file));
  }
}
collect(`${app}/src`); collect("lib");
const documentEvidence = "reports/e7/frontend-document-preflight-2026-09-23T02-56-23.609Z/manifest.json";
const documentProof = JSON.parse(fs.readFileSync(documentEvidence));
need(hash(fs.readFileSync("reports/e7/frontend-document-bytes.json")) === documentProof.documentFixtureHash, "E7_REAL_BINARY_HASH_CHANGED");
for (const [file, sourceHash] of Object.entries(documentProof.sourceHashes))
  need(hash(fs.readFileSync(file)) === sourceHash, `E7_DOCUMENT_SOURCE_DRIFT ${file}`);
for (const f of [`${app}/package.json`, "tsconfig.base.json", "reports/e7/frontend-fixtures.ts",
  "reports/e7/frontend-document-bytes.json", documentEvidence, ...Object.keys(documentProof.sourceHashes)])
  originals.set(f, fs.readFileSync(f));
const testSource = originals.get(`${app}/${testFile}`).toString();
const ast = ts.createSourceFile(testFile, testSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test");
need(declarations.length === cases.length && cases.every(c => declarations.filter(s => s.expression.arguments[0]?.text === c.id).length === 1), "E7_EXACT_AST_BIJECTION");
for (const c of cases) {
  need(/^src\/(?:components|pages|lib|hooks)\/.+\.tsx?$/.test(c.file) && !/(test|fixture|harness)/.test(c.file) && c.assertion === c.id, "E7_INVALID_MUTANT");
  const source = originals.get(`${app}/${c.file}`).toString();
  need(source.split(c.before).length === 2 && c.before !== c.after, `E7_UNIQUE_ANCHOR ${c.id}`);
  need(!ts.createSourceFile(c.file, source.replace(c.before, c.after), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, `E7_MUTANT_SYNTAX ${c.id}`);
}
const evidence = path.resolve(`reports/e7/frontend-native-${new Date().toISOString().replaceAll(":", "-")}`);
fs.mkdirSync(evidence);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e7-native-")), identity = fs.lstatSync(sandbox), owned = new Set();
const harnessFiles = [...helpers.map(f => `${infrastructure}/${f}`), builder, "reports/e7/frontend-mutants-cases.mjs", "reports/e7/run-frontend-node-mutants.mjs"];
const manifest = {
  status: "PREPARING_NOT_EXECUTED", mode: buildOnly ? "BUILD_ONLY" : "GREEN_SPECIFIC_RED_RESTORED", coverageStatus, hookCoverage, limits,
  sandbox, testFile, selectedIds: ids, omittedIds: cases.filter(c => !ids.includes(c.id)).map(c => c.id), excluded, documentEvidence,
  cases: [], cleanup: [], cleanupErrors: [], testsExecuted: 0,
  caseInventory: cases.map(c => ({ ...c, caseAstHash: hash(declarations.find(s => s.expression.arguments[0]?.text === c.id).getText()), sourceHash: hash(originals.get(`${app}/${c.file}`)) })),
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])),
  harnessHashes: Object.fromEntries(harnessFiles.map(f => [f, hash(fs.readFileSync(f))])),
};
const save = () => fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify(manifest, null, 2));
function verifyRoot() {
  const stat = fs.lstatSync(sandbox);
  need(!stat.isSymbolicLink() && stat.dev === identity.dev && stat.ino === identity.ino
    && fs.realpathSync(sandbox) === sandbox && root !== sandbox && !root.startsWith(sandbox + path.sep), "E7_CLEANUP_ROOT_ESCAPE");
}
function cleanupTrees(reason) {
  for (const tree of owned) {
    verifyRoot(); need(path.dirname(tree.dest) === sandbox && fs.realpathSync(tree.dest) === tree.dest && !fs.lstatSync(tree.dest).isSymbolicLink(), "E7_CLEANUP_TREE_ESCAPE");
    const files = {};
    for (const name of fs.readdirSync(tree.cwd).filter(n => /(?:\.json|\.log)$/.test(n))) {
      const source = path.join(tree.cwd, name), target = `${path.basename(tree.dest)}-retained-${name}`;
      if (fs.statSync(source).isFile()) { fs.copyFileSync(source, path.join(evidence, target)); files[name] = { target, hash: hash(fs.readFileSync(source)) }; }
    }
    const row = { reason, tree: tree.dest, files, bundleHash: fs.existsSync(tree.plan.output) ? hash(fs.readFileSync(tree.plan.output)) : null, removed: false };
    manifest.cleanup.push(row); save();
    fs.rmSync(tree.dest, { recursive: true, force: false }); owned.delete(tree); row.removed = true; save();
  }
}
function modules(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    if (entry.startsWith(".") || entry === "@workspace") continue;
    const source = path.join(from, entry), dest = path.join(to, entry);
    if (entry.startsWith("@")) { modules(source, dest); continue; }
    const real = fs.realpathSync(source); need(real.includes("/node_modules/"), "E7_DEPENDENCY_ESCAPE"); fs.symlinkSync(real, dest, "dir");
  }
}
function tree(name, mutation) {
  const dest = path.join(sandbox, name); need(path.dirname(dest) === sandbox, "E7_TREE_ESCAPE"); fs.mkdirSync(dest);
  const cwd = path.join(dest, app), result = { dest, cwd, plan: { output: path.join(cwd, "case.test.cjs") } }; owned.add(result);
  for (const [file, bytes] of originals) { const out = path.join(dest, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, bytes); }
  const aliases = { "@": path.join(cwd, "src") };
  for (const file of [...originals.keys()].filter(f => /^lib\/[^/]+\/package.json$/.test(f))) {
    const pkg = JSON.parse(originals.get(file)), exp = pkg.exports?.["."], entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") aliases[pkg.name] = path.resolve(dest, path.dirname(file), entry);
    const deps = path.join(root, path.dirname(file), "node_modules");
    if (fs.existsSync(deps)) modules(deps, path.join(dest, path.dirname(file), "node_modules"));
  }
  modules(path.join(root, app, "node_modules"), path.join(cwd, "node_modules"));
  for (const helper of helpers) fs.copyFileSync(`${infrastructure}/${helper}`, path.join(cwd, helper));
  fs.copyFileSync(builder, path.join(cwd, "frontend-node-build.mjs"));
  const transport = path.join(cwd, "src/components/e7-node-test-transport.ts");
  for (const f of ["e7", "e11", "e5"]) aliases[`@/lib/${f}-feature-flags`] = transport;
  if (mutation) {
    const out = path.join(cwd, mutation.file);
    need(fs.realpathSync(out).startsWith(dest + path.sep), "E7_MUTATION_ESCAPE");
    fs.writeFileSync(out, originals.get(`${app}/${mutation.file}`).toString().replace(mutation.before, mutation.after));
  }
  result.plan = { ...result.plan, test: path.join(cwd, testFile), metafile: path.join(cwd, "build-inputs.json"), aliases, transport };
  fs.writeFileSync(path.join(cwd, "build-plan.json"), JSON.stringify(result.plan)); return result;
}
function run(t, argv, name) {
  const fd = fs.openSync(path.join(evidence, `${name}.log`), "wx"); let result;
  try { result = spawnSync(process.execPath, argv, { cwd: t.cwd, timeout: 60000, stdio: ["ignore", fd, fd],
    env: { PATH: path.dirname(process.execPath), HOME: t.dest, TMPDIR: t.dest, NODE_ENV: "test", LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1",
      E4_SANDBOX: t.dest, E4_LIVE_ROOT: root, E4_ESBUILD: binary, E4_ESBUILD_MODULE: compiler,
      NODE_OPTIONS: `--require=${path.join(t.cwd, "frontend-offline-guard.cjs")}` } }); }
  finally { fs.closeSync(fd); }
  need(!result.error && !result.signal, `E7_PROCESS_FAILURE ${name}: ${result.error ?? result.signal}`);
  return { exit: result.status, log: fs.readFileSync(path.join(evidence, `${name}.log`), "utf8") };
}
function build(t, name) {
  const result = run(t, [path.join(t.cwd, "frontend-node-build.mjs"), path.join(t.cwd, "build-plan.json")], `${name}-build`);
  need(result.exit === 0, `E7_BUILD_FAILURE_NOT_RED ${name}`);
  fs.copyFileSync(t.plan.metafile, path.join(evidence, `${name}-inputs.json`));
}
function execute(t, c, phase) {
  const name = `${c.id}-${phase}`; build(t, name);
  const output = path.join(t.cwd, `${name}.json`);
  const argv = ["--require", path.join(t.cwd, "frontend-node-dom.cjs"), "--test", "--test-isolation=none", "--test-name-pattern", `^${c.id}$`,
    "--test-reporter=tap", "--test-reporter-destination=stdout", `--test-reporter=${path.join(t.cwd, "frontend-node-reporter.mjs")}`, `--test-reporter-destination=${output}`, t.plan.output];
  const result = run(t, argv, name); manifest.testsExecuted++;
  const native = JSON.parse(fs.readFileSync(output)); fs.copyFileSync(output, path.join(evidence, `${name}.json`));
  const actuals = native.tests.filter(t => !t.skipped);
  need(actuals.length === 1 && actuals[0].name === c.id, `E7_EXACT_SELECTION ${name}`);
  need(!/E4_OFFLINE|E4_.*ESCAPE|E11_UNCONFIGURED|E7_INFRASTRUCTURE|E7_ANCESTOR_CONTROL|E7_REAL_PARENT_CONTROL|E7_REAL_SCOPE_SELECTOR_CONTROL|E7_BINARY_FIXTURE_HASH_MISMATCH|same key|unique ["']key["']|SyntaxError|TypeError|ReferenceError|MODULE_NOT_FOUND/.test(result.log), `E7_INFRASTRUCTURE_NOT_RED ${name}`);
  const actual = actuals[0], wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
  const code = wrapped ? actual.causeCode : actual.code, message = wrapped ? actual.causeMessage : actual.message;
  if (phase === "red") need(result.exit === 1 && actual.status === "failed" && code === "ERR_ASSERTION" && (message === c.id || message?.startsWith(`${c.id}\n`)), `E7_SPECIFIC_RED_REQUIRED ${name}`);
  else need(result.exit === 0 && actual.status === "passed", `E7_GREEN_REQUIRED ${name}`);
  return { actual, exit: result.exit, argv, bundleHash: hash(fs.readFileSync(t.plan.output)), sourceHash: hash(fs.readFileSync(path.join(t.cwd, c.file))) };
}
save();
try {
  if (buildOnly) {
    const t = tree("build-only"); build(t, "build-only");
    manifest.bundleHash = hash(fs.readFileSync(t.plan.output)); manifest.status = "PASS_BUILD_ONLY_ZERO_CASES_NOT_UI_GREEN";
  } else for (const id of ids) {
    const c = cases.find(c => c.id === id), green = tree(`${id}-green`), row = { id };
    manifest.cases.push(row); save(); row.green = execute(green, c, "green"); save();
    const red = tree(`${id}-red`, c); row.red = execute(red, c, "red"); save();
    fs.writeFileSync(path.join(red.cwd, c.file), originals.get(`${app}/${c.file}`));
    row.restored = execute(red, c, "restored"); save(); cleanupTrees(`terminal:${id}`);
    manifest.status = "PASS_SELECTED_ONLY_NOT_FULL_E7";
  }
} catch (e) { manifest.status = "FAIL_NOT_ACCEPTED"; manifest.error = String(e); process.exitCode = 1; }
finally {
  manifest.changedSources = [...originals].filter(([f, b]) => hash(fs.readFileSync(f)) !== hash(b)).map(([f]) => f);
  manifest.changedHarness = Object.entries(manifest.harnessHashes).filter(([f, h]) => hash(fs.readFileSync(f)) !== h).map(([f]) => f);
  if (manifest.changedSources.length || manifest.changedHarness.length) { manifest.status = "FAIL_SOURCE_CHANGED"; process.exitCode = 1; }
  save();
  try { cleanupTrees("finished-or-failed"); verifyRoot(); fs.rmdirSync(sandbox); manifest.sandboxRemoved = true; }
  catch (e) { manifest.cleanupErrors.push(String(e)); manifest.status = "FAIL_CLEANUP"; process.exitCode = 1; }
  save(); console.log(`${path.relative(root, evidence)}/manifest.json (${manifest.status})`);
}