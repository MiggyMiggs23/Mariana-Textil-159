import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const usersRoute = readFileSync(new URL("./routes/users.ts", import.meta.url), "utf8");
const createHandler = usersRoute
  .split('router.post("/users"')[1]
  ?.split('router.patch("/users/:id"')[0] ?? "";
const updateHandler = usersRoute.split('router.patch("/users/:id"')[1] ?? "";

test("crear usuarios no evalúa la invariante de recuperación ADMIN", () => {
  assert.doesNotMatch(createHandler, /hasAdminRecoveryAccount/);
  assert.doesNotMatch(
    createHandler,
    /Debe conservarse al menos un ADMIN activo con acceso completo/,
  );
});

test("editar usuarios conserva la invariante de recuperación ADMIN", () => {
  assert.match(updateHandler, /hasAdminRecoveryAccount/);
  assert.match(
    updateHandler,
    /Debe conservarse al menos un ADMIN activo con acceso completo/,
  );
});