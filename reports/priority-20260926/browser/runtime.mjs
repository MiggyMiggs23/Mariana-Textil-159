import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const fiscalClone = process.env.PRIORITY_FISCAL === "MAIN_READY";
const reportRoot = fiscalClone ? "reports/priority-fiscal-20260926" : "reports/priority-20260926";
const tmpRoot = fiscalClone ? "/tmp/priority-fiscal-20260926" : "/tmp/priority-20260926";
export const dir = path.resolve(reportRoot, "browser");
export const priv = tmpRoot + "/browser";
fs.mkdirSync(priv, { recursive: true, mode: 0o700 });
const ready = JSON.parse(fs.readFileSync(reportRoot + "/private-ready.json"));
const candidate = JSON.parse(fs.readFileSync(reportRoot + (process.env.PRIORITY_V8 === "1" ? "/candidate-v8-observed.json" : process.env.PRIORITY_OBSERVED === "1" ? "/candidate-observed.json" : "/candidate.json")));
assert.equal(ready.status, "READY"); assert.equal(ready.database, fiscalClone ? "priority_fiscal_20260926" : "priority_20260926");
assert.equal(ready.apiSha256, candidate.apiSha256);
assert.equal(crypto.createHash("sha256").update(fs.readFileSync(candidate.apiEntry)).digest("hex"), candidate.apiSha256);
export const origin = ready.url;
export const credentials = JSON.parse(fs.readFileSync(tmpRoot + "/credentials.json"));
if (fiscalClone && !fs.existsSync(path.join(priv, "state.json"))) fs.writeFileSync(path.join(priv, "state.json"), fs.readFileSync(tmpRoot + "/browser-state-handoff.json"), { mode: 0o600 });
export const readState = () => fs.existsSync(path.join(priv, "state.json")) ? JSON.parse(fs.readFileSync(path.join(priv, "state.json"))) : { roles: {}, operations: {} };
export const persist = state => fs.writeFileSync(path.join(priv, "state.json"), JSON.stringify(state, null, 2), { mode: 0o600 });
export const launch = () => chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
export function recorder(name) {
  const folder = path.join(dir, name); fs.mkdirSync(folder, { recursive: true });
  const data = { status: "RUNNING", startedAt: new Date().toISOString(), apiSha256: candidate.apiSha256, checks: [], requests: [], screenshots: [] };
  const save = () => fs.writeFileSync(path.join(folder, "result.json"), JSON.stringify(data, null, 2));
  const pending = [];
  const observe = (p, actor) => {
    p.on("response", response => {
      if (!new URL(response.url()).pathname.startsWith("/api/")) return;
      pending.push((async () => {
        const headers = await response.allHeaders(), requestHeaders = await response.request().allHeaders();
        const row = { at: new Date().toISOString(), actor, method: response.request().method(), path: new URL(response.url()).pathname, status: response.status(), requestId: headers["x-request-id"] || null, suppliedRequestId: requestHeaders["x-request-id"] || null };
        if (response.status() >= 400) {
          const body = await response.json().catch(() => null);
          row.error = body?.error; row.message = body?.message; row.code = body?.code; row.bodyRequestId = body?.requestId;
        }
        data.requests.push(row); save();
      })().catch(e => { data.observerError = e.message; }));
    });
  };
  const snap = async (p, name, fullPage = true) => {
    const file = path.join(folder, name + ".png"); await p.screenshot({ path: file, fullPage });
    data.screenshots.push({ file: path.relative(dir, file), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }); save();
  };
  const check = async (name, fn, pages = []) => {
    const row = { name, status: "RUNNING" }; data.checks.push(row); save();
    try { row.evidence = await fn(); row.status = "PASS"; } catch (e) { row.status = "BLOCKED_OR_DEFECT"; row.error = e.message; }
    for (const [i, p] of pages.entries()) await snap(p, name + "-" + i).catch(e => { row.screenshotError = e.message; });
    save(); return row.status === "PASS";
  };
  const finish = async () => { await Promise.allSettled(pending); data.status = data.checks.every(x => x.status === "PASS") ? "PASS" : "PARTIAL_OR_BLOCKED"; save(); };
  return { data, save, observe, snap, check, finish };
}
let counter = 0;
export async function session(b, actor, label, r, mobile = false) {
  const c = await b.newContext({ timezoneId: "America/Mexico_City", viewport: { width: mobile ? 402 : 1360, height: 1000 }, ...(mobile ? { isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36" } : {}) });
  if (fiscalClone) await c.addInitScript({ path: path.resolve(reportRoot, "browser-clock.js") });
  await c.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) return route.abort();
    return route.continue({ headers: { ...route.request().headers(), "x-request-id": `priority-browser-${label}-${Date.now()}-${++counter}` } });
  });
  const p = await c.newPage(); p.setDefaultTimeout(15000); r.observe(p, label);
  await p.goto(origin + "/login");
  await p.getByLabel("Usuario", { exact: true }).fill(actor.username || actor.usuario);
  await p.getByLabel("Contraseña", { exact: true }).fill(actor.password);
  const response = p.waitForResponse(x => new URL(x.url()).pathname === "/api/auth/login");
  await p.getByRole("button", { name: "Ingresar", exact: true }).click();
  assert.equal((await response).status(), 200, "Native login must succeed");
  await p.waitForURL(u => u.pathname !== "/login"); return p;
}
export const api = (p, endpoint) => p.evaluate(async endpoint => {
  const response = await fetch(endpoint, { credentials: "include" });
  return { status: response.status, requestId: response.headers.get("x-request-id"), body: await response.json() };
}, endpoint);
export async function nativeWrite(state, p, key, method, endpoint, button) {
  assert.ok(!state.operations[key], "Operation already attempted; independent readback required");
  state.operations[key] = { status: "UNCERTAIN", at: new Date().toISOString() }; persist(state);
  const pending = p.waitForResponse(x => x.request().method() === method && new URL(x.url()).pathname === endpoint);
  await button.click(); const response = await pending, body = await response.json();
  state.operations[key] = { status: response.ok() ? "ACK" : body.code === "RESULTADO_INCIERTO" ? "UNCERTAIN" : "FAILED", http: response.status(), body, requestBody: response.request().postDataJSON() }; persist(state);
  assert.ok(response.ok(), `Native operation ${key} HTTP ${response.status()}`); return body;
}