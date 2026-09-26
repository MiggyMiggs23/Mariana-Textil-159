import fs from "node:fs";
import path from "node:path";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load(), r = recorder(3, "remaining-targets"), b = await browserKit(m);
const f = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
try {
  const p = await session(b, m, credentials.admin);
  const roles = JSON.parse(fs.readFileSync(path.join(m.privateDir, "browser-continuation-state.json")));
  m.targets.sensitiveSupplierId = f.supplierId;
  m.targets.sensitiveTicketId = f.noteSaleId;
  m.targets["flow-remate-mark"] = { rollId: f.rollIds[3] };
  m.targets["flow-sale-remate"] = { series: f.rollSeries[3] };
  m.targets["flow-credit-sale-settled"] = { series: f.rollSeries[4] };
  m.accountantProjections = { A: ["/api/e11/finanzas/clientes"], F: ["/api/e11/fiscal/ventas?desde=2026-09-25&hastaExclusivo=2026-09-27&limit=20"] };
  await r.check("cash-session-independent-read", async () => {
    const actual = await api(p, `/api/sesiones-caja/actual?ubicacionId=${m.site.id}`);
    if (actual.status !== 200) throw Error("Actual session HTTP " + actual.status);
    r.result.actual = actual.body;
    return { status: actual.status, body: actual.body };
  });
  m.broad.paths = [...new Set([...m.broad.paths, "/inventario/auditorias", `/clientes/${m.clients.credit.id}`, `/proveedores/${f.supplierId}`, `/productos/${f.productId}`, `/inventario/rollos/${f.rollIds[0]}`, `/tickets/8`, `/recibos-e3/${m.targets["flow-receipt"].receiptFolio}`, "/contabilidad/conciliaciones", "/cobros/pendientes"])];
  await p.goto(m.origin + `/inventario/rollos/${f.rollIds[0]}`);
  r.result.rollLinks = await p.getByRole("link").evaluateAll(a => a.map(x => ({ text: x.textContent, href: x.getAttribute("href") })));
  fs.writeFileSync(process.env.NIGHT_BROWSER_MANIFEST, JSON.stringify(m, null, 2), { mode: 0o600 });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }