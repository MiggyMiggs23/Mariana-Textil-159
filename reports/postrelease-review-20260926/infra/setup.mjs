import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const dir = "/tmp/postrelease-review-20260926";
const report = path.resolve("reports/postrelease-review-20260926/infra");
const hash = b => crypto.createHash("sha256").update(b).digest("hex");
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const source = new URL(process.env.DATABASE_URL);
const target = new URL(read(`${dir}/neon.json`).TEST_DATABASE_URL);
target.hostname = target.hostname.replace("-pooler", "");
if (!target.hostname.endsWith(".neon.tech") || target.hostname === source.hostname.replace("-pooler", ""))
  throw Error("Isolated target required");
const aliasSha256 = "520001178556703d8cda64dcfcda7911f7331c9e5f3e2c41107a8c7777b196bc";
const apiEntry = path.resolve("artifacts/api-server/dist-owner-login-v9-20260926/index.mjs");
const apiSha256 = "3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea";
const frontend = read("reports/priority-20260926/credit-presentation/candidate.json");
if (hash(fs.readFileSync(apiEntry)) !== apiSha256 ||
    frontend.frontendFiles["index.html"] !== "af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5")
  throw Error("Released lineage mismatch");
for (const [file, expected] of Object.entries(frontend.frontendFiles))
  if (hash(fs.readFileSync(path.join(frontend.frontendRoot, file))) !== expected) throw Error("UI hash mismatch");
const candidate = { apiEntry, apiSha256, frontendRoot: frontend.frontendRoot,
  frontendFiles: frontend.frontendFiles, instrumentation: "None; exact released frozen artifacts", aliasSha256 };
const alias = async c => hash((await c.query("SELECT pg_get_functiondef('public.e11_recovery_check()'::regprocedure) definition")).rows[0].definition);
const sourceC = new pg.Client({ connectionString: source.href, options: "-c default_transaction_read_only=on" });
await sourceC.connect();
await sourceC.query("BEGIN READ ONLY");
const sourceIdentity = (await sourceC.query("SELECT current_database() database,current_setting('server_version') version,current_setting('transaction_read_only') readonly")).rows[0];
const clients = (await sourceC.query("SELECT count(*)::int total,count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
if (await alias(sourceC) !== aliasSha256) throw Error("Source released alias mismatch");
await sourceC.query("ROLLBACK"); await sourceC.end();
const run = (cmd, args, url, readonly = false) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 10_000_000, env: {
    PATH: process.env.PATH, HOME: process.env.HOME,
    PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: url.pathname.slice(1),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
    ...(readonly ? { PGOPTIONS: "-c default_transaction_read_only=on" } : {}),
  } });
  fs.writeFileSync(`${dir}/${cmd}-${Date.now()}.diagnostic`, r.stderr || "", { mode: 0o600 });
  if (r.status !== 0) throw Error(`${cmd} failed; see restricted diagnostic`);
};
run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", `${dir}/application.dump`], source, true);
fs.chmodSync(`${dir}/application.dump`, 0o600);
const databases = [];
for (const [kind, apiPort, webPort] of [["financial", 18327, 18328], ["permissions", 18337, 18338], ["review", 18347, 18348]]) {
  const database = `postreview_${kind}_20260926`;
  const privateDir = `${dir}/${database}`, reports = `${report}/${kind}`;
  fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(reports, { recursive: true });
  const control = new pg.Client({ connectionString: target.href }); await control.connect();
  if ((await control.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount) throw Error("Existing database rejected");
  await control.query(`CREATE DATABASE ${database}`); await control.end();
  const url = new URL(target); url.pathname = `/${database}`;
  run("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", database, `${dir}/application.dump`], url);
  const c = new pg.Client({ connectionString: url.href }); await c.connect();
  const copiedClients = (await c.query("SELECT count(*)::int total,count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
  if (copiedClients.total !== clients.total || await alias(c) !== aliasSha256) throw Error("Copy integrity mismatch");
  const password = crypto.randomBytes(28).toString("base64url");
  const admin = (await c.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,alcance_consulta)
    VALUES($1,$2,crypt($3,gen_salt('bf',12)),'ADMIN','TODAS') RETURNING id,usuario,rol,alcance_consulta`,
  [`Isolated postreview ${kind} admin`, `e2e.postreview.${kind}.admin`, password])).rows[0];
  await c.end();
  fs.writeFileSync(`${privateDir}/test-env.json`, JSON.stringify({ TEST_DATABASE_URL: url.href }), { mode: 0o600 });
  fs.writeFileSync(`${privateDir}/credentials.json`, JSON.stringify({ admin: { ...admin, password } }), { mode: 0o600 });
  fs.writeFileSync(`${reports}/candidate.json`, JSON.stringify(candidate, null, 2));
  for (const name of ["api-bootstrap.mjs", "launch-private.mjs"]) {
    const template = fs.readFileSync(`reports/release-owner-20260926/infra/perf/${name}`, "utf8")
      .replaceAll("/tmp/release-owner-20260926", dir)
      .replaceAll("reports/release-owner-20260926/infra/perf", `reports/postrelease-review-20260926/infra/${kind}`)
      .replaceAll("release_perf_20260926", database)
      .replaceAll("18237", String(apiPort)).replaceAll("18238", String(webPort));
    fs.writeFileSync(`${reports}/${name}`, template);
  }
  databases.push({ kind, database, clients: copiedClients, admin, privateDir, reportDir: reports,
    apiUrl: `http://127.0.0.1:${apiPort}`, url: `http://127.0.0.1:${webPort}`, started: false,
    financialFixtures: false, actorPolicy: "Only seed ADMIN/TODAS inserted; worker must create cashier/auditor users and scoped assignments through native API/UI" });
}
fs.writeFileSync(`${report}/copy-ready.json`, JSON.stringify({
  status: "THREE_COMPLETE_COPIES_READY_NOT_STARTED", branch: "br-calm-wildflower-ax5d3p8e",
  project: "withered-block-09991755", sourceIdentity, clients,
  dumpSha256: hash(fs.readFileSync(`${dir}/application.dump`)), apiSha256,
  frontendIndexSha256: frontend.frontendFiles["index.html"], aliasSha256,
  method: "Full consistent READ ONLY pg_dump; restore schema/data/constraints/triggers; exclude owners/ACL only",
  taskPlan: "Financial then concurrency sequentially on financial copy; permissions isolated; review isolated",
  databases, at: new Date().toISOString(),
}, null, 2));
let verifier = fs.readFileSync("reports/release-owner-20260926/infra/verify-catalog.mjs", "utf8")
  .replaceAll('["login","perf"]', '["financial","permissions","review"]')
  .replaceAll("release_${kind}_20260926", "postreview_${kind}_20260926")
  .replaceAll("/tmp/release-owner-20260926", dir);
fs.writeFileSync(`${report}/verify-catalog.mjs`, verifier);
console.log("THREE_COPIES_READY_NOT_STARTED; native workers create scoped actors using seed admin");