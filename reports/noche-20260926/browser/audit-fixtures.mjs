import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load(), r = recorder(4, "native-fixtures"), b = await browserKit(m);
const privateFile = path.join(m.privateDir, "audit-fixtures.json");
const state = fs.existsSync(privateFile) ? JSON.parse(fs.readFileSync(privateFile)) : { operations: {}, users: [] };
const save = () => fs.writeFileSync(privateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
const manifest = () => fs.writeFileSync(process.env.NIGHT_BROWSER_MANIFEST, JSON.stringify(m, null, 2), { mode: 0o600 });
try {
  const p = await session(b, m, credentials.admin);
  const setupPost = async (key, url, body) => {
    if (state.operations[key]?.ok) return state.operations[key].body;
    assert.ok(!state.operations[key], "Uncertain fixture write " + key);
    state.operations[key] = { uncertain: true }; save();
    const d = await p.evaluate(async ({ url, body }) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" }); return { status: r.status, body: await r.json() }; }, { url, body });
    state.operations[key] = { ...d, ok: d.status >= 200 && d.status < 300 }; save();
    assert.ok(state.operations[key].ok, `${key} HTTP ${d.status}`);
    return d.body;
  };
  await r.check("synthetic-site-floor-fixtures-authenticated-api", async () => {
    state.site = await setupPost("site-valid-initials", "/api/locations", { nombre: "NOCHE26 AUDIT NATIVO", iniciales: "NNA", tipo: "BODEGA" });
    state.floors = [];
    for (const nombre of ["01 Acceso configurado", "02 Segundo", "03 Tercero"]) state.floors.push(await setupPost(nombre, `/api/locations/${state.site.id}/pisos`, { nombre }));
    save(); return { siteId: state.site.id, floors: state.floors.map(x => ({ id: x.id, name: x.nombre })), setup: "Authenticated fixture API only; actual audit journey remains native UI" };
  }, [p]);
  for (let i = 0; i < 6; i++) await r.check("native-synthetic-audit-user-" + i, async () => {
    if (state.users[i]?.id) return { id: state.users[i].id };
    assert.ok(!state.users[i], "Uncertain user write");
    await p.goto(m.origin + "/usuarios");
    await p.getByRole("button", { name: "Nuevo Usuario", exact: true }).click();
    const actor = { username: "noche26audit" + i + crypto.randomBytes(3).toString("hex"), password: crypto.randomBytes(20).toString("hex"), name: `NOCHE26 Auditor ${i}`, synthetic: true };
    state.users[i] = actor; save();
    await p.locator("#user-name").fill(actor.name); await p.locator("#user-username").fill(actor.username);
    await p.getByRole("dialog").getByRole("combobox").first().click();
    await p.getByRole("option", { name: "Administrador", exact: true }).click();
    await p.locator("#user-password").fill(actor.password);
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === "/api/users");
    await p.getByRole("button", { name: "Crear usuario", exact: true }).click();
    const response = await pending, body = await response.json(); assert.ok(response.ok());
    actor.id = body.id; state.users[i] = actor; save();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    return { id: body.id, synthetic: true };
  }, [p]);
  await r.check("native-five-rolls-on-first-floor", async () => {
    if (state.entry) return { entryId: state.entry.id };
    const f = JSON.parse(fs.readFileSync(path.join(m.privateDir, "fixture.json")));
    await p.goto(m.origin + "/entradas"); await p.getByTestId("btn-create-entrada").click();
    await p.getByTestId("input-entrada-producto").fill(f.fabric);
    await p.getByRole("option").filter({ hasText: f.fabric }).first().click();
    await p.getByTestId("input-declared").fill("5"); await p.getByTestId("input-costo-unitario").fill("50");
    await p.getByTestId("select-entrada-ubicacion").click(); await p.getByRole("option", { name: state.site.nombre, exact: true }).click();
    await p.getByTestId("select-entrada-proveedor").click(); await p.getByRole("option", { name: f.supplierName, exact: true }).click();
    await p.getByTestId("btn-add-line").click(); await p.getByTestId("input-uniform-qty").fill("10"); await p.getByTestId("button-apply-uniform").click();
    await p.getByTestId("trigger-bulk-floor").click(); await p.getByRole("option", { name: state.floors[0].nombre, exact: true }).click();
    await p.getByTestId("button-confirm-line").click(); await p.getByTestId("btn-save-entrada").click();
    assert.ok(!state.operations.entry, "Entry attempt uncertain");
    state.operations.entry = { uncertain: true }; save();
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === "/api/inventario/entradas");
    await p.getByTestId("btn-confirm-entrada-review").click();
    const response = await pending, entry = await response.json(); assert.ok(response.ok());
    assert.equal(entry.rollos.length, 5); state.entry = entry; save();
    return { entryId: entry.id, series: entry.rollos.map(x => x.serie) };
  }, [p]);
  await r.check("native-open-audit", async () => {
    await p.goto(m.origin + "/inventario/auditorias"); await p.getByTestId("select-audit-site").click();
    await p.getByRole("option").filter({ hasText: state.site.nombre }).click();
    assert.ok(!state.operations.audit, "Audit opening already attempted");
    state.operations.audit = { uncertain: true }; save();
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === "/api/inventario/auditorias");
    await p.getByTestId("button-open-audit").click();
    const response = await pending, body = await response.json(); assert.ok(response.ok()); state.audit = body; save();
    return { auditId: body.id };
  }, [p]);
  if (state.audit && state.entry) {
    m.audit = { auditId: state.audit.id, siteName: state.site.nombre, floors: state.floors.map(x => ({ id: x.id, name: x.nombre })), series: state.entry.rollos.map(x => x.serie), expectedFirstFloor: state.floors[0].nombre };
    credentials.auditUsers = state.users;
    fs.writeFileSync(path.join(m.privateDir, "credentials.json"), JSON.stringify(credentials, null, 2), { mode: 0o600 });
    m.credentialsFile = path.join(m.privateDir, "credentials.json"); manifest();
  }
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }