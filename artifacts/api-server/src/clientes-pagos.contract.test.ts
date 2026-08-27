import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateClientePagoBody,
  PreviewClientePagoBody,
} from "@workspace/api-zod";
import { readFile } from "node:fs/promises";

test("contrato de abono exige cuentaDestino y preview comparte fecha efectiva", () => {
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
    PreviewClientePagoBody.safeParse({
      importe: 125,
      fechaEfectiva: "2026-01-03T12:00:00.000Z",
    }).success,
    true,
  );
});

test("estado de cuenta proyecta cuentaDestino desde el CTE del ledger", async () => {
  const routes = await readFile(new URL("./routes/clientes.ts", import.meta.url), "utf8");
  assert.match(
    routes,
    /WITH ledger AS \([\s\S]*m\.forma_pago, m\.cuenta_destino,[\s\S]*cuenta_destino AS "cuentaDestino"/,
  );
});