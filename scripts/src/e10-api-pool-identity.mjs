import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readlink } from "node:fs/promises";
import { dirname } from "node:path";

const pid = Number(process.argv[2]);
const output = process.argv[3];
assert.ok(Number.isSafeInteger(pid) && pid > 1 && output, "PID and output required");
assert.ok((await readlink(`/proc/${pid}/cwd`)).endsWith("/artifacts/api-server"), "Wrong process CWD");
const cmd = await readFile(`/proc/${pid}/cmdline`, "utf8");
assert.ok(cmd.includes("./dist/index.mjs"), "Wrong process command");
const sqlSource = await readFile("scripts/src/e1-operational-guards.mts", "utf8");
const sql = sqlSource.match(/export const OPERATIONAL_IDENTITY_SQL = `([^`]+)`;/)?.[1];
assert.ok(sql, "Identity query missing");
let opened = false;
let ws;
const pending = new Map();
let id = 0;
const request = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id;
  const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Inspector timeout: ${method}`)); }, 25000);
  pending.set(key, { resolve, reject, timer });
  ws.send(JSON.stringify({ id: key, method, params }));
});
try {
  let response;
  try { response = await fetch("http://127.0.0.1:9229/json/list"); } catch {}
  assert.ok(!response?.ok, "Inspector already active; refusing to attach ambiguously");
  process.kill(pid, "SIGUSR1");
  opened = true;
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try { response = await fetch("http://127.0.0.1:9229/json/list"); if (response.ok) break; } catch {}
  }
  assert.ok(response?.ok, "Inspector unavailable");
  const targets = await response.json();
  assert.equal(targets.length, 1);
  const url = new URL(targets[0].webSocketDebuggerUrl);
  assert.equal(url.hostname, "127.0.0.1");
  ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer); pending.delete(message.id);
    if (message.error) entry.reject(new Error(`Inspector protocol error ${message.error.code}`));
    else entry.resolve(message.result);
  };
  const processResult = await request("Runtime.evaluate", { expression: "process.pid", returnByValue: true });
  assert.equal(processResult.result.value, pid, "Inspector PID mismatch");
  const proto = await request("Runtime.evaluate", {
    expression: 'process.getBuiltinModule("node:events").EventEmitter.prototype',
    objectGroup: "e10-readonly-identity",
  });
  const objects = await request("Runtime.queryObjects", {
    prototypeObjectId: proto.result.objectId, objectGroup: "e10-readonly-identity",
  });
  const result = await request("Runtime.callFunctionOn", {
    objectId: objects.objects.objectId,
    functionDeclaration: `async function(sql) {
      const pools = this.filter(value => value.constructor?.name === "BoundPool"
        && Array.isArray(value._clients) && Array.isArray(value._idle) && !value.ending);
      if (pools.length !== 1) throw new Error("Expected exactly one live API pool");
      const client = await pools[0].connect();
      try {
        await client.query("BEGIN READ ONLY");
        await client.query("SET LOCAL statement_timeout = '10s'");
        const identity = (await client.query(sql)).rows[0];
        const system = (await client.query("SELECT system_identifier::text FROM pg_control_system()")).rows[0];
        return { apiPid: process.pid, capturedAtUtc: new Date().toISOString(),
          poolConstructor: pools[0].constructor.name, identity: {...identity, ...system},
          readOnly: true, actualProcessPool: true };
      } finally { await client.query("ROLLBACK"); client.release(); }
    }`,
    arguments: [{ value: sql }], awaitPromise: true, returnByValue: true,
  });
  assert.ok(!result.exceptionDetails, "Actual pool identity query failed");
  const evidence = result.result.value;
  assert.equal(evidence.identity.database_name, "heliumdb");
  assert.equal(evidence.identity.transaction_read_only, "on");
  assert.equal(evidence.identity.schema_name, "public");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(evidence));
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      await request("Runtime.releaseObjectGroup", { objectGroup: "e10-readonly-identity" });
      if (opened) await request("Runtime.evaluate", {
        expression: 'setTimeout(() => process.getBuiltinModule("node:inspector").close(), 100); undefined',
      });
    } finally { ws.close(); }
  }
}