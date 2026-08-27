import assert from "node:assert/strict";
import test from "node:test";
import { requiereConfirmacionAjuste } from "./ajuste-confirmacion";

test("un ajuste de exactamente 10 unidades no requiere confirmación", () => {
  assert.equal(
    requiereConfirmacionAjuste({
      cantidadActual: 40,
      cantidadNueva: 50,
      isBaja: false,
    }),
    false,
  );
});

test("un ajuste positivo mayor a 10 unidades requiere confirmación", () => {
  assert.equal(
    requiereConfirmacionAjuste({
      cantidadActual: 40,
      cantidadNueva: 50.01,
      isBaja: false,
    }),
    true,
  );
});

test("un ajuste negativo mayor a 10 unidades requiere confirmación", () => {
  assert.equal(
    requiereConfirmacionAjuste({
      cantidadActual: 40,
      cantidadNueva: 29.99,
      isBaja: false,
    }),
    true,
  );
});

test("una baja de más de 10 unidades requiere confirmación", () => {
  assert.equal(
    requiereConfirmacionAjuste({
      cantidadActual: 10.01,
      isBaja: true,
    }),
    true,
  );
});