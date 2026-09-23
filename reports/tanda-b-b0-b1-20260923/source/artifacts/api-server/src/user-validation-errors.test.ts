import assert from "node:assert/strict";
import test from "node:test";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { formatUserValidationErrors } from "./lib/user-validation-errors";

test("create validation names every invalid field without library details", () => {
  const body = {
    nombre: "Nombre válido",
    usuario: "ab",
    password: "123456789",
    rol: "CAJA",
    ubicacionId: 1,
  };
  const parsed = CreateUserBody.safeParse(body);
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const message = formatUserValidationErrors(
    parsed.error.issues,
    body,
    "create",
  );
  assert.match(message, /Usuario: mínimo 3 caracteres; faltan 1\./);
  assert.match(message, /Contraseña: mínimo 10 caracteres; faltan 1\./);
  assert.doesNotMatch(message, /too_small|invalid_type|zod|password/i);
});

test("update validation applies the same password requirement", () => {
  const body = { password: "123456789" };
  const parsed = UpdateUserBody.safeParse(body);
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(
    formatUserValidationErrors(parsed.error.issues, body, "update"),
    "Contraseña: mínimo 10 caracteres; faltan 1.",
  );
});