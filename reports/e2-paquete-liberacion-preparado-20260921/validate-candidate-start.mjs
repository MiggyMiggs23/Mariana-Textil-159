// For the owning agent to execute: real candidate start, fresh local DB only.
// Not run by the implementation subagent.
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readCatalog, hash } from "./release-preflight.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(directory, "../..");
const fixture = process.argv[2];
const control = process.argv[3] === "--control";
if (process.argv[3] && !control) throw new Error("Unknown startup trial selector.");
const bundleDirectory = control ? "dist-e2-control-7cb77f8-20260927" : "dist-e2-20260927";
if (!fixture?.startsWith("/tmp/e2-release-preparation-")) throw new Error("Isolated empty fixture required.");
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.PGPASSWORD) throw new Error("Inherited DB settings forbidden.");
const base = fs.mkdtempSync("/tmp/e2-candidate-start-");
fs.chmodSync(base, 0o700);
const socket = path.join(base, "socket");
const runRoot = path.join(base, "run");
fs.mkdirSync(socket);
fs.mkdirSync(path.join(runRoot, "reports"), { recursive: true });
fs.mkdirSync(path.join(runRoot, "artifacts/api-server"), { recursive: true });
if (!control) fs.symlinkSync(directory, path.join(runRoot, "reports/e2-paquete-liberacion-preparado-20260921"));
fs.symlinkSync(path.join(workspace, "artifacts/api-server", bundleDirectory),
  path.join(runRoot, "artifacts/api-server", bundleDirectory));
// Control uses the same wrapper/gates and B1 fixture. Only its bundle paths and
// immutable hashes differ; source revision and trial evidence remain separate.
if (control) {
  const packagePath = "reports/e2-paquete-liberacion-preparado-20260921";
  const originalManifest = fs.readFileSync(path.join(directory, "release-assets.sha256"), "utf8");
  const files = originalManifest.trim().split("\n").map(line => line.slice(66));
  const rows = [];
  for (const original of files) {
    const relative = original.replaceAll("dist-e2-20260927", bundleDirectory);
    const destination = path.join(runRoot, relative);
    if (!original.startsWith("artifacts/")) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(workspace, original), destination);
      if (original.endsWith("/api-start-audit-record.mjs")) {
        fs.writeFileSync(destination, fs.readFileSync(destination, "utf8").replaceAll("dist-e2-20260927", bundleDirectory));
      }
    }
    rows.push(`${createHash("sha256").update(fs.readFileSync(destination)).digest("hex")}  ${relative}`);
  }
  const manifest = rows.join("\n") + "\n";
  fs.writeFileSync(path.join(runRoot, packagePath, "release-assets.sha256"), manifest);
  const wrapper = fs.readFileSync(path.join(directory, "api-start-audit.sh"), "utf8")
    .replaceAll("dist-e2-20260927", bundleDirectory)
    .replace(hash(originalManifest), hash(manifest));
  fs.writeFileSync(path.join(runRoot, packagePath, "api-start-audit.sh"), wrapper);
}
const output = path.join(directory, control ? "verificacion-control" : "verificacion-final");
fs.mkdirSync(output, { recursive: true });
const clean = { PATH: process.env.PATH, HOME: base, LANG: "C.UTF-8" };
const pg = { ...clean, PGHOST: socket, PGPORT: "55439", PGUSER: "postgres", PGDATABASE: "heliumdb" };
const runtime = { ...clean, NODE_ENV: "development", API_INSPECTION_BOOT: "1", PORT: "18092",
  DATABASE_URL: `postgresql://postgres@localhost:55439/heliumdb?host=${encodeURIComponent(socket)}` };
const command = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { env: clean, encoding: "utf8", timeout: 60000, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${cmd} exit ${result.status}: ${result.stderr}`);
  return result.stdout;
};
const sql = input => command("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { env: pg, input });
const results = { databasePath: base, apiPort: 18092, pgPort: 55439, started: false, executedAgainst: "new local empty synthetic catalog only" };
results.revision = control ? "7cb77f8cfc6287fa51325a25122c48af392a7ada" : "31804125a1e752bde128d72e9fd44d23972ffff1";
results.bundleDirectory = bundleDirectory;
let pgStarted = false;
let child;
let fd;
try {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(18092, "127.0.0.1", resolve); });
  await new Promise(resolve => reservation.close(resolve));
  command("initdb", ["-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "-D", path.join(base, "data")]);
  command("pg_ctl", ["-D", path.join(base, "data"), "-l", path.join(base, "postgres.txt"),
    "-o", `-k ${socket} -h "" -p 55439`, "-w", "start"]);
  pgStarted = true;
  command("createdb", ["heliumdb"], { env: pg });
  sql(fs.readFileSync(fixture, "utf8"));
  sql(fs.readFileSync(path.join(directory, "sql/01-install-evidence-prepared.sql"), "utf8"));
  const before = readCatalog(runtime);
  const relations = before.schemaRows.filter(row => row.kind === "table");
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  const countsQuery = relations.map(row => `SELECT '${row.object_name}' AS name,count(*) AS count FROM public.${quote(row.object_name)}`).join(" UNION ALL ") + ";";
  const countsBefore = sql(countsQuery);
  const sequenceBefore = sql("SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;");
  const trace = path.join(output, "candidate-worker-open.trace");
  const log = path.join(output, "candidate-start.log");
  fd = fs.openSync(log, "w");
  child = spawn("strace", ["-f", "-e", "trace=openat", "-o", trace,
    "bash", "reports/e2-paquete-liberacion-preparado-20260921/api-start-audit.sh"],
    { cwd: runRoot, env: runtime, stdio: ["ignore", fd, fd], detached: true });
  results.tracerPid = child.pid;
  let closed = false;
  const ended = new Promise(resolve => child.once("close", (code, signal) => { closed = true; resolve({ code, signal }); }));
  const deadline = Date.now() + 30000;
  let health;
  while (Date.now() < deadline) {
    if (closed) throw new Error("Candidate exited before health verification.");
    try {
      const response = await fetch("http://127.0.0.1:18092/api/healthz", { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { health = { status: response.status, body: await response.json() }; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(health?.status, 200, "Candidate health deadline exceeded.");
  results.started = true;
  results.health = health;
  await new Promise(resolve => setTimeout(resolve, 500));
  const opened = fs.readFileSync(trace, "utf8");
  const candidate = path.join(workspace, "artifacts/api-server", bundleDirectory);
  for (const worker of ["thread-stream-worker.mjs", "pino-pretty.mjs"]) {
    assert.ok(opened.split("\n").some(line => line.includes(`${candidate}/${worker}`) && /= \d+/.test(line)), `Worker load not observed: ${worker}`);
  }
  results.workersLoaded = ["thread-stream-worker.mjs", "pino-pretty.mjs"];
  const logged = fs.readFileSync(log, "utf8");
  assert.match(logged, /Inspection boot: schema initializers, purchase backfill and stock-minimum monitor are paused/);
  results.inspectionMessageObserved = true;
  const after = readCatalog(runtime);
  assert.equal(hash(after.schemaRows), hash(before.schemaRows));
  assert.equal(hash(after.attributes), hash(before.attributes));
  assert.equal(sql(countsQuery), countsBefore);
  assert.equal(sql("SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;"), sequenceBefore);
  results.catalogRowsSequencesUnchanged = true;
  fs.copyFileSync(path.join(runRoot, "reports/arranques-api.log"), path.join(output, "candidate-start-audit.jsonl"));
  process.kill(-child.pid, "SIGTERM");
  const stopped = await Promise.race([ended, new Promise(resolve => setTimeout(() => resolve(null), 10000))]);
  if (!stopped) { process.kill(-child.pid, "SIGKILL"); await ended; }
  results.candidateStopped = true;
  child = undefined;
} catch (error) {
  results.error = error.message;
  process.exitCode = 1;
} finally {
  if (child) {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
    await new Promise(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("close", resolve); });
    results.candidateStopped = true;
  }
  if (fd !== undefined) fs.closeSync(fd);
  if (pgStarted) {
    const stopped = spawnSync("pg_ctl", ["-D", path.join(base, "data"), "-m", "immediate", "-w", "stop"], { env: clean, encoding: "utf8" });
    results.postgresStopExit = stopped.status;
    if (stopped.status !== 0) process.exitCode = 1;
  }
  fs.rmSync(base, { recursive: true, force: true });
  results.disposableDestroyed = !fs.existsSync(base);
  fs.writeFileSync(path.join(output, "candidate-start-results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}