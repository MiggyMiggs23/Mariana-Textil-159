import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

test("la hoja diaria tiene documento, acción y reglas de impresión independientes", () => {
  assert.match(source, /HojaVentasDiaPrint/);
  assert.match(source, /Imprimir hoja de ventas/);
  assert.match(source, /print-hoja-ventas/);
  assert.match(source, /Imprimir Corte/);
  assert.match(source, /ROLLOS/);
  assert.match(source, /METRAJE/);
  assert.match(source, /totalRollos/);
  assert.match(source, /totalMetros/);
  assert.match(source, /totalKilos/);
  assert.match(source, /ivaFacturado/);
  assert.match(source, /quienCerro/);
  assert.doesNotMatch(source.slice(source.indexOf("function HojaVentasDiaPrint")), /serie/i);
  assert.match(css, /body\.print-hoja-ventas/);
  assert.match(css, /\.hoja-ventas-print/);
});