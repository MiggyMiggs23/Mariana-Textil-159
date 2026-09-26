// Playwright port of auditoria-colaborativa/browser-live/verify-browser.mjs.
// Uses real UI selectors + authenticated API readback; deliberately no SQL or fixtures writes.
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";

const { m, credentials } = load();
const r = recorder(4, "audit"), cfg = m.audit;
const browser = await browserKit(m);
const pages = [];
let auditId = cfg?.auditId;
const go = async p => {
  await p.goto(m.origin + "/inventario/auditorias");
  await p.getByTestId("select-audit-site").click();
  await p.getByRole("option").filter({ hasText: cfg.siteName }).click();
};
const join = async p => p.getByRole("button", { name: "Unirme a la auditoría", exact: true }).click();
const floor = async (p, name) => {
  await p.getByTestId("dialog-audit-floor").waitFor();
  await p.getByTestId("select-audit-floor").click();
  await p.getByRole("option", { name, exact: true }).click();
  await p.getByTestId("button-continue-audit-floor").click();
  await p.getByTestId("button-confirm-audit-floor").click();
  await p.getByTestId("input-audit-scan").waitFor();
  assert.equal(await p.getByTestId("audit-floor-name").innerText(), name);
};
const scan = async (p, series) => {
  const input = p.getByTestId("input-audit-scan");
  await input.fill(series); await input.press("Enter");
};
const detail = async () => {
  const d = await api(pages[0], `/api/inventario/auditorias/${auditId}`);
  assert.equal(d.status, 200); return d.body;
};
try {
  const setup = await r.check("six-synthetic-native-sessions", async () => {
    assert.equal(credentials.auditUsers?.length, 6, "Six provisioned synthetic audit users required");
    assert.ok(cfg.floors?.length >= 3 && cfg.series?.length >= 5 && auditId, "Actual audit ID, three ordered floors and five stock series required");
    for (let i = 0; i < 6; i++) pages.push(await session(browser, m, credentials.auditUsers[i], i < 3));
    await Promise.all(pages.map(go));
    return { actors: 6, auditId };
  });
  if (!setup) throw Error("Audit setup blocked; remaining individual cases recorded below");
  await r.check("three-concurrent-distinct-floors", async () => {
    await Promise.all(pages.slice(0, 3).map(join));
    await Promise.all([floor(pages[0], cfg.floors[1].name), floor(pages[1], cfg.floors[0].name), floor(pages[2], cfg.floors[2].name)]);
    await Promise.all(pages.slice(0, 3).map((p, i) => scan(p, cfg.series[i])));
    for (const p of pages.slice(0, 3)) await p.getByTestId("shared-escaneados").filter({ hasText: /^3$/ }).waitFor();
    const d = await detail(); assert.equal(d.totalEscaneados, 3);
    return { totalEscaneados: d.totalEscaneados };
  }, pages.slice(0, 3));
  await r.check("roll-on-another-floor", async () => {
    const d = await detail(), row = d.resultados.find(x => x.serie === cfg.series[0]);
    assert.equal(row.clasificacion, "MAL_ACOMODADO");
    assert.equal(row.pisoEsperado, cfg.floors[0].name);
    assert.equal(row.pisoReal, cfg.floors[1].name);
    assert.equal(row.usuarioNombre, credentials.auditUsers[0].name || credentials.auditUsers[0].nombre);
    return { series: row.serie, expected: row.pisoEsperado, actual: row.pisoReal, author: row.usuarioNombre };
  }, pages.slice(0, 1));
  await r.check("same-roll-two-users", async () => {
    await Promise.all(pages.slice(0, 2).map(p => scan(p, cfg.series[3])));
    await pages[0].getByTestId("shared-escaneados").filter({ hasText: /^4$/ }).waitFor();
    const before = (await detail()).resultados.filter(x => x.serie === cfg.series[3]);
    assert.equal(before.length, 1);
    await scan(pages[0], cfg.series[3]);
    await pages[0].getByText(/Serie ya registrada/).first().waitFor();
    const after = (await detail()).resultados.filter(x => x.serie === cfg.series[3]);
    assert.deepEqual(after, before, "Duplicate must preserve original floor and author");
    return { count: after.length, author: after[0].usuarioNombre };
  }, pages.slice(0, 2));
  await r.check("desktop-fixed-first-configured-floor", async () => {
    await Promise.all(pages.slice(3, 5).map(join));
    for (const p of pages.slice(3, 5)) {
      await p.getByTestId("input-audit-scan").waitFor();
      assert.equal(await p.getByTestId("input-audit-scan").isEnabled(), true);
      assert.equal(await p.getByTestId("audit-floor-name").innerText(), cfg.floors[0].name);
      assert.equal(await p.getByTestId("button-change-audit-floor").count(), 0);
    }
    await scan(pages[3], cfg.series[4]);
    await pages[3].getByTestId("shared-escaneados").filter({ hasText: /^5$/ }).waitFor();
    const row = (await detail()).resultados.find(x => x.serie === cfg.series[4]);
    assert.equal(row.pisoReal, cfg.floors[0].name);
    return { floor: cfg.floors[0].name, rule: "First active configured floor in nombre ASC order; physical access floor unspecified; keyboard wedge simulated by real browser input, not physical scanner hardware." };
  }, pages.slice(3, 4));
  await r.check("sixth-user-rejected", async () => {
    const response = pages[5].waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname.endsWith("/participar"));
    await join(pages[5]); assert.equal((await response).status(), 409);
    assert.equal(await pages[5].getByTestId("input-audit-scan").isDisabled(), true);
    return { status: 409 };
  }, pages.slice(5, 6));
} catch (e) {
  for (const id of ["three-concurrent-distinct-floors", "roll-on-another-floor", "same-roll-two-users", "desktop-fixed-first-configured-floor", "sixth-user-rejected"]) {
    if (!r.result.checks.some(x => x.id === id)) await r.check(id, async () => { throw e; });
  }
} finally { r.finish(); await browser.close(); }