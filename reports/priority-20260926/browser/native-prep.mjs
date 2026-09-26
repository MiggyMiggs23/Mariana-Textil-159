import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launch, recorder, session, credentials, origin, readState, persist, nativeWrite, api, priv } from "./runtime.mjs";
const b = await launch(), r = recorder("native-prep"), state = readState();
const run = async (name, fn, pages = []) => { const ok = await r.check(name, fn, pages); assert.ok(ok, name + " failed; no dependent replay"); };
try {
  const p = await session(b, credentials.admin, "ADMIN-PREP", r);
  await run("native-isolated-site-and-three-floors", async () => {
    await p.goto(origin + "/ubicaciones"); await p.getByTestId("button-create-location").click();
    let d = p.getByRole("dialog");
    await d.locator("input").first().fill("PRIORITY NATIVO");
    await d.getByPlaceholder("MA").fill("PRN");
    state.site = await nativeWrite(state, p, "site", "POST", "/api/locations", d.getByRole("button", { name: "Guardar", exact: true })); persist(state);
    await d.waitFor({ state: "hidden" });
    await p.getByRole("row").filter({ hasText: "PRIORITY NATIVO" }).getByRole("button").first().click();
    d = p.getByRole("dialog"); state.floors = [];
    for (const name of ["01 Acceso", "02 Segundo", "03 Tercero"]) {
      await d.getByRole("button", { name: "Agregar", exact: true }).click();
      await d.getByPlaceholder("Nombre del piso").fill(name);
      const floor = await nativeWrite(state, p, "floor-" + name, "POST", `/api/locations/${state.site.id}/pisos`, d.getByRole("button", { name: "Guardar", exact: true }).first());
      state.floors.push(floor); persist(state);
      await d.getByPlaceholder("Nombre del piso").waitFor({ state: "hidden" });
    }
    await d.getByRole("button", { name: "Cancelar", exact: true }).click();
    return { site: state.site.id, floors: state.floors.map(x => x.id) };
  }, [p]);
  await run("native-supplier-product-client", async () => {
    await p.goto(origin + "/proveedores"); await p.getByTestId("button-create-supplier").click();
    await p.getByTestId("input-create-supplier-nombre").fill("PRIORITY PROVEEDOR NATIVO");
    state.supplier = await nativeWrite(state, p, "supplier", "POST", "/api/proveedores", p.getByTestId("button-save-supplier-create")); persist(state);
    await p.goto(origin + "/productos"); await p.getByTestId("button-create-product").click();
    await p.getByTestId("input-product-tela").fill("PRIORITY ALGODON NATIVO");
    await p.getByTestId("input-product-color").fill("AZUL"); await p.getByTestId("input-product-precio").fill("100");
    state.product = await nativeWrite(state, p, "product", "POST", "/api/productos", p.getByTestId("button-save-product")); persist(state);
    await p.goto(origin + "/clientes"); await p.getByTestId("button-create-client").click();
    await p.getByTestId("input-create-client-name").fill("PRIORITY CLIENTE NATIVO");
    await p.getByRole("dialog").locator('input[type="number"]').first().fill("50000");
    await p.getByTestId("select-create-client-credit-days").click(); await p.getByRole("option", { name: "7 días", exact: true }).click();
    state.client = await nativeWrite(state, p, "client", "POST", "/api/clientes", p.getByTestId("button-save-client")); persist(state);
    return { supplierId: state.supplier.id, productId: state.product.id, clientId: state.client.id };
  }, [p]);
  await run("native-eight-roll-entry", async () => {
    await p.goto(origin + "/entradas"); await p.getByTestId("btn-create-entrada").click();
    await p.getByTestId("input-entrada-producto").fill(state.product.tela);
    await p.getByRole("option").filter({ hasText: state.product.tela }).first().click();
    await p.getByTestId("input-declared").fill("8"); await p.getByTestId("input-costo-unitario").fill("50");
    await p.getByTestId("select-entrada-ubicacion").click(); await p.getByRole("option", { name: state.site.nombre, exact: true }).click();
    await p.getByTestId("select-entrada-proveedor").click(); await p.getByRole("option", { name: state.supplier.nombre, exact: true }).click();
    await p.getByTestId("btn-add-line").click(); await p.getByTestId("input-uniform-qty").fill("10"); await p.getByTestId("button-apply-uniform").click();
    await p.getByTestId("trigger-bulk-floor").click(); await p.getByRole("option", { name: state.floors[0].nombre, exact: true }).click();
    await p.getByTestId("button-confirm-line").click(); await p.getByTestId("btn-save-entrada").click();
    state.entry = await nativeWrite(state, p, "entry", "POST", "/api/inventario/entradas", p.getByTestId("btn-confirm-entrada-review")); persist(state);
    assert.equal(state.entry.rollos.length, 8);
    return { id: state.entry.id, series: state.entry.rollos.map(x => x.serie) };
  }, [p]);
  await run("native-open-own-cash-session", async () => {
    await p.goto(origin + "/cobros");
    await p.getByRole("combobox").first().click(); await p.getByRole("option", { name: state.site.nombre, exact: true }).click();
    await p.getByRole("heading", { name: "Apertura de Caja", exact: true }).waitFor();
    await p.locator('input[type="number"]').fill("0");
    state.cash = await nativeWrite(state, p, "open-cash", "POST", "/api/sesiones-caja/abrir", p.getByRole("button", { name: "Abrir Turno", exact: true })); persist(state);
    return { id: state.cash.id, site: state.site.id };
  }, [p]);
  state.sales = {}; persist(state);
  for (const [i, type] of ["invoice", "note"].entries()) await run("native-sale-" + type, async () => {
    await p.goto(origin + "/pos"); await p.getByRole("combobox").first().click();
    await p.getByRole("option", { name: state.site.nombre, exact: true }).click(); await p.waitForTimeout(1000);
    await p.getByRole("button", { name: type === "invoice" ? "Ticket (Contado)" : "Notas (Crédito)", exact: true }).click();
    const input = p.getByPlaceholder("Buscar por serie de rollo, SKU o tela...");
    await input.fill(state.entry.rollos[i].serie); await input.press("Enter");
    await p.getByRole("button", { name: "Agregar", exact: true }).click(); await p.getByTestId("pos-cart-line").waitFor();
    await p.getByTestId("button-select-client").click(); await p.getByTestId(`option-client-${state.client.id}`).click();
    if (type === "invoice") await p.getByLabel("Requiere Factura", { exact: true }).click();
    state.sales[type] = await nativeWrite(state, p, type + "-sale", "POST", "/api/tickets", p.getByTestId("button-confirmar-venta")); persist(state);
    const read = await api(p, `/api/tickets/${state.sales[type].id}`); assert.equal(read.status, 200);
    return { id: read.body.id, folio: read.body.folio, facturado: read.body.facturado, documentoTipo: read.body.documentoTipo };
  }, [p]);
  await run("native-pay-fiscal-sale-transfer", async () => {
    await p.goto(origin + "/cobros"); await p.getByRole("combobox").first().click();
    await p.getByRole("option", { name: state.site.nombre, exact: true }).click();
    const sale = state.sales.invoice;
    const row = p.getByText(`VENTA FACTURADA folio ${sale.folio}`, { exact: true }).locator("xpath=ancestor::div[.//button[normalize-space()='Cobrar']][1]");
    await row.getByRole("button", { name: "Cobrar", exact: true }).click();
    await p.getByRole("button", { name: "Transf.", exact: true }).click();
    await p.getByPlaceholder("Número de rastreo o autorización").fill("PRIORITY-NATIVO-" + sale.id);
    await nativeWrite(state, p, "pay-invoice", "POST", `/api/tickets/${sale.id}/cobrar`, p.getByRole("button", { name: "Confirmar Pago", exact: true }));
    const read = await api(p, `/api/tickets/${sale.id}`); assert.equal(read.status, 200); assert.equal(read.body.cobrado, true);
    return { id: read.body.id, facturado: read.body.facturado, total: read.body.total, cobrado: read.body.cobrado };
  }, [p]);
  const f = await session(b, state.roles.F, "F-PREP", r);
  await run("native-nonempty-fiscal-source-and-clone-handoff", async () => {
    await f.goto(origin + "/favicon.png");
    const d = await api(f, `/api/e11/fiscal/facturas/${state.sales.invoice.id}`); assert.equal(d.status, 200);
    const no = await api(f, `/api/e11/fiscal/facturas/${state.sales.note.id}`); assert.equal(no.status, 404);
    const invoice = d.body;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(invoice.fechaFacturacion));
    const next = new Date(day + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
    const handoff = { ready: true, sourceDatabase: "priority_20260926", stateFile: path.join(priv, "state.json"), invoice, uninvoicedNoteId: state.sales.note.id, siteId: state.site.id, day, nextDay: next.toISOString().slice(0, 10), requestedClock: "After the actual invoice month is closed in America/Mexico_City; never backdate invoice", required: ["DIA:ACEPTADA", "SEMANA:ACEPTADA", "MES:ACEPTADA", "DIA:NO_CUADRA with ADMIN notice"] };
    fs.writeFileSync(path.join(priv, "clock-handoff.json"), JSON.stringify(handoff, null, 2), { mode: 0o600 });
    return { invoiceId: state.sales.invoice.id, day, nextDay: handoff.nextDay, nonempty: true, privateHandoff: path.join(priv, "clock-handoff.json") };
  });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }