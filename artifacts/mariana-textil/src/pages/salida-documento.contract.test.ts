import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, styles] = await Promise.all([
  readFile(new URL("./salida-documento.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.css", import.meta.url), "utf8"),
]);

test("la salida usa A6 horizontal con diez renglones por página", () => {
  assert.match(styles, /@page salida-page[\s\S]*size:\s*148mm 105mm/);
  assert.match(page, /w-\[148mm\] h-\[105mm\]/);
  assert.match(page, /const rollosPerPage = 10/);
  assert.match(page, /rollosPerPage - pageRollos\.length/);
  assert.match(page, /Pág \{pageIndex \+ 1\}\/\{totalPages\}/);
});

test("encabezado, rótulos y columnas respetan el contrato operativo", () => {
  const titleAt = page.indexOf("HOJA DE SALIDA");
  const logoAt = page.indexOf('<BrandLogo variant="mark"', titleAt);
  const qrAt = page.indexOf("<QRCodeSVG", logoAt);
  assert.ok(titleAt >= 0 && logoAt > titleAt && qrAt > logoAt);
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
});

test("ningún texto impreso baja de 7.5 puntos", () => {
  const pixelSizes = [...page.matchAll(/text-\[(\d+)px\]/g)].map((match) =>
    Number(match[1]),
  );
  assert.ok(pixelSizes.length > 0);
  assert.ok(Math.min(...pixelSizes) >= 10);
});