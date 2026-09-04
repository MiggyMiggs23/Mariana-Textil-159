import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const list = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("./detail.tsx", import.meta.url), "utf8");

test("price list renders and filters missing prices explicitly", () => {
  assert.match(list, /modeData\.precioLista == null \? "Sin precio"/);
  assert.match(list, /data-testid="filter-sin-precio"/);
  assert.match(list, /sinPrecio: sinPrecio \|\| undefined/);
  assert.doesNotMatch(list, /precioLista[^;\n]*\?\s*formatNumber[^;\n]*:\s*["']\$?0\.00/);
});

test("detail starts an empty first-price form without presenting zero", () => {
  assert.match(detail, /setPrecioNuevo\(currentModePrice \|\| ""\)/);
  assert.match(detail, /precioLista == null \? "Sin precio"/);
});