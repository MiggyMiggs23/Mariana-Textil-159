import fs from "node:fs";
import path from "node:path";
import { load } from "./runtime.mjs";
const { m } = load();
const file = "reports/noche-20260926/tarea-3/flow-credit-sale-settled/credit-sale-result.json";
const sale = JSON.parse(fs.readFileSync(file)).steps.find(x => x.action === "create-sale-native").body;
if (!sale?.id || !sale.folio) throw Error("No actual settled-note precursor");
m.targets["flow-authorize-credit-settled"] = { ticketCaption: `Nota folio ${sale.folio}` };
// Independent native ledger: first note1000 - ordinary100 - directed ADMIN450 + second note1000.
m.targets["flow-abono-settled"] = { amount: "1450" };
m.targets["return-settled"] = { path: `/tickets/${sale.id}`, noteId: sale.id };
const fixture = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
m.targets["return-debt"] = { path: `/tickets/${fixture.noteSaleId}`, noteId: fixture.noteSaleId, note: "Previously observed debt before full ordinary settlement; preserve prior timeline" };
m.targets["flow-close"] = { countedCash: "2548", closeReadbackPath: "/api/sesiones-caja/1/corte" };
fs.writeFileSync(process.env.NIGHT_BROWSER_MANIFEST, JSON.stringify(m, null, 2), { mode: 0o600 });