import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { report, revision, requireMain, pgTools, pgEnvironment, catalog, fingerprints, digest, write, run } from "./common.mjs";
requireMain();
const bin = pgTools();
assert.equal(process.env.TANDA_B_RUNTIME_PID, "191", "Explicit retained PID191 required");
assert.ok(process.env.DATABASE_URL, "Explicit DATABASE_URL required; no fallback");
const stat = fs.readFileSync("/proc/191/stat", "utf8");
const runtimeUrl = fs.readFileSync("/proc/191/environ","utf8").split("\0").find(x => x.startsWith("DATABASE_URL="))?.slice(13);
assert.ok(runtimeUrl && runtimeUrl === process.env.DATABASE_URL, "Target differs from PID191");
const cmdline = fs.readFileSync("/proc/191/cmdline");
assert.match(cmdline.toString(), /node/);
const live = path.join(report,"evidencia/live");
assert.ok(!fs.existsSync(live), "Capture evidence exists; never overwrite");
fs.mkdirSync(live);
const env = pgEnvironment(runtimeUrl, bin);
try {
  const c = catalog(env, bin);
  write(path.join(live,"catalog-B0-real.json"), c);
  // Schema only: neither application actors nor pg_authid/role credentials are copied.
  const dump = run(path.join(bin,"pg_dump"), ["--schema-only", "--format=plain", "--no-security-labels"], { env }).stdout;
  assert.ok(!/\bCREATE\s+USER\s+MAPPING\b|\bPASSWORD\s+'|\b(?:postgres|postgresql):\/\/[^'"\s]+:[^'"\s]+@/i.test(dump),
    "Potential credential-bearing schema content; refusing to persist dump");
  fs.writeFileSync(path.join(live,"schema-B0-real.sql"),dump,{flag:"wx"});
  const after = catalog(env, bin);
  assert.deepEqual(fingerprints(after), fingerprints(c), "Catalog drift across capture");
  assert.equal(fs.readFileSync("/proc/191/stat","utf8").split(") ")[1].split(" ")[19], stat.split(") ")[1].split(" ")[19], "PID reused");
  const identity = Object.fromEntries(["database","databaseOid","schema","role","serverVersionNum"].map(k => [k,c[k]]));
  write(path.join(report,"release-expected.json"), { provenance: "REAL_READONLY_PID191", revision, identity, ...fingerprints(c),
    captureSha256: digest(fs.readFileSync(path.join(live,"catalog-B0-real.json"))),
    dumpSha256: digest(fs.readFileSync(path.join(live,"schema-B0-real.sql"))) });
  write(path.join(live,"read-only-capture.json"), { status: "PASS_READ_ONLY", pid:191, sameDatabaseUrlAsRuntime:true,
    revision, identity, transaction:"REPEATABLE READ READ ONLY; ROLLBACK", pgOptions:env.PGOPTIONS,
    cmdlineSha256:digest(cmdline), credentialsRecorded:false, actorsCopied:false, stableCatalog:true });
  console.log("TANDA_B_CAPTURE=PASS_READ_ONLY");
} catch (error) {
  write(path.join(live,"failure.json"), { status:"FAIL", reason:error.message, credentialsRecorded:false });
  throw error;
}