// Full actual collection route handler + production business helpers, no HTTP server.
// Only the authorized disposable DB's random owned schema is writable.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const root = process.cwd(), api = path.join(root, "artifacts/api-server");
const require = createRequire(path.join(api, "package.json"));
const pg = require("pg"), { build } = require("esbuild");
const proof = path.join(root, "reports/postrelease-review-20260926/tarea-2/cash-regression");
fs.mkdirSync(proof, { recursive: true });
const parent = path.join(api, "dist-owner-login-v9-20260926");
const hash = v => crypto.createHash("sha256").update(v).digest("hex");
assert.equal(hash(fs.readFileSync(path.join(parent, "index.mjs"))), "3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea");
const map = JSON.parse(fs.readFileSync(path.join(parent, "index.mjs.map")));
const frozen = new Map(map.sources.map((s, i) => [path.resolve(parent, s), map.sourcesContent[i]]));
const routeFile = path.join(api, "src/routes/pos.ts");
const candidateSource = fs.readFileSync(routeFile, "utf8");
const env = JSON.parse(fs.readFileSync("/tmp/postrelease-review-20260926/postreview_financial_20260926/test-env.json"));
const url = new URL(env.TEST_DATABASE_URL);
assert.equal(url.pathname, "/postreview_financial_20260926");
url.hostname = url.hostname.replace("-pooler", "");
const schema = `cash_test_${crypto.randomBytes(6).toString("hex")}`;
const pool = new pg.Pool({ connectionString: url.href, max: 5, options: `-c search_path=${schema},public -c statement_timeout=15000` });
const admin = new pg.Client({ connectionString: url.href, statement_timeout: 30000 });
globalThis.__cashTestPool = pool;
const handlers = {};
for (const version of ["baseline", "candidate"]) {
  const outfile = path.join(api, "dist-cash-regression-tests-20260926", `${version}.cjs`);
  await build({
    entryPoints: [routeFile], outfile, platform: "node", format: "cjs", bundle: true,
    external: ["pg", "drizzle-orm", "drizzle-orm/*"], logLevel: "silent", sourcemap: "linked",
    plugins: [{
      name: "frozen-route-private-db", setup(b) {
        b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "private-db", namespace: "test" }));
        b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents: `export * from ${JSON.stringify(path.join(root, "lib/db/src/schema/index.ts"))};
            import {drizzle} from 'drizzle-orm/node-postgres';
            export const pool=globalThis.__cashTestPool; export const db=drizzle(pool);`,
          loader: "ts", resolveDir: api,
        }));
        b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
          if (args.path.includes("node_modules")) return;
          const contents = version === "candidate" && args.path === routeFile ? candidateSource : frozen.get(args.path);
          if (contents === undefined) return;
          return { contents, loader: args.path.endsWith(".ts") ? "ts" : "js" };
        });
      },
    }],
  });
  const router = require(outfile).default;
  const layer = router.stack.find(l => l.route?.path === "/tickets/:id/cobrar" && l.route.methods.post);
  assert.ok(layer);
  handlers[version] = layer.route.stack.at(-1).handle;
}
const code = e => e?.code ?? e?.cause?.code;
const results = [];
let fixtureTickets;
async function call(version, ticket, amount = "1000", ip = "regression") {
  let body, status = 200, failure;
  await handlers[version]({
    params: { id: String(ticket.id) }, body: { pagos: [{ formaPago: "EFECTIVO", importe: Number(amount) }], facturado: false },
    auth: { user: { id: ticket.actor, rol: "CAJA", ubicacionId: ticket.ubicacion_id } },
    ip, get: () => undefined, headers: {}, socket: { remoteAddress: ip },
  }, { status(n) { status = n; return this; }, json(value) { body = value; return this; } },
  error => { failure = error; });
  if (failure) throw failure;
  return { status, body };
}
async function state(id) {
  return (await pool.query(`SELECT t.id,t.cobrado,t.total::text,t.usuario_caja_id,t.sesion_caja_id,
    (SELECT count(*)::int FROM ticket_pagos p WHERE p.ticket_id=t.id) payments,
    (SELECT coalesce(sum(importe),0)::text FROM ticket_pagos p WHERE p.ticket_id=t.id) amount,
    (SELECT count(*)::int FROM auditoria a WHERE a.entidad='tickets' AND a.entidad_id=t.id::text AND a.accion='COBRAR') audits
    FROM tickets t WHERE t.id=$1`, [id])).rows[0];
}
await admin.connect();
try {
  assert.equal((await admin.query("SELECT current_database() db")).rows[0].db, "postreview_financial_20260926");
  await admin.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  const tables = (await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
  assert.ok(tables.every(t => /^[a-z_][a-z0-9_]*$/.test(t)));
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);
    const columns = (await admin.query(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='' ORDER BY attnum`, [`public.${table}`])).rows.map(r => `"${r.attname}"`).join(",");
    await admin.query(`INSERT INTO ${schema}.${table}(${columns}) OVERRIDING SYSTEM VALUE SELECT ${columns} FROM public.${table}`);
  }
  // SERIAL defaults from LIKE point to public sequences. Replace EVERY copied
  // nextval default before permitting any endpoint writes; never advance public sequences.
  const defaults = (await admin.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema=$1 AND column_default LIKE 'nextval(%'`, [schema])).rows;
  for (const [i, col] of defaults.entries()) {
    const next = (await admin.query(`SELECT coalesce(max("${col.column_name}"),0)+1 n FROM ${schema}."${col.table_name}"`)).rows[0].n;
    await admin.query(`CREATE SEQUENCE ${schema}.seq_${i} START WITH ${next};
      ALTER TABLE ${schema}."${col.table_name}" ALTER COLUMN "${col.column_name}" SET DEFAULT nextval('${schema}.seq_${i}')`);
  }
  const fks = (await admin.query(`SELECT c.conname,r.relname,pg_get_constraintdef(c.oid) definition
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname='public' AND c.contype='f'`)).rows;
  for (const fk of fks) {
    const def = fk.definition.replaceAll("public.", `${schema}.`).replace(/REFERENCES ([a-z_]\w*)\(/g, `REFERENCES ${schema}.$1(`);
    await admin.query(`ALTER TABLE ${schema}."${fk.relname}" ADD CONSTRAINT "${fk.conname}" ${def}`);
  }
  const serialize = (await admin.query("SELECT pg_get_functiondef('public.e5_serialize()'::regprocedure) definition")).rows[0].definition;
  assert.match(serialize, /pg_try_advisory_xact_lock\(650005,5\)/);
  fs.writeFileSync(path.join(proof, "installed-e5-serialize.sql"), serialize);
  await admin.query(serialize.replace("public.e5_serialize()", `${schema}.e5_serialize()`));
  const serializeTables = (await admin.query(`SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE t.tgfoid='public.e5_serialize()'::regprocedure AND c.relnamespace='public'::regnamespace`)).rows;
  for (const { relname } of serializeTables)
    await admin.query(`CREATE TRIGGER e5_serialize BEFORE INSERT OR DELETE OR UPDATE ON ${schema}."${relname}" FOR EACH STATEMENT EXECUTE FUNCTION ${schema}.e5_serialize()`);
  await admin.query("COMMIT");
  // Existing authentic pending fixture sales cloned into private schema only.
  // Ticket16's public pending intention is neither called nor changed.
  fixtureTickets = (await pool.query(`SELECT t.id,t.ubicacion_id,236 actor FROM tickets t
    WHERE NOT t.cobrado AND t.estado='VENDIDO' AND t.documento_tipo='TICKET'
      AND t.ubicacion_id=838 AND t.id<>16 AND t.total=1000 ORDER BY t.id LIMIT 5`)).rows;
  assert.equal(fixtureTickets.length, 5);
  const [a, b, c, d, e] = fixtureTickets;
  const before = await state(a.id);
  await admin.query("BEGIN; SELECT pg_advisory_xact_lock(650005,5)");
  try {
    await assert.rejects(() => call("baseline", a), e => code(e) === "40001" &&
      (e.cause ?? e).message === "E5: grafo ocupado; abortar transacción completa, sin espera global");
    assert.deepEqual(await state(a.id), before);
    results.push({ test: "full frozen endpoint with native E5 contention", result: "RED_40001", noPartialPayments: true });
    let completed = false;
    const pending = call("candidate", a).then(r => { completed = true; return r; });
    await new Promise(r => setTimeout(r, 250));
    assert.equal(completed, false);
    assert.deepEqual(await state(a.id), before);
    // While waiting for E5, candidate holds neither ticket nor cash-session row.
    await admin.query(`SELECT id FROM ${schema}.tickets WHERE id=$1 FOR UPDATE NOWAIT`, [a.id]);
    await admin.query(`SELECT id FROM ${schema}.sesiones_caja WHERE ubicacion_id=$1 AND estado='ABIERTA' FOR UPDATE NOWAIT`, [a.ubicacion_id]);
    await admin.query("COMMIT");
    assert.equal((await pending).status, 200);
    const after = await state(a.id);
    assert.equal(after.cobrado, true); assert.equal(after.payments, 1); assert.equal(Number(after.amount), 1000); assert.equal(after.audits, 1);
    assert.equal(after.usuario_caja_id, 236);
    results.push({ test: "candidate waits first, holds no ticket/session locks; atomic real collection", result: "PASS", state: after });
  } finally { await admin.query("ROLLBACK"); }
  const duplicate = await call("candidate", a);
  assert.equal(duplicate.status, 409); assert.equal(duplicate.body.code, "ALREADY_CHARGED");
  assert.equal((await state(a.id)).payments, 1);
  results.push({ test: "duplicate collection remains409 and one payment", result: "PASS" });
  const concurrent = await Promise.all([call("candidate", b), call("candidate", c)]);
  assert.ok(concurrent.every(r => r.status === 200));
  for (const t of [b, c]) {
    const s = await state(t.id); assert.equal(s.payments, 1); assert.equal(Number(s.amount), 1000); assert.equal(s.audits, 1);
  }
  results.push({ test: "two independent concurrent collections commit exactly once", result: "PASS" });
  const racing = await Promise.all([call("candidate", e), call("candidate", e)]);
  assert.deepEqual(racing.map(r => r.status).sort(), [200, 409]);
  assert.equal((await state(e.id)).payments, 1);
  assert.equal((await state(e.id)).audits, 1);
  assert.equal(Number((await state(e.id)).amount), 1000);
  results.push({ test: "same-ticket concurrent race gives200/409, exactly one payment/audit", result: "PASS" });
  const dBefore = await state(d.id);
  const invalid = await call("candidate", d, "999");
  assert.equal(invalid.status, 400); assert.equal(invalid.body.code, "PAYMENT_TOTAL_MISMATCH");
  assert.deepEqual(await state(d.id), dBefore);
  results.push({ test: "wrong total remains400 with no financial effect", result: "PASS" });
  // Force a final audit rejection AFTER ticket/payment/inventory writes to test
  // atomic rollback of the real full business path, not a helper imitation.
  await admin.query(`ALTER TABLE ${schema}.auditoria ADD CONSTRAINT cash_test_reject CHECK(NOT(accion='COBRAR' AND entidad_id='${d.id}'))`);
  const inventoryBefore = (await pool.query("SELECT id,estado FROM rollos ORDER BY id")).rows;
  const movesBefore = (await pool.query("SELECT count(*)::int n FROM movimientos")).rows[0].n;
  await assert.rejects(() => call("candidate", d), e => code(e) === "23514");
  assert.deepEqual(await state(d.id), dBefore);
  assert.deepEqual((await pool.query("SELECT id,estado FROM rollos ORDER BY id")).rows, inventoryBefore);
  assert.equal((await pool.query("SELECT count(*)::int n FROM movimientos")).rows[0].n, movesBefore);
  results.push({ test: "final audit rejection rolls back ticket/payment; inventory remains unchanged", result: "PASS" });
  fs.writeFileSync(path.join(proof, "results.json"), JSON.stringify({
    results, publicDml: false, publicSequencesUsed: false, fullEndpointBusinessCode: true,
    boundary: "Handler invoked directly with authenticated CAJA context. HTTP transport/auth middleware not retested. All native FKs/checks/indexes copied; native E5 serialization triggers retained. Other deferred business graph triggers not cloned.",
    tablesCloned: tables.length, foreignKeysCloned: fks.length,
    routeSourceSha256: hash(candidateSource),
    sourceParentSha256: "3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea"
  }, null, 2));
} finally {
  await admin.query("ROLLBACK");
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  delete globalThis.__cashTestPool;
}
const report = JSON.parse(fs.readFileSync(path.join(proof, "results.json")));
report.isolatedSchemaDropped = true;
fs.writeFileSync(path.join(proof, "results.json"), JSON.stringify(report, null, 2));
console.log(results);