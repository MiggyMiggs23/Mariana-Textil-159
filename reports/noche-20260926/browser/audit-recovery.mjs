import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load(), r = recorder(4, "audit-independent-recovery"), b = await browserKit(m), pages = [];
const c = m.audit;
const go = async p => {
  await p.goto(m.origin + "/inventario/auditorias");
  await p.getByTestId("select-audit-site").click();
  await p.getByRole("option").filter({ hasText: c.siteName }).click();
};
try {
  const admin = await session(b, m, credentials.admin);
  await r.check("duplicate-readback-after-concurrency-error", async () => {
    const d = await api(admin, `/api/inventario/auditorias/${c.auditId}`);
    assert.equal(d.status, 200);
    const rows = d.body.resultados.filter(x => x.serie === c.series[3]);
    assert.equal(rows.length, 1);
    r.result.originalDuplicate = rows[0];
    return { totalEscaneados: d.body.totalEscaneados, uniqueDuplicateRow: rows.length, author: rows[0].usuarioNombre, floor: rows[0].pisoReal, limitation: "Original simultaneous browser operation displayed REVISION_OBSOLETA full-page technical error; readback proves one persisted row, not successful UI handling." };
  }, [admin]);
  for (let i = 0; i < 6; i++) {
    let p;
    await r.check("fresh-login-" + i, async () => {
      p = await session(b, m, credentials.auditUsers[i], i < 3); pages[i] = p;
      p.on("response", async response => {
        if (response.status() >= 400 && new URL(response.url()).pathname.includes("/auditorias/")) {
          r.result.apiErrors ||= [];
          r.result.apiErrors.push({ actor: i, status: response.status(), path: new URL(response.url()).pathname, body: await response.json().catch(() => null) }); r.save();
        }
      });
      await go(p); return { actor: i };
    });
    if (!p) continue;
    if (i < 5) await r.check("fresh-join-" + i, async () => {
      const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname.endsWith("/participar"));
      await p.getByRole("button", { name: "Unirme a la auditoría", exact: true }).click();
      const response = await pending; assert.equal(response.status(), 200);
      if (i < 3) {
        await p.getByTestId("select-audit-floor").click(); await p.getByRole("option", { name: c.floors[i].name, exact: true }).click();
        await p.getByTestId("button-continue-audit-floor").click(); await p.getByTestId("button-confirm-audit-floor").click();
      }
      await p.getByTestId("input-audit-scan").waitFor();
      return { status: 200 };
    }, [p]);
  }
  await r.check("desktop-actual-first-floor-keyboard-scan", async () => {
    const p = pages[3];
    assert.equal(await p.getByTestId("audit-floor-name").innerText(), c.floors[0].name);
    assert.equal(await p.getByTestId("button-change-audit-floor").count(), 0);
    const d = await api(admin, `/api/inventario/auditorias/${c.auditId}`);
    if (!d.body.resultados.some(x => x.serie === c.series[4])) {
      await p.getByTestId("input-audit-scan").fill(c.series[4]); await p.getByTestId("input-audit-scan").press("Enter");
      await p.getByTestId("shared-escaneados").filter({ hasText: /^5$/ }).waitFor();
    }
    const after = await api(admin, `/api/inventario/auditorias/${c.auditId}`);
    const row = after.body.resultados.find(x => x.serie === c.series[4]); assert.equal(row.pisoReal, c.floors[0].name);
    return { actualFloor: row.pisoReal, interpretation: "Configured first floor, not an invented physical-access-floor mapping. Browser keyboard wedge, not physical gun." };
  }, pages[3] ? [pages[3]] : []);
  await r.check("sixth-full-capacity-response", async () => {
    const p = pages[5], pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname.endsWith("/participar"));
    await p.getByRole("button", { name: "Unirme a la auditoría", exact: true }).click();
    const response = await pending, body = await response.json();
    assert.equal(response.status(), 409);
    assert.ok(/limite|límite|participantes|capacidad|cinco|5|llena/i.test(JSON.stringify(body)), "409 must be real capacity rejection, not serialization conflict");
    return { status: response.status(), body };
  }, pages[5] ? [pages[5]] : []);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }