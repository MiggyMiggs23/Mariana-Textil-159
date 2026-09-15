import assert from "node:assert/strict";
import test from "node:test";
import { createTextPdf, wrapPdfLines } from "./pdf";

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