import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
import * as t from "../../artifacts/mariana-textil/src/components/e7-node-test-transport";

// Visual check only. All API requests intercepted, no real login or database.
process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
t.resetE7();
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
  await page.route("**/api/**", async route => {
    assert.equal(route.request().method(), "GET", "Visual capture must not submit writes");
    try {
      const body = await t.customFetch(route.request().url(), { method: "GET" });
      await route.fulfill({ json: body });
    } catch {
      await route.fulfill({ status: 404, json: { error: "Not provided in visual fixture" } });
    }
  });
  await page.goto("http://127.0.0.1:20329/caja/atribucion-e7?desde=2026-09-22&hasta=2026-09-24");
  await page.getByTestId("e7-physical").waitFor();
  const explanation = await page.getByTestId("e7-explanation").innerText();
  assert(explanation.startsWith("Esta pantalla te dice cuánto dinero de crédito entró de verdad en el periodo, y cuánto fue solo acomodo de papel."));
  assert(!/atribución|alcance|puente|comprobable|naturaleza/i.test(explanation));
  assert((await page.getByTestId("e7-physical").innerText()).includes("Recepciones físicas comprobadas"));
  assert((await page.getByTestId("e7-applications").innerText()).includes("Aplicaciones comprobables a notas"));
  const links = await page.locator("a").evaluateAll(nodes => nodes.map(n => ({ href: n.getAttribute("href"), text: n.textContent?.trim() })));
  const menu = links.filter(n => ["/caja/cortes", "/caja/atribucion-e7", "/alertas"].includes(n.href ?? ""));
  assert.deepEqual(menu.slice(0, 3).map(n => n.href), ["/caja/cortes", "/caja/atribucion-e7", "/alertas"]);
  await page.screenshot({ path: "reports/e7-texto-20260925/resultado.png", fullPage: true });
  fs.writeFileSync("reports/e7-texto-20260925/verificacion.json", JSON.stringify({
    status: "PASS", purpose: "visual only, served frontend, synthetic intercepted API responses",
    realApiRequests: 0, menu, explanation, unchangedCardLabels: true,
  }, null, 2));
} finally { await browser.close(); }