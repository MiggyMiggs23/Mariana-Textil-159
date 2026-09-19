import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const out = resolve(root, "reports/tanda-nocturna-20260919/tarea-5");
const manifest = readFileSync(`${out}/test-manifest.txt`, "utf8").trim().split("\n");
assert.equal(manifest.length, 1);
assert.equal(manifest[0], "artifacts/api-server/src/lib/tarea5-permissions-redaction.no-db.test.mjs");
assert.ok(manifest.every((path) => existsSync(path)));
const sources = ["artifacts/api-server/src/lib/permisos.ts", "artifacts/api-server/src/lib/sensitive-data.ts",
  "artifacts/api-server/src/lib/tarea4-gates.ts"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inventorySource = "reports/verificacion-suites-sin-poblacion.md";
const reportedPaths = [...new Set(readFileSync(inventorySource, "utf8")
  .match(/artifacts\/api-server\/[^\s`]+\.test\.(?:ts|mjs)/g) ?? [])];
assert.ok(reportedPaths.length > 28);
const inventory = reportedPaths.flatMap((path) => {
  assert.ok(existsSync(path), `Reported suite missing: ${path}`);
  const source = readFileSync(path, "utf8");
  const hits = [...source.matchAll(/INSERT\s+INTO\s+usuarios\b|\.insert\(\s*usuariosTable\s*\)/gi)];
  return hits.length ? [{ path, sha256: hash(source),
    insertionLines: hits.map((hit) => source.slice(0, hit.index).split("\n").length) }] : [];
});
assert.equal(inventory.length, 28, "Do not invent or silently truncate inventory");
writeFileSync(`${out}/inventory.json`, JSON.stringify({
  source: inventorySource, sourceSha256: hash(readFileSync(inventorySource)),
  reportedCandidateCount: reportedPaths.length, userCreatingCount: inventory.length, suites: inventory,
}, null, 2) + "\n");
const audited = [...sources, ...manifest, "pnpm-lock.yaml",
  "reports/tanda-nocturna-20260919/tarea-5/no-io.cjs", "reports/tanda-nocturna-20260919/tarea-5/run.mjs"];
const hashes = Object.fromEntries(audited.map((path) => [path, hash(readFileSync(path))]));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const temp = mkdtempSync(`${tmpdir()}/tarea5-`);
const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const identity = { commit: git("rev-parse", "HEAD"), node: process.version,
  typescript: require("typescript/package.json").version, hashes,
  // A separate index records the actual uncommitted tree without staging the main agent's files.
  tree: null };
try {
  const indexEnv = { ...process.env, GIT_INDEX_FILE: `${temp}/index` };
  execFileSync("git", ["read-tree", "HEAD"], { env: indexEnv });
  execFileSync("git", ["add", "-A"], { env: indexEnv });
  identity.tree = execFileSync("git", ["write-tree"], { env: indexEnv, encoding: "utf8" }).trim();
  writeFileSync(`${out}/execution-identity.json`, JSON.stringify(identity, null, 2) + "\n");
  const args = ["--require", `${out}/no-io.cjs`, "--test", "--test-reporter=tap", ...manifest];
  function run(name, sourceRoot = root) {
    const result = spawnSync(process.execPath, args, {
      cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", TAREA5_SOURCE_ROOT: sourceRoot },
    });
    assert.ifError(result.error);
    const log = `commit=${identity.commit}\ntree=${identity.tree}\nnode=${identity.node}\ncommand=${process.execPath} ${args.join(" ")}\nsourceRoot=${sourceRoot}\n${result.stdout}${result.stderr}\nEXIT_CODE=${result.status}\n`;
    writeFileSync(`${out}/${name}.log`, log);
    return result;
  }
  assert.equal(run("green").status, 0);
  const mutants = [
    { name: "permissions-deny-admin", path: sources[0], from: "puedeVer: true,", to: "puedeVer: false,", test: "T5 permisos:" },
    { name: "terminal-leaks-cost", path: sources[1], from: "return omit(value) as T;", to: "return value;", test: "T5 productos-cache:" },
    { name: "supervisor-leaks-finance", path: sources[1], from: "return omit(value, true) as T;", to: "return value;", test: "T5 role-access-matrix:" },
  ];
  const results = [];
  for (const mutant of mutants) {
    const copy = `${temp}/${mutant.name}`;
    for (const path of sources) {
      mkdirSync(dirname(`${copy}/${path}`), { recursive: true });
      writeFileSync(`${copy}/${path}`, readFileSync(path));
    }
    const target = `${copy}/${mutant.path}`;
    const original = readFileSync(target, "utf8");
    assert.equal(original.split(mutant.from).length, 2, "mutant replacement must be unique");
    writeFileSync(target, original.replace(mutant.from, mutant.to));
    const mutantHash = hash(readFileSync(target));
    const red = run(`red-${mutant.name}`, copy);
    assert.equal(red.status, 1, "must fail semantically, not crash");
    assert.match(red.stdout, new RegExp(`not ok [0-9]+ - ${mutant.test}`));
    assert.match(red.stdout, /ERR_ASSERTION/);
    assert.doesNotMatch(red.stdout + red.stderr, /Unreviewed import|execution forbidden|SyntaxError|MODULE_NOT_FOUND/);
    writeFileSync(target, original);
    assert.equal(run(`restored-${mutant.name}`, copy).status, 0);
    results.push({ ...mutant, mutantSha256: mutantHash, redExit: 1, restoredExit: 0 });
  }
  for (const path of audited) assert.equal(hash(readFileSync(path)), hashes[path], `${path} changed during run`);
  for (const suite of inventory) assert.equal(hash(readFileSync(suite.path)), suite.sha256, `Original changed: ${suite.path}`);
  assert.equal(run("final-restored").status, 0);
  writeFileSync(`${out}/mutation-results.json`, JSON.stringify(results, null, 2) + "\n");
  console.log("PASS: 3 tests; 3 semantic mutants rejected; 3 restored runs + final green; no active source mutation.");
} finally {
  rmSync(temp, { recursive: true, force: true });
}