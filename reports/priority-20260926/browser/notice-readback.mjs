import assert from "node:assert/strict";
import { launch, recorder, session, credentials, origin, readState, api } from "./runtime.mjs";
const b = await launch(), r = recorder("v8-admin-real-discrepancy"), state = readState();
try {
  const p = await session(b, credentials.admin, "ADMIN-REAL-NOTICE", r);
  await r.check("native-admin-no-cuadra-notice-and-document", async () => {
    const id = state.reconciliations["DIA-NO_CUADRA"].id;
    const d = await api(p, `/api/e11/conciliaciones/${id}`); assert.equal(d.status, 200);
    assert.equal(d.body.totalFacturado, "1160.00");
    const decision = d.body.decisiones.find(x => x.resultado === "NO_CUADRA"); assert.ok(decision.avisoAdminId);
    await p.goto(origin + "/notificaciones");
    const link = p.locator(`a[href="/contabilidad/conciliaciones/${id}"]`).filter({ hasText: /NO CUADRA/ }).first();
    await link.waitFor(); await r.snap(p, "admin-genuine-no-cuadra-link");
    await link.click(); await p.getByRole("heading", { name: /Snapshot documental/ }).waitFor();
    return { snapshotId: id, actualTotal: d.body.totalFacturado, decision, documentOpened: true };
  }, [p]);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }