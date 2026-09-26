import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stockMinimosPage = await readFile(new URL("./stock-minimos.tsx", import.meta.url), "utf8");

test("la alerta puede abrir stock mínimo con sitio y producto sin crear otro selector", () => {
  assert.match(stockMinimosPage, /useSearch/);
  assert.match(stockMinimosPage, /params\.get\("ubicacionId"\)/);
  assert.match(stockMinimosPage, /params\.get\("productoId"\)/);
  assert.match(stockMinimosPage, /setSelectedLocationId\(deepLinkedLocationId\)/);
  assert.match(stockMinimosPage, /user\?\.alcanceConsulta === "TODAS"/);
  assert.match(stockMinimosPage, /selectedLocationId \?\? user\?\.ubicacion\?\.id/);
  assert.doesNotMatch(stockMinimosPage, /<Select[^>]*>[\s\S]*?(sitio|ubicaci)/i);
});

test("el enlace mantiene el alcance operativo y enfoca el producto con sus cifras", () => {
  assert.match(stockMinimosPage, /user\?\.rol === "ADMIN"/);
  assert.match(stockMinimosPage, /user\?\.rol === "SUPERVISOR"/);
  assert.match(stockMinimosPage, /user\?\.rol !== "CAJA"/);
  assert.match(stockMinimosPage, /user\?\.rol !== "TERMINAL"/);
  assert.match(stockMinimosPage, /user\?\.ubicacion\?\.id === ubicacionId/);
  assert.match(stockMinimosPage, /PROPIA\/CAJA\/TERMINAL/);
  assert.match(stockMinimosPage, /data-testid="stock-minimos-deep-link-selection"/);
  assert.match(stockMinimosPage, /Existencia:/);
  assert.match(stockMinimosPage, /Mínimo:/);
  assert.match(stockMinimosPage, /Déficit:/);
  assert.match(stockMinimosPage, /href=\{`\/productos\/\$\{producto\.productoId\}`\}/);
  assert.match(stockMinimosPage, /minimumDeficit\(producto\)/);
});

test("la tabla de captura es desplazable y sus controles tienen nombre accesible", () => {
  assert.match(stockMinimosPage, /overflow-x-auto overscroll-x-contain/);
  assert.match(stockMinimosPage, /role="region"/);
  assert.match(stockMinimosPage, /aria-label="Productos y mínimos del sitio/);
  assert.match(stockMinimosPage, /aria-label="Activar stock mínimo para el sitio"/);
  assert.match(stockMinimosPage, /aria-label="Buscar productos para stock mínimo"/);
});