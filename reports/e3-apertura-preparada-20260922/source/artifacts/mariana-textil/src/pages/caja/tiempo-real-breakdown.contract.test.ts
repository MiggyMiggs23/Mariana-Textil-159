import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { withBrowserFixture } from "../../observable-test/browser";
import { createCajaTiempoRealBrowserFixture } from "./caja-tiempo-real-observable-test-support";

test("realtime cards open the detail that matches their displayed data for click and Enter", async () => {
  const fixture = await createCajaTiempoRealBrowserFixture();
  try {
    await withBrowserFixture(fixture.options, async (page) => {
      await page.waitFor(`document.querySelectorAll('[role="button"]').length === 6`);

      const cards = await page.evaluate<Array<{ label: string; text: string }>>(`
        Array.from(document.querySelectorAll('[role="button"]')).map((card) => ({
          label: [
            "Contado cobrado",
            "Ventas a crédito",
            "Ventas pendientes de cobro o autorización",
            "Salidas en tránsito",
            "Tickets cancelados",
            "Salidas canceladas",
          ].find((label) => card.textContent?.includes(label)) ?? "",
          text: card.textContent ?? "",
        }))
      `);
      assert.deepEqual(
        cards.map((card) => card.label),
        [
          "Contado cobrado",
          "Ventas a crédito",
          "Ventas pendientes de cobro o autorización",
          "Salidas en tránsito",
          "Tickets cancelados",
          "Salidas canceladas",
        ],
        "only the six detail-capable cards expose the button interaction",
      );

      const details = [
        ["Contado cobrado", "Forma de pago", "María Pagó"],
        ["Ventas a crédito", "Plazo", "Cliente crédito"],
        ["Ventas pendientes de cobro o autorización", "Documento", "Cliente pendiente"],
        ["Salidas en tránsito", "Origen", "Sucursal Centro"],
        ["Tickets cancelados", "Cancelado por", "Cajera Uno"],
        ["Salidas canceladas", "Origen", "Cliente salida"],
      ] as const;

      for (const activation of ["click", "enter"] as const) {
        for (const [label, column, fixtureValue] of details) {
          await page.evaluate(`
            (() => {
              const card = Array.from(document.querySelectorAll('[role="button"]'))
                .find((element) => element.textContent?.includes(${JSON.stringify(label)}));
              if (!(card instanceof HTMLElement)) throw new Error("No se encontró tarjeta interactiva");
              if (${JSON.stringify(activation)} === "click") {
                card.click();
              } else {
                card.focus();
                card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
              }
            })()
          `);
          await page.waitFor(`document.querySelector('[role="dialog"]')`);
          const detail = await page.evaluate<string>(`
            document.querySelector('[role="dialog"]')?.textContent ?? ""
          `);
          assert.ok(detail.includes(label), `${activation} preserves the ${label} detail identity`);
          assert.ok(detail.includes(column), `${label} renders its applicable detail column`);
          assert.ok(detail.includes(fixtureValue), `${label} renders data from its own detail response`);
          await page.evaluate(`
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
          `);
          await page.waitFor(`!document.querySelector('[role="dialog"]')`);
        }
      }
    });
  } finally {
    await fixture.dispose();
  }
});

test("realtime detail stays in a responsive dialog with folio as its only row link", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("<Dialog"), source.lastIndexOf("</Dialog>"));
  assert.match(dialog, /w-\[calc\(100vw-1rem\)\]/);
  assert.match(dialog, /overflow-auto/);
  assert.equal((dialog.match(/<Link /g) ?? []).length, 2);
  assert.match(dialog, /href=\{`\/tickets\/\$\{item\.id\}`\}/);
  assert.match(dialog, /href=\{item\.href\}/);
});

test("salida cards show counts only; cancelled tickets and all detail rows retain amounts", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const cards = [...source.matchAll(/<Card\b[\s\S]*?<\/Card>/g)].map(([card]) => card);
  for (const [label, field] of [
    ["Salidas en tránsito", "salidasEnTransito"],
    ["Salidas canceladas", "salidasCanceladas"],
  ]) {
    const card = cards.find((value) => value.includes(label));
    assert.ok(card, `${label} must exist`);
    assert.ok(card.includes(`formatCountLabel(dashboard.${field}.conteo, "salida", "salidas")`));
    assert.ok(!card.includes(`dashboard.${field}.importe`), `${label} must not display an amount`);
    assert.doesNotMatch(card, /kind: "money"/);
  }
  const cancelled = cards.find((value) => value.includes("Tickets cancelados"));
  assert.ok(cancelled);
  assert.match(cancelled, /formatCountLabel\(dashboard\.cancelaciones\.tickets/);
  assert.match(cancelled, /formatNumber\(dashboard\.cancelaciones\.importe, \{ kind: "money" \}\)/);
  const dialog = source.slice(source.indexOf("<Dialog"), source.lastIndexOf("</Dialog>"));
  assert.equal((dialog.match(/formatNumber\(item\.importe, \{ kind: "money" \}\)/g) ?? []).length, 2);
});