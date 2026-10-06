import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { REPORT_BLOCK_EXPLANATIONS } from "./report-explanations";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const backendFiles = [
  "../../../../api-server/src/lib/reportes-sales.ts",
  "../../../../api-server/src/lib/reportes-inventory.ts",
  "../../../../api-server/src/lib/reportes-commercial.ts",
  "../../../../api-server/src/lib/reportes.ts",
];

test("every backend report chart and table id has a visible explanation", () => {
  const ids = new Set<string>();
  for (const file of backendFiles) {
    const source = read(file);
    for (const match of source.matchAll(/(?:chart|table)\("([^"]+)"/g)) ids.add(match[1]);
    for (const match of source.matchAll(/tables:\s*\[\{\s*id:\s*"([^"]+)"/g)) ids.add(match[1]);
  }
  for (const id of ids) assert.ok(REPORT_BLOCK_EXPLANATIONS[id] || id === "pagos-dirigidos", `missing explanation for ${id}`);
  const charts = read("./report-charts.tsx");
  const tables = read("./report-table.tsx");
  assert.match(charts, /report-explanation-\$\{chart\.id\}/);
  assert.match(tables, /report-explanation-\$\{block\.id\}/);
  assert.match(charts, /chart\.series\?\.\[0\]\?\.kind/);
  assert.match(REPORT_BLOCK_EXPLANATIONS["perdidas-extraordinarias"], /permanece en cero/);
});

test("statistics outside Reportes render their sentence below each audited surface", () => {
  const dashboard = read("../../pages/dashboard.tsx");
  const comparison = read("../../pages/caja/comparativo.tsx");
  const customer = read("../../pages/cliente-detail.tsx");
  const customers = read("../../pages/clientes.tsx");
  const supplier = read("../../pages/proveedor-detail.tsx");
  assert.match(dashboard, /dashboard-inventory-explanation/);
  for (const id of ["comparison-sales-chart-explanation", "comparison-share-chart-explanation", "comparison-payment-chart-explanation", "comparison-table-explanation"]) assert.match(comparison, new RegExp(id));
  assert.match(customer, /Suma el total con IVA de ventas del cliente por mes/);
  assert.match(customer, /Agrupa tickets y ventas monetarias del cliente por mes/);
  assert.match(customers, /Top por utilidad/);
  assert.match(customers, /Agrupa el saldo monetario pendiente/);
  assert.match(customers, /Lista el saldo monetario y la antigüedad vigente/);
  for (const text of ["Compara el monto monetario comprado", "Agrupa el saldo monetario", "Suma el costo monetario", "Agrupa rollos, cantidad por unidad", "por tela dentro", "por color dentro"]) assert.match(supplier, new RegExp(text));
});