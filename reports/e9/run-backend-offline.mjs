// MAIN executes. Same native node:test/esbuild strategy and unchanged E12 guard.
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
const base = "artifacts/api-server/src/lib/";
const tests = base + "e9.test.ts";
const guard = "reports/tanda-b-20260922/e12/offline-guard.cjs";
const files = ["e9.ts", "e9-feature.ts", "e9-cut.ts", "e9-repository.ts", "e9-fondo.ts", "e9-http.ts",
  "fondo.ts", "e12-fondo-executor.ts", "e12-supplier-cash.ts", "caja-cash-ledger.ts", "e9.test.ts"].map(f => base + f).concat(guard);
const originals = new Map(files.map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]));
const names = [...originals.get(tests).matchAll(/test\("([^"]+)"/g)].map(m => m[1]);
if (new Set(names).size !== names.length || new Set(mutations.map(m => m[0])).size !== mutations.length ||
  names.length !== mutations.length || mutations.some(([n]) => !names.includes(n)))
  throw new Error("Every explicit obligation requires one isolated mutant");
for (const [name, file, before] of mutations)
  if (originals.get(file).split(before).length !== 2) throw new Error(`Unique anchor absent: ${name}`);
if (process.argv.includes("--validate-only")) {
  console.log(`Prepared ${names.length} named green/red/restored-green cases; no tests executed.`); process.exit(0);
}
const stamp = new Date().toISOString().replaceAll(":", "-"), logs = path.join(dir, "logs", `backend-${stamp}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e9-native-"));
fs.mkdirSync(logs, { recursive: true });
const hash = value => createHash("sha256").update(value).digest("hex");
const manifest = { mode: "OFFLINE_SYNTHETIC_NO_SQL_NO_APP_NO_POSTGRES_PROOF", startedAt: stamp,
  sourceHashes: Object.fromEntries([...originals].map(([f, v]) => [f, hash(v)])), cases: [] };
const env = Object.fromEntries(Object.entries(process.env).filter(([n]) => !/DATABASE|POSTGRES|^PG[A-Z_]|^DIRECT_URL$|^NODE_OPTIONS$/.test(n)));
env.NODE_ENV = "test";
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
    nodePaths: [path.join(root, "artifacts/api-server/node_modules"), path.join(root, "lib/api-zod/node_modules")] });
  for (const f of Object.keys(built.metafile.inputs)) {
    const real = fs.realpathSync(path.resolve(f));
    if (real.startsWith(root + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`))
      throw new Error(`Live mutable input: ${real}`);
  }
  return { target, output };
}
function execute(built, name, phase) {
  const result = spawnSync(process.execPath, ["--require", path.join(built.target, guard), "--test",
    "--test-isolation=none", "--test-reporter=tap", "--test-name-pattern", `^${name}$`, built.output],
  { env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(logs, `${name}-${phase}.log`), text);
  if (result.error || result.signal || /Cannot find module|Could not resolve|SyntaxError|E12_OFFLINE_ACCESS_BLOCKED/.test(text))
    throw new Error(`Setup/infrastructure failure is never a red: ${name} ${phase}`);
  return { exit: result.status, text };
}
try {
  for (const mutation of mutations) {
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
      green: green.exit, red: red.exit, restored: again.exit, mutantHash: hash(originals.get(mutation[1]).replace(mutation[2], mutation[3])) });
    fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  manifest.status = "PASS"; console.log(`PASS ${manifest.cases.length}/${names.length}; no PostgreSQL proof. ${logs}`);
} catch (error) {
  manifest.status = "FAIL"; manifest.error = String(error); console.error(String(error)); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.rmSync(sandbox, { recursive: true, force: true });
}