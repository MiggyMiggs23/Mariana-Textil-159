import assert from "node:assert/strict";
import test from "node:test";
import {
  countBelowCost,
  findDuplicateRawTelaSpellings,
  groupPricesByTela,
  isBulkSelectable,
} from "./precio-groups";

const product = (id: number, tela: string, color: string, sku: string) => ({
  id,
  tela,
  color,
  sku,
});

test("groups trimmed case-insensitive telas and preserves first spelling", () => {
  const groups = groupPricesByTela([
    product(1, " Lino 10 ", "Azul 10", "10"),
    product(2, "lino 10", "Azul 2", "2"),
    product(3, "Ábaco", "Crudo", "3"),
  ]);

  assert.deepEqual(groups.map(({ tela }) => tela), ["Ábaco", " Lino 10 "]);
  assert.deepEqual(groups[1].products.map(({ id }) => id), [2, 1]);
  assert.deepEqual(findDuplicateRawTelaSpellings([
    product(1, " Lino 10 ", "Azul 10", "10"),
    product(2, "lino 10", "Azul 2", "2"),
  ]), [
    { normalizedTela: "lino 10", spellings: [" Lino 10 ", "lino 10"] },
  ]);
});

test("bulk selectability follows mode and fragmented-sale constraints", () => {
  assert.equal(isBulkSelectable({ unidad: "KILO", seVendePorMetro: true }, "ROLLO"), true);
  assert.equal(isBulkSelectable({ unidad: "KILO", seVendePorMetro: true }, "MAYOREO"), false);
  assert.equal(isBulkSelectable({ unidad: "METRO", seVendePorMetro: false }, "MENUDEO"), false);
  assert.equal(isBulkSelectable({ unidad: "METRO", seVendePorMetro: true }, "MENUDEO"), true);
});

test("below-cost warning uses every selected row's active-mode cost", () => {
  const products = [
    { preciosPorModo: { ROLLO: { costoUnitarioBase: "11" } } },
    { preciosPorModo: { ROLLO: { costoUnitarioBase: "8" } } },
    { preciosPorModo: { ROLLO: { costoUnitarioBase: null } } },
  ];
  assert.equal(countBelowCost(products, "ROLLO", 10), 1);
});