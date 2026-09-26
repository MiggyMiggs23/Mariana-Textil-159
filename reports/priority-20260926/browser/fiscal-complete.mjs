import assert from "node:assert/strict";
import { launch, recorder, session, credentials, origin, readState, persist, nativeWrite, api } from "./runtime.mjs";
assert.equal(process.env.PRIORITY_FISCAL, "MAIN_READY");
const remaining = process.env.PRIORITY_REMAINING === "1";
const weekMonth = process.env.PRIORITY_WEEK_MONTH === "1";
const b = await launch(), r = recorder(weekMonth ? "closed-periods-week-month-complete" : remaining ? "closed-periods-lifecycle-complete" : process.env.PRIORITY_ACK === "1" ? "closed-periods-v8-complete" : process.env.PRIORITY_V8 === "1" ? "closed-periods-v8" : process.env.PRIORITY_OBSERVED === "1" ? "closed-periods-observed" : "closed-periods-confirmed"), state = readState();
const prefix = weekMonth ? "clock-consistent-" : process.env.PRIORITY_OBSERVED === "1" ? "observed-" : "";
if (prefix) assert.equal(state.originalSnapshotResolution?.estado, "CERRADA_SIN_EFECTO");
const periods = [
  { tipo: "DIA", inicio: "2026-09-25", fin: "2026-09-26", resultado: "NO_CUADRA" },
  { tipo: "DIA", inicio: "2026-09-25", fin: "2026-09-26", resultado: "ACEPTADA" },
  { tipo: "SEMANA", inicio: "2026-09-21", fin: "2026-09-28", resultado: "ACEPTADA" },
  { tipo: "MES", inicio: "2026-09-01", fin: "2026-10-01", resultado: "ACEPTADA" },
];
try {
  const f = await session(b, state.roles.F, "F-CLOSED", r), admin = await session(b, credentials.admin, "ADMIN-CLOSED", r);
  await r.check("controlled-clock-and-native-nonempty-fiscal-document", async () => {
    assert.equal(await f.evaluate(() => new Date().toISOString()), "2026-10-02T18:00:00.000Z");
    const d = await api(f, `/api/e11/fiscal/facturas/${state.sales.invoice.id}`); assert.equal(d.status, 200);
    assert.equal(Number(d.body.totalFacturado), 1160);
    assert.equal(d.body.fechaFacturacion, "2026-09-26T05:13:43.647Z");
    await f.goto(origin + "/contabilidad/fiscal");
    await f.getByLabel("Desde (día CDMX)", { exact: true }).fill("2026-09-25");
    await f.getByLabel("Hasta, exclusivo (día CDMX)", { exact: true }).fill("2026-09-26");
    await f.getByRole("button", { name: "Consultar intervalo", exact: true }).click();
    await f.getByRole("link", { name: new RegExp(`Documento interno ${state.sales.invoice.folio}\\b`) }).click();
    await f.getByRole("heading", { name: /Documento interno facturado/ }).waitFor();
    return { nativeInvoice: d.body, fixedClock: "2026-10-02T18:00:00Z", historyUnchanged: true };
  }, [f]);
  state.reconciliations ??= {};
  if (remaining) assert.equal(state.confirmedDecisionRecovery?.originalSnapshotResolution?.estado, "CONFIRMADA");
  if (weekMonth) assert.equal(state.weekSnapshotRecovery?.originalSnapshotResolution?.estado, "CERRADA_SIN_EFECTO");
  for (const period of periods) {
    if (weekMonth && period.tipo === "DIA") continue;
    if (remaining && period.resultado === "NO_CUADRA") continue;
    const key = `${period.tipo}-${period.resultado}`;
     const passed = await r.check(key + "-native-snapshot-and-decision", async () => {
      const source = await api(f, `/api/e11/fiscal/ventas?desde=${period.inicio}&hastaExclusivo=${period.fin}&limit=20`);
      assert.equal(source.status, 200); assert.ok(source.body.items.some(x => x.ventaId === state.sales.invoice.id));
      assert.equal(Number(source.body.totalFacturado), 1160, "Never reconcile an empty source");
       let snapshot;
       if (process.env.PRIORITY_ACK === "1" && key === "DIA-NO_CUADRA") {
         assert.equal(state.confirmedSnapshotRecovery.originalSnapshotResolution.estado, "CONFIRMADA");
         snapshot = state.operations[prefix + key + "-snapshot"].body;
         await f.goto(origin + `/contabilidad/conciliaciones/${snapshot.id}`);
       } else {
       await f.goto(origin + "/contabilidad/conciliaciones");
      await f.getByLabel("Desde (día CDMX)", { exact: true }).fill(period.inicio);
      await f.getByLabel("Hasta, exclusivo (día CDMX)", { exact: true }).fill(period.fin);
      await f.getByRole("button", { name: "Consultar intervalo", exact: true }).click();
      const article = f.locator("article").filter({ has: f.getByRole("heading", { name: new RegExp(`^${period.tipo} · ${period.inicio}`) }) });
      // These ranges start on the target day/week/month; target is on page one.
      // Wait for the asynchronous native query instead of inspecting stale pagination.
      await article.waitFor();
      await article.getByRole("button", { name: /Revisar y congelar periodo|Revisar nueva versión vinculada/ }).click();
      await f.getByRole("button", { name: "Revisar snapshot", exact: true }).click();
       snapshot = await nativeWrite(state, f, prefix + key + "-snapshot", "POST", "/api/e11/conciliaciones", f.getByRole("button", { name: "Confirmar snapshot inmutable", exact: true }));
       await f.getByText("Recuperación E11 pendiente — no crear otra intención", { exact: true }).waitFor({ state: "hidden" });
       await f.getByRole("link", { name: "Abrir cifra congelada y conciliar", exact: true }).click();
       }
      state.reconciliations[key] = { id: snapshot.id }; persist(state);
      const frozen = await api(f, `/api/e11/conciliaciones/${snapshot.id}`); assert.equal(frozen.status, 200);
      assert.equal(frozen.body.totalFacturado, source.body.totalFacturado);
      await f.locator("select").selectOption(period.resultado);
      await f.getByLabel("Total del registro externo", { exact: true }).fill(period.resultado === "NO_CUADRA" ? "1159.00" : "1160.00");
      await f.getByLabel("Referencia externa obligatoria (texto)", { exact: true }).fill("PRIORITY-NATIVO-" + key);
      if (period.resultado === "NO_CUADRA") await f.locator("textarea").fill("Ensayo documental declarado: registro externo de prueba 1159 frente a factura real1160; diferencia1. Sin modificar dinero ni factura.");
      await f.getByRole("button", { name: "Revisar decisión documental", exact: true }).click();
       await nativeWrite(state, f, prefix + key + "-decision", "POST", `/api/e11/conciliaciones/${snapshot.id}/decisiones`, f.getByRole("button", { name: "Confirmar decisión", exact: true }));
       await f.getByText("Recuperación E11 pendiente — no crear otra intención", { exact: true }).waitFor({ state: "hidden" });
      const read = await api(f, `/api/e11/conciliaciones/${snapshot.id}`); assert.equal(read.status, 200);
      const decision = read.body.decisiones.find(x => x.resultado === period.resultado); assert.ok(decision);
      if (period.resultado === "NO_CUADRA") assert.ok(decision.avisoAdminId);
      if (key === "DIA-ACEPTADA") assert.equal(read.body.anteriorId, state.reconciliations["DIA-NO_CUADRA"].id, "Must preserve and link prior discrepancy evidence");
      state.reconciliations[key] = { id: snapshot.id, anteriorId: read.body.anteriorId, resultado: decision.resultado, avisoAdminId: decision.avisoAdminId }; persist(state);
      await r.snap(f, key + "-actual-decision");
      if (period.resultado === "NO_CUADRA") {
        await admin.goto(origin + "/notificaciones");
        const link = admin.locator(`a[href="/contabilidad/conciliaciones/${snapshot.id}"]`).filter({ hasText: /NO CUADRA/ }).first();
        await link.waitFor(); await r.snap(admin, "admin-real-no-cuadra-notification");
        await link.click(); await admin.getByRole("heading", { name: /Snapshot|Conciliación|Cifra congelada/i }).first().waitFor();
        await r.snap(admin, "admin-real-no-cuadra-document");
      }
      const me = await api(f, "/api/auth/me"); assert.equal(me.status, 200);
      return { period, ...state.reconciliations[key], sourceTotal: source.body.totalFacturado, externalTotal: period.resultado === "NO_CUADRA" ? "1159.00" : "1160.00", sessionStable: true };
    }, [f]);
     if (!passed) break;
  }
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }