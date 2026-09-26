import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const dir = "/tmp/priority-fiscal-20260926", report = path.resolve("reports/priority-fiscal-20260926");
const database = "priority_fiscal_20260926";
const clockISO = "2026-10-02T18:00:00.000Z"; // October 2, noon CDMX; forward only.
const handoff = JSON.parse(fs.readFileSync("/tmp/priority-20260926/browser/clock-handoff.json"));
if (!handoff.ready || handoff.sourceDatabase !== "priority_20260926" ||
    handoff.invoice.totalFacturado !== "1160.00" || handoff.invoice.facturaId !== 1) throw Error("Native handoff mismatch");
fs.mkdirSync(dir, { mode: 0o700, recursive: true });
const url = new URL(JSON.parse(fs.readFileSync(`${dir}/neon-branch.json`)).TEST_DATABASE_URL);
url.hostname = url.hostname.replace("-pooler", "");
if (!url.hostname.endsWith(".neon.tech")) throw Error("Wrong endpoint");
const parentUrl = new URL(JSON.parse(fs.readFileSync("/tmp/priority-20260926/neon.json")).TEST_DATABASE_URL);
if (url.hostname === parentUrl.hostname.replace("-pooler", "")) throw Error("Fiscal child branch endpoint required");
const control = new pg.Client({ connectionString: url.href }); await control.connect();
if ((await control.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount) throw Error("Refusing overwrite fiscal copy");
if (url.pathname === "/priority_20260926") throw Error("Control connection cannot use source database");
const terminated = [];
// Authorized fallback: Neon child fork already cloned full parent catalog/data.
// Rename ONLY child's inherited primary DB; parent remains untouched.
await control.query("ALTER DATABASE priority_20260926 RENAME TO priority_fiscal_20260926");
await control.end();
url.pathname = `/${database}`;
const c = new pg.Client({ connectionString: url.href, options: "-c default_transaction_read_only=on" });
await c.connect(); await c.query("BEGIN READ ONLY");
const invoice = (await c.query(`SELECT id,folio,cliente_id,ubicacion_id,total::text,facturado,cobrado,
  estado,documento_tipo,cobrado_at,
  (SELECT count(*)::int FROM ticket_lineas l WHERE l.ticket_id=t.id) line_count,
  (SELECT coalesce(sum(p.importe),0)::text FROM ticket_pagos p WHERE p.ticket_id=t.id AND p.forma_pago='TRANSFERENCIA') transfer_total
  FROM tickets t WHERE id=1`)).rows[0];
if (!invoice || invoice.total !== "1160.00" || !invoice.facturado || !invoice.cobrado ||
    invoice.cliente_id !== 2583 || invoice.ubicacion_id !== 835 || invoice.line_count < 1 ||
    Number(invoice.transfer_total) !== 1160 || new Date(invoice.cobrado_at).toISOString() !== handoff.invoice.fechaFacturacion)
  throw Error("Native invoice evidence mismatch");
const roles = (await c.query("SELECT id,usuario,rol FROM usuarios WHERE id IN (237,238) ORDER BY id")).rows;
if (roles.length !== 2) throw Error("F/A identities not copied");
const customers = (await c.query("SELECT count(*)::int total FROM clientes")).rows[0];
await c.query("ROLLBACK"); await c.end();
fs.writeFileSync(`${dir}/test-env.json`, JSON.stringify({ TEST_DATABASE_URL: url.href }), { mode: 0o600 });
fs.copyFileSync("/tmp/priority-20260926/credentials.json", `${dir}/credentials.json`); fs.chmodSync(`${dir}/credentials.json`, 0o600);
fs.writeFileSync(`${dir}/clock.json`, JSON.stringify({ clockISO, browserTimezoneId: "America/Mexico_City",
  sourceStateFile: handoff.stateFile, sourceCredentialsFile: "/tmp/priority-20260926/credentials.json",
  backwardResetForbidden: true }), { mode: 0o600 });
fs.copyFileSync("/tmp/priority-20260926/browser/state.json", `${dir}/browser-state-handoff.json`);
fs.chmodSync(`${dir}/browser-state-handoff.json`, 0o600);
const candidate = JSON.parse(fs.readFileSync("reports/priority-perf-20260926/candidate.json"));
if (candidate.apiSha256 !== "f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97" ||
  crypto.createHash("sha256").update(fs.readFileSync(candidate.apiEntry)).digest("hex") !== candidate.apiSha256)
  throw Error("Expected frozen exact v6");
fs.writeFileSync(`${report}/candidate.json`, JSON.stringify(candidate, null, 2));
for (const name of ["launch-private.mjs", "api-bootstrap.mjs"]) {
  let text = fs.readFileSync(`reports/priority-perf-20260926/${name}`, "utf8")
    .replaceAll("/tmp/priority-perf-20260926", dir)
    .replaceAll("reports/priority-perf-20260926", "reports/priority-fiscal-20260926")
    .replaceAll("priority_perf_20260926", database).replaceAll("18237", "18247").replaceAll("18238", "18248");
  if (name === "api-bootstrap.mjs") text = 'import "./server-clock.mjs";\n' + text;
  fs.writeFileSync(`${report}/${name}`, text);
}
fs.writeFileSync(`${report}/copy-ready.json`, JSON.stringify({ status: "DATABASE_READY_NOT_STARTED",
  database, sourceDatabase: "priority_20260926", branch: "br-hidden-lab-axibqutc",
  parentBranch: "br-snowy-sea-ax2ft2er", project: "withered-block-09991755",
  cloneMethod: "Neon child branch from own primary branch at LSN0/11569308; renamed inherited primary DB only on child; full native catalog/data, no initializers",
  sourceDataWrites: false, authorizedOwnSourceConnectionsTerminated: terminated,
  copiedNativeInvoice: invoice, roles, customers, apiSha256: candidate.apiSha256,
  frontendIndexSha256: candidate.frontendFiles["index.html"], clockISO, clockLocal: "2026-10-02 12:00:00 America/Mexico_City",
  clockScope: "Server/browser JavaScript Date frozen identically; PostgreSQL/system wall clock untouched. Existing invoice timestamp not changed.",
  browserSetup: "context timezoneId America/Mexico_City; await context.addInitScript({path: reports/priority-fiscal-20260926/browser-clock.js}) BEFORE first page; use fresh login for F237/A238 because old sessions may be expired under advanced JS clock",
  periods: { day: "2026-09-25", week: "2026-09-21", month: "2026-09-01" },
  ports: [18247,18248], started: false, at: new Date().toISOString() }, null, 2));
console.log("FISCAL_NATIVE_CLONE_READY_NOT_STARTED; invoice1 transfer1160 verified; forward clock configured.");