import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";

// Explicit sanitized diagnostics, NOT application console/workflow logs.
const out = "/tmp/priority-20260926/pool-diagnostics.ndjson";
const emit = value => fs.appendFileSync(out, JSON.stringify({ at: new Date().toISOString(), ...value }) + "\n", { mode: 0o600 });
const shape = input => {
  const sql = typeof input === "string" ? input : input?.text || "";
  // Fingerprint only, never SQL literals, parameters, identifiers or error messages.
  const normalized = sql.replace(/'(?:''|[^'])*'/g, "?").replace(/\b\d+\b/g, "?").replace(/\s+/g, " ").trim();
  return { verb: normalized.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "UNKNOWN",
    shapeSha256: crypto.createHash("sha256").update(normalized).digest("hex") };
};
globalThis.__priorityObservePool = pool => {
  const counts = () => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max });
  const connect = pool.connect;
  pool.connect = function(callback) {
    const start = performance.now();
    emit({ event: "acquire_start", ...counts() });
    const done = (error, client) => emit({ event: "acquire_end", durationMs: performance.now() - start,
      code: error?.code || null, failed: !!error, pid: client?.processID || null, ...counts() });
    if (typeof callback === "function") return connect.call(this, (error, client, release) => {
      done(error, client); callback(error, client, release);
    });
    return connect.call(this).then(client => { done(null, client); return client; },
      error => { done(error); throw error; });
  };
  pool.on("connect", client => {
    const query = client.query;
    client.query = function(...args) {
      const start = performance.now(), sqlShape = shape(args[0]);
      const done = error => emit({ event: "query_end", pid: client.processID, ...sqlShape,
        durationMs: performance.now() - start, code: error?.code || null, failed: !!error, ...counts() });
      const last = args.length - 1;
      if (typeof args[last] === "function") {
        const cb = args[last]; args[last] = (error, result) => { done(error); cb(error, result); };
        return query.apply(this, args);
      }
      try {
        const result = query.apply(this, args);
        if (result?.then) return result.then(value => { done(null); return value; }, error => { done(error); throw error; });
        return result;
      } catch (error) { done(error); throw error; }
    };
  });
  const observer = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1,
    application_name: "priority-readonly-observer", options: "-c default_transaction_read_only=on",
    statement_timeout: 2000, connectionTimeoutMillis: 2000 });
  let busy = false;
  setInterval(async () => {
    emit({ event: "occupancy", ...counts() });
    if (busy) return;
    busy = true;
    try {
      const rows = (await observer.query(`SELECT pid,state,wait_event_type,wait_event,
        pg_blocking_pids(pid) blockers,
        extract(epoch from (clock_timestamp()-xact_start))::float8 transaction_age_seconds,
        extract(epoch from (clock_timestamp()-query_start))::float8 query_age_seconds
        FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`)).rows;
      emit({ event: "pg_activity", rows });
    } catch (error) { emit({ event: "observer_error", code: error.code || null }); }
    finally { busy = false; }
  }, 1000).unref();
};