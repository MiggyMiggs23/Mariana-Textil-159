// MAIN executes. Native node:test/esbuild, physical snapshots, inherited E12 offline guard.
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
const { build } = require("esbuild");
const base = "artifacts/api-server/src/lib/", tests = base + "e5.test.ts";
const guard = "reports/tanda-b-20260922/e12/offline-guard.cjs";
function sourceTree(relative) {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...sourceTree(child));
    else if (/\.(?:ts|mts|cts|js|mjs|cjs|json)$/.test(entry.name)) result.push(child);
  }
  return result;
}
// Complete real source trees for every relative import reachable from the entry.
// Unused files are harmless; esbuild's metafile below still proves the actual graph.
const files = [...new Set([
  ...sourceTree("artifacts/api-server/src/lib"),
  ...sourceTree("lib/db/src/schema"),
  guard,
])];
const originals = new Map(files.map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]));
const names = [...originals.get(tests).matchAll(/test\("([^"]+)"/g)].map(m => m[1]);
if (new Set(names).size !== names.length || new Set(mutations.map(m => m[0])).size !== mutations.length ||
  names.length !== mutations.length || mutations.some(([n]) => !names.includes(n)))
  throw new Error("Every explicit obligation requires one isolated mutant");
for (const [name, file, before] of mutations)
  if (originals.get(file).split(before).length !== 2) throw new Error(`Unique anchor absent: ${name}`);
const idsAt = process.argv.indexOf("--ids");
const inlineIds = process.argv.find(arg => arg.startsWith("--ids="))?.slice("--ids=".length);
const requestedIds = (inlineIds ?? (idsAt >= 0 ? process.argv[idsAt + 1] : ""))
  .split(",").map(value => value.trim()).filter(Boolean);
if (new Set(requestedIds).size !== requestedIds.length ||
    requestedIds.some(name => !mutations.some(([candidate]) => candidate === name)))
  throw new Error("Unknown or duplicate explicit --ids selection");
const selectedMutations = requestedIds.length
  ? requestedIds.map(name => mutations.find(([candidate]) => candidate === name))
  : mutations;
if (process.argv.includes("--validate-only")) {
  console.log(`Prepared ${names.length} named green/red/restored-green cases; no tests executed.`); process.exit(0);
}
const stamp = new Date().toISOString().replaceAll(":", "-"), logs = path.join(dir, "logs", `backend-${stamp}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e5-native-")); fs.mkdirSync(logs, { recursive: true });
const hash = value => createHash("sha256").update(value).digest("hex");
const manifest = { mode: "OFFLINE_SYNTHETIC_NO_SQL_NO_APP_NO_POSTGRES_PROOF", startedAt: stamp,
  requestedIds: requestedIds.length ? requestedIds : "ALL",
  sourceHashes: Object.fromEntries([...originals].map(([f, v]) => [f, hash(v)])), cases: [] };
// Public execution allowlist only. Never inherit application/session credentials.
const env = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  HOME: process.env.HOME ?? os.homedir(),
  LANG: process.env.LANG ?? "C.UTF-8",
  TZ: process.env.TZ ?? "UTC",
  TMPDIR: process.env.TMPDIR ?? os.tmpdir(),
  NODE_ENV: "test",
};
async function snapshot(name, mutation) {
  const target = path.join(sandbox, name);
  for (const [f, content] of originals) {
    const output = path.join(target, f); fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, mutation && mutation[1] === f ? content.replace(mutation[2], mutation[3]) : content);
    if (fs.lstatSync(output).isSymbolicLink() || !fs.realpathSync(output).startsWith(fs.realpathSync(target) + path.sep))
      throw new Error("Mutable snapshot escape");
  }
  const output = path.join(target, "test.mjs");
  const built = await build({ entryPoints: [path.join(target, tests)], outfile: output, bundle: true,
    platform: "node", format: "esm", target: "node24", metafile: true, logLevel: "silent",
    nodePaths: [path.join(root, "artifacts/api-server/node_modules"), path.join(root, "lib/db/node_modules"),
      path.join(root, "lib/api-zod/node_modules"), path.join(root, "node_modules")] });
  for (const f of Object.keys(built.metafile.inputs)) {
    const real = fs.realpathSync(path.resolve(f));
    if (real.startsWith(root + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`))
      throw new Error(`Live mutable input: ${real}`);
  }
  const writeGuard = path.join(target, "e5-offline-write-guard.cjs");
  fs.writeFileSync(writeGuard, `"use strict";
const fs = require("node:fs");
const deny = () => { throw new Error("E5_OFFLINE_WRITE_BLOCKED"); };
for (const name of ["writeFile","writeFileSync","appendFile","appendFileSync","truncate","truncateSync",
  "rename","renameSync","unlink","unlinkSync","rm","rmSync","rmdir","rmdirSync","mkdir","mkdirSync",
  "mkdtemp","mkdtempSync","copyFile","copyFileSync","createWriteStream"]) fs[name] = deny;
for (const name of ["writeFile","appendFile","truncate","rename","unlink","rm","rmdir","mkdir","mkdtemp","copyFile"])
  fs.promises[name] = deny;
const writable = flags => typeof flags === "number" ? (flags & 3) !== 0 :
  typeof flags === "string" && /[wax+]/.test(flags);
const open = fs.open, openSync = fs.openSync, openPromise = fs.promises.open;
fs.open = function(file, flags, ...rest) { if (writable(flags)) return deny(); return open.call(this, file, flags, ...rest); };
fs.openSync = function(file, flags, ...rest) { if (writable(flags)) return deny(); return openSync.call(this, file, flags, ...rest); };
fs.promises.open = function(file, flags, ...rest) { if (writable(flags)) return Promise.reject(new Error("E5_OFFLINE_WRITE_BLOCKED")); return openPromise.call(this, file, flags, ...rest); };
`);
  return { target, output, writeGuard };
}
if (process.argv.includes("--build-only")) {
  try {
    await snapshot("build-only");
    console.log(`Built isolated E5 snapshot with ${files.length} physical source inputs; no tests executed.`);
  } catch (error) {
    console.error(String(error)); process.exitCode = 1;
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
  process.exit();
}
function execute(built, name, phase) {
  const result = spawnSync(process.execPath, ["--require", path.join(built.target, guard),
    "--require", built.writeGuard, "--test",
    "--test-isolation=none", "--test-reporter=tap", "--test-name-pattern", `^${name}$`, built.output],
  { env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(logs, `${name}-${phase}.log`), text);
  if (result.error || result.signal || /Cannot find module|Could not resolve|SyntaxError|E12_OFFLINE_ACCESS_BLOCKED|E5_OFFLINE_WRITE_BLOCKED/.test(text))
    throw new Error(`Setup/infrastructure failure is never a red: ${name} ${phase}`);
  return { exit: result.status, text };
}
try {
  for (const mutation of selectedMutations) {
    const name = mutation[0], initial = await snapshot(name), green = execute(initial, name, "green");
    if (green.exit !== 0 || !green.text.includes("# pass 1")) throw new Error(`Green failed: ${name}`);
    const changed = await snapshot(name, mutation), red = execute(changed, name, "red");
    if (red.exit === 0 || !red.text.includes("# fail 1") || !red.text.includes("ERR_ASSERTION") || !red.text.includes(name))
      throw new Error(`Specific assertion mutant not killed: ${name}`);
    const restored = await snapshot(name), again = execute(restored, name, "restored-green");
    if (again.exit !== 0 || !again.text.includes("# pass 1")) throw new Error(`Restored green failed: ${name}`);
    if (hash(fs.readFileSync(path.join(restored.target, mutation[1]), "utf8")) !== hash(originals.get(mutation[1])))
      throw new Error("Source restoration mismatch");
    manifest.cases.push({ name, file: mutation[1], before: mutation[2], after: mutation[3],
      green: green.exit, red: red.exit, restored: again.exit,
      mutantHash: hash(originals.get(mutation[1]).replace(mutation[2], mutation[3])) });
    fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  if (requestedIds.length) {
    manifest.status = "COMPLETE_EXPLICIT_SUBSET";
    console.log(`COMPLETE_EXPLICIT_SUBSET ${manifest.cases.length}/${requestedIds.length}; no full-matrix PASS. ${logs}`);
  } else {
    manifest.status = "PASS"; console.log(`PASS ${manifest.cases.length}/${names.length}; no PostgreSQL proof. ${logs}`);
  }
} catch (error) {
  manifest.status = "FAIL"; manifest.error = String(error); console.error(String(error)); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.rmSync(sandbox, { recursive: true, force: true });
}