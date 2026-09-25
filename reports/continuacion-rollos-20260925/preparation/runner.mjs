// PREPARE ONLY. MAIN explicitly invokes --execute; never start this from a worker.
// All SQL copied from the served API is schema-only, never application rows.
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const report = path.join(root, "reports/continuacion-rollos-20260925/preparation");
const privateRoot = path.join(root, "private.local/roll-return-continuation");
const source = path.join(privateRoot, "source");
const ports = { postgres: 55536, api: 43936, ui: 43937 };
const bin = process.env.CONTINUE_PG_BIN;
const args = process.argv.slice(2);
const sha = value => createHash("sha256").update(value).digest("hex");
const save = (file, value) => fs.writeFileSync(path.join(report, file), JSON.stringify(value, null, 2) + "\n");
const own = path.join(privateRoot, "ownership-marker.json");

if (args.includes("--destroy")) {
  assert.deepEqual(args, ["--destroy"], "Destroy is a separate explicit command");
  const marker = JSON.parse(fs.readFileSync(own, "utf8"));
  assert.equal(marker.root, privateRoot);
  assert.equal(marker.owner, "MAIN");
  assert.equal(marker.port, ports.postgres);
  for (const [file, expected] of [["cluster/postmaster.pid", "/cluster"], ["api.pid", "/api.mjs"], ["ui.pid", "/proxy.mjs"]]) {
    const location = path.join(privateRoot, file);
    if (!fs.existsSync(location)) continue;
    const pid = Number(fs.readFileSync(location, "utf8").split("\n")[0]);
    assert.ok(Number.isSafeInteger(pid) && pid > 1);
    if (fs.existsSync(`/proc/${pid}/cmdline`)) {
      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
      if (cmdline.includes(privateRoot + expected)) throw Error("Owned process still alive; stop foreground runner first");
      if (file === "cluster/postmaster.pid") throw Error("Postmaster PID still exists; do not destroy ambiguous cluster");
    }
  }
  fs.rmSync(privateRoot, { recursive: true, force: false });
  save("teardown.json", { owner: "MAIN", stopped: true, destroyed: true, root: privateRoot });
  console.log("Owned disposable root destroyed.");
  process.exit(0);
}
if (!args.includes("--execute")) {
  console.log("PREPARED ONLY. MAIN: CONTINUE_PG_BIN=/absolute/postgresql/bin node reports/continuacion-rollos-20260925/preparation/runner.mjs --execute --api-pid=PID [--annual-db]");
  process.exit(0);
}
assert.ok(args.every(a => a === "--execute" || a === "--annual-db" || /^--api-pid=[0-9]+$/.test(a)), "Unrecognized argument");
const pidArg = args.find(a => a.startsWith("--api-pid="));
assert.ok(pidArg, "Explicit served API PID required; do not infer from unrelated processes");
const apiPid = Number(pidArg.slice(10));
assert.ok(Number.isSafeInteger(apiPid) && apiPid > 1);
assert.ok(bin && path.isAbsolute(bin) && fs.existsSync(path.join(bin, "pg_dump")) && fs.existsSync(path.join(bin, "initdb")), "CONTINUE_PG_BIN must be installed PostgreSQL bin directory");
assert.ok(!fs.existsSync(privateRoot), "Prior root exists: inspect it, do not overwrite or silently resume");

// Reviewed effective-pool-operator pattern: read only selected keys from the
// selected served PID, not the caller's environment; never print URL or proc env.
const argv = fs.readFileSync(`/proc/${apiPid}/cmdline`, "utf8").split("\0");
const bundle = argv.find(s => /api-server\/dist[^/]*\/index\.mjs$/.test(s));
assert.ok(bundle && !bundle.startsWith(privateRoot), "Not a served application API bundle");
const selected = new Set(["DATABASE_URL", "TEST_DATABASE_URL", "NODE_ENV", "PGSSLMODE", "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY"]);
const entries = fs.readFileSync(`/proc/${apiPid}/environ`, "utf8").split("\0");
const effective = Object.fromEntries(entries.filter(s => selected.has(s.slice(0, s.indexOf("="))))
  .map(s => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]));
assert.ok(effective.DATABASE_URL && !effective.TEST_DATABASE_URL && effective.NODE_ENV !== "test", "PID must be actual served application API");
const url = new URL(effective.DATABASE_URL);
assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "PostgreSQL URL required");
const allowedParams = new Set(["host", "port", "sslmode", "sslrootcert", "sslcert", "sslkey", "application_name"]);
assert.ok([...url.searchParams.keys()].every(k => allowedParams.has(k)), "Unsupported connection URI parameter: STOP rather than dump a different server");
const pgEnv = {};
for (const [key, value] of Object.entries({
  PGHOST: url.searchParams.get("host") ?? url.hostname,
  PGPORT: url.searchParams.get("port") || url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGSSLMODE: url.searchParams.get("sslmode") ?? effective.PGSSLMODE,
  PGSSLROOTCERT: url.searchParams.get("sslrootcert") ?? effective.PGSSLROOTCERT,
  PGSSLCERT: url.searchParams.get("sslcert") ?? effective.PGSSLCERT,
  PGSSLKEY: url.searchParams.get("sslkey") ?? effective.PGSSLKEY,
})) if (value) pgEnv[key] = value;
assert.ok(pgEnv.PGHOST && pgEnv.PGUSER && pgEnv.PGDATABASE && /^\d+$/.test(pgEnv.PGPORT), "Incomplete effective PostgreSQL connection");
const safeEnv = { PATH: process.env.PATH, HOME: privateRoot, LANG: "C.UTF-8" };
function run(command, commandArgs, cwd = root, extra = {}, timeout = 240000) {
  const result = spawnSync(command, commandArgs, { cwd, env: { ...safeEnv, ...extra }, encoding: "utf8", timeout, maxBuffer: 40e6 });
  if (result.status !== 0) {
    // Never emit subprocess diagnostics (libpq errors may contain connection details).
    fs.writeFileSync(path.join(privateRoot, "failure.private.txt"), `${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`, { mode: 0o600 });
    throw Error(`${path.basename(command)} failed; STOP. Private diagnostics retained; no automatic retry`);
  }
  return result.stdout;
}
const children = [];
let started = false;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 10000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  if (started) {
    const result = spawnSync(path.join(bin, "pg_ctl"), ["-D", privateRoot + "/cluster", "-m", "fast", "-w", "stop"], { env: safeEnv, encoding: "utf8", timeout: 30000 });
    save("teardown.json", { owner: "MAIN", stopStatus: result.status, destroyed: false, root: privateRoot });
  }
}
process.once("SIGINT", () => stop().finally(() => process.exit(130)));
process.once("SIGTERM", () => stop().finally(() => process.exit(143)));
function start(command, commandArgs, cwd, extra, label) {
  const log = fs.openSync(path.join(privateRoot, label + ".log"), "a", 0o600);
  const child = spawn(command, commandArgs, { cwd, env: { ...safeEnv, ...extra }, stdio: ["ignore", log, log] });
  fs.closeSync(log);
  fs.writeFileSync(path.join(privateRoot, label + ".pid"), String(child.pid), { mode: 0o600 });
  children.push(child);
  return child;
}
try {
  for (const port of Object.values(ports)) await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(own, JSON.stringify({ owner: "MAIN", root: privateRoot, port: ports.postgres }), { mode: 0o600 });
  const { default: pg } = await import(pathToFileURL(root + "/scripts/node_modules/pg/lib/index.js"));
  const client = new pg.Client({ connectionString: effective.DATABASE_URL, connectionTimeoutMillis: 5000,
    options: "-c default_transaction_read_only=on", statement_timeout: 15000 });
  let identity;
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    identity = (await client.query(`SELECT current_database() database,current_user db_user,
      inet_server_addr()::text address,inet_server_port() port,
      current_setting('server_version_num') version,pg_postmaster_start_time() started,
      current_setting('transaction_read_only') read_only`)).rows[0];
    assert.equal(identity.read_only, "on");
    assert.equal(identity.database, pgEnv.PGDATABASE);
    assert.equal(identity.db_user, pgEnv.PGUSER);
    await client.query("ROLLBACK");
  } finally { await client.end(); }
  const dumpTarget = run(path.join(bin, "psql"), ["-X", "-A", "-t", "-F", "|", "-c",
    "BEGIN READ ONLY; SELECT current_database(),current_user,coalesce(inet_server_addr()::text,''),coalesce(inet_server_port()::text,''),current_setting('server_version_num'),pg_postmaster_start_time(); ROLLBACK;"],
  root, { ...pgEnv, PGOPTIONS: "-c default_transaction_read_only=on" }).split("\n").find(line => line.startsWith(`${identity.database}|${identity.db_user}|`));
  assert.ok(dumpTarget, "libpq dump target identity differs from effective API connection");
  const [database, user, address, port, version, startedAt] = dumpTarget.split("|");
  assert.equal(database, identity.database);
  assert.equal(user, identity.db_user);
  assert.equal(address, identity.address ?? "");
  assert.equal(port, identity.port?.toString() ?? "");
  assert.equal(version, identity.version);
  assert.equal(new Date(startedAt).toISOString(), identity.started.toISOString());
  // pg_dump uses the effective server's libpq fields via environment (not argv),
  // forces read-only transactions and writes only into a 0600 private SQL file.
  const schemaFile = path.join(privateRoot, "served-schema.sql");
  const dump = run(path.join(bin, "pg_dump"), ["--schema-only", "--no-owner", "--no-acl", "--file", schemaFile],
    root, { ...pgEnv, PGOPTIONS: "-c default_transaction_read_only=on" });
  assert.equal(dump, "");
  fs.chmodSync(schemaFile, 0o600);
  const schemaHash = sha(fs.readFileSync(schemaFile));
  const files = [...new Set(run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean))]
    .filter(p => /^(artifacts|lib|scripts)\//.test(p) || /^(package.json|pnpm-lock.yaml|pnpm-workspace.yaml|tsconfig.base.json|tsconfig.json|.npmrc)$/.test(p))
    .filter(p => !/(^|\/)(node_modules|dist[^/]*|\.local)\//.test(p) && fs.existsSync(p));
  const manifest = files.map(p => ({ path: p, sha256: sha(fs.readFileSync(p)) }));
  for (const file of manifest) {
    const destination = path.join(source, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file.path), destination);
    assert.equal(sha(fs.readFileSync(destination)), file.sha256, "Source freeze mismatch");
  }
  for (const file of manifest) assert.equal(sha(fs.readFileSync(path.join(root, file.path))), file.sha256, "Concurrent source mutation: STOP");
  save("source-manifest.json", { commit: run("git", ["rev-parse", "HEAD"]).trim(), files: manifest });
  const linker = fs.readFileSync(root + "/reports/tanda-g/setup/link-frozen-dependencies.mjs", "utf8")
    .replace('root+"/.local/tanda-g/"+(process.argv[2]==="candidate"?"candidate-source":"baseline-source")', JSON.stringify(source));
  assert.ok(linker.includes(JSON.stringify(source)), "Frozen dependency linker not compatible");
  fs.writeFileSync(privateRoot + "/link.mjs", linker, { mode: 0o600 });
  run(process.execPath, [privateRoot + "/link.mjs"]);
  run(process.execPath, [source + "/artifacts/api-server/build.mjs"], source + "/artifacts/api-server", { NODE_ENV: "production" });
  run(process.execPath, [source + "/artifacts/mariana-textil/node_modules/vite/bin/vite.js", "build"],
    source + "/artifacts/mariana-textil", { NODE_ENV: "production", BASE_PATH: "/" });
  run(path.join(bin, "initdb"), ["-D", privateRoot + "/cluster", "-U", "postgres", "-A", "trust", "--no-locale", "--encoding=UTF8"]);
  fs.mkdirSync(privateRoot + "/socket");
  run(path.join(bin, "pg_ctl"), ["-D", privateRoot + "/cluster", "-l", privateRoot + "/postgres.log",
    "-o", `-p ${ports.postgres} -k ${privateRoot}/socket -h 127.0.0.1`, "-w", "start"]);
  started = true;
  for (const database of ["continue_witness", "continue_test"]) run(path.join(bin, "createdb"),
    ["-h", "127.0.0.1", "-p", String(ports.postgres), "-U", "postgres", database]);
  const witness = `postgresql://postgres@127.0.0.1:${ports.postgres}/continue_witness`;
  const test = `postgresql://postgres@127.0.0.1:${ports.postgres}/continue_test`;
  const witnessClient = new pg.Client({ connectionString: witness, connectionTimeoutMillis: 5000 });
  await witnessClient.connect();
  let witnessIdentity;
  try {
    witnessIdentity = (await witnessClient.query(`SELECT current_database() database,current_user db_user,
      inet_server_port() port,current_setting('data_directory') directory,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') public_tables`)).rows[0];
    assert.equal(witnessIdentity.database, "continue_witness");
    assert.equal(witnessIdentity.db_user, "postgres");
    assert.equal(witnessIdentity.port, ports.postgres);
    assert.equal(witnessIdentity.directory, privateRoot + "/cluster");
    assert.equal(witnessIdentity.public_tables, 0, "Witness must remain empty");
  } finally { await witnessClient.end(); }
  run(path.join(bin, "psql"), ["-X", "-v", "ON_ERROR_STOP=1", "-1", "-h", "127.0.0.1",
    "-p", String(ports.postgres), "-U", "postgres", "-d", "continue_test", "-f", schemaFile]);
  const password = randomBytes(24).toString("hex");
  // prepare-test-database pushes schema again and is inappropriate on an exact
  // pg_dump restore: run its canonical seed step only. Seed's single target is
  // continue_test; never set TEST_DATABASE_URL equal to DATABASE_URL.
  run("pnpm", ["--filter", "@workspace/db", "run", "seed"], source,
    { DATABASE_URL: test, ADMIN_SEED_PASSWORD: password });
  const copy = new pg.Client({ connectionString: test, connectionTimeoutMillis: 5000 });
  await copy.connect();
  let disposableIdentity;
  try {
    disposableIdentity = (await copy.query(`SELECT current_database() database,current_user db_user,
      inet_server_addr()::text address,inet_server_port() port,current_setting('data_directory') directory,
      pg_postmaster_start_time() started,
      (SELECT count(*)::int FROM usuarios WHERE usuario='admin' AND rol='ADMIN' AND activo) admin_count,
      (SELECT count(*)::int FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O') e5_closed,
      (SELECT count(*)::int FROM pg_trigger WHERE tgname='e11_closed' AND tgenabled='O') e11_closed`)).rows[0];
    assert.equal(disposableIdentity.database, "continue_test");
    assert.equal(disposableIdentity.db_user, "postgres");
    assert.equal(disposableIdentity.port, ports.postgres);
    assert.equal(disposableIdentity.directory, privateRoot + "/cluster");
    assert.notEqual(disposableIdentity.database, witnessIdentity.database);
    assert.equal(disposableIdentity.admin_count, 1);
    // Refund remains closed; don't force E5/E11 flags or assume historic count.
    const refund = (await copy.query(`SELECT count(*)::int n FROM pg_trigger
      WHERE tgname='e5_closed' AND tgenabled='O'
        AND tgrelid IN ('e5_devoluciones'::regclass,'e5_salidas_bancarias'::regclass)`)).rows[0].n;
    assert.equal(refund, 2, "Refund closures absent: STOP");
  } finally { await copy.end(); }
  if (args.includes("--annual-db")) {
    // Optional isolated, canonical-seed-only database. No annual rows loaded;
    // MAIN can load approved synthetic data after readiness without contaminating E2E.
    run(path.join(bin, "createdb"), ["-h", "127.0.0.1", "-p", String(ports.postgres),
      "-U", "postgres", "-T", "continue_test", "continue_annual"]);
  }
  fs.writeFileSync(privateRoot + "/credentials.json", JSON.stringify({ admin: { username: "admin", password } }), { mode: 0o600 });
  // Match actual served development boot: import auto-starts once in
  // inspection mode. Explicit startServer in NODE_ENV=test would run
  // initializers against restored tables (CheckTableNotInUse) and is unsafe.
  fs.writeFileSync(privateRoot + "/api.mjs", `
if (process.env.NODE_ENV !== "development" || process.env.API_INSPECTION_BOOT !== "1" ||
    process.env.DATABASE_URL !== ${JSON.stringify(test)} ||
    process.env.APPLICATION_DATABASE_URL !== ${JSON.stringify(witness)} ||
    process.env.TEST_DATABASE_URL || process.env.REQUIRE_ISOLATED_TEST_DATABASE) {
  throw Error("Disposable inspection boot identity mismatch");
}
await import(${JSON.stringify(pathToFileURL(source + "/artifacts/api-server/dist/index.mjs").href)});
`, { mode: 0o600 });
  const api = start(process.execPath, [privateRoot + "/api.mjs"], source,
    { NODE_ENV: "development", API_INSPECTION_BOOT: "1",
      DATABASE_URL: test, APPLICATION_DATABASE_URL: witness,
      PORT: String(ports.api), SESSION_SECRET: randomBytes(32).toString("hex") }, "api");
  await new Promise(resolve => setTimeout(resolve, 12000));
  assert.equal(api.exitCode, null, "API exited; STOP");
  const health = await fetch(`http://127.0.0.1:${ports.api}/api/healthz`, { signal: AbortSignal.timeout(5000) });
  assert.equal(health.status, 200, "API health failure; STOP");
  const post = new pg.Client({ connectionString: test, connectionTimeoutMillis: 5000 });
  await post.connect();
  try {
    const state = (await post.query(`SELECT current_database() database,inet_server_port() port,
      current_setting('data_directory') directory,
      (SELECT count(*)::int FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O'
        AND tgrelid IN ('e5_devoluciones'::regclass,'e5_salidas_bancarias'::regclass)) refund_closed`)).rows[0];
    assert.equal(state.database, "continue_test");
    assert.equal(state.port, ports.postgres);
    assert.equal(state.directory, privateRoot + "/cluster");
    assert.equal(state.refund_closed, 2, "Startup opened refund guard unexpectedly: STOP");
  } finally { await post.end(); }
  // Inspection startup must not run DDL. Record a second private schema dump
  // without copying data or emitting schema SQL into reports.
  const afterFile = path.join(privateRoot, "after-startup-schema.sql");
  run(path.join(bin, "pg_dump"), ["-h", "127.0.0.1", "-p", String(ports.postgres),
    "-U", "postgres", "-d", "continue_test", "--schema-only", "--no-owner", "--no-acl", "--file", afterFile]);
  fs.chmodSync(afterFile, 0o600);
  fs.copyFileSync(root + "/reports/tanda-h/continuacion/setup/proxy.mjs", privateRoot + "/proxy.mjs");
  const ui = start(process.execPath, [privateRoot + "/proxy.mjs"], source,
    { STATIC_ROOT: source + "/artifacts/mariana-textil/dist/public", PROXY_PORT: String(ports.ui), API_PORT: String(ports.api) }, "ui");
  save("schema-provenance.json", {
    origin: "served API effective DATABASE_URL via explicitly selected PID; read-only identity and pg_dump --schema-only; zero application rows",
    servedPid: apiPid, servedBundle: bundle, servedIdentity: identity,
    schemaSha256: schemaHash, startupSchemaSha256: sha(fs.readFileSync(afterFile)),
    restoredInto: disposableIdentity, witnessIdentity, canonicalSeed: true, schemaPushSkipped: true,
    apiBoot: "NODE_ENV=development API_INSPECTION_BOOT=1; no initializer, backfill or stock monitor",
    annual: args.includes("--annual-db") ? "continue_annual (separate, unpopulated annual dataset)" : "not created",
  });
  save("ready.json", {
    owner: "MAIN", state: "READY_FOR_VERIFICATION_NOT_TESTED", origin: `http://127.0.0.1:${ports.ui}`,
    apiOrigin: `http://127.0.0.1:${ports.api}`, postgresPort: ports.postgres,
    testDatabase: "continue_test", witnessDatabase: "continue_witness",
    annualDatabase: args.includes("--annual-db") ? "continue_annual" : null,
    annualDatasetLoaded: false,
    annualLoadPhase: args.includes("--annual-db") ? "MAIN-only later exclusive phase; no fixture load into continue_test" : null,
    apiBoot: "development inspection (no startup initializers/backfill/monitor)",
    apiPid: api.pid, uiPid: ui.pid, credentials: "private.local/roll-return-continuation/credentials.json",
    schemaProvenance: "reports/continuacion-rollos-20260925/preparation/schema-provenance.json",
    flagsForced: [], applicationRowsCopied: false,
  });
  console.log("READY: reports/continuacion-rollos-20260925/preparation/ready.json; MAIN owns foreground process. Ctrl-C stops; --destroy after shutdown removes private root.");
  await new Promise((resolve, reject) => {
    for (const child of children) child.once("exit", () => reject(Error("Owned process exited; STOP")));
  });
} finally { await stop(); }