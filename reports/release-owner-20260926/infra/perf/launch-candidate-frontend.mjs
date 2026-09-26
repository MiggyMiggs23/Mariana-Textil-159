import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";

// Frontend-only companion: never spawns, stops, or reconfigures the existing API.
const report = path.resolve("reports/release-owner-20260926/infra/perf");
const manifestPath = path.resolve("reports/priority-20260926/credit-presentation/candidate.json");
const config = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const identity = JSON.parse(fs.readFileSync(`${report}/api-process-identity.json`, "utf8"));
const expectedUi = "af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5";
const apiPort = 18237, webPort = 18239;
if (identity.pid !== 1540) throw Error("Expected existing performance API PID 1540");
process.kill(identity.pid, 0);
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (config.frontendFiles["index.html"] !== expectedUi) throw Error("Candidate index identity mismatch");
for (const [file, expected] of Object.entries(config.frontendFiles)) {
  if (path.isAbsolute(file) || file.includes("..") ||
      hash(path.join(config.frontendRoot, file)) !== expected) throw Error("Candidate file verification failed");
}
const headers = {
  "x-priority-clock": "system",
  "x-priority-api-sha256": identity.apiSha256,
  "x-priority-ui-sha256": expectedUi,
};
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".ogg": "audio/ogg", ".txt": "text/plain" };
const proxy = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, `http://127.0.0.1:${webPort}`); }
  catch { res.writeHead(400); res.end("Invalid request URL"); return; }
  if (u.pathname.startsWith("/api/")) {
    const upstream = http.request({
      hostname: "127.0.0.1", port: apiPort, method: req.method,
      path: u.pathname + u.search,
      headers: { ...req.headers, host: `127.0.0.1:${apiPort}`, "x-forwarded-for": "127.0.0.1" },
    }, incoming => {
      res.writeHead(incoming.statusCode, { ...incoming.headers, ...headers });
      incoming.pipe(res);
      incoming.on("error", () => res.destroy());
    });
    upstream.on("error", () => {
      if (!res.headersSent) { res.writeHead(502); res.end("Existing performance API unavailable"); }
      else res.destroy();
    });
    req.on("aborted", () => upstream.destroy());
    req.pipe(upstream);
    return;
  }
  try {
    let file = decodeURIComponent(u.pathname).slice(1);
    if (!file || !path.extname(file)) file = "index.html";
    if (!Object.hasOwn(config.frontendFiles, file)) { res.writeHead(404); res.end(); return; }
    const full = path.join(config.frontendRoot, file);
    if (hash(full) !== config.frontendFiles[file]) throw Error("Candidate file changed");
    res.writeHead(200, { ...headers, "content-type": mime[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store" });
    res.end(fs.readFileSync(full));
  } catch { res.writeHead(500); res.end("Candidate verification failed"); }
});
await new Promise((resolve, reject) => {
  proxy.once("error", reject);
  proxy.listen(webPort, "127.0.0.1", resolve);
});
fs.writeFileSync(`${report}/candidate-frontend-ready.json`, JSON.stringify({
  status: "FRONTEND_PROXY_LISTENING", proxyPid: process.pid, existingApiPid: identity.pid,
  apiUrl: `http://127.0.0.1:${apiPort}`, url: `http://127.0.0.1:${webPort}`,
  apiSha256: identity.apiSha256, frontendIndexSha256: expectedUi, manifestPath,
  change: "Browser origin/frontend only; same existing API and database; no restart or warmup requests",
}, null, 2));
const stop = () => proxy.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
console.log(`CANDIDATE_FRONTEND_READY http://127.0.0.1:${webPort} SAME_API_PID ${identity.pid}`);