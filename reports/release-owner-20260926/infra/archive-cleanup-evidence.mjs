import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
const root = "/tmp/release-owner-20260926";
const out = "reports/release-owner-20260926/infra";
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const numbers = (row, keys) => Object.fromEntries(keys.filter(k => Number.isFinite(row[k])).map(k => [k, row[k]]));
const token = s => typeof s === "string" && /^[A-Za-z_][A-Za-z0-9_ ]{0,80}$/.test(s) ? s : null;
const digest = s => typeof s === "string" && /^[a-f0-9]{64}$/.test(s) ? s : null;
const error = e => e ? {
  code: typeof e.code === "string" && /^[A-Z0-9]{5}$/.test(e.code) ? e.code : null,
  name: token(e.name), category: token(e.category),
  messageSha256: digest(e.messageSha256), stackSha256: digest(e.stackSha256),
  cause: e.cause ? { messageSha256: digest(e.cause.messageSha256) } : null,
} : null;
const raw = fs.readFileSync(`${root}/release_login_20260926/sanitized-observer.ndjson`, "utf8");
const events = raw.trim().split("\n").map(JSON.parse).map(r => ({
  at: new Date(r.at).toISOString(),
  event: token(r.event),
  request: r.request ? {
    id: /^[a-f0-9-]{36}$/.test(r.request.id) ? r.request.id : null,
    method: token(r.request.method),
    // No raw route segments survive archival, including possible user identifiers.
    routeSha256: sha(String(r.request.route)),
  } : null,
  ...numbers(r, ["total", "idle", "waiting", "max", "durationMs", "nodePid", "backendPid", "status"]),
  verb: token(r.verb), shapeSha256: digest(r.shapeSha256), error: error(r.error),
  rows: r.rows?.map(a => ({
    ...numbers(a, ["pid", "transaction_age_seconds", "query_age_seconds"]),
    state: token(a.state), wait_event_type: token(a.wait_event_type), wait_event: token(a.wait_event),
    blockers: a.blockers?.filter(Number.isInteger),
    verb: token(a.verb), shapeSha256: digest(a.shapeSha256),
  })),
  locks: r.locks?.map(a => ({
    ...numbers(a, ["pid", "relation"]), locktype: token(a.locktype), mode: token(a.mode),
    granted: a.granted === true,
  })),
}));
const archive = events.map(r => JSON.stringify(r)).join("\n") + "\n";
fs.writeFileSync(`${out}/sanitized-observer-archive.ndjson`, archive);
const ports = await Promise.all([18227, 18228, 18237, 18238, 18239].map(port => new Promise(resolve => {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.setTimeout(1500);
  socket.once("connect", () => { socket.destroy(); resolve({ port, closed: false }); });
  socket.once("error", e => resolve({ port, closed: e.code === "ECONNREFUSED", result: e.code }));
  socket.once("timeout", () => { socket.destroy(); resolve({ port, closed: false, result: "TIMEOUT" }); });
})));
const evidence = {
  at: new Date().toISOString(), branch: "br-falling-king-axocxbt1", project: "withered-block-09991755",
  ports, archiveSha256: sha(archive), archiveEvents: events.length,
  eventCounts: events.reduce((a, r) => (a[r.event] = (a[r.event] || 0) + 1, a), {}),
  queryErrors: events.filter(r => r.event === "query_end" && r.error).length,
  httpErrors: events.filter(r => r.event === "http_end" && r.status >= 400).length,
  blockingSnapshots: events.filter(r => r.rows?.some(a => a.blockers?.length)).length,
  archivePolicy: "Strict field allowlist; routes hashed; no SQL, parameters, credentials, raw logs, names, or customer data.",
  appDatabaseAccess: "NONE",
};
fs.writeFileSync(`${out}/cleanup-archive-evidence.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
if (ports.some(p => !p.closed)) process.exitCode = 1;