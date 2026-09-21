import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const relative = "reports/e2-paquete-liberacion-preparado-20260921";
const hash = value => createHash("sha256").update(value).digest("hex");
const wrapper = fs.readFileSync(path.join(dir, "api-start-audit.sh"), "utf8");
const stub = 'console.log(JSON.stringify({pid:process.pid,mode:process.env.NODE_ENV,inspection:process.env.API_INSPECTION_BOOT}));process.exit(Number(process.env.STUB_EXIT||0));';
function fixture(t, preflight = 'console.log("preflight positive");') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e2-wrapper-unit-"));
  const pkg = path.join(root, relative);
  fs.mkdirSync(pkg, { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts/api-server/dist-e2-20260927"), { recursive: true });
  fs.writeFileSync(path.join(pkg, "release-preflight.mjs"), preflight);
  fs.copyFileSync(path.join(dir, "api-start-audit-record.mjs"), path.join(pkg, "api-start-audit-record.mjs"));
  fs.writeFileSync(path.join(root, "artifacts/api-server/dist-e2-20260927/index.mjs"), stub);
  const manifest = [
    `${hash(stub)}  artifacts/api-server/dist-e2-20260927/index.mjs`,
    `${hash(preflight)}  ${relative}/release-preflight.mjs`,
    `${hash(fs.readFileSync(path.join(pkg, "api-start-audit-record.mjs")))}  ${relative}/api-start-audit-record.mjs`,
  ].join("\n") + "\n";
  fs.writeFileSync(path.join(pkg, "release-assets.sha256"), manifest);
  fs.writeFileSync(path.join(pkg, "api-start-audit.sh"), wrapper.replace("14e994f880f6e03b71e0566a40bfba38d8d445c5ff6d0f997d735c0b5d5219de", hash(manifest)));
  t.after(() => { fs.chmodSync(path.join(root, "reports"), 0o700); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, pkg };
}
const run = ({ root }, extra = {}) => spawnSync("bash", [`${relative}/api-start-audit.sh`], {
  cwd: root, env: { PATH: process.env.PATH, DATABASE_URL: "SECRET_SENTINEL", NODE_ENV: "inherited",
    API_INSPECTION_BOOT: "0", ...extra }, encoding: "utf8",
});
const entries = ({ root }) => fs.readFileSync(path.join(root, "reports/arranques-api.log"), "utf8").trim().split("\n").map(JSON.parse);
test("exec same PID, inspection mode, exact bundle hash and append log", t => {
  const f = fixture(t);
  const result = run(f, { STUB_EXIT: "23" });
  assert.equal(result.status, 23);
  const [entry] = entries(f);
  assert.equal(entry.pid, result.pid);
  assert.equal(JSON.parse(result.stdout.trim().split("\n").at(-1)).pid, result.pid);
  assert.equal(entry.bundle_sha256, hash(stub));
  assert.deepEqual(entry.mode, { NODE_ENV: "development", API_INSPECTION_BOOT: "1" });
  assert.equal(entry.preflight.result, "passed");
  assert.equal(run(f).status, 0);
  assert.equal(entries(f).length, 2);
  assert.ok(!JSON.stringify(entries(f)).includes("SECRET_SENTINEL"));
});
test("preflight failure stays fatal with original exit", t => {
  const f = fixture(t, 'console.error("preflight rejected");process.exit(37);');
  const result = run(f);
  assert.equal(result.status, 37);
  assert.equal(result.stdout, "");
  assert.equal(entries(f)[0].api_exec_attempted, false);
  assert.deepEqual(entries(f)[0].preflight, { result: "failed", exit_code: 37 });
});
for (const target of ["bundle", "preflight", "manifest", "missing"]) test(`${target} hash failure prevents exec`, t => {
  const f = fixture(t);
  const file = target === "preflight" ? path.join(f.pkg, "release-preflight.mjs")
    : target === "manifest" ? path.join(f.pkg, "release-assets.sha256")
      : path.join(f.root, "artifacts/api-server/dist-e2-20260927/index.mjs");
  if (target === "missing") fs.unlinkSync(file); else fs.appendFileSync(file, "\n//changed");
  const result = run(f);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(entries(f)[0].api_exec_attempted, false);
});
test("post-preflight bundle change blocks exec", t => {
  const f = fixture(t, 'import fs from "node:fs";fs.appendFileSync("artifacts/api-server/dist-e2-20260927/index.mjs","\\n//changed");');
  assert.equal(run(f).status, 1);
  assert.equal(entries(f)[0].stage, "release_hash_after");
  assert.equal(entries(f)[0].api_exec_attempted, false);
});
test("append failure never blocks stub exec or masks fatal preflight", t => {
  assert.notEqual(process.getuid(), 0);
  for (const fail of [false, true]) {
    const f = fixture(t, fail ? "process.exit(19);" : "");
    fs.chmodSync(path.join(f.root, "reports"), 0o500);
    const result = run(f, { STUB_EXIT: "29" });
    assert.equal(result.status, fail ? 19 : 29);
    assert.match(result.stderr, /WARNING/);
    assert.ok(!result.stderr.includes("SECRET_SENTINEL"));
  }
});