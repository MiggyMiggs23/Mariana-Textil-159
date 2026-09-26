import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { load, browserKit, session, recorder, api } from "./runtime.mjs";
const adminOnly = process.argv.includes("--admin-only");
const { m, credentials } = load(), b = await browserKit(m), r = recorder(adminOnly ? 3 : 5, adminOnly ? "final-browser-session-readbacks" : "independent-final-readbacks");
const state = JSON.parse(fs.readFileSync(path.join(m.privateDir, "browser-continuation-state.json")));
const fixture = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
const read = async (p, url) => {
  return api(p, url);
};
try {
  for (const role of adminOnly ? [] : ["A", "F"]) {
    let p;
    await r.check(role + "-quiescent-profile-identity", async () => {
      p = await session(b, m, { ...state.roles[role], synthetic: true });
      await p.goto(m.origin + "/favicon.png"); // same-origin image document stops SPA reads; browser Secure cookie semantics stay intact.
      const d = await read(p, "/api/e11/identidad");
      r.result[role + "Identity"] = d; r.save();
      assert.equal(d.status, 200); assert.equal(d.body.perfil, role);
      return { status: d.status, perfil: d.body.perfil };
    });
    for (const endpoint of ["/api/fondo", `/api/proveedores/${fixture.supplierId}/pagos`, `/api/tickets/${fixture.noteSaleId}`, `/api/clientes/${m.clients.credit.id}`]) await r.check(role + endpoint.replaceAll("/", "-"), async () => {
      assert.ok(p); const d = await read(p, endpoint); assert.equal(d.status, 403);
      return { status: d.status, endpoint };
    });
  }
  let p;
  if (adminOnly) {
    const context = await b.newContext({ storageState: path.join(m.privateDir, "admin-browser-state.json"), viewport: { width: 1360, height: 1000 } });
    await context.route("**/*", route => new URL(route.request().url()).origin === m.origin ? route.continue() : route.abort());
    p = await context.newPage(); p.setDefaultTimeout(15000);
  } else p = await session(b, m, credentials.admin);
  await p.goto(m.origin + "/favicon.png");
  const me = await read(p, "/api/auth/me"); assert.equal(me.status, 200);
  await r.check("fresh-audit-attribution-readback", async () => {
    const d = await read(p, `/api/inventario/auditorias/${m.audit.auditId}`); assert.equal(d.status, 200);
    const duplicate = d.body.resultados.filter(x => x.serie === m.audit.series[3]);
    const desktop = d.body.resultados.find(x => x.serie === m.audit.series[4]);
    r.result.auditRows = { duplicate, desktop }; assert.equal(duplicate.length, 1);
    return { totalEscaneados: d.body.totalEscaneados, duplicate, desktop };
  });
  await r.check("settled-note-independent-readback", async () => {
    const d = await read(p, `/api/tickets/${m.targets["return-settled"].noteId}`); assert.equal(d.status, 200);
    assert.equal(Number(d.body.saldoPendiente), 0);
    await p.goto(m.origin + `/tickets/${d.body.id}`);
    await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await r.snap(p, "real-settled-note-document");
    await p.goto(m.origin + "/favicon.png");
    return { id: d.body.id, folio: d.body.folio, documentoTipo: d.body.documentoTipo, saldoPendiente: d.body.saldoPendiente };
  });
  await r.check("six-performance-tickets-remain-unpaid", async () => {
    const input = JSON.parse(fs.readFileSync("/tmp/noche-20260926/payment-input.json"));
    const ids = [...input.before, ...input.after];
    assert.equal(ids.length, 6);
    for (const item of ids) { const d = await read(p, `/api/tickets/${item.id}`); assert.equal(d.status, 200); assert.equal(d.body.cobrado, false); }
    return { ids: ids.map(x => x.id), nativeProvenance: true, payable: true };
  });
  await r.check("closed-cash-zero-difference", async () => {
    const d = await read(p, m.targets["flow-close-recovery"].closeReadbackPath);
    assert.equal(d.status, 200); assert.equal(Number(d.body.diferencia), 0);
    return { efectivoContado: d.body.efectivoContado, efectivoEsperado: d.body.efectivoEsperado, diferencia: d.body.diferencia };
  });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }