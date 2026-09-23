// MAIN ONLY dynamic cases. --build-only is an explicitly authorized zero-case preflight.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cases, coverageStatus, knownGreenBlockers, hookCoverage, recoveryObligations, pendingRecoveryObligations } from "./frontend-mutants-cases.mjs";
const directory = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(directory, "../..");
const app = "artifacts/mariana-textil", testFile = "src/components/e11-node.dom.test.tsx";
const infrastructure = "reports/tanda-b-20260922/e12";
const helpers = ["frontend-offline-guard.cjs", "frontend-node-dom.cjs", "frontend-node-reporter.mjs"];
const builder = "reports/e11/frontend-node-build.mjs";
const hash = b => createHash("sha256").update(b).digest("hex");
const need = (v, message) => { if (!v) throw Error(message); };
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
const binary = fs.realpathSync(createRequire(compiler).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const originals = new Map(), excluded = [];
function collect(rel) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const file = `${rel}/${entry.name}`;
    need(!entry.isSymbolicLink(), `E11_SOURCE_SYMLINK ${file}`);
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) && file !== `${app}/${testFile}`) { excluded.push(file); continue; }
    if (entry.isDirectory()) collect(file); else originals.set(file, fs.readFileSync(path.join(root, file)));
  }
}
collect(`${app}/src`); collect("lib");
for (const file of [`${app}/package.json`, "tsconfig.base.json"]) originals.set(file, fs.readFileSync(path.join(root, file)));
const declared = [...originals.get(`${app}/${testFile}`).toString().matchAll(/\btest\("([^"]+)"/g)].map(m => m[1]);
need(declared.length === cases.length && new Set(declared).size === cases.length && new Set(cases.map(c => c.id)).size === cases.length &&
  cases.every(c => declared.includes(c.id)), "E11_EXACT_TEST_MUTANT_BIJECTION");
for (const c of cases) {
  need(/^src\/(?:(?:pages|components|hooks|lib)\/.+|App)\.[jt]sx?$/.test(c.file) && !/(test|fixture|harness)/.test(c.file) && c.before !== c.after && c.assertion === c.id, `E11_INVALID_MUTANT ${c.id}`);
  const source = originals.get(`${app}/${c.file}`)?.toString();
  need(source?.split(c.before).length === 2, `E11_NONUNIQUE_ANCHOR ${c.id}`);
  need(!ts.createSourceFile(c.file, source.replace(c.before, c.after), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, `E11_MUTANT_SYNTAX ${c.id}`);
}
const args = process.argv.slice(2), buildOnly = args.length === 1 && args[0] === "--build-only";
need(buildOnly || args.length === 0 || (args.length === 2 && args[0] === "--ids"), "Usage MAIN: [--ids E11-ID,...]; authorized preflight: --build-only");
const ids = args.length && !buildOnly ? args[1].split(",") : cases.map(c => c.id);
need(ids.length && new Set(ids).size === ids.length && ids.every(id => declared.includes(id)), "E11_INVALID_SELECTION");
const selected = ids.map(id => cases.find(c => c.id === id));
const evidence = path.join(directory, `frontend-node-mutants-${new Date().toISOString().replaceAll(":", "-")}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e11-node-"));
const sandboxIdentity = fs.lstatSync(sandbox), ownedTrees = new Set();
fs.mkdirSync(evidence);
const harnessFiles = [...helpers.map(f => `${infrastructure}/${f}`), builder, "reports/e11/frontend-mutants-cases.mjs", "reports/e11/run-frontend-node-mutants.mjs", "reports/e5/frontend-node-build.mjs"];
const manifest = {
  status: "PREPARED_NOT_EXECUTED", coverageStatus, knownGreenBlockers, mode: buildOnly ? "BUILD_ONLY_NO_CASE_EXECUTION" : "GREEN_SPECIFIC_RED_RESTORED",
  hookCoverage, recoveryObligations, pendingRecoveryObligations,
  cleanup: [], cleanupErrors: [],
  sandbox, testFile, selectedIds: ids, selectedCount: ids.length, declaredTestCount: declared.length, plannedCases: selected, cases: [],
  omittedDeclaredIds: declared.filter(id => !ids.includes(id)), excludedTestSources: excluded,
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])),
  harnessHashes: Object.fromEntries(harnessFiles.map(f => [f, hash(fs.readFileSync(path.join(root, f)))])),
  isolation: "Original E12 guard/DOM/reporter byte preserved; E11 derivative builder from E5. Real generated hooks; only network and test gates replaced.",
};
const save = () => fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify(manifest, null, 2));
save();
function verifySandbox() {
  const stat = fs.lstatSync(sandbox);
  need(!stat.isSymbolicLink() && stat.isDirectory() && stat.dev === sandboxIdentity.dev && stat.ino === sandboxIdentity.ino
    && fs.realpathSync(sandbox) === sandbox && sandbox !== root && !root.startsWith(sandbox + path.sep)
    && sandbox !== evidence && !evidence.startsWith(sandbox + path.sep), "E11_CLEANUP_ROOT_ESCAPE");
}
function cleanupOwnedTrees(reason) {
  for (const dest of [...ownedTrees]) {
    verifySandbox();
    need(path.dirname(dest) === sandbox && fs.realpathSync(dest) === dest && !fs.lstatSync(dest).isSymbolicLink(), "E11_CLEANUP_TREE_ESCAPE");
    const cwd = path.join(dest, app), artifacts = {};
    // Logs already live in reports and spawnSync has closed their descriptors.
    // Preserve even incomplete phase native reports/metafiles before removal.
    if (fs.existsSync(cwd)) for (const name of fs.readdirSync(cwd)) {
      if (!["build-plan.json", "build-inputs.json"].includes(name) && !/^E11-.+\.json$/.test(name)) continue;
      const file = path.join(cwd, name);
      need(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), "E11_CLEANUP_EVIDENCE_ESCAPE");
      const bytes = fs.readFileSync(file), retained = `retained-${path.basename(dest)}-${name}`;
      fs.writeFileSync(path.join(evidence, retained), bytes, { flag: "wx" });
      artifacts[retained] = hash(bytes);
    }
    const bundle = path.join(cwd, "case.test.cjs");
    const row = { tree: dest, reason, artifacts, bundleHash: fs.existsSync(bundle) ? hash(fs.readFileSync(bundle)) : null, status: "EVIDENCE_PERSISTED_BEFORE_REMOVAL" };
    manifest.cleanup.push(row);
    save(); // Failure here deliberately retains the tree; never delete unrecorded evidence.
    // rm removes nested dependency symlinks themselves, never their targets.
    fs.rmSync(dest, { recursive: true, force: false, maxRetries: 2 });
    ownedTrees.delete(dest); row.status = "REMOVED_OWN_TREE"; save();
  }
}
function modules(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "@workspace") continue;
    const source = path.join(from, entry.name), dest = path.join(to, entry.name);
    if (entry.name.startsWith("@")) { modules(source, dest); continue; }
    const real = fs.realpathSync(source); need(real.includes("/node_modules/"), "E11_EXTERNAL_ESCAPE"); fs.symlinkSync(real, dest, "dir");
  }
}
function tree(name, mutation) {
  const dest = path.join(sandbox, name);
  need(path.dirname(dest) === sandbox && !ownedTrees.has(dest), "E11_TREE_ESCAPE");
  fs.mkdirSync(dest); ownedTrees.add(dest);
  for (const [file, bytes] of originals) { const out = path.join(dest, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, bytes); }
  const cwd = path.join(dest, app), aliases = { "@": path.join(cwd, "src") };
  for (const file of [...originals.keys()].filter(f => /^lib\/[^/]+\/package.json$/.test(f))) {
    const pkg = JSON.parse(originals.get(file)), exp = pkg.exports?.["."], entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") aliases[pkg.name] = path.resolve(dest, path.dirname(file), entry);
    const deps = path.join(root, path.dirname(file), "node_modules");
    if (fs.existsSync(deps)) modules(deps, path.join(dest, path.dirname(file), "node_modules"));
  }
  modules(path.join(root, app, "node_modules"), path.join(cwd, "node_modules"));
  for (const name of helpers) fs.copyFileSync(path.join(root, infrastructure, name), path.join(cwd, name));
  fs.copyFileSync(path.join(root, builder), path.join(cwd, "frontend-node-build.mjs"));
  const transport = path.join(cwd, "src/components/e11-node-test-transport.ts");
  aliases["@/lib/e11-feature-flags"] = transport; aliases["@/lib/e5-feature-flags"] = transport;
  if (mutation) {
    const out = path.join(cwd, mutation.file), source = fs.readFileSync(out, "utf8");
    need(fs.realpathSync(out).startsWith(dest + path.sep) && source.split(mutation.before).length === 2, "E11_MUTATION_ESCAPE");
    fs.writeFileSync(out, source.replace(mutation.before, mutation.after));
  }
  const plan = { test: path.join(cwd, testFile), output: path.join(cwd, "case.test.cjs"), metafile: path.join(cwd, "build-inputs.json"), aliases, transport };
  fs.writeFileSync(path.join(cwd, "build-plan.json"), JSON.stringify(plan));
  return { dest, cwd, plan };
}
function run(tree, argv, name) {
  const fd = fs.openSync(path.join(evidence, `${name}.log`), "wx"); let result;
  try {
    result = spawnSync(process.execPath, argv, { cwd: tree.cwd, timeout: 60000, stdio: ["ignore", fd, fd],
      env: { PATH: path.dirname(process.execPath), HOME: tree.dest, TMPDIR: tree.dest, NODE_ENV: "test", LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1",
        E4_SANDBOX: tree.dest, E4_LIVE_ROOT: root, E4_ESBUILD: binary, E4_ESBUILD_MODULE: compiler, NODE_OPTIONS: `--require=${path.join(tree.cwd, "frontend-offline-guard.cjs")}` } });
  } finally { fs.closeSync(fd); }
  need(!result.error && !result.signal, `E11_PROCESS_FAILURE ${name}: ${result.error ?? result.signal}`);
  return { exit: result.status, log: fs.readFileSync(path.join(evidence, `${name}.log`), "utf8") };
}
function build(tree, name) {
  const result = run(tree, [path.join(tree.cwd, "frontend-node-build.mjs"), path.join(tree.cwd, "build-plan.json")], `${name}-build`);
  need(result.exit === 0, `E11_BUILD_FAILURE_NOT_RED ${name}`);
  fs.copyFileSync(tree.plan.metafile, path.join(evidence, `${name}-inputs.json`));
}
function execute(tree, c, phase) {
  const name = `${c.id}-${phase}`; build(tree, name);
  const output = path.join(tree.cwd, `${name}.json`);
  const argv = ["--require", path.join(tree.cwd, "frontend-node-dom.cjs"), "--test", "--test-isolation=none", "--test-name-pattern", `^${c.id}$`,
    "--test-reporter=tap", "--test-reporter-destination=stdout", `--test-reporter=${path.join(tree.cwd, "frontend-node-reporter.mjs")}`, `--test-reporter-destination=${output}`, tree.plan.output];
  const result = run(tree, argv, name), native = JSON.parse(fs.readFileSync(output, "utf8"));
  fs.copyFileSync(output, path.join(evidence, `${name}.json`));
  const actuals = native.tests.filter(t => !t.skipped); need(actuals.length === 1 && actuals[0].name === c.id, `E11_EXACT_SELECTION ${name}`);
  const actual = actuals[0];
  need(!/E4_OFFLINE|E4_.*ESCAPE|E11_UNCONFIGURED|SyntaxError|TypeError|ReferenceError|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(result.log), `E11_INFRASTRUCTURE_NOT_RED ${name}`);
  if (phase === "red") {
    const wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
    const code = wrapped ? actual.causeCode : actual.code, message = wrapped ? actual.causeMessage : actual.message;
    need(result.exit === 1 && actual.status === "failed" && code === "ERR_ASSERTION" && (message === c.id || message?.startsWith(`${c.id}\n`)), `E11_SPECIFIC_ASSERTION_RED_REQUIRED ${name}`);
  } else need(result.exit === 0 && actual.status === "passed", `E11_GREEN_REQUIRED ${name}`);
  return { exit: result.exit, actual, args: argv, bundleHash: hash(fs.readFileSync(tree.plan.output)), caseSourceHash: hash(fs.readFileSync(path.join(tree.cwd, c.file))) };
}
try {
  if (buildOnly) {
    const snapshot = tree("build-only"); build(snapshot, "build-only");
    manifest.buildOnly = { executedCases: 0, validatedAnchors: cases.length, bundleHash: hash(fs.readFileSync(snapshot.plan.output)) };
    manifest.status = "PASS_BUILD_ONLY_ZERO_CASES_NOT_UI_GREEN";
  } else {
    for (const c of selected) {
      const green = tree(`${c.id}-green`), row = { id: c.id, assertion: c.id, originalHash: hash(originals.get(`${app}/${c.file}`)), greenSandbox: green.dest };
      manifest.cases.push(row); save(); row.green = execute(green, c, "green"); save();
      const red = tree(`${c.id}-red`, c); row.redSandbox = red.dest; row.mutantHash = hash(fs.readFileSync(path.join(red.cwd, c.file))); save();
      row.red = execute(red, c, "red"); save();
      fs.writeFileSync(path.join(red.cwd, c.file), originals.get(`${app}/${c.file}`));
      row.restored = execute(red, c, "restored"); save();
      cleanupOwnedTrees(`terminal:${c.id}`);
    }
    manifest.status = "PASS_SELECTED_DECLARED_UI_OBLIGATIONS_NOT_FULL_E11";
  }
} catch (e) {
  manifest.status = "FAIL_NOT_ACCEPTED"; manifest.error = String(e);
  manifest.failure = { code: e.code, syscall: e.syscall, path: e.path, stack: e.stack };
  process.exitCode = 1;
}
finally {
  manifest.changed = [...originals].filter(([f, b]) => hash(fs.readFileSync(path.join(root, f))) !== hash(b)).map(([f]) => f);
  manifest.changedHarness = Object.entries(manifest.harnessHashes).filter(([f, h]) => hash(fs.readFileSync(path.join(root, f))) !== h).map(([f]) => f);
  if (manifest.changed.length || manifest.changedHarness.length) { manifest.status = "FAIL_SOURCE_CHANGED"; process.exitCode = 1; }
  manifest.finishedAt = new Date().toISOString(); save();
  try {
    cleanupOwnedTrees(buildOnly ? "build-only-finished" : "run-finished-or-failed");
    verifySandbox();
    fs.rmdirSync(sandbox); // Nonrecursive: refuse if anything unowned remains.
    manifest.sandboxRemoved = true;
  } catch (e) {
    manifest.cleanupErrors.push({ message: String(e), code: e.code, path: e.path });
    if (!manifest.error) { manifest.error = String(e); manifest.status = "FAIL_CLEANUP_NOT_ACCEPTED"; }
    process.exitCode = 1;
  }
  save(); console.log(`Evidence: ${path.relative(root, evidence)} (${manifest.status})`);
}