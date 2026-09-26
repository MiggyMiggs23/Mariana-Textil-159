import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { start, state, persist, origin, config } from "./runtime.mjs";
const rt = await start("concurrency-fixtures"), { p, read, write, result, snap } = rt;
const prior = JSON.parse(fs.readFileSync("/tmp/postrelease-review-20260926/postreview_financial_20260926/browser/task1-state.json", "utf8")).fixtures;
const f = state.fixtures;
let error;
const post = async (key, endpoint, body) => {
  if (state.operations[key]?.status === "ACK") return state.operations[key].response;
  assert.ok(!state.operations[key], "Uncertain fixture, do not replay: " + key);
  const entry = state.operations[key] = { status: "UNCERTAIN", endpoint, requestBody: body, at: new Date().toISOString() }; persist();
  const response = await p.evaluate(async ({ endpoint, body }) => {
    const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { endpoint, body });
  entry.http = response.status; entry.response = response.body; entry.status = response.status < 300 ? "ACK" : response.status >= 500 ? "UNCERTAIN" : "REJECTED"; persist();
  assert.ok(response.status < 300, `${key} HTTP${response.status}: ${JSON.stringify(response.body)}`);
  return response.body;
};
try {
  f.cashiers ??= []; f.auditors ??= []; f.auditSite = prior.site; f.auditFloors = prior.floors; f.auditSeries = prior.entry.rollos.slice(4).map(r => r.serie);
  for (let i = 0; i < 2; i++) {
    const site = await post(`cash-site-${i}`, "/api/locations", { nombre: "POSTREVIEW26 CONC CAJA " + (i + 1), iniciales: i ? "CCB" : "CCA", tipo: "TIENDA" });
    const floor = await post(`cash-floor-${i}`, `/api/locations/${site.id}/pisos`, { nombre: "01 Acceso" });
    const entry = await post(`cash-stock-${i}`, "/api/inventario/entradas", {
      ubicacionId: site.id, proveedorId: prior.supplier.id, observaciones: "Owner task2 concurrency synthetic stock",
      uuidCliente: crypto.randomUUID(), lineas: [{ productoId: prior.product.id, costoUnitario: "50", cantidades: Array(12).fill("10"), pisosPorCantidad: Array(12).fill(floor.id) }]
    });
    let actor = f.cashiers[i];
    if (!actor) { actor = f.cashiers[i] = { username: "post26cash" + i + crypto.randomBytes(3).toString("hex"), password: crypto.randomBytes(20).toString("hex"), name: "POSTREVIEW26 Cashier " + (i + 1) }; persist(); }
    const user = await post(`cash-user-${i}`, "/api/users", { nombre: actor.name, usuario: actor.username, password: actor.password, rol: "CAJA", ubicacionId: site.id, alcanceConsulta: "PROPIA" });
    Object.assign(actor, { id: user.id, rol: "CAJA", site, entry, tickets: [] }); persist();
    for (let k = 0; k < 12; k++) {
      const sale = await post(`pending-ticket-${i}-${k}`, "/api/tickets", {
        uuidCliente: crypto.randomUUID(), ubicacionId: site.id, tipo: "NORMAL", facturado: false, clienteId: prior.client.id, diasPlazo: null,
        lineas: [{ rolloId: entry.rollos[k].id, productoId: prior.product.id, tipo: "NORMAL", cantidad: 10, precioUnitario: 100 }],
        documentoTipo: "TICKET", notaSinPrecios: false
      });
      actor.tickets.push({ id: sale.id, folio: sale.folio, total: sale.total }); persist();
    }
    if (!actor.cash) {
      await p.goto(origin + "/cobros"); await p.getByRole("combobox").first().click();
      await p.getByRole("option", { name: site.nombre, exact: true }).click();
      await p.getByRole("heading", { name: "Apertura de Caja", exact: true }).waitFor();
      await p.locator('input[type="number"]').fill("0");
      actor.cash = await write("task2-open-cash-" + i, "POST", "/api/sesiones-caja/abrir", p.getByRole("button", { name: "Abrir Turno", exact: true })); persist();
    }
  }
  for (let i = 0; i < 3; i++) {
    let actor = f.auditors[i];
    if (!actor) { actor = f.auditors[i] = { username: "post26audit" + i + crypto.randomBytes(3).toString("hex"), password: crypto.randomBytes(20).toString("hex"), name: "POSTREVIEW26 Auditor " + (i + 1) }; persist(); }
    const user = await post(`audit-user-${i}`, "/api/users", { nombre: actor.name, usuario: actor.username, password: actor.password, rol: "BODEGA", ubicacionId: prior.site.id, alcanceConsulta: "PROPIA" });
    Object.assign(actor, { id: user.id, rol: "BODEGA", site: prior.site }); persist();
  }
  if (!f.audit) {
    await p.goto(origin + "/inventario/auditorias"); await p.getByTestId("select-audit-site").click();
    await p.getByRole("option", { name: `${prior.site.iniciales} · ${prior.site.nombre}`, exact: true }).click();
    f.audit = await write("task2-open-audit", "POST", "/api/inventario/auditorias", p.getByTestId("button-open-audit")); persist();
  }
  result.fixtureSummary = { cashiers: f.cashiers.map(a => ({ id: a.id, rol: a.rol, site: a.site.id, pendingTickets: a.tickets.length })), auditors: f.auditors.map(a => ({ id: a.id, rol: a.rol })), auditId: f.audit.id, auditSite: f.auditSite.id, auditSeriesCount: f.auditSeries.length };
  const userFile = path.join(config.journalDirectory, "actors.json");
  fs.writeFileSync(userFile, JSON.stringify({ cashiers: f.cashiers, auditors: f.auditors }), { mode: 0o600 });
  await snap("native-audit-ready");
} catch (e) { error = e; }
finally { await rt.finish(error); }