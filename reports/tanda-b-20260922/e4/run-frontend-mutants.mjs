/**
 * MAIN ONLY: node reports/tanda-b-20260922/e4/run-frontend-mutants.mjs
 * No application, API, SQL, workflow or production build is started.
 * Legacy frontend-mutants evidence is NOT ACCEPTED and is never overwritten.
 */
throw new Error("RETIRED_NOT_ACCEPTED: Vitest isolation approach stopped. MAIN must use run-frontend-node-mutants.mjs; do not retry this runner.");
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { cases } from "./frontend-mutants-cases.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const app = "artifacts/mariana-textil";
const hash = value => createHash("sha256").update(value).digest("hex");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e4-frontend-"));
const evidence = path.join(dir, `frontend-mutants-${new Date().toISOString().replaceAll(":", "-")}`);
fs.mkdirSync(evidence);
const originals = new Map();
function collect(relative) {
  for (const ent of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(ent.name)) continue;
    const file = path.join(relative, ent.name);
    if (ent.isSymbolicLink()) throw Error(`Source symlink forbidden: ${file}`);
    if (ent.isDirectory()) collect(file);
    else originals.set(file, fs.readFileSync(path.join(root, file)));
  }
}
collect(`${app}/src`);
collect("lib");
for (const file of [`${app}/package.json`, "tsconfig.base.json"]) {
  if (!fs.existsSync(path.join(root, file))) throw Error(`Required snapshot input missing: ${file}`);
  originals.set(file, fs.readFileSync(path.join(root, file)));
}
const packages = [...originals.keys()].filter(f => /^lib\/[^/]+\/package.json$/.test(f)).map(file => {
  const json = JSON.parse(originals.get(file));
  return { file, json };
});
const require = createRequire(path.join(root, app, "package.json"));
const ts = require("typescript");
const vitestPackage = require.resolve("vitest/package.json");
const vitest = path.resolve(path.dirname(vitestPackage), JSON.parse(fs.readFileSync(vitestPackage, "utf8")).bin.vitest);
if (!fs.existsSync(vitest)) throw Error("Installed Vitest CLI missing");
const viteRequire = createRequire(require.resolve("vite/package.json"));
const esbuildRequire = createRequire(viteRequire.resolve("esbuild"));
const esbuildBinary = fs.realpathSync(esbuildRequire.resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const manifest = {
  status: "PREPARED_NOT_EXECUTED", sandbox, legacy: "NOT_ACCEPTED",
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])),
  cases: [], plannedCases: cases,
  harnessHashes: Object.fromEntries(["run-frontend-mutants.mjs", "frontend-mutants-cases.mjs", "frontend-offline-guard.cjs", "frontend-vitest-setup.ts", "frontend-config-preflight.mjs"]
    .map(f => [f, hash(fs.readFileSync(path.join(dir, f)))])),
};
const save = () => fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify(manifest, null, 2));
const tests = [...new Set(cases.map(c => c.testFile))];
if (!cases.length || !tests.length) throw Error("Empty explicit manifest");
for (const testFile of tests) {
  const text = originals.get(`${app}/${testFile}`)?.toString();
  if (!text) throw Error(`Missing test: ${testFile}`);
  const declared = [...text.matchAll(/\btest\("([^"]+)"/g)].map(m => m[1]);
  const selected = cases.filter(c => c.testFile === testFile).map(c => c.title);
  if (!declared.length || declared.length !== selected.length || declared.some(n => selected.filter(s => s === n).length !== 1))
    throw Error(`Every test requires one explicit negative control: ${testFile}`);
}
save();
function snapshot(label, mutation) {
  const dest = path.join(sandbox, label);
  fs.mkdirSync(dest);
  for (const [file, bytes] of originals) {
    const output = path.join(dest, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes);
  }
  const aliases = { "@": path.join(dest, app, "src") };
  function externalModules(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
      // Caches/.bin are never shared. Scopes themselves remain physical.
      if (ent.name.startsWith(".") || ent.name === "@workspace") continue;
      const input = path.join(from, ent.name);
      const output = path.join(to, ent.name);
      if (ent.name.startsWith("@")) { externalModules(input, output); continue; }
      const real = fs.realpathSync(input);
      if (!real.includes(`${path.sep}node_modules${path.sep}`))
        throw Error(`External dependency resolves to mutable source: ${input}`);
      fs.symlinkSync(real, output, "dir");
    }
  }
  for (const { file, json } of packages) {
    const pkg = path.join(dest, path.dirname(file));
    const exp = json.exports?.["."];
    const entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") aliases[json.name] = path.resolve(pkg, entry);
    const modules = path.join(root, path.dirname(file), "node_modules");
    if (fs.existsSync(modules)) externalModules(modules, path.join(pkg, "node_modules"));
  }
  externalModules(path.join(root, app, "node_modules"), path.join(dest, app, "node_modules"));
  if (mutation) {
    const file = path.join(dest, app, mutation.file);
    const real = fs.realpathSync(file);
    if (!real.startsWith(dest + path.sep) || fs.lstatSync(file).isSymbolicLink()) throw Error("Mutation escaped physical snapshot");
    const before = fs.readFileSync(file, "utf8");
    if (before.split(mutation.before).length !== 2) throw Error(`Nonunique mutation anchor: ${mutation.id}`);
    const changed = before.replace(mutation.before, mutation.after);
    const ast = ts.createSourceFile(file, changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    if (ast.parseDiagnostics.length) throw Error(`Invalid syntax mutant rejected: ${mutation.id}`);
    fs.writeFileSync(file, changed);
  }
  const config = path.join(dest, app, "e4-vitest.config.mjs");
  fs.copyFileSync(path.join(dir, "frontend-vitest-setup.ts"), path.join(dest, "setup.ts"));
  fs.copyFileSync(path.join(dir, "frontend-offline-guard.cjs"), path.join(dest, "guard.cjs"));
  fs.writeFileSync(config, `
import fs from "node:fs";
export default {
  cacheDir: ${JSON.stringify(path.join(dest, "vite-cache"))},
  resolve: { alias: ${JSON.stringify(aliases)}, dedupe: ["react", "react-dom"] },
  esbuild: { jsx: "automatic" },
  plugins: [{
    name: "physical-workspace-only", enforce: "pre",
    resolveId(id) {
      if (/^(?:@workspace\\/db|pg|postgres|mysql2?|better-sqlite3)(?:\\/|$)/.test(id))
        throw Error("E4_OFFLINE_DB_IMPORT: " + id);
    },
    load(id) {
      const clean = id.split("?")[0];
      if (!clean.startsWith("/") || !fs.existsSync(clean)) return;
      const real = fs.realpathSync(clean);
      if (real.startsWith(${JSON.stringify(root + "/")}) && !real.includes("/node_modules/"))
        throw Error("E4_LIVE_SOURCE_ESCAPE: " + real);
      if (clean.includes("@workspace/") && !real.startsWith(${JSON.stringify(dest + "/")}))
        throw Error("E4_WORKSPACE_ESCAPE: " + real);
    }
  }],
  server: { watch: null, ws: false },
  test: { include: ${JSON.stringify(tests)}, pool: "threads", maxWorkers: 1,
    minWorkers: 1, fileParallelism: false, isolate: true,
    setupFiles: [${JSON.stringify(path.join(dest, "setup.ts"))}], testTimeout: 10000, hookTimeout: 10000 }
};`);
  return { dest, config };
}
function childEnvironment(tree) {
  return {
    PATH: path.dirname(process.execPath), HOME: tree.dest, TMPDIR: tree.dest,
    NODE_ENV: "test", LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1",
    E4_SANDBOX: tree.dest, E4_ESBUILD: esbuildBinary, E4_LIVE_ROOT: root,
    NODE_OPTIONS: `--require=${path.join(tree.dest, "guard.cjs")}`,
  };
}
function execute(tree, entry, phase) {
  const output = path.join(tree.dest, `${entry.id}-${phase}.json`);
  const guard = path.join(tree.dest, "guard.cjs");
  fs.copyFileSync(path.join(dir, "frontend-offline-guard.cjs"), guard);
  const env = childEnvironment(tree);
  const escaped = `${entry.suite} ${entry.title}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const args = [vitest, "run", "--config", tree.config, entry.testFile,
    "--testNamePattern", `^${escaped}$`, "--reporter=json", `--outputFile=${output}`];
  const logfile = path.join(evidence, `${entry.id}-${phase}.log`);
  const fd = fs.openSync(logfile, "wx");
  let result;
  try {
    result = spawnSync(process.execPath, args, {
      cwd: path.join(tree.dest, app), env, timeout: 60000, stdio: ["ignore", fd, fd],
    });
  } finally { fs.closeSync(fd); }
  const logs = fs.readFileSync(logfile, "utf8");
  if (result.error || result.signal || !fs.existsSync(output)) throw Error(`Runner/setup failure ${entry.id}/${phase}: ${result.error ?? result.signal}`);
  const raw = fs.readFileSync(output, "utf8");
  fs.writeFileSync(path.join(evidence, `${entry.id}-${phase}.json`), raw);
  const report = JSON.parse(raw);
  const executed = report.testResults.flatMap(s => s.assertionResults).filter(a => !["pending", "skipped", "todo"].includes(a.status));
  if (executed.length !== 1 || executed[0].title !== entry.title || report.numTotalTestSuites < 1)
    throw Error(`Wrong/empty exact selection: ${entry.id}/${phase}`);
  const assertion = executed[0];
  const messages = assertion.failureMessages.join("\n");
  if (report.numRuntimeErrorTestSuites || /SyntaxError|TransformError|E4_OFFLINE|E4_.*ESCAPE|Unhandled|ERR_MODULE_NOT_FOUND/.test(logs + messages))
    throw Error(`Infrastructure failure is NOT a red: ${entry.id}/${phase}`);
  if (phase !== "red") {
    if (result.status !== 0 || assertion.status !== "passed") throw Error(`GREEN failed: ${entry.id}/${phase}`);
  } else if (result.status !== 1 || assertion.status !== "failed" || !messages.includes("AssertionError") || !messages.includes(entry.assertion)) {
    throw Error(`Not the expected semantic assertion: ${entry.id}`);
  }
  return { exit: result.status, status: assertion.status, args, sourceHashes: Object.fromEntries(
    [...originals.keys()].map(f => [f, hash(fs.readFileSync(path.join(tree.dest, f)))])
  ) };
}
try {
  // This explicit mode loads config/transforms only: no Vitest test collection,
  // no createServer/listen and no application or component execution.
  if (process.argv.includes("--preflight-only")) {
    const tree = snapshot("config-preflight");
    const script = path.join(tree.dest, app, "preflight.mjs");
    fs.copyFileSync(path.join(dir, "frontend-config-preflight.mjs"), script);
    const fd = fs.openSync(path.join(evidence, "config-preflight.log"), "wx");
    let result;
    try {
      result = spawnSync(process.execPath, [script, tree.config, ...tests], {
        cwd: path.join(tree.dest, app), env: childEnvironment(tree), timeout: 60000,
        stdio: ["ignore", fd, fd],
      });
    } finally { fs.closeSync(fd); }
    if (result.error || result.signal || result.status !== 0) throw Error("Config/transform preflight failed; see config-preflight.log");
    manifest.status = "CONFIG_TRANSFORM_PREFLIGHT_ONLY_NOT_TEST_PASS";
  } else {
  for (const entry of cases) {
    const green = snapshot(`${entry.id}-green`);
    const result = { id: entry.id, testHash: hash(originals.get(`${app}/${entry.testFile}`)),
      originalHash: hash(originals.get(`${app}/${entry.file}`)), greenSandbox: green.dest };
    manifest.cases.push(result); save();
    result.green = execute(green, entry, "green"); save();
    const red = snapshot(`${entry.id}-red`, entry);
    result.redSandbox = red.dest;
    result.mutantHash = hash(fs.readFileSync(path.join(red.dest, app, entry.file))); save();
    result.red = execute(red, entry, "red"); save();
    // Restore only the isolated physical copy, and demand a second green.
    fs.writeFileSync(path.join(red.dest, app, entry.file), originals.get(`${app}/${entry.file}`));
    result.restored = execute(red, entry, "restored"); save();
  }
  manifest.status = "PASS";
  }
} catch (error) {
  manifest.status = "FAIL_NOT_ACCEPTED"; manifest.error = String(error); process.exitCode = 1;
} finally {
  const changed = [...originals].filter(([f, b]) => hash(fs.readFileSync(path.join(root, f))) !== hash(b)).map(([f]) => f);
  if (changed.length) { manifest.status = "FAIL_SOURCE_CHANGED"; manifest.changed = changed; process.exitCode = 1; }
  manifest.finishedAt = new Date().toISOString(); save();
  console.log(`Evidence: ${path.relative(root, evidence)} (${manifest.status})`);
}