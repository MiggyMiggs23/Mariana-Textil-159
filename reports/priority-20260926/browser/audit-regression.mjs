import assert from "node:assert/strict";
import crypto from "node:crypto";
import { launch, recorder, session, credentials, origin, readState, persist, nativeWrite, api } from "./runtime.mjs";
const b = await launch(), r = recorder("three-user-audit-confirmed"), state = readState(), pages = [];
try {
  const seed = await session(b, credentials.admin, "ADMIN-AUDIT-SEED", r);
  state.auditActors ??= [];
  for (let i = 0; i < 2; i++) {
    if (state.auditActors[i]?.id) continue;
    assert.ok(!state.auditActors[i], "Uncertain user creation");
    const actor = { username: "priorityaudit" + crypto.randomBytes(4).toString("hex"), password: crypto.randomBytes(20).toString("hex"), name: "PRIORITY AUDITOR " + i };
    state.auditActors[i] = actor; persist(state);
    await seed.goto(origin + "/usuarios"); await seed.getByRole("button", { name: "Nuevo Usuario", exact: true }).click();
    await seed.locator("#user-name").fill(actor.name); await seed.locator("#user-username").fill(actor.username);
    await seed.getByRole("dialog").getByRole("combobox").first().click(); await seed.getByRole("option", { name: "Administrador", exact: true }).click();
    await seed.locator("#user-password").fill(actor.password);
    const body = await nativeWrite(state, seed, "native-auditor-" + i, "POST", "/api/users", seed.getByRole("button", { name: "Crear usuario", exact: true }));
    actor.id = body.id; persist(state); await seed.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await seed.context().close();
  const actors = [credentials.admin, ...state.auditActors];
  assert.equal(actors.length, 3);
  for (const [i, actor] of actors.entries()) pages.push(await session(b, actor, "AUDIT-" + i, r, true));
  const p = pages[0];
  await r.check("fresh-own-fixture-readback-native-audit-open", async () => {
    const sites = await api(p, "/api/locations"); assert.equal(sites.status, 200);
    state.site = sites.body.find(x => x.id === state.site.id); assert.match(state.site.nombre, /^PRIORITY/);
    const floors = await api(p, `/api/locations/${state.site.id}/pisos`); assert.equal(floors.status, 200);
    state.floors = floors.body.filter(x => x.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)); assert.equal(state.floors.length, 3);
    const entry = await api(p, "/api/inventario/entradas/1"); assert.equal(entry.status, 200); state.entry = entry.body;
    state.auditSeries = state.entry.rollos.slice(2).map(x => x.serie); assert.equal(state.auditSeries.length, 6); persist(state);
    await p.goto(origin + "/inventario/auditorias");
    await p.getByTestId("select-audit-site").click(); await p.getByRole("option").filter({ hasText: state.site.nombre }).click();
    state.audit = await nativeWrite(state, p, "audit-open", "POST", "/api/inventario/auditorias", p.getByTestId("button-open-audit")); persist(state);
    return { auditId: state.audit.id, actors: actors.map(x => x.id), series: state.auditSeries };
  }, [p]);
  assert.ok(state.audit);
  const joined = await r.check("three-concurrent-joins-fixed-session-readbacks", async () => {
    await Promise.all(pages.map(async (p, i) => {
      await p.goto(origin + "/inventario/auditorias");
      await p.getByTestId("select-audit-site").click(); await p.getByRole("option").filter({ hasText: state.site.nombre }).click();
      await p.getByRole("button", { name: "Unirme a la auditoría", exact: true }).click();
      await p.getByTestId("dialog-audit-floor").waitFor();
      await p.getByTestId("select-audit-floor").click(); await p.getByRole("option", { name: state.floors[i].nombre, exact: true }).click();
      await p.getByTestId("button-continue-audit-floor").click(); await p.getByTestId("button-confirm-audit-floor").click();
      await p.getByTestId("input-audit-scan").waitFor();
    }));
    return { participants: 3 };
  }, pages);
  assert.ok(joined, "Stop before scan intentions if joins fail");
  const scan = async (p, serie) => { await p.getByTestId("input-audit-scan").fill(serie); await p.getByTestId("input-audit-scan").press("Enter"); };
  await r.check("three-concurrent-distinct-scans", async () => {
    assert.ok(!state.operations["audit-three-scans"]); state.operations["audit-three-scans"] = { status: "UNCERTAIN" }; persist(state);
    await Promise.all(pages.map((p, i) => scan(p, state.auditSeries[i])));
    await Promise.all(pages.map(p => p.getByTestId("shared-escaneados").filter({ hasText: /^3$/ }).waitFor()));
    const d = await api(p, `/api/inventario/auditorias/${state.audit.id}`); assert.equal(d.status, 200); assert.equal(d.body.totalEscaneados, 3);
    state.operations["audit-three-scans"] = { status: "ACK" }; persist(state);
    return { total: d.body.totalEscaneados, rows: d.body.resultados.filter(x => x.usuarioId) };
  }, pages);
  await r.check("repeated-heartbeats-three-usable-sessions", async () => {
    await p.waitForTimeout(45000);
    const sessions = await Promise.all(pages.map(p => api(p, "/api/auth/me")));
    assert.ok(sessions.every(x => x.status === 200));
    for (const page of pages) assert.ok(await page.getByTestId("input-audit-scan").isEnabled());
    const d = await api(p, `/api/inventario/auditorias/${state.audit.id}`);
    assert.equal(d.status, 200); assert.equal(d.body.totalEscaneados, 3);
    assert.equal(d.body.participantes.filter(x => x.activo).length, 3);
    return { statuses: sessions.map(x => x.status), participants: d.body.participantes, total: d.body.totalEscaneados, browserNow: await p.evaluate(() => new Date().toISOString()) };
  }, pages);
  await r.check("simultaneous-duplicate-preserves-original-author-and-toast", async () => {
    assert.ok(!state.operations["audit-duplicate"]); state.operations["audit-duplicate"] = { status: "UNCERTAIN" }; persist(state);
    await Promise.all(pages.slice(0, 2).map(p => scan(p, state.auditSeries[3])));
    await Promise.all(pages.map(p => p.getByTestId("shared-escaneados").filter({ hasText: /^4$/ }).waitFor()));
    const d = await api(p, `/api/inventario/auditorias/${state.audit.id}`); assert.equal(d.status, 200);
    const rows = d.body.resultados.filter(x => x.serie === state.auditSeries[3]); assert.equal(rows.length, 1); assert.ok(rows[0].usuarioId);
    await Promise.all(pages.map(p => p.getByTestId("input-audit-scan").waitFor()));
    for (const [i, p] of pages.slice(0, 2).entries()) await r.snap(p, "concurrent-duplicate-toast-" + i);
    // Deliberate duplicate verification, not retry of an uncertain original scan.
    await scan(pages[2], state.auditSeries[3]);
    await pages[2].getByText(/Serie ya registrada/i).first().waitFor();
    await r.snap(pages[2], "native-already-registered-toast");
    const after = await api(p, `/api/inventario/auditorias/${state.audit.id}`);
    const final = after.body.resultados.filter(x => x.serie === state.auditSeries[3]);
    assert.deepEqual(final, rows);
    state.operations["audit-duplicate"] = { status: "ACK", original: rows[0] }; persist(state);
    const sessions = await Promise.all(pages.map(p => api(p, "/api/auth/me")));
    assert.ok(sessions.every(x => x.status === 200));
    return { original: rows[0], sameAuthorFloorAndTimestamp: true, stableSessions: sessions.map(x => x.status), total: after.body.totalEscaneados };
  }, pages);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }