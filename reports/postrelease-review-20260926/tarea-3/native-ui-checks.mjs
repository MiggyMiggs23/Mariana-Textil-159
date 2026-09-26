import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root = "reports/postrelease-review-20260926/tarea-3";
const request = JSON.parse(fs.readFileSync(root + "/browser-request.json", "utf8"));
assert.equal(request.origin, "http://127.0.0.1:18338");
const credentials = JSON.parse(fs.readFileSync(request.privateCredentials, "utf8"));
const fixtures = JSON.parse(fs.readFileSync(request.fixtures, "utf8"));
const inventory = JSON.parse(fs.readFileSync(root + "/inventory.json", "utf8")).rows;
const cases = JSON.parse(fs.readFileSync(request.cases, "utf8"));
const folder = path.join(root, "native-ui-" + Date.now()); fs.mkdirSync(folder, { recursive: true });
const apiSha = "3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea", uiSha = "af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5";
const result = { status: "RUNNING", origin: request.origin, apiSha, uiSha, mutationPolicy: "All non-GET/HEAD blocked except native login. No joins/scans/cobros/edits/reversals/generation/recalculation.", startedAt: new Date().toISOString(), actors: {}, cells: [], requests: [], preventedMutations: [], artifacts: [] };
const passwords = Object.values(credentials).map(a => a.password);
const scrub = s => { for (const secret of passwords) s = s.replaceAll(secret, "[REDACTED]"); return s; };
const save = () => fs.writeFileSync(folder + "/result.json", scrub(JSON.stringify(result, null, 2)));
const register = file => result.artifacts.push({ file, bytes: fs.statSync(file).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") });
const shot = async (p, name) => {
  const file = folder + "/" + name + ".png"; await p.screenshot({ path: file, fullPage: true }); register(file);
  const text = folder + "/" + name + ".txt"; fs.writeFileSync(text, scrub(await p.locator("body").innerText())); register(text);
};
const read = (p, endpoint) => p.evaluate(async endpoint => { const r = await fetch(endpoint, { credentials: "include" }); return { status: r.status, body: await r.json() }; }, endpoint);
const observed = async locator => {
  const count = await locator.count(), controls = [];
  for (let i = 0; i < Math.min(count, 20); i++) controls.push({ visible: await locator.nth(i).isVisible(), enabled: await locator.nth(i).isEnabled(), text: await locator.nth(i).innerText().catch(() => ""), label: await locator.nth(i).getAttribute("aria-label"), testId: await locator.nth(i).getAttribute("data-testid") });
  return { count, visible: controls.some(c => c.visible), enabled: controls.some(c => c.visible && c.enabled), controls };
};
const settle = p => p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
const selectSite = async p => {
  const combo = p.getByRole("combobox").first();
  if (await combo.count() && await combo.isEnabled()) {
    await combo.click(); const option = p.getByRole("option", { name: "Mariana", exact: true });
    if (await option.count()) await option.click(); else await p.keyboard.press("Escape");
  }
  await settle(p);
  return await p.getByRole("combobox").first().innerText().catch(() => "No selector");
};
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const pending = [];
try {
  for (const role of (process.env.UI_ROLES?.split(",") ?? ["ADMIN", "TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS"])) {
    const context = await browser.newContext({ timezoneId: "America/Mexico_City", viewport: { width: 1360, height: 1000 } });
    await context.route("**/*", route => {
      const r = route.request(), url = new URL(r.url());
      if (url.origin !== request.origin) return route.abort();
      if (!["GET", "HEAD"].includes(r.method()) && !(r.method() === "POST" && url.pathname === "/api/auth/login")) {
        result.preventedMutations.push({ role, method: r.method(), path: url.pathname, at: new Date().toISOString() }); save(); return route.abort();
      }
      return route.continue();
    });
    const p = await context.newPage(); p.setDefaultTimeout(5000);
    p.on("response", response => {
      const url = new URL(response.url()); if (!url.pathname.startsWith("/api/")) return;
      pending.push((async () => { const row = { role, method: response.request().method(), path: url.pathname, query: url.search, status: response.status() }; if (response.status() >= 400) row.error = await response.json().catch(() => null); result.requests.push(row); })());
    });
    try {
      const response = await p.goto(request.origin + "/login"), headers = await response.allHeaders();
      assert.equal(headers["x-priority-api-sha256"], apiSha); assert.equal(headers["x-priority-ui-sha256"], uiSha); assert.equal(headers["x-priority-clock"], "system");
      await p.getByLabel("Usuario", { exact: true }).fill(credentials[role].usuario);
      await p.getByLabel("Contraseña", { exact: true }).fill(credentials[role].password);
      const login = p.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/login"); login.catch(() => {});
      await p.getByRole("button", { name: "Ingresar", exact: true }).click(); assert.equal((await login).status(), 200);
      await p.waitForURL(url => url.pathname !== "/login");
      const me = await read(p, "/api/auth/me"); assert.equal(me.status, 200); assert.equal(me.body.rol, role);
      result.actors[role] = me.body;
      for (const test of request.requests.filter(r => r.roles.includes(role) && (!process.env.UI_MODULES || process.env.UI_MODULES.split(",").includes(r.module)))) {
        const id = `${role}:${test.module}:${test.action}`, mapping = inventory.find(r => r.id === id);
        const permission = me.body.permisos.find(p => p.modulo === test.module);
        const expected = role === "ADMIN" || !!permission?.[{ crear: "puedeCrear", editar: "puedeEditar", autorizar: "puedeAutorizar", ver: "puedeVer" }[test.action]];
        const row = { id, role, actorId: me.body.id, assignedSite: me.body.ubicacion?.id ?? null, scope: me.body.alcanceConsulta, permission, effectiveAllowed: expected, pendingCombined: mapping?.pendingCombined ?? null, operationBinding: mapping?.operationBinding ?? null, selectedApi: cases.find(c => c.module === test.module && c.action === test.action), fixtureId: fixtures[test.fixture]?.data?.id ?? fixtures[test.fixture]?.data?.movimientoId, fixtureSite: fixtures[test.fixture]?.data?.ubicacionId ?? fixtures[test.fixture]?.data?.origenId };
        result.cells.push(row);
        try {
          await p.goto(request.origin + test.page); await settle(p); row.selectedSite = await selectSite(p);
          // Scope/auth hydration can schedule module queries after networkidle.
          // Observe a settled native page, not an intermediate loading frame.
          await p.waitForTimeout(2500); await settle(p);
          if (test.module === "salidas") {
            const tab = p.getByRole("tab", { name: "Extraordinarias", exact: true }); row.extraordinaryTab = await observed(tab);
            if (await tab.count() && await tab.isVisible()) { await tab.click(); await p.waitForTimeout(1800); await settle(p); }
            row.fixtureVisible = await p.getByText(fixtures.extra.data.serie, { exact: true }).count() > 0;
            row.control = await observed(p.getByRole("button", { name: /Revertir/ }));
          } else if (test.module === "auditoria_inventario") {
            const select = p.getByTestId("select-audit-site");
            if (await select.count() && await select.isEnabled()) {
              await select.click(); const option = p.getByRole("option").filter({ hasText: /· Mariana$/ }); if (await option.count()) await option.click(); else await p.keyboard.press("Escape");
            }
            const history = p.getByTestId(`button-audit-${fixtures.audit.data.id}`);
            if (await history.count()) { await history.click(); await p.waitForTimeout(1800); }
            await p.waitForTimeout(1800); await settle(p); row.control = await observed(p.getByTestId("input-audit-scan"));
            row.fixtureVisible = await history.count() > 0;
            row.joinControl = await observed(p.getByRole("button", { name: "Unirme a la auditoría", exact: true }));
            row.eligibilityNote = "No se ejecutó participar: es POST y las mutaciones positivas están retenidas. Un scanner deshabilitado por falta de participación no prueba negativa del permiso editar.";
          } else if (test.module === "salidas_venta") {
            const entry = p.getByTestId("card-salidas-pendientes-cobro"); row.entryControl = await observed(entry);
            if (await entry.count() && await entry.isVisible()) { await entry.click(); await p.waitForTimeout(1800); await settle(p); }
            const outputs = p.locator('[data-testid^="salida-pendiente-"]');
            for (let i = 0; i < await outputs.count(); i++) {
              const output = outputs.nth(i), selected = await output.getAttribute("data-testid") === `salida-pendiente-${fixtures.sale.data.id}`;
              await output.getByRole("checkbox").setChecked(selected);
              if (selected) {
                const price = row.selectedApi?.body?.precios?.[0]?.precioUnitario;
                if (price) await output.getByRole("spinbutton").fill(String(price));
              }
            }
            row.selectedOutputIds = [fixtures.sale.data.id];
            const store = p.getByRole("combobox", { name: "Tienda emisora", exact: true });
            if (await store.count() && await store.isEnabled()) {
              await store.click(); const option = p.getByRole("option", { name: "Mariana", exact: true });
              if (await option.count()) await option.click();
              await p.keyboard.press("Escape"); await p.waitForTimeout(300);
            }
            row.fixtureVisible = await p.getByTestId(`salida-pendiente-${fixtures.sale.data.id}`).count() > 0;
            row.control = await observed(p.getByRole("button", { name: "Recibir y generar venta", exact: true }));
          } else if (test.module === "cobros_pagos") {
            const caption = p.getByText(`Ticket folio ${fixtures.ticket.data.folio}`, { exact: true });
            row.fixtureVisible = await caption.count() > 0;
            row.control = await observed(row.fixtureVisible ? caption.locator("xpath=ancestor::div[.//button[normalize-space()='Cobrar']][1]").getByRole("button", { name: "Cobrar", exact: true }) : p.getByRole("button", { name: "Cobrar", exact: true }));
          } else if (test.module === "equipos") {
            row.fixtureVisible = (await p.locator("body").innerText()).includes(fixtures.equipment.data.identificador);
            row.control = await observed(p.getByTestId(`button-edit-equipo-${fixtures.equipment.data.id}`));
          }
          row.actualPath = new URL(p.url()).pathname;
          row.businessBoundaryText = (await p.locator("body").innerText()).split("\n").filter(t => /sin permiso|acceso|no tienes|no hay|selecciona|particip|unirme|requiere/i.test(t)).slice(-12);
          row.status = row.control.enabled ? "VISIBLE_ENABLED" : row.control.visible ? "VISIBLE_DISABLED" : "HIDDEN_OR_OUTER_BOUNDARY";
          await shot(p, id.replaceAll(":", "-"));
        } catch (e) { row.status = "HARNESS_OR_PAGE_BLOCKED"; row.error = e.message; await shot(p, id.replaceAll(":", "-") + "-blocked").catch(() => {}); }
        save();
      }
      if (role === "SISTEMAS") {
        await p.goto(request.origin + "/administracion/conciliacion"); await settle(p); const selectedSite = await selectSite(p);
        const recalcular = await observed(p.getByRole("button", { name: "Recalcular", exact: true }));
        result.cells.push({ id: "SISTEMAS:conciliacion:editar", actorId: me.body.id, selectedSite, permission: me.body.permisos.find(p => p.modulo === "conciliacion"), actualPath: new URL(p.url()).pathname, control: recalcular, status: recalcular.enabled ? "VISIBLE_ENABLED" : recalcular.visible ? "VISIBLE_DISABLED" : "HIDDEN_OR_OUTER_BOUNDARY", mutationNotInvoked: true });
        await shot(p, "SISTEMAS-conciliacion-Recalcular");
      }
    } catch (e) { result.actors[role] = { loginOrScopeError: e.message }; await shot(p, role + "-blocked").catch(() => {}); }
    finally { await context.close(); }
  }
} finally {
  await browser.close(); await Promise.allSettled(pending); result.status = "UI_OBSERVATIONS_COMPLETE_NOT_PERMISSION_CLOSURES"; result.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ evidence: folder, cells: result.cells.length, blockedMutations: result.preventedMutations.length, loginErrors: Object.entries(result.actors).filter(([_, a]) => a.loginOrScopeError).map(([role, a]) => ({ role, error: a.loginOrScopeError })) }));
}