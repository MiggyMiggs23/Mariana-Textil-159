// Actual login clicks only; this is NOT evidence for monetary end-to-end cases.
import fs from "node:fs";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root = process.cwd(), dir = root + "/reports/trabajo-nocturno-20260925/tarea-5";
const ready = JSON.parse(fs.readFileSync(dir + "/ready.json"));
if (ready.origin !== "http://127.0.0.1:43927" || ready.healthz !== 200) throw Error("Disposable readiness mismatch");
const credentials = JSON.parse(fs.readFileSync(root + "/private.local/night-t56/credentials.json")).admin;
const result = { status: "RUNNING", coverage: "canonical ADMIN native login only", requests: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || "/repl/tools/bin/chromium", args: ["--no-sandbox"], timeout: 15000 });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
page.setDefaultTimeout(15000);
await page.route("**/*", route => new URL(route.request().url()).origin === ready.origin ? route.continue() : route.abort());
page.on("response", response => {
  const url = new URL(response.url());
  if (url.pathname.startsWith("/api/")) result.requests.push({ path: url.pathname, status: response.status(), method: response.request().method() });
});
try {
  await page.goto(ready.origin + "/login");
  await page.screenshot({ path: dir + "/login-before.png" });
  await page.getByLabel("Usuario", { exact: true }).fill(credentials.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(credentials.password);
  const loginResponse = page.waitForResponse(response => response.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  const login = await loginResponse;
  if (login.status() !== 200) {
    result.loginError = await login.text();
    throw Error(`Native login returned HTTP ${login.status()}`);
  }
  await page.waitForURL(url => !url.pathname.includes("login"));
  await page.screenshot({ path: dir + "/login-after.png" });
  result.status = "PASS_LOGIN_ONLY";
} catch (error) {
  result.status = "STOP";
  result.error = error.message;
  await page.screenshot({ path: dir + "/login-blocked.png", timeout: 3000 }).catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(dir + "/browser-login.json", JSON.stringify(result, null, 2));
  await browser.close();
}