import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasCapturedSuggestedPrice,
  PRODUCT_WITHOUT_PRICE_DESCRIPTION,
} from "./pos-product-price";

test("POS distingue precio ausente de un precio capturado en cero", () => {
  assert.equal(hasCapturedSuggestedPrice({ precioSugerido: null }), false);
  assert.equal(hasCapturedSuggestedPrice({ precioSugerido: undefined }), false);
  assert.equal(hasCapturedSuggestedPrice({ precioSugerido: "0.00" }), true);
  assert.equal(hasCapturedSuggestedPrice({ precioSugerido: "125.50" }), true);
  assert.match(PRODUCT_WITHOUT_PRICE_DESCRIPTION, /módulo de Precios/);
});

test("POS bloquea antes de mutar el carrito y presenta el precio ausente", async () => {
  const source = await readFile(new URL("../pages/pos.tsx", import.meta.url), "utf8");
  const addToCartStart = source.indexOf("const addToCart");
  const guard = source.indexOf("if (!hasCapturedSuggestedPrice(item))", addToCartStart);
  const firstCartRead = source.indexOf("const current = cartRef.current", addToCartStart);

  assert.ok(addToCartStart >= 0);
  assert.ok(guard > addToCartStart);
  assert.ok(firstCartRead > guard);
  assert.match(source, /title: PRODUCT_WITHOUT_PRICE_TITLE/);
  assert.match(source, /description: PRODUCT_WITHOUT_PRICE_DESCRIPTION/);
  assert.match(source, /requestAppSound\("ALERTA"\)/);
  assert.match(source, /rollo\.precioSugerido == null\s*\? "Sin precio"/);
  assert.match(source, /prod\.precioSugerido == null\s*\? "Sin precio"/);
});