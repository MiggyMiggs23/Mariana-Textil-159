import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, styles] = await Promise.all([
  readFile(new URL("./salida-documento.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.css", import.meta.url), "utf8"),
]);

test("la salida usa A6 horizontal con cinco renglones medidos por página", () => {
  assert.match(styles, /@page salida-page[\s\S]*size:\s*148mm 105mm/);
  assert.match(page, /w-\[148mm\] h-\[105mm\]/);
  assert.match(page, /const rollosPerPage = 5/);
  assert.match(page, /5 × 20\.5/);
  assert.match(page, /rollosPerPage - pageRollos\.length/);
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
    "No. de<br/>Serie",
  ]) {
    assert.ok(page.includes(heading), `falta la columna ${heading}`);
  }
  assert.match(page, /formatUnit\(line\?\.unidadProducto\)/);
  assert.match(page, /\{rollo\.serie\}/);
  assert.match(page, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(page, /w-\[112px\][\s\S]*>Producto</);
  assert.match(page, /Catálogo aprobado \(154\): 106 px útiles cubren 141 nombres/);
  for (const signature of ["Revisó", "Entregó", "Recibió"]) {
    assert.match(page, new RegExp(`>${signature}<`));
  }
  assert.doesNotMatch(page, /pageIndex === totalPages - 1/);
});

test("ningún texto impreso baja de 7.5 puntos", () => {
  const pixelSizes = [...page.matchAll(/text-\[(\d+)px\]/g)].map((match) =>
    Number(match[1]),
  );
  assert.ok(pixelSizes.length > 0);
  assert.ok(Math.min(...pixelSizes) >= 10);
});