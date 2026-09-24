import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";

// One-shot operator, not imported by application startup. Never stores connection URIs.
const out = "reports/tanda-h/application/physical-check-result.json";
const sha = value => createHash("sha256").update(value).digest("hex");
const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const expectedSqlHash = "028394e16327b5a1784a18aa72c29462bd4917d8d88bf01159b0669558174a1d";
const report = { startedAt: new Date().toISOString(), status: "preflight", commitConfirmed: false,
  authorization: { source: "Current MAIN delegation and follow-up Please begin!",
    summary: "Apply only the exact disposable-copy-tested physical CHECK to the effective app DB after identity, backup and evidence verification. No indexes, row writes, operational tests, auth login, restart, generic migration, schema push, gate changes or repairs.",
    trace: "MAIN delegates authorized exact liveDDL execution now for physicalCHECK only (indexes wait MAINnext). User explicitly apply appDB after copy.",
    sqlSha256: expectedSqlHash },
  quiescenceClaim: false, operationalTestsOnApplication: false, rowWriteStatements: 0 };
let c;
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
const identitySql = "select current_database() database,current_user db_user,inet_server_addr() server_address,inet_server_port() server_port,current_setting('server_version_num') version,pg_postmaster_start_time()::text server_start";
const identityKeys = ["database", "db_user", "server_address", "server_port", "version"];
const catalogSql = "select conname,contype,convalidated,connoinherit,to_json(conkey) conkey,pg_get_constraintdef(oid,false) definition from pg_catalog.pg_constraint where conrelid='public.rollos'::regclass and conname=$1";
const name = "rollos_physical_quantity_nonnegative_check";
async function snapshot() {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const meta = (await c.query("select txid_current_snapshot()::text snapshot,pg_backend_pid() backend_pid")).rows[0];
    const tables = (await c.query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast' order by 1,2")).rows;
    const results = [];
    for (const t of tables) {
      assert.match(t.schema, /^[a-z_][a-z0-9_]*$/); assert.match(t.name, /^[a-z_][a-z0-9_]*$/);
      const row = (await c.query(`select count(*)::text count,md5(coalesce(string_agg(serialized,E'\\n' order by serialized collate "C"),'')) digest from (select row_to_json(r)::text serialized from "${t.schema}"."${t.name}" r) s`)).rows[0];
      results.push({ ...t, ...row });
    }
    await c.query("COMMIT");
    return { ...meta, serialization: 'PostgreSQL row_to_json(full row)::text; UTC; sorted COLLATE C; newline separator; MD5; counts separate', tables: results, manifestSha256: sha(JSON.stringify(results)) };
  } catch (e) { await c.query("ROLLBACK"); throw e; }
}
try {
  assert.equal(process.argv[2], "--apply-authorized-physical-check");
  assert.equal(fs.existsSync(out), false, "Terminal report already exists; do not repeat automatically");
  const source = read("reports/tanda-h/setup/source-identity.json");
  const captured = read("reports/tanda-h/setup/quantity-preflight.json").identity;
  const ddl = fs.readFileSync("reports/tanda-h/tarea-1/apply-physical-check.sql", "utf8");
  assert.equal(sha(ddl), expectedSqlHash);
  const dumpHash = sha(fs.readFileSync(".local/tanda-h/source.dump"));
  assert.equal(dumpHash, source.sha256);
  report.backup = { path: ".local/tanda-h/source.dump", sha256: dumpHash, verified: true };
  report.copyEvidence = {};
  for (const [file, total, passed] of [["producer-red", 44, 16], ["producer-green", 44, 44], ["check-copy", 56, 56]]) {
    const path = `reports/tanda-h/tarea-1/${file}.json`, evidence = read(path);
    assert.equal(evidence.identity.db, "tanda_h_inventory");
    assert.equal(evidence.identity.actor, "h_inventory");
    assert.equal(evidence.identity.port, 55444);
    assert.equal(evidence.results.length, total);
    assert.equal(evidence.results.filter(x => x.pass).length, passed);
    if (file !== "check-copy") assert.deepEqual(evidence.guards, []);
    else { assert.deepEqual(evidence.before, evidence.after); assert.equal(evidence.catalog.convalidated, true); }
    report.copyEvidence[file] = { sha256: sha(fs.readFileSync(path)), total, passed };
  }
  const candidates = fs.readdirSync("/proc").filter(x => /^\d+$/.test(x)).filter(pid => {
    try { return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").some(x => /^(?:.*\/)?artifacts\/api-server\/dist[^/]*\/index\.mjs$/.test(x)); } catch { return false; }
  });
  assert.equal(candidates.length, 1);
  const pid = Number(candidates[0]), cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
  assert.ok(cmd.some(x => x.endsWith("artifacts/api-server/dist-tanda-g-strict-candidate/index.mjs")));
  const vars = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(x => x.includes("=")).map(x => [x.slice(0,x.indexOf("=")),x.slice(x.indexOf("=")+1)]));
  const uri = vars.TEST_DATABASE_URL || vars.DATABASE_URL;
  assert.ok(uri);
  report.source = { apiPid: pid, command: cmd.filter(Boolean).join(" "), capturedApiPid: source.apiPid };
  c = new pg.Client({ connectionString: uri, connectionTimeoutMillis: 8000, application_name: "tanda_h_authorized_physical_check" });
  c.on("notice", n => { (report.notices ||= []).push({ code: n.code, message: n.message }); });
  await c.connect();
  await c.query("SET statement_timeout='30s'; SET lock_timeout='3s'; SET timezone='UTC'; SET search_path=pg_catalog");
  await c.query("BEGIN READ ONLY");
  const identity = (await c.query(identitySql)).rows[0];
  for (const key of identityKeys) assert.equal(identity[key], captured[key], `Target identity mismatch: ${key}`);
  assert.equal(identity.database, "heliumdb");
  assert.equal(new Date(identity.server_start).toISOString(), captured.server_start);
  report.identity = { database: identity.database, version: identity.version,
    userHostFingerprint: sha(JSON.stringify(identityKeys.slice(1).map(k => [k,identity[k]]))),
    capturedUserHostFingerprint: sha(JSON.stringify(identityKeys.slice(1).map(k => [k,captured[k]]))), serverStart: identity.server_start };
  report.preflight = [];
  for (const [table, column] of [["rollos","cantidad_actual"],["rollos","cantidad_inicial"],["existencias","cantidad_total"]]) {
    const row = (await c.query(`select count(*)::text total,count(*) filter(where ${column}<0)::text negative,count(*) filter(where ${column} is null)::text nulls,count(*) filter(where ${column}::text='NaN')::text nan,count(*) filter(where ${column}::text in ('Infinity','-Infinity'))::text infinity from public.${table}`)).rows[0];
    report.preflight.push({ table, column, ...row });
    for (const key of ["negative","nulls","nan","infinity"]) assert.equal(row[key], "0", "Invalid quantity; no repair permitted");
  }
  report.catalogBefore = (await c.query(catalogSql,[name])).rows;
  await c.query("COMMIT");
  report.before = await snapshot();
  save();
  // The tested file owns COMMIT. An outer BEGIN allocates its auditable txid;
  // its unchanged BEGIN emits only PostgreSQL's already-in-transaction notice.
  await c.query("BEGIN");
  report.ddlTransaction = (await c.query("select txid_current()::text txid,pg_backend_pid() backend_pid")).rows[0];
  const current = (await c.query(identitySql)).rows[0];
  assert.deepEqual(current, identity);
  const result = await c.query(ddl);
  assert.ok(Array.isArray(result) && result.at(-1).command === "COMMIT");
  report.commitConfirmed = true;
  report.committedAt = new Date().toISOString();
  save();
  report.catalogAfter = (await c.query(catalogSql,[name])).rows;
  assert.equal(report.catalogAfter.length, 1);
  assert.equal(report.catalogAfter[0].convalidated, true);
  assert.equal(report.catalogAfter[0].definition, read("reports/tanda-h/tarea-1/check-copy.json").catalog.definition);
  report.after = await snapshot();
  report.rowsUnchanged = JSON.stringify(report.before.tables) === JSON.stringify(report.after.tables);
  report.rowPreservation = report.rowsUnchanged ? "All table counts and native SQL full-row digests identical; no row-writing SQL issued. No quiescence or absence of transient concurrent changes claimed." : "Concurrent row changes observed across snapshots; exact row preservation cannot be claimed. Operator issued no row-writing SQL; no automatic repair.";
  report.status = report.rowsUnchanged ? "committed_verified" : "committed_concurrent_row_change";
} catch (e) {
  if (c) await c.query("ROLLBACK").catch(() => {});
  report.status = report.commitConfirmed ? "committed_verification_failed" : "aborted";
  // Never serialize errors with connection details or SQL row data.
  report.error = { code: e.code || "OPERATOR_GUARD", message: e instanceof assert.AssertionError ? e.message : "Operator failed; stop without repair. PostgreSQL code recorded, connection details withheld." };
  process.exitCode = 1;
} finally {
  if (c) await c.end().catch(() => {});
  report.finishedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify({ status: report.status, commitConfirmed: report.commitConfirmed, rowsUnchanged: report.rowsUnchanged, report: out }));
}