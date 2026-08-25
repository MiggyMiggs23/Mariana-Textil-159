import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUniformToBlankRolls,
  createBlankRollQuantities,
  createUniformRollQuantities,
  getRollCaptureCounts,
  isValidDeclaredRollCount,
  resetRollToUniform,
} from "./roll-capture-state";

test("rechaza cantidades declaradas fraccionarias o no positivas", () => {
  assert.equal(isValidDeclaredRollCount("105"), true);
  assert.equal(isValidDeclaredRollCount("2.5"), false);
  assert.equal(isValidDeclaredRollCount("0"), false);
  assert.equal(isValidDeclaredRollCount("-1"), false);
});

test("aplica el metraje uniforme a los 105 rollos en blanco", () => {
  const values = applyUniformToBlankRolls(createBlankRollQuantities(105), "50");

  assert.equal(values.length, 105);
  assert.ok(values.every((value) => value === "50"));
  assert.deepEqual(getRollCaptureCounts(values, "50", new Set()), {
    uniform: 105,
    adjusted: 0,
    blank: 0,
  });
});

test("volver a aplicar solo llena blancos y conserva cinco correcciones", () => {
  const values = createUniformRollQuantities(105, "50");
  const editedIndexes = new Set([2, 17, 41, 72, 103]);
  for (const [index, value] of [[2, "48"], [17, "49.5"], [41, "51"], [72, "47"], [103, "52"]] as const) {
    values[index] = value;
  }
  values[10] = "";
  values[11] = "";

  const reapplied = applyUniformToBlankRolls(values, "50");

  assert.equal(reapplied[2], "48");
  assert.equal(reapplied[17], "49.5");
  assert.equal(reapplied[41], "51");
  assert.equal(reapplied[72], "47");
  assert.equal(reapplied[103], "52");
  assert.equal(reapplied[10], "50");
  assert.equal(reapplied[11], "50");
  assert.deepEqual(getRollCaptureCounts(reapplied, "50", editedIndexes), {
    uniform: 100,
    adjusted: 5,
    blank: 0,
  });
});

test("sobrescribir todos elimina ajustes y aplica la nueva base", () => {
  const overwritten = createUniformRollQuantities(105, "51");

  assert.ok(overwritten.every((value) => value === "51"));
  assert.deepEqual(getRollCaptureCounts(overwritten, "51", new Set()), {
    uniform: 105,
    adjusted: 0,
    blank: 0,
  });
});

test("restaurar un rollo ajustado lo devuelve al grupo uniforme", () => {
  const values = createUniformRollQuantities(3, "50");
  values[1] = "47";
  const editedIndexes = new Set([1]);

  const restored = resetRollToUniform(values, 1, "50");
  editedIndexes.delete(1);

  assert.equal(restored[1], "50");
  assert.deepEqual(getRollCaptureCounts(restored, "50", editedIndexes), {
    uniform: 3,
    adjusted: 0,
    blank: 0,
  });
});

test("el contador mantiene los rollos pendientes en blanco", () => {
  const values = ["50", "48", "", "", ""];

  assert.deepEqual(getRollCaptureCounts(values, "50", new Set([1])), {
    uniform: 1,
    adjusted: 1,
    blank: 3,
  });
});