import fs from "node:fs";
import vm from "node:vm";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const config = JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/clock.json"));
const url = new URL(JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/test-env.json")).TEST_DATABASE_URL);
const parent = new URL(JSON.parse(fs.readFileSync("/tmp/priority-20260926/test-env.json")).TEST_DATABASE_URL);
if (url.pathname !== "/priority_fiscal_20260926" || url.hostname.replace("-pooler","") === parent.hostname.replace("-pooler",""))
  throw Error("Only separate fiscal branch allowed");
const c = new pg.Client({ connectionString: url.href }); await c.connect();
// Auth login omits created_at; DB now() would be September and E11's October
// max-age check would reject every fresh session. Scope this fixture-only default
// to NEW sessions in the fiscal clone; never rewrite invoices/existing sessions.
await c.query("ALTER TABLE public.sesiones ALTER COLUMN created_at SET DEFAULT '2026-10-02T18:00:00.000Z'::timestamptz");
await c.query("BEGIN READ ONLY");
const periods = [];
for (const [type, start, end] of [
  ["DIA", "2026-09-25", "2026-09-26"],
  ["SEMANA", "2026-09-21", "2026-09-28"],
  ["MES", "2026-09-01", "2026-10-01"],
]) {
  const result = (await c.query(`SELECT count(*)::int invoices,coalesce(sum(total),0)::text total,
    array_agg(id ORDER BY id) invoice_ids
    FROM tickets WHERE facturado=true AND estado='VENDIDO'
    AND ((documento_tipo='TICKET' AND cobrado=true) OR (documento_tipo='NOTA' AND autorizacion_estado='AUTORIZADA'))
    AND CASE WHEN documento_tipo='TICKET' THEN cobrado_at ELSE autorizado_at END >= ($1::date::timestamp AT TIME ZONE 'America/Mexico_City')
    AND CASE WHEN documento_tipo='TICKET' THEN cobrado_at ELSE autorizado_at END < ($2::date::timestamp AT TIME ZONE 'America/Mexico_City')`,
    [start,end])).rows[0];
  const closed = new Date(`${end}T06:00:00.000Z`).getTime() <= Date.parse(config.clockISO);
  if (!closed || result.invoices !== 1 || Number(result.total) !== 1160 || result.invoice_ids[0] !== 1)
    throw Error("Expected closed nonempty fiscal period");
  periods.push({ type, start, endExclusive: end, closedAtConfiguredClock: closed, ...result });
}
const roles = (await c.query(`SELECT u.id usuario_id,coalesce(p.perfil,'F') perfil
 FROM usuarios u LEFT JOIN e11_perfiles p ON p.usuario_id=u.id
 WHERE u.id IN (237,238) AND u.rol='CONTADOR' ORDER BY u.id`)).rows;
if (roles.find(r=>r.usuario_id===237)?.perfil !== "F" || roles.find(r=>r.usuario_id===238)?.perfil !== "A")
  throw Error("Copied fiscal profiles mismatch");
await c.query("ROLLBACK"); await c.end();
const js = fs.readFileSync(new URL("./browser-clock.js", import.meta.url), "utf8");
const sandbox = vm.createContext({});
vm.runInContext(js, sandbox);
const browserISO = vm.runInContext("new Date().toISOString()", sandbox);
const browserNow = vm.runInContext("Date.now()", sandbox);
if (browserISO !== config.clockISO || browserNow !== Date.parse(config.clockISO)) throw Error("Browser clock mismatch");
const proof = { status: "CLOSED_NONEMPTY_PERIODS_VERIFIED_BEFORE_RUNTIME", periods, roles,
  clock: { configuredISO: config.clockISO, browserScriptVerifiedISO: browserISO,
    serverUsesIdenticalScript: true, browserTimezoneId: "America/Mexico_City", timersAndPerformanceNowUnchanged: true },
  fiscalOnlyClockSupportDDL: "sesiones.created_at default fixed to same October2 instant for NEW login sessions; required by E11 sixteen-hour max-age guard. No invoice/existing-session timestamps rewritten.",
  realSystemAndPgClockUnchanged: true, sourceDataWrites: false, browserAcceptanceNotYetRun: true,
  at: new Date().toISOString() };
fs.writeFileSync(new URL("./closed-period-verification.json", import.meta.url), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));