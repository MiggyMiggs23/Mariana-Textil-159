import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import pg from "../../../node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js";
import { start, state, origin, config } from "./runtime.mjs";
const rt = await start("independent-final"), { p, read, snap, result } = rt, f = state.fixtures;
let error, connection;
try {
  const checks = result.checks;
  for (const sale of [f.cashSale, f.creditSale, f.remateSale]) {
    const value = await read(`/api/tickets/${sale.id}`); assert.equal(value.status, 200); checks.push({ sale: value.body });
  }
  const credit = await read(`/api/clientes/${f.client.id}/credito`); assert.equal(credit.status, 200);
  assert.equal(credit.body.saldoActual, "450.00"); assert.equal(credit.body.saldoAFavor, "0.00"); assert.equal(credit.body.creditoDisponible, "49550.00"); checks.push({ credit: credit.body });
  const cut = await read(`/api/sesiones-caja/${f.cash.id}/corte`); assert.equal(cut.status, 200);
  assert.equal(cut.body.sesion.estado, "CERRADA"); assert.equal(cut.body.efectivoEsperado, "1925.00");
  assert.equal(cut.body.efectivoContado, "1925.00"); assert.equal(cut.body.diferencia, "0.00");
  assert.equal(cut.body.efectivoDesglose.cobrosRetenidos, "300.00");
  assert.equal(cut.body.efectivoDesglose.abonosFisicos, "250.00"); checks.push({ cut: cut.body });
  const secret = JSON.parse(fs.readFileSync("/tmp/postrelease-review-20260926/postreview_financial_20260926/test-env.json", "utf8"));
  assert.equal(decodeURIComponent(new URL(secret.TEST_DATABASE_URL).pathname.slice(1)), config.database);
  connection = new pg.Client({ connectionString: secret.TEST_DATABASE_URL }); await connection.connect();
  await connection.query("BEGIN TRANSACTION READ ONLY");
  const db = (await connection.query("SELECT current_database() AS database, current_setting('transaction_read_only') AS read_only")).rows[0];
  assert.equal(db.database, config.database); assert.equal(db.read_only, "on"); checks.push({ postgresIdentity: db });
  const payments = (await connection.query("SELECT p.ticket_id,p.forma_pago,p.importe,t.sesion_caja_id FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id WHERE ticket_id = ANY($1::int[]) ORDER BY ticket_id", [[f.cashSale.id, f.remateSale.id]])).rows;
  assert.equal(payments.reduce((sum, r) => sum + Number(r.importe), 0), 1400); checks.push({ postgresTicketPayments: payments });
  const movements = (await connection.query("SELECT id,tipo,importe,ticket_id,forma_pago,cuenta_destino,sesion_caja_id,naturaleza,operacion_productor FROM movimientos_credito WHERE cliente_id=$1 ORDER BY id", [f.client.id])).rows;
  checks.push({ postgresCanonicalMovements: movements });
  const receipts = (await connection.query("SELECT id,detail FROM e5_cobros WHERE ubicacion_id=$1 ORDER BY id", [f.site.id])).rows;
  assert.equal(receipts.length, 2);
  assert.equal(receipts.reduce((sum, r) => sum + Number(r.detail.importeRecibido), 0), 400);
  assert.equal(receipts.reduce((sum, r) => sum + Number(r.detail.importeAplicado), 0), 300);
  assert.equal(receipts.reduce((sum, r) => sum + Number(r.detail.importePendiente), 0), 100);
  checks.push({ postgresE5Receipts: receipts }); await connection.query("ROLLBACK");
  await p.goto(origin + "/cobros"); await p.getByRole("combobox").first().click();
  await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
  await p.getByRole("button", { name: "Historial de cortes", exact: true }).click();
  await p.getByRole("button", { name: "Ver corte", exact: true }).first().click();
  await p.getByRole("dialog").getByText("$1,925.00", { exact: true }).first().waitFor();
  await snap("nonempty-closed-cut");
  await p.getByRole("button", { name: "Imprimir Corte", exact: true }).click();
  const pdf = path.join(rt.folder, "corte-cerrado-1925.pdf");
  await p.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true }); rt.register(pdf);
  await p.setViewportSize({ width: 390, height: 844 });
  await snap("mobile-cut");
  await p.goto(origin + f.receiptHref); await p.locator('#e3-pages[data-ready="true"]').waitFor(); await snap("mobile-receipt");
  result.interpretation = "Caja 1000+400+250+300-25=1925; transferencia100 no efectivo; aplicaciones E5 no duplican ingreso; deuda1000-250-200-100=450; retenido100 no favor.";
} catch (e) { error = e; }
finally { if (connection) await connection.end(); await rt.finish(error); }