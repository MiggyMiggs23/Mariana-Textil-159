// MAIN-only apply modes. Default is read-only. Never print environment or URLs.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.resolve("lib/db/package.json"));
const { Client } = require("pg");
const [mode = "inspect", pidText, expectedFile] = process.argv.slice(2);
assert.ok(["inspect", "apply-task1", "apply-task2"].includes(mode));
assert.match(pidText ?? "", /^[0-9]+$/);
const entries = fs.readFileSync(`/proc/${pidText}/environ`, "utf8").split("\0");
const allowed = new Set(["DATABASE_URL", "TEST_DATABASE_URL", "NODE_ENV",
  "PGSSLMODE", "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY"]);
const env = Object.fromEntries(entries.filter(s => allowed.has(s.slice(0, s.indexOf("="))))
  .map(s => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]));
const argv = fs.readFileSync(`/proc/${pidText}/cmdline`, "utf8").split("\0");
const bundle = argv.find(s => /api-server\/dist[^/]*\/index\.mjs$/.test(s));
assert.ok(bundle, "Target PID is not the reviewed served API bundle");
assert.ok(env.DATABASE_URL && !env.TEST_DATABASE_URL && env.NODE_ENV !== "test", "Target must be actual application API, not a test actor");
for (const key of ["PGSSLMODE", "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY"]) {
  if (env[key]) process.env[key] = env[key]; else delete process.env[key];
}
const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000,
  statement_timeout: 15000, application_name: "night-main-readonly-preflight" });
try {
  await client.connect();
  await client.query(mode === "inspect" ? "BEGIN READ ONLY" : "BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'");
  const identity = (await client.query(`SELECT current_database() database,current_user db_user,
    inet_server_addr()::text address,inet_server_port() port,
    current_setting('data_directory') directory,pg_postmaster_start_time() started`)).rows[0];
  const graph = (await client.query(`SELECT
    md5(pg_get_functiondef('public.e5_graph_guard()'::regprocedure)) e5,
    md5(pg_get_functiondef('public.e11_graph()'::regprocedure)) e11`)).rows[0];
  const closures = (await client.query(`SELECT tgname,count(*)::int FROM pg_trigger
    WHERE tgname IN ('e5_closed','e11_closed') AND tgenabled='O' GROUP BY tgname ORDER BY tgname`)).rows;
  const accountants = (await client.query(`SELECT
    (SELECT count(*)::int FROM usuarios WHERE rol='CONTADOR') users,
    (SELECT count(*)::int FROM e11_perfiles) profiles`)).rows[0];
  const observation = { pid: Number(pidText), bundle, identity, graph, closures, accountants,
    provenance: "read-only connection using served API PID effective DATABASE_URL; URL never emitted" };
  if (mode === "inspect") {
    await client.query("ROLLBACK");
    fs.writeFileSync("reports/trabajo-nocturno-20260925/tarea-1/effective-api-pool.json", JSON.stringify(observation, null, 2));
    console.log(JSON.stringify(observation));
  } else {
    assert.ok(expectedFile, "Explicit expected identity file required");
    const expected = JSON.parse(fs.readFileSync(expectedFile, "utf8"));
    assert.deepEqual(JSON.parse(JSON.stringify(identity)), expected.identity);
    assert.equal(Number(pidText), expected.pid, "Reinspect after process replacement");
    assert.equal(bundle, expected.bundle);
    assert.equal(accountants.users, expected.accountants.users);
    assert.equal(accountants.profiles, expected.accountants.profiles);
    const files = mode === "apply-task1"
      ? ["reports/trabajo-nocturno-20260925/tarea-1/01-candidate-not-approved.sql"]
      : ["reports/trabajo-nocturno-20260925/tarea-2/00-graph-correction-candidate.sql",
        "reports/trabajo-nocturno-20260925/tarea-2/00b-fiscal-folio-correction-candidate.sql",
        "reports/trabajo-nocturno-20260925/tarea-2/01-candidate-not-approved.sql"];
    for (const file of files) {
      const sql = fs.readFileSync(file, "utf8").replace(/^\\set ON_ERROR_STOP on\r?\n/gm, "")
        .replace(/^BEGIN;\r?$/gm, "").replace(/^COMMIT;\r?$/gm, "");
      assert.ok(!/\b(?:INSERT\s+INTO|UPDATE\s+usuarios|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i.test(sql),
        "Unexpected data writer in closure-only operator candidate");
      await client.query(sql);
    }
    const forbidden = (await client.query(`SELECT count(*)::int n FROM pg_trigger
      WHERE tgname='e5_closed' AND tgenabled='O'
        AND tgrelid IN ('e5_devoluciones'::regclass,'e5_salidas_bancarias'::regclass)`)).rows[0].n;
    assert.equal(forbidden, 2, "Refund and bank output closures must remain active");
    await client.query("COMMIT");
    fs.writeFileSync(`reports/trabajo-nocturno-20260925/tarea-1/${mode}-operator-result.json`,
      JSON.stringify({ ...observation, status: "COMMITTED", files, forbiddenClosures: forbidden }, null, 2));
    console.log(`${mode}: committed only reviewed graph/closure DDL; forbidden closures preserved`);
  }
} catch (error) {
  try { await client.query("ROLLBACK"); } catch { /* Connection failures stop; never retry. */ }
  // Do not dump pg connection options, query parameters or credentials.
  console.error(`STOP: ${error.code ?? error.name}: ${error.message}`);
  process.exitCode = 1;
} finally { await client.end(); }