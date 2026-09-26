// First browser phase AFTER permissions worker releases the exclusive writer window.
// All business fixture writes use native UI; identities/IDs come from real responses.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";
const { m, credentials } = load();
const r = recorder(3, "native-fixtures");
const b = await browserKit(m);
const statePath = path.join(m.privateDir, "native-fixtures-journal.json");
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : {};
const persist = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
const saveManifest = () => fs.writeFileSync(process.env.NIGHT_BROWSER_MANIFEST, JSON.stringify(m, null, 2), { mode: 0o600 });
try {
  // Normalize only the known disposable synthetic identity, locally and privately.
  fs.writeFileSync(path.join(m.privateDir, "credentials.json"), JSON.stringify(credentials, null, 2), { mode: 0o600 });
  const p = await session(b, m, credentials.admin);
  await r.check("operational-site-readback", async () => {
    const d = await api(p, "/api/locations"); assert.equal(d.status, 200);
    const list = Array.isArray(d.body) ? d.body : d.body.items;
    const site = list.find(x => x.nombre === m.site.name); assert.ok(site, "Configured operating site missing");
    m.site = { id: site.id, name: site.nombre }; saveManifest();
    return { id: site.id, name: site.nombre };
  });
  for (const kind of ["cash", "credit"]) await r.check("synthetic-client-" + kind, async () => {
    if (state[kind]?.status === "ACK_READBACK") { m.clients[kind] = state[kind].client; saveManifest(); return { reusedAcknowledgedFixture: true, id: state[kind].client.id }; }
    assert.ok(!state[kind], "Attempted fixture creation must be read back before any retry");
    await p.goto(m.origin + "/clientes");
    await p.getByTestId("button-create-client").click();
    const name = `${m.fixturePrefix} ${kind.toUpperCase()} ${Date.now()}`;
    await p.getByTestId("input-create-client-name").fill(name);
    if (kind === "credit") {
      const dialog = p.getByRole("dialog");
      const number = dialog.locator('input[type="number"]').first();
      await number.fill("50000");
      await p.getByTestId("select-create-client-credit-days").click();
      await p.getByRole("option", { name: "7 días", exact: true }).click();
    }
    await r.snap(p, kind + "-before");
    state[kind] = { status: "UNCERTAIN", name }; persist();
    const pending = p.waitForResponse(x => x.request().method() === "POST" && new URL(x.url()).pathname === "/api/clientes");
    await p.getByTestId("button-save-client").click();
    const response = await pending, body = await response.json();
    assert.ok(response.ok(), "Native client creation HTTP " + response.status());
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    const check = await api(p, `/api/clientes/${body.id}`);
    assert.equal(check.status, 200); assert.equal(check.body.nombre, name);
    const client = { id: body.id, name };
    state[kind] = { status: "ACK_READBACK", client }; persist();
    m.clients[kind] = client; saveManifest();
    return client;
  }, [p]);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { r.finish(); await b.close(); }