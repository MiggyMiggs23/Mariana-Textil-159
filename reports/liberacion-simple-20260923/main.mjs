// MAIN only. This script is not executed during preparation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
const root = process.cwd(), report = path.join(root, "reports/liberacion-simple-20260923");
const [mode, stage, attempt] = process.argv.slice(2);
assert.equal(process.env.SIMPLE_MAIN, "AUTHORIZED");
assert(["rehearse", "apply"].includes(mode) && ["e3", "tanda-b"].includes(stage));
assert(/^[a-zA-Z0-9_-]+$/.test(attempt || ""));
const bin = process.env.SIMPLE_PG_BIN;
assert(bin && path.isAbsolute(bin));
const evidence = path.join(report, `${mode}-${stage}-${attempt}`);
fs.mkdirSync(evidence, { mode: 0o700 });
const clean = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8" };
const e3 = ["reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
  "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql"];
const tanda = [1,2,3,4,5].map(i => `reports/tanda-b-b0-b1-20260923/r5/sql/${i}.sql`);
const status = { mode, stage, status: "RUNNING", sql: [], candidateHealth200: false, disposableDestroyed: false };
let base, pgStarted = false, pgAttempted = false, child, pg;
const save = () => fs.writeFileSync(path.join(evidence, "status.json"), JSON.stringify(status, null, 2));
const run = (cmd, args, env = clean, input) => {
  const r = spawnSync(cmd, args, { env, input, encoding: "utf8", timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw Error(`${path.basename(cmd)} failed (${r.status}); stopped, no repair`);
  return r.stdout;
};
const psql = input => run(path.join(bin, "psql"), ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], pg, input);
function snapshot(label) {
  const rows = {};
  const tables = psql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;").trim().split("\n").filter(Boolean);
  for (const table of tables) {
    const ident = `"${table.replaceAll('"', '""')}"`;
    rows[table] = psql(`BEGIN READ ONLY; SELECT to_jsonb(t)::text FROM public.${ident} t ORDER BY to_jsonb(t)::text; ROLLBACK;`).trimEnd().split("\n").filter(Boolean);
  }
  fs.writeFileSync(path.join(evidence, `${label}-rows.json`), JSON.stringify(rows, null, 2), { mode: 0o600 });
  return JSON.stringify(rows);
}
function sqlFile(file, label) {
  const entry = { file, label, status: "STARTED" }; status.sql.push(entry); save();
  // Verbose diagnostics record exact PostgreSQL file/line; no URL is an argument.
  const r = spawnSync(path.join(bin, "psql"), ["-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-f", path.join(root, file)],
    { env: pg, encoding: "utf8", timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(evidence, `${label}.log`), r.stdout + r.stderr, { mode: 0o600 });
  entry.exit = r.status; entry.status = r.status === 0 ? "COMPLETED" : "FAILED";
  entry.failureLine = r.status === 0 ? null : (r.stderr.match(/psql:.*?:\d+:/g) || []);
  save();
  if (r.status !== 0) {
    try { snapshot(`failed-${label}`); } catch { entry.failureSnapshot = "UNAVAILABLE"; save(); }
    throw Error(`SQL ${label} failed; previous files may already be committed; STOP`);
  }
  snapshot(`after-${label}`);
}
async function stopChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once("close", resolve));
  child.kill("SIGTERM");
  await Promise.race([ended, new Promise(resolve => setTimeout(resolve, 4000))]);
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await ended; }
}
let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  await stopChild();
  if (pgAttempted) {
    const r = spawnSync(path.join(bin, "pg_ctl"), ["-D", path.join(base, "data"), "-m", "immediate", "-w", "stop"], { env: clean, encoding: "utf8", timeout: 30000 });
    status.pgStopExit = r.status;
    if (r.status !== 0) { status.status = "FAIL_CLEANUP"; process.exitCode = 1; }
  }
  if (base && (!pgAttempted || status.pgStopExit === 0)) fs.rmSync(base, { recursive: true, force: true });
  if (base && fs.existsSync(base)) status.preservedCluster = base;
  status.disposableDestroyed = Boolean(base && !fs.existsSync(base));
  save();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
  status.status = `INTERRUPTED_${signal}`;
  await cleanup();
  process.exit(1);
});
try {
  if (mode === "rehearse") {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "simple-release-"));
    fs.chmodSync(base, 0o700);
    const socket = path.join(base, "socket"); fs.mkdirSync(socket);
    pg = { ...clean, PGHOST: socket, PGPORT: "55461", PGUSER: "postgres", PGDATABASE: "simple" };
    run(path.join(bin, "initdb"), ["-D", path.join(base, "data"), "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"]);
    pgAttempted = true;
    run(path.join(bin, "pg_ctl"), ["-D", path.join(base, "data"), "-l", path.join(base, "pg.log"), "-o", `-k ${socket} -h "" -p 55461`, "-w", "start"]);
    pgStarted = true;
    run(path.join(bin, "createdb"), ["simple"], pg);
    sqlFile("reports/liberacion-simple-20260923/fixture.sql", "fixture");
    for (const [i, file] of e3.entries()) sqlFile(file, `e3-${i + 1}`);
    if (stage === "tanda-b") for (const [i, file] of tanda.entries()) sqlFile(file, `tanda-b-${i + 1}`);
    const before = snapshot("before-start");
    const port = Number(process.env.SIMPLE_CANDIDATE_PORT || 18096);
    assert(Number.isInteger(port) && port > 1024 && port < 65536);
    const reservation = net.createServer();
    await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(port, "127.0.0.1", resolve); });
    await new Promise(resolve => reservation.close(resolve));
    const bundle = stage === "e3" ? "artifacts/api-server/dist-e3-apertura-20260922/index.mjs" :
      "artifacts/api-server/dist-simple-e3-tanda-b-20260923/index.mjs";
    const fd = fs.openSync(path.join(evidence, "candidate.log"), "wx", 0o600);
    child = spawn(process.execPath, [path.join(root, bundle)], { cwd: root, env: {
      ...clean, NODE_ENV: "development", API_INSPECTION_BOOT: "1", PORT: String(port),
      DATABASE_URL: `postgresql://postgres@localhost:55461/simple?host=${encodeURIComponent(socket)}`,
      E3_ENABLED: "true", E3_ORDINARY_CASH_ENABLED: "true", E3_DIRECTED_ENABLED: "false",
      REMATE_RELEASED: "false", REMATE_UI_RELEASED: "false",
    }, stdio: ["ignore", fd, fd] });
    fs.closeSync(fd);
    let spawnFailed = false; child.once("error", () => { spawnFailed = true; });
    for (let i = 0; i < 60; i++) {
      if (spawnFailed || child.exitCode !== null) throw Error("Candidate exited before health");
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/healthz`, { signal: AbortSignal.timeout(1000) });
        if (r.status === 200) { status.candidateHealth200 = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(status.candidateHealth200, "Candidate health did not return 200");
    await stopChild();
    assert.equal(snapshot("after-start"), before, "Startup changed exact fixture rows");
  } else {
    const receipt = process.env.SIMPLE_REHEARSAL_RECEIPT;
    assert(receipt && path.resolve(receipt).startsWith(report + path.sep));
    const proof = JSON.parse(fs.readFileSync(receipt));
    assert(proof.mode === "rehearse" && proof.stage === stage && proof.status === "PASS" &&
      proof.candidateHealth200 && proof.disposableDestroyed, "Successful rehearsal required");
    const pid = process.env.SIMPLE_API_PID;
    assert(/^[1-9]\d*$/.test(pid || ""));
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    assert(cmd.includes(stage === "e3" ? "dist-e2" : "dist-e3-apertura-20260922"), "Unexpected effective API process");
    const entries = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
    const urls = entries.filter(s => s.startsWith("DATABASE_URL="));
    assert.equal(urls.length, 1, "Effective PID must have one DATABASE_URL");
    const u = new URL(urls[0].slice("DATABASE_URL=".length));
    assert(["postgres:", "postgresql:"].includes(u.protocol));
    pg = { ...clean, PGHOST: u.searchParams.get("host") || u.hostname, PGPORT: u.port || "5432",
      PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
      PGDATABASE: decodeURIComponent(u.pathname.slice(1)), PGSSLMODE: u.searchParams.get("sslmode") || "prefer",
      PGCONNECT_TIMEOUT: "5" };
    status.effectiveApiPid = Number(pid); save();
    snapshot("before-sql");
    for (const [i, file] of (stage === "e3" ? e3 : tanda).entries()) sqlFile(file, `${stage}-${i + 1}`);
  }
  status.status = "PASS";
} catch (error) {
  status.status = "FAIL"; status.error = error.message; process.exitCode = 1;
} finally {
  await cleanup();
  console.log(JSON.stringify({ mode, stage, status: status.status, evidence }));
}