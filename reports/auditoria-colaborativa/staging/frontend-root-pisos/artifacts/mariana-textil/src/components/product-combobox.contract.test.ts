import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Producto } from "@workspace/api-client-react";
import { formatUnit } from "@workspace/number-format";
import { ProductCombobox } from "./product-combobox";

type CatalogSnapshot = {
  counts: { all: number };
  products: Producto[];
};

async function readCatalog(): Promise<CatalogSnapshot> {
  const source = await readFile(
    new URL("../../../../reports/entradas-ajustes/catalogo.json", import.meta.url),
    "utf8",
  );
  return JSON.parse(source) as CatalogSnapshot;
}

test("the selected summary keeps the complete product identity below the input", async () => {
  const catalog = await readCatalog();
  const selected = catalog.products.find(
    (product) =>
      product.tela === "Mezclilla Diamantina 10 Oz" &&
      product.color === "Indigo Rayada",
  );
  assert.ok(selected);

  const markup = renderToStaticMarkup(
    createElement(ProductCombobox, {
      products: catalog.products,
      value: String(selected.id),
      onValueChange: () => undefined,
      testId: "product",
    }),
  );

  assert.match(markup, /data-testid="product-selected-summary"/);
  assert.match(markup, new RegExp(selected.tela));
  assert.match(markup, new RegExp(selected.color));
  assert.match(markup, new RegExp(selected.sku));
  assert.match(markup, new RegExp(formatUnit(selected.unidad)));
});

test("all real catalog rows use un-clipped tela, color, and SKU lines", async () => {
  const catalog = await readCatalog();
  const source = await readFile(new URL("product-combobox.tsx", import.meta.url), "utf8");

  assert.equal(catalog.counts.all, 1234);
  assert.equal(catalog.products.length, catalog.counts.all);
  assert.ok(catalog.products.every((product) => product.tela.length > 0));
  assert.ok(catalog.products.every((product) => product.color.length > 0));
  assert.ok(catalog.products.every((product) => product.sku.length > 0));

  assert.match(source, /filtered\.map\(\(product, index\) =>/);
  assert.match(source, /data-testid=\{`\$\{testId\}-option-\$\{product\.id\}`\}/);
  assert.match(source, /product\.tela\}/);
  assert.match(source, /product\.color\}/);
  assert.match(source, /product\.sku\}/);
  assert.match(source, /overflowWrap: "anywhere"/);
  assert.doesNotMatch(source, /\btruncate\b|line-clamp|text-ellipsis/);
});

test("pending search follows dirty, selected, and cleared input states", async () => {
  const source = await readFile(new URL("product-combobox.tsx", import.meta.url), "utf8");

  assert.match(source, /onPendingSearchChange\?: \(pending: boolean\) => void/);
  assert.match(
    source,
    /onPendingSearchChange\?\.\(Boolean\(query\.trim\(\)\) && !selected\)/,
  );
  assert.match(
    source,
    /}, \[onPendingSearchChange, query, selected\?\.id\]\);/,
  );

  // Typing clears the selected value but keeps the visible query for filtering.
  assert.match(
    source,
    /setQuery\(event\.target\.value\);\s*onValueChange\(""\);\s*setOpen\(true\);/,
  );
  // Selecting a row restores a valid value and closes the list.
  assert.match(
    source,
    /onValueChange\(String\(product\.id\)\);\s*setQuery\(productLabel\(product\)\);\s*setOpen\(false\);/,
  );
  // Resetting while the list is closed clears the query; while typing, it does not.
  assert.match(
    source,
    /if \(!value\) \{\s*if \(!open\) setQuery\(""\);\s*return;/,
  );
});