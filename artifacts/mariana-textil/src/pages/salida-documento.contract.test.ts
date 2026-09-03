import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, detailPage, styles] = await Promise.all([
  readFile(new URL("./salida-documento.tsx", import.meta.url), "utf8"),
  readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.css", import.meta.url), "utf8"),
]);

test("la salida usa A5 horizontal y conserva siete productos por página", () => {
  assert.match(styles, /@page salida-page[\s\S]*size:\s*210mm 148mm/);
  assert.match(page, /w-\[210mm\] h-\[148mm\]/);
  assert.match(page, /const productRowsPerPage = 7/);
  assert.match(page, /Se conserva la paginación existente/);
  assert.match(page, /productRowsPerPage - pageLineas\.length/);
  assert.match(page, /salida\.lineas\.slice/);
  assert.match(page, /Pág \{pageIndex \+ 1\}\/\{totalPages\}/);
});

test("encabezado, rótulos y columnas respetan el contrato operativo", () => {
  assert.match(page, /<PrintableDocumentHeader[\s\S]*qrUrl=\{qrUrl\}/);
  assert.match(page, />Salida<\/h1>/);
  assert.doesNotMatch(page, /HOJA DE SALIDA/);
  assert.doesNotMatch(page, /tracking-tighter uppercase leading-none">Salida/);
  assert.match(page, /printWhenReady\("print-salida"\)/);
  assert.match(page, /salida-document-shell/);
  assert.match(page, /salida-print-root/);
  assert.match(styles, /body\.print-salida \.salida-print-root\s*\{[\s\S]*page:\s*salida-page;[\s\S]*position:\s*static;/);
  assert.match(styles, /body\.print-salida #root \*:has\(\.salida-print-root\)\s*\{[\s\S]*display:\s*contents !important;/);
  assert.match(styles, /\.document-page:not\(\.entrada-page-print\):not\(\.salida-page-print\):not\(\.credito-page-print\)/);
  assert.match(page, /absoluteAppUrl\(`\/salidas\?tab=recepcion&id=\$\{salida.id\}`\)/);
  assert.doesNotMatch(page, /modalidad === "MOSTRADOR"[\s\S]*qrUrl/);
  assert.match(page, />Generó:</);
  assert.match(page, />Entregó:</);
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
  assert.doesNotMatch(page, /No\. de<br\/>Serie|\{rollo\.serie\}/);
  assert.match(page, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(page, /qrSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(page, /className="document-header relative z-10 shrink-0 bg-white p-6"/);
  for (const signature of ["Revisó", "Entregó", "Recibió"]) {
    assert.match(page, new RegExp(`>${signature}<`));
  }
  assert.doesNotMatch(page, /pageIndex === totalPages - 1/);
});

test("las series permanecen completas en el detalle de pantalla", () => {
  assert.match(detailPage, /Rollos Incluidos/);
  assert.match(detailPage, />Serie<\/th>/);
  assert.match(detailPage, /\{rollo\.serie\}/);
});

test("ningún texto impreso baja de 7.5 puntos", () => {
  const pixelSizes = [...page.matchAll(/text-\[(\d+)px\]/g)].map((match) =>
    Number(match[1]),
  );
  assert.ok(pixelSizes.length > 0);
  assert.ok(Math.min(...pixelSizes) >= 10);
});