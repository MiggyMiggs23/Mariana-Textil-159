// Explicit, one-shot operator. Not imported by application startup.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";

const dir = "reports/tanda-h/continuacion/application";
const apply = process.argv[2] === "--apply-authorized-indexes";
assert.ok(apply || process.argv[2] === "--preflight");
const out = `${dir}/${apply ? "application-result" : "preflight"}.json`;
assert.ok(!fs.existsSync(out), "Report already exists; do not overwrite terminal evidence");
const sha = value => createHash("sha256").update(value).digest("hex");
const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const sqlPath = "reports/tanda-h/tarea-2/approved-indexes.sql";
const expectedHash = "e5bc527636c4e31b7028fd55bb3aa5c9018df08e1eae03b3e4a8378aab5d35e0";
const names = ["tickets_pendientes_corte_ga_candidate", "tickets_contabilizados_sitio_fecha_ga_candidate"];
const identitySql = "select current_database() database,current_user db_user,inet_server_addr() server_address,inet_server_port() server_port,current_setting('server_version_num') version,pg_postmaster_start_time()::text server_start";
const identityKeys = ["database", "db_user", "server_address", "server_port", "version"];
const catalogSql = `SELECT n.nspname AS schema,t.relname AS relation,i.relname AS index,
 x.indisvalid,x.indisready,x.indisunique,x.indnkeyatts,pg_get_indexdef(i.oid) AS definition,
 pg_get_expr(x.indpred,x.indrelid) AS predicate,
 ARRAY(SELECT pg_get_indexdef(i.oid,k,true) FROM generate_series(1,x.indnkeyatts) k) AS keys
 FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
 JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public' AND t.relname='tickets' ORDER BY i.relname`;
const checkSql = "select conname,convalidated,pg_get_constraintdef(oid,false) definition from pg_constraint where conrelid='public.rollos'::regclass and conname='rollos_physical_quantity_nonnegative_check'";
const report = {
  startedAt: new Date().toISOString(), status: "preflight", sqlSha256: expectedHash,
  authorization: "User resumed PAUSA and explicitly authorized application of only the two previously approved indexes; MAIN delegated actual execution after proof gates.",
  mode: apply ? "authorized_application" : "readonly_preflight",
  rowWriteStatements: 0, appAuthRequests: 0, operationalTests: 0, quiescenceClaim: false,
  rollbackPolicy: "Additive indexes only; prior source dump destroyed at pause. Preserve catalog and exact DROP INDEX CONCURRENTLY proposal, never execute rollback or restore data.",
  actions: [],
};
let c;
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
function runtime() {
  const candidates = fs.readdirSync("/proc").filter(x => /^\d+$/.test(x)).filter(pid => {
    try { return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").some(x => /^(?:.*\/)?artifacts\/api-server\/dist[^/]*\/index\.mjs$/.test(x)); } catch { return false; }
  });
  assert.equal(candidates.length, 1, "Expected exactly one effective API");
  const pid = Number(candidates[0]);
  const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
  const entry = cmd.find(x => x.endsWith("artifacts/api-server/dist-tanda-g-strict-candidate/index.mjs"));
  assert.ok(entry, "API entry changed; coordinate with MAIN");
  const vars = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(x => x.includes("=")).map(x => [x.slice(0,x.indexOf("=")),x.slice(x.indexOf("=")+1)]));
  const uri = vars.TEST_DATABASE_URL || vars.DATABASE_URL;
  assert.ok(uri, "Runtime connection missing");
  return { pid, entry, uri };
}
async function snapshot() {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const meta = (await c.query("select txid_current_snapshot()::text snapshot")).rows[0];
    const tables = (await c.query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast' order by 1,2")).rows;
    const results = [];
    for (const t of tables) {
      assert.match(t.schema, /^[a-z_][a-z0-9_]*$/); assert.match(t.name, /^[a-z_][a-z0-9_]*$/);
      const row = (await c.query(`select count(*)::text count,md5(coalesce(string_agg(serialized,E'\\n' order by serialized collate "C"),'')) digest from (select row_to_json(r)::text serialized from "${t.schema}"."${t.name}" r) s`)).rows[0];
      results.push({ ...t, ...row });
    }
    await c.query("COMMIT");
    return { ...meta, serialization: "Native SQL row_to_json(full row), UTC, COLLATE C sorted, newline separator, MD5 plus counts; no exclusions", tables: results, manifestSha256: sha(JSON.stringify(results)) };
  } catch (e) { await c.query("ROLLBACK"); throw e; }
}
async function verifyCheck() {
  const rows = (await c.query(checkSql)).rows;
  const prior = read("reports/tanda-h/application/physical-check-result.json").catalogAfter[0];
  assert.equal(rows.length, 1, "Previously applied CHECK missing");
  assert.equal(rows[0].convalidated, true);
  assert.equal(rows[0].definition, prior.definition);
  return rows;
}
try {
  const ddl = fs.readFileSync(sqlPath, "utf8");
  assert.equal(sha(ddl), expectedHash, "Exact approved SQL hash mismatch");
  const statements = ddl.replace(/^--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean);
  const copy = read("reports/tanda-h/tarea-2/copy-ddl.json");
  assert.equal(statements.length, 2);
  assert.deepEqual(statements, copy.results.map(r => r.sql), "Copy-tested statements differ");
  const pre = read("reports/tanda-h/tarea-2/pre.json"), post = read("reports/tanda-h/tarea-2/post.json");
  assert.deepEqual(Object.keys(pre.dataset).sort(), Object.keys(post.dataset).sort());
  const changed = Object.keys(pre.dataset).filter(t => JSON.stringify(pre.dataset[t]) !== JSON.stringify(post.dataset[t]));
  assert.deepEqual(changed, ["sesiones"]);
  assert.equal(pre.queries.length, post.queries.length);
  assert.ok(pre.queries.every(q => post.queries.some(p => p.text === q.text && JSON.stringify(p.values) === JSON.stringify(q.values) && p.resultDigest === q.resultDigest)));
  assert.equal(pre.results.length, post.results.length);
  assert.ok(pre.results.every((r,i) => r.semanticDigest === post.results[i].semanticDigest));
  report.qualifiedCopyEvidence = {
    fullDatasetEqual: false, changedTables: changed, businessDatasetEqual: true,
    orderedQueryResultsEqual: true, querySamples: pre.queries.length,
    orderedOperationResultsEqual: true, operationSamples: pre.results.length,
    qualification: "Only authentication storage public.sesiones differs from authenticated measurements; public.sesiones_caja and every other business table remain identical. Query SQL, bound values and ordered result digests match. Operation semantic digests match with generatedAt metadata alone excluded by the prior harness. This is qualified semantic evidence, not full-dataset equality or a latency SLA.",
    files: Object.fromEntries(["pre.json","post.json","paired-proof.json","business-paired-proof.json","copy-ddl.json"].map(f => [f, sha(fs.readFileSync(`reports/tanda-h/tarea-2/${f}`))])),
  };
  const rt = runtime();
  report.runtime = { pid: rt.pid, entry: rt.entry, connectionSource: "effective API process environment, memory only; never logged or persisted" };
  c = new pg.Client({ connectionString: rt.uri, connectionTimeoutMillis: 8000, application_name: "tanda_h_authorized_two_indexes" });
  await c.connect();
  await c.query("SET statement_timeout='60s'; SET lock_timeout='3s'; SET timezone='UTC'; SET search_path=public,pg_catalog");
  if (!apply) await c.query("SET default_transaction_read_only=on");
  const identity = (await c.query(identitySql)).rows[0];
  const captured = read("reports/tanda-h/setup/quantity-preflight.json").identity;
  for (const k of identityKeys) assert.equal(identity[k], captured[k], `Prior target identity mismatch: ${k}`);
  assert.equal(identity.database, "heliumdb");
  report.identity = { database: identity.database, version: identity.version, priorIdentityMatched: true,
    fingerprint: sha(JSON.stringify(identityKeys.map(k => [k,identity[k]]))), serverStart: identity.server_start,
    priorServerStart: captured.server_start, serverStartIsRuntimeMetadata: true };
  report.checkBefore = await verifyCheck();
  report.catalogBefore = (await c.query(catalogSql)).rows;
  // Reject unreviewed index drift, not just same-name drift. This matches the copy's reviewed
  // key order AND predicates and preserves every unrelated index unchanged.
  assert.deepEqual(report.catalogBefore.filter(i => !names.includes(i.index)), pre.indexes);
  report.prefixReview = "All existing noncandidate index definitions, ordered keys, predicates, uniqueness and valid/ready flags equal reviewed copy baseline. Existing (ubicacion_id,created_at) is nonpartial, lacks id and cut predicate; (created_at,ubicacion_id) WHERE cobrado=true has different order/predicate. No accounted-date CASE expression prefix exists. No existing definitions replaced.";
  for (const name of names) {
    const objects = (await c.query("select c.relkind,pg_get_indexdef(c.oid) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=$1", [name])).rows;
    if (objects.length) {
      assert.equal(objects[0].relkind, "i", "Same-name object is not an index");
      assert.equal(objects[0].definition, copy.indexes.find(i => i.indexname === name).indexdef, "Same-name definition drift");
      const existing = report.catalogBefore.find(i => i.index === name);
      assert.ok(existing?.indisvalid && existing?.indisready, "Same-name invalid/not-ready index; do not repair");
    }
  }
  report.before = await snapshot();
  save();
  if (apply) {
    for (let i = 0; i < names.length; i++) {
      const fresh = runtime();
      assert.equal(fresh.pid, rt.pid, "API process changed");
      assert.equal(fresh.uri, rt.uri, "API database connection changed");
      assert.deepEqual((await c.query(identitySql)).rows[0], identity);
      assert.equal(sha(fs.readFileSync(sqlPath)), expectedHash);
      // Fresh presence/definition/validity check immediately before each statement.
      const objects = (await c.query("select c.relkind,pg_get_indexdef(c.oid) definition,x.indisvalid,x.indisready from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_index x on x.indexrelid=c.oid where n.nspname='public' and c.relname=$1", [names[i]])).rows;
      if (objects.length) {
        assert.equal(objects[0].relkind, "i");
        assert.equal(objects[0].definition, copy.indexes.find(x => x.indexname === names[i]).indexdef, "Fresh same-name drift");
        assert.ok(objects[0].indisvalid && objects[0].indisready);
        report.actions.push({ name: names[i], status: "skipped_exact_valid_ready" });
      } else {
        report.inFlight = names[i]; save();
        const start = performance.now();
        const result = await c.query(statements[i]);
        assert.equal(result.command, "CREATE");
        report.actions.push({ name: names[i], status: "created_concurrently", elapsedMs: performance.now() - start, sql: statements[i] });
        delete report.inFlight; save();
      }
    }
    report.catalogAfter = (await c.query(catalogSql)).rows;
    assert.deepEqual(report.catalogAfter.filter(i => !names.includes(i.index)), report.catalogBefore.filter(i => !names.includes(i.index)));
    for (const name of names) {
      const index = report.catalogAfter.find(i => i.index === name);
      assert.ok(index?.indisvalid && index?.indisready);
      assert.equal(index.definition, copy.indexes.find(i => i.indexname === name).indexdef);
    }
    report.checkAfter = await verifyCheck();
    report.after = await snapshot();
    report.rowsUnchanged = JSON.stringify(report.before.tables) === JSON.stringify(report.after.tables);
    report.status = report.rowsUnchanged ? "applied_verified" : "applied_concurrent_row_change";
    report.rowPreservation = "No row-writing SQL, login, operational request or startup issued. Snapshot equality is reported without claiming quiescence or excluding transient concurrent changes.";
  } else report.status = "preflight_pass";
} catch (e) {
  report.status = report.actions.length || report.inFlight ? "application_incomplete_inspect_catalog" : "aborted_before_ddl";
  report.error = { code: e.code || "OPERATOR_GUARD", message: e instanceof assert.AssertionError ? e.message.split("\n")[0] : "Operator failed; connection details withheld; no repair or rollback executed." };
  process.exitCode = 1;
} finally {
  if (c) {
    if (report.status === "application_incomplete_inspect_catalog") {
      report.terminalCatalog = await c.query(catalogSql).then(r => r.rows).catch(() => null);
      report.terminalCheck = await c.query(checkSql).then(r => r.rows).catch(() => null);
    }
    await c.end().catch(() => {});
  }
  report.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: report.status, rowsUnchanged: report.rowsUnchanged, actions: report.actions.map(a => ({name:a.name,status:a.status})), error: report.error, report: out }));
}