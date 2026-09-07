import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");

test("pricing groups default closed, search opens them, and mode clears selection", () => {
  assert.match(source, /useState<Set<string>>\(new Set\(\)\)/);
  assert.match(source, /debouncedSearch\.trim\(\)[\s\S]*setExpandedGroups\(new Set\(groups\.map/);
  assert.match(source, /else \{\s*setExpandedGroups\(new Set\(\)\)/);
  assert.match(source, /const changeMode[\s\S]*setSelectedIds\(new Set\(\)\)/);
});

test("group and child selection honor active-mode selectability", () => {
  assert.match(source, /isBulkSelectable\(product, activeMode\)/);
  assert.match(source, /checked=\{groupIndeterminate \? "indeterminate" : groupChecked\}/);
  assert.match(source, /toggleGroup\(group\.products, checked === true\)/);
  assert.match(source, /Los productos por kilo no admiten este modo/);
});

test("bulk contract validates, confirms below cost, mutates, and refreshes", () => {
  assert.match(source, /numericBulkPrice > 0/);
  assert.match(source, /selectedIds\.size <= 200/);
  assert.match(source, /bulkReason\.trim\(\)\.length >= 5/);
  assert.match(source, /productoIds: \[\.\.\.selectedIds\]/);
  assert.match(source, /precioListaNuevo: numericBulkPrice\.toFixed\(2\)/);
  assert.match(source, /modoPrecio: activeMode/);
  assert.match(source, /countBelowCost\(selectedProducts, activeMode, numericBulkPrice\)/);
  assert.match(source, /Confirmar debajo del costo/);
  assert.match(source, /invalidateQueries\(\{ queryKey: getListPreciosQueryKey\(\) \}\)/);
});

test("group financial cells explicitly remain unaggregated", () => {
  assert.match(source, /Group money\/margin values are never aggregated or averaged/);
  assert.match(source, /toolbar-precios-masivo/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /missingPriceCount[\s\S]*sin precio/);
  assert.match(source, /colSpan=\{9\}/);
  assert.match(source, /duplicate\.spellings\.map/);
});