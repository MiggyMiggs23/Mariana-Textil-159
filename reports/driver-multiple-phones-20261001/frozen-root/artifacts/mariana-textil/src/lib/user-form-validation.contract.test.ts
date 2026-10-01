import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATE_USER_FIELD_LIMITS,
  validateUserForm,
} from "./user-form-validation";

test("client validation reports all invalid fields before submit", () => {
  const errors = validateUserForm(
    { nombre: "Nombre válido", usuario: "ab", password: "123456789" },
    "create",
  );

  assert.equal(
    errors.usuario,
    `Usuario: mínimo ${CREATE_USER_FIELD_LIMITS.usuario.min} caracteres; faltan 1.`,
  );
  assert.equal(
    errors.password,
    `Contraseña: mínimo ${CREATE_USER_FIELD_LIMITS.password.min} caracteres; faltan 1.`,
  );
});

test("editing allows a blank password but validates a replacement", () => {
  assert.equal(
    validateUserForm(
      { nombre: "Nombre válido", usuario: "usuario", password: "" },
      "update",
    ).password,
    undefined,
  );
  assert.match(
    validateUserForm(
      { nombre: "Nombre válido", usuario: "usuario", password: "corta" },
      "update",
    ).password ?? "",
    /Contraseña: mínimo/,
  );
});