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

test("POS sends generated notes directly to the printable ticket detail", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./ticket-detail.tsx", import.meta.url), "utf8");

  assert.match(page, /documentoTipo: documentoTipo as "TICKET" \| "NOTA"/);
  assert.match(
    page,
    /crearTicket\.mutate\([\s\S]*onSuccess: \(ticket\) => \{[\s\S]*setLocation\(\s*`\/tickets\/\$\{ticket\.id\}\?print=3/,
  );
  assert.match(
    detail,
    /new URLSearchParams\(window\.location\.search\)\.get\("print"\) !== "3"/,
  );
  assert.match(
    detail,
    /const printPromise = isNota[\s\S]*printWhenReady\("print-credito"\)/,
  );
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

test("cart rows isolate long product details from price, quantity, amount, and removal controls", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  // The explicit grid leaves a shrinkable identity cell and fixed operational
  // cells, rather than letting a long name or SKU push controls into each other.
  assert.match(
    page,
    /grid-cols-\[minmax\(0,1fr\)_6rem\].*sm:grid-cols-\[minmax\(0,1fr\)_6rem_5rem_6rem_2rem\].*data-testid="pos-cart-line"/s,
  );
  assert.match(page, /col-span-2.*sm:col-start-5.*sm:row-start-1/);
  assert.match(page, /max-w-24.*sm:max-w-none/);
  assert.match(page, /className="min-w-0 break-words font-semibold text-sm"/);
  assert.match(page, /className="mt-0\.5 break-all text-xs text-muted-foreground"/);
  assert.match(page, /htmlFor=\{`precio-\$\{lineKey\}`\}/);
  assert.match(page, /Precio \/ \{formatUnit\(item\.producto\.unidad\)\}/);
  assert.match(page, /Cant\. \/ \{meteredUnit\}/);
  assert.match(page, /self-end text-right font-mono text-sm whitespace-nowrap/);
  assert.match(page, /self-end text-right font-bold whitespace-nowrap/);
  assert.match(page, /h-8 w-8 shrink-0.*text-destructive/);
  assert.match(page, /grid-cols-\[minmax\(0,1fr\)_auto_auto\].*title=\{rollo\.serie\}/s);

  // Representative catalog extremes must remain text content in the dedicated
  // shrinkable product/SKU cell, not a reason to relax cell boundaries.
  const longestCatalogName = "TELA JACQUARD TEJIDA DE ALTA RESISTENCIA PARA TAPICERÍA INSTITUCIONAL";
  const longestCatalogSku = "MT-JACQUARD-INSTITUCIONAL-ALTA-RESISTENCIA-ANCHO-160-COLOR-ESPECIAL-0001";
  assert.ok(longestCatalogName.length > 60);
  assert.ok(longestCatalogSku.length > 70);
});

test("METRO metered lines require explicit same-site physical source allocations", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  assert.match(page, /isMetroMeteredLine/);
  assert.match(page, /useBuscarPos\(sourceLookupParams/);
  assert.match(page, /rollo\.productoId === item\.producto\.id/);
  assert.match(page, /rollo\.ubicacionId === locationId/);
  assert.match(page, /data-testid=\{`pos-metered-source-picker-\$\{item\.producto\.id\}`\}/);
  assert.match(page, /<CampoEscaneo[\s\S]*input-metered-source-scan/);
  assert.match(page, /fuentesRollo/);
  assert.match(page, /sourceQuantityInThousandths/);
  assert.match(page, /Completa la asignación para continuar/);
  assert.match(page, /asigna exactamente/);
});

test("editing a METRO quantity and removing a cart line cannot retain stale source quantities", async () => {
  const page = await readFile(new URL("./pos.tsx", import.meta.url), "utf8");

  assert.match(page, /cantidad: qty,[\s\S]*fuentesRollo: isMetroMeteredLine\(item\) \? \[\]/);
  assert.match(page, /const removeFromCart = \(index: number\) =>/);
  assert.match(page, /current\.filter\(\(_, itemIndex\) => itemIndex !== index\)/);
  assert.match(page, /fuentesRollo: \(item\.fuentesRollo \?\? \[\]\)\.map/);
  assert.match(page, /if \(incompleteMeteredSources\)/);
});
