import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [documentPage, entryList, styles] = await Promise.all([
  readFile(new URL("./entrada-documento.tsx", import.meta.url), "utf8"),
  readFile(new URL("./entradas.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.css", import.meta.url), "utf8"),
]);

test("la entrada usa capacidad medida, tolerancia de impresión y pie en cada página", () => {
  assert.match(documentPage, /const rowsPerPage = 23/);
  assert.match(documentPage, /23 × 25/);
  assert.match(documentPage, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.doesNotMatch(documentPage, /pageIndex === totalPages - 1/);
  assert.match(documentPage, /document-footer/);
  assert.match(styles, /\.entrada-page-print\s*\{[\s\S]*width:\s*215\.5mm !important;[\s\S]*height:\s*278\.5mm !important;/);
});

test("la entrada se aísla para impresión sin ocultar su contenido", () => {
  assert.match(documentPage, /printWhenReady\("print-entrada"\)/);
  assert.match(documentPage, /entrada-print-root/);
  assert.match(styles, /body\.print-entrada \.entrada-print-root \*/);
  assert.match(styles, /visibility:\s*visible/);
  assert.match(styles, /height:\s*278\.5mm !important/);
});

test("la lista conserva enlaces permanentes y visibles al documento", () => {
  assert.match(entryList, /useListEntradas/);
  assert.match(entryList, /href=\{`\/entradas\/\$\{entrada\.id\}\/documento`\}/);
  assert.match(entryList, /text-blue-700 underline/);
  assert.match(entryList, /imprimir o guardar nuevamente/);
});