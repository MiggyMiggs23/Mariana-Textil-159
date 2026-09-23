import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  behaviorLinkHref,
  behaviorSelectValueGroups,
  loadBehaviorLinksUnitsPages,
  renderBehaviorLinksUnitsPage,
} from "../behavior-links-units-render";

test("catálogo agrupado conserva unidad, especificaciones y totales separados", async () => {
  const pages = await loadBehaviorLinksUnitsPages();
  pages.setBehaviorFixture({
    user: { id: 1, nombre: "Admin", rol: "ADMIN", alcanceConsulta: "TODAS", permisos: [] },
    productos: [
      { id: 11, tela: "Tela control", color: "Color metro", sku: "SKU-METRO", unidad: "METRO", rollos: 1, cantidad: "10", sitiosConExistencia: 1, activo: true, anchoCm: 150, composicion: "Algodón", gramajeGm2: 180 },
      { id: 12, tela: "Tela control", color: "Color kilo", sku: "SKU-KILO", unidad: "KILO", rollos: 2, cantidad: "20", sitiosConExistencia: 1, activo: true, anchoCm: 150, composicion: "Algodón", gramajeGm2: 180 },
      { id: 13, tela: "Tela control", color: "Color bolsa", sku: "SKU-BOLSA", unidad: "BOLSA", rollos: 3, cantidad: "30", sitiosConExistencia: 1, activo: true, anchoCm: 150, composicion: "Algodón", gramajeGm2: 180 },
      { id: 14, tela: "Tela control", color: "Color pieza", sku: "SKU-PIEZA", unidad: "PIEZA", rollos: 4, cantidad: "40", sitiosConExistencia: 1, activo: true, anchoCm: 150, composicion: "Algodón", gramajeGm2: 180 },
    ],
  });

  const allHtml = renderBehaviorLinksUnitsPage(pages.Productos, {
    "productos.expanded-telas": new Set(["Tela control"]),
  }, pages.BehaviorLocationScopeProvider);
  const filteredHtml = renderBehaviorLinksUnitsPage(pages.Productos, {
    "productos.expanded-telas": new Set(["Tela control"]),
    "productos.unidad": "BOLSA",
  }, pages.BehaviorLocationScopeProvider);
  const selectGroups = behaviorSelectValueGroups(allHtml);
  for (const unit of ["METRO", "KILO", "BOLSA", "PIEZA"]) {
    assert.ok(allHtml.includes(`data-testid="total-tela-Tela control-${unit}"`), `${unit} retains a separate group total`);
  }
  assert.ok(
    selectGroups.some((values) => ["ALL", "METRO", "KILO", "BOLSA", "PIEZA"].every((value) => values.includes(value))),
    "all four units are offered by the unit filter",
  );
  assert.ok(
    selectGroups.some((values) => ["METRO", "KILO", "BOLSA", "PIEZA"].every((value) => values.includes(value)) && !values.includes("ALL")),
    "all four units are offered by the product creation control",
  );
  assert.ok(allHtml.includes("10.00 Mts."));
  assert.ok(allHtml.includes("20.00 Kg."));
  assert.ok(allHtml.includes("30.00 Bolsas"));
  assert.ok(allHtml.includes("40.00 Pzas."));
  assert.equal(behaviorLinkHref(filteredHtml, "Color bolsa"), "/productos/13");
  assert.equal(behaviorLinkHref(filteredHtml, "Color metro"), null);
  assert.ok(allHtml.includes("Vista previa no autoritativa"));
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