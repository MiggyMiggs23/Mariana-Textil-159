import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const privateDir = "/tmp/noche-20260926";
const report = new URL("./", import.meta.url);
const sourceUrl = new URL(process.env.DATABASE_URL);
const targetUrl = new URL(JSON.parse(fs.readFileSync(`${privateDir}/neon.json`)).TEST_DATABASE_URL);
if (sourceUrl.hostname.replace("-pooler", "") === targetUrl.hostname.replace("-pooler", ""))
  throw Error("Separate endpoint required");
targetUrl.hostname = targetUrl.hostname.replace("-pooler", "");
const control = new pg.Client({ connectionString: targetUrl.href });
await control.connect();
const database = "noche_20260926";
if (!(await control.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount)
  await control.query(`CREATE DATABASE ${database}`);
await control.end();
targetUrl.pathname = `/${database}`;
const safeEnv = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8" };
const dump = `${privateDir}/application.dump`;
const run = (command, args, env) => {
  const result = spawnSync(command, args, { env: { ...safeEnv, ...env }, encoding: "utf8", maxBuffer: 10_000_000 });
  fs.writeFileSync(`${privateDir}/${command}.txt`, result.stderr || "", { mode: 0o600 });
  if (result.status !== 0) throw Error(`${command} failed; private diagnostic available`);
};
run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", dump],
  { PGDATABASE: sourceUrl.pathname.slice(1), PGHOST: sourceUrl.hostname,
    PGUSER: decodeURIComponent(sourceUrl.username), PGPASSWORD: decodeURIComponent(sourceUrl.password),
    PGPORT: sourceUrl.port || "5432", PGSSLMODE: sourceUrl.searchParams.get("sslmode") || "prefer",
    PGOPTIONS: "-c default_transaction_read_only=on" });
fs.chmodSync(dump, 0o600);
run("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", database, dump],
  { PGHOST: targetUrl.hostname, PGPORT: targetUrl.port || "5432",
    PGUSER: decodeURIComponent(targetUrl.username), PGPASSWORD: decodeURIComponent(targetUrl.password), PGSSLMODE: "require" });
const c = new pg.Client({ connectionString: targetUrl.href });
await c.connect();
const identity = (await c.query("SELECT current_database() database, current_user actor")).rows[0];
if (identity.database !== database) throw Error("Wrong restored database");
const count = (await c.query("SELECT count(*)::int total, count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
if (count.nonsystem !== 2575) throw Error("Real client population mismatch");
const password = crypto.randomBytes(28).toString("base64url");
const admin = (await c.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,alcance_consulta)
 VALUES('Noche disposable administrator','e2e.noche.admin',crypt($1,gen_salt('bf',12)),'ADMIN','TODAS')
 RETURNING id,usuario`, [password])).rows[0];
fs.writeFileSync(`${privateDir}/test-env.json`, JSON.stringify({ TEST_DATABASE_URL: targetUrl.href }), { mode: 0o600 });
fs.writeFileSync(`${privateDir}/credentials.json`, JSON.stringify({ admin: { ...admin, password } }), { mode: 0o600 });
fs.copyFileSync(new URL("../../auditoria-colaborativa/mensaje/candidate.json", import.meta.url), new URL("./candidate.json", import.meta.url));
fs.writeFileSync(new URL("./copy-ready.json", import.meta.url), JSON.stringify({
  status: "DATABASE_READY_NOT_STARTED", branch: "br-steep-field-axnpxgd0",
  project: "withered-block-09991755", identity, clients: count,
  sourceReadOnly: true, restoredFrom: "application pg_dump consistent snapshot",
  dumpSha256: crypto.createHash("sha256").update(fs.readFileSync(dump)).digest("hex"),
  admin: { id: admin.id, usuario: admin.usuario }, createdAt: new Date().toISOString(),
}, null, 2));
await c.end();
console.log("Disposable database ready; credentials private; no application started.");