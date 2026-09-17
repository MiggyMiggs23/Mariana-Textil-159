import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withBrowserFixture } from "../../observable-test/browser";
import { createCajaTiempoRealBrowserFixture } from "./caja-tiempo-real-observable-test-support";

const readPage = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Tiempo Real Contract", () => {
  it("renders principal row and secondary attention row in exact order", async () => {
    type Bounds = { top: number; right: number; bottom: number; left: number; width: number; height: number };
    type Observation = {
      principal: Bounds;
      signals: Bounds;
      cobranza: Bounds;
      quantities: Bounds;
      stores: Bounds;
      principalCards: Bounds[];
      signalCards: Bounds[];
    };
    const fixture = await createCajaTiempoRealBrowserFixture();
    try {
      await withBrowserFixture(fixture.options, async (page) => {
        await page.waitFor(`
          document.querySelector('[data-testid="text-monto-cobranza-del-periodo"]') &&
          document.querySelector('[data-testid="analytics-quantities"]') &&
          document.body.textContent.includes("Sucursal observable")
        `);

        for (const viewport of [
          { name: "desktop", width: 1280, height: 1000 },
          { name: "narrow mobile 390", width: 390, height: 1000 },
          { name: "narrow mobile 402", width: 402, height: 1000 },
        ]) {
          await page.viewport(viewport.width, viewport.height);
          await page.evaluate(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
          const observed = await page.evaluate<Observation>(`
            (() => {
              const bounds = (element) => {
                if (!(element instanceof HTMLElement)) throw new Error("Expected a mounted layout block");
                const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
                return { top, right, bottom, left, width, height };
              };
              const row = (labels) => {
                const texts = labels.map((label) =>
                  Array.from(document.querySelectorAll("span, h3"))
                    .find((element) => element.textContent?.trim() === label)
                );
                if (texts.some((element) => !(element instanceof HTMLElement))) {
                  throw new Error("Expected all public row labels to be mounted");
                }
                let ancestor = texts[0];
                while (ancestor && !texts.every((element) => ancestor.contains(element))) {
                  ancestor = ancestor.parentElement;
                }
                if (!(ancestor instanceof HTMLElement)) {
                  throw new Error("Expected a common mounted row ancestor");
                }
                const cards = texts.map((text) => {
                  let containingChild = text;
                  while (containingChild?.parentElement !== ancestor) {
                    containingChild = containingChild?.parentElement;
                  }
                  if (!(containingChild instanceof HTMLElement)) {
                    throw new Error("Expected each label inside a direct row child");
                  }
                  return containingChild;
                });
                return { ancestor, cards };
              };
              const principalRow = row([
                "Ventas totales", "Contado cobrado", "Ventas a crédito", "Utilidad",
              ]);
              const signalRow = row([
                "Ventas pendientes de cobro o autorización", "Salidas en tránsito",
                "Tickets cancelados", "Salidas canceladas",
              ]);
              const cobranzaLink = document.querySelector('[data-testid="text-monto-cobranza-del-periodo"]');
              const quantities = document.querySelector('[data-testid="analytics-quantities"]');
              const storeHeading = Array.from(document.querySelectorAll("h3"))
                .find((element) => element.textContent?.trim() === "Estado por tienda");
              const stores = storeHeading?.nextElementSibling;
              return {
                principal: bounds(principalRow.ancestor),
                signals: bounds(signalRow.ancestor),
                cobranza: bounds(cobranzaLink?.parentElement?.parentElement?.parentElement),
                quantities: bounds(quantities),
                stores: bounds(stores),
                principalCards: principalRow.cards.map(bounds),
                signalCards: signalRow.cards.map(bounds),
              };
            })()
          `);

          const before = (earlier: Bounds, later: Bounds, message: string) =>
            assert.ok(earlier.bottom <= later.top, `${viewport.name}: ${message}`);
          for (const [blockName, block] of [
            ["principal sales block", observed.principal],
            ["operational signals block", observed.signals],
            ["Cobranza block", observed.cobranza],
            ["optional quantities strip", observed.quantities],
            ["Estado por tienda block", observed.stores],
          ] as const) {
            assert.ok(
              block.width > 0 && block.height > 0,
              `${viewport.name}: ${blockName} must have positive width and height`,
            );
          }
          before(observed.principal, observed.signals, "principal sales block must precede operational signals block");
          before(observed.signals, observed.cobranza, "operational signals block must precede Cobranza block");
          before(observed.cobranza, observed.quantities, "Cobranza block must precede the optional quantities strip");
          before(observed.quantities, observed.stores, "optional quantities strip must precede Estado por tienda");

          for (const [rowName, cards] of [
            ["principal", observed.principalCards],
            ["signals", observed.signalCards],
          ] as const) {
            for (let index = 1; index < cards.length; index += 1) {
              const previous = cards[index - 1];
              const current = cards[index];
              assert.ok(
                previous.width > 0 && previous.height > 0,
                `${viewport.name}: ${rowName} card ${index} must have positive width and height`,
              );
              const sameVisualRow = Math.abs(previous.top - current.top) < 1;
              assert.ok(
                sameVisualRow ? previous.right <= current.left : previous.bottom <= current.top,
                `${viewport.name}: ${rowName} cards must retain their exact visual order`,
              );
            }
            const last = cards.at(-1);
            assert.ok(
              last && last.width > 0 && last.height > 0,
              `${viewport.name}: ${rowName} card ${cards.length} must have positive width and height`,
            );
          }
        }
      });
    } finally {
      await fixture.dispose();
    }
  });

  it("explains color semantics with concise code comments", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /\{?\/\*.*[Aa]mber.*\*\/\}/i);
    assert.match(page, /\{?\/\*.*[Rr]ed.*\*\/\}/i);
  });

  it("SALIDAS drilldown columns/link rule", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /isSalidaBreakdown \? \(/);
    assert.match(page, /<TableHead>Origen<\/TableHead>/);
    assert.match(page, /<TableHead>Destino o Cliente<\/TableHead>/);
    assert.match(page, /<Link href=\{item\.href\}/);
    assert.match(page, /format\(parseISO\(item\.fecha\), "dd\/MM\/yyyy HH:mm"\)/);
    assert.doesNotMatch(page, /href=\{`\/tickets\/\$\{item\.id\}`\}[^>]*>[\s\S]{0,200}item\.(origen|destino)/);
  });

  it("CANCELADAS drilldown columns/link rule", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /breakdownConcept === "CANCELADAS".*Cancelado por/);
    assert.match(page, /breakdownConcept !== "CANCELADAS"[\s\S]*Hora/);
    assert.match(page, /breakdownConcept !== "CANCELADAS"[\s\S]*Cliente/);
    assert.match(page, /<Link href=\{`\/tickets\/\$\{item\.id\}`\}[\s\S]*item\.folio/);
    assert.doesNotMatch(page, /href=\{`\/tickets\/\$\{item\.id\}`\}[^>]*>[\s\S]{0,200}item\.(importe|nombreUsuarioCancelacion|motivoCancelacion)/);
  });

  it("shared boolean use for cancellation", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /attentionCardTone\("red", dashboard\?\.cancelaciones\.tickets, dashboard\?\.cancelaciones\.importe\)/);
    assert.match(page, /attentionCardTone\("red", dashboard\?\.salidasCanceladas\.conteo, dashboard\?\.salidasCanceladas\.importe\)/);
    assert.doesNotMatch(page, /cancelledTone\.state === "elevated"/);
    assert.doesNotMatch(page, /tasaCancelacion\)\s*>\s*10|tasaCancelacion\s*>\s*10/);
  });

  it("pluralizes dashboard counts and always shows the server cancellation rate, even without sales", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /value === 1 \? singular : plural/);
    assert.match(page, /formatCountLabel\(dashboard\.cancelaciones\.tickets, "ticket", "tickets"\)/);
    assert.match(page, /formatCountLabel\(pendingTickets, "ticket", "tickets"\)/);
    assert.match(page, /formatCountLabel\(pendingNotes, "nota", "notas"\)/);
    assert.doesNotMatch(page, /hasCancellationRateBase/);
    assert.match(page, /Tasa de cancelación: \{formatNumber\(dashboard\.cancelaciones\.tasaCancelacion/);
    const cardContent = page.slice(page.indexOf('{formatCountLabel(dashboard.cancelaciones.tickets'), page.indexOf("</CardContent>", page.indexOf('{formatCountLabel(dashboard.cancelaciones.tickets')));
    assert.doesNotMatch(cardContent, /&&|\?\s*\(/);
  });
});
