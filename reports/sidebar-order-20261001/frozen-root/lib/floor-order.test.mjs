import assert from "node:assert/strict";
import test from "node:test";
import { compareFloorLevels, lowestActiveFloor } from "./floor-order.mjs";

test("numeric order handles unsorted arrays and levels above nine without name coupling", () => {
  const floors = [
    { id: 1, nivel: 10, nombre: "AAA" },
    { id: 2, nivel: 2, nombre: "ZZZ" },
    { id: 3, nivel: 1, nombre: "Piso arbitrario" },
  ];
  assert.deepEqual([...floors].sort(compareFloorLevels).map(f => f.id), [3, 2, 1]);
  assert.equal(lowestActiveFloor(floors)?.id, 3);
  assert.deepEqual(floors.map(f => f.id), [1, 2, 3], "does not mutate input");
  assert.equal(lowestActiveFloor(floors.map(f => ({ ...f, nombre: "renamed" })))?.id, 3);
});

test("lowest active includes negative levels, excludes inactive and does not require zero", () => {
  assert.equal(lowestActiveFloor([
    { id: 1, nivel: 0, activo: false },
    { id: 4, nivel: 10, activo: true },
    { id: 3, nivel: 1, activo: true },
    { id: 9, nivel: null, activo: false },
  ])?.id, 3);
  assert.equal(lowestActiveFloor([{ id: 1, nivel: 0 }, { id: 2, nivel: -2 }])?.id, 2);
});

test("ties use id; null/invalid active levels block fixed selection, never fallback", () => {
  assert.equal(lowestActiveFloor([{ id: 9, nivel: 2 }, { id: 4, nivel: 2 }])?.id, 4);
  for (const nivel of [null, undefined, "0", NaN, 1.5]) {
    assert.equal(lowestActiveFloor([{ id: 9, nivel: 1 }, { id: 4, nivel }]), null);
  }
  assert.equal(lowestActiveFloor([]), null);
  assert.equal(lowestActiveFloor([{ id: 1, nivel: 0, activo: false }]), null);
  assert.deepEqual([
    { id: 9, nivel: null }, { id: 3, nivel: 10 }, { id: 4, nivel: 1 }, { id: 2, nivel: null },
  ].sort(compareFloorLevels).map(f => f.id), [4, 3, 2, 9]);
});