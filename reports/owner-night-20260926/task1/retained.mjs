import assert from "node:assert/strict";
import { start, state, persist, origin } from "./runtime.mjs";
const stage = process.argv[2]; assert.ok(["retained-receive", "retained-prepare", "retained-authorize", "directed-receive"].includes(stage));
const rt = await start(stage), { p, read, write, snap, result } = rt, f = state.fixtures;
let error;
try {
  const available = await read(`/api/e5/disponibilidad?ubicacionId=${f.site.id}`);
  assert.equal(available.status, 200, "Existing E5 business gate unavailable; do not enable"); assert.equal(available.body.enabled, true);
  const before = await read(`/api/clientes/${f.client.id}/credito`); assert.equal(before.status, 200); result.before = before.body;
  await p.goto(origin + "/cobros"); await p.getByRole("combobox").first().click();
  await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
  if (stage.endsWith("receive")) {
    const directed = stage === "directed-receive", amount = directed ? "100" : "300";
    await p.getByRole("button", { name: "Cartera / Estado de cuenta", exact: true }).click();
    await p.getByRole("button", { name: "Recibir dirigido", exact: true }).click();
    await p.getByLabel("Buscar cliente autorizado", { exact: true }).fill(f.client.nombre);
    await p.getByRole("button", { name: "Buscar cliente", exact: true }).click();
    await p.getByLabel("Cliente receptor", { exact: true }).selectOption(String(f.client.id));
    await p.getByLabel(new RegExp(`^Nota ${f.creditSale.folio} · saldo`)).check();
    await p.getByLabel("Importe recibido", { exact: true }).fill(amount);
    if (directed) {
      await p.getByLabel(/^Medio/).selectOption("TRANSFERENCIA");
      await p.getByLabel(/^Cuenta receptora/).selectOption("CUENTA_NO_FISCAL");
    }
    await p.getByLabel(/^Sesión /).selectOption(String(f.cash.id));
    await p.getByLabel("Motivo / evidencia obligatoria", { exact: true }).fill("OWNER POSTREVIEW dinero real sintético " + stage);
    await p.getByLabel(/Referencias documentales/).fill("OWNER-" + stage);
    if (directed) {
      await p.getByLabel("ADMIN: autorizar aplicación al recibir (atómica)", { exact: true }).check();
      await p.getByLabel(new RegExp(`^Importe nota ${f.creditSale.folio} cargo`)).fill(amount);
    }
    await p.getByRole("button", { name: "Revisar recepción", exact: true }).click();
    await p.getByRole("button", { name: "Confirmar dinero recibido", exact: true }).waitFor(); await snap("receipt-review");
    const body = await write(stage, "POST", "/api/e5/cobros", p.getByRole("button", { name: "Confirmar dinero recibido", exact: true }));
    f[directed ? "directed" : "retained"] = body;
    if (!directed) state.expected.cashCents += 30000;
    persist(); await p.getByText(/Operación confirmada/).first().waitFor();
    const current = await read(`/api/e5/cobros/${body.id}`); assert.equal(current.status, 200); result.cobro = current.body;
    assert.equal(current.body.importeRecibido, amount + ".00");
    assert.equal(current.body.importeAplicado, directed ? "100.00" : "0.00");
    assert.equal(current.body.importePendiente, directed ? "0.00" : "300.00");
  } else {
    assert.ok(f.retained?.id);
    await p.goto(origin + `/cobros/pendientes/${f.retained.id}`);
    await p.getByRole("combobox").first().click();
    await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
    const action = stage === "retained-prepare" ? "preparar" : "autorizar";
    await p.getByLabel(/^Acción/).selectOption(action);
    await p.getByLabel(new RegExp(`^Importe nota ${f.creditSale.folio} cargo`)).fill("200");
    await p.getByLabel("Motivo / evidencia obligatoria", { exact: true }).fill("OWNER POSTREVIEW aplicación dirigida explícita200, retener100, sin segundo ingreso");
    await p.getByRole("button", { name: "Revisar " + action, exact: true }).click();
    await snap("application-review");
    const response = await write(stage, "POST", `/api/e5/cobros/${f.retained.id}/${action === "preparar" ? "propuestas" : "autorizar"}`, p.getByRole("button", { name: "Confirmar " + action, exact: true }));
    f[stage] = response; persist();
    result.cobro = (await read(`/api/e5/cobros/${f.retained.id}`)).body;
    assert.equal(result.cobro.importeAplicado, action === "preparar" ? "0.00" : "200.00");
    assert.equal(result.cobro.importePendiente, action === "preparar" ? "300.00" : "100.00");
  }
  const after = await read(`/api/clientes/${f.client.id}/credito`); assert.equal(after.status, 200); result.after = after.body;
  const decrease = stage === "retained-authorize" ? 200 : stage === "directed-receive" ? 100 : 0;
  assert.equal(Number(after.body.saldoActual), Number(before.body.saldoActual) - decrease);
  assert.equal(after.body.saldoAFavor, "0.00");
  await snap("actual-balance-and-state");
} catch (e) { error = e; }
finally { await rt.finish(error); }