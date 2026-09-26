import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
import { initializeAuxiliary } from "./initialize-auxiliary.mjs";

const dir = "/tmp/scanner-e2e-isolated";
const report = path.resolve("reports/auditoria-colaborativa/browser-live");
const configPath = path.resolve(process.argv[2] || `${report}/candidate.json`);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const hashFile = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (!path.isAbsolute(config.apiEntry) || !path.isAbsolute(config.frontendRoot))
  throw Error("Candidate paths must be absolute");
if (hashFile(config.apiEntry) !== config.apiSha256) throw Error("API fingerprint mismatch");
if (!config.frontendFiles?.["index.html"]) throw Error("Complete frontend fingerprint manifest required");
for (const [file, hash] of Object.entries(config.frontendFiles)) {
  if (file.includes("..") || path.isAbsolute(file) ||
      hashFile(path.join(config.frontendRoot, file)) !== hash) throw Error("Frontend fingerprint mismatch");
}
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item =>
  item.isDirectory() ? walk(path.join(directory, item.name)) : [path.join(directory, item.name)]);
for (const file of walk(config.frontendRoot)) {
  if (!config.frontendFiles[path.relative(config.frontendRoot, file)])
    throw Error("Unfingerprinted frontend asset rejected");
}
const secrets = JSON.parse(fs.readFileSync(`${dir}/test-env.json`, "utf8"));
const url = new URL(secrets.TEST_DATABASE_URL);
const live = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/scanner_collab_e2e_20260926" ||
    url.hostname.replace("-pooler", "") === live.hostname.replace("-pooler", ""))
  throw Error("Launch database isolation guard failed");
const pool = new pg.Pool({ connectionString: url.href });
const identity = (await pool.query("SELECT current_database() AS database")).rows[0];
if (identity.database !== "scanner_collab_e2e_20260926") throw Error("Database mismatch");
const apiPort = 18127;
const webPort = 18128;
const log = fs.openSync(`${dir}/private-api.log`, "a", 0o600);
// Explicit allowlist: no live database, PG variables, runtime flags, application secrets,
// startup inspection overrides, or Replit proxy configuration reach the private process.
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG || "C.UTF-8",
  NODE_ENV: "development", DATABASE_URL: url.href, PORT: String(apiPort),
  API_STARTUP_MODE: "NORMAL", API_INSPECTION_BOOT: "1", DB_POOL_MAX: "12",
};
const comparator = new URL(url.href);
comparator.pathname = "/scanner_collab_guard_20260926";
const resume = process.argv.includes("--resume-verified");
let sqlFingerprints;
if (resume) {
  const prior = JSON.parse(fs.readFileSync(path.join(report, "private-ready.json")));
  const initialized = JSON.parse(fs.readFileSync(path.join(report, "candidate-initialized.json")));
  const provenance = JSON.parse(fs.readFileSync("reports/auditoria-colaborativa/final/provenance.json"));
  const parentEntry = path.resolve("artifacts/api-server/dist-auditoria-colaborativa-pisos-20260925/index.mjs");
  if (prior.status !== "READY" || prior.database !== identity.database ||
      initialized.database !== identity.database || initialized.apiSha256 !== prior.apiSha256 ||
      hashFile(parentEntry) !== prior.apiSha256 || provenance.ddl !== "none" ||
      JSON.stringify(provenance.apiSourceDeltas) !== JSON.stringify(["artifacts/api-server/src/routes/auditorias-inventario.ts"]))
    throw Error("Restart provenance/initialization evidence rejected");
  const before = JSON.parse(fs.readFileSync(`${parentEntry}.map`));
  const after = JSON.parse(fs.readFileSync(`${config.apiEntry}.map`));
  if (JSON.stringify(before.sources) !== JSON.stringify(after.sources)) throw Error("Candidate source graph changed");
  const changed = before.sources.filter((name, i) => {
    if (name.endsWith("/pino/pino.js")) {
      const expected = before.sourcesContent[i].replace(
        JSON.stringify(path.dirname(parentEntry)), JSON.stringify(path.dirname(config.apiEntry)));
      if (expected !== after.sourcesContent[i]) throw Error("Unexpected pino worker bootstrap delta");
      return false;
    }
    return before.sourcesContent[i] !== after.sourcesContent[i];
  });
  if (JSON.stringify(changed) !== JSON.stringify(["../src/routes/auditorias-inventario.ts"]))
    throw Error("Restart only allows verified audit router delta");
  await pool.query("BEGIN READ ONLY");
  try {
    const required = (await pool.query(
      `SELECT current_database() AS database,
       to_regclass('public.e11_perfiles') AS e11,to_regprocedure('public.e11_graph()') AS graph,
       to_regclass('public.auditoria_inventario_participantes') AS participants,
       (SELECT count(*)::int FROM usuarios WHERE usuario LIKE 'e2e.scanner.%') AS scanners,
       (SELECT count(*)::int FROM auditorias_inventario WHERE id=1 AND estado='CERRADA') AS preserved_closed`
    )).rows[0];
    if (required.database !== identity.database || !required.e11 || !required.graph ||
        !required.participants || required.scanners !== 6 || required.preserved_closed !== 1)
      throw Error("Existing disposable schema/history verification failed");
    await pool.query("COMMIT");
    fs.writeFileSync(path.join(report, "restart-verification.json"), JSON.stringify({
      ...required, previousApiSha256: prior.apiSha256, apiSha256: config.apiSha256,
      unchangedInitializerSources: true, changedSources: changed,
      reseed: false, reinitialize: false, reset: false, checkedAt: new Date().toISOString(),
    }, null, 2));
    fs.copyFileSync(path.join(report, "private-ready.json"), path.join(report, "private-ready-before-permission-fix.json"));
    sqlFingerprints = prior.sqlFingerprints;
  } catch (error) { await pool.query("ROLLBACK"); throw error; }
} else {
const init = spawn(process.execPath, [path.join(report, "initialize-candidate.mjs"), configPath], {
  cwd: process.cwd(), env: {
    ...env, NODE_ENV: "test", DATABASE_URL: comparator.href,
    TEST_DATABASE_URL: url.href, TEST_DATABASE_PREPARATION_PHASE: "initializers",
  }, stdio: ["ignore", log, log],
});
const initStatus = await new Promise((resolve, reject) => {
  init.once("error", reject); init.once("exit", resolve);
});
if (initStatus !== 0) {
  fs.closeSync(log);
  await pool.end();
  throw Error("Exact candidate initializers failed; restricted initializer-error.txt has structured details");
}
try { sqlFingerprints = await initializeAuxiliary(pool); }
catch (error) {
  fs.writeFileSync(`${dir}/auxiliary-error.txt`, String(error.stack), { mode: 0o600 });
  fs.closeSync(log);
  await pool.end();
  throw Error("Auxiliary initialization failed; restricted auxiliary-error.txt has details");
}
}
const child = spawn(process.execPath, [path.join(report, "api-bootstrap.mjs"), configPath], {
  cwd: process.cwd(), env, stdio: ["ignore", log, log],
});
fs.closeSync(log);
let proxy;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  proxy?.close();
  child.kill("SIGTERM");
  await pool.end();
  setTimeout(() => { child.kill("SIGKILL"); process.exit(code); }, 2500);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
child.on("exit", () => { if (!stopping) shutdown(1); });
fs.writeFileSync(`${dir}/pids.json`, JSON.stringify({ launcher: process.pid, api: child.pid }), { mode: 0o600 });
try {
  let ready = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (child.exitCode !== null) throw Error("Private API exited before startup completion");
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/healthz`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw Error("Private API inspection startup timed out");
  const effective = JSON.parse(fs.readFileSync(path.join(report, "api-process-identity.json")));
  if (effective.database !== identity.database || effective.pid !== child.pid ||
      effective.apiSha256 !== config.apiSha256) throw Error("Actual API process identity mismatch");
  const credentials = JSON.parse(fs.readFileSync(`${dir}/credentials.json`, "utf8"));
  const loginResults = [];
  for (const actor of [credentials.admin, ...credentials.users]) {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ usuario: actor.usuario, password: actor.password }),
    });
    if (!response.ok) throw Error(`Isolated login failed: ${actor.usuario}, HTTP ${response.status}`);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw Error("Isolated login did not issue session cookie");
    const me = await fetch(`http://127.0.0.1:${apiPort}/api/auth/me`, { headers: { cookie } });
    if (!me.ok) throw Error("Authenticated session validation failed");
    await fetch(`http://127.0.0.1:${apiPort}/api/auth/logout`, { method: "POST", headers: { cookie } });
    loginResults.push({ usuario: actor.usuario, login: response.status, authenticatedMe: me.status });
  }
  const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
    ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
  proxy = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://127.0.0.1:${webPort}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      const upstream = http.request({
        hostname: "127.0.0.1", port: apiPort, method: req.method,
        path: requestUrl.pathname + requestUrl.search,
        headers: { ...req.headers, host: `127.0.0.1:${apiPort}`, "x-forwarded-for": "127.0.0.1" },
      }, incoming => { res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res); });
      upstream.on("error", () => { res.writeHead(502); res.end("Private API unavailable"); });
      req.pipe(upstream);
      return;
    }
    try {
      let file = decodeURIComponent(requestUrl.pathname).slice(1);
      if (!file || !path.extname(file)) file = "index.html";
      if (!Object.hasOwn(config.frontendFiles, file)) { res.writeHead(404); res.end("Not found"); return; }
      const bytes = fs.readFileSync(path.join(config.frontendRoot, file));
      if (crypto.createHash("sha256").update(bytes).digest("hex") !== config.frontendFiles[file])
        throw Error("Candidate asset changed after verification");
      res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(bytes);
    } catch { res.writeHead(500); res.end("Private candidate asset verification failed"); }
  });
  await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(webPort, "127.0.0.1", resolve); });
  const count = (await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count;
  fs.writeFileSync(path.join(report, "private-ready.json"), JSON.stringify({
    status: "READY", database: identity.database, apiSha256: config.apiSha256,
    frontendFiles: config.frontendFiles, apiPid: child.pid, launcherPid: process.pid,
    url: `http://127.0.0.1:${webPort}`, apiUrl: `http://127.0.0.1:${apiPort}`,
    publicTables: count, loginResults, sqlFingerprints, startupMode: "INSPECTION",
    initializedFromExactCandidate: true,
    checkedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`PRIVATE_READY http://127.0.0.1:${webPort}; evidence ${report}/private-ready.json`);
} catch (error) {
  fs.writeFileSync(`${dir}/launch-error.txt`, String(error.stack), { mode: 0o600 });
  console.error("Private launch failed; restricted details in /tmp/scanner-e2e-isolated/launch-error.txt");
  await shutdown(1);
}