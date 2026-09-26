import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";

export const apiSha = "3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea";
export const uiSha = "a296de5707e38b9996293f48f968fca1e480810931b5769286bebe9b75f83f6f";
assert.ok(process.env.NIGHT_BROWSER_CONFIG, "MAIN must supply NEW disposable-copy configuration path; no default origin or old journal");
export const config = JSON.parse(fs.readFileSync(process.env.NIGHT_BROWSER_CONFIG, "utf8"));
assert.equal(config.disposable, true); assert.equal(config.status, "READY");
assert.ok(config.database && !/^(appDB|priority_20260926|priority_fiscal_20260926)$/i.test(config.database));
assert.ok(config.campaignId && config.credentialsFile && config.journalDirectory);
assert.equal(config.apiSha256, apiSha); assert.equal(config.uiSha256, uiSha);
export const origin = new URL(config.origin).origin;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
export const credentials = JSON.parse(fs.readFileSync(config.credentialsFile, "utf8"));
fs.mkdirSync(config.journalDirectory, { recursive: true, mode: 0o700 });
const statePath = path.join(config.journalDirectory, "task1-state.json");
export const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {
  campaignId: config.campaignId, database: config.database, origin, operations: {}, expected: { cashCents: 0 }, fixtures: {},
};
assert.equal(state.campaignId, config.campaignId); assert.equal(state.database, config.database); assert.equal(state.origin, origin);
export const persist = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
const secrets = [];
const collect = (x, key = "") => {
  if (x && typeof x === "object") Object.entries(x).forEach(([k, v]) => collect(v, k));
  else if (typeof x === "string" && /password|secret|token|cookie/i.test(key)) secrets.push(x);
};
collect(credentials);
const scrub = value => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /password|secret|cookie|authorization|token/i.test(k) ? "[REDACTED]" : scrub(v)]));
  if (typeof value !== "string") return value;
  for (const secret of secrets) if (secret) value = value.replaceAll(secret, "[REDACTED]");
  return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[REDACTED_DSN]");
};
export async function start(stage) {
  assert.match(stage, /^[a-z0-9-]+$/);
  const folder = path.resolve(config.reportDirectory || "reports/owner-night-20260926/task1", stage + "-" + Date.now());
  fs.mkdirSync(folder, { recursive: true });
  const result = { stage, database: config.database, campaignId: config.campaignId, apiSha, uiSha, status: "RUNNING", startedAt: new Date().toISOString(), requests: [], artifacts: [], checks: [] };
  const save = () => fs.writeFileSync(path.join(folder, "result.json"), JSON.stringify(scrub(result), null, 2));
  const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const pending = [];
  const context = await browser.newContext({ timezoneId: "America/Mexico_City", viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  let serial = 0;
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) return route.abort();
    return route.continue({ headers: { ...route.request().headers(), "x-request-id": `owner-night-${stage}-${Date.now()}-${++serial}` } });
  });
  const register = file => {
    result.artifacts.push({ file: path.relative(process.cwd(), file), bytes: fs.statSync(file).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }); save();
  };
  context.on("page", page => {
    page.on("download", download => pending.push((async () => {
      const target = path.join(folder, `download-${Date.now()}-${path.basename(download.suggestedFilename())}`);
      await download.saveAs(target); register(target);
    })()));
    page.on("response", response => {
      if (!new URL(response.url()).pathname.startsWith("/api/")) return;
      pending.push((async () => {
        const headers = await response.request().allHeaders();
        const row = { at: new Date().toISOString(), path: new URL(response.url()).pathname, method: response.request().method(), status: response.status(), suppliedRequestId: headers["x-request-id"] };
        if (response.status() >= 400) row.error = await response.json().catch(() => ({ unreadableResponse: true }));
        result.requests.push(row); save();
      })());
    });
  });
  const p = await context.newPage(); p.setDefaultTimeout(20000);
  const snap = async name => {
    for (const [suffix, fullPage] of [["viewport", false], ["full", true]]) {
      const file = path.join(folder, name + "-" + suffix + ".png");
      await p.screenshot({ path: file, fullPage }); register(file);
    }
    const text = path.join(folder, name + ".txt"); fs.writeFileSync(text, scrub(await p.locator("body").innerText())); register(text);
  };
  const read = async endpoint => p.evaluate(async endpoint => {
    const response = await fetch(endpoint, { credentials: "include" });
    return { status: response.status, body: await response.json() };
  }, endpoint);
  const write = async (key, method, endpoint, control) => {
    assert.ok(config.authorizationEvidence && path.resolve(config.authorizationEvidence).startsWith(path.resolve("reports") + path.sep) && fs.existsSync(config.authorizationEvidence), "replit.md requires original owner authorization text and exact scope in reports before financial/fixture writes; MAIN must supply evidence path");
    assert.ok(!state.operations[key], "Already attempted: independent readback/recovery required for " + key);
    const entry = state.operations[key] = { status: "UNCERTAIN", method, endpoint, attemptedAt: new Date().toISOString() }; persist();
    const capture = request => {
      if (request.method() === method && new URL(request.url()).pathname === endpoint) { entry.requestBody = request.postDataJSON(); persist(); }
    };
    p.on("request", capture);
    const waiting = p.waitForResponse(response => response.request().method() === method && new URL(response.url()).pathname === endpoint);
    waiting.catch(() => {});
    try {
      await control.click(); const response = await waiting;
      entry.http = response.status(); entry.response = await response.json();
      entry.status = response.ok() ? "ACK" : response.status() >= 500 || /INCIERTO|CONFIRMADO_NO_CONSULTABLE/.test(entry.response?.code || "") ? "UNCERTAIN" : "REJECTED";
      persist(); await snap(key);
      assert.ok(response.ok(), `${key} HTTP ${response.status()} ${entry.response?.code || ""}`);
      return entry.response;
    } finally { p.off("request", capture); }
  };
  try {
  const preflight = await p.goto(origin + "/login");
  assert.equal(preflight.status(), 200);
  const headers = await preflight.allHeaders();
  assert.equal(headers["x-priority-api-sha256"], apiSha); assert.equal(headers["x-priority-ui-sha256"], uiSha);
  assert.equal(headers["x-priority-clock"], "system");
  const actor = credentials.admin;
  await p.getByLabel("Usuario", { exact: true }).fill(actor.username || actor.usuario);
  await p.getByLabel("Contraseña", { exact: true }).fill(actor.password);
  const login = p.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/login");
  await p.getByRole("button", { name: "Ingresar", exact: true }).click(); assert.equal((await login).status(), 200);
  await p.waitForURL(url => url.pathname !== "/login");
  const me = await read("/api/auth/me"); assert.equal(me.status, 200); assert.equal(me.body.rol, "ADMIN");
  result.actorId = me.body.id; save();
  } catch (error) {
    result.error = error.message; result.status = "PREFLIGHT_BLOCKED"; save();
    await browser.close(); throw error;
  }
  const finish = async error => {
    if (error) { result.error = error.message; await snap("blocked").catch(() => {}); }
    await context.storageState({ path: path.join(config.journalDirectory, stage + "-browser-state.json") });
    fs.chmodSync(path.join(config.journalDirectory, stage + "-browser-state.json"), 0o600);
    await browser.close(); await Promise.allSettled(pending);
    result.status = error ? "BLOCKED_OR_DEFECT" : "PASS"; result.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: result.status, evidence: folder, error: result.error }));
  };
  return { p, context, read, write, snap, result, save, finish, register, folder };
}