// Offline module-import preparation only. Never imports a test declaration,
// invokes App/hooks, renders React, sends requests or runs a UI/native case.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.cwd(), app = "artifacts/mariana-textil";
const require = createRequire(path.join(root, app, "package.json"));
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
const binary = fs.realpathSync(createRequire(compiler).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const hash = b => createHash("sha256").update(b).digest("hex");
const need = (ok, message) => { if (!ok) throw Error(message); };
const originals = new Map();
function collect(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(item.name)) continue;
    const file = `${dir}/${item.name}`; need(!item.isSymbolicLink(), "SOURCE_SYMLINK");
    if (item.isDirectory()) collect(file);
    else if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) originals.set(file, fs.readFileSync(file));
  }
}
collect(`${app}/src`); collect("lib");
for (const file of [`${app}/package.json`, "reports/e7/frontend-fixtures.ts", "reports/e7/frontend-document-bytes.json",
  "reports/e7/prepare-frontend-runtime-imports.mjs", "reports/e11/frontend-node-build.mjs",
  "reports/tanda-b-20260922/e12/frontend-offline-guard.cjs", "reports/tanda-b-20260922/e12/frontend-node-dom.cjs"])
  originals.set(file, fs.readFileSync(file));
const evidence = `reports/e7/frontend-runtime-imports-${new Date().toISOString().replaceAll(":", "-")}`;
fs.mkdirSync(evidence);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e7-imports-")), identity = fs.lstatSync(sandbox);
const tree = path.join(sandbox, "source"), cwd = path.join(tree, app);
const report = { status: "PREPARING", testsExecuted: 0, appRendered: false, apiCalls: 0, dbCalls: 0,
  sandbox, cleanupErrors: [], sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])) };
const save = () => fs.writeFileSync(`${evidence}/manifest.json`, JSON.stringify(report, null, 2));
function modules(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (name.startsWith(".") || name === "@workspace") continue;
    if (name.startsWith("@")) { modules(path.join(from, name), path.join(to, name)); continue; }
    const real = fs.realpathSync(path.join(from, name)); need(real.includes("/node_modules/"), "DEPENDENCY_ESCAPE");
    fs.symlinkSync(real, path.join(to, name), "dir");
  }
}
save();
try {
  for (const [file, bytes] of originals) {
    const out = path.join(tree, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, bytes);
  }
  modules(path.join(root, app, "node_modules"), path.join(cwd, "node_modules"));
  const aliases = { "@": path.join(cwd, "src") };
  for (const file of [...originals.keys()].filter(f => /^lib\/[^/]+\/package.json$/.test(f))) {
    const pkg = JSON.parse(originals.get(file)), exp = pkg.exports?.["."], entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") aliases[pkg.name] = path.resolve(tree, path.dirname(file), entry);
    const deps = path.join(root, path.dirname(file), "node_modules");
    if (fs.existsSync(deps)) modules(deps, path.join(tree, path.dirname(file), "node_modules"));
  }
  const transport = path.join(cwd, "src/components/e7-node-test-transport.ts");
  for (const name of ["e7", "e11", "e5"]) aliases[`@/lib/${name}-feature-flags`] = transport;
  const entry = path.join(cwd, "imports.ts"), output = path.join(cwd, "imports.cjs"), metafile = path.join(cwd, "inputs.json");
  fs.writeFileSync(entry, 'export { default as App } from "./src/App";\nexport * as api from "@workspace/api-client-react";\nexport * as transport from "./src/components/e7-node-test-transport";\nexport * as downloads from "./src/components/e7-node-download-support";\n');
  const plan = path.join(cwd, "plan.json"); fs.writeFileSync(plan, JSON.stringify({ test: entry, output, metafile, aliases, transport }));
  const guard = path.join(tree, "reports/tanda-b-20260922/e12/frontend-offline-guard.cjs");
  function run(args, name) {
    const fd = fs.openSync(`${evidence}/${name}.log`, "wx"); let result;
    try { result = spawnSync(process.execPath, args, { cwd, timeout: 60000, stdio: ["ignore", fd, fd],
      env: { PATH: path.dirname(process.execPath), HOME: tree, TMPDIR: tree, NODE_ENV: "test", TZ: "UTC",
        E4_SANDBOX: tree, E4_LIVE_ROOT: root, E4_ESBUILD: binary, E4_ESBUILD_MODULE: compiler,
        NODE_OPTIONS: `--require=${guard}` } }); } finally { fs.closeSync(fd); }
    need(!result.error && !result.signal && result.status === 0, `IMPORT_PREPARATION_FAILED ${name}`);
  }
  run([path.join(tree, "reports/e11/frontend-node-build.mjs"), plan], "build");
  fs.copyFileSync(metafile, `${evidence}/build-inputs.json`); report.bundleHash = hash(fs.readFileSync(output));
  const smoke = path.join(cwd, "import-only.cjs");
  fs.writeFileSync(smoke, 'const Module = require("node:module"); const load = Module._load;\nModule._load = function(id, ...args) { if (id === "node:test") throw Error("TEST_IMPORT_FORBIDDEN"); return load.call(this, id, ...args); };\nconst m = require("./imports.cjs");\nif (typeof m.App !== "function" || typeof m.api.useGetE7Atribucion !== "function" || typeof m.api.listClienteDocumentos !== "function" || typeof m.transport.resetE7 !== "function" || typeof m.downloads.serializedBlob !== "function") throw Error("MODULE_EXPORT_MISSING");\nconsole.log("PASS_RUNTIME_IMPORTS_ONLY_ZERO_RENDER_ZERO_CASES_ZERO_REQUESTS"); process.exit(0);\n');
  const dom = path.join(cwd, "runtime-dom.cjs");
  fs.copyFileSync(path.join(tree, "reports/tanda-b-20260922/e12/frontend-node-dom.cjs"), dom);
  run(["--require", dom, smoke], "imports");
  report.status = "PASS_RUNTIME_IMPORTS_ONLY_ZERO_CASES_NO_APP_RENDER";
} catch (error) { report.status = "FAIL_RUNTIME_IMPORT_PREPARATION"; report.error = String(error); process.exitCode = 1; }
finally {
  report.changedSources = [...originals].filter(([file, bytes]) => hash(fs.readFileSync(file)) !== hash(bytes)).map(([file]) => file);
  if (report.changedSources.length) { report.status = "FAIL_SOURCE_DRIFT"; process.exitCode = 1; }
  save();
  try {
    const stat = fs.lstatSync(sandbox);
    need(stat.dev === identity.dev && stat.ino === identity.ino && !stat.isSymbolicLink()
      && fs.realpathSync(sandbox) === sandbox && fs.realpathSync(tree) === tree
      && path.dirname(tree) === sandbox && root !== sandbox && !root.startsWith(sandbox + path.sep), "CLEANUP_ESCAPE");
    fs.rmSync(tree, { recursive: true, force: false }); fs.rmdirSync(sandbox); report.sandboxRemoved = true;
  } catch (error) { report.cleanupErrors.push(String(error)); report.status = "FAIL_CLEANUP"; process.exitCode = 1; }
  save(); console.log(`${evidence}/manifest.json (${report.status})`);
}