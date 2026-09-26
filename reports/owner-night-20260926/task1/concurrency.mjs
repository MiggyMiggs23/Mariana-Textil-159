import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
import { config, credentials, state, persist, apiSha, uiSha, origin } from "./runtime.mjs";

const f = state.fixtures, run = "overlap-" + Date.now(), folder = path.resolve(config.reportDirectory, run);
assert.equal(f.cashiers.length, 2); assert.equal(f.auditors.length, 3); assert.ok(f.audit.id);
fs.mkdirSync(folder, { recursive: true });
const actors = [...f.cashiers.map((a, i) => ({ ...a, job: "cashier", index: i })), ...f.auditors.map((a, i) => ({ ...a, job: "auditor", index: i })), { ...credentials.admin, username: credentials.admin.usuario, job: "admin", index: 0 }];
const secrets = actors.map(a => a.password);
const scrub = value => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /password|cookie|authorization|token/i.test(k) ? "[REDACTED]" : scrub(v)]));
  if (typeof value !== "string") return value;
  for (const s of secrets) value = value.replaceAll(s, "[REDACTED]");
  return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[REDACTED_DSN]");
};
const summary = { status: "RUNNING", run, database: config.database, origin, apiSha, uiSha, normalClock: true, startedAt: new Date().toISOString(), actors: actors.map(a => ({ id: a.id, role: a.rol, job: a.job, index: a.index, site: a.site?.id })), actions: [], requests: [], errors: [], artifacts: [], checks: [] };
const save = () => fs.writeFileSync(path.join(folder, "result.json"), JSON.stringify(scrub(summary), null, 2));
const event = row => fs.appendFileSync(path.join(folder, "timeline.jsonl"), JSON.stringify(scrub(row)) + "\n");
const register = file => { summary.artifacts.push({ file: path.relative(process.cwd(), file), bytes: fs.statSync(file).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }); };
const snap = async (a, name) => {
  const file = path.join(folder, `${a.job}-${a.index}-${name}.png`);
  await a.p.screenshot({ path: file, fullPage: true }); register(file);
  const text = path.join(folder, `${a.job}-${a.index}-${name}.txt`);
  fs.writeFileSync(text, scrub(await a.p.locator("body").innerText())); register(text);
};
const read = (a, endpoint) => a.p.evaluate(async endpoint => { const r = await fetch(endpoint, { credentials: "include" }); return { status: r.status, body: await r.json() }; }, endpoint);
const step = async (a, name, fn) => {
  const start = Date.now(), row = { actorId: a.id, job: a.job, name, startedAt: new Date(start).toISOString(), startMs: start };
  event({ ...row, event: "ACTION_START" });
  try { row.result = await fn(); row.status = "PASS"; return row.result; }
  catch (e) { row.status = "FAIL"; row.error = e.message; summary.errors.push({ ...row }); throw e; }
  finally { row.endMs = Date.now(); row.durationMs = row.endMs - start; summary.actions.push(row); event({ ...row, event: "ACTION_END" }); save(); }
};
const nativeWrite = async (a, key, endpoint, control) => {
  assert.ok(!state.operations[key], "Existing intent must not be repeated: " + key);
  const op = state.operations[key] = { status: "UNCERTAIN", actorId: a.id, endpoint, startedAt: new Date().toISOString() }; persist();
  const capture = req => { if (req.method() === "POST" && new URL(req.url()).pathname === endpoint) { op.requestBody = req.postDataJSON(); persist(); } };
  a.p.on("request", capture);
  const waiting = a.p.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === endpoint); waiting.catch(() => {});
  try {
    await control.click(); const r = await waiting; op.http = r.status(); op.response = await r.json();
    op.status = r.ok() ? "ACK" : r.status() >= 500 ? "UNCERTAIN" : "REJECTED"; persist();
    assert.ok(r.ok(), `POST ${endpoint} HTTP${r.status()} ${JSON.stringify(op.response)}`);
    return op.response;
  } finally { a.p.off("request", capture); }
};
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const pending = [];
let fatal;
try {
  await Promise.all(actors.map(async a => {
    const mobile = a.job === "auditor";
    a.context = await browser.newContext({ timezoneId: "America/Mexico_City", viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, ...(mobile ? { isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36" } : {}), acceptDownloads: true });
    let serial = 0;
    await a.context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) return route.abort();
      return route.continue({ headers: { ...route.request().headers(), "x-request-id": `${run}-${a.id}-${++serial}` } });
    });
    a.p = await a.context.newPage(); a.p.setDefaultTimeout(20000);
    const timing = new WeakMap();
    a.p.on("request", req => timing.set(req, Date.now()));
    a.p.on("pageerror", e => { const row = { event: "BROWSER_EXCEPTION", actorId: a.id, at: new Date().toISOString(), error: e.message }; summary.errors.push(row); event(row); });
    a.p.on("response", response => {
      if (!new URL(response.url()).pathname.startsWith("/api/")) return;
      pending.push((async () => {
        const req = response.request(), started = timing.get(req);
        const row = { actorId: a.id, job: a.job, method: req.method(), path: new URL(response.url()).pathname, status: response.status(), at: new Date().toISOString(), startMs: started, durationMs: Date.now() - started, requestId: (await req.allHeaders())["x-request-id"], authenticated: !!a.loggedIn };
        if (response.status() >= 400) row.error = await response.json().catch(() => ({ unreadable: true }));
        summary.requests.push(row); event({ ...row, event: "HTTP_RESPONSE" });
      })());
    });
    a.p.on("requestfailed", req => { if (new URL(req.url()).pathname.startsWith("/api/")) event({ event: "HTTP_NETWORK_FAILURE", actorId: a.id, path: new URL(req.url()).pathname, error: req.failure()?.errorText, at: new Date().toISOString() }); });
    const response = await a.p.goto(origin + "/login"), headers = await response.allHeaders();
    assert.equal(response.status(), 200); assert.equal(headers["x-priority-api-sha256"], apiSha); assert.equal(headers["x-priority-ui-sha256"], uiSha); assert.equal(headers["x-priority-clock"], "system");
    await a.p.getByLabel("Usuario", { exact: true }).fill(a.username);
    await a.p.getByLabel("Contraseña", { exact: true }).fill(a.password);
  }));
  summary.loginBarrierAt = new Date().toISOString(); save();
  await Promise.all(actors.map(a => step(a, "simultaneous-native-login", async () => {
    const wait = a.p.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/login"); wait.catch(() => {});
    await a.p.getByRole("button", { name: "Ingresar", exact: true }).click();
    const response = await wait; assert.equal(response.status(), 200, "Concurrent native login HTTP");
    await a.p.waitForURL(url => url.pathname !== "/login"); a.loggedIn = true;
    const me = await read(a, "/api/auth/me"); assert.equal(me.status, 200); assert.equal(me.body.id, a.id); a.permissions = me.body.permisos;
    return { status: response.status(), identity: me.body.id, role: me.body.rol };
  })));
  await Promise.all(actors.map(a => step(a, "native-workspace-ready", async () => {
    if (a.job === "cashier") {
      await a.p.goto(origin + "/cobros");
      await a.p.getByText(`Ticket folio ${a.tickets[0].folio}`, { exact: true }).waitFor();
    } else if (a.job === "auditor") {
      await a.p.goto(origin + "/inventario/auditorias"); await a.p.getByTestId("select-audit-site").click();
      await a.p.getByRole("option", { name: `${f.auditSite.iniciales} · ${f.auditSite.nombre}`, exact: true }).click();
      await nativeWrite(a, `task2-join-${a.id}`, `/api/inventario/auditorias/${f.audit.id}/participar`, a.p.getByRole("button", { name: "Unirme a la auditoría", exact: true }));
      await a.p.getByTestId("dialog-audit-floor").waitFor(); await a.p.getByTestId("select-audit-floor").click();
      await a.p.getByRole("option", { name: f.auditFloors[a.index].nombre, exact: true }).click();
      await a.p.getByTestId("button-continue-audit-floor").click(); await a.p.getByTestId("button-confirm-audit-floor").click();
      await a.p.getByTestId("input-audit-scan").waitFor(); assert.equal(await a.p.getByTestId("input-audit-scan").isEnabled(), true);
    } else {
      await a.p.goto(origin + "/reportes/ventas"); await a.p.getByTestId("tab-ventas").waitFor();
    }
    await snap(a, "ready"); return { page: new URL(a.p.url()).pathname };
  })));
  const workStart = Date.now(); summary.overlapStartMs = workStart; summary.overlapStartAt = new Date(workStart).toISOString(); save();
  const collect = async (a, round) => {
    if (round % 2 || round / 2 >= a.tickets.length) return session(a, round);
    const ticket = a.tickets[round / 2];
    return step(a, `native-collect-ticket-${ticket.id}`, async () => {
      const caption = `Ticket folio ${ticket.folio}`;
      await a.p.getByText(caption, { exact: true }).locator("xpath=ancestor::div[.//button[normalize-space()='Cobrar']][1]").getByRole("button", { name: "Cobrar", exact: true }).click();
      await a.p.getByRole("button", { name: "Efectivo", exact: true }).click();
      await nativeWrite(a, `task2-collect-${ticket.id}`, `/api/tickets/${ticket.id}/cobrar`, a.p.getByRole("button", { name: "Confirmar Pago", exact: true }));
      const back = await read(a, `/api/tickets/${ticket.id}`); assert.equal(back.status, 200); assert.equal(back.body.cobrado, true); assert.equal(back.body.total, "1000.00");
      return { ticketId: ticket.id, folio: ticket.folio, amount: 1000, sessionId: a.cash.id, independentCollected: back.body.cobrado };
    });
  };
  const session = (a, round) => step(a, `session-identity-${round}`, async () => {
    assert.notEqual(new URL(a.p.url()).pathname, "/login"); const me = await read(a, "/api/auth/me"); assert.equal(me.status, 200); assert.equal(me.body.id, a.id); return { id: me.body.id, role: me.body.rol, page: new URL(a.p.url()).pathname };
  });
  const scan = (a, round) => step(a, `native-audit-scan-${round}`, async () => {
    const series = f.auditSeries[a.index * 6 + Math.min(round, 5)];
    const input = a.p.getByTestId("input-audit-scan"); await input.fill(series);
    const response = await nativeWrite(a, `task2-scan-${a.id}-${round}`, `/api/inventario/auditorias/${f.audit.id}/escaneos`, { click: () => input.press("Enter") });
    return { series, intendedFloorId: f.auditFloors[a.index].id, response };
  });
  const report = (a, round) => step(a, `native-admin-report-${round}`, async () => {
    const tab = ["ventas", "utilidad", "clientes", "control-operativo"][round % 4];
    await a.p.goto(origin + "/reportes/" + tab); await a.p.getByTestId("tab-" + tab).waitFor();
    await a.p.waitForTimeout(300);
    assert.notEqual(new URL(a.p.url()).pathname, "/login");
    return { tab, visibleCharacters: (await a.p.locator("body").innerText()).length };
  });
  for (let round = 0; round < 25; round++) {
    const due = workStart + round * 8000; if (Date.now() < due) await new Promise(resolve => setTimeout(resolve, due - Date.now()));
    event({ event: "ROUND", round, at: new Date().toISOString(), elapsedMs: Date.now() - workStart });
    await Promise.all(actors.map(async a => {
      if (a.blocked) return;
      try {
        await (a.job === "cashier" ? collect(a, round) : a.job === "auditor" ? scan(a, round) : report(a, round));
        if (round % 5 === 0) await session(a, round);
        if ([0, 12, 24].includes(round)) await snap(a, "round-" + round);
      } catch (e) { a.blocked = true; summary.errors.push({ actorId: a.id, job: a.job, round, actionStoppedToAvoidReplay: true, error: e.message }); await snap(a, "blocked-" + round).catch(() => {}); }
    }));
  }
  const minimumEnd = workStart + 195000; if (Date.now() < minimumEnd) await new Promise(resolve => setTimeout(resolve, minimumEnd - Date.now()));
  await Promise.all(actors.map(a => session(a, "final").catch(() => {})));
  summary.overlapEndMs = Date.now(); summary.overlapDurationMs = summary.overlapEndMs - workStart; assert.ok(summary.overlapDurationMs >= 180000);
  const admin = actors.find(a => a.job === "admin");
  const audit = await read(admin, `/api/inventario/auditorias/${f.audit.id}`); assert.equal(audit.status, 200);
  summary.checks.push({ audit: audit.body });
  assert.equal(audit.body.totalEscaneados, 18);
  for (const a of actors.filter(a => a.job === "cashier")) {
    const cut = await read(admin, `/api/sesiones-caja/${a.cash.id}/corte`); assert.equal(cut.status, 200); assert.equal(cut.body.efectivoEsperado, "12000.00");
    summary.checks.push({ cashierId: a.id, cut: cut.body });
  }
  assert.ok(actors.every(a => !a.blocked), "At least one actor blocked; do not claim full six-user completion");
} catch (e) { fatal = e; summary.errors.push({ fatal: e.message }); }
finally {
  await Promise.all(actors.map(async a => { if (a.context) { await a.context.storageState({ path: path.join(config.journalDirectory, `${run}-${a.id}-browser.json`) }); fs.chmodSync(path.join(config.journalDirectory, `${run}-${a.id}-browser.json`), 0o600); } }));
  await browser.close(); await Promise.allSettled(pending);
  summary.finishedAt = new Date().toISOString();
  summary.serverErrors = summary.requests.filter(r => r.status >= 500);
  summary.authenticatedSessionFailures = summary.requests.filter(r => r.authenticated && r.status === 401);
  summary.status = fatal || summary.errors.length || summary.serverErrors.length || summary.authenticatedSessionFailures.length ? "FAIL_OR_BLOCKED" : "PASS";
  save(); console.log(JSON.stringify({ status: summary.status, evidence: folder, overlapDurationMs: summary.overlapDurationMs, serverErrors: summary.serverErrors.length, errors: summary.errors.map(e => ({ actorId: e.actorId, error: e.error, fatal: e.fatal })) }));
}