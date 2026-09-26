import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import pg from "../../../../lib/db/node_modules/pg/lib/index.js";
const dir = "/tmp/release-owner-20260926/release_login_20260926";
const report = path.resolve("reports/release-owner-20260926/infra/login");
const config = JSON.parse(fs.readFileSync(`${report}/candidate.json`));
const recoveryHeaders = {
  "x-priority-clock": "system",
  "x-priority-api-sha256": config.apiSha256,
  "x-priority-ui-sha256": config.frontendFiles["index.html"],
};
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (hash(config.apiEntry) !== config.apiSha256) throw Error("API hash mismatch");
for (const [file, expected] of Object.entries(config.frontendFiles)) {
  if (path.isAbsolute(file) || file.includes("..") ||
      hash(path.join(config.frontendRoot, file)) !== expected) throw Error("UI hash mismatch");
}
const url = new URL(JSON.parse(fs.readFileSync(`${dir}/test-env.json`)).TEST_DATABASE_URL);
const live = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/release_login_20260926" || url.hostname.replace("-pooler", "") === live.hostname.replace("-pooler", ""))
  throw Error("Isolation rejected");
const pool = new pg.Pool({ connectionString: url.href });
if ((await pool.query("SELECT current_database() db")).rows[0].db !== "release_login_20260926") throw Error("Identity rejected");
const apiPort = 18227, webPort = 18228;
const fd = fs.openSync(`${dir}/private-api.log`, "a", 0o600);
const child = spawn(process.execPath, [`${report}/api-bootstrap.mjs`], {
  cwd: process.cwd(), stdio: ["ignore", fd, fd], env: {
    PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8", NODE_ENV: "development",
    DATABASE_URL: url.href, PORT: String(apiPort), DB_POOL_MAX: "12",
    API_STARTUP_MODE: "NORMAL", API_INSPECTION_BOOT: "1",
  },
});
fs.closeSync(fd);
let proxy, stopping = false;
async function stop(code = 0) {
  if (stopping) return; stopping = true; proxy?.close(); child.kill("SIGTERM");
  await pool.end(); setTimeout(() => { child.kill("SIGKILL"); process.exit(code); }, 2000);
}
process.on("SIGTERM", () => stop()); process.on("SIGINT", () => stop());
child.on("exit", () => { if (!stopping) stop(1); });
fs.writeFileSync(`${dir}/pids.json`, JSON.stringify({ launcher: process.pid, api: child.pid }), { mode: 0o600 });
try {
  let ready = false;
  for (let i = 0; i < 240; i++) {
    if (child.exitCode !== null) throw Error("API exited");
    try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/healthz`)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!ready) throw Error("API startup timed out");
  const identity = JSON.parse(fs.readFileSync(`${report}/api-process-identity.json`));
  if (identity.pid !== child.pid || identity.apiSha256 !== config.apiSha256) throw Error("Process identity mismatch");
  const actor = JSON.parse(fs.readFileSync(`${dir}/credentials.json`)).admin;
  const login = await fetch(`http://127.0.0.1:${apiPort}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ usuario: actor.usuario, password: actor.password }),
  });
  if (!login.ok) throw Error(`Private admin login failed ${login.status}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  const me = await fetch(`http://127.0.0.1:${apiPort}/api/auth/me`, { headers: { cookie } });
  if (!me.ok) throw Error("Real session failed");
  await fetch(`http://127.0.0.1:${apiPort}/api/auth/logout`, { method: "POST", headers: { cookie } });
  const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ogg": "audio/ogg" };
  proxy = http.createServer((req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${webPort}`);
    if (u.pathname.startsWith("/api/")) {
      const upstream = http.request({ hostname: "127.0.0.1", port: apiPort, method: req.method,
        path: u.pathname + u.search, headers: { ...req.headers, host: `127.0.0.1:${apiPort}`, "x-forwarded-for": "127.0.0.1" } },
      incoming => { res.writeHead(incoming.statusCode, { ...incoming.headers, ...recoveryHeaders }); incoming.pipe(res); });
      upstream.on("error", () => { res.writeHead(502); res.end("Private API unavailable"); });
      req.pipe(upstream); return;
    }
    try {
      let file = decodeURIComponent(u.pathname).slice(1);
      if (!file || !path.extname(file)) file = "index.html";
      if (!Object.hasOwn(config.frontendFiles, file)) { res.writeHead(404); res.end(); return; }
      const full = path.join(config.frontendRoot, file);
      if (hash(full) !== config.frontendFiles[file]) throw Error("UI changed");
      res.writeHead(200, { ...recoveryHeaders, "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(fs.readFileSync(full));
    } catch { res.writeHead(500); res.end("Candidate verification failed"); }
  });
  await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(webPort, "127.0.0.1", resolve); });
  fs.writeFileSync(`${report}/private-ready.json`, JSON.stringify({
    status: "READY", ...identity, launcherPid: process.pid,
    url: `http://127.0.0.1:${webPort}`, apiUrl: `http://127.0.0.1:${apiPort}`,
    frontendRoot: config.frontendRoot, loginStatus: login.status, meStatus: me.status,
    noInitializers: true, noPoller: true,
  }, null, 2));
  console.log(`PRIVATE_READY http://127.0.0.1:${webPort}`);
} catch (error) {
  fs.writeFileSync(`${dir}/launch-error.txt`, String(error.stack), { mode: 0o600 });
  console.error("Private startup failed; inspect restricted launch-error.txt"); await stop(1);
}