// Preparation only: the owning agent must explicitly execute this foreground runner.
// No inherited database URL, release flags, application credentials or clock overrides.
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const report = path.join(root, "reports/trabajo-nocturno-20260925/tarea-5");
const privateRoot = path.join(root, "private.local/night-t56");
const source = path.join(privateRoot, "source");
const ports = { postgres: 55526, api: 43926, ui: 43927 };
const pgBin = process.env.NIGHT_PG_BIN;
if (!process.argv.includes("--execute")) {
  console.log("PREPARED ONLY. Owner: night-task56-browser. Execute with NIGHT_PG_BIN=/absolute/postgres/bin node reports/trabajo-nocturno-20260925/tarea-5/runner.mjs --execute");
  process.exit(0);
}
if (!pgBin || !fs.existsSync(path.join(pgBin, "initdb"))) throw Error("NIGHT_PG_BIN must identify installed PostgreSQL binaries");
if (fs.existsSync(privateRoot)) throw Error("Prior run exists: STOP; preserve evidence, never resume clock or overwrite");
for (const port of Object.values(ports)) {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(port, "127.0.0.1", () => s.close(resolve));
  });
}
fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
const env = { PATH: process.env.PATH, HOME: privateRoot, LANG: "C.UTF-8" };
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const save = (name, data) => fs.writeFileSync(path.join(report, name), JSON.stringify(data, null, 2));
function run(cmd, args, cwd = root, extra = {}) {
  const result = spawnSync(cmd, args, { cwd, env: { ...env, ...extra }, encoding: "utf8", timeout: 240000, maxBuffer: 32e6 });
  if (result.status !== 0) {
    fs.writeFileSync(path.join(privateRoot, "failure.txt"), `${result.error || ""}\n${result.stdout}\n${result.stderr}`, { mode: 0o600 });
    throw Error(`${path.basename(cmd)} failed; STOP without retries; private diagnostics preserved`);
  }
  return result.stdout;
}
const children = [];
let clusterStarted = false;
let stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 10000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  if (clusterStarted) {
    const stopped = spawnSync(path.join(pgBin, "pg_ctl"), ["-D", privateRoot + "/cluster", "-m", "fast", "-w", "stop"], { env, encoding: "utf8" });
    save("teardown.json", { stopStatus: stopped.status, retainedDirectory: privateRoot, deleted: false });
  }
}
process.once("SIGINT", () => cleanup().finally(() => process.exit(130)));
process.once("SIGTERM", () => cleanup().finally(() => process.exit(143)));
function start(command, args, cwd, extra, label) {
  const log = fs.openSync(`${privateRoot}/${label}.log`, "a", 0o600);
  const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: ["ignore", log, log] });
  fs.closeSync(log);
  children.push(child);
  return child;
}
try {
  // Include current tracked candidate changes; fail on concurrent mutation.
  const files = [...new Set(run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean))].filter(p =>
    /^(artifacts|lib|scripts)\//.test(p) || /^(package.json|pnpm-lock.yaml|pnpm-workspace.yaml|tsconfig.base.json|tsconfig.json|.npmrc)$/.test(p)
  ).filter(p => !/(^|\/)(node_modules|dist[^/]*|\.local)\//.test(p) && fs.existsSync(p));
  const manifest = files.map(p => ({ path: p, sha256: hash(p) }));
  for (const file of manifest) {
    const destination = path.join(source, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file.path), destination);
    if (hash(destination) !== file.sha256 || hash(path.join(root, file.path)) !== file.sha256) throw Error("Source changed during freeze");
  }
  if (manifest.some(file => hash(path.join(root, file.path)) !== file.sha256)) throw Error("Concurrent source mutation detected after freeze; STOP");
  save("source-manifest.json", { commit: run("git", ["rev-parse", "HEAD"]).trim(), files: manifest });
  // Existing proven dependency linker, retargeted only in the private copy.
  const linker = fs.readFileSync(root + "/reports/tanda-g/setup/link-frozen-dependencies.mjs", "utf8")
    .replace('root+"/.local/tanda-g/"+(process.argv[2]==="candidate"?"candidate-source":"baseline-source")', JSON.stringify(source));
  fs.writeFileSync(privateRoot + "/link.mjs", linker);
  run(process.execPath, [privateRoot + "/link.mjs"]);
  run(process.execPath, [source + "/artifacts/api-server/build.mjs"], source + "/artifacts/api-server", { NODE_ENV: "production" });
  run(process.execPath, [source + "/artifacts/mariana-textil/node_modules/vite/bin/vite.js", "build"], source + "/artifacts/mariana-textil", { NODE_ENV: "production", BASE_PATH: "/" });
  run(path.join(pgBin, "initdb"), ["-D", privateRoot + "/cluster", "-U", "postgres", "-A", "trust", "--no-locale", "--encoding=UTF8"]);
  fs.mkdirSync(privateRoot + "/socket");
  run(path.join(pgBin, "pg_ctl"), ["-D", privateRoot + "/cluster", "-l", privateRoot + "/postgres.log", "-o", `-p ${ports.postgres} -k ${privateRoot}/socket -h 127.0.0.1`, "-w", "start"]);
  clusterStarted = true;
  for (const database of ["night56_witness", "night56_test"]) run(path.join(pgBin, "createdb"), ["-h", "127.0.0.1", "-p", String(ports.postgres), "-U", "postgres", database]);
  const witness = `postgresql://postgres@127.0.0.1:${ports.postgres}/night56_witness`;
  const test = `postgresql://postgres@127.0.0.1:${ports.postgres}/night56_test`;
  const password = randomBytes(24).toString("hex");
  const dbEnv = { DATABASE_URL: witness, APPLICATION_DATABASE_URL: witness, TEST_DATABASE_URL: test, REQUIRE_ISOLATED_TEST_DATABASE: "1", ADMIN_SEED_PASSWORD: password };
  run(process.execPath, [source + "/lib/db/src/prepare-test-database.mjs"], source, dbEnv);
  const { default: pg } = await import(pathToFileURL(root + "/scripts/node_modules/pg/lib/index.js"));
  const client = new pg.Client({ connectionString: test, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const identity = (await client.query("select current_database() database,current_user db_user,inet_server_addr() address,inet_server_port() port,current_setting('data_directory') directory,pg_postmaster_start_time() started")).rows[0];
    if (identity.database !== "night56_test" || identity.port !== ports.postgres || identity.directory !== privateRoot + "/cluster") throw Error("Effective identity mismatch");
    save("ownership.json", { owner: "night-task56-browser", ports, source, identity, clock: "real wall clock; no replay or reset", applicationDbAccess: false, forcedReleaseFlags: [] });
  } finally { await client.end(); }
  const dump = () => run(path.join(pgBin, "pg_dump"), ["-h", "127.0.0.1", "-p", String(ports.postgres), "-U", "postgres", "-d", "night56_test", "--schema-only", "--no-owner", "--no-acl"]);
  fs.writeFileSync(report + "/schema-before-startup.sql", dump());
  fs.writeFileSync(privateRoot + "/credentials.json", JSON.stringify({ admin: { username: "admin", password } }), { mode: 0o600 });
  // Normal startup runs the candidate's exact DDL/backfills on the disposable DB.
  // NODE_ENV=test suppresses auto-start; explicit startServer preserves isolation.
  fs.writeFileSync(privateRoot + "/api.mjs", `const api=await import(${JSON.stringify(pathToFileURL(source + "/artifacts/api-server/dist/index.mjs").href)}); await api.startServer();`);
  const api = start(process.execPath, [privateRoot + "/api.mjs"], source, { ...dbEnv, NODE_ENV: "test", PORT: String(ports.api), SESSION_SECRET: randomBytes(32).toString("hex") }, "api");
  // Single bounded wait, not a restart/reconnect loop.
  await new Promise(resolve => setTimeout(resolve, 12000));
  if (api.exitCode !== null) throw Error("API terminated during startup; STOP");
  const health = await fetch(`http://127.0.0.1:${ports.api}/api/healthz`, { signal: AbortSignal.timeout(5000) });
  if (health.status !== 200) throw Error(`Healthz ${health.status}; STOP`);
  fs.writeFileSync(report + "/schema-after-startup.sql", dump());
  fs.copyFileSync(root + "/reports/tanda-h/continuacion/setup/proxy.mjs", privateRoot + "/proxy.mjs");
  start(process.execPath, [privateRoot + "/proxy.mjs"], source, { STATIC_ROOT: source + "/artifacts/mariana-textil/dist/public", PROXY_PORT: String(ports.ui), API_PORT: String(ports.api) }, "ui");
  save("ready.json", { healthz: health.status, origin: `http://127.0.0.1:${ports.ui}`, state: "READY_FOR_BROWSER_NOT_TESTED", apiPid: api.pid, forcedFlags: [], credentials: "private.local/night-t56/credentials.json", note: "No app database discovery, dump, auth or identities. Canonical seed only." });
  console.log("Disposable ready. Run browser-smoke.mjs in another shell. Ctrl-C performs owned teardown. No reconnect/restart.");
  await new Promise((resolve, reject) => {
    for (const child of children) child.once("exit", () => reject(Error("Owned process disconnected; STOP")));
  });
} finally { await cleanup(); }