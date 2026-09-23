import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ABSOLUTE_SESSION_MS,
  calculateSessionExpiry,
  INACTIVITY_MS,
  setSessionCookie,
} from "./middlewares/auth";

test("session policy is eight idle hours with a fixed sixteen-hour ceiling", () => {
  assert.equal(INACTIVITY_MS, 8 * 60 * 60 * 1000);
  assert.equal(ABSOLUTE_SESSION_MS, 16 * 60 * 60 * 1000);

  const createdAt = new Date("2026-09-01T06:00:00.000Z");
  assert.equal(
    calculateSessionExpiry(createdAt, createdAt).toISOString(),
    "2026-09-01T14:00:00.000Z",
  );

  const afterFifteenHours = new Date("2026-09-01T21:00:00.000Z");
  assert.equal(
    calculateSessionExpiry(afterFifteenHours, createdAt).toISOString(),
    "2026-09-01T22:00:00.000Z",
    "activity near the ceiling must not extend the absolute deadline",
  );

  const atAbsoluteDeadline = new Date("2026-09-01T22:00:00.000Z");
  assert.equal(
    calculateSessionExpiry(atAbsoluteDeadline, createdAt).getTime(),
    atAbsoluteDeadline.getTime(),
  );
});

test("cookie lifetime and server absolute lifetime share the same constant", () => {
  let receivedOptions: { maxAge?: number } | undefined;
  setSessionCookie(
    {
      cookie(_name: string, _value: string, options: { maxAge?: number }) {
        receivedOptions = options;
      },
    } as never,
    "session-id",
  );
  assert.equal(receivedOptions?.maxAge, ABSOLUTE_SESSION_MS);
});

test("login, expiry messaging, and logout preserve the server-side contract", () => {
  const authRoute = readFileSync(new URL("./routes/auth.ts", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("./middlewares/auth.ts", import.meta.url), "utf8");

  assert.match(authRoute, /const expiraAt = new Date\(now\.getTime\(\) \+ INACTIVITY_MS\)/);
  assert.doesNotMatch(authRoute, /const INACTIVITY_MS\s*=/);
  assert.match(middleware, /La sesión venció\. Inicia sesión de nuevo\./);

  const deletePosition = authRoute.indexOf(".delete(sesionesTable)");
  const clearCookiePosition = authRoute.indexOf("clearSessionCookie(res)");
  assert.ok(deletePosition >= 0, "logout must delete the server session");
  assert.ok(
    clearCookiePosition > deletePosition,
    "logout must invalidate the server session before clearing the browser cookie",
  );
});