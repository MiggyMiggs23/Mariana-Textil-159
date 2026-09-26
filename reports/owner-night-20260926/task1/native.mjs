import assert from "node:assert/strict";
import path from "node:path";
import { start, state, persist, origin, config } from "./runtime.mjs";
const stage = process.argv[2];
const supported = ["preflight", "site", "catalog", "entry", "open-cash", "sale-cash", "sale-credit", "sale-remate", "pay-cash", "pay-remate", "authorize-credit", "abono", "receipt", "retained-gate", "remate", "cash-exit", "close"];
assert.ok(supported.includes(stage), "Explicit supported stage required: " + supported.join(", "));
const rt = await start(stage), { p, read, write, snap, result } = rt;
const f = state.fixtures, label = "OWNER " + config.campaignId;
const selectSite = async route => {
  await p.goto(origin + route); await p.getByRole("combobox").first().click();
  await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
};
let error;
try {
  if (stage === "preflight") {
    for (const endpoint of ["/api/auth/me", "/api/precios", "/api/e11/disponibilidad"]) {
      const response = await read(endpoint); result.checks.push({ endpoint, response }); assert.equal(response.status, 200);
    }
    await snap("authenticated-release");
  } else if (stage === "site") {
    await p.goto(origin + "/ubicaciones"); await p.getByTestId("button-create-location").click();
    let d = p.getByRole("dialog"); await d.locator("input").first().fill(label);
    await d.getByPlaceholder("MA").fill("OWN");
    f.site = await write("site", "POST", "/api/locations", d.getByRole("button", { name: "Guardar", exact: true })); persist();
    await d.waitFor({ state: "hidden" });
    await p.getByRole("row").filter({ hasText: f.site.nombre }).getByRole("button").first().click();
    d = p.getByRole("dialog"); f.floors = [];
    for (const name of ["01 Acceso", "02 Segundo", "03 Tercero"]) {
      await d.getByRole("button", { name: "Agregar", exact: true }).click();
      await d.getByPlaceholder("Nombre del piso").fill(name);
      f.floors.push(await write("floor-" + name, "POST", `/api/locations/${f.site.id}/pisos`, d.getByRole("button", { name: "Guardar", exact: true }).first())); persist();
      await d.getByPlaceholder("Nombre del piso").waitFor({ state: "hidden" });
    }
  } else if (stage === "catalog") {
    await p.goto(origin + "/proveedores"); await p.getByTestId("button-create-supplier").click();
    await p.getByTestId("input-create-supplier-nombre").fill(label + " PROVEEDOR");
    f.supplier = await write("supplier", "POST", "/api/proveedores", p.getByTestId("button-save-supplier-create")); persist();
    await p.goto(origin + "/productos"); await p.getByTestId("button-create-product").click();
    await p.getByTestId("input-product-tela").fill(label + " ALGODON");
    await p.getByTestId("input-product-color").fill("AZUL"); await p.getByTestId("input-product-precio").fill("100");
    f.product = await write("product", "POST", "/api/productos", p.getByTestId("button-save-product")); persist();
    await p.goto(origin + "/clientes"); await p.getByTestId("button-create-client").click();
    await p.getByTestId("input-create-client-name").fill(label + " CLIENTE");
    await p.getByRole("dialog").locator('input[type="number"]').first().fill("50000");
    await p.getByTestId("select-create-client-credit-days").click(); await p.getByRole("option", { name: "7 días", exact: true }).click();
    f.client = await write("client", "POST", "/api/clientes", p.getByTestId("button-save-client")); persist();
  } else if (stage === "entry") {
    await p.goto(origin + "/entradas"); await p.getByTestId("btn-create-entrada").click();
    await p.getByTestId("input-entrada-producto").fill(f.product.tela);
    await p.getByRole("option").filter({ hasText: f.product.tela }).first().click();
    await p.getByTestId("input-declared").fill("24"); await p.getByTestId("input-costo-unitario").fill("50");
    await p.getByTestId("select-entrada-ubicacion").click(); await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
    await p.getByTestId("select-entrada-proveedor").click(); await p.getByRole("option", { name: f.supplier.nombre, exact: true }).click();
    await p.getByTestId("btn-add-line").click(); await p.getByTestId("input-uniform-qty").fill("10");
    await p.getByTestId("button-apply-uniform").click();
    await p.getByTestId("trigger-bulk-floor").click(); await p.getByRole("option", { name: f.floors[0].nombre, exact: true }).click();
    await p.getByTestId("button-confirm-line").click(); await p.getByTestId("btn-save-entrada").click();
    f.entry = await write("entry", "POST", "/api/inventario/entradas", p.getByTestId("btn-confirm-entrada-review")); persist();
    assert.equal(f.entry.rollos.length, 24);
  } else if (stage === "open-cash") {
    await selectSite("/cobros"); await p.getByRole("heading", { name: "Apertura de Caja", exact: true }).waitFor();
    await p.locator('input[type="number"]').fill("0");
    f.cash = await write("open-cash", "POST", "/api/sesiones-caja/abrir", p.getByRole("button", { name: "Abrir Turno", exact: true })); persist();
  } else if (stage.startsWith("sale-")) {
    const credit = stage === "sale-credit", remate = stage === "sale-remate", roll = f.entry.rollos[credit ? 1 : remate ? 2 : 0];
    const saleKey = credit ? "creditSale" : remate ? "remateSale" : "cashSale";
    await selectSite("/pos");
    await p.getByRole("button", { name: credit ? "Notas (Crédito)" : "Ticket (Contado)", exact: true }).click();
    const input = p.getByPlaceholder("Buscar por serie de rollo, SKU o tela...");
    await input.fill(roll.serie); await input.press("Enter");
    await p.getByRole("button", { name: "Agregar", exact: true }).click(); await p.getByTestId("pos-cart-line").waitFor();
    if (remate) {
      await p.getByTestId("pos-cart-line").locator('input[data-testid^="input-precio-"]').fill("40");
      await p.getByTestId("pos-cart-line").locator('input[data-testid^="input-precio-"]').blur();
    }
    await p.getByTestId("button-select-client").click(); await p.getByTestId(`option-client-${f.client.id}`).click();
    f[saleKey] = await write(stage, "POST", "/api/tickets", p.getByTestId("button-confirmar-venta")); persist();
    const sale = f[saleKey], back = await read(`/api/tickets/${sale.id}`);
    assert.equal(back.status, 200); assert.equal(Number(back.body.total), remate ? 400 : 1000); result.checks.push(back);
  } else if (stage === "pay-cash" || stage === "pay-remate" || stage === "authorize-credit") {
    const credit = stage === "authorize-credit", sale = credit ? f.creditSale : stage === "pay-remate" ? f.remateSale : f.cashSale;
    await selectSite("/cobros");
    const button = credit ? "Autorizar" : "Cobrar";
    const caption = `${credit ? "Nota" : "Ticket"} folio ${sale.folio}`;
    // Exact business caption is verified against live UI before invoking guarded write.
    await p.getByText(caption, { exact: true }).locator(`xpath=ancestor::div[.//button[normalize-space()='${button}']][1]`).getByRole("button", { name: button, exact: true }).click();
    if (!credit) await p.getByRole("button", { name: "Efectivo", exact: true }).click();
    const site = p.getByRole("combobox", { name: "Sitio operativo de origen" });
    if (credit && await site.count()) { await site.click(); await p.getByRole("option", { name: f.site.nombre, exact: true }).click(); }
    const response = await write(stage, "POST", `/api/tickets/${sale.id}/${credit ? "autorizar" : "cobrar"}`, credit ? p.getByRole("dialog").getByRole("button", { name: "Autorizar", exact: true }) : p.getByRole("button", { name: "Confirmar Pago", exact: true }));
    if (!credit) { state.expected.cashCents += stage === "pay-remate" ? 40000 : 100000; persist(); }
    const back = await read(`/api/tickets/${sale.id}`); assert.equal(back.status, 200);
    if (!credit) assert.equal(back.body.cobrado, true);
    result.checks.push({ response, independent: back });
  } else if (stage === "abono") {
    await selectSite("/cobros"); await p.getByRole("button", { name: "Cartera / Estado de cuenta", exact: true }).click();
    await p.getByTestId("button-caja-registrar-abono").click(); await p.getByTestId("button-cliente-context-combobox").click();
    await p.getByTestId("input-cliente-context-search").fill(f.client.nombre);
    await p.getByRole("option").filter({ hasText: f.client.nombre }).click();
    await p.getByTestId("cliente-payment-amount").fill("250");
    await p.getByTestId("e3-payment-method").click(); await p.getByRole("option", { name: "Efectivo", exact: true }).click();
    await p.getByTestId("e3-preview").click(); await p.getByTestId("e3-confirm").waitFor(); await snap("review-abono");
    f.abono = await write("abono", "POST", "/api/caja/abonos-e3", p.getByTestId("e3-confirm"));
    state.expected.cashCents += 25000; persist();
    await p.getByRole("link").filter({ hasText: /^E3-/ }).last().waitFor();
    f.receiptHref = await p.getByRole("link").filter({ hasText: /^E3-/ }).last().getAttribute("href"); persist();
    await snap("actual-receipt-link");
    result.checks.push(await read(`/api/clientes/${f.client.id}/credito`));
  } else if (stage === "receipt") {
    assert.match(f.receiptHref, /^\/recibos-e3\//);
    const folio = decodeURIComponent(f.receiptHref.split("/").at(-1));
    await p.goto(origin + f.receiptHref); await p.locator('#e3-pages[data-ready="true"]').waitFor();
    for (const key of ["receipt-print", "receipt-reprint"]) {
      await write(key, "POST", `/api/recibos-e3/${folio}/impresiones`, p.getByTestId("button-print-receipt"));
      const file = path.join(rt.folder, key + ".pdf");
      await p.pdf({ path: file, printBackground: true, preferCSSPageSize: true }); rt.register(file);
    }
    result.checks.push({ nativePrintLayoutPdf: true, physicalPrintingNotClaimed: true });
  } else if (stage === "retained-gate") {
    const availability = await read(`/api/e5/disponibilidad?ubicacionId=${f.site.id}`);
    result.checks.push({ capabilityRead: availability });
    if (availability.status !== 200 || !availability.body.enabled) throw new Error("E5 retained/direct authorization BLOCKED by business gate; no attempt to enable");
    await selectSite("/cobros"); await snap("retained-ui-entry");
    result.checks.push({ next: "Native retained receipt, ADMIN directed authorization and balance assertions require current enabled UI inspection; not passed merely by this availability check" });
  } else if (stage === "remate") {
    const roll = f.entry.rollos[2];
    await p.goto(origin + "/inventario/rollos/" + roll.id);
    await p.locator("textarea").fill(label + " remate sintético autorizado ADMIN");
    f.remate = await write("remate", "POST", `/api/inventario/rollos/${roll.id}/remate`, p.getByRole("button", { name: "Marcar remate", exact: true })); persist();
    await p.getByRole("button", { name: "Retirar remate", exact: true }).waitFor();
  } else if (stage === "cash-exit") {
    await selectSite("/cobros");
    await p.locator("#salida-monto").fill("25"); await p.locator("#salida-motivo").fill(label + " gasto sintético ordinario");
    f.cashExit = await write("cash-exit", "POST", `/api/sesiones-caja/${f.cash.id}/salidas-dinero`, p.getByRole("button", { name: "Registrar salida extraordinaria", exact: true }));
    state.expected.cashCents -= 2500; persist();
  } else if (stage === "close") {
    assert.ok(state.expected.cashCents > 0, "Nonempty independent counted cash required");
    await selectSite("/cobros");
    const response = p.waitForResponse(r => r.request().method() === "GET" && new URL(r.url()).pathname === `/api/sesiones-caja/${f.cash.id}/corte`);
    await p.getByRole("button", { name: "Realizar Corte", exact: true }).click(); result.cutBefore = await (await response).json();
    await p.getByRole("dialog").getByPlaceholder("0.00").fill((state.expected.cashCents / 100).toFixed(2));
    f.closedCash = await write("close", "POST", `/api/sesiones-caja/${f.cash.id}/cerrar`, p.getByRole("button", { name: "Confirmar Cierre", exact: true })); persist();
    result.cutAfter = await read(`/api/sesiones-caja/${f.cash.id}/corte`); assert.equal(result.cutAfter.status, 200);
    result.independentCountedCash = (state.expected.cashCents / 100).toFixed(2);
  }
  await snap("final");
} catch (e) { error = e; }
finally { await rt.finish(error); }