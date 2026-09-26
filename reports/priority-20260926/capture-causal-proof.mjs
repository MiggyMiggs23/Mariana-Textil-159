import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";

const dir = "/tmp/priority-20260926";
const shape = sql => {
  const normalized = sql.replace(/'(?:''|[^'])*'/g, "?").replace(/\b\d+\b/g, "?").replace(/\s+/g, " ").trim();
  return { verb: normalized.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "UNKNOWN",
    shapeSha256: crypto.createHash("sha256").update(normalized).digest("hex") };
};
const conn = JSON.parse(fs.readFileSync(`${dir}/test-env.json`)).TEST_DATABASE_URL;
if (new URL(conn).pathname !== "/priority_20260926") throw Error("Wrong database");
const c = new pg.Client({ connectionString: conn, application_name: "priority-causal-readonly",
  options: "-c default_transaction_read_only=on", statement_timeout: 3000 });
await c.connect();
const snapshots = [];
for (let i = 0; i < 60; i++) {
  const result = await c.query(`SELECT pid,state,wait_event_type,wait_event,
    pg_blocking_pids(pid) blockers,
    extract(epoch from (clock_timestamp()-xact_start))::float8 transaction_age_seconds,
    extract(epoch from (clock_timestamp()-query_start))::float8 query_age_seconds,query
    FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`);
  snapshots.push({ at: new Date().toISOString(), rows: result.rows.map(({ query, ...safe }) => ({ ...safe, ...shape(query) })) });
  await new Promise(resolve => setTimeout(resolve, 200));
}
await c.end();
const allowed = new Set(["at", "event", "total", "idle", "waiting", "max", "durationMs", "code", "failed", "pid", "verb", "shapeSha256", "rows"]);
const rowAllowed = new Set(["pid","state","wait_event_type","wait_event","blockers","transaction_age_seconds","query_age_seconds"]);
const start = "2026-09-26T04:57:40.000Z", end = "2026-09-26T05:00:15.999Z";
const records = fs.readFileSync(`${dir}/pool-diagnostics.ndjson`, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line))
  .filter(r => r.at >= start && r.at <= end);
for (const r of records) {
  if (Object.keys(r).some(k => !allowed.has(k))) throw Error("Unexpected diagnostic field; not archiving");
  if (r.rows?.some(row => Object.keys(row).some(k => !rowAllowed.has(k)))) throw Error("Unexpected activity field; not archiving");
  if (r.shapeSha256 && !/^[a-f0-9]{64}$/.test(r.shapeSha256)) throw Error("Invalid fingerprint");
}
fs.writeFileSync(new URL("./causal-diagnostics-sanitized.ndjson", import.meta.url), records.map(r => JSON.stringify(r)).join("\n") + "\n");
const shapes = {};
for (const r of records.filter(r => r.event === "query_end")) {
  const s = shapes[r.shapeSha256] ||= { count: 0, failed: 0, maxMs: 0, codes: {}, virtualClientPids: [] };
  s.count++; s.failed += Number(r.failed); s.maxMs = Math.max(s.maxMs, r.durationMs);
  if (r.code) s.codes[r.code] = (s.codes[r.code] || 0) + 1;
  if (!s.virtualClientPids.includes(r.pid)) s.virtualClientPids.push(r.pid);
}
const blocked = records.filter(r => r.event === "pg_activity").flatMap(r =>
  r.rows.filter(row => row.blockers.length).map(row => ({ at: r.at, ...row })));
const blockerHistory = records.filter(r => r.event === "pg_activity").flatMap(r =>
  r.rows.filter(row => row.pid === 1447).map(row => ({ at: r.at, ...row })));
const occupancy = records.filter(r => r.event === "occupancy");
const live1447 = snapshots.flatMap(r => r.rows.filter(row => row.pid === 1447).map(row => ({ at: r.at, ...row })));
const proof = {
  capturedAt: new Date().toISOString(), readOnly: true, database: "priority_20260926",
  archivedWindow: { start, end, records: records.length, fieldWhitelistValidated: true },
  interpretation: {
    pidWarning: "Observer query_end PID is node client/pooler virtual identity; NOT assumed equal to PostgreSQL backend PID.",
    directBackendMapping: live1447.length ? "Fresh pg_stat_activity query hashed in memory using observer normalization; raw SQL never saved/output." : "Backend1447 absent in fresh sample; historical observer lacked query hash so cannot retrospectively assert its query-shape identity.",
    causalityLimit: "Historical blocker edges prove lock blocking. Pool/query timing and live fingerprints must be correlated, not mistaken for exact historical SQL evidence."
  },
  queryShapes: shapes,
  occupancy: { samples: occupancy.length, maxWaiting: Math.max(0, ...occupancy.map(r => r.waiting)),
    maxIdle: Math.max(0, ...occupancy.map(r => r.idle)), minIdle: occupancy.length ? Math.min(...occupancy.map(r => r.idle)) : null },
  historicalBlockedEdges: blocked, historicalBackend1447: blockerHistory,
  liveBackend1447: live1447, liveSnapshots: snapshots,
  finalRemainingTransactions: snapshots.at(-1).rows.filter(r => r.transaction_age_seconds !== null),
  finalBlockedBackends: snapshots.at(-1).rows.filter(r => r.blockers.length),
};
fs.writeFileSync(new URL("./causal-proof.json", import.meta.url), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ archivedRecords: records.length, blockedEdges: blocked.length,
  historical1447Samples: blockerHistory.length, live1447Samples: live1447.length,
  live1447Shapes: [...new Set(live1447.map(r => r.shapeSha256))],
  occupancy: proof.occupancy, finalRemainingTransactions: proof.finalRemainingTransactions,
  finalBlockedBackends: proof.finalBlockedBackends }));