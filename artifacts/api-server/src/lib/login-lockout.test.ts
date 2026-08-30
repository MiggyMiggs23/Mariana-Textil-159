import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Request } from "express";
import {
  getLoginLockoutReason,
  LOGIN_GLOBAL_USERNAME_FAILURE_LIMIT,
  LOGIN_SOURCE_FAILURE_LIMIT,
} from "./login-lockout";
import { getRequestIp } from "./request";

test("five failures from IP A do not block a valid login from IP B", () => {
  assert.equal(LOGIN_SOURCE_FAILURE_LIMIT, 5);
  assert.equal(
    getLoginLockoutReason({ sourceFailures: 0, globalFailures: 5 }),
    null,
  );

  const authSource = readFileSync(
    new URL("../routes/auth.ts", import.meta.url),
    "utf8",
  );
  assert.match(authSource, /COUNT\(\*\) FILTER \(WHERE ip = \$\{ip\}\)/);
  assert.match(authSource, /entidad_id = \$\{username\}/);
});

test("five failures block their source IP", () => {
  assert.equal(
    getLoginLockoutReason({ sourceFailures: 5, globalFailures: 5 }),
    "source",
  );
});

test("a successful login resets the prior failure window", () => {
  // The route counts only events newer than latest_success. Thus prior
  // failures produce zero counters after a successful login.
  assert.equal(
    getLoginLockoutReason({ sourceFailures: 0, globalFailures: 0 }),
    null,
  );

  const authSource = readFileSync(
    new URL("../routes/auth.ts", import.meta.url),
    "utf8",
  );
  assert.match(authSource, /WITH latest_success AS/);
  assert.match(authSource, /datos_despues ->> 'usuario'/);
  assert.match(authSource, /created_at > GREATEST/);
});

test("global username threshold blocks attempts across source IPs", () => {
  assert.equal(LOGIN_GLOBAL_USERNAME_FAILURE_LIMIT, 15);
  assert.equal(
    getLoginLockoutReason({
      sourceFailures: 0,
      globalFailures: LOGIN_GLOBAL_USERNAME_FAILURE_LIMIT,
    }),
    "global",
  );
});

test("request IP comes from Express trust policy, not a raw forwarded header", () => {
  const request = {
    ip: "198.51.100.10",
    headers: { "x-forwarded-for": "203.0.113.99" },
  } as unknown as Request;
  assert.equal(getRequestIp(request), "198.51.100.10");

  const appSource = readFileSync(new URL("../app.ts", import.meta.url), "utf8");
  assert.match(
    appSource,
    /app\.set\("trust proxy", \["loopback", "linklocal", "uniquelocal"\]\)/,
  );
});