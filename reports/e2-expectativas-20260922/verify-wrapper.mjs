// No database access or application startup. The exact release wrapper is run
// only in /tmp with a deliberately damaged inventory, so it must fail first.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const out = path.dirname(fileURLToPath(import.meta.url));
const relative = "reports/e2-paquete-liberacion-preparado-20260921";
const pkg = path.resolve(relative);
const clean = { PATH: process.env.PATH, HOME: "/tmp", LANG: "C.UTF-8" };
const sha = value => createHash("sha256").update(value).digest("hex");
const read = name => fs.readFileSync(path.join(pkg, name));
const wrapper = read("api-start-audit.sh");
const assets = read("release-assets.sha256");
assert.ok(wrapper.toString().includes(`= ${sha(assets)} || return 1`));
const intact = spawnSync("sha256sum", ["--check", "--status", path.join(pkg, "release-assets.sha256")], { env: clean, encoding: "utf8" });
assert.equal(intact.status, 0, intact.stderr);
const result = spawnSync("node", ["--test", "--test-reporter=tap", path.join(pkg, "release-wrapper.test.mjs")],
  { env: clean, encoding: "utf8", timeout: 120000 });
const logPath = path.join(out, "wrapper-9-tests.tap");
if (fs.existsSync(logPath)) {
  fs.copyFileSync(logPath, path.join(out, "wrapper-first-run-default-reporter.log"));
}
fs.writeFileSync(path.join(out, "wrapper-9-tests.tap"), result.stdout + result.stderr);
assert.equal(result.status, 0);
assert.match(result.stdout, /# tests 9\b/);
assert.match(result.stdout, /# pass 9\b/);
assert.match(result.stdout, /# fail 0\b/);
assert.match(result.stdout, /ok \d+ - manifest hash failure prevents exec/);
const root = fs.mkdtempSync("/tmp/e2-exact-wrapper-tamper-");
let evidence;
try {
  const target = path.join(root, relative);
  fs.mkdirSync(target, { recursive: true });
  for (const file of ["api-start-audit.sh", "api-start-audit-record.mjs", "release-assets.sha256"]) {
    fs.copyFileSync(path.join(pkg, file), path.join(target, file));
  }
  fs.appendFileSync(path.join(target, "release-assets.sha256"), "\n# deliberate isolated alteration\n");
  const changed = fs.readFileSync(path.join(target, "release-assets.sha256"));
  assert.notEqual(sha(changed), sha(assets));
  assert.equal(sha(fs.readFileSync(path.join(target, "api-start-audit.sh"))), sha(wrapper));
  const attempt = spawnSync("bash", [`${relative}/api-start-audit.sh`],
    { cwd: root, env: clean, encoding: "utf8", timeout: 10000 });
  assert.equal(attempt.status, 1);
  assert.equal(attempt.stdout, "");
  const audit = JSON.parse(fs.readFileSync(path.join(root, "reports/arranques-api.log"), "utf8").trim());
  assert.equal(audit.api_exec_attempted, false);
  assert.equal(audit.stage, "release_hash_before");
  assert.equal(audit.preflight.result, "not_run");
  evidence = {
    at: new Date().toISOString(), nineTests: { passed: 9, failed: 0, exit: result.status },
    intactAssetsCheckExit: intact.status,
    exactWrapperSha256: sha(wrapper), expectedInventorySha256: sha(assets),
    tamperedInventorySha256: sha(changed), exactWrapperUnmodifiedInProbe: true,
    rejection: { exit: attempt.status, stdout: attempt.stdout, audit },
    databaseAccess: false, appStarted: false, isolation: root,
  };
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
assert.deepEqual(read("api-start-audit.sh"), wrapper);
assert.deepEqual(read("release-assets.sha256"), assets);
evidence.isolationDestroyed = !fs.existsSync(root);
fs.writeFileSync(path.join(out, "wrapper-verification.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log("WRAPPER=9/9 PASS; EXACT_WRAPPER_TAMPER_REJECTION=PASS");