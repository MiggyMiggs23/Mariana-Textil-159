import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const recovery = process.argv.includes("--recover-unattempted");
const { m, credentials } = load(), r = recorder(2, recovery ? "fresh-six-native-payments-completion" : "fresh-six-native-payments"), b = await browserKit(m);
const journal = path.join(m.privateDir, "fresh-six-native-payments.json");
const state = fs.existsSync(journal) ? JSON.parse(fs.readFileSync(journal)) : { operations: {} };
const save = () => fs.writeFileSync(journal, JSON.stringify(state, null, 2), { mode: 0o600 });
const f = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
const site = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fresh-performance-preflight.json")))[0].site;
try {
  const p = await session(b, m, credentials.admin);
  const op = async (key, endpoint, button) => {
    assert.ok(!state.operations[key], "No automatic replay");
    state.operations[key] = { status: "UNCERTAIN" }; save();
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === endpoint);
    await button.click();
    const response = await pending, body = await response.json();
    state.operations[key] = { status: response.ok() ? "ACK" : "FAILED", http: response.status(), body }; save();
    assert.ok(response.ok(), `Native operation HTTP ${response.status()}`);
    return body;
  };
  const entryOK = await r.check("native-fresh-six-roll-entry-at-open-synthetic-site", async () => {
    assert.match(site.nombre, /^NOCHE PERF /);
    const cash = await api(p, `/api/sesiones-caja/actual?ubicacionId=${site.id}`);
    assert.equal(cash.status, 200); assert.equal(cash.body.sesion.estado, "ABIERTA");
    if (recovery) {
      assert.equal(state.operations.entry.status, "ACK");
      const d = await api(p, `/api/inventario/entradas/${state.entry.id}`);
      assert.equal(d.status, 200);
      return { previouslyAcknowledgedEntryId: state.entry.id, noEntryReplay: true };
    }
    await p.goto(m.origin + "/entradas");
    await p.getByTestId("btn-create-entrada").click();
    await p.getByTestId("input-entrada-producto").fill(f.fabric);
    await p.getByRole("option").filter({ hasText: f.fabric }).first().click();
    await p.getByTestId("input-declared").fill("6");
    await p.getByTestId("input-costo-unitario").fill("1");
    await p.getByTestId("select-entrada-ubicacion").click();
    await p.getByRole("option", { name: site.nombre, exact: true }).click();
    await p.getByTestId("select-entrada-proveedor").click();
    await p.getByRole("option", { name: f.supplierName, exact: true }).click();
    await p.getByTestId("btn-add-line").click();
    await p.getByTestId("input-uniform-qty").fill("1");
    await p.getByTestId("button-apply-uniform").click();
    await p.getByTestId("button-confirm-line").click();
    await p.getByTestId("btn-save-entrada").click();
    state.entry = await op("entry", "/api/inventario/entradas", p.getByTestId("btn-confirm-entrada-review")); save();
    assert.equal(state.entry.rollos.length, 6);
    return { entryId: state.entry.id, siteId: site.id, siteName: site.nombre, newRolls: 6, untouchedOldTickets: true };
  }, [p]);
  assert.ok(entryOK, "Stop if fresh inventory unavailable");
  const tickets = [];
  for (let i = 0; i < 6; i++) {
    const ok = await r.check("native-fresh-ticket-" + i, async () => {
      if (recovery && state.operations["ticket" + i]?.status === "ACK") {
        const ticket = state.operations["ticket" + i].body;
        const d = await api(p, `/api/tickets/${ticket.id}`);
        assert.equal(d.status, 200); assert.equal(d.body.cobrado, false); assert.equal(d.body.ubicacionId, site.id);
        const item = { id: ticket.id, folio: ticket.folio, nativeProvenance: true, ubicacionId: site.id };
        tickets.push(item); return { ...item, readbackOnly: true };
      }
      assert.ok(!state.operations["ticket" + i], "No previous business POST attempt permitted");
      const stock = await api(p, `/api/inventario/rollos/${state.entry.rollos[i].id}`);
      assert.equal(stock.status, 200); assert.equal(stock.body.estado, "DISPONIBLE");
      await p.goto(m.origin + "/pos");
      await p.getByRole("combobox").first().click();
      await p.getByRole("option", { name: site.nombre, exact: true }).click();
      await p.waitForTimeout(1200);
      await p.getByRole("button", { name: "Ticket (Contado)", exact: true }).click();
      const input = p.getByPlaceholder("Buscar por serie de rollo, SKU o tela...");
      await input.fill(state.entry.rollos[i].serie); await input.press("Enter");
      await p.getByRole("button", { name: "Agregar", exact: true }).click();
      await p.getByTestId("pos-cart-line").waitFor();
      await p.getByTestId("button-select-client").click();
      await p.getByTestId(`option-client-${m.clients.cash.id}`).click();
      const ticket = await op("ticket" + i, "/api/tickets", p.getByTestId("button-confirmar-venta"));
      const d = await api(p, `/api/tickets/${ticket.id}`);
      assert.equal(d.status, 200); assert.equal(d.body.cobrado, false); assert.equal(d.body.ubicacionId, site.id);
      const item = { id: ticket.id, folio: ticket.folio, nativeProvenance: true, ubicacionId: site.id };
      tickets.push(item); return item;
    }, [p]);
    assert.ok(ok, "Stop after uncertain/failed ticket; no replay");
  }
  fs.writeFileSync("/tmp/noche-20260926/payment-input-fresh.json", JSON.stringify({ before: tickets.slice(0, 3), after: tickets.slice(3), siteId: site.id }, null, 2), { mode: 0o600 });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }