import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("estado de cuenta contracts saldoPendiente from credit_fifo_aging", async () => {
  const [spec, route] = await Promise.all([
    readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
    readFile(new URL("artifacts/api-server/src/routes/clientes.ts", root), "utf8"),
  ]);

  assert.match(
    spec,
    /ClienteMovimiento:[\s\S]*?saldoPendiente: \{ type: \["string", "null"\] \}/,
  );
  assert.match(
    route,
    /LEFT JOIN credit_fifo_aging\(\$1\) aging ON aging\.movimiento_id=ledger\.id/,
  );
  assert.match(
    route,
    /CASE WHEN tipo='VENTA_CREDITO'[\s\S]*?COALESCE\(aging\.pendiente::text, '0\.00'\)[\s\S]*?ELSE NULL[\s\S]*?END AS "saldoPendiente"/,
  );
});