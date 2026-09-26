// MAIN must grant the exclusive writer window before any invocation.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { load, base } from "./runtime.mjs";
if (process.env.NIGHT_BROWSER_WINDOW !== "MAIN_EXCLUSIVE_GRANTED") throw Error("Waiting for MAIN: permissions worker owns writer slot");
const { m } = load();
const phase = process.argv[2];
const manifestFile = process.env.NIGHT_BROWSER_MANIFEST;
const refresh = () => Object.assign(m, JSON.parse(fs.readFileSync(manifestFile, "utf8")));
const save = () => fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2), { mode: 0o600 });
const script = (file, args = []) => {
  const r = spawnSync(process.execPath, [path.join(base, "browser", file), ...args], { stdio: "inherit", timeout: 700000 });
  return r.status === 0;
};
const run = id => { refresh(); script("run.mjs", ["--case", id]); };
const result = (id, stage) => {
  const file = path.join(base, "tarea-3", id, stage + "-result.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file));
};
const sale = id => result(id, id === "flow-credit-sale" ? "credit-sale" : "sale")?.steps?.find(x => x.action === "create-sale-native")?.body;
const target = (id, value) => { refresh(); m.targets[id] = value; save(); };
if (phase === "fixtures") {
  script("native-fixtures.mjs");
  refresh();
  for (const id of ["continuation-fixtures", "continuation-roles"]) run(id);
} else if (phase === "cash-credit") {
  const fixture = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
  // Open an independent synthetic ADMIN session; existing shared open sessions are not closed/reused blindly.
  run("flow-cash-open");
  target("flow-e4", { insufficientAmount: "1" }); run("flow-e4");
  target("flow-sale", { series: fixture.rollSeries[0] }); run("flow-sale");
  const cash = sale("flow-sale");
  if (cash?.folio) target("flow-pay-cash", { ticketCaption: `Ticket folio ${cash.folio}` });
  run("flow-pay-cash");
  target("flow-sale-transfer", { series: fixture.rollSeries[1] }); run("flow-sale-transfer");
  const transfer = sale("flow-sale-transfer");
  if (transfer?.folio) target("flow-pay-transfer", { ticketCaption: `Ticket folio ${transfer.folio}` });
  run("flow-pay-transfer");
  target("flow-credit-sale", { series: fixture.rollSeries[2] }); run("flow-credit-sale");
  const credit = sale("flow-credit-sale");
  if (credit?.folio) target("flow-authorize-credit", { ticketCaption: `Nota folio ${credit.folio}` });
  run("flow-authorize-credit");
  refresh();
  if (credit?.id) {
    Object.assign(fixture, { noteSaleId: credit.id, notaId: credit.id, noteFolio: credit.folio, clienteId: m.clients.credit.id, clienteNombre: m.clients.credit.name, ubicacionId: m.site.id });
    fs.writeFileSync(path.join(m.privateDir, "fixture.json"), JSON.stringify(fixture, null, 2), { mode: 0o600 });
    target("return-debt", { path: `/notas/${credit.id}` });
  }
  run("flow-abono");
  // Receipt folio is discovered from actual output, never assumed to be the first receipt in copied data.
  const abono = result("flow-abono", "abono")?.steps?.find(x => x.action === "ordinary-abono-native")?.body;
  const folio = abono?.recibo?.folio || abono?.reciboFolio || abono?.folioRecibo;
  if (folio) target("flow-receipt", { receiptFolio: folio });
  run("flow-receipt");
  for (const id of ["continuation-receive", "continuation-reject", "continuation-prepareA", "continuation-apply", "flow-e4-normal", "return-debt", "return-settled", "accountant-boundaries", "broad"]) run(id);
} else if (phase === "remaining") {
  // MAIN/runner fills authentic rollId and independently counted close balance from readback.
  for (const id of ["flow-remate-mark", "flow-sale-remate", "audit", "continuation-fiscal", "flow-close"]) run(id);
} else throw Error("Usage: orchestrate.mjs fixtures | cash-credit | remaining");