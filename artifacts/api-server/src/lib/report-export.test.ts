import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_MODALITY,
  PURCHASE_MODALITY,
  UNATTRIBUTED_MODALITY,
  createReportWorkbook,
  excelColumnName,
  normalizeExportTables,
} from "./report-export";

test("export normalization adds modality and keeps non-applicable sections explicit", () => {
  const [inventory] = normalizeExportTables("inventario", [], [{
    id: "existencia-actual", title: "Existencia", columns: [{ key: "sku", label: "SKU", kind: "text" }],
    rows: [{ sku: "A" }], totals: {},
  }]);
  assert.equal(inventory.columns.at(-1)?.label, "Modalidad");
  assert.equal(inventory.rows[0]?.modalidad, INVENTORY_MODALITY);

  const [purchases] = normalizeExportTables("compras", ["modalidad=METRAJE"], [{
    id: "productos", title: "Compras", columns: [{ key: "sku", label: "SKU", kind: "text" }],
    rows: [{ sku: "A" }], totals: {},
  }]);
  assert.equal(purchases.rows[0]?.modalidad, PURCHASE_MODALITY);

  const [unattributed] = normalizeExportTables("clientes", [], [{
    id: "publico-registrado", title: "Público", columns: [{ key: "tipo", label: "Tipo", kind: "text" }],
    rows: [{ tipo: "Registrado" }], totals: {},
  }]);
  assert.equal(unattributed.rows[0]?.modalidad, UNATTRIBUTED_MODALITY);

  const [filtered] = normalizeExportTables("clientes", ["modalidad=ROLLOS"], [{
    id: "publico-registrado", title: "Público", columns: [{ key: "tipo", label: "Tipo", kind: "text" }],
    rows: [{ tipo: "Registrado" }], totals: {},
  }]);
  assert.equal(filtered.rows[0]?.modalidad, "ROLLOS");

  const [credit] = normalizeExportTables("clientes", ["modalidad=METRAJE"], [{
    id: "cuentas-por-cobrar-fifo", title: "Crédito", columns: [{ key: "saldo", label: "Saldo", kind: "money" }],
    rows: [{ saldo: 100 }], totals: {},
  }]);
  assert.equal(credit.rows[0]?.modalidad, UNATTRIBUTED_MODALITY);
});

test("export normalization preserves sale modality and pending financial groups", () => {
  const [table] = normalizeExportTables("utilidad", ["modalidad=METRAJE"], [{
    id: "utilidad", title: "Utilidad", columns: [
      { key: "modalidad", label: "Modalidad", kind: "text" },
      { key: "costo", label: "Costo", kind: "money" },
      { key: "utilidad", label: "Utilidad", kind: "money" },
      { key: "margenPct", label: "Margen", kind: "percentage" },
      { key: "observacion", label: "Observación", kind: "text" },
    ],
    rows: [{ modalidad: "METRAJE", costo: null, utilidad: null, margenPct: null, observacion: null }],
    totals: { costo: 0, utilidad: 0, margenPct: 0 },
  }]);
  assert.deepEqual(table.rows[0], {
    modalidad: "METRAJE", costo: "Pendiente", utilidad: "Pendiente",
    margenPct: "Pendiente", observacion: null,
  });
  assert.equal(table.totals.costo, "Pendiente");
  assert.equal(table.totals.utilidad, "Pendiente");
  assert.equal(excelColumnName(27), "AA");
});

test("generated workbook has modality header, filter metadata, pending cells, and no redacted money", () => {
  const tables = normalizeExportTables("utilidad", ["modalidad=METRAJE"], [{
    id: "por-modalidad", title: "Por modalidad", columns: [
      { key: "ventas", label: "Ventas", kind: "money", economic: true },
      { key: "costo", label: "Costo", kind: "money", economic: true },
    ], rows: [{ ventas: 150, costo: null }], totals: {},
  }]);
  const workbook = createReportWorkbook({
    section: "utilidad", generatedAt: "2025-01-01", range: {}, activeFilters: ["modalidad=METRAJE"],
    kpis: [], tables,
  });
  const sheet = workbook.getWorksheet("Por modalidad")!;
  const headers = sheet.getRow(1).values;
  assert.equal(Array.isArray(headers) && headers.includes("Modalidad"), true);
  assert.equal(sheet.getCell("C2").value, "METRAJE");
  assert.equal(sheet.getCell("B2").value, "Pendiente");
  assert.deepEqual(sheet.autoFilter, { from: "A1", to: "C1" });
  assert.equal(workbook.getWorksheet("Periodo")!.getCell("B5").value, "METRAJE");

  const redacted = createReportWorkbook({
    section: "ventas", generatedAt: "", range: {}, activeFilters: [],
    kpis: [], tables: normalizeExportTables("ventas", [], [{
      id: "operativo", title: "Operativo", columns: [{ key: "tickets", label: "Tickets", kind: "count" }],
      rows: [{ tickets: 1 }], totals: { tickets: 1 },
    }]),
  });
  const redactedHeaders = redacted.getWorksheet("Operativo")!.getRow(1).values;
  assert.equal(Array.isArray(redactedHeaders) && redactedHeaders.includes("Ventas"), false);
});

test("Excel number formats preserve report precision by kind", () => {
  const workbook = createReportWorkbook({
    section: "ventas", generatedAt: "", range: {}, activeFilters: [], kpis: [
      { label: "Tickets", value: 12, kind: "count" },
      { label: "Metros", value: 1.234, kind: "quantity" },
    ], tables: [],
  });
  const sheet = workbook.getWorksheet("Indicadores")!;
  assert.equal(sheet.getCell("B2").numFmt, "#,##0");
  assert.equal(sheet.getCell("B3").numFmt, "#,##0.000");
});