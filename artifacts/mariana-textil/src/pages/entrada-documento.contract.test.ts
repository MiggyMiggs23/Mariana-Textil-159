import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [documentPage, entryList, styles] = await Promise.all([
  readFile(new URL("./entrada-documento.tsx", import.meta.url), "utf8"),
  readFile(new URL("./entradas.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.css", import.meta.url), "utf8"),
]);

test("la entrada conserva su formato global y firma solo la última hoja global", () => {
  assert.match(documentPage, /const rowsPerPage = 23/);
  assert.match(documentPage, /23 × 25/);
  assert.match(documentPage, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(documentPage, /pageIndex === globalPages\.length - 1/);
  assert.match(documentPage, /document-footer/);
  assert.match(styles, /\.entrada-page-print \.document-footer\s*\{[\s\S]*break-inside:\s*avoid-page/);
  assert.match(styles, /\.entrada-page-print\s*\{[\s\S]*width:\s*215\.5mm !important;[\s\S]*height:\s*278\.5mm !important;/);
});

test("la entrada agrega un listado compacto de todas las series por producto", () => {
  assert.match(documentPage, /const seriesPerRow = 4/);
  assert.match(documentPage, /const seriesRowsPerPage = 40/);
  assert.match(documentPage, /40 filas × 24 px dejan 13\.59 px/);
  assert.match(documentPage, /41 filas rebasan la hoja por 10\.41 px/);
  assert.match(documentPage, /const embeddedSeriesRowsCapacity/);
  assert.match(documentPage, /seriesRows\.length <= embeddedSeriesRowsCapacity/);
  assert.match(documentPage, /const standaloneSeriesRows = embedsAllSeries \? \[\] : seriesRows/);
  assert.match(documentPage, /embedded-series/);
  assert.match(documentPage, /embeddedRows\.length > 0 \? 0/);
  assert.match(documentPage, /rollosByProducto\.get\(linea\.productoId\)/);
  assert.match(documentPage, /productRollos\.slice\(chunkIndex \* seriesPerRow/);
  assert.match(documentPage, /data-page-kind="series"/);
  assert.match(documentPage, />Listado de series</);
  assert.match(documentPage, /Serie \{index \+ 1\}/);
  assert.match(documentPage, /row\.series\[seriesIndex\]\?\.serie/);
  assert.match(documentPage, /const totalPages = globalPages\.length \+ seriesPages\.length/);
  assert.match(documentPage, /renderSeriesHeader\(pageNumber\)/);
  assert.match(documentPage, /Folio/);
  assert.match(documentPage, /Página \{pageNumber\} de \{totalPages\}/);

  const seriesSection = documentPage.slice(documentPage.indexOf("{seriesPages.map"));
  assert.doesNotMatch(seriesSection, /document-footer/);
  assert.doesNotMatch(seriesSection, /PrintableDocumentHeader|DOCUMENT_QR_SIZE|Agrupado por producto/);
  assert.doesNotMatch(seriesSection, /h-4 bg-\[#1e3a8a\] w-full shrink-0 mt-auto/);
  assert.match(styles, /\.entrada-page-print\s*\{[\s\S]*overflow:\s*clip !important/);
  assert.match(styles, /\.entrada-page-print \+ \.entrada-page-print\s*\{[\s\S]*break-before:\s*page/);
  assert.doesNotMatch(styles, /\.entrada-page-print\s*\{[\s\S]*?break-after:\s*page/);
  assert.match(styles, /body\.print-entrada \.entrada-print-root\s*\{[\s\S]*page:\s*entrada-page/);
});

test("los globales conservan cada producto y unidad por separado", () => {
  assert.match(documentPage, /entrada\.lineas\.slice/);
  assert.match(documentPage, /linea\.rollosCount/);
  assert.match(documentPage, /linea\.cantidadTotal/);
  assert.match(documentPage, /formatUnit\(linea\.unidadProducto\)/);
  assert.doesNotMatch(documentPage, /const totalQty = entrada\.lineas\.reduce/);
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