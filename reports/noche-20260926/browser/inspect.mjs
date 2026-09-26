import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { load, browserKit, session, api, recorder } from "./runtime.mjs";

const { m, credentials } = load(), mode = process.argv[2];
const task = mode === "broad" ? 6 : mode.startsWith("return-") ? 3 : 5;
const r = recorder(task, mode), browser = await browserKit(m);
const errors = [];
const observe = p => {
  p.on("pageerror", e => errors.push({ kind: "pageerror", message: e.message }));
  p.on("response", response => { if (response.status() >= 500) errors.push({ kind: "http", path: new URL(response.url()).pathname, status: response.status() }); });
};
const locator = (p, spec) => spec.testId ? p.getByTestId(spec.testId) : spec.role ? p.getByRole(spec.role, { name: spec.name, exact: true }) : p.locator(spec.selector);
try {
  if (mode === "accountant-boundaries") {
    const state = JSON.parse(fs.readFileSync(path.join(m.privateDir, "browser-continuation-state.json"), "utf8"));
    for (const role of ["A", "F"]) {
      let p;
      await r.check(`${role}-native-login`, async () => {
        assert.ok(state.roles?.[role]); p = await session(browser, m, { ...state.roles[role], synthetic: true }); observe(p);
        const identity = await api(p, "/api/e11/identidad"); assert.equal(identity.body.perfil, role);
        return { profile: role, actorId: identity.body.usuarioId };
      });
      for (const route of ["/fondo", "/proveedores", "/reportes", "/productos"]) await r.check(`${role}-ui-denied-${route.slice(1)}`, async () => {
        assert.ok(p, "Profile login prerequisite failed"); await p.goto(m.origin + route);
        await p.getByText(/no puede acceder|no autorizada|sin acceso|acceso denegado|no tienes permiso/i).first().waitFor();
        return { route, denied: true };
      }, p ? [p] : []);
      await r.check(`${role}-restricted-object-fixtures`, async () => {
        assert.ok(m.targets?.sensitiveSupplierId && m.targets?.sensitiveTicketId, "Real existing synthetic supplier/ticket IDs required for meaningful object authorization checks");
        return { fixtureIdsSupplied: true };
      });
      const endpoints = ["/api/fondo", `/api/proveedores/${m.targets?.sensitiveSupplierId || 0}/pagos`, `/api/tickets/${m.targets?.sensitiveTicketId || 0}`, `/api/clientes/${m.clients.credit.id}`];
      for (const endpoint of endpoints) await r.check(`${role}-api-${endpoint.replaceAll("/", "-")}`, async () => {
        assert.ok(p, "Profile login prerequisite failed");
        const d = await api(p, endpoint); assert.equal(d.status, 403, "Forbidden API must return 403, not a hidden UI alone");
        return { endpoint, status: d.status };
      });
      const permitted = role === "F" ? ["/contabilidad/fiscal", "/contabilidad/conciliaciones"] : ["/contabilidad/finanzas", "/contabilidad/preparaciones"];
      for (const route of permitted) await r.check(`${role}-permitted-${route.split("/").pop()}`, async () => {
        assert.ok(p); await p.goto(m.origin + route);
        await p.locator("h1").first().waitFor();
        await p.waitForLoadState("networkidle", { timeout: 12000 });
        const text = await p.locator("body").innerText();
        assert.ok(!/Internal Server Error|TypeError|Unhandled|no puede acceder|no autorizada/i.test(text));
        return { route, headings: await p.getByRole("heading").allTextContents() };
      }, p ? [p] : []);
      // The deny API assertions above do not prove absence of sensitive fields in allowed projections.
      for (const endpoint of m.accountantProjections?.[role] || []) await r.check(`${role}-sanitized-${endpoint.replaceAll("/", "-")}`, async () => {
        const d = await api(p, endpoint); assert.equal(d.status, 200);
        const prohibited = /"(?:password|passwordHash|margen|costoUnitario|pagosProveedor|saldoFondo|token|secret)"\s*:/i;
        assert.ok(!prohibited.test(JSON.stringify(d.body)), "Sensitive key in permitted projection");
        return { endpoint, sanitized: true };
      });
      if (!(m.accountantProjections?.[role]?.length)) await r.check(`${role}-sensitive-projection-coverage`, async () => { throw Error("Supply authentic nonempty accountantProjections; denied legacy routes alone do not prove sanitization"); });
    }
  } else if (mode.startsWith("return-")) {
    const p = await session(browser, m, credentials.admin); observe(p);
    const target = m.targets?.[mode];
    await r.check(mode, async () => {
      assert.ok(target?.path, "Actual debt/settled synthetic note roll path required");
      await p.goto(m.origin + target.path);
      await p.locator("h1").first().waitFor();
      await p.waitForLoadState("networkidle", { timeout: 12000 });
      await r.snap(p, "frozen-return-availability");
      const buttons = await p.getByRole("button", { name: /devolver|devolución/i }).allTextContents();
      throw Error(buttons.length
        ? "Return control is visible: MAIN must classify business authorization before executing. No refund gate or business decision changed."
        : "Frozen active UI offers no roll-return action here; business refund remains BLOCKED, not PASS. No gate changed.");
    }, [p]);
  } else if (mode === "broad") {
    const p = await session(browser, m, credentials.admin); observe(p);
    for (const route of m.broad.paths) await r.check("screen-" + route.replaceAll("/", "-"), async () => {
      const before = errors.length, response = await p.goto(m.origin + route);
      await p.locator("h1").first().waitFor();
      await p.waitForLoadState("networkidle", { timeout: 12000 });
      await p.locator("main .animate-spin").first().waitFor({ state: "hidden", timeout: 12000 });
      const text = await p.locator("body").innerText();
      assert.ok(response.status() < 400);
      assert.ok(!/Internal Server Error|TypeError|Unhandled|Cannot read properties|404 Page Not Found/i.test(text), "Technical error rendered");
      assert.equal(errors.length, before, "Browser or HTTP server error");
      return { route, headings: await p.getByRole("heading").allTextContents(), buttons: await p.getByRole("button").allTextContents(), links: await p.getByRole("link").evaluateAll(a => a.map(x => ({ text: x.textContent, href: x.getAttribute("href") }))) };
    }, [p]);
    // Explicit contracts prevent blindly clicking destructive buttons or inventing destination IDs.
    for (const chain of m.broad.detailChains || []) await r.check("drilldown-" + chain.id, async () => {
      await p.goto(m.origin + chain.path);
      for (const [i, step] of chain.steps.entries()) {
        await locator(p, step).click();
        if (step.urlPattern) await p.waitForURL(new RegExp(step.urlPattern));
        if (step.expectedText) await p.getByText(step.expectedText, { exact: true }).waitFor();
        await r.snap(p, `${chain.id}-step-${i}`);
      }
      assert.ok(chain.steps.length >= 2, "Require figure → detail → document folio");
      return { id: chain.id, destination: new URL(p.url()).pathname };
    }, [p]);
    for (const item of m.broad.unitChecks || []) await r.check("units-" + item.id, async () => {
      await p.goto(m.origin + item.path);
      for (const expected of item.expectedSeparateLabels) await p.getByText(expected, { exact: true }).waitFor();
      for (const forbidden of item.forbiddenMixedLabels) assert.equal(await p.getByText(forbidden, { exact: true }).count(), 0);
      assert.ok(item.expectedSeparateLabels.length >= 4, "Need separate metros, kilos, piezas, bolsas evidence");
      return { labels: item.expectedSeparateLabels };
    }, [p]);
    for (const item of m.broad.colorChecks || []) await r.check("color-" + item.id, async () => {
      await p.goto(m.origin + item.path);
      for (const expected of item.semanticLabels) await p.getByText(expected, { exact: true }).waitFor();
      assert.ok(item.semanticLabels.length, "Semantic text cannot be inferred from color");
      return { labels: item.semanticLabels, limit: "Presence of labels checked; visual reviewer must confirm no decorative or contradictory coding." };
    }, [p]);
    for (const section of ["detailChains", "unitChecks", "colorChecks"]) if (!m.broad[section]?.length) await r.check("coverage-" + section, async () => { throw Error("No authentic fixture contracts supplied for " + section + "; not claimed complete"); });
  } else throw Error("Unknown inspection mode");
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally {
  r.result.technicalErrors = errors;
  r.finish(); await browser.close();
}