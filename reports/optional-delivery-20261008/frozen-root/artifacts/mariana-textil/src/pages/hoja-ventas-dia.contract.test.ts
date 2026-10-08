import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");

test("Caja conserva el corte y no imprime hoja diaria de ventas", () => {
  assert.match(source, /Imprimir Corte/);
  assert.match(source, /Corte y Cierre de Caja/);
  assert.doesNotMatch(source, /HojaVentasDiaPrint|Imprimir hoja de ventas|print-hoja-ventas/);
});