import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
import * as t from "../../artifacts/mariana-textil/src/components/e7-node-test-transport";

process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
t.resetE7();
const sites = [{ id: 1, nombre: "Centro", iniciales: "CE" }, { id: 2, nombre: "Norte", iniciales: "NO" }];
const audits = sites.map(site => ({
  id: site.id + 40, folio: site.id + 40, folioFormateado: `${site.iniciales}-AI-${site.id + 40}`,
  ubicacionId: site.id, nombreUbicacion: site.nombre, estado: "ABIERTA",
  totalSnapshot: 10, totalEscaneados: 0, cuadros: 0, faltantes: 0, sobrantes: 0, malAcomodados: 0,
  abiertaAt: "2026-09-25T10:00:00Z", creadaPor: "Administrador de ejemplo", resultados: [], participantes: [],
}));
t.respond("/api/inventario/auditorias/sitios", sites);
t.respond("/api/inventario/auditorias", audits);
for (const audit of audits) {
  t.respond(`/api/inventario/auditorias/${audit.id}`, audit);
  t.respond(`/api/locations/${audit.ubicacionId}/pisos`, []);
}
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const writes: string[] = [];
  await page.route("**/api/**", async route => {
    if (route.request().method() !== "GET") { writes.push(route.request().url()); await route.abort(); return; }
    try { await route.fulfill({ json: await t.customFetch(route.request().url(), { method: "GET" }) }); }
    catch { await route.fulfill({ status: 404, json: { error: "Not provided in synthetic visual fixture" } }); }
  });
  await page.goto("http://127.0.0.1:20329/inventario/auditorias?auditoriaId=41");
  await page.getByTestId("input-audit-scan").waitFor();
  await page.getByTestId("select-audit-site").click();
  await page.getByRole("option", { name: "NO · Norte", exact: true }).click();
  await page.getByTestId("button-audit-42").waitFor();
  assert.equal(await page.getByTestId("input-audit-scan").count(), 0);
  assert.equal(await page.getByTestId("text-audit-folio").count(), 0);
  assert.equal(await page.getByTestId("button-audit-41").count(), 0);
  assert.equal(await page.getByTestId("button-open-audit").isEnabled(), true);
  assert.deepEqual(writes, []);
  await page.screenshot({ path: "reports/auditoria-selector-20260925/resultado.png", fullPage: true });
  // The previously open audit is still available when explicitly selected again.
  await page.getByTestId("select-audit-site").click();
  await page.getByRole("option", { name: "CE · Centro", exact: true }).click();
  await page.getByTestId("button-audit-41").click();
  await page.getByTestId("input-audit-scan").waitFor();
  assert.deepEqual(writes, []);
  console.log("PASS: actual Radix selector, filtered history, no selected detail after manual change, original audit reopened; all API responses synthetic, no writes.");
} finally { await browser.close(); }