import assert from "node:assert/strict";
import test from "node:test";
import {
  toggleLabelSelection,
  updateVisibleLabelSelection,
} from "./label-selection";

test("100 visibles seleccionan como máximo 50 y nunca IDs fuera de la vista", () => {
  const visibles = Array.from({ length: 100 }, (_, index) => ({ id: index + 101 }));
  const seleccion = updateVisibleLabelSelection(new Map(), visibles, true, 50);
  assert.equal(seleccion.size, 50);
  assert.deepEqual([...seleccion.keys()], visibles.slice(0, 50).map(r => r.id));
  assert.equal(toggleLabelSelection(seleccion, visibles[50], 50).size, 50);
  assert.equal(toggleLabelSelection(seleccion, visibles[0], 50).size, 49);
  assert.equal(updateVisibleLabelSelection(seleccion, visibles, false, 50).size, 0);
});

test("15 etiquetas de varios productos sobreviven cambios de resultados", () => {
  const resultPages = Array.from({ length: 3 }, (_, page) =>
    Array.from({ length: 5 }, (_, index) => ({
      id: page * 5 + index + 1,
      producto: `Producto ${page + 1}`,
      serie: String(page * 5 + index + 1).padStart(7, "0"),
    })),
  );

  let selected = new Map<number, (typeof resultPages)[number][number]>();
  for (const visibleResultsAfterFilterChange of resultPages) {
    selected = updateVisibleLabelSelection(
      selected,
      visibleResultsAfterFilterChange,
      true,
    );
  }

  assert.equal(selected.size, 15);
  assert.deepEqual(
    [...selected.values()].map(({ id, producto, serie }) => ({ id, producto, serie })),
    resultPages.flat(),
  );
});