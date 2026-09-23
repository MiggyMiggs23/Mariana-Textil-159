import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const reportDir = "reports/e9-e5-e7-continuacion-20260923/e9";
const sqlFile = "reports/e9/03-desacoplar-fondo-preparado.sql";
const authorization = "reports/e9-e5-e7-continuacion-20260923/autorizacion.txt";
const rehearsal = `${reportDir}/disposable-status.json`;
const outputFile = `${reportDir}/live-sql.log`;
const statusFile = `${reportDir}/live-status.json`;
const pid = process.argv[2];
const psql = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql";

assert(/^[1-9]\d*$/.test(pid ?? ""), "Effective API PID required");
assert(fs.existsSync(authorization), "Literal owner authorization missing");
assert(fs.existsSync(sqlFile), "Corrected SQL missing");
const proof = JSON.parse(fs.readFileSync(rehearsal, "utf8"));
assert.equal(proof.result, "PASS");
assert.equal(proof.postgresErrorFixed, "22P02");
assert.equal(proof.sqlAppliedInDisposable, true);
assert.equal(proof.clusterDestroyed, true);
assert.equal(proof.fondoIngressEnabled, false);

const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
assert(cmdline.includes("artifacts/api-server/dist-e7-e11-20260923/index.mjs"),
  "Unexpected effective API process");
const entries = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
const urls = entries.filter((value) => value.startsWith("DATABASE_URL="));
assert.equal(urls.length, 1, "Effective API must have exactly one DATABASE_URL");
const url = new URL(urls[0].slice("DATABASE_URL=".length));
assert(["postgres:", "postgresql:"].includes(url.protocol));
const env = {
  PATH: process.env.PATH,
  PGHOST: url.searchParams.get("host") || url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
  PGCONNECT_TIMEOUT: "5",
};
assert.equal(env.PGDATABASE, "heliumdb", "Unexpected effective database name");

const snapshotSql = String.raw`
SELECT json_build_object(
  'database',current_database(),
  'e9Count',(SELECT count(*) FROM e9_entregas),
  'e9Fingerprint',(SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id::text),'')) FROM e9_entregas t),
  'fondoCount',(SELECT count(*) FROM fondo_movimientos),
  'fondoFingerprint',(SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id::text),'')) FROM fondo_movimientos t),
  'functionHash',md5(pg_get_functiondef('e9_validate_detail()'::regprocedure)),
  'correctedParentheses',position('((d->''investigacion'')-ARRAY[''estado'',''cierre''])' in pg_get_functiondef('e9_validate_detail()'::regprocedure))>0,
  'buggyExpression',position('d->''investigacion''-ARRAY[''estado'',''cierre'']' in pg_get_functiondef('e9_validate_detail()'::regprocedure))>0
)::text;`;

function run(args, input) {
  return spawnSync(psql, args, {
    env,
    encoding: "utf8",
    input,
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function snapshot() {
  const result = run(["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], snapshotSql);
  assert.equal(result.status, 0, result.stderr || "Snapshot failed");
  return JSON.parse(result.stdout.trim());
}

const status = {
  result: "FAIL",
  effectiveApiPid: Number(pid),
  database: env.PGDATABASE,
  sqlApplied: false,
  committed: false,
  rowsUnchanged: false,
  fondoIngressEnabled: false,
};

try {
  const before = snapshot();
  assert.equal(before.database, "heliumdb");
  const applied = run(["-X", "-v", "ON_ERROR_STOP=1", "-f", sqlFile]);
  fs.writeFileSync(outputFile, (applied.stdout || "") + (applied.stderr || ""), { flag: "wx" });
  assert.equal(applied.status, 0, "Corrected E9 SQL failed; stopped without recovery");
  status.sqlApplied = true;
  status.committed = true;
  const after = snapshot();
  assert.equal(after.correctedParentheses, true, "Corrected expression not installed");
  assert.equal(after.buggyExpression, false, "Buggy expression remains installed");
  for (const key of ["e9Count", "e9Fingerprint", "fondoCount", "fondoFingerprint"]) {
    assert.deepEqual(after[key], before[key], `${key} changed unexpectedly`);
  }
  status.rowsUnchanged = true;
  status.result = "PASS";
  status.before = before;
  status.after = after;
} catch (error) {
  status.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({
    result: status.result,
    database: status.database,
    sqlApplied: status.sqlApplied,
    committed: status.committed,
    rowsUnchanged: status.rowsUnchanged,
    fondoIngressEnabled: false,
  }));
}