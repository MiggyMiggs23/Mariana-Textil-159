import test from "node:test";
import assert from "node:assert/strict";
import type { AuthContext } from "./middlewares/auth";
import { movementInReadScope } from "./routes/inventario";

function scopedAuth(ubicacionId: number | null): AuthContext {
  return {
    sessionId: "test-session",
    user: {
      rol: "BODEGA",
      ubicacionId,
      alcanceConsulta: "PROPIA",
    },
  } as AuthContext;
}

test("movement detail allows a PROPIA user to read its assigned location", () => {
  assert.equal(movementInReadScope(scopedAuth(7), 7), "allow");
});

test("movement detail allows ADMIN to read an explicitly authorized site", () => {
  assert.equal(
    movementInReadScope(
      {
        sessionId: "test-session",
        user: { rol: "ADMIN", ubicacionId: null, alcanceConsulta: "PROPIA" },
      } as AuthContext,
      8,
    ),
    "allow",
  );
});

test("movement detail hides an out-of-scope movement as not-found", () => {
  assert.equal(movementInReadScope(scopedAuth(7), 8), "not-found");
});

test("movement detail rejects PROPIA users without an assigned location", () => {
  assert.equal(movementInReadScope(scopedAuth(null), 7), "forbidden");
});