import assert from "node:assert/strict";
import { test } from "node:test";
import { isPostgresUniqueViolation } from "./postgres-errors";

test("recognizes direct and cause-wrapped PostgreSQL unique violations", () => {
  assert.equal(isPostgresUniqueViolation({ code: "23505" }), true);
  assert.equal(
    isPostgresUniqueViolation({
      cause: {
        cause: { code: "23505", constraint: "users_username_unique" },
      },
    }),
    true,
  );
});

test("optionally matches the exact unique constraint", () => {
  const wrapped = {
    cause: {
      code: "23505",
      constraint: "clientes_activos_no_sistema_nombre_normalizado_uidx",
    },
  };
  assert.equal(
    isPostgresUniqueViolation(
      wrapped,
      "clientes_activos_no_sistema_nombre_normalizado_uidx",
    ),
    true,
  );
  assert.equal(
    isPostgresUniqueViolation(wrapped, "other_unique_constraint"),
    false,
  );
});

test("does not mistake other PostgreSQL errors or cyclic causes for 23505", () => {
  assert.equal(isPostgresUniqueViolation({ cause: { code: "23503" } }), false);
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(isPostgresUniqueViolation(cyclic), false);
});