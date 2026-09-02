import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("Bloque 3 limits new account-payment choices without changing ticket credit", async () => {
  const [clientForm, supplierForm, enums, clientRoute, supplierRoute, apiSpec] =
    await Promise.all([
      readFile(new URL("artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/components/proveedor-pago-dialog.tsx", root), "utf8"),
      readFile(new URL("lib/db/src/schema/enums.ts", root), "utf8"),
      readFile(new URL("artifacts/api-server/src/routes/clientes.ts", root), "utf8"),
      readFile(new URL("artifacts/api-server/src/routes/proveedores.ts", root), "utf8"),
      readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
    ]);
  for (const form of [clientForm, supplierForm]) {
    assert.match(form, /FACTURADO/);
    assert.doesNotMatch(form, /SelectItem value=.*(?:CHEQUE|OTRO)/);
  }
  assert.match(enums, /formaPagoTicketEnum[\s\S]*"EFECTIVO",[\s\S]*"TRANSFERENCIA",[\s\S]*"CREDITO"/);
  assert.match(enums, /formaPagoCuentaEnum[\s\S]*"FACTURADO",[\s\S]*"CHEQUE",[\s\S]*"OTRO"/);
  assert.match(apiSpec, /enum: \[EFECTIVO, TRANSFERENCIA, FACTURADO, CHEQUE, OTRO, CREDITO\]/);
  assert.match(clientRoute, /\["EFECTIVO", "TRANSFERENCIA", "FACTURADO"\]/);
  assert.match(supplierRoute, /"FACTURADO"/);
});