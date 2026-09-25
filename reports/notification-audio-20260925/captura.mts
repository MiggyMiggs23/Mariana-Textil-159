import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
import * as t from "../../artifacts/mariana-textil/src/components/e7-node-test-transport";

process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
t.resetE7();
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route("**/api/**", async route => {
    assert.equal(route.request().method(), "GET");
    try { await route.fulfill({ json: await t.customFetch(route.request().url(), { method: "GET" }) }); }
    catch { await route.fulfill({ status: 404, json: { error: "Not provided in synthetic visual fixture" } }); }
  });
  await page.goto("http://127.0.0.1:20329/caja/atribucion-e7?desde=2026-09-22&hasta=2026-09-24");
  await page.getByTestId("e7-explanation").waitFor();
  assert.equal(await page.getByTestId("button-enable-notification-sound").count(), 0);
  await page.locator('[data-testid="button-notifications"]:visible').click();
  await page.getByRole("button", { name: "Activar sonido", exact: true }).click();
  await page.getByText("Sonido: activado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Desactivar sonido", exact: true }).click();
  await page.getByText("Sonido: desactivado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Activar sonido", exact: true }).click();
  await page.getByText("Sonido: activado", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("mariana:notification-audio:enabled:7")), "1");
  await page.screenshot({ path: "reports/notification-audio-20260925/menu-campanita.png", animations: "disabled" });
  console.log("PASS: real bell menu toggle on/off/on; preference saved; header control absent. Synthetic GET responses only.");
} finally { await browser.close(); }