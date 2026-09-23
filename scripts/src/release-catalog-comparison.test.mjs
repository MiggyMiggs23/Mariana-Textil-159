import test from "node:test";
import assert from "node:assert/strict";
import { comparisonAttributes, fingerprints } from "./release-catalog-comparison.mjs";

const make = (positions = [1, 1.5, 2], labels = ["Z", "A", "M"]) => ({
  schemaRows: [{ kind: "trigger", definition: "unchanged" }],
  attributes: [
    ...labels.map((name, i) => ({ kind: "enum", parent: "status", name, definition: String(positions[i]) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    { kind: "trigger", parent: "orders", name: "audit", definition: "A:unchanged" },
  ],
});
test("renumbering preserving label order passes without mutating captures", () => {
  const before = make();
  const saved = structuredClone(before);
  assert.deepEqual(fingerprints(before), fingerprints(make([10, 20, 90])));
  assert.deepEqual(before, saved);
});
test("permuting, adding, removing or renaming labels fails", () => {
  for (const changed of [
    make([1, 2, 3], ["A", "Z", "M"]),
    make([1, 2, 3, 4], ["Z", "A", "M", "EXTRA"]),
    make([1, 2], ["Z", "A"]),
    make([1, 2, 3], ["Z", "A", "RENAMED"]),
  ]) assert.notDeepEqual(fingerprints(make()), fingerprints(changed));
});
test("enum identity and other catalog attributes remain significant", () => {
  for (const change of [
    c => { c.attributes[0].parent = "other_type"; },
    c => { c.attributes[0].schema_name = "other_schema"; },
    c => { c.attributes.at(-1).definition = "O:unchanged"; },
    c => { c.schemaRows[0].definition = "changed"; },
  ]) {
    const changed = make();
    change(changed);
    assert.notDeepEqual(fingerprints(make()), fingerprints(changed));
  }
});
test("separate types and schemas normalize independently", () => {
  const a = make();
  const b = make([11, 12, 13]);
  for (const c of [a, b]) c.attributes.push(
    { kind: "enum", parent: "other", name: "X", definition: "50" },
    { kind: "enum", schema_name: "other", parent: "status", name: "X", definition: "50" },
  );
  assert.deepEqual(fingerprints(a), fingerprints(b));
});
test("invalid or ambiguous enum captures fail closed", () => {
  for (const positions of [[1, 1, 2], [1, NaN, 2], [1, Infinity, 2]]) {
    assert.throws(() => fingerprints(make(positions)));
  }
  assert.throws(() => fingerprints(make([1, 2, 3], ["Z", "Z", "M"])));
  assert.throws(() => comparisonAttributes(null));
});