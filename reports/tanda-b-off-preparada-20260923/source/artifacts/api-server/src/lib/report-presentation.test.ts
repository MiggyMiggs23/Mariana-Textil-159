import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReportFilters,
  formatReportRange,
  hasMeaningfulTotals,
  reportTotalLabel,
} from "./report-presentation";

test("report presentation uses a Mexico City human date range and catalog labels", () => {
  assert.equal(
    formatReportRange({
      desde: "2026-01-01T06:00:00.000Z",
      hasta: "2027-01-01T05:59:59.999Z",
      previousDesde: "not for display",
      yearAgoDesde: "not for display",
    }),
    "Del 1 de enero al 31 de diciembre de 2026",
  );
  assert.deepEqual(
    formatReportFilters(
      ["ubicacionIds=1,2", "productoIds=9", "facturado=true"],
      {
        sites: [{ id: 1, label: "Tienda Centro" }, { id: 2, label: "Bodega" }],
        products: [{ id: 9, label: "SKU-9 — Algodón Azul" }],
      },
    ),
    [
      "Ubicaciones: Tienda Centro, Bodega",
      "Productos: SKU-9 — Algodón Azul",
      "Facturado: Sí",
    ],
  );
});

test("total label only uses text columns, never a numeric string amount", () => {
  assert.equal(hasMeaningfulTotals({ importe: "0.00" }), true);
  assert.deepEqual(
    reportTotalLabel(
      [{ key: "importe", kind: "money" }, { key: "descripcion", kind: "text" }],
      { importe: "0.00" },
    ),
    { key: "descripcion", value: "Total general" },
  );
});