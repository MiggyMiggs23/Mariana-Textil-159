import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "../../lib/db/node_modules/pg/lib/index.js";

const dir = "/tmp/priority-20260926";
const report = path.resolve("reports/priority-20260926");
const old = path.resolve("reports/noche-20260926/tarea-2");
const database = "priority_20260926";
const hash = data => crypto.createHash("sha256").update(data).digest("hex");
const source = new URL(process.env.DATABASE_URL);
const target = new URL(JSON.parse(fs.readFileSync(`${dir}/neon.json`)).TEST_DATABASE_URL);
target.hostname = target.hostname.replace("-pooler", "");
if (!target.hostname.endsWith(".neon.tech") || source.hostname === target.hostname) throw Error("Isolation rejected");
const control = new pg.Client({ connectionString: target.href }); await control.connect();
if ((await control.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount)
  throw Error("Refusing overwrite existing database");
await control.query(`CREATE DATABASE ${database}`); await control.end();
target.pathname = `/${database}`;
const run = (cmd, args, url, readOnly = false) => {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 10_000_000, env: {
    PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8",
    PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
    ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on" } : {}),
  }});
  fs.writeFileSync(`${dir}/${cmd}.diagnostic`, result.stderr || "", { mode: 0o600 });
  if (result.status !== 0) throw Error(`${cmd} failed; private diagnostics retained, not read`);
};
const dump = `${dir}/application.dump`;
run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", dump], source, true);
fs.chmodSync(dump, 0o600);
run("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", database, dump], target);
const c = new pg.Client({ connectionString: target.href }); await c.connect();
const clients = (await c.query("SELECT count(*)::int total,count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
if (clients.nonsystem !== 2575) throw Error("Inherited clients mismatch");
const admins = [];
for (const suffix of ["admin", "contadorA", "contadorB"]) {
  const password = crypto.randomBytes(28).toString("base64url");
  const actor = (await c.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,alcance_consulta)
    VALUES($1,$2,crypt($3,gen_salt('bf',12)),'ADMIN','TODAS') RETURNING id,usuario`,
    [`Priority disposable ${suffix}`, `e2e.priority.${suffix}`, password])).rows[0];
  admins.push({ ...actor, password });
}
await c.end();
fs.writeFileSync(`${dir}/test-env.json`, JSON.stringify({ TEST_DATABASE_URL: target.href }), { mode: 0o600 });
fs.writeFileSync(`${dir}/credentials.json`, JSON.stringify({ admin: admins[0], actors: admins }), { mode: 0o600 });
const candidate = JSON.parse(fs.readFileSync(`${old}/candidate.json`));
if (hash(fs.readFileSync(candidate.apiEntry)) !== candidate.apiSha256) throw Error("Original frozen API mismatch");
for (const [file, expected] of Object.entries(candidate.frontendFiles))
  if (hash(fs.readFileSync(path.join(candidate.frontendRoot, file))) !== expected) throw Error("Frozen UI mismatch");
// Snapshot alongside the original so any external runtime imports still resolve.
const frozenEntry = path.join(path.dirname(candidate.apiEntry), "priority-baseline-instrumented.mjs");
const original = fs.readFileSync(candidate.apiEntry, "utf8");
const marker = "    db = drizzle(pool, { schema: schema_exports });";
if (original.split(marker).length !== 2) throw Error("Diagnostic injection point ambiguous");
const instrumented = original.replace(marker, "    globalThis.__priorityObservePool(pool);\n" + marker);
fs.writeFileSync(frozenEntry, instrumented);
candidate.originalApiEntry = candidate.apiEntry;
candidate.originalApiSha256 = candidate.apiSha256;
candidate.apiEntry = frozenEntry;
candidate.apiSha256 = hash(instrumented);
candidate.instrumentation = "Single observer hook before drizzle; no business logic changes";
fs.writeFileSync(`${report}/candidate.json`, JSON.stringify(candidate, null, 2));
for (const name of ["api-bootstrap.mjs", "launch-private.mjs"]) {
  let code = fs.readFileSync(`${old}/${name}`, "utf8")
    .replaceAll("../../../lib/db/", "../../lib/db/")
    .replaceAll("/tmp/noche-20260926", dir)
    .replaceAll("reports/noche-20260926/tarea-2", "reports/priority-20260926")
    .replaceAll("noche_20260926", database);
  if (name === "api-bootstrap.mjs") code = 'import "./pool-observer.mjs";\n' + code;
  fs.writeFileSync(`${report}/${name}`, code);
}
fs.writeFileSync(`${report}/copy-ready.json`, JSON.stringify({
  status: "DATABASE_READY_NOT_STARTED", branch: "br-snowy-sea-ax2ft2er",
  project: "withered-block-09991755", database, clients,
  sourceReadOnly: true, restore: "Full custom pg_dump, no-owner/no-acl; all schema/data/constraints/triggers restored",
  dumpSha256: hash(fs.readFileSync(dump)), admins: admins.map(({password, ...actor}) => actor),
  apiSha256: candidate.apiSha256, originalApiSha256: candidate.originalApiSha256,
  frontendIndexSha256: candidate.frontendFiles["index.html"],
  annualLoad: false, initializers: false, controlledClock: "Not advanced. Fiscal clone pending native nonempty sales.",
  at: new Date().toISOString()
}, null, 2));
console.log("COPY_READY_NOT_STARTED; credentials private; full catalog restored; no annual fixtures.");