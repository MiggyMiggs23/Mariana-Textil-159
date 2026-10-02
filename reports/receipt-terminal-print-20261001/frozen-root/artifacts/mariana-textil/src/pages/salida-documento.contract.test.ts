import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const [page, detailPage, styles, pdfHarness] = await Promise.all([
  readFile(new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root), "utf8"),
  readFile(new URL("artifacts/mariana-textil/src/pages/salida-detail.tsx", root), "utf8"),
  readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8"),
  readFile(new URL("artifacts/mariana-textil/src/pages/laser-documents-pdf-regression.test.mjs", root), "utf8"),
]);

test("la salida usa A5 horizontal, caja segura interna y diez renglones medidos", () => {
  assert.match(styles, /@page salida-page[\s\S]*size:\s*210mm 148mm/);
  assert.match(
    styles,
    /\.salida-page-print\s*\{[\s\S]*width:\s*210mm !important;[\s\S]*height:\s*148mm !important;[\s\S]*padding:\s*5\.25mm !important;[\s\S]*box-sizing:\s*border-box;[\s\S]*overflow:\s*visible !important;/,
  );
  assert.match(page, /w-\[210mm\] h-\[148mm\]/);
  assert.match(page, /const SALIDA_PRODUCT_ROWS_PER_PAGE = 10;/);
  assert.match(page, /5\.25 mm page-box inset/);
  assert.match(page, /199\.5 ×[\s*]*137\.5 mm inner frame/);
  assert.match(page, /boundary scenario is eleven rows/);
  assert.match(page, /SALIDA_PRODUCT_ROWS_PER_PAGE - pageLineas\.length/);
  assert.match(page, /salida\.lineas\.slice/);
  assert.match(page, /Pág \{pageIndex \+ 1\}\/\{totalPages\}/);
  assert.match(page, /pageIndex \* SALIDA_PRODUCT_ROWS_PER_PAGE \+ index \+ 1/);
  assert.match(page, /data-row-capacity=\{SALIDA_PRODUCT_ROWS_PER_PAGE\}/);
  assert.match(page, /document-product-grid/);
  assert.match(page, /salida-page-frame[^"]*border[^"]*bg-white/);
  assert.doesNotMatch(page, /salida-page-print[^"]*overflow-hidden/);
  assert.match(pdfHarness, /salidas\/\$\{scenario\.id\}\/documento\/salida/);
  assert.match(pdfHarness, /count-1/);
  assert.match(pdfHarness, /count-10/);
  assert.match(pdfHarness, /count-11-boundary/);
  assert.match(pdfHarness, /getBoundingClientRect/);
  for (const exportedHelper of [
    "launchChromium",
    "createPage",
    "closePage",
    "evaluate",
    "extractPdf",
    "findRasterTool",
    "assertRasterSafeArea",
    "inspectPdfTextBounds",
    "assertPdfTextSafeArea",
  ]) {
    assert.match(
      pdfHarness,
      exportedHelper === "assertPdfTextSafeArea"
        ? /export const assertPdfTextSafeArea/
        : new RegExp(`export (?:async )?function ${exportedHelper}\\b`),
    );
  }
  assert.match(pdfHarness, /isDirectExecution/);
});

test("encabezado, metadatos, totales, observaciones y tres firmas permanecen visibles", () => {
  assert.match(page, /<PrintableDocumentHeader[\s\S]*qrUrl=\{qrUrl\}/);
  assert.match(page, /<h1[^>]*>Salida<\/h1>/);
  assert.match(page, /printWhenReady\("print-salida"\)/);
  assert.match(page, /salida-document-shell/);
  assert.match(page, /salida-print-root/);
  assert.match(page, /absoluteAppUrl\(`\/salidas\?tab=recepcion&id=\$\{salida.id\}`\)/);
  assert.match(page, />Generó:</);
  assert.match(page, />Entregó:</);
  assert.match(page, /data-testid="doc-origin-name">\{salida\.nombreOrigen\}/);
  assert.match(
    page,
    /data-testid="doc-destination-name">\{isVentaCliente \? "Cliente recoge en origen" : salida\.nombreDestino\}/,
  );
  for (const heading of [
    "Producto",
    "Color",
    "No. de<br/>Rollos",
    "Cant. de<br/>Unidad",
    "SKU",
  ]) {
    assert.ok(page.includes(heading), `falta la columna ${heading}`);
  }
  assert.match(page, /formatUnit\(line\.unidadProducto\)/);
  assert.match(page, /formatNumber\(line\.rollosEnviados/);
  assert.match(page, /formatNumber\(line\.cantidadEnviada/);
  assert.match(page, /Observaciones/);
  assert.match(page, /formatNumber\(salida\.totalMetros \?\? 0/);
  for (const signature of ["Revisó", "Entregó", "Recibió"]) {
    assert.match(page, new RegExp(`>${signature}<`));
  }
  assert.match(page, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(page, /qrSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(page, /qrWrapperClassName="salida-qr-white-pad bg-white p-\[2mm\]"/);
});

test("la salida no imprime series y el detalle conserva el inventario serializado", () => {
  assert.doesNotMatch(page, /No\. de<br\/>Serie|\{rollo\.serie\}/);
  assert.match(detailPage, /Rollos Incluidos/);
  assert.match(detailPage, />Serie<\/th>/);
  assert.match(detailPage, /\{rollo\.serie\}/);
});

test("ningún texto impreso baja de 7.5 puntos ni se recorta con truncado", () => {
  const pixelSizes = [...page.matchAll(/text-\[(\d+)px\]/g)].map((match) =>
    Number(match[1]),
  );
  assert.ok(pixelSizes.length > 0);
  assert.ok(Math.min(...pixelSizes) >= 10);
  assert.doesNotMatch(page, /\btruncate\b/);
  assert.doesNotMatch(page, /overflow-hidden|overflow-clip/);
});

test("la salida conserva color, logo y QR con marco blanco", () => {
  assert.doesNotMatch(page, /data-print-palette="monochrome"|logoVariant="monochrome"|salida-monochrome/);
  assert.doesNotMatch(styles, /filter:\s*grayscale\(1\)/);
  assert.match(page, /bg-\[#1e3a8a\]/);
  assert.match(page, /text-\[#1e3a8a\]/);
  assert.match(page, /text-red-600/);
  assert.match(styles, /\.salida-page-print \.salida-qr-white-pad\s*\{[\s\S]*background-color:\s*#fff !important;/);
});