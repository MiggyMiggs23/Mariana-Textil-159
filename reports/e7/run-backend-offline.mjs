// MAIN alone executes cases. Preparation modes never run node:test.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import mutations from "./backend-mutants.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, "../..");
const require = createRequire(path.join(root, "artifacts/api-server/package.json"));
const { build } = require("esbuild"), ts = require("typescript");
const tests = "artifacts/api-server/src/lib/e7.test.ts";
const guard = "reports/tanda-b-20260922/e12/offline-guard.cjs";
const hash = value => createHash("sha256").update(value).digest("hex");
function sourceTree(relative) {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...sourceTree(child));
    else if (/\.(?:ts|mts|cts|js|mjs|cjs|json)$/.test(entry.name)) result.push(child);
  }
  return result;
}
const files = [...new Set([
  ...sourceTree("artifacts/api-server/src/lib"),
  ...sourceTree("artifacts/api-server/src/middlewares"),
  ...sourceTree("lib/db/src"),
  ...sourceTree("lib/api-zod/src"),
  ...sourceTree("lib/number-format/src"),
  guard,
])];
const originals = new Map(files.map(file => [file, fs.readFileSync(path.join(root, file), "utf8")]));
const names = [...originals.get(tests).matchAll(/test\("([^"]+)"/g)].map(match => match[1]);
if (new Set(names).size !== names.length || new Set(mutations.map(m => m[0])).size !== mutations.length ||
    names.length !== mutations.length || names.some(name => !mutations.some(([candidate]) => candidate === name)))
  throw new Error("Every named E7 obligation requires exactly one isolated semantic mutant");
for (const [name, file, before] of mutations) {
  if (!originals.has(file)) throw new Error(`Mutant source is outside the physical snapshot: ${name}`);
  if (originals.get(file).split(before).length !== 2) throw new Error(`Unique anchor absent: ${name}`);
}
const idsAt = process.argv.indexOf("--ids");
const inlineArg = process.argv.find(argument => argument.startsWith("--ids="));
if (idsAt >= 0 && inlineArg) throw new Error("Use exactly one --ids form");
if (idsAt >= 0 && (idsAt + 1 >= process.argv.length || process.argv[idsAt + 1].startsWith("--")))
  throw new Error("--ids requires a non-empty comma-separated value");
if (inlineArg?.slice(6).trim() === "") throw new Error("--ids cannot be empty");
const idsRaw = inlineArg?.slice(6) ?? (idsAt >= 0 ? process.argv[idsAt + 1] : undefined);
const requestedIds = idsRaw === undefined ? [] : idsRaw.split(",").map(value => value.trim());
if (requestedIds.some(value => !value) || new Set(requestedIds).size !== requestedIds.length ||
    requestedIds.some(name => !mutations.some(([candidate]) => candidate === name)))
  throw new Error("Empty, unknown or duplicate explicit --ids selection");
const selected = requestedIds.length
  ? requestedIds.map(name => mutations.find(([candidate]) => candidate === name))
  : mutations;
if (process.argv.includes("--validate-only")) {
  console.log(`Prepared ${names.length} E7 named green/red/restored-green cases; no tests executed.`);
  process.exit(0);
}
if (process.argv.includes("--typecheck-only")) {
  const configFilePath = path.join(root, "artifacts/api-server/tsconfig.json");
  const config = ts.readConfigFile(configFilePath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFilePath),
    { noEmit: true, incremental: false, composite: false, rootDir: root }, configFilePath);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: [] });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) {
    for (const diagnostic of diagnostics) console.error(ts.formatDiagnostic(diagnostic, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => "\n",
    }));
    process.exitCode = 1;
  } else {
    console.log(`Typechecked ${program.getRootFileNames().length} API source files with noEmit; 0 diagnostics; no tests executed.`);
  }
  process.exit();
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e7-native-"));
function physicalWorkspacePlugin(target) {
  return {
    name: "physical-workspace-packages",
    setup(api) {
      api.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: path.join(target, "lib/db/src/index.ts") }));
      api.onResolve({ filter: /^@workspace\/db\/advisory-locks$/ }, () => ({
        path: path.join(target, "lib/db/src/lib/advisory-locks.mjs"),
      }));
      api.onResolve({ filter: /^@workspace\/db\/schema$/ }, () => ({
        path: path.join(target, "lib/db/src/schema/index.ts"),
      }));
      api.onResolve({ filter: /^@workspace\/db\/sku$/ }, () => ({
        path: path.join(target, "lib/db/src/lib/sku.ts"),
      }));
      api.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: path.join(target, "lib/api-zod/src/index.ts") }));
      api.onResolve({ filter: /^@workspace\/number-format$/ }, () => ({
        path: path.join(target, "lib/number-format/src/index.ts"),
      }));
    },
  };
}
const dependencyPaths = [
  path.join(root, "artifacts/api-server/node_modules"), path.join(root, "lib/db/node_modules"),
  path.join(root, "lib/api-zod/node_modules"), path.join(root, "node_modules"),
];
const esmRequireBanner = {
  js: `import { createRequire as __e7CreateRequire } from "node:module";
const require = __e7CreateRequire(import.meta.url);`,
};
async function snapshot(name, mutation) {
  const target = path.join(sandbox, name);
  for (const [file, content] of originals) {
    const output = path.join(target, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, mutation && mutation[1] === file ? content.replace(mutation[2], mutation[3]) : content);
    if (fs.lstatSync(output).isSymbolicLink() ||
        !fs.realpathSync(output).startsWith(fs.realpathSync(target) + path.sep))
      throw new Error("Mutable snapshot escape");
  }
  const output = path.join(target, "test.mjs");
  const built = await build({
    entryPoints: [path.join(target, tests)], outfile: output, bundle: true, platform: "node", format: "esm",
    target: "node24", metafile: true, logLevel: "silent", banner: esmRequireBanner,
    plugins: [physicalWorkspacePlugin(target)],
    nodePaths: dependencyPaths,
  });
  for (const input of Object.keys(built.metafile.inputs)) {
    const real = fs.realpathSync(path.resolve(input));
    if (real.startsWith(root + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`))
      throw new Error(`Live mutable input: ${real}`);
  }
  const importProbe = path.join(target, "runtime-import-probe.mjs");
  const probeBuild = await build({
    stdin: {
      contents: `import ExcelJS from "exceljs";
import { createE7Reader } from "./artifacts/api-server/src/lib/e7-read-model.ts";
import { e7StatementWorkbook, e7AttributionPdf } from "./artifacts/api-server/src/lib/e7-export.ts";
import { GetE7AtribucionResponse, GetE7ClienteExportacionResponse } from "@workspace/api-zod";
if (typeof ExcelJS.Workbook !== "function" || typeof createE7Reader !== "function" ||
    typeof e7StatementWorkbook !== "function" || typeof e7AttributionPdf !== "function" ||
    typeof GetE7AtribucionResponse?.parse !== "function" ||
    typeof GetE7ClienteExportacionResponse?.parse !== "function") throw new Error("E7_RUNTIME_IMPORT_INCOMPATIBLE");
console.log("E7_RUNTIME_IMPORTS_OK");`,
      resolveDir: target,
      sourcefile: "runtime-import-probe.ts",
      loader: "ts",
    },
    outfile: importProbe, bundle: true, platform: "node", format: "esm", target: "node24",
    metafile: true, logLevel: "silent", banner: esmRequireBanner, plugins: [physicalWorkspacePlugin(target)],
    nodePaths: dependencyPaths,
  });
  for (const input of Object.keys(probeBuild.metafile.inputs)) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved) && input.endsWith("runtime-import-probe.ts")) continue;
    const real = fs.realpathSync(resolved);
    if (real.startsWith(root + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`))
      throw new Error(`Live mutable runtime-probe input: ${real}`);
  }
  const writeGuard = path.join(target, "e7-offline-write-guard.cjs");
  fs.writeFileSync(writeGuard, `"use strict";
const fs=require("node:fs"),deny=()=>{throw new Error("E7_OFFLINE_WRITE_BLOCKED")};
for(const name of ["writeFile","writeFileSync","appendFile","appendFileSync","truncate","truncateSync","rename","renameSync","unlink","unlinkSync","rm","rmSync","rmdir","rmdirSync","mkdir","mkdirSync","mkdtemp","mkdtempSync","copyFile","copyFileSync","createWriteStream"])fs[name]=deny;
for(const name of ["writeFile","appendFile","truncate","rename","unlink","rm","rmdir","mkdir","mkdtemp","copyFile"])fs.promises[name]=deny;
`);
  return { target, output, importProbe, writeGuard, metafile: built.metafile };
}
function runtimeImportCheck(built) {
  const result = spawnSync(process.execPath, [
    "--require", path.join(built.target, guard), "--require", built.writeGuard, built.importProbe,
  ], { env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? os.homedir(),
    LANG: process.env.LANG ?? "C.UTF-8", TZ: "UTC", TMPDIR: process.env.TMPDIR ?? os.tmpdir(),
    NODE_ENV: "test" }, encoding: "utf8", timeout: 60000 });
  const raw = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.error || result.signal || result.status !== 0 || !raw.includes("E7_RUNTIME_IMPORTS_OK") ||
      /OFFLINE_ACCESS_BLOCKED|E7_OFFLINE_WRITE_BLOCKED/.test(raw))
    throw new Error(`Runtime import compatibility failed: ${raw}`);
}
if (process.argv.includes("--build-only")) {
  try {
    const built = await snapshot("build-only");
    runtimeImportCheck(built);
    console.log(`Built isolated E7 snapshot with ${Object.keys(built.metafile.inputs).length} reachable inputs and runtime imports OK; no tests executed.`);
  } catch (error) {
    console.error(String(error)); process.exitCode = 1;
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
  process.exit();
}

const stamp = new Date().toISOString().replaceAll(":", "-");
const logs = path.join(dir, "logs", `backend-${stamp}`);
fs.mkdirSync(logs, { recursive: true });
const manifest = {
  mode: "OFFLINE_SYNTHETIC_FINITE_SQL_CAPTURE_NO_DB_NO_APP_NO_POSTGRES_OR_HTTP_PROOF",
  startedAt: stamp, requestedIds: requestedIds.length ? requestedIds : "ALL",
  sourceHashes: Object.fromEntries([...originals].map(([file, value]) => [file, hash(value)])), cases: [],
};
const env = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? os.homedir(),
  LANG: process.env.LANG ?? "C.UTF-8", TZ: "UTC", TMPDIR: process.env.TMPDIR ?? os.tmpdir(), NODE_ENV: "test" };
function execute(built, name, phase) {
  const result = spawnSync(process.execPath, [
    "--require", path.join(built.target, guard), "--require", built.writeGuard, "--test",
    "--test-isolation=none", "--test-reporter=tap", "--test-name-pattern", `^${name}$`, built.output,
  ], { env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const raw = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const log = path.join(logs, `${name}-${phase}.log`);
  fs.writeFileSync(log, raw);
  if (result.error || result.signal ||
      /Cannot find module|Could not resolve|SyntaxError|OFFLINE_ACCESS_BLOCKED|E7_OFFLINE_WRITE_BLOCKED/.test(raw))
    throw new Error(`Setup/infrastructure failure is never a red: ${name} ${phase}`);
  return { exit: result.status, raw, logSha256: hash(raw) };
}
try {
  for (const mutation of selected) {
    const name = mutation[0], initial = await snapshot(`${name}-green`);
    runtimeImportCheck(initial);
    const green = execute(initial, name, "green");
    if (green.exit !== 0 || !green.raw.includes("# pass 1")) throw new Error(`Green failed: ${name}`);
    const changed = await snapshot(`${name}-red`, mutation), red = execute(changed, name, "red");
    if (red.exit === 0 || !red.raw.includes("# fail 1") || !red.raw.includes("code: 'ERR_ASSERTION'") ||
        !red.raw.includes(name)) throw new Error(`Specific assertion mutant not killed: ${name}`);
    const restored = await snapshot(`${name}-restored`), again = execute(restored, name, "restored-green");
    if (again.exit !== 0 || !again.raw.includes("# pass 1")) throw new Error(`Restored green failed: ${name}`);
    const restoredText = fs.readFileSync(path.join(restored.target, mutation[1]), "utf8");
    if (hash(restoredText) !== hash(originals.get(mutation[1]))) throw new Error(`Restoration mismatch: ${name}`);
    manifest.cases.push({ name, file: mutation[1], green: green.exit, red: red.exit, restored: again.exit,
      sourceSha256: hash(originals.get(mutation[1])),
      mutantSha256: hash(originals.get(mutation[1]).replace(mutation[2], mutation[3])),
      restoredSha256: hash(restoredText),
      rawLogsSha256: { green: green.logSha256, red: red.logSha256, restoredGreen: again.logSha256 } });
    fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  manifest.status = requestedIds.length ? "COMPLETE_EXPLICIT_SUBSET" : "PASS";
  const summary = requestedIds.length
    ? `COMPLETE_EXPLICIT_SUBSET ${manifest.cases.length}/${requestedIds.length}; no full-matrix PASS.`
    : `PASS ${manifest.cases.length}/${names.length}; synthetic SQL only, no PostgreSQL/HTTP proof.`;
  fs.writeFileSync(path.join(logs, "stdout.txt"), `${summary}\n`);
  console.log(`${summary} ${logs}`);
} catch (error) {
  manifest.status = "FAIL"; manifest.error = String(error); console.error(String(error)); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.rmSync(sandbox, { recursive: true, force: true });
}