// Diagnostic hooks only. Never log SQL text/values, connection strings or protected DTOs.
import fs from "node:fs";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const file = "/tmp/priority-fiscal-20260926/sanitized-pool-observer.ndjson";
const sha = value => crypto.createHash("sha256").update(String(value)).digest("hex");
let seq = 0;
function emit(value) {
  try { fs.appendFileSync(file, JSON.stringify({ atReal: new Date(performance.timeOrigin + performance.now()).toISOString(),
    monotonicMs: performance.now(), ...value }) + "\n", { mode: 0o600 }); } catch {}
}
function failure(error) {
  const causes = [], seen = new Set();
  for (let e = error; e && typeof e === "object" && !seen.has(e) && causes.length < 6; e = e.cause) {
    seen.add(e);
    causes.push({ name: e.name ?? null, code: e.code ?? null,
      messageSha256: typeof e.message === "string" ? sha(e.message) : null,
      category: e.message === "timeout exceeded when trying to connect" ? "POOL_ACQUIRE_TIMEOUT"
        : e.message === "Query read timeout" ? "QUERY_READ_TIMEOUT" : null });
  }
  return causes;
}
globalThis.__fiscalE11Observe = (phase, command, error, workCompleted) => {
  emit({ event: "e11_phase", phase, actor: command.userId, readOnly: command.readOnly === true,
    intentSha256: command.mutationUuid ? sha(command.mutationUuid) : null,
    workCompleted, causes: failure(error) });
};
globalThis.__fiscalObservePool = pool => {
  const target = new URL(pool.options.connectionString);
  if (target.pathname !== "/priority_fiscal_20260926") throw Error("Fiscal observer target rejected");
  const counts = () => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount,
    max: pool.options.max });
  emit({ event: "pool_config", connectionTimeoutMillis: pool.options.connectionTimeoutMillis,
    statementTimeoutMillis: pool.options.statement_timeout, queryTimeoutMillis: pool.options.query_timeout, ...counts() });
  const loans = new Map(), ids = new WeakMap(); let nextClient = 0;
  const clientId = c => { if (!ids.has(c)) ids.set(c, ++nextClient); return ids.get(c); };
  const connect = pool.connect;
  pool.connect = function(callback) {
    const acquireId = ++seq, start = performance.now();
    emit({ event: "acquire_start", acquireId, ...counts() });
    const done = (error, client) => emit({ event: "acquire_end", acquireId,
      durationMs: performance.now() - start, clientId: client ? clientId(client) : null,
      pid: client?.processID ?? null, causes: failure(error), ...counts() });
    if (typeof callback === "function") return connect.call(this, (error, client, release) => {
      done(error, client); callback(error, client, release);
    });
    return connect.call(this).then(client => { done(null, client); return client; },
      error => { done(error); throw error; });
  };
  pool.on("acquire", client => {
    loans.set(clientId(client), { since: performance.now(), pid: client.processID });
    emit({ event: "loan_start", clientId: clientId(client), pid: client.processID, ...counts() });
  });
  pool.on("release", (error, client) => {
    const loan = loans.get(clientId(client));
    emit({ event: "loan_end", clientId: clientId(client), pid: client.processID,
      durationMs: loan ? performance.now() - loan.since : null, causes: failure(error), ...counts() });
    loans.delete(clientId(client));
  });
  pool.on("remove", client => emit({ event: "pool_remove", clientId: clientId(client), pid: client.processID, ...counts() }));
  pool.on("connect", client => {
    const query = client.query;
    client.on("end", () => emit({ event: "client_end", clientId: clientId(client), pid: client.processID }));
    client.on("error", error => emit({ event: "client_error", clientId: clientId(client), pid: client.processID, causes: failure(error) }));
    client.query = function(...args) {
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
      const normalized = text.replace(/'(?:''|[^'])*'/g, "?").replace(/\b\d+\b/g, "?").replace(/\s+/g, " ").trim();
      const start = performance.now(), queryId = ++seq;
      const detail = { clientId: clientId(client), pid: client.processID, queryId,
        verb: normalized.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "UNKNOWN", shapeSha256: sha(normalized) };
      emit({ event: "query_start", ...detail });
      const done = error => emit({ event: "query_end", ...detail, durationMs: performance.now() - start,
        causes: failure(error), ...counts() });
      const last = args.length - 1;
      if (typeof args[last] === "function") {
        const callback = args[last]; args[last] = (error, result) => { done(error); callback(error, result); };
        return query.apply(this, args);
      }
      try {
        const result = query.apply(this, args);
        return result?.then ? result.then(value => { done(null); return value; }, error => { done(error); throw error; }) : result;
      } catch (error) { done(error); throw error; }
    };
  });
  // Direct observer avoids consuming the application's pool or PgBouncer queue.
  target.hostname = target.hostname.replace("-pooler", "");
  const observer = new pg.Pool({ connectionString: target.href, max: 1, application_name: "fiscal-readonly-observer",
    options: "-c default_transaction_read_only=on", statement_timeout: 2000, connectionTimeoutMillis: 3000 });
  let busy = false;
  setInterval(async () => {
    emit({ event: "occupancy", ...counts(), loans: [...loans].map(([id, loan]) => ({
      clientId: id, pid: loan.pid, ageMs: performance.now() - loan.since,
    })) });
    if (busy) return;
    busy = true;
    try {
      const rows = (await observer.query(`SELECT pid,state,wait_event_type,wait_event,
        pg_blocking_pids(pid) AS blockers,
        extract(epoch FROM clock_timestamp()-xact_start)::float8 AS transaction_age_seconds,
        extract(epoch FROM clock_timestamp()-query_start)::float8 AS query_age_seconds
        FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`)).rows;
      emit({ event: "pg_activity", rows });
    } catch (error) { emit({ event: "observer_error", causes: failure(error) }); }
    finally { busy = false; }
  }, 1000).unref();
};