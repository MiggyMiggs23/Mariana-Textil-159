import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);

test("product catalog keeps textile specification columns hidden until selected", async () => {
  const page = await readFile(new URL("./productos.tsx", root), "utf8");
  assert.match(
    page,
    /useHistoryEntryState<Set<string>>\("productos\.spec-columns", \(\) => new Set\(\)\)/,
  );
  assert.match(page, /checkbox-product-column-\$\{column\}/);
  assert.match(page, /\["anchoCm", "Ancho"\]/);
  assert.match(page, /\["composicion", "Composición"\]/);
  assert.match(page, /\["gramajeGm2", "Gramaje"\]/);
  assert.match(page, /input-product-ancho/);
  assert.match(page, /input-product-composicion/);
  assert.match(page, /input-product-gramaje/);
});

test("product detail displays units and gates editing by effective permission", async () => {
  const page = await readFile(new URL("./producto-detail.tsx", root), "utf8");
  assert.match(page, /hasPermission\(user, Modules\.PRODUCTOS, "editar"\)/);
  assert.match(page, /text-product-ancho-cm/);
  assert.match(page, /text-product-gramaje-gm2/);
  assert.match(page, /g\/m²/);
  assert.match(page, /input-edit-composicion/);
});