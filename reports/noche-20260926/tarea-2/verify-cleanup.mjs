import fs from "node:fs";
import net from "node:net";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

// MAIN explicitly authorized deletion of these two task-owned private directories.
// Neon deletion and independent branch lookup are recorded separately by the operator.
const ports = [];
for (const port of [18227, 18228]) {
  const result = await new Promise(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(1500);
    socket.once("connect", () => { socket.destroy(); resolve({ port, status: "LISTENING" }); });
    socket.once("error", e => resolve({ port, status: e.code }));
    socket.once("timeout", () => { socket.destroy(); resolve({ port, status: "TIMEOUT" }); });
  });
  ports.push(result);
}
if (ports.some(p => p.status !== "ECONNREFUSED")) throw Error("Private listener absence not confirmed; stop cleanup");

const c = new pg.Client({ connectionString: process.env.DATABASE_URL,
  options: "-c default_transaction_read_only=on" });
await c.connect();
await c.query("BEGIN READ ONLY");
const sourceIdentity = (await c.query("SELECT current_database() database,current_setting('transaction_read_only') read_only")).rows[0];
if (sourceIdentity.database !== "heliumdb" || sourceIdentity.read_only !== "on")
  throw Error("Expected read-only application database");
const checks = (await c.query(`SELECT
  (SELECT count(*)::int FROM clientes WHERE id<>1) inherited_customers,
  (SELECT count(*)::int FROM usuarios WHERE usuario='e2e.noche.admin') own_admin,
  (SELECT count(*)::int FROM ubicaciones WHERE nombre LIKE 'NOCHE PERF %') own_sites,
  (SELECT count(*)::int FROM productos WHERE sku LIKE 'NPERF%') own_products,
  (SELECT count(*)::int FROM rollos WHERE serie LIKE 'NPERF-%') own_rolls,
  (SELECT count(*)::int FROM tickets WHERE folio BETWEEN 1900000001 AND 1900054750) annual_tickets,
  (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND indexname='noche_perf_ticket_lineas_cover') experimental_index
`)).rows[0];
await c.query("ROLLBACK"); await c.end();
if (checks.inherited_customers !== 2575 ||
    Object.entries(checks).some(([key, value]) => key !== "inherited_customers" && value !== 0))
  throw Error("Application read-only preservation checks failed");

const roots = ["/tmp/noche-20260926", "/home/runner/workspace/private.local/night-disposable"];
const countFiles = p => fs.readdirSync(p, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? countFiles(`${p}/${e.name}`) : 1), 0);
const removal = roots.map(p => ({ path: p, existed: fs.existsSync(p), files: fs.existsSync(p) ? countFiles(p) : 0 }));
for (const p of roots) {
  if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw Error("Unexpected root symlink");
  fs.rmSync(p, { recursive: true, force: true });
}
for (const item of removal) item.absentAfter = !fs.existsSync(item.path);
const evidence = {
  status: "CLEANUP_CONFIRMED", at: new Date().toISOString(),
  authorizedBy: "MAIN, after stopping private launcher; only own branch and private directories",
  neon: { project: "withered-block-09991755", branch: "br-steep-field-axnpxgd0",
    deleteCall: "success, isError=false",
    subsequentIndependentDescribeBranch: "HTTP 404 branch not found",
    otherBranchesDeleted: 0 },
  listeners: ports, applicationReadOnly: { ...sourceIdentity, checks,
    scope: "Own task fixture patterns and inherited client count, not a whole-database equality claim" },
  privateRemoval: removal,
  retained: "All reports, screenshots, scripts, timing results and sanitized fixture readbacks",
  managedWorkflowsModified: false,
};
fs.writeFileSync(new URL("./cleanup.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));