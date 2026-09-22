// Unsealed candidate revision only. Never touches dev dist, E2, CLOSED or any DB.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = "/home/runner/workspace";
const dir = path.join(root, "reports/e3-apertura-preparada-20260922");
const stage = path.join(dir, "source");
const statusPath = path.join(dir, "preparation-status.json");
const status = JSON.parse(fs.readFileSync(statusPath));
assert.equal(status.status, "BUILT_NOT_REHEARSED_NOT_RELEASED");
assert(!fs.existsSync(path.join(dir, "manifest.json")), "Sealed/final manifest exists: stop.");
const archive = path.join(dir, "evidencia/build-r0-incomplete-cash");
assert(!fs.existsSync(archive), "Attempt already exists: preserve and stop.");
fs.mkdirSync(archive, { recursive: true });
fs.copyFileSync(statusPath, path.join(archive, "preparation-status.json"));
const red = JSON.parse(fs.readFileSync(path.join(dir,"evidencia/arranque-candidato-r0/candidate-start-results.json")));
assert.equal(red.status, "FAIL");
assert.equal(red.candidateStopped, true);
assert.equal(red.postgresStopExit, 0);
assert.equal(red.disposableDestroyed, true);
const attribution = JSON.parse(fs.readFileSync(path.join(dir,"evidencia/r0-attribution.json")));
assert.equal(attribution.status, "RED_SOURCE_CASH_GATE_OBSERVED_NOT_SQL04_PROOF");
assert.equal(attribution.observation.errorType, "CreditEvidenceError");
assert.equal(attribution.observation.message, "E3: la captura de ingreso nuevo de efectivo de crédito permanece deshabilitada.");
assert.equal(attribution.observation.requestId, 3);
assert.match(red.error, /500 !== 201/);
fs.copyFileSync(path.join(dir,"api-start-audit.sh"),path.join(archive,"api-start-audit.sh"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
// Preserve original outputs and snapshot sources affected by the correction.
for (const [rel, hash] of Object.entries(status.outputs))
  assert.equal(sha(fs.readFileSync(path.join(root, rel))), hash);
fs.cpSync(status.apiOut, path.join(archive, "api-output"), { recursive: true });
fs.copyFileSync(path.join(dir, "release-assets.sha256"), path.join(archive, "release-assets.sha256"));
for (const rel of ["artifacts/api-server/src/lib/credit-evidence-contract.ts",
  "artifacts/api-server/src/lib/credit-abono-evidence.ts",
  "artifacts/api-server/src/routes/e3-collections.ts",
  "artifacts/api-server/src/lib/e3-ordinary-cash-release.ts"]) {
  const old = path.join(stage, rel);
  if (fs.existsSync(old)) fs.copyFileSync(old, path.join(archive, path.basename(rel)));
  const bytes = fs.readFileSync(path.join(root, rel));
  status.sourceFiles[rel] = sha(bytes);
  fs.copyFileSync(path.join(root, rel), old);
}
const gate = "artifacts/api-server/src/lib/e3-ordinary-cash-release.ts";
const off = "export const E3_ORDINARY_CASH_ENABLED = false;";
const on = "export const E3_ORDINARY_CASH_ENABLED = true;";
const content = fs.readFileSync(path.join(stage, gate), "utf8");
assert.equal(content.split(off).length, 2);
fs.writeFileSync(path.join(stage, gate), content.replace(off, on));
status.activatedFiles[gate] = sha(fs.readFileSync(path.join(stage, gate)));
fs.appendFileSync(path.join(dir, "activation.patch"), `--- a/${gate}\n+++ b/${gate}\n@@\n-${off}\n+${on}\n`);
const result = spawnSync(process.execPath, ["build.mjs"], {
  cwd: path.join(stage, "artifacts/api-server"),
  env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8",
    NODE_ENV: "production", API_BUILD_OUTPUT_DIR: status.apiOut },
  encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
});
fs.writeFileSync(path.join(dir, "build-api-r1.log"), result.stdout + result.stderr, { flag: "wx" });
assert.equal(result.status, 0, "Build failed; preserve archive and incomplete outputs, do not rehearse.");
const files = {};
function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name), stat = fs.lstatSync(full);
    assert(!stat.isSymbolicLink());
    if (stat.isDirectory()) walk(full);
    else files[path.relative(root, full)] = sha(fs.readFileSync(full));
  }
}
walk(status.apiOut); walk(status.webOut); status.outputs = files;
for (const [file, hash] of Object.entries(status.sourceFiles))
  assert.equal(sha(fs.readFileSync(path.join(root, file))), hash, `Source drift: ${file}`);
for (const file of ["credit-evidence-contract.ts","credit-abono-evidence.ts"]) {
  const txt = fs.readFileSync(path.join(stage,"artifacts/api-server/src/lib",file),"utf8");
  assert(!/export const CREDIT_\w+_ENABLED = true/.test(txt), "Unrelated gate activated");
}
assert(fs.readFileSync(path.join(root,gate),"utf8").includes(off));
const controls = ["release-preflight.mjs","release-expected.json","release-catalog.sql","api-start-audit-record.mjs"];
const inventory = { ...files };
for (const file of controls) inventory[`reports/e3-apertura-preparada-20260922/${file}`] = sha(fs.readFileSync(path.join(dir,file)));
const text = Object.entries(inventory).sort(([a],[b]) => a.localeCompare(b)).map(([f,h]) => `${h}  ${f}\n`).join("");
fs.writeFileSync(path.join(dir,"release-assets.sha256"),text);
const wrapper = fs.readFileSync(path.join(dir,"api-start-audit.template.sh"),"utf8")
  .replace("d724585b2ac42658c32de38bd95e96dfc95a881a95c1377566d06d3fe64133fe",sha(text));
fs.writeFileSync(path.join(dir,"api-start-audit.sh"),wrapper);
status.status = "BUILT_R1_ORDINARY_CASH_NOT_REHEARSED_NOT_RELEASED";
status.r0 = "evidencia/build-r0-incomplete-cash";
status.reason = "R0 source E1 cash and E2 finalization stayed closed; introduced narrowly scoped E3 ordinary cash gate, no directed/refund gate changed.";
fs.writeFileSync(statusPath,JSON.stringify(status,null,2)+"\n");
console.log(JSON.stringify({status:status.status,apiSha256:files["artifacts/api-server/dist-e3-apertura-20260922/index.mjs"],inventorySha256:sha(text)}));