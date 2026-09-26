import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { start, state, persist, config } from "./runtime.mjs";
const oldPath = "/tmp/postrelease-review-20260926/postreview_financial_20260926/browser-task2/task1-state.json";
const oldBytes = fs.readFileSync(oldPath);
const old = JSON.parse(oldBytes);
assert.equal(old.operations["task2-collect-16"].status, "UNCERTAIN");
const prior = JSON.parse(fs.readFileSync("/tmp/postrelease-review-20260926/postreview_financial_20260926/browser/task1-state.json")).fixtures;
const rt = await start("cashv10-fixtures");
let error;
try {
  assert.ok(fs.existsSync(config.authorizationEvidence));
  if (!state.fixtures.cashiers) {
    state.fixtures = structuredClone(old.fixtures);
    for (const a of state.fixtures.cashiers) a.tickets = [];
    persist();
  }
  const post = async (key, endpoint, body) => {
    assert.ok(!state.operations[key], "No replay: " + key);
    const op = state.operations[key] = { status: "UNCERTAIN", endpoint, requestBody: body }; persist();
    const r = await rt.p.evaluate(async ({endpoint, body}) => {
      const r = await fetch(endpoint, { method: "POST", credentials: "include", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      return {status:r.status,body:await r.json()};
    }, {endpoint,body});
    Object.assign(op, {http:r.status,response:r.body,status:r.status<300?"ACK":r.status>=500?"UNCERTAIN":"REJECTED"}); persist();
    assert.ok(r.status<300, `${key} HTTP${r.status}`); return r.body;
  };
  for (const a of state.fixtures.cashiers) {
    const cut = await rt.read(`/api/sesiones-caja/${a.cash.id}/corte`);
    assert.equal(cut.status,200); a.baselineCash = cut.body.efectivoEsperado; persist();
    const floors = await rt.read(`/api/locations/${a.site.id}/pisos`);
    assert.equal(floors.status,200);
    const floor = (Array.isArray(floors.body)?floors.body:floors.body.pisos)[0];
    const entry = await post(`v10-stock-${a.id}`, "/api/inventario/entradas", {
      ubicacionId:a.site.id, proveedorId:prior.supplier.id, observaciones:"POSTREVIEW26 cashv10 independent concurrency stock",
      uuidCliente:crypto.randomUUID(),lineas:[{productoId:prior.product.id,costoUnitario:"50",cantidades:Array(12).fill("10"),pisosPorCantidad:Array(12).fill(floor.id)}]
    });
    for (let k=0;k<12;k++) {
      const sale = await post(`v10-ticket-${a.id}-${k}`, "/api/tickets", {
        uuidCliente:crypto.randomUUID(),ubicacionId:a.site.id,tipo:"NORMAL",facturado:false,clienteId:prior.client.id,diasPlazo:null,
        lineas:[{rolloId:entry.rollos[k].id,productoId:prior.product.id,tipo:"NORMAL",cantidad:10,precioUnitario:100}],documentoTipo:"TICKET",notaSinPrecios:false
      });
      a.tickets.push({id:sale.id,folio:sale.folio,total:sale.total});persist();
    }
  }
  assert.equal(fs.readFileSync(oldPath).equals(oldBytes),true);
  rt.result.checks.push({oldUncertainPreserved:true,actors:state.fixtures.cashiers.map(a=>({id:a.id,ticketIds:a.tickets.map(t=>t.id),baselineCash:a.baselineCash}))});
} catch(e) {error=e;} finally {await rt.finish(error);}