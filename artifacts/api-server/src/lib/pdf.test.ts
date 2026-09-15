import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createReadableReportPdf, createTextPdf, wrapPdfLines } from "./pdf";

test("composed PDF wraps wide and unbroken rows without losing trailing columns", () => {
  const source = `Serie: ${"W".repeat(180)} | Última columna: 543533`;
  const lines = wrapPdfLines([source, "", "Total General: 103302"]);
  assert.ok(lines.every((line) => line.length <= 58));
  assert.equal(lines.join("").replace(/\s/g, ""), `${source}Total General: 103302`.replace(/\s/g, ""));
  assert.ok(lines.join("\n").includes("543533"));
});

test("wrapped composed PDF paginates rather than truncating rows", () => {
  const lines = wrapPdfLines(Array.from({ length: 60 }, (_, index) => `Fila ${index}: ${"W".repeat(180)}`));
  const pdf = createTextPdf("Reporte", lines).toString("ascii");
  assert.ok(lines.length > 60);
  assert.ok(pdf.includes(`/Count ${Math.ceil(lines.length / 55)}`));
  assert.ok(pdf.includes("Fila 59:"));
  assert.ok(pdf.endsWith("%%EOF"));
});

test("report PDF embeds Spanish accents and arrows in a real table", async () => {
  const pdf = await createReadableReportPdf({
    section: "ventas",
    generatedAt: "2026-01-01T12:00:00.000Z",
    range: {
      desde: "2026-01-01T06:00:00.000Z",
      hasta: "2027-01-01T05:59:59.999Z",
      previousDesde: "internal",
      yearAgoDesde: "internal",
    },
    activeFilters: ["modalidad=TODO"],
    tables: [{
      id: "unicode",
      title: "Página · Día · Participación →",
      columns: [
        { key: "dia", label: "Día", kind: "text" },
        { key: "participacion", label: "Participación", kind: "percentage" },
        { key: "direccion", label: "Dirección →", kind: "text" },
      ],
      rows: [{ dia: "Página", participacion: 12.5, direccion: "→" }],
      totals: { dia: "Total General", participacion: 12.5 },
    }],
  });
  const path = join(tmpdir(), `report-pdf-unicode-${process.pid}.pdf`);
  try {
    writeFileSync(path, pdf, { mode: 0o600 });
    const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
    assert.match(text, /Página/);
    assert.match(text, /Día/);
    assert.match(text, /Participación/);
    assert.match(text, /→/);
    assert.doesNotMatch(text, /previousDesde|yearAgoDesde|�/);
  } finally {
    rmSync(path, { force: true });
  }
});

test("long report rows split with repeated headers and stay inside landscape geometry", async () => {
  const pdf = await createReadableReportPdf({
    section: "que-comprar",
    generatedAt: "2026-01-01T12:00:00.000Z",
    range: {
      desde: "2026-01-01T06:00:00.000Z",
      hasta: "2027-01-01T05:59:59.999Z",
    },
    activeFilters: [],
    tables: [{
      id: "long-row",
      title: "Evidencia extensa",
      columns: [
        { key: "sku", label: "SKU", kind: "text" },
        { key: "evidencia", label: "Evidencia", kind: "text" },
        { key: "cantidad", label: "Cantidad", kind: "quantity" },
      ],
      rows: [{
        sku: "SKU-LONG",
        evidencia: `${"movimiento observado con detalle ".repeat(500)}FIN-LONG-ROW`,
        cantidad: 1234,
      }],
      totals: {},
    }],
  });
  const path = join(tmpdir(), `report-pdf-long-row-${process.pid}.pdf`);
  try {
    writeFileSync(path, pdf, { mode: 0o600 });
    const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
    const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
    assert.match(text, /SKU-LONG/);
    assert.match(text, /FIN-LONG-ROW/);
    assert.ok((text.match(/^SKU$/gm) ?? []).length > 1);
    assert.match(info, /Pages:\s+[2-9]\d*/);
    assert.match(info, /Page size:\s+841(?:\.\d+)? x 595(?:\.\d+)? pts/);
  } finally {
    rmSync(path, { force: true });
  }
});