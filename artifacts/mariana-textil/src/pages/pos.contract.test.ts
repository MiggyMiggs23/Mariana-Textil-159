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

test("tabular printing is unchecked client-only state and does not change TicketInput", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  assert.match(page, /useState\(false\).*imprimirTabulares|imprimirTabulares.*useState\(false\)/s);
  assert.match(page, /id="imprimir-tabulares"/);
  assert.match(page, /Imprimir tabulares/);
  assert.match(page, /const input: TicketInput = \{[\s\S]*lineas,[\s\S]*\};/);
  assert.doesNotMatch(page, /imprimirTabulares:/);
  assert.match(page, /\?print=3\$\{imprimirTabulares \? "&tabulares=1" : ""\}/);
});

test("scanner auto-add is limited to exact available roll scans", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  assert.match(page, /source === "manual"/);
  assert.match(page, /exactMatches\.length !== 1/);
  assert.match(page, /addToCart\(rollo, true\)/);
  assert.match(page, /requestAppSound\("AVISO"\)/);
  assert.match(page, /requestAppSound\("ALERTA"\)/);
  assert.match(page, /No está disponible en este sitio/);
  assert.match(page, /advertenciaSkuEscaneado\(lastScannedCode, rollo\.sku\)/);
});

test("normal cart groups by product but expands checkout back to individual rolls", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  assert.match(page, /group\.producto\.id === item\.productoId/);
  assert.match(page, /rollos: \[\.\.\.existing\.rollos, item\]/);
  assert.match(page, /Los rollos tenían precios sugeridos distintos/);
  assert.match(page, /item\.rollos\.map\(\(rollo: PosRolloDisponible\) => \(\{/);
  assert.match(page, /rolloId: rollo\.id/);
  assert.match(page, /cantidad: Number\(rollo\.cantidadActual\)/);
  assert.match(page, /onRemoveRollo\(rollo\.id\)/);
  assert.match(page, /cartLineSubtotalCents\(item\)/);
  assert.match(page, /item\.rollos\.reduce/);
});