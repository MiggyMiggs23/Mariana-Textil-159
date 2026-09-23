import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

test("E7 read-only UI is open while E5 operations stay closed", () => {
  const flags = read("../lib/e7-feature-flags.ts");
  const e5 = read("../lib/e5-feature-flags.ts");
  assert.match(flags, /E7_ENABLED = true/);
  assert.match(flags, /E7_UI_ENABLED = true/);
  assert.match(flags, /E7_CLIENT_FINANCIAL_READS_ENABLED = true/);
  assert.match(flags, /E7_ATTRIBUTION_ENABLED = true/);
  assert.match(flags, /e7ClientFinancialOn/);
  assert.match(e5, /E5_ENABLED = false/);
});

test("client detail consumes E7 JSON and exports without mounting attribution", () => {
  const readers = read("e7-readers.tsx");
  const detail = read("../pages/cliente-detail.tsx");
  assert.match(readers, /useGetE7ClienteExportacion/);
  assert.match(readers, /q\.data\.clienteFinanzas \?\? q\.data\.enabled/);
  assert.match(readers, /resumenGlobal\.deudaActual/);
  assert.match(readers, /resumenGlobal\.saldoAFavor/);
  assert.match(readers, /resumenGlobal\.limiteCredito/);
  assert.match(readers, /resumenGlobal\.creditoDisponible/);
  assert.match(readers, /estado-cuenta\.pdf/);
  assert.match(readers, /estado-cuenta\.xlsx/);
  assert.match(readers, /estado-cuenta\/imprimir/);
  assert.match(detail, /e7ClientFinancialOn\(\) \? <E7ClientExport clienteId=\{id\}/);
  assert.match(detail, /enabled: canFinances && !e7ClientFinancialOn\(\) && Number\.isFinite\(id\)/);
  assert.match(readers, /export function E7Attribution[\s\S]*if \(!e7On\(\)\) return null/);
});