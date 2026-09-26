import assert from "node:assert/strict";
import { launch, recorder, session, credentials, origin, readState, api } from "./runtime.mjs";
const b = await launch(), r = recorder("audit-final-stable-sequential-login"), state = readState();
try {
  const pages = [];
  for (const [i, actor] of [credentials.admin, ...state.auditActors].entries()) pages.push(await session(b, actor, "AUDIT-FINAL-" + i, r, true));
  await r.check("same-audit-three-sessions-rejoin-and-stable-four-count", async () => {
    await Promise.all(pages.map(async (p, i) => {
      await p.goto(origin + "/inventario/auditorias");
      await p.getByTestId("select-audit-site").click(); await p.getByRole("option").filter({ hasText: state.site.nombre }).click();
      await p.getByRole("button", { name: "Unirme a la auditoría", exact: true }).click();
      await p.getByTestId("dialog-audit-floor").waitFor();
      await p.getByTestId("select-audit-floor").click(); await p.getByRole("option", { name: state.floors[i].nombre, exact: true }).click();
      await p.getByTestId("button-continue-audit-floor").click(); await p.getByTestId("button-confirm-audit-floor").click();
      await p.getByTestId("shared-escaneados").filter({ hasText: /^4$/ }).waitFor();
    }));
    return { auditId: state.audit.id, currentCount: 4 };
  });
  await r.check("intentional-known-duplicate-final-visible-toast-author-preserved", async () => {
    assert.equal(state.operations["audit-duplicate"].status, "ACK");
    const p = pages[2], expected = state.operations["audit-duplicate"].original;
    const before = await api(p, `/api/inventario/auditorias/${state.audit.id}`);
    assert.deepEqual(before.body.resultados.find(x => x.serie === expected.serie), expected);
    await p.getByTestId("input-audit-scan").fill(expected.serie);
    await p.getByTestId("input-audit-scan").press("Enter");
    await p.getByText("Serie ya registrada", { exact: true }).first().waitFor();
    await p.getByTestId("input-audit-scan").scrollIntoViewIfNeeded();
    await r.snap(p, "mobile-readable-already-registered-original-author", false);
    const after = await api(p, `/api/inventario/auditorias/${state.audit.id}`);
    assert.deepEqual(after.body.resultados.find(x => x.serie === expected.serie), expected);
    assert.equal(after.body.totalEscaneados, 4);
    await p.waitForTimeout(45000);
    const sessions = await Promise.all(pages.map(page => api(page, "/api/auth/me")));
    assert.ok(sessions.every(x => x.status === 200));
    const final = await api(p, `/api/inventario/auditorias/${state.audit.id}`);
    assert.equal(final.body.totalEscaneados, 4); assert.equal(final.body.participantes.filter(x => x.activo).length, 3);
    for (const [i, page] of pages.entries()) {
      assert.ok(await page.getByTestId("input-audit-scan").isEnabled());
      await page.getByTestId("input-audit-scan").scrollIntoViewIfNeeded();
      await r.snap(page, "mobile-stable-session-" + i, false);
    }
    return { original: expected, total: final.body.totalEscaneados, sessionStatuses: sessions.map(x => x.status), activeParticipants: final.body.participantes.filter(x => x.activo), noApplicationOfAudit: true };
  });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }