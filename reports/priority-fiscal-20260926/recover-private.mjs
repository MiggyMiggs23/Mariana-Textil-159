import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const read = p => JSON.parse(fs.readFileSync(p));
const secret = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2), { mode: 0o600 });
const password = () => crypto.randomBytes(28).toString("base64url");
const candidate = read("reports/priority-20260926/clientlist-parallel/candidate.json");
const hash = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
if (candidate.apiSha256 !== "f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97" ||
    hash(candidate.apiEntry) !== candidate.apiSha256) throw Error("API candidate mismatch");
for (const [file, expected] of Object.entries(candidate.frontendFiles))
  if (hash(`${candidate.frontendRoot}/${file}`) !== expected) throw Error("UI candidate mismatch");
const fiscalReport = read("reports/priority-fiscal-20260926/copy-ready.json");
const primaryReport = read("reports/priority-20260926/copy-ready.json");
const native = read("reports/priority-20260926/browser/native-prep/result.json");
const evidence = name => {
  const c = native.checks.find(c => c.name === name);
  if (c?.status !== "PASS") throw Error("Missing recorded native evidence");
  return c.evidence;
};
const admin = { ...primaryReport.admins.find(u => u.id === 234), password: password() };
if (admin.usuario !== "e2e.priority.admin") throw Error("Unexpected admin authority");
const roles = Object.fromEntries(["F","A"].map((role,i) => {
  const r = fiscalReport.roles.find(u => u.id === 237+i);
  if (!r || r.usuario !== (i ? "priorityacc48a090" : "priorityf6d5388eb")) throw Error("Unexpected fiscal actor identity");
  return [role, { id: r.id, usuario: r.usuario, username: r.usuario, password: password() }];
}));
const perfAdmin = { ...read("reports/priority-perf-20260926/copy-ready.json").admin, password: password() };
if (perfAdmin.id !== 234 || perfAdmin.usuario !== "e2e.priority.perf") throw Error("Unexpected perf authority");
const parentURL = new URL(read("/tmp/priority-20260926/neon.json").TEST_DATABASE_URL);
const fiscalURL = new URL(read("/tmp/priority-fiscal-20260926/neon-branch.json").TEST_DATABASE_URL);
if (parentURL.hostname.replace("-pooler","") === fiscalURL.hostname.replace("-pooler","")) throw Error("Separate branch endpoints required");
const checks = [];
for (const spec of [
  { db:"priority_20260926", dir:"/tmp/priority-20260926", url:parentURL, actors:[admin,...Object.values(roles)] },
  { db:"priority_fiscal_20260926", dir:"/tmp/priority-fiscal-20260926", url:fiscalURL, actors:[admin,...Object.values(roles)] },
  { db:"priority_perf_20260926", dir:"/tmp/priority-perf-20260926", url:parentURL, actors:[perfAdmin] },
]) {
  const url = new URL(spec.url); url.hostname = url.hostname.replace("-pooler",""); url.pathname = `/${spec.db}`;
  const c = new pg.Client({connectionString:url.href}); await c.connect();
  if ((await c.query("SELECT current_database() db")).rows[0].db !== spec.db) throw Error("Wrong DB");
  await c.query("BEGIN");
  const count = async () => (await c.query(`SELECT
    (SELECT count(*)::int FROM tickets) tickets,
    (SELECT count(*)::int FROM ticket_pagos) payments,
    (SELECT count(*)::int FROM clientes) clients,
    (SELECT count(*)::int FROM e11_conciliaciones) snapshots,
    (SELECT count(*)::int FROM e11_decisiones) decisions`)).rows[0];
  try {
    const before = await count();
    if (spec.db === "priority_fiscal_20260926" && (before.snapshots || before.decisions))
      throw Error("Fiscal operations already exist; journal recovery needs independent reconciliation");
    for (const actor of spec.actors) {
      const found = (await c.query("SELECT id,usuario,rol,nombre FROM usuarios WHERE id=$1 FOR UPDATE", [actor.id])).rows[0];
      if (!found || found.usuario !== actor.usuario ||
        found.rol !== (actor.id===234 ? "ADMIN" : "CONTADOR")) throw Error("Synthetic user identity/role mismatch");
      const result = await c.query("UPDATE usuarios SET password_hash=crypt($1,gen_salt('bf',12)) WHERE id=$2 AND usuario=$3",
        [actor.password,actor.id,actor.usuario]);
      if (result.rowCount !== 1) throw Error("Password recovery failed");
    }
    const after = await count();
    if (JSON.stringify(before)!==JSON.stringify(after)) throw Error("Business record counts changed");
    const invoice = spec.db === "priority_perf_20260926" ? null : (await c.query(`SELECT id,cliente_id,ubicacion_id,total::text,
      cobrado_at,facturado,cobrado FROM tickets WHERE id=$1`, [evidence("native-sale-invoice").id])).rows[0];
    if (invoice && (invoice.total!=="1160.00" || invoice.cobrado_at.toISOString()!=="2026-09-26T05:13:43.647Z"))
      throw Error("Native invoice changed");
    if (spec.db === "priority_fiscal_20260926") {
      const def = (await c.query("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='sesiones' AND column_name='created_at'")).rows[0].column_default;
      if (!def.includes("2026-10-02 18:00:00")) throw Error("Fiscal session clock default changed");
    }
    await c.query("COMMIT");
    checks.push({database:spec.db,resetSyntheticIds:spec.actors.map(a=>a.id),before,after,invoice});
  } catch(e) {await c.query("ROLLBACK"); throw e;} finally {await c.end();}
  secret(`${spec.dir}/test-env.json`, {TEST_DATABASE_URL:url.href});
  secret(`${spec.dir}/credentials.json`, {admin:spec.db==="priority_perf_20260926"?perfAdmin:admin,roles:spec.db==="priority_perf_20260926"?{}:roles});
}
const site = evidence("native-isolated-site-and-three-floors"), objects = evidence("native-supplier-product-client");
const operations = Object.fromEntries(native.checks.filter(c=>c.status==="PASS").map(c=>[c.name,{status:"RECOVERED_CONFIRMED",source:"native-prep/result.json"}]));
// Prevent accidental replay of known native-write keys, not just check labels.
for (const key of ["site","supplier","product","client","entrada","cash-session","sale-invoice","sale-note","pay-invoice","create-F","create-A","assign-A"])
  operations[key] = {status:"RECOVERED_DO_NOT_REPLAY"};
const state = {roles,operations,reconciliations:{},site:{id:site.site},floors:site.floors.map(id=>({id})),
  supplier:{id:objects.supplierId},product:{id:objects.productId},client:{id:objects.clientId},
  sales:{invoice:evidence("native-sale-invoice"),note:evidence("native-sale-note")},
  recoveredFrom:"Recorded native checks plus database readback; no regenerated business IDs"};
secret("/tmp/priority-20260926/browser/state.json",state);
secret("/tmp/priority-fiscal-20260926/browser-state-handoff.json",state);
const clockISO = "2026-10-02T18:00:00.000Z";
if (fiscalReport.clockISO!==clockISO) throw Error("Prior frozen clock mismatch");
secret("/tmp/priority-fiscal-20260926/clock.json",{clockISO,browserTimezoneId:"America/Mexico_City",
  sourceStateFile:"/tmp/priority-20260926/browser/state.json",sourceCredentialsFile:"/tmp/priority-20260926/credentials.json",backwardResetForbidden:true});
secret("/tmp/priority-fiscal-20260926/clock-started.json",{epoch:Date.parse(clockISO),recoveredPriorEpoch:true,recoveredAt:new Date().toISOString()});
for(const report of ["reports/priority-perf-20260926","reports/priority-fiscal-20260926"]) {
  fs.writeFileSync(`${report}/candidate.json`,JSON.stringify(candidate,null,2));
  fs.writeFileSync(`${report}/private-ready.json`,JSON.stringify({status:"RECOVERED_NOT_STARTED",stalePriorPidInvalid:true},null,2));
}
fs.writeFileSync(new URL("./recovery-evidence.json",import.meta.url),JSON.stringify({
  status:"RECOVERED_READY_FOR_MAIN_START",at:new Date().toISOString(),checks,
  connectionSource:"Fresh Neon MCP connection lookup for exact authorized branches",
  clockISO,clockRollback:false,apiSha256:candidate.apiSha256,frontendIndexSha256:candidate.frontendFiles["index.html"],
  browserStateSource:"native-prep/result.json + copy-ready.json + DB readback",fiscalOperationsFound:0,
  passwordChangeScope:"Only authorized existing synthetic identities; no new users; no business rows written",
  sourceApplicationAccess:false,launchers:["reports/priority-fiscal-20260926/launch-private.mjs","reports/priority-perf-20260926/launch-private.mjs"]
},null,2));
console.log("RECOVERED: primary/fiscal synthetic234237238; perf234. Native records preserved. Fiscal/perf launchers ready, not started.");