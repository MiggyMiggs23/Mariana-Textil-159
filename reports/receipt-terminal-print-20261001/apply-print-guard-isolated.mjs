// MAIN ONLY. Installs only receipt-print-authority.sql in an already-running disposable harness.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { financialSnapshot, printAudit } from "../receipt-terminal-runtime-20261001/fixture.mjs";
const { Client } = createRequire(path.resolve("lib/db/package.json"))("pg");
const sha = x => crypto.createHash("sha256").update(x).digest("hex");
const run = path.resolve(process.argv[2] ?? "");
assert(run.startsWith(path.resolve("reports/receipt-terminal-runtime-20261001") + path.sep));
assert.equal(process.argv[3], "--main-authorized");
const state = JSON.parse(fs.readFileSync(path.join(run, "result.json")));
const expected = JSON.parse(fs.readFileSync(path.join(run, "api-effective-identity.json")));
const pid = state.apiPid;
assert(Number.isSafeInteger(pid) && pid > 1);
const command = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
assert(command.includes(path.join(run, "bootstrap.mjs")), "Not the identified disposable API");
const env = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(Boolean)
  .map(v => { const i = v.indexOf("="); return [v.slice(0, i), v.slice(i + 1)]; }));
assert(env.DATABASE_URL);
const u = new URL(env.DATABASE_URL);
assert(!/neon/i.test(u.hostname) && decodeURIComponent(u.pathname.slice(1)) === expected.database && expected.database.startsWith("isolated_test_"));
const sqlFile = path.resolve("lib/db/src/lib/receipt-print-authority.sql"), sql = fs.readFileSync(sqlFile, "utf8");
assert.equal(sha(sql), "ee12bcaace99ed9b7c6abe51b80efa3a554c44d36f9bd94f30169761a68b66a5", "SQL revision drift");
const c = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await c.connect();
  await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await c.query("SET LOCAL lock_timeout='3s'");
  await c.query("SET LOCAL statement_timeout='30s'");
  const actual = (await c.query(`SELECT current_database() AS database,current_setting('data_directory') AS directory,current_setting('listen_addresses') AS listen`)).rows[0];
  assert.equal(actual.database, expected.database); assert.equal(actual.listen, "");
  assert.equal(sha(actual.directory), expected.directoryHash);
  const functions = async () => (await c.query(`SELECT p.oid::text, n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS args,
    pg_get_functiondef(p.oid) AS definition,p.proowner::text,p.proacl::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.oid`)).rows;
  const beforeFunctions = await functions(), beforeMoney = await financialSnapshot(c), beforeAudit = await printAudit(c);
  await c.query(sql);
  const afterFunctions = await functions(), afterMoney = await financialSnapshot(c), afterAudit = await printAudit(c);
  assert.deepEqual(afterMoney, beforeMoney); assert.deepEqual(afterAudit, beforeAudit);
  const others = rows => rows.filter(r => r.proname !== "e5_insert_authority");
  assert.deepEqual(others(afterFunctions), others(beforeFunctions), "Unrelated database function changed");
  const before = beforeFunctions.find(r => r.proname === "e5_insert_authority" && r.args === "");
  const after = afterFunctions.find(r => r.proname === "e5_insert_authority" && r.args === "");
  assert(after.definition.includes("RECEIPT_MATRIX_PRINT_V1"));
  assert.equal(after.proowner, before.proowner); assert.equal(after.proacl, before.proacl);
  await c.query("COMMIT");
  const output = { status: "ISOLATED_GUARD_APPLIED", sqlSha256: sha(sql), scriptSha256: sha(fs.readFileSync(import.meta.filename)),
    database: actual.database, apiPid: pid, onlyFunction: "public.e5_insert_authority()", beforeHash: sha(before.definition),
    afterHash: sha(after.definition), financialRowsUnchanged: true, auditRowsUnchanged: true, otherFunctionsUnchanged: true,
    noApiRestart: true, noLiveDatabaseAccess: true };
  fs.writeFileSync(path.join(run, `receipt-print-guard-${Date.now()}.json`), JSON.stringify(output, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(output));
} catch {
  await c.query("ROLLBACK").catch(() => {});
  console.error("ISOLATED_GUARD_FAILED_CLOSED: inspect identity/SQL in controlled harness; no URI logged.");
  process.exitCode = 1;
} finally { await c.end(); }