// FIXTURE ONLY. Never a release migration. MAIN explicitly authorized this copy.
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const dir = "reports/priority-fiscal-20260926";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const preimage = "751271d21509f86c435e706a46f6a29e08e6f499d92684b0cb62107b2892fefe";
const postimage = "2a3286ecc129daefa258bc3bdeefee3a84d218c666fb50bbd01a614b28a9dee2";
const before = fs.readFileSync(`${dir}/fixture-clock-before.sql`, "utf8");
const after = fs.readFileSync(`${dir}/fixture-clock-after.sql`, "utf8");
if (hash(before) !== preimage || hash(after) !== postimage) throw Error("Artifact changed");
const anchor = "end_date::timestamp AT TIME ZONE 'America/Mexico_City'>clock_timestamp()";
if (before.split(anchor).length !== 2 || before.replace(anchor,
  "end_date::timestamp AT TIME ZONE 'America/Mexico_City'>'2026-10-02T18:00:00.000Z'::timestamptz") !== after)
  throw Error("Not the single authorized clock-expression delta");
const url = new URL(JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/test-env.json")).TEST_DATABASE_URL);
const live = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/priority_fiscal_20260926" ||
  url.hostname.replace("-pooler", "") === live.hostname.replace("-pooler", ""))
  throw Error("Copy isolation rejected");
url.hostname = url.hostname.replace("-pooler", "");
const c = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
const result = { fixtureOnly: true, releaseCodeChanged: false, publicDataWrites: false, preimage, postimage };
const definition = async () => (await c.query("SELECT pg_get_functiondef('public.e11_graph()'::regprocedure) AS definition")).rows[0].definition;
const metadata = async () => (await c.query(`SELECT p.oid,p.proowner,p.proacl,
  (SELECT md5(string_agg(pg_get_triggerdef(t.oid),E'\\n' ORDER BY t.oid)) FROM pg_trigger t WHERE NOT t.tgisinternal) AS triggers
  FROM pg_proc p WHERE p.oid='public.e11_graph()'::regprocedure`)).rows[0];
try {
  await c.connect();
  if ((await c.query("SELECT current_database() AS name")).rows[0].name !== "priority_fiscal_20260926")
    throw Error("Effective database rejected");
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout='3000ms'");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended('E11:security',0))");
  const originalMeta = JSON.stringify(await metadata());
  const currentHash = hash(await definition());
  if (currentHash !== preimage && currentHash !== postimage) throw Error("Unknown catalog preimage");
  if (currentHash === preimage) await c.query(after);
  if (hash(await definition()) !== postimage) throw Error("Postimage mismatch");
  if (JSON.stringify(await metadata()) !== originalMeta) throw Error("Identity/ACL/triggers changed");
  await c.query("COMMIT");
  if (hash(await definition()) !== postimage) throw Error("Committed postimage mismatch");
  await c.query("BEGIN READ ONLY");
  result.closedPeriods = (await c.query(`SELECT tipo,
    public.e11_fin(tipo,inicio)::timestamp AT TIME ZONE 'America/Mexico_City'
      <= '2026-10-02T18:00:00.000Z'::timestamptz AS closed
    FROM (VALUES ('DIA','2026-09-24'::date),('SEMANA','2026-09-21'::date),('MES','2026-09-01'::date)) v(tipo,inicio)`)).rows;
  if (!result.closedPeriods.every(r => r.closed)) throw Error("Fixture dates not closed");
  await c.query("ROLLBACK");
  // Refresh exact installed definitions for native schema-isolated verification.
  const functions = (await c.query(`SELECT proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'e11%'`)).rows;
  fs.writeFileSync(`${dir}/fixture-clock-installed-functions.json`, JSON.stringify(functions, null, 2));
  result.status = currentHash === postimage ? "ALREADY_EXACT_POSTIMAGE" : "FIXTURE_CLOCK_COMMITTED";
  result.identityPrivilegesTriggersUnchanged = true;
} catch (error) {
  try { await c.query("ROLLBACK"); } catch {}
  result.status = "FAILED";
  result.errorClass = error.name; result.code = error.code ?? null;
  result.errorHash = hash(error.message); process.exitCode = 1;
} finally { await c.end(); }
fs.writeFileSync(`${dir}/fixture-clock-migration-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));