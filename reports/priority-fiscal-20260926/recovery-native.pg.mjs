// Isolated schema only: no public DML, no public sequence defaults, no HTTP intentions.
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const dir = "reports/priority-fiscal-20260926";
const url = new URL(JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/test-env.json")).TEST_DATABASE_URL);
if (url.pathname !== "/priority_fiscal_20260926") throw Error("Wrong authorized database");
url.hostname = url.hostname.replace("-pooler", "");
const schema = `e11_alias_test_${crypto.randomBytes(6).toString("hex")}`;
const c = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
const local = sql => sql.replaceAll("public.", `${schema}.`);
const results = [];
let nativeE11ForeignKeysRestored = false;
const reproduceWeekClock = process.env.REPRODUCE_FISCAL_WEEK_CLOCK === "1";
const verifyFixtureClock = process.env.VERIFY_FISCAL_FIXTURE_CLOCK === "1";
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = value => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const original = fs.readFileSync(`${dir}/recovery-check-before.sql`, "utf8");
const fixed = fs.readFileSync(`${dir}/recovery-check-after.sql`, "utf8");
const target = { actorId: 237, accion: "SNAPSHOT", uuidOriginal: crypto.randomUUID() };
const resolutionId = crypto.randomUUID(), resolverUuid = crypto.randomUUID();
const now = "2026-08-10T18:00:00.000Z", identity = "a".repeat(64), reason = "Isolated schema regression";
async function resolve() {
  const previous = { ...target, estado: "PENDIENTE", resolucionId: null, resueltoEn: null };
  const metadata = { ...target, estado: "CERRADA_SIN_EFECTO", resolucionId: resolutionId, resueltoEn: now };
  const response = { ...metadata, revision: hash(metadata) };
  const input = { uuid: resolverUuid, revisionEsperada: hash(previous), identidadVersion: identity, motivo: reason };
  const requestHash = hash({ target, input });
  await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await c.query(`INSERT INTO ${schema}.e11_operaciones(actor_id,operacion,uuid,solicitud_hash,respuesta,estado)
    VALUES($1,'SNAPSHOT',$2,$3,$4,'CERRADA_SIN_EFECTO')`, [237, target.uuidOriginal, requestHash, response]);
  await c.query(`INSERT INTO ${schema}.e11_resoluciones
    (id,actor_original_id,accion,uuid_original,admin_id,uuid_resolutor,solicitud_hash,revision_anterior,identidad_version,motivo,estado,respuesta,created_at)
    VALUES($1,237,'SNAPSHOT',$2,234,$3,$4,$5,$6,$7,'CERRADA_SIN_EFECTO',$8,$9)`,
  [resolutionId, target.uuidOriginal, resolverUuid, requestHash, input.revisionEsperada, identity, reason, response, now]);
  await c.query("COMMIT");
}
async function snapshot(tipo, inicio, finExclusivo, frozenAt = new Date().toISOString()) {
  await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  const items = (await c.query(`SELECT ${schema}.e11_fuente($1,$2) AS items`, [inicio, finExclusivo])).rows[0].items;
  assert.ok(items.length > 0);
  const id = crypto.randomUUID(), uuid = crypto.randomUUID();
  const data = { id, uuid, periodo: { tipo, inicio, finExclusivo, zona: "America/Mexico_City",
    obligatorio: tipo !== "DIA", estado: "CONGELADO", ultimaConciliacionId: id },
    revision: 1, anteriorId: null, fuenteRevision: hash(items), vigente: true,
    congeladoEn: frozenAt, actorId: 237, totalFacturado: items[0].totalFacturado,
    cantidadVentas: items.length, evidenciaHash: hash(items), decisiones: [] };
  await c.query(`INSERT INTO ${schema}.e11_conciliaciones
    (id,tipo,inicio,revision,anterior_id,actor_id,perfil_version,datos)
    VALUES($1,$2,$3,1,NULL,237,0,$4)`, [id, tipo, inicio, data]);
  for (const item of items) await c.query(`INSERT INTO ${schema}.e11_conciliacion_ventas(conciliacion_id,venta_id,datos)
    VALUES($1,$2,$3)`, [id, item.ventaId, item]);
  await c.query(`INSERT INTO ${schema}.e11_operaciones(actor_id,operacion,uuid,solicitud_hash,respuesta)
    VALUES(237,'SNAPSHOT',$1,$2,$3)`, [uuid, hash(data), data]);
  await c.query("COMMIT");
  results.push({ case: `snapshot-${tipo}`, inicio, finExclusivo, commit: "PASS", nonemptySales: items.length });
}
try {
  await c.connect();
  assert.equal((await c.query("SELECT current_database() AS name")).rows[0].name, "priority_fiscal_20260926");
  const tables = (await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
  assert.ok(tables.every(r => /^[a-z_][a-z0-9_]*$/.test(r.tablename)));
  await c.query(`CREATE SCHEMA ${schema}`);
  // LIKE copies table checks/indexes, not cross-schema foreign keys. Native E11
  // actor/birth/provenance/deferred graph triggers below are copied verbatim.
  await c.query(tables.map(r => `CREATE TABLE ${schema}.${r.tablename} (LIKE public.${r.tablename} INCLUDING ALL);`).join("\n"));
  const foreignKeys = (await c.query(`SELECT r.relname AS table_name,con.conname,
    pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con
    JOIN pg_class r ON r.oid=con.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname='public' AND r.relname LIKE 'e11_%' AND con.contype='f'`)).rows;
  for (const fk of foreignKeys) {
    assert.match(fk.table_name, /^[a-z_][a-z0-9_]*$/);
    assert.match(fk.conname, /^[a-z_][a-z0-9_]*$/);
    const definition = local(fk.definition).replace(/REFERENCES ([a-z_]\w*)\(/g, `REFERENCES ${schema}.$1(`);
    await c.query(`ALTER TABLE ${schema}.${fk.table_name} ADD CONSTRAINT "${fk.conname}" ${definition}`);
  }
  assert.ok(foreignKeys.length > 0);
  nativeE11ForeignKeysRestored = true;
  await c.query(`INSERT INTO ${schema}.usuarios SELECT * FROM public.usuarios WHERE id IN (234,237)`);
  const actors = (await c.query(`SELECT id,rol::text,activo FROM ${schema}.usuarios ORDER BY id`)).rows;
  assert.deepEqual(actors, [{ id: 234, rol: "ADMIN", activo: true }, { id: 237, rol: "CONTADOR", activo: true }]);
  await c.query(`INSERT INTO ${schema}.tickets SELECT * FROM public.tickets WHERE facturado AND estado='VENDIDO'
    AND ((documento_tipo='TICKET' AND cobrado) OR (documento_tipo='NOTA' AND autorizacion_estado='AUTORIZADA')) LIMIT 1`);
  assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${schema}.tickets`)).rows[0].n, 1);
  await c.query(`INSERT INTO ${schema}.clientes SELECT * FROM public.clientes WHERE id IN (SELECT cliente_id FROM ${schema}.tickets)`);
  // Controlled dates only in the disposable test schema; original source rows unchanged.
  await c.query(`UPDATE ${schema}.tickets SET cobrado_at='2026-08-05T12:00:00Z',autorizado_at='2026-08-05T12:00:00Z'`);
  const functions = JSON.parse(fs.readFileSync(`${dir}/${verifyFixtureClock ? "fixture-clock-installed-functions" : "e11-installed-functions"}.json`));
  for (const name of ["e11_canonical", "e11_hash", "e11_iso"]) {
    await c.query(local(functions.find(f => f.proname === name).definition));
  }
  for (const f of functions.filter(f => !["e11_canonical", "e11_hash", "e11_iso"].includes(f.proname))) await c.query(local(f.definition));
  const triggers = (await c.query(`SELECT pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
    JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname='public' AND t.tgname LIKE 'e11%' AND t.tgenabled IN ('O','A') AND NOT t.tgisinternal`)).rows;
  for (const t of triggers) await c.query(local(t.definition).replace(/EXECUTE FUNCTION (e11_\w+)\(/g, `EXECUTE FUNCTION ${schema}.$1(`));
  assert.ok(triggers.length > 0);
  await c.query(local(original));
  try { await resolve(); throw Error("Baseline resolver unexpectedly committed"); }
  catch (error) {
    assert.equal(error.code, "55000");
    assert.equal(crypto.createHash("sha256").update(error.message).digest("hex"),
      "0b55c3b8807d06ab42de29e42cb4902a0955c37327979b62db084d73e4e4dbca");
    await c.query("ROLLBACK");
    assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${schema}.e11_operaciones`)).rows[0].n, 0);
    results.push({ case: "resolver-original", commit: "RED_55000", persistedOperations: 0 });
  }
  await c.query(local(fixed));
  await resolve(); // same test target/resolver UUID as the failed baseline
  results.push({ case: "resolver-corrected-same-test-intention", commit: "PASS" });
  await snapshot("DIA", "2026-08-05", "2026-08-06");
  await snapshot("SEMANA", "2026-08-03", "2026-08-10");
  await snapshot("MES", "2026-08-01", "2026-09-01");
  if (verifyFixtureClock) {
    await c.query(`UPDATE ${schema}.tickets SET cobrado_at='2026-09-24T12:00:00Z',autorizado_at='2026-09-24T12:00:00Z'`);
    const frozen = "2026-10-02T18:00:00.000Z";
    await snapshot("DIA", "2026-09-24", "2026-09-25", frozen);
    await snapshot("SEMANA", "2026-09-21", "2026-09-28", frozen);
    await snapshot("MES", "2026-09-01", "2026-10-01", frozen);
  }
  if (reproduceWeekClock) {
    // Reproduce the actual clock disagreement without altering any function,
    // public invoice, server clock or original HTTP intention.
    await c.query(`UPDATE ${schema}.tickets SET cobrado_at='2026-09-24T12:00:00Z',autorizado_at='2026-09-24T12:00:00Z'`);
    const open = (await c.query(`SELECT '2026-09-28T06:00:00Z'::timestamptz>clock_timestamp() AS open`)).rows[0].open;
    assert.equal(open, true, "This dated reproduction requires the original real-clock window");
    try {
      await snapshot("SEMANA", "2026-09-21", "2026-09-28", "2026-10-02T18:00:00.000Z");
      throw Error("Database-open week unexpectedly committed");
    } catch (error) {
      assert.equal(error.code, "P0001");
      const messageSha256 = crypto.createHash("sha256").update(error.message).digest("hex");
      assert.equal(messageSha256, "2758515d7a2fd0dacde69944bb2b7fc80a89ee4d8a058cab55afa9c817b53b96");
      await c.query("ROLLBACK");
      assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${schema}.e11_conciliaciones`)).rows[0].n, 3);
      results.push({ case: "frozen-app-closed-real-PG-open-week", commit: "REJECTED_P0001",
        messageSha256, newSnapshotPersisted: false });
    }
  }
  await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await c.query(`INSERT INTO ${schema}.e11_operaciones(actor_id,operacion,uuid,solicitud_hash,respuesta,estado)
    VALUES(237,'SNAPSHOT',$1,$2,'{}','CERRADA_SIN_EFECTO')`, [crypto.randomUUID(), "b".repeat(64)]);
  try { await c.query("COMMIT"); throw Error("Unpaired tombstone unexpectedly committed"); }
  catch (error) {
    assert.equal(error.code, "P0001");
    assert.equal(error.message, "E11: tombstone sin resolución ADMIN propia");
    await c.query("ROLLBACK");
    results.push({ case: "unpaired-tombstone-remains-rejected", commit: "REJECTED_P0001" });
  }
} catch (error) {
  results.push({ case: "harness", status: "FAIL", name: error.name, code: error.code ?? null,
    message: error.code ? undefined : error.message,
    errorMessageSha256: crypto.createHash("sha256").update(error.message).digest("hex") });
  process.exitCode = 1;
} finally {
  try { await c.query("ROLLBACK"); await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
  finally { await c.end(); }
}
const report = { results, publicDataWrites: false, publicIntentionsCreated: false,
  isolatedSchemaDropped: true, nativeE11ForeignKeysRestored,
  caveat: "Base application FKs outside E11 are not cloned; E11 FKs and active actor/birth/provenance/deferred graph triggers are real." };
fs.writeFileSync(`${dir}/${verifyFixtureClock ? "fixture-clock-native-results" : reproduceWeekClock ? "week-clock-native-repro" : "recovery-native-pg-results"}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));