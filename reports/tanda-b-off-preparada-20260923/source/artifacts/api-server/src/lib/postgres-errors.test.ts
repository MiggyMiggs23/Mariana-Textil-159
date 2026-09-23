import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatErrorWithCauses,
  isPostgresUniqueViolation,
} from "./postgres-errors";

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

test("formats PostgreSQL diagnostics from a wrapped driver cause", () => {
  const formatted = formatErrorWithCauses({
    name: "DrizzleQueryError",
    message: "Failed query",
    stack: "DrizzleQueryError: Failed query",
    cause: {
      name: "error",
      message: 'insert on table "movimientos" violates foreign key constraint',
      code: "23503",
      detail: 'Key (usuario_id)=(1) is not present in table "usuarios".',
      constraint: "movimientos_usuario_id_usuarios_id_fk",
      column: "usuario_id",
      table: "movimientos",
      schema: "public",
      severity: "ERROR",
    },
  });

  assert.match(formatted, /DrizzleQueryError: Failed query/);
  assert.match(formatted, /Cause 1:/);
  assert.match(formatted, /SQLSTATE: 23503/);
  assert.match(formatted, /message: insert on table "movimientos"/);
  assert.match(formatted, /detail: Key \(usuario_id\)=\(1\)/);
  assert.match(formatted, /constraint: movimientos_usuario_id_usuarios_id_fk/);
  assert.match(formatted, /column: usuario_id/);
  assert.match(formatted, /table: movimientos/);
  assert.match(formatted, /schema: public/);
});

test("formats primitive and cyclic causes without looping", () => {
  const cyclic: { message: string; cause?: unknown } = { message: "outer" };
  cyclic.cause = cyclic;
  assert.match(formatErrorWithCauses(cyclic), /cycle detected/);
  assert.match(
    formatErrorWithCauses({ message: "outer", cause: "driver stopped" }),
    /Cause 1:\ndriver stopped/,
  );
});