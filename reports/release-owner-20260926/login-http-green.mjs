// Authorized HTTP logins in the disposable copy; database verification is READ ONLY.
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const dir = "/tmp/release-owner-20260926/release_login_20260926";
const creds = JSON.parse(fs.readFileSync(`${dir}/credentials.json`));
const url = new URL(JSON.parse(fs.readFileSync(`${dir}/test-env.json`)).TEST_DATABASE_URL);
assert.equal(url.pathname, "/release_login_20260926");
const api = "http://127.0.0.1:18227";
const db = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
const ids = [234, 237, 238];
const sessions = [];
const results = [];
await db.connect();
const snapshot = async () => {
  await db.query("BEGIN READ ONLY");
  try {
    return (await db.query(`SELECT
      (SELECT count(*)::int FROM sesiones WHERE usuario_id=ANY($1::int[])) sessions,
      (SELECT count(*)::int FROM auditoria WHERE usuario_id=ANY($1::int[]) AND accion='LOGIN_EXITOSO') audits`, [ids])).rows[0];
  } finally { await db.query("ROLLBACK"); }
};
try {
  await db.query("BEGIN READ ONLY");
  assert.equal((await db.query("SELECT current_database() db")).rows[0].db, "release_login_20260926");
  await db.query("ROLLBACK");
  const healthBefore = (await fetch(`${api}/api/healthz`)).status;
  assert.equal(healthBefore, 200);
  const before = await snapshot();
  for (const [scenario, rounds, actors] of [
    ["same-actor", 4, [creds.admin, creds.admin, creds.admin]],
    ["distinct-actors", 3, ids.map(id => creds.actors.find(a => a.id === id))],
  ]) {
    for (let round = 0; round < rounds; round++) {
      const batchStart = performance.now();
      const batch = await Promise.all(actors.map(async actor => {
        const start = performance.now();
        // Exactly one fetch per attempt; no retry loop, no automatic POST redirects.
        const response = await fetch(`${api}/api/auth/login`, {
          method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario: actor.usuario, password: actor.password }),
        });
        await response.text(); // Never persist credentials, session cookie, or user response.
        const durationMs = performance.now() - start;
        const cookie = response.headers.get("set-cookie") ?? "";
        const sessionId = /(?:^|;\s*)mariana_session=([^;]+)/.exec(cookie)?.[1];
        if (sessionId) sessions.push({ id: decodeURIComponent(sessionId), actorId: actor.id });
        return { actorId: actor.id, status: response.status, durationMs, sessionCookiePresent: !!sessionId };
      }));
      results.push({ scenario, round: round + 1, batchDurationMs: performance.now() - batchStart, requests: batch });
    }
  }
  const after = await snapshot();
  const healthAfter = (await fetch(`${api}/api/healthz`)).status;
  assert.equal(healthAfter, 200);
  assert.equal(results.flatMap(x => x.requests).length, 21);
  assert.ok(results.every(x => x.requests.every(r => r.status === 200 && r.sessionCookiePresent)));
  assert.equal(new Set(sessions.map(s => s.id)).size, 21);
  assert.equal(after.sessions - before.sessions, 21);
  assert.equal(after.audits - before.audits, 21);
  await db.query("BEGIN READ ONLY");
  let committed;
  try {
    committed = (await db.query(`SELECT s.id,s.usuario_id,
      count(a.id)::int audit_count,
      bool_and(a.usuario_id=s.usuario_id AND a.entidad='sesiones') matching_author
      FROM sesiones s LEFT JOIN auditoria a ON a.entidad_id=s.id::text AND a.accion='LOGIN_EXITOSO'
      WHERE s.id=ANY($1::uuid[]) GROUP BY s.id,s.usuario_id`, [sessions.map(s => s.id)])).rows;
  } finally { await db.query("ROLLBACK"); }
  assert.equal(committed.length, 21);
  for (const row of committed) {
    assert.equal(row.audit_count, 1);
    assert.equal(row.matching_author, true);
    assert.equal(row.usuario_id, sessions.find(s => s.id === row.id).actorId);
  }
  const candidate = JSON.parse(fs.readFileSync("reports/release-owner-20260926/login-v9/candidate.json"));
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(candidate.apiEntry)).digest("hex"), candidate.apiSha256);
  const durations = results.flatMap(x => x.requests.map(r => r.durationMs)).sort((a, b) => a - b);
  const report = {
    status: "PASS", database: "release_login_20260926", apiSha256: candidate.apiSha256,
    activation: "MAIN activated V9; worker did not start or restart any runtime",
    healthBefore, healthAfter, requests: 21, status200: 21, status500: 0,
    sessionsAdded: after.sessions - before.sessions, successfulAuditsAdded: after.audits - before.audits,
    uniqueResponseSessions: 21, exactlyOneMatchingAuditPerSession: true,
    httpRetries: 0, sourceTransactionRetries: 0,
    durationsMs: { min: durations[0], median: durations[10], max: durations[20] },
    databaseVerificationReadOnly: true, results,
  };
  fs.writeFileSync("reports/release-owner-20260926/login-http-green-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
} finally {
  await db.query("ROLLBACK");
  await db.end();
}