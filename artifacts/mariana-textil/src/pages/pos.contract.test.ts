import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("POS uses the BOLSA threshold and whole-bag quantity UX", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  assert.match(page, /mayoreoThresholdForUnit\(item\.producto\.unidad\)/);
  assert.match(page, /suggestedMeteredPrice\(1, item, item\.unidad\)/);
  assert.match(
    page,
    /suggestedMeteredPrice\(\s*qty,\s*item\.producto,\s*item\.producto\.unidad,\s*\)/,
  );
  assert.match(page, /const requiresWholeQuantity = item\.producto\.unidad === "BOLSA"/);
  assert.match(page, /min=\{requiresWholeQuantity \? "1" : "0\.001"\}/);
  assert.match(page, /step=\{requiresWholeQuantity \? "1" : "0\.001"\}/);
  assert.match(page, /!requiresWholeQuantity \|\| Number\.isInteger\(quantity\)/);
  assert.match(
    page,
    /desde \{mayoreoThresholdForUnit\(prod\.unidad\)\} \{formatUnit\(prod\.unidad\)\}/,
  );
  assert.doesNotMatch(page, /MAYOREO_THRESHOLD_METERS/);
});