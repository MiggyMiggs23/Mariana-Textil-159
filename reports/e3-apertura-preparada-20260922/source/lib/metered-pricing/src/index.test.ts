import assert from "node:assert/strict";
import test from "node:test";
import {
  MAYOREO_THRESHOLD_METERS,
  MAYOREO_THRESHOLD_BAGS,
  mayoreoThresholdForUnit,
  meteredPriceTier,
  suggestedMeteredPrice,
} from "./index";

test("the named MAYOREO threshold selects the physical unit and retains the legacy metre default", () => {
  assert.equal(MAYOREO_THRESHOLD_METERS, 10);
  assert.equal(MAYOREO_THRESHOLD_BAGS, 10);
  assert.equal(mayoreoThresholdForUnit("METRO"), MAYOREO_THRESHOLD_METERS);
  assert.equal(mayoreoThresholdForUnit("bolsa"), MAYOREO_THRESHOLD_BAGS);
  assert.equal(mayoreoThresholdForUnit(), MAYOREO_THRESHOLD_METERS);
  assert.equal(meteredPriceTier(10, "METRO"), "MAYOREO");
  assert.equal(meteredPriceTier(9.999, "METRO"), "MENUDEO");
  assert.equal(meteredPriceTier(10, "BOLSA"), "MAYOREO");
  assert.equal(meteredPriceTier(9, "BOLSA"), "MENUDEO");
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
  assert.deepEqual(suggestedMeteredPrice(9, prices, "BOLSA"), {
    tier: "MENUDEO",
    price: "100.00",
  });
  assert.deepEqual(suggestedMeteredPrice(10, prices, "BOLSA"), {
    tier: "MAYOREO",
    price: "80.00",
  });
});