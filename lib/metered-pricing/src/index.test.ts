import assert from "node:assert/strict";
import test from "node:test";
import {
  MAYOREO_THRESHOLD_METERS,
  meteredPriceTier,
  suggestedMeteredPrice,
} from "./index";

test("the named MAYOREO threshold treats 10.000 as wholesale and 9.999 as retail", () => {
  assert.equal(MAYOREO_THRESHOLD_METERS, 10);
  assert.equal(meteredPriceTier(10), "MAYOREO");
  assert.equal(meteredPriceTier(9.999), "MENUDEO");
});

test("a live quantity recalculation selects the corresponding persisted price", () => {
  const prices = { precioMayoreo: "80.00", precioMenudeo: "100.00" };
  assert.deepEqual(suggestedMeteredPrice(9.999, prices), {
    tier: "MENUDEO",
    price: "100.00",
  });
  assert.deepEqual(suggestedMeteredPrice(10, prices), {
    tier: "MAYOREO",
    price: "80.00",
  });
});