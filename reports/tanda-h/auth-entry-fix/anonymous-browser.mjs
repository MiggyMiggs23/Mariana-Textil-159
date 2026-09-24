import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";

const root = process.cwd();
const out = path.join(root, "reports/tanda-h/auth-entry-fix");
const libs = fs.mkdtempSync("/tmp/auth-entry-browser-libs-");
const packaged = "/nix/store/ifx1nl219iyd84hjr11rbkmjazsjr0q0-electronplayer-2.0.8-usr-target/lib";
for (const name of fs.readdirSync(packaged)) {
  if (!name.includes(".so") || /^(libc\.|libm\.|libpthread\.|librt\.|libdl\.|ld-|libresolv\.|libutil\.)/.test(name)) continue;
  fs.symlinkSync(path.join(packaged, name), path.join(libs, name));
}
const origin = "http://127.0.0.1";
const results = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true, executablePath: path.join(root, ".cache/ms-playwright/chromium-1187/chrome-linux/chrome"),
    env: { ...process.env, LD_LIBRARY_PATH: libs }, args: ["--no-sandbox"], timeout: 15000,
  });
  for (const entry of ["/", "/clientes/21", "/login"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const start = Date.now();
    const result = { entry, navigation: [], authResponses: [], blocked: [], pageErrors: [] };
    await page.route("**/*", route => {
      const request = route.request();
      if (request.method() !== "GET" || new URL(request.url()).origin !== origin) {
        result.blocked.push({ method: request.method(), url: request.url() });
        return route.abort();
      }
      return route.continue();
    });
    page.on("framenavigated", frame => {
      if (frame === page.mainFrame()) result.navigation.push({ ms: Date.now() - start, url: frame.url() });
    });
    page.on("response", response => {
      if (new URL(response.url()).pathname === "/api/auth/me") result.authResponses.push({ ms: Date.now() - start, status: response.status() });
    });
    page.on("pageerror", error => result.pageErrors.push(error.message));
    try {
      await page.goto(origin + entry, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.getByLabel("Usuario", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
      await page.waitForTimeout(3500);
      result.finalUrl = page.url();
      result.elapsedMs = Date.now() - start;
      assert.equal(new URL(page.url()).pathname, "/login");
      assert.equal(await page.getByLabel("Usuario", { exact: true }).isVisible(), true);
      if (entry !== "/login") assert.equal(new URL(page.url()).searchParams.get("returnTo"), entry);
      assert.deepEqual(result.pageErrors, []);
      assert.equal(result.blocked.some(request => request.method !== "GET"), false);
      result.passed = true;
    } catch (error) {
      result.passed = false;
      result.failure = String(error);
      result.finalUrl = page.url();
    }
    await page.screenshot({ path: path.join(out, `anonymous-${entry === "/" ? "root" : entry === "/login" ? "login" : "deep"}.png`) });
    results.push(result);
    await context.close();
  }
} finally {
  await browser?.close();
  fs.rmSync(libs, { recursive: true, force: true });
  fs.writeFileSync(path.join(out, "anonymous-browser.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
if (results.length !== 3 || results.some(result => !result.passed)) process.exitCode = 1;