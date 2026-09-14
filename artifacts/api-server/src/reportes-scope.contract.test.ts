import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "./middlewares/auth";
import {
  assertGlobalX04Scope,
  ComposedScopeError,
  resolveComposedLocations,
} from "./routes/reportes";
import { ReportInputError } from "./lib/reportes";

function auth(
  alcanceConsulta: "TODAS" | "PROPIA",
  ubicacionId: number | null,
  rol: string = "SUPERVISOR",
): AuthContext {
  return {
    sessionId: "scope-test",
    location: null,
    user: { rol, alcanceConsulta, ubicacionId } as AuthContext["user"],
  };
}

test("composed scope rejects conflicting singular and multi-site filters", () => {
  assert.throws(
    () =>
      resolveComposedLocations(auth("TODAS", null, "ADMIN"), {
        ubicacionId: 7,
        ubicacionIds: "7,8",
      }),
    (error: unknown) =>
      error instanceof ReportInputError &&
      error.message.includes("deben identificar el mismo sitio"),
  );
});

test("normal composed exports reject a multi-site array instead of becoming global", () => {
  assert.throws(
    () =>
      resolveComposedLocations(auth("TODAS", null, "ADMIN"), {
        modo: "normal",
        ubicacionIds: "7,8",
      }),
    (error: unknown) =>
      error instanceof ReportInputError &&
      error.message.includes("solo admite un sitio"),
  );
  assert.deepEqual(
    resolveComposedLocations(auth("TODAS", null, "ADMIN"), {
      modo: "comparar",
      ubicacionIds: "7,8",
    }),
    [7, 8],
  );
});

test("PROPIA composed exports reject an explicitly foreign site", () => {
  assert.throws(
    () =>
      resolveComposedLocations(auth("PROPIA", 7), {
        ubicacionId: 8,
      }),
    (error: unknown) =>
      error instanceof ComposedScopeError && error.statusCode === 403,
  );
  assert.deepEqual(
    resolveComposedLocations(auth("PROPIA", 7), {}),
    [7],
  );
});

test("admin selected same site is scoped while no selection remains global", () => {
  assert.deepEqual(
    resolveComposedLocations(auth("TODAS", null, "ADMIN"), {
      ubicacionId: 7,
      ubicacionIds: "7",
    }),
    [7],
  );
  assert.equal(
    resolveComposedLocations(auth("TODAS", null, "ADMIN"), {}),
    undefined,
  );
});

test("route blocks X04 before any global compare read for ADMIN-PROPIA or selected ADMIN", () => {
  assert.throws(
    () =>
      assertGlobalX04Scope(
        "ventas",
        { modo: "comparar" },
        [7],
        auth("TODAS", null, "ADMIN"),
      ),
    (error: unknown) =>
      error instanceof ComposedScopeError && error.statusCode === 403,
  );
  assert.throws(
    () =>
      assertGlobalX04Scope(
        "ventas",
        { modo: "comparar" },
        [7],
        auth("PROPIA", 7, "ADMIN"),
      ),
    (error: unknown) =>
      error instanceof ComposedScopeError && error.statusCode === 403,
  );
});
