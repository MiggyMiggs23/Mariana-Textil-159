import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catálogo agrupado conserva unidad, especificaciones y totales separados", async () => {
  const source = await readFile(new URL("./productos.tsx", import.meta.url), "utf8");
  assert.match(source, /inherited\?\.unidad/);
  assert.match(source, /inherited\?\.anchoCm/);
  assert.match(source, /inherited\?\.composicion/);
  assert.match(source, /inherited\?\.gramajeGm2/);
  assert.match(source, /totalsByUnit/);
  assert.match(source, /total-tela-/);
  assert.match(source, /String\(product\.unidad\) === "BOLSA"/);
  assert.match(source, /Vista previa no autoritativa/);
});