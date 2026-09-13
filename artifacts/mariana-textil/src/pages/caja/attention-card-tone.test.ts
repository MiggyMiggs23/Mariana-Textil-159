import { test } from "node:test";
import assert from "node:assert/strict";
import { attentionCardTone } from "./attention-card-tone";

for (const color of ["amber", "red"] as const) {
  test(`${color}: zero is neutral even with a stale threshold flag`, () => {
    const result = attentionCardTone(color, 0, "0.00", true);
    assert.equal(result.state, "neutral");
    assert.equal(result.card, "border-sidebar/10 bg-card");
    assert.doesNotMatch(Object.values(result).join(" "), /amber-|red-/);
  });
  test(`${color}: count OR amount activates attention, including free documents`, () => {
    for (const [count, amount] of [[1, "0"], [0, "12.50"], [0, "-1"]] as const) {
      const result = attentionCardTone(color, count, amount);
      assert.equal(result.state, "attention");
      assert.match(result.card, new RegExp(`bg-${color}-50`));
    }
  });
}
test("the server flag alone distinguishes normal and elevated cancellation tones", () => {
  const normal = attentionCardTone("red", 1, "100", false);
  const elevated = attentionCardTone("red", 1, "100", true);
  assert.equal(normal.state, "attention");
  assert.equal(elevated.state, "elevated");
  assert.match(elevated.card, /bg-red-200.*ring-2 ring-red-700/);
  assert.notEqual(normal.card, elevated.card);
  assert.equal(attentionCardTone("amber", 1, "100", true).state, "attention");
});
test("missing data does not create a colored warning", () => {
  assert.equal(attentionCardTone("red", undefined, undefined).state, "neutral");
});