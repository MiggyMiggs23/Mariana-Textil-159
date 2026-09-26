import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const dir = "/tmp/priority-perf-20260926";
const report = path.resolve("reports/priority-perf-20260926");
const database = "priority_perf_20260926";
fs.mkdirSync(dir, { mode: 0o700 });
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const original = JSON.parse(fs.readFileSync("reports/priority-20260926/copy-ready.json"));
const dump = "/tmp/priority-20260926/application.dump";
if (hash(dump) !== original.dumpSha256) throw Error("Original app snapshot changed");
const url = new URL(JSON.parse(fs.readFileSync("/tmp/priority-20260926/neon.json")).TEST_DATABASE_URL);
url.hostname = url.hostname.replace("-pooler", "");
if (!url.hostname.endsWith(".neon.tech")) throw Error("Neon copy required");
const control = new pg.Client({ connectionString: url.href }); await control.connect();
if ((await control.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount) throw Error("Refusing overwrite");
await control.query(`CREATE DATABASE ${database}`); await control.end();
url.pathname = `/${database}`;
const restore = spawnSync("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", database, dump], {
  encoding: "utf8", maxBuffer: 10_000_000, env: { PATH: process.env.PATH, HOME: process.env.HOME,
    PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "require" }
});
fs.writeFileSync(`${dir}/restore-diagnostic.txt`, restore.stderr || "", { mode: 0o600 });
if (restore.status !== 0) throw Error("Restore failed; private diagnostic not read");
const c = new pg.Client({ connectionString: url.href }); await c.connect();
const clients = (await c.query("SELECT count(*)::int total,count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
if (clients.nonsystem !== 2575) throw Error("Wrong inherited clients");
const password = crypto.randomBytes(28).toString("base64url");
const admin = (await c.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,alcance_consulta)
 VALUES('Priority performance admin','e2e.priority.perf',crypt($1,gen_salt('bf',12)),'ADMIN','TODAS') RETURNING id,usuario`, [password])).rows[0];
await c.end();
fs.writeFileSync(`${dir}/test-env.json`, JSON.stringify({ TEST_DATABASE_URL: url.href }), { mode: 0o600 });
fs.writeFileSync(`${dir}/credentials.json`, JSON.stringify({ admin: { ...admin, password } }), { mode: 0o600 });
const candidate = JSON.parse(fs.readFileSync("reports/priority-20260926/candidate.json"));
if (candidate.apiSha256 !== "f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97" ||
    hash(candidate.apiEntry) !== candidate.apiSha256) throw Error("Expected frozen combined v6");
fs.writeFileSync(`${report}/candidate.json`, JSON.stringify(candidate, null, 2));
for (const name of ["launch-private.mjs", "api-bootstrap.mjs"]) {
  const text = fs.readFileSync(`reports/priority-20260926/${name}`, "utf8")
    .replace('import "./pool-observer.mjs";\n', "")
    .replaceAll("/tmp/priority-20260926", dir)
    .replaceAll("reports/priority-20260926", "reports/priority-perf-20260926")
    .replaceAll("priority_20260926", database)
    .replaceAll("18227", "18237").replaceAll("18228", "18238");
  fs.writeFileSync(`${report}/${name}`, text);
}
const loader = fs.readFileSync("reports/noche-20260926/tarea-2/annual-load.mjs", "utf8")
  .replaceAll("../../../lib/db/", "../../lib/db/")
  .replaceAll("/tmp/noche-20260926", dir).replaceAll("noche_20260926", database);
fs.writeFileSync(`${report}/annual-load.mjs`, loader);
fs.writeFileSync(`${report}/copy-ready.json`, JSON.stringify({ status: "RESTORED_LOAD_PENDING_NOT_STARTED",
  branch: original.branch, project: original.project, database, clients, admin,
  snapshotSource: "Existing original application.dump; NOT a dump of actively used primary test DB",
  dumpSha256: original.dumpSha256, sameMethodology: "Prior annual-load.mjs unchanged except isolation paths",
  apiSha256: candidate.apiSha256, frontendIndexSha256: candidate.frontendFiles["index.html"],
  ports: [18237,18238], caveat: "Separate database but shared Neon branch compute; annual loader may contend for CPU/I/O",
  createdAt: new Date().toISOString() }, null, 2));
console.log("PERF_RESTORED_NOT_STARTED");