/**
 * MAIN ONLY, background. Never invokes Vite, app, DB or a listener.
 * Prepared suite is not executed evidence. MAIN owns dynamic acceptance.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cases, coverageStatus } from "./frontend-mutants-cases.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, "../..");
const app = "artifacts/mariana-textil", testFile = "src/components/e5-node.dom.test.tsx";
const infrastructure = "reports/tanda-b-20260922/e12";
const helperNames = ["frontend-offline-guard.cjs", "frontend-node-dom.cjs", "frontend-node-reporter.mjs"];
const originalBuilder = `${infrastructure}/frontend-node-build.mjs`;
const derivedBuilder = "reports/e5/frontend-node-build.mjs";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(path.join(root, app, "package.json"));
const ts = require("typescript");
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
const binary = fs.realpathSync(createRequire(compiler).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`));
const originals = new Map(), excluded = [];
function collect(rel) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const file = path.join(rel, entry.name);
    if (entry.isSymbolicLink()) throw Error(`E5_SOURCE_SYMLINK ${file}`);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) && file !== `${app}/${testFile}`) { excluded.push(file); continue; }
    if (entry.isDirectory()) collect(file);
    else originals.set(file, fs.readFileSync(path.join(root, file)));
  }
}
// A physical byte snapshot: no live productive workspace aliases.
collect(`${app}/src`); collect("lib");
for (const file of [`${app}/package.json`, "tsconfig.base.json"]) originals.set(file, fs.readFileSync(path.join(root, file)));
const declared = [...originals.get(`${app}/${testFile}`).toString().matchAll(/\btest\("([^"]+)"/g)].map(m => m[1]);
if (!cases.length || declared.length !== cases.length || new Set(cases.map(c => c.id)).size !== cases.length ||
  cases.some(c => !/^E5-[A-Z0-9-]+$/.test(c.id) || declared.filter(id => id === c.id).length !== 1))
  throw Error("E5_EXPLICIT_ONE_TO_ONE_MANIFEST_REQUIRED");
for (const c of cases) {
  if (!/^src\/(?:(?:components|pages|lib|hooks)\/.+|App)\.[jt]sx?$/.test(c.file) || /(?:test|fixture|harness)/.test(c.file) ||
    !c.before || c.before === c.after || c.assertion !== c.id) throw Error(`E5_INVALID_PRODUCTIVE_MUTANT ${c.id}`);
  const source = originals.get(`${app}/${c.file}`)?.toString();
  if (!source || source.split(c.before).length !== 2) throw Error(`E5_NONUNIQUE_ANCHOR ${c.id}`);
  if (ts.createSourceFile(c.file, source.replace(c.before, c.after), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length)
    throw Error(`E5_MUTANT_SYNTAX ${c.id}`);
}
const args = process.argv.slice(2);
const buildOnly = args.length === 1 && args[0] === "--build-only";
if (!buildOnly && args.length && (args.length !== 2 || args[0] !== "--ids")) throw Error("MAIN ONLY cases: runner [--ids E5-ID,E5-ID]; explicitly authorized preflight: --build-only");
const ids = args.length && !buildOnly ? args[1].split(",") : cases.map(c => c.id);
if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !cases.some(c => c.id === id))) throw Error("E5_UNKNOWN_OR_DUPLICATE_SELECTION");
const selected = ids.map(id => cases.find(c => c.id === id));
const evidence = path.join(dir, `frontend-node-mutants-${new Date().toISOString().replaceAll(":", "-")}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e5-node-"));
fs.mkdirSync(evidence);
const helperBytes = new Map(helperNames.map(f => [f, fs.readFileSync(path.join(root, infrastructure, f))]));
helperBytes.set("frontend-node-build.mjs", fs.readFileSync(path.join(root, derivedBuilder)));
const harnessFiles = [...helperNames.map(f => `${infrastructure}/${f}`), originalBuilder, derivedBuilder,
  "reports/e5/frontend-mutants-cases.mjs", "reports/e5/run-frontend-node-mutants.mjs"];
const manifest = {
  status: "PREPARED_NOT_EXECUTED", coverageStatus,
  mode: buildOnly ? "BUILD_ONLY_NO_CASE_EXECUTION" : "GREEN_SPECIFIC_RED_RESTORED",
  coverageScope: selected.length === cases.length ? "ALL_DECLARED_E5_UI_OBLIGATIONS_NOT_BACKEND" : "EXPLICIT_PARTIAL_SELECTION_NOT_FULL_E5",
  sandbox, testFile, selectedIds: ids, plannedCases: selected, cases: [], excludedTestSources: excluded,
  declaredTestCount: declared.length, selectedCount: selected.length,
  omittedDeclaredIds: cases.filter(c => !ids.includes(c.id)).map(c => c.id),
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, hash(b)])),
  harnessHashes: Object.fromEntries(harnessFiles.map(f => [f, hash(fs.readFileSync(path.join(root, f)))])),
  isolation: "E12 guard/DOM/reporter byte-preserved; E5 derived builder; E4_* protocol values point exclusively to E5 snapshots",
  builderProvenance: {
    original: { path: originalBuilder, sha256: hash(fs.readFileSync(path.join(root, originalBuilder))), modified: false },
    derived: { path: derivedBuilder, sha256: hash(fs.readFileSync(path.join(root, derivedBuilder))), byteIdenticalToOriginal: false },
    publicDefines: { BASE_URL: "/", VITE_FONDO_E10_ENABLED: "false", DEV: false },
    inheritedOperationalEnvironment: false,
  },
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
    if (!real.includes("/node_modules/")) throw Error(`E5_EXTERNAL_SOURCE_ESCAPE ${input}`);
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
  const harness = path.join(cwd, "src/components/e5-node-test-harness.tsx");
  const generated = fs.readFileSync(path.join(dest, "lib/api-client-react/src/generated/api.ts"), "utf8");
  const hooks = [...new Set([...generated.matchAll(/export\s+(?:function|const)\s+(use[A-Z]\w*)/g)].map(m => m[1]))];
  const required = ["useGetE5Disponibilidad", "useGetE5Contexto", "useListE5Cobros", "useGetE5Cobro",
    "useGetE5DevolucionOpciones", "useListE5Avisos", "useGetE5Documento", "usePreviewE5Cobro",
    "useCreateE5Cobro", "useCreateE5Propuesta", "useAuthorizeE5Aplicacion", "useRejectE5Propuesta",
    "useReturnE5Cobro", "useRecordE5Impresion", "useGetCurrentUser"];
  for (const hook of required) if (!hooks.includes(hook)) throw Error(`E5_MISSING_GENERATED_HOOK ${hook}`);
  for (const name of ["getE5Disponibilidad", "getE5Contexto", "getE5Cobro", "getE5DevolucionOpciones"])
    if (!new RegExp(`export\\s+(?:const|function)\\s+${name}\\b`).test(generated))
      throw Error(`E5_MISSING_GENERATED_TRANSPORT ${name}`);
  const api = path.join(cwd, "frontend-node-api.ts");
  fs.writeFileSync(api, `export * from ${JSON.stringify(aliases["@workspace/api-client-react"])};\n` +
    `import { dispatchHook, dispatchTransport } from ${JSON.stringify(harness)};\n` +
    hooks.map(h => `export const ${h} = (...args) => dispatchHook(${JSON.stringify(h)}, args);`).join("\n") + "\n" +
    ["getE5Disponibilidad", "getE5Contexto", "getE5Cobro", "getE5DevolucionOpciones"].map(name =>
      `export const ${name} = (...args) => dispatchTransport(${JSON.stringify(name)}, args);`).join("\n"));
  const clientsApi = path.join(cwd, "frontend-node-clients-api.ts");
  fs.writeFileSync(clientsApi, `export * from ${JSON.stringify(path.join(cwd, "src/lib/clientes-api.ts"))};\n` +
    `import { dispatchTransport } from ${JSON.stringify(harness)};\n` +
    ["getPurchases", "getStats", "getClientAnalytics", "getPortfolio"].map(name =>
      `export const ${name} = (...args) => dispatchTransport(${JSON.stringify(name)}, args);`).join("\n"));
  Object.assign(aliases, { "@workspace/api-client-react": api, "@/lib/e5-feature-flags": harness,
    "@/lib/location-scope": harness, "@/components/layout/app-layout": harness, "@/lib/clientes-api": clientsApi });
  // No alias for productive permission, authorization, money, E3 gate or print.
  if (mutation) {
    const out = path.join(cwd, mutation.file);
    if (fs.lstatSync(out).isSymbolicLink() || !fs.realpathSync(out).startsWith(dest + path.sep)) throw Error("E5_MUTATION_ESCAPE");
    const text = fs.readFileSync(out, "utf8");
    if (text.split(mutation.before).length !== 2) throw Error(`E5_NONUNIQUE_SNAPSHOT_ANCHOR ${mutation.id}`);
    fs.writeFileSync(out, text.replace(mutation.before, mutation.after));
  }
  const plan = { test: path.join(cwd, testFile), output: path.join(cwd, "case.test.cjs"), metafile: path.join(cwd, "build-inputs.json"), aliases };
  fs.writeFileSync(path.join(cwd, "build-plan.json"), JSON.stringify(plan, null, 2));
  return { dest, cwd, plan };
}
function processLog(tree, argv, name) {
  const file = path.join(evidence, `${name}.log`), fd = fs.openSync(file, "wx");
  let result;
  try {
    result = spawnSync(process.execPath, argv, {
      cwd: tree.cwd, timeout: 60000, stdio: ["ignore", fd, fd],
      env: { PATH: path.dirname(process.execPath), HOME: tree.dest, TMPDIR: tree.dest, NODE_ENV: "test",
        LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1", E4_SANDBOX: tree.dest, E4_LIVE_ROOT: root,
        E4_ESBUILD: binary, E4_ESBUILD_MODULE: compiler, NODE_OPTIONS: `--require=${path.join(tree.cwd, "frontend-offline-guard.cjs")}` },
    });
  } finally { fs.closeSync(fd); }
  if (result.error || result.signal) throw Error(`E5_PROCESS_FAILURE ${name}: ${result.error ?? result.signal}`);
  return { exit: result.status, log: fs.readFileSync(file, "utf8") };
}
function execute(tree, c, phase) {
  const prefix = `${c.id}-${phase}`;
  const build = processLog(tree, [path.join(tree.cwd, "frontend-node-build.mjs"), path.join(tree.cwd, "build-plan.json")], `${prefix}-build`);
  if (build.exit !== 0) throw Error(`E5_BUILD_FAILURE_NOT_SEMANTIC_RED ${prefix}`);
  fs.copyFileSync(tree.plan.metafile, path.join(evidence, `${prefix}-inputs.json`));
  const resultFile = path.join(tree.cwd, `${prefix}.json`);
  const argv = ["--require", path.join(tree.cwd, "frontend-node-dom.cjs"), "--test", "--test-isolation=none",
    "--test-name-pattern", `^${c.id}$`, "--test-reporter=tap", "--test-reporter-destination=stdout",
    `--test-reporter=${path.join(tree.cwd, "frontend-node-reporter.mjs")}`, `--test-reporter-destination=${resultFile}`, tree.plan.output];
  const result = processLog(tree, argv, prefix);
  if (!fs.existsSync(resultFile)) throw Error(`E5_MISSING_NATIVE_REPORT ${prefix}`);
  const raw = fs.readFileSync(resultFile, "utf8");
  fs.writeFileSync(path.join(evidence, `${prefix}.json`), raw);
  const executed = JSON.parse(raw).tests.filter(t => !t.skipped);
  if (executed.length !== 1 || executed[0].name !== c.id) throw Error(`E5_WRONG_NATIVE_SELECTION ${prefix}`);
  const actual = executed[0];
  if (/E4_OFFLINE|E4_.*ESCAPE|E5_UNCONFIGURED|E5_UNEXPECTED|SyntaxError|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(result.log))
    throw Error(`E5_INFRASTRUCTURE_FAILURE_NOT_RED ${prefix}`);
  if (phase === "red") {
    const wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
    const code = wrapped ? actual.causeCode : actual.code, message = wrapped ? actual.causeMessage : actual.message;
    if (result.exit !== 1 || actual.status !== "failed" || code !== "ERR_ASSERTION" || !message?.includes(c.assertion))
      throw Error(`E5_SPECIFIC_NATIVE_ASSERTION_RED_REQUIRED ${prefix}`);
  } else if (result.exit !== 0 || actual.status !== "passed") throw Error(`E5_GREEN_FAILED ${prefix}`);
  return { exit: result.exit, actual, args: argv, bundleHash: hash(fs.readFileSync(tree.plan.output)),
    caseSourceHash: hash(fs.readFileSync(path.join(tree.cwd, c.file))) };
}
try {
  if (buildOnly) {
    const tree = snapshot("build-only");
    const build = processLog(tree, [path.join(tree.cwd, "frontend-node-build.mjs"), path.join(tree.cwd, "build-plan.json")], "build-only");
    if (build.exit !== 0) throw Error("E5_BUILD_ONLY_FAILURE_NOT_SEMANTIC_RED");
    fs.copyFileSync(tree.plan.metafile, path.join(evidence, "build-only-inputs.json"));
    manifest.buildOnly = { exit: build.exit, sandbox: tree.dest, bundleHash: hash(fs.readFileSync(tree.plan.output)),
      metafileHash: hash(fs.readFileSync(tree.plan.metafile)), validatedAnchors: cases.length, executedCases: 0 };
    manifest.status = "PASS_BUILD_ONLY_ZERO_CASES_NOT_UI_GREEN";
  } else {
  for (const c of selected) {
    const green = snapshot(`${c.id}-green`);
    const result = { id: c.id, obligation: c.title, assertion: c.assertion, testFile,
      originalHash: hash(originals.get(`${app}/${c.file}`)), greenSandbox: green.dest };
    manifest.cases.push(result); save();
    result.green = execute(green, c, "green"); save();
    const red = snapshot(`${c.id}-red`, c);
    result.redSandbox = red.dest; result.mutantHash = hash(fs.readFileSync(path.join(red.cwd, c.file))); save();
    result.red = execute(red, c, "red"); save();
    fs.writeFileSync(path.join(red.cwd, c.file), originals.get(`${app}/${c.file}`));
    result.restored = execute(red, c, "restored"); save();
  }
  manifest.status = selected.length === cases.length ? "PASS_DECLARED_E5_UI_MANIFEST_NOT_BACKEND" : "PASS_SELECTED_CASES_NOT_FULL_E5";
  }
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