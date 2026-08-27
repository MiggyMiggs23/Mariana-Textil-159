import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateClientePagoBody,
  PreviewClientePagoBody,
} from "@workspace/api-zod";

test("contrato de abono exige cuentaDestino y mantiene preview sin ella", () => {
  assert.equal(
    CreateClientePagoBody.safeParse({
      importe: 125,
      formaPago: "EFECTIVO",
      cuentaDestino: "CAJA_FISICA",
    }).success,
    true,
  );
  assert.equal(
    CreateClientePagoBody.safeParse({ importe: 125, formaPago: "EFECTIVO" }).success,
    false,
  );
  assert.equal(
    PreviewClientePagoBody.safeParse({ importe: 125 }).success,
    true,
  );
});