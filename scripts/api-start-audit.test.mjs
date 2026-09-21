import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const wrapper = readFileSync(new URL("./api-start-audit.sh", import.meta.url), "utf8");
const logger = new URL("./api-start-audit-record.mjs", import.meta.url);
const hash = (s) => createHash("sha256").update(s).digest("hex");
const bundle = `console.log(JSON.stringify({api_pid:process.pid,mode:[process.env.NODE_ENV,process.env.API_INSPECTION_BOOT]}));process.exit(Number(process.env.STUB_API_EXIT || 0));`;
function fixture(t, preflight = `console.log("PREFLIGHT_STUB");`) {
  const root = mkdtempSync(join(tmpdir(), "api-start-audit-"));
  t.after(() => { chmodSync(join(root, "reports"), 0o700); rmSync(root, { recursive: true, force: true }); });
  for (const p of ["scripts", "reports/e2-apertura-limitada/reconstruccion", "artifacts/api-server/dist"]) mkdirSync(join(root, p), { recursive: true });
  writeFileSync(join(root, "scripts/api-start-audit.sh"), wrapper
    .replaceAll("9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f", hash(preflight))
    .replaceAll("3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98", hash(bundle)));
  copyFileSync(logger, join(root, "scripts/api-start-audit-record.mjs"));
  writeFileSync(join(root, "reports/e2-apertura-limitada/reconstruccion/runtime-preflight.mjs"), preflight);
  writeFileSync(join(root, "artifacts/api-server/dist/index.mjs"), bundle);
  return root;
}
const env = { PATH: process.env.PATH, NODE_ENV: "inherited-mode", API_INSPECTION_BOOT: "0", DATABASE_URL: "SECRET_CANARY", STUB_API_EXIT: "0" };
const run = (root, extra = {}) => spawnSync("bash", ["scripts/api-start-audit.sh"], { cwd: root, env: { ...env, ...extra }, encoding: "utf8" });
const entries = (root) => readFileSync(join(root, "reports/arranques-api.log"), "utf8").trim().split("\n").map(JSON.parse);

test("exec PID, modes, UTC, hash, API exit and append preservation", (t) => {
  const root = fixture(t);
  const first = run(root, { STUB_API_EXIT: "23" });
  assert.equal(first.status, 23);
  const old = readFileSync(join(root, "reports/arranques-api.log"), "utf8");
  const [e] = entries(root);
  assert.equal(e.pid, first.pid);
  assert.equal(JSON.parse(first.stdout.trim().split("\n")[1]).api_pid, e.pid);
  assert.equal(e.bundle_sha256, hash(bundle));
  assert.equal(e.utc, new Date(e.utc).toISOString());
  assert.deepEqual(e.mode, { NODE_ENV: "development", API_INSPECTION_BOOT: "1" });
  assert.deepEqual(e.preflight, { result: "passed", exit_code: 0 });
  assert.equal(e.pid_role, "exec_target");
  assert.equal(e.startup_exit_before_exec, null);
  assert.equal(run(root).status, 0);
  assert.equal(entries(root).length, 2);
  assert.ok(readFileSync(join(root, "reports/arranques-api.log"), "utf8").startsWith(old));
  assert.ok(!old.includes("SECRET_CANARY"));
});

test("preflight failure preserves output and exit without API", (t) => {
  const root = fixture(t, `console.log("PRE_OUT");console.error("PRE_ERR");process.exit(37);`);
  const r = run(root);
  assert.equal(r.status, 37);
  assert.equal(r.stdout, "PRE_OUT\n");
  assert.equal(r.stderr, "PRE_ERR\n");
  assert.deepEqual(entries(root)[0].preflight, { result: "failed", exit_code: 37 });
  assert.equal(entries(root)[0].pid_role, "startup_shell_no_api");
});

for (const target of ["preflight", "bundle", "missing"]) test(`initial ${target} hash rejection`, (t) => {
  const root = fixture(t);
  const path = join(root, target === "preflight" ? "reports/e2-apertura-limitada/reconstruccion/runtime-preflight.mjs" : "artifacts/api-server/dist/index.mjs");
  if (target === "missing") rmSync(path); else writeFileSync(path, "tampered");
  const r = run(root);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  const [e] = entries(root);
  assert.equal(e.api_exec_attempted, false);
  assert.deepEqual(e.preflight, { result: "not_run", exit_code: null });
  assert.deepEqual(e.mode, { NODE_ENV: "inherited-mode", API_INSPECTION_BOOT: "0" });
  if (target === "missing") { assert.equal(e.bundle_sha256, null); assert.equal(e.bundle_hash_error, "ENOENT"); }
});

test("post-preflight hash rejection still records successful preflight, no API", (t) => {
  const root = fixture(t, `import {appendFileSync} from "node:fs";appendFileSync("artifacts/api-server/dist/index.mjs","\\n//mutation");`);
  assert.equal(run(root).status, 1);
  const [e] = entries(root);
  assert.equal(e.stage, "bundle_hash_after");
  assert.equal(e.api_exec_attempted, false);
  assert.equal(e.preflight.result, "passed");
  assert.equal(e.bundle_sha256, hash(bundle + "\n//mutation"));
});

test("permission-denied logging never blocks API or masks preflight failure", (t) => {
  assert.notEqual(process.getuid(), 0, "permission test requires non-root");
  for (const fail of [false, true]) {
    const root = fixture(t, fail ? "process.exit(19);" : "");
    chmodSync(join(root, "reports"), 0o500);
    const r = run(root, { STUB_API_EXIT: "29" });
    assert.equal(r.status, fail ? 19 : 29);
    assert.match(r.stderr, /WARNING/);
    assert.ok(!r.stderr.includes("SECRET_CANARY"));
    if (!fail) assert.equal(JSON.parse(r.stdout).api_pid, r.pid);
  }
});

test("concurrent launches append complete independent lines with real exec PIDs", async (t) => {
  const root = fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, () => new Promise((resolve, reject) => {
    const child = spawn("bash", ["scripts/api-start-audit.sh"], { cwd: root, env });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, pid: child.pid, out }));
  })));
  const rows = entries(root);
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((e) => e.pid)).size, 12);
  for (const r of results) {
    assert.equal(r.code, 0);
    assert.equal(JSON.parse(r.out.trim().split("\n")[1]).api_pid, r.pid);
    assert.ok(rows.some((e) => e.pid === r.pid));
  }
});