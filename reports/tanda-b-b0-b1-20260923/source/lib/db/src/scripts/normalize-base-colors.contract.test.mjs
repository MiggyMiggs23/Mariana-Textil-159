import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("normalización Base es operator-only, revisable e idempotente", async () => {
  const source = await readFile(new URL("./normalize-base-colors.mjs", import.meta.url), "utf8");
  assert.match(source, /\["Manta Libano", "Crudo"\]/);
  assert.match(source, /\["Manta Libanito", "Crudo"\]/);
  assert.match(source, /startsWith\("PELLON"\) \? "Blanco"/);
  assert.match(source, /Casos no autorizados/);
  assert.match(source, /Snapshots SKU autorizados/);
  assert.match(source, /SELECT id, tela, color, sku FROM productos ORDER BY/);
  assert.match(source, /UPDATE productos SET tela = \$1, color = \$2, sku = \$3/);
  assert.match(source, /Colisiones previstas/);
  assert.match(source, /colisiones tela\/color o SKU/);
  assert.match(source, /NORMALIZE_BASE_COLORS_CONFIRM/);
  assert.match(source, /ROLLBACK/);
});