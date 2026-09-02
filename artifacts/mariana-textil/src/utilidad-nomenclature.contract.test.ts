import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("monetary profit labels use Utilidad while percentages remain Margen", () => {
  const realtime = read("./pages/caja/tiempo-real.tsx");
  const comparison = read("./pages/caja/comparativo.tsx");
  const cut = read("./pages/corte-detail-shared.tsx");
  const supplier = read("./pages/proveedor-detail.tsx");
  const customers = read("./pages/clientes.tsx");
  const customer = read("./pages/cliente-detail.tsx");
  const customerExports = read("../../api-server/src/routes/clientes.ts");
  const cutExports = read("../../api-server/src/routes/admin-analytics.ts");

  assert.doesNotMatch([realtime, comparison, cut, supplier, customers, customer].join("\n"), /Rentabilidad/);
  assert.match(realtime, />Utilidad</);
  assert.match(realtime, /<>Margen \{formatNumber\(totals\.margenPorcentaje/);
  assert.match(supplier, /Utilidad generada/);
  assert.match(supplier, />Margen \{formatNumber\(estadisticas\.margenGenerado\.margenPct/);
  assert.match(customer, /headers=\{\[.*"Utilidad"\]\}/);
  assert.match(customers, /Top por utilidad/);
  assert.match(customerExports, /header: "Utilidad", key: "margen"/);
  assert.match(cutExports, /concepto: "Utilidad"/);
  assert.match(cutExports, /`Utilidad: \$\{margin\.margen/);
});