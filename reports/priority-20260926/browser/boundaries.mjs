import assert from "node:assert/strict";
import { launch, recorder, session, credentials, origin, readState, api } from "./runtime.mjs";
const b = await launch(), r = recorder("corrected-profile-boundaries"), state = readState();
try {
  for (const role of ["A", "F"]) {
    const p = await session(b, state.roles[role], "BOUNDARY-" + role, r);
    await r.check(role + "-concurrent-identity-and-session-stability", async () => {
      const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => api(p, i % 2 ? "/api/auth/me" : "/api/e11/identidad")));
      for (const d of responses) assert.equal(d.status, 200);
      for (const d of responses.filter((_, i) => i % 2 === 0)) assert.equal(d.body.perfil, role);
      return { actorId: state.roles[role].id, statuses: responses.map(x => x.status) };
    });
    for (const endpoint of ["/api/fondo", `/api/proveedores/${state.supplier.id}/pagos`, `/api/tickets/${state.sales.invoice.id}`, `/api/clientes/${state.client.id}`]) await r.check(role + "-denied-" + endpoint.replaceAll("/", "-"), async () => {
      const d = await api(p, endpoint); assert.equal(d.status, 403); return { status: d.status, realFixtureEndpoint: endpoint };
    });
    for (const route of ["/fondo", "/proveedores", "/reportes", "/productos"]) await r.check(role + "-ui-denied-" + route.slice(1), async () => {
      await p.goto(origin + route);
      await p.getByText(/no puede acceder|no autorizada|sin acceso|acceso denegado|no tienes permiso/i).first().waitFor();
      return { route, denied: true };
    }, [p]);
    for (const route of role === "A" ? ["/contabilidad/finanzas", "/contabilidad/preparaciones"] : ["/contabilidad/fiscal", "/contabilidad/conciliaciones"]) await r.check(role + "-permitted-" + route.split("/").at(-1), async () => {
      await p.goto(origin + route); await p.getByRole("heading", { name: "Contabilidad · " + role, exact: true }).waitFor();
      await p.waitForTimeout(600);
      return { route, headings: await p.locator("h1,h2,h3").allInnerTexts() };
    }, [p]);
    await p.goto(origin + "/favicon.png");
    await r.check(role + "-permitted-projection-sensitive-fields-absent", async () => {
      const endpoint = role === "A" ? "/api/e11/finanzas/clientes?limit=20" : "/api/e11/fiscal/ventas?desde=2026-09-25&hastaExclusivo=2026-09-26&limit=20";
      const d = await api(p, endpoint); assert.equal(d.status, 200);
      const keys = [];
      const walk = x => { if (!x || typeof x !== "object") return; for (const [k, v] of Object.entries(x)) { keys.push(k); walk(v); } };
      walk(d.body);
      assert.ok(!keys.some(k => /password|token|margen|costo|fondo|pagoProveedor/i.test(k)));
      if (role === "F") assert.ok(d.body.items.some(x => x.ventaId === state.sales.invoice.id));
      return { status: d.status, itemCount: d.body.items?.length, sensitiveKeysAbsent: true, actualKeys: [...new Set(keys)].filter(x => !/^\d+$/.test(x)) };
    });
    await r.check(role + "-cross-profile-denial", async () => {
      const endpoint = role === "A" ? `/api/e11/fiscal/facturas/${state.sales.invoice.id}` : "/api/e11/finanzas/clientes";
      const d = await api(p, endpoint); assert.equal(d.status, 403); return { endpoint, status: d.status };
    });
  }
  const admin = await session(b, credentials.admin, "ADMIN-REGRESSION", r);
  for (const [route, endpoint] of [
    ["/precios", "/api/precios"],
    [`/clientes/${state.client.id}`, `/api/clientes/${state.client.id}/pagos`],
    [`/clientes/${state.client.id}`, `/api/clientes/${state.client.id}/comportamiento-pago`],
  ]) await r.check("prior-500-" + endpoint.replaceAll("/", "-"), async () => {
    await admin.goto(origin + route);
    const d = await api(admin, endpoint); assert.equal(d.status, 200); return { endpoint, status: d.status };
  }, [admin]);
  await r.check("independent-uncertain-fiscal-and-audit-readbacks", async () => {
    const f = await session(b, state.roles.F, "F-READBACK", r);
    const periods = await api(f, "/api/e11/conciliaciones?desde=2026-09-25&hastaExclusivo=2026-09-26&limit=20");
    const audit = await api(admin, `/api/inventario/auditorias/${state.audit.id}`);
    const body = audit.body;
    return { periods, audit: { status: audit.status, totalEscaneados: body.totalEscaneados, participantes: body.participantes, participacion: body.participacion, keys: Object.keys(body) }, browserNow: await admin.evaluate(() => new Date().toISOString()) };
  });
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }