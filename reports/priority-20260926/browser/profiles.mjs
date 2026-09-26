import assert from "node:assert/strict";
import crypto from "node:crypto";
import { launch, recorder, session, credentials, origin, readState, persist, nativeWrite, api } from "./runtime.mjs";
const b = await launch(), r = recorder("profiles-baseline"), state = readState();
try {
  const admin = await session(b, credentials.admin, "ADMIN", r);
  for (const role of ["F", "A"]) {
    const ok = await r.check("native-create-" + role, async () => {
      assert.ok(!state.roles[role], "Do not replay actor creation");
      const actor = { username: `priority${role.toLowerCase()}${crypto.randomBytes(4).toString("hex")}`, password: crypto.randomBytes(20).toString("hex") };
      state.roles[role] = actor; persist(state);
      await admin.goto(origin + "/usuarios");
      await admin.getByRole("button", { name: "Nuevo Usuario", exact: true }).click();
      await admin.locator("#user-name").fill("PRIORITY CONTADOR " + role);
      await admin.locator("#user-username").fill(actor.username);
      await admin.getByRole("dialog").getByRole("combobox").first().click();
      await admin.getByRole("option", { name: "Contador", exact: true }).click();
      await admin.locator("#user-password").fill(actor.password);
      const user = await nativeWrite(state, admin, "create-" + role, "POST", "/api/users", admin.getByRole("button", { name: "Crear usuario", exact: true }));
      actor.id = user.id; persist(state);
      await admin.getByRole("dialog").waitFor({ state: "hidden" });
      return { id: user.id };
    }, [admin]);
    assert.ok(ok);
  }
  await r.check("native-assign-A", async () => {
    await admin.getByRole("row").filter({ hasText: state.roles.A.username }).getByRole("button", { name: "Perfil contable A/F", exact: true }).click();
    await admin.getByRole("dialog").locator("select").selectOption("A");
    await admin.getByRole("dialog").locator("textarea").fill("PRIORITY diagnóstico perfil A sobre copia aislada");
    await admin.getByRole("button", { name: "Revisar cambio de perfil", exact: true }).click();
    await nativeWrite(state, admin, "assign-A", "PUT", `/api/e11/usuarios/${state.roles.A.id}/perfil`, admin.getByRole("button", { name: "Confirmar asignación ADMIN", exact: true }));
    const read = await api(admin, `/api/e11/usuarios/${state.roles.A.id}/perfil`);
    assert.equal(read.status, 200); assert.equal(read.body.perfil, "A");
    return read;
  }, [admin]);
  for (const role of ["A", "F"]) {
    let p;
    await r.check(role + "-native-login", async () => { p = await session(b, state.roles[role], role, r); return { id: state.roles[role].id }; });
    if (!p) continue;
    for (const mode of ["SPA", "QUIESCENT"]) {
      if (mode === "QUIESCENT") await p.goto(origin + "/favicon.png");
      for (let i = 0; i < 3; i++) await r.check(`${role}-${mode}-identity-${i}`, async () => {
        const read = await api(p, "/api/e11/identidad");
        r.data.checks.at(-1).response = read; r.save();
        assert.equal(read.status, 200); assert.equal(read.body.perfil, role); return read;
      });
      for (const endpoint of ["/api/auth/me", "/api/fondo", role === "A" ? "/api/e11/finanzas/clientes" : "/api/e11/fiscal/ventas"]) await r.check(`${role}-${mode}-${endpoint.replaceAll("/", "-")}`, async () => {
        const read = await api(p, endpoint);
        const evidence = { status: read.status, requestId: read.requestId, error: read.body?.error, code: read.body?.code };
        r.data.checks.at(-1).response = evidence; r.save();
        assert.equal(read.status, endpoint === "/api/fondo" ? 403 : 200); return evidence;
      });
    }
    await r.check(role + "-actual-profile-page", async () => {
      await p.goto(origin + (role === "A" ? "/contabilidad/finanzas" : "/contabilidad/fiscal"));
      await p.waitForTimeout(2000); return { body: (await p.locator("body").innerText()).slice(0, 4000) };
    }, [p]);
  }
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }