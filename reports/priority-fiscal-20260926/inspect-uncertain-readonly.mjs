// MAIN-authorized isolated copy only. No writes, retries, resolution or replay.
import fs from "node:fs";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const target = new URL(JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/test-env.json")).TEST_DATABASE_URL);
if (target.pathname !== "/priority_fiscal_20260926") throw Error("Wrong diagnostic target");
target.hostname = target.hostname.replace("-pooler", "");
const intent = "b2548914-0933-4a8f-a67d-b925b0a8df68", actor = 237;
const c = new pg.Client({ connectionString: target.href, application_name: "fiscal-uncertain-readonly",
  options: "-c default_transaction_read_only=on", statement_timeout: 3000, connectionTimeoutMillis: 5000 });
const report = { at: new Date().toISOString(), actor, intent, mutation: false, replay: false };
try {
  await c.connect();
  await c.query("BEGIN READ ONLY");
  report.database = (await c.query("SELECT current_database() AS name")).rows[0].name;
  if (report.database !== "priority_fiscal_20260926") throw Error("Wrong effective diagnostic database");
  report.lock = (await c.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired",
    [`E11:${actor}:SNAPSHOT:${intent}`])).rows[0].acquired;
  if (report.lock) {
    report.operations = (await c.query(`SELECT actor_id,operacion,estado,respuesta->>'id' AS snapshot_id
      FROM e11_operaciones WHERE actor_id=$1 AND operacion='SNAPSHOT' AND uuid=$2::uuid`, [actor, intent])).rows;
    report.resolutions = (await c.query(`SELECT id,estado FROM e11_resoluciones
      WHERE actor_original_id=$1 AND accion='SNAPSHOT' AND uuid_original=$2::uuid`, [actor, intent])).rows;
    report.snapshots = (await c.query(`SELECT id,tipo,inicio::text,revision,
      datos->>'totalFacturado' AS total,datos->>'cantidadVentas' AS sales
      FROM e11_conciliaciones WHERE actor_id=$1 AND datos->>'uuid'=$2`, [actor, intent])).rows;
  }
  report.activity = (await c.query(`SELECT pid,state,wait_event_type,wait_event,
    pg_blocking_pids(pid) AS blockers,
    extract(epoch FROM clock_timestamp()-xact_start)::float8 AS transaction_age_seconds,
    extract(epoch FROM clock_timestamp()-query_start)::float8 AS query_age_seconds
    FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`)).rows;
  await c.query("ROLLBACK");
  report.status = report.lock ? "LOCKED_READ_ONLY_INSPECTION_COMPLETE" : "INTENTION_BUSY_NO_CONCLUSION";
} catch (error) {
  report.status = "READ_ONLY_DIAGNOSTIC_FAILED";
  report.errorClass = error?.name ?? "Unknown";
  report.sqlstate = error?.code ?? null;
  try { await c.query("ROLLBACK"); } catch {}
} finally { await c.end(); }
fs.writeFileSync("reports/priority-fiscal-20260926/uncertain-readonly.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));