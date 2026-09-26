import assert from "node:assert/strict";
import { launch, recorder, session, credentials, origin, readState, api } from "./runtime.mjs";
const b = await launch(), r = recorder("fiscal-final-proof"), state = readState();
try {
  const p = await session(b, state.roles.F, "F-FINAL", r);
  const ids = {
    "DIA-NO_CUADRA": "59625031-5fa3-40d0-adbf-3eaacea36fd2",
    "DIA-ACEPTADA": state.reconciliations["DIA-ACEPTADA"].id,
    "SEMANA-ACEPTADA": state.reconciliations["SEMANA-ACEPTADA"].id,
    "MES-ACEPTADA": state.reconciliations["MES-ACEPTADA"].id,
  };
  for (const [key, id] of Object.entries(ids)) await r.check(key + "-independent-final-native-readback", async () => {
    const d = await api(p, `/api/e11/conciliaciones/${id}`); assert.equal(d.status, 200);
    assert.equal(d.body.totalFacturado, "1160.00"); assert.equal(d.body.cantidadVentas, 1);
    const outcome = key.endsWith("NO_CUADRA") ? "NO_CUADRA" : "ACEPTADA";
    const decision = d.body.decisiones.find(x => x.resultado === outcome); assert.ok(decision);
    assert.equal(decision.totalExterno, outcome === "NO_CUADRA" ? "1159.00" : "1160.00");
    if (key === "DIA-ACEPTADA") assert.equal(d.body.anteriorId, ids["DIA-NO_CUADRA"]);
    if (outcome === "NO_CUADRA") assert.ok(decision.avisoAdminId);
    await p.goto(origin + `/contabilidad/conciliaciones/${id}`);
    await p.getByRole("heading", { name: /Snapshot documental/ }).waitFor();
    await p.getByText(outcome, { exact: true }).first().waitFor();
    await p.getByText(/Documento interno 1 · PRIORITY CLIENTE NATIVO/).waitFor();
    const me = await api(p, "/api/auth/me"); assert.equal(me.status, 200);
    return { id, periodo: d.body.periodo, anteriorId: d.body.anteriorId, vigente: d.body.vigente, total: d.body.totalFacturado, decision, stableSession: true };
  }, [p]);
  await r.check("historical-invoice-unchanged", async () => {
    const d = await api(p, `/api/e11/fiscal/facturas/${state.sales.invoice.id}`);
    assert.equal(d.status, 200); assert.equal(d.body.totalFacturado, "1160.00");
    assert.equal(d.body.fechaFacturacion, "2026-09-26T05:13:43.647Z");
    return { invoiceId: state.sales.invoice.id, total: d.body.totalFacturado, date: d.body.fechaFacturacion };
  });
  const admin = await session(b, credentials.admin, "ADMIN-FINAL", r);
  await r.check("admin-original-discrepancy-notice-survives-acceptance", async () => {
    await admin.goto(origin + "/notificaciones");
    const link = admin.locator(`a[href="/contabilidad/conciliaciones/${ids["DIA-NO_CUADRA"]}"]`).filter({ hasText: /NO CUADRA/ }).first();
    await link.waitFor(); await r.snap(admin, "final-admin-notice");
    await link.click(); await admin.getByRole("heading", { name: /Snapshot documental/ }).waitFor();
    return { originalNoCuadraId: ids["DIA-NO_CUADRA"], preservedNoticeAndNativeNavigation: true };
  }, [admin]);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }