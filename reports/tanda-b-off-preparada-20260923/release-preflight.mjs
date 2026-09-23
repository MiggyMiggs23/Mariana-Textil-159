import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { report, requireMain, pgTools, pgEnvironment, catalog, fingerprints, digest, json, closedEnv, verifyOutputs } from "./common.mjs";
export function main() {
  requireMain();
  assert.equal(process.env.API_INSPECTION_BOOT, "1");
  assert.equal(process.env.NODE_ENV, "development");
  for (const key of ["TEST_DATABASE_URL","APPLICATION_DATABASE_URL","NODE_OPTIONS","API_LIMITED_STARTUP_APPROVAL","API_STARTUP_MODE"]) {
    assert.ok(!process.env[key], `Forbidden selector ${key}`);
  }
  for (const [key, value] of Object.entries(closedEnv)) assert.equal(process.env[key], value, `Explicit OFF required: ${key}`);
  verifyOutputs();
  const expected = json(path.join(report,"release-expected.json"));
  assert.equal(expected.provenance, "REAL_READONLY_PID191");
  assert.equal(digest(fs.readFileSync(path.join(report,"evidencia/live/catalog-B0-real.json"))),expected.captureSha256);
  assert.equal(process.env.TANDA_B_RUNTIME_PID,"191");
  const runtimeUrl=fs.readFileSync("/proc/191/environ","utf8").split("\0").find(x=>x.startsWith("DATABASE_URL="))?.slice(13);
  assert.ok(runtimeUrl && runtimeUrl===process.env.DATABASE_URL,"Preflight target differs from retained PID191");
  const bin = pgTools();
  const c = catalog(pgEnvironment(process.env.DATABASE_URL, bin), bin);
  for (const [k,v] of Object.entries(expected.identity)) assert.equal(c[k],v, `Real identity mismatch: ${k}`);
  assert.deepEqual(fingerprints(c), { schemaSha256:expected.schemaSha256, attributesSha256:expected.attributesSha256 });
  console.log("TANDA_B_OFF_REAL_PREFLIGHT=PASS");
}
if (process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) { console.error(`TANDA_B_OFF_REAL_PREFLIGHT=FAIL ${error.message}`); process.exitCode=1; }
}