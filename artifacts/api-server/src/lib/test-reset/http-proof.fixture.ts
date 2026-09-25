// Executed ONLY by the disposable PostgreSQL test with a minimal child env.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

const socket = process.env.RESET_TEST_SOCKET;
assert.ok(socket?.startsWith("/tmp/test-reset-isolated-"));
assert.ok(existsSync(`${socket}/pgdata/PG_VERSION`));
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.searchParams.get("host"), socket);
assert.equal(url.hostname, "localhost");
assert.equal(url.pathname, "/postgres");
const { pool } = await import("@workspace/db");
const identity = await pool.query("SELECT current_setting('data_directory') AS path");
assert.equal(identity.rows[0].path, `${socket}/pgdata`);
const { default: app } = await import("../../app");
const { createTestResetRouter } = await import("../../routes/test-reset");
const { testResetBarrier } = await import("./barrier");
const { acquireResetProcessLease } = await import("./process-lease");
const worker = () => spawn(process.execPath, ["--import", "tsx", resolve(import.meta.dirname, "lease-proof.fixture.ts")], {
  env: process.env, stdio: ["pipe", "pipe", "inherit"],
});
const oldApi = worker();
const [ready] = await once(oldApi.stdout, "data");
assert.match(String(ready), /LEASE_READY/);
await assert.rejects(acquireResetProcessLease(pool.options, true), /otra API/);
const oldFinished = once(oldApi, "exit");
oldApi.stdin.end("drain");
assert.equal((await oldFinished)[0], 0);
const lease = await acquireResetProcessLease(pool.options, true);
const competingApi = worker();
const competingFinished = once(competingApi, "exit");
const [blocked] = await once(competingApi.stdout, "data");
assert.match(String(blocked), /LEASE_BLOCKED/);
assert.equal((await competingFinished)[0], 0);
const host = express();
host.use(cookieParser(), express.json());
host.use("/api/closed", createTestResetRouter(false));
host.use("/api", testResetBarrier, createTestResetRouter(true));
host.use(app);
const server = host.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const password = randomBytes(24).toString("hex");
try {
  const historyBefore = (await pool.query("SELECT count(*)::int AS n FROM test_reset_history")).rows[0].n;
  await pool.query("UPDATE usuarios SET password_hash=crypt($1,gen_salt('bf',4)) WHERE id IN (1,2)", [password]);
  const call = (path: string, method = "GET", body?: object, cookie?: string) => fetch(`${origin}${path}`, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = async (usuario: string) => {
    const response = await call("/api/auth/login", "POST", { usuario, password });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie?.startsWith("mariana_session="));
    return cookie;
  };
  assert.equal((await call("/api/closed/admin/test-reset")).status, 404);
  assert.equal((await call("/api/admin/test-reset")).status, 401);
  const caja = await login("test-caja");
  const admin = await login("test-admin");
  assert.equal((await call("/api/admin/test-reset", "POST", { confirmation: "BORRAR" }, caja)).status, 403);
  assert.equal((await call("/api/admin/test-reset", "POST", { confirmation: "incorrecta" }, admin)).status, 400);
  assert.equal((await call("/api/admin/test-reset", "GET", undefined, admin)).status, 200);
  const result = await call("/api/admin/test-reset", "POST", { confirmation: "BORRAR" }, admin);
  assert.equal(result.status, 200, await result.clone().text());
  assert.deepEqual(await result.json(), {
    success: true, requiresLogin: true,
    message: "Datos de prueba borrados. Todas las sesiones se cerraron. Vuelve a iniciar sesión.",
  });
  assert.match(result.headers.get("set-cookie") ?? "", /mariana_session=;/);
  assert.match(result.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM sesiones")).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM test_reset_history")).rows[0].n, historyBefore + 1);
  assert.equal((await call("/api/auth/me", "GET", undefined, admin)).status, 401);
  assert.equal((await call("/api/auth/me", "GET", undefined, caja)).status, 401);
  const relogin = await login("test-admin");
  assert.notEqual(relogin, admin);
  assert.equal((await call("/api/auth/me", "GET", undefined, relogin)).status, 200);
  process.stdout.write("HTTP PASS: real auth, ADMIN/nonadmin, BORRAR, closed gate, 200 success after commit, expired cookie, both sessions invalid, fresh login works.\n");
  process.stdout.write("MULTIPROCESS PASS: old API write drains before exclusive lease; another API cannot start while reset-capable API owns lifetime lease.\n");
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
  await lease.close();
}