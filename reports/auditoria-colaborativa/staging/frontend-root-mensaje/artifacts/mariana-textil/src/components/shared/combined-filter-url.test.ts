import assert from "node:assert/strict";
import test from "node:test";
import {
  readCombinedFilterCriteria,
  sanitizeCombinedFilterCriteria,
  writeCombinedFilterCriteria,
} from "./combined-filter-url";

test("restaura listas legibles y descarta valores sintácticamente inválidos", () => {
  const criteria = readCombinedFilterCriteria(new URLSearchParams(
    "proveedorIds=2,7,foo&ubicacionIds=3&telas=Loneta,Tafetán&colores=Crudo&desde=2026-02-30&hasta=2026-12-31",
  ));
  assert.deepEqual(criteria.proveedorIds, [2, 7]);
  assert.deepEqual(criteria.ubicacionIds, [3]);
  assert.deepEqual(criteria.telas, ["Loneta", "Tafetán"]);
  assert.equal(criteria.desde, undefined);
  assert.equal(criteria.hasta, "2026-12-31");
});

test("normaliza la URL y conserva parámetros ajenos al criterio compartido", () => {
  const params = new URLSearchParams("tab=compras&telas=Vieja");
  writeCombinedFilterCriteria(params, {
    proveedorIds: [2, 7],
    ubicacionIds: [],
    telas: ["Loneta"],
    colores: [],
    desde: "2026-01-01",
    hasta: "2026-12-31",
  });
  assert.equal(params.get("tab"), "compras");
  assert.equal(params.get("proveedorIds"), "2,7");
  assert.equal(params.get("telas"), "Loneta");
});

test("elimina selecciones que ya no existen en catálogos reales", () => {
  const sanitized = sanitizeCombinedFilterCriteria({
    proveedorIds: [2, 99],
    ubicacionIds: [3, 88],
    telas: ["Loneta", "Fantasma"],
    colores: ["Crudo", "Invisible"],
  }, {
    proveedorIds: [2],
    ubicacionIds: [3],
    telas: ["Loneta"],
    colores: ["Crudo"],
  });
  assert.deepEqual(sanitized.proveedorIds, [2]);
  assert.deepEqual(sanitized.ubicacionIds, [3]);
  assert.deepEqual(sanitized.telas, ["Loneta"]);
  assert.deepEqual(sanitized.colores, ["Crudo"]);
});