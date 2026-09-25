// MAIN ONLY: foreground-owned, forward-clock disposable fiscal API and UI.
// Worker must never invoke this. Ctrl-C/SIGTERM stops exactly the two children.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import pg from "../../../scripts/node_modules/pg/lib/index.js";

const root = process.cwd();
const priv = path.join(root, "private.local/roll-return-continuation");
const report = path.join(root, "reports/continuacion-rollos-20260925/browser");
assert.deepEqual(process.argv.slice(2), ["--main-exclusive"], "MAIN exclusive invocation required");
const marker = JSON.parse(fs.readFileSync(path.join(priv, "ownership-marker.json")));
const ready = JSON.parse(fs.readFileSync(path.join(root, "reports/continuacion-rollos-20260925/preparation/ready.json")));
assert.equal(marker.owner, "MAIN");
assert.equal(marker.root, priv);
assert.equal(marker.port, 55536);
assert.equal(ready.testDatabase, "continue_test");
assert.equal(ready.postgresPort, 55536);
assert.equal(ready.owner, "MAIN");
const database = "postgresql://postgres@127.0.0.1:55536/continue_test";
const witness = "postgresql://postgres@127.0.0.1:55536/continue_witness";
const client = new pg.Client({ connectionString: database, connectionTimeoutMillis: 5000 });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const row = (await client.query(`SELECT current_database() database, current_setting('data_directory') directory,
    inet_server_port() port, (SELECT count(*)::int FROM pg_trigger WHERE tgname='e5_closed'
    AND tgenabled='O' AND tgrelid IN ('e5_devoluciones'::regclass,'e5_salidas_bancarias'::regclass)) refund_closed`)).rows[0];
  assert.equal(row.database, "continue_test");
  assert.equal(row.directory, priv + "/cluster");
  assert.equal(row.port, 55536);
  assert.equal(row.refund_closed, 2);
  await client.query("ROLLBACK");
} finally { await client.end(); }
for (const port of [43940, 43941]) await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => server.close(resolve));
});
const children = [];
const safe = { PATH: process.env.PATH, HOME: priv, LANG: "C.UTF-8" };
function child(args, env, name) {
  const fd = fs.openSync(path.join(priv, `fiscal-${name}.log`), "a", 0o600);
  const instance = spawn(process.execPath, args, {
    cwd: root, env: { ...safe, ...env }, stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  children.push(instance);
  fs.writeFileSync(path.join(priv, `fiscal-${name}.pid`), String(instance.pid), { mode: 0o600 });
  return instance;
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of children.reverse()) {
    if (p.exitCode === null) {
      p.kill("SIGTERM");
      await Promise.race([new Promise(resolve => p.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 8000))]);
      if (p.exitCode === null) p.kill("SIGKILL");
    }
  }
}
process.once("SIGINT", () => void stop().then(() => process.exit(130)));
process.once("SIGTERM", () => void stop().then(() => process.exit(143)));
try {
  const api = child(["--import", path.join(report, "fiscal-clock.mjs"), path.join(priv, "api.mjs")],
    { NODE_ENV: "development", API_INSPECTION_BOOT: "1", FISCAL_CLOCK_READY: "MAIN_STARTED_FORWARD_ONLY",
      DATABASE_URL: database, APPLICATION_DATABASE_URL: witness, PORT: "43940",
      SESSION_SECRET: randomBytes(32).toString("hex") }, "api");
  let healthy = false;
  for (let i = 0; i < 20; i++) {
    if (api.exitCode !== null) throw Error("Isolated fiscal API exited; inspect private fiscal-api.log");
    try {
      const r = await fetch("http://127.0.0.1:43940/api/healthz", { signal: AbortSignal.timeout(1500) });
      if (r.status === 200) { healthy = true; break; }
    } catch { /* wait for this already-owned process, never launch another */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(healthy, "Isolated fiscal API health failed; no proxy start");
  const ui = child([path.join(priv, "proxy.mjs")],
    { STATIC_ROOT: path.join(priv, "source/artifacts/mariana-textil/dist/public"),
      PROXY_PORT: "43941", API_PORT: "43940" }, "ui");
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(ui.exitCode, null, "Isolated fiscal proxy exited; inspect private fiscal-ui.log");
  console.log("MAIN-owned fiscal-only API 43940 and UI 43941 ready; scoped E11 period/browser date 2026-11-02T18:00Z; auth/session and SQL clocks remain real. Keep foreground while worker runs fiscal.");
  await Promise.race(children.map(p => new Promise(resolve => p.once("exit", resolve))));
  throw Error("Isolated fiscal process exited; stopping owned pair");
} finally { await stop(); }