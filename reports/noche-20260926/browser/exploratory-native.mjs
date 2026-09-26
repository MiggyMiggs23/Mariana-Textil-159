import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load(), r = recorder(6, "native-drilldown-units-color"), b = await browserKit(m);
const f = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
const journalFile = path.join(m.privateDir, "exploratory-native.json");
const state = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile)) : { operations: {}, products: {} };
const persist = () => fs.writeFileSync(journalFile, JSON.stringify(state, null, 2), { mode: 0o600 });
try {
  const p = await session(b, m, credentials.admin);
  await r.check("real-amount-to-detail-to-folio-document", async () => {
    await p.goto(m.origin + "/caja/tiempo-real"); await p.waitForLoadState("networkidle");
    await p.getByRole("button").filter({ hasText: /Contado cobrado/ }).click();
    const dialog = p.getByRole("dialog"); await dialog.waitFor(); await r.snap(p, "amount-detail");
    const link = dialog.locator('a[href^="/tickets/"]').first();
    const folioText = await link.innerText(), href = await link.getAttribute("href");
    assert.ok(folioText.trim() && href); await link.click();
    await p.waitForURL(m.origin + href); await p.waitForLoadState("networkidle"); await r.snap(p, "folio-document");
    return { amount: "Contado cobrado", realDocumentLink: { folioText, href } };
  }, [p]);
  await r.check("color-has-operational-text-not-color-alone", async () => {
    await p.goto(m.origin + "/caja/tiempo-real"); await p.waitForLoadState("networkidle");
    const labels = ["Contado cobrado", "Ventas pendientes de cobro o autorización", "Tickets cancelados"];
    const text = await p.locator("body").innerText();
    for (const label of labels) assert.ok(text.toLocaleLowerCase().includes(label.toLocaleLowerCase()));
    const codes = await p.locator("[data-attention]").evaluateAll(nodes => nodes.map(n => ({ state: n.getAttribute("data-attention"), label: n.textContent?.trim() })));
    return { labels, codes, limitation: "Observed dashboard semantic labels; not a claim that every decorative color across all screens is compliant." };
  }, [p]);
  for (const [unit, matcher] of [["KILO", /Kg/i], ["PIEZA", /Pza|Pieza/i], ["BOLSA", /Bolsa/i]]) await r.check("native-product-" + unit, async () => {
    if (state.operations[unit] === "ACK") return { id: state.products[unit].id, acknowledgedEarlier: true };
    assert.ok(!state.operations[unit], "Product already attempted");
    await p.goto(m.origin + "/productos"); await p.getByTestId("button-create-product").click();
    const name = `NOCHE26 UNIDADES ${unit}`;
    await p.getByTestId("input-product-tela").fill(name); await p.getByTestId("input-product-color").fill("BLANCO");
    await p.getByTestId("select-product-unidad").click();
    await p.getByRole("option").filter({ hasText: matcher }).click();
    await p.getByTestId("input-product-precio").fill("100");
    state.operations[unit] = "UNCERTAIN"; persist();
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === "/api/productos");
    await p.getByTestId("button-save-product").click();
    const response = await pending, body = await response.json(); assert.ok(response.ok()); assert.equal(body.unidad, unit);
    state.products[unit] = { id: body.id, name }; state.operations[unit] = "ACK"; persist();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    return { id: body.id, unit };
  }, [p]);
  await r.check("four-unit-entry-review-and-document-no-mixed-sum", async () => {
    assert.equal(Object.keys(state.products).length, 3);
    await p.goto(m.origin + "/entradas"); await p.getByTestId("btn-create-entrada").click();
    const rows = [{ unit: "METRO", name: f.fabric, quantity: "11" }, ...["KILO", "PIEZA", "BOLSA"].map((unit, i) => ({ unit, name: state.products[unit].name, quantity: ["13", "17", "19"][i] }))];
    for (const [i, row] of rows.entries()) {
      await p.getByTestId("input-entrada-producto").fill(row.name);
      await p.waitForTimeout(350);
      const discard = p.getByRole("button", { name: "Sí, descartar línea", exact: true });
      if (await discard.isVisible()) {
        r.result.captureDialogAfterAcknowledgedLine = true;
        await r.snap(p, "unexpected-capture-cancel-" + i);
        await discard.click();
        await p.getByTestId("input-entrada-producto").fill("");
        await p.getByTestId("input-entrada-producto").fill(row.name);
      }
      await p.getByRole("option").filter({ hasText: row.name }).first().click();
      await p.getByTestId("input-declared").fill("1"); await p.getByTestId("input-costo-unitario").fill("1");
      if (i === 0) {
        await p.getByTestId("select-entrada-ubicacion").click(); await p.getByRole("option", { name: m.site.name, exact: true }).click();
        await p.getByTestId("select-entrada-proveedor").click(); await p.getByRole("option", { name: f.supplierName, exact: true }).click();
      }
      await p.getByTestId("btn-add-line").click(); await p.getByTestId("input-uniform-qty").fill(row.quantity); await p.getByTestId("button-apply-uniform").click();
      await p.getByTestId("trigger-bulk-floor").click(); await p.getByRole("option", { name: f.floorName, exact: true }).click();
      await p.getByTestId("button-confirm-line").click();
      await p.waitForTimeout(350);
    }
    await p.getByTestId("btn-save-entrada").click();
    const totals = await p.getByTestId("review-quantity-totals").innerText(); r.result.unitReview = totals;
    for (const number of ["11", "13", "17", "19"]) assert.ok(totals.includes(number));
    assert.ok(!totals.includes("60"), "Mixed dimensional sum must not be presented as quantity");
    await r.snap(p, "four-units-review");
    assert.ok(!state.operations.entry, "Entry already attempted"); state.operations.entry = "UNCERTAIN"; persist();
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === "/api/inventario/entradas");
    await p.getByTestId("btn-confirm-entrada-review").click();
    const response = await pending, body = await response.json(); assert.ok(response.ok());
    state.operations.entry = "ACK"; state.entry = body; persist();
    const d = await api(p, `/api/inventario/entradas/${body.id}`); assert.equal(d.status, 200);
    await p.goto(m.origin + `/entradas/${body.id}`); await p.waitForLoadState("networkidle"); await r.snap(p, "four-units-document");
    return { entryId: body.id, distinctDimensions: rows.map(x => ({ unit: x.unit, quantity: x.quantity })), reviewText: totals };
  }, [p]);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }