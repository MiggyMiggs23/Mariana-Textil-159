import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const frozen = "7643992863b4956757d18a32b92a3c0f5fe9f6ad";
const root = process.cwd();
const out = resolve(root, "reports/tanda-nocturna-20260919/final-task5-binding");
const oldDir = "reports/tanda-nocturna-20260919/tarea-5";
const historical = JSON.parse(readFileSync(`${oldDir}/execution-identity.json`, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args);
const sources = [
  "artifacts/api-server/src/lib/permisos.ts",
  "artifacts/api-server/src/lib/sensitive-data.ts",
  "artifacts/api-server/src/lib/tarea4-gates.ts",
];
const test = "artifacts/api-server/src/lib/tarea5-permissions-redaction.no-db.test.mjs";
const blocker = `${oldDir}/no-io.cjs`;
const before = Object.fromEntries(Object.keys(historical.hashes).map((path) => [path, hash(readFileSync(path))]));
const binding = {
  commit: frozen,
  tree: git("rev-parse", `${frozen}^{tree}`).toString().trim(),
  node: process.version,
  historicalCommit: historical.commit,
  historicalTree: historical.tree,
  inputs: {},
  scope: "Only permissions-deny-admin and focused permission-test restoration. All 28 complete integrations remain blocked; three a-partial extractions are not entire green suites.",
  historicalUnchangedMutants: ["terminal-leaks-cost", "supervisor-leaks-finance"],
  historicalEvidence: {},
};
for (const [path, sha] of Object.entries(before)) {
  const committed = hash(git("show", `${frozen}:${path}`));
  assert.equal(sha, committed, `working input differs from freeze: ${path}`);
  binding.inputs[path] = { frozenSha256: committed, historicalSha256: historical.hashes[path], unchanged: committed === historical.hashes[path] };
}
assert.deepEqual(Object.entries(binding.inputs).filter(([, data]) => !data.unchanged).map(([path]) => path), [sources[0]]);
for (const filename of [
  "execution-identity.json", "inventory.json", "mutation-results.json",
  "red-terminal-leaks-cost.log", "restored-terminal-leaks-cost.log",
  "red-supervisor-leaks-finance.log", "restored-supervisor-leaks-finance.log",
]) {
  const path = `${oldDir}/${filename}`;
  binding.historicalEvidence[path] = hash(readFileSync(path));
}
const copy = mkdtempSync(`${tmpdir()}/final-task5-permissions-`);
try {
  for (const path of sources) {
    mkdirSync(dirname(`${copy}/${path}`), { recursive: true });
    writeFileSync(`${copy}/${path}`, git("show", `${frozen}:${path}`));
  }
  const target = `${copy}/${sources[0]}`;
  const original = readFileSync(target, "utf8");
  const from = "puedeVer: true,";
  const to = "puedeVer: false,";
  assert.equal(original.split(from).length, 2);
  writeFileSync(target, original.replace(from, to));
  binding.mutant = { name: "permissions-deny-admin", path: sources[0], from, to, sha256: hash(readFileSync(target)) };
  const args = [
    "--require", resolve(blocker), "--test", "--test-reporter=tap",
    "--test-name-pattern=^T5 permisos:", test,
  ];
  function run(name) {
    const child = spawnSync(process.execPath, args, {
      cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", TAREA5_SOURCE_ROOT: copy },
    });
    assert.ifError(child.error);
    const log = `commit=${frozen}\ntree=${binding.tree}\ncommand=${process.execPath} ${args.join(" ")}\nsourceRoot=${copy}\n${child.stdout}${child.stderr}\nEXIT_CODE=${child.status}\n`;
    writeFileSync(`${out}/${name}.log`, log);
    writeFileSync(`${out}/${name}.exit`, `${child.status}\n`);
    return { child, evidence: { command: [process.execPath, ...args], exit: child.status, log: `${name}.log`, logSha256: hash(log) } };
  }
  const red = run("red-permissions-deny-admin");
  binding.red = red.evidence;
  assert.equal(red.child.status, 1);
  assert.match(red.child.stdout, /not ok \d+ - T5 permisos:/);
  assert.match(red.child.stdout, /ERR_ASSERTION/);
  assert.doesNotMatch(red.child.stdout + red.child.stderr, /Unreviewed import|execution forbidden|SyntaxError|MODULE_NOT_FOUND/);
  writeFileSync(target, original);
  assert.equal(hash(readFileSync(target)), before[sources[0]]);
  const restored = run("restored-permissions");
  binding.restored = restored.evidence;
  assert.equal(restored.child.status, 0);
  assert.match(restored.child.stdout, /ok \d+ - T5 permisos:/);
  for (const [path, expected] of Object.entries(before)) assert.equal(hash(readFileSync(path)), expected);
  for (const [path, expected] of Object.entries(binding.historicalEvidence)) assert.equal(hash(readFileSync(path)), expected);
  binding.result = "PASS: targeted semantic mutant exit 1; focused restore exit 0; active sources and historical evidence unchanged.";
  writeFileSync(`${out}/final-binding.json`, JSON.stringify(binding, null, 2) + "\n");
  console.log(binding.result);
} finally {
  rmSync(copy, { recursive: true, force: true });
}