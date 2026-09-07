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
  assert.match(source, /formatUnit\(unidad\)/);
  assert.match(source, /value=\{UnidadProducto\.BOLSA\}/);
  assert.match(source, /value=\{UnidadProducto\.PIEZA\}/);
  assert.match(source, /physicalCountLabel/);
  assert.match(source, /Vista previa no autoritativa/);
});

test("precio sugerido opcional conserva null, cero y la presentación requerida", async () => {
  const source = await readFile(new URL("./productos.tsx", import.meta.url), "utf8");
  const detailSource = await readFile(new URL("./producto-detail.tsx", import.meta.url), "utf8");
  const auditSource = await readFile(new URL("./auditorias-inventario.tsx", import.meta.url), "utf8");

  assert.match(source, /precioSugerido: formData\.precioSugerido === "" \? null : formData\.precioSugerido/);
  assert.match(source, /inherited\?\.precioSugerido \?\? ""/);
  assert.match(auditSource, /precioSugerido: inherited\.precioSugerido \?\? null/);
  assert.match(source, /precioSugerido == null \? "Sin precio" : formatNumber\(p\.precioSugerido/);
  assert.match(source, /precioSugerido == null \? "Sin precio" : formatNumber\(row\.precioSugerido/);
  assert.match(detailSource, /precioSugerido == null \? "Sin precio" : formatNumber\(product\.precioSugerido/);
  assert.doesNotMatch(detailSource, /precioSugerido: formData\.precioSugerido/);
  assert.match(source, /Columnas requeridas: <strong>tela<\/strong>, <strong>color<\/strong>, <strong>unidad<\/strong>/);
  assert.match(source, /precio_sugerido, <\/>\}notas/);
  assert.doesNotMatch(source, /Opcional:[^)]*sku/);
});

test("la expansión automática no reescribe un Set que ya contiene los mismos grupos", async () => {
  const source = await readFile(new URL("./productos.tsx", import.meta.url), "utf8");
  assert.match(source, /let changed = false;[\s\S]*return changed \? next : prev;/);
});