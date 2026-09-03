import assert from "node:assert/strict";
import test from "node:test";
import {
  updateVisibleLabelSelection,
} from "./label-selection";

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