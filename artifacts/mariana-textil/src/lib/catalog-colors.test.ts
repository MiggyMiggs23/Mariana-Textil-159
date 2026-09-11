import assert from "node:assert/strict";
import test from "node:test";
import { catalogColorOptions, normalizeCatalogColor } from "./catalog-colors";

test("color options collapse case and edge whitespace without merging different colors", () => {
  const products = ["Oro", "ORO", "Oro ", " azul ", "Azul", "Azúl", "Palo  rosa", "Palo rosa", ""].map(color => ({ color }));
  const options = catalogColorOptions(products);
  assert.equal(options.length, 6);
  assert.equal(options.filter(c => c.key === "oro").length, 1);
  assert.equal(products.filter(p => normalizeCatalogColor(p.color) === "oro").length, 3);
  assert.deepEqual(catalogColorOptions([...products].reverse()), options);
  assert.ok(options.some(c => c.label === "(Sin color)"));
});

test("filtering before grouping retains only matching variants and visible counts", () => {
  const products = [
    { tela: "A", color: "Oro" }, { tela: "A", color: "Azul" },
    { tela: "B", color: "ORO " }, { tela: "C", color: "Rojo" },
  ];
  const surviving = products.filter(p => normalizeCatalogColor(p.color) === "oro");
  assert.deepEqual(surviving, [products[0], products[2]]);
  assert.deepEqual([...new Set(surviving.map(p => p.tela))], ["A", "B"]);
});