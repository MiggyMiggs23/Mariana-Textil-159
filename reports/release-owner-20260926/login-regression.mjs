// Executes the exact login transaction callback from frozen/current route sources.
// Only a guarded disposable database and schema owned by this test are writable.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(path.resolve("artifacts/api-server/package.json"));
const pg = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { sql, eq } = require("drizzle-orm");
const { pgTable, integer, text, timestamp, uuid, serial } = require("drizzle-orm/pg-core");
const env = JSON.parse(fs.readFileSync("/tmp/release-owner-20260926/release_login_20260926/test-env.json"));
const url = new URL(env.TEST_DATABASE_URL);
assert.equal(url.pathname, "/release_login_20260926");
url.hostname = url.hostname.replace("-pooler", "");
const schema = `login_test_${crypto.randomBytes(6).toString("hex")}`;
const pool = new pg.Pool({ connectionString: url.href, max: 5,
  options: `-c search_path=${schema},public -c statement_timeout=10000` });
const admin = new pg.Client({ connectionString: url.href });
const users = pgTable("usuarios", { id: integer("id"), ultimoAcceso: timestamp("ultimo_acceso", { withTimezone: true }) });
const sessions = pgTable("sesiones", { id: uuid("id"), usuarioId: integer("usuario_id"),
  expiraAt: timestamp("expira_at", { withTimezone: true }), ip: text("ip"), userAgent: text("user_agent") });
// JSON needs the real JSONB serializer, as the route passes an object.
const { jsonb } = require("drizzle-orm/pg-core");
const auditJson = pgTable("auditoria", { id: serial("id"), usuarioId: integer("usuario_id"),
  accion: text("accion"), entidad: text("entidad"), entidadId: text("entidad_id"),
  datosDespues: jsonb("datos_despues"), ip: text("ip") });
const parentDir = path.resolve("artifacts/api-server/dist-priority-stability-combined-v8-20260926");
const map = JSON.parse(fs.readFileSync(path.join(parentDir, "index.mjs.map")));
const routePath = path.resolve("artifacts/api-server/src/routes/auth.ts");
const baseline = map.sourcesContent[map.sources.findIndex(s => path.resolve(parentDir, s) === routePath)];
const candidate = fs.readFileSync(routePath, "utf8");
const compile = source => {
  const body = source.match(/await db\.transaction\(async \(tx\) => \{[\s\S]*?\n  \}\);/)[0];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return { body, call: new AsyncFunction("db", "sql", "eq", "sesionesTable", "usuariosTable", "auditoriaTable",
    "sessionId", "row", "expiraAt", "now", "ip", "req", "username", body) };
};
const old = compile(baseline), fixed = compile(candidate);
assert.equal(fixed.body.replace(/    \/\/ e5_serialize[\s\S]*?await tx\.execute\(sql`SELECT pg_advisory_xact_lock\(650005,5\)`\);\n/, ""), old.body);
const db = drizzle(pool);
const invoke = (version, userId = 1, ip = "test") => {
  const id = crypto.randomUUID(), now = new Date();
  return version.call(db, sql, eq, sessions, users, auditJson, id, { user: { id: userId } },
    new Date(now.getTime() + 60000), now, ip, { get: () => "regression" }, `fixture-${userId}`).then(() => id);
};
const code = e => e?.code ?? e?.cause?.code;
const results = [];
await admin.connect();
try {
  assert.equal((await admin.query("SELECT current_database() AS db")).rows[0].db, "release_login_20260926");
  const trigger = (await admin.query("SELECT pg_get_functiondef('public.e5_serialize()'::regprocedure) AS definition")).rows[0].definition;
  assert.match(trigger, /pg_try_advisory_xact_lock\(650005,5\)/);
  await admin.query(`CREATE SCHEMA ${schema};
    CREATE TABLE ${schema}.usuarios(id integer PRIMARY KEY,ultimo_acceso timestamptz);
    CREATE TABLE ${schema}.sesiones(id uuid PRIMARY KEY,usuario_id integer NOT NULL REFERENCES ${schema}.usuarios,
      expira_at timestamptz NOT NULL,ip text NOT NULL,user_agent text NOT NULL);
    CREATE TABLE ${schema}.auditoria(id serial PRIMARY KEY,usuario_id integer REFERENCES ${schema}.usuarios,
      accion text NOT NULL,entidad text NOT NULL,entidad_id text,datos_despues jsonb,ip text CHECK(ip<>'fail-audit'));
    INSERT INTO ${schema}.usuarios VALUES(1,NULL),(2,NULL),(3,NULL)`);
  await admin.query(trigger.replace("public.e5_serialize()", `${schema}.e5_serialize()`));
  await admin.query(`CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON ${schema}.usuarios
    FOR EACH STATEMENT EXECUTE FUNCTION ${schema}.e5_serialize()`);
  const count = async () => (await pool.query("SELECT (SELECT count(*)::int FROM sesiones) sessions,(SELECT count(*)::int FROM auditoria) audits")).rows[0];
  await admin.query("BEGIN; SELECT pg_advisory_xact_lock(650005,5)");
  try {
    await assert.rejects(() => invoke(old), e => code(e) === "40001" &&
      (e.cause ?? e).message === "E5: grafo ocupado; abortar transacción completa, sin espera global");
    assert.deepEqual(await count(), { sessions: 0, audits: 0 });
    results.push({ test: "exact frozen login callback + native trigger/barrier", result: "RED_40001", partialWrites: 0 });
    let done = false;
    const pending = invoke(fixed).then(id => { done = true; return id; });
    await new Promise(r => setTimeout(r, 250));
    assert.equal(done, false);
    assert.deepEqual(await count(), { sessions: 0, audits: 0 });
    await admin.query("COMMIT");
    await pending;
    assert.deepEqual(await count(), { sessions: 1, audits: 1 });
    results.push({ test: "candidate waits before FK locks, then atomic commit once", result: "PASS" });
  } finally { await admin.query("ROLLBACK"); }
  for (const actors of [[1, 1, 1], [1, 2, 3]]) {
    const before = await count(), start = performance.now();
    const ids = await Promise.all(actors.map(id => invoke(fixed, id)));
    assert.equal(new Set(ids).size, 3);
    const after = await count();
    assert.equal(after.sessions - before.sessions, 3);
    assert.equal(after.audits - before.audits, 3);
    results.push({ test: "three concurrent exact candidate callbacks", actors, result: "PASS", ms: performance.now() - start });
  }
  const before = await count();
  const accessBefore = (await pool.query("SELECT ultimo_acceso FROM usuarios WHERE id=1")).rows[0];
  await assert.rejects(() => invoke(fixed, 1, "fail-audit"), e => code(e) === "23514");
  assert.deepEqual(await count(), before);
  assert.deepEqual((await pool.query("SELECT ultimo_acceso FROM usuarios WHERE id=1")).rows[0], accessBefore);
  results.push({ test: "audit rejection rolls back session and last access", result: "PASS" });
} finally {
  await admin.query("ROLLBACK");
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
fs.writeFileSync("reports/release-owner-20260926/login-regression-results.json", JSON.stringify({
  results, isolatedSchemaDropped: true, publicDml: false,
  scope: "Exact source transaction callbacks with native installed e5_serialize and session/audit FKs; unrelated deferred business graphs not copied."
}, null, 2));
console.log(results);