import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const root = path.resolve("reports/auditoria-colaborativa/browser-live");
const ready = JSON.parse(fs.readFileSync(`${root}/private-ready.json`));
const candidate = JSON.parse(fs.readFileSync(`${root}/candidate.json`));
const fixture = JSON.parse(fs.readFileSync(`${root}/fixture.json`));
const privateDir = "/tmp/scanner-e2e-isolated";
const credentials = JSON.parse(fs.readFileSync(`${privateDir}/credentials.json`));
const env = JSON.parse(fs.readFileSync(`${privateDir}/test-env.json`));
const digest = b => crypto.createHash("sha256").update(b).digest("hex");
assert.equal(digest(fs.readFileSync(candidate.apiEntry)), ready.apiSha256);
assert.equal(ready.apiSha256, candidate.apiSha256);
for (const [file, hash] of Object.entries(candidate.frontendFiles)) assert.equal(digest(fs.readFileSync(path.join(candidate.frontendRoot, file))), hash);
assert.equal(ready.database, fixture.database);
assert.equal(ready.url, "http://127.0.0.1:18128");
const pool = new pg.Pool({ connectionString: env.TEST_DATABASE_URL });
assert.equal((await pool.query("SELECT current_database() AS database")).rows[0].database, fixture.database);
const out = `${root}/screenshots`;
fs.mkdirSync(out, { recursive: true });
const captureOnly = process.argv.includes("--capture-results");
const remaining = process.argv.includes("--remaining") || captureOnly;
const previous = remaining ? JSON.parse(fs.readFileSync(`${root}/browser-result.json`)) : null;
if (fs.existsSync(`${root}/browser-result.json`)) {
  fs.copyFileSync(`${root}/browser-result.json`, `${root}/browser-attempt-${Date.now()}.json`);
}
const evidence = previous
  ? { ...previous, status: "RUNNING", error: undefined, lastUi: undefined }
  : { status: "RUNNING", candidate: ready.apiSha256, frontendIndex: candidate.frontendFiles["index.html"], checks: [], images: [], contexts: 6 };
assert.equal(evidence.candidate, ready.apiSha256);
const save = () => fs.writeFileSync(`${root}/browser-result.json`, JSON.stringify(evidence, null, 2));
const check = (name, details = true) => { evidence.checks.push({ name, passed: true, details }); save(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = fs.mkdtempSync(`${privateDir}/chromium-`);
const chrome = spawn("/repl/tools/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });
let ws;
let sequence = 0;
const pending = new Map();
const network = [];
const contexts = [];
const mobileUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const desktopUA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout ${method}`)); }, 20000);
    pending.set(id, [value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); }]);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function js(ctx, expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, ctx.sessionId);
  if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
  return result.result.value;
}
const selector = testid => `document.querySelector('[data-testid="${testid}"]')`;
async function wait(ctx, expression, description, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await js(ctx, expression)) return;
    await sleep(150);
  }
  throw Error(`UI timeout: ${description}`);
}
async function click(ctx, expression) {
  const box = await js(ctx, `(()=>{const e=${expression};if(!e||e.disabled)return null;e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  assert.ok(box, "Clickable UI element exists");
  for (const type of ["mousePressed", "mouseReleased"])
    await call("Input.dispatchMouseEvent", { type, ...box, button: "left", clickCount: 1 }, ctx.sessionId);
  await sleep(250);
}
async function text(ctx, expression, value) {
  await click(ctx, expression);
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 }, ctx.sessionId);
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 }, ctx.sessionId);
  await call("Input.insertText", { text: value }, ctx.sessionId);
}
async function enter(ctx) {
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, ctx.sessionId);
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, ctx.sessionId);
}
async function api(ctx, route, method = "GET", body) {
  return js(ctx, `(async()=>{const r=await fetch(${JSON.stringify("/api" + route)},{method:${JSON.stringify(method)},headers:{"Content-Type":"application/json"},${body === undefined ? "" : `body:${JSON.stringify(JSON.stringify(body))},`}credentials:"include"});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null}})()`);
}
async function snap(ctx, name, focus = "audit-shared-progress") {
  await js(ctx, `${selector(focus)}?.scrollIntoView({block:"center"})`);
  await sleep(250);
  const body = await js(ctx, "document.body.innerText");
  assert.ok(body.includes("Auditoría") && !body.includes("Iniciar sesión"), "Screenshot is authenticated audit UI");
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, ctx.sessionId);
  const bytes = Buffer.from(result.data, "base64");
  assert.ok(bytes.length > 12000 && bytes.subarray(1, 4).toString() === "PNG");
  fs.writeFileSync(`${out}/${name}.png`, bytes);
  evidence.images.push({ file: `screenshots/${name}.png`, name, bytes: bytes.length, sha256: digest(bytes), actor: ctx.actor, mobile: ctx.mobile });
  save();
}
async function login(ctx, actor) {
  await call("Page.navigate", { url: ready.url + "/login" }, ctx.sessionId);
  await wait(ctx, "location.origin===" + JSON.stringify(ready.url), "private origin");
  const logged = await api(ctx, "/auth/login", "POST", { usuario: actor.usuario, password: actor.password });
  assert.equal(logged.status, 200, "Actual isolated API browser login");
  const me = await api(ctx, "/auth/me");
  assert.equal(me.status, 200, "HttpOnly browser cookie authenticated");
  ctx.actor = actor.usuario;
}
async function navigate(ctx) {
  await call("Page.navigate", { url: ready.url + "/inventario/auditorias" }, ctx.sessionId);
  await wait(ctx, `!!${selector("select-audit-site")}`, "audit site selector");
}
async function join(ctx) {
  await wait(ctx, `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==="Unirme a la auditoría")`, "explicit join");
  await click(ctx, `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==="Unirme a la auditoría")`);
}
async function chooseFloor(ctx, name) {
  await wait(ctx, `!!${selector("dialog-audit-floor")}`, "mobile floor modal");
  await click(ctx, selector("select-audit-floor"));
  await wait(ctx, `[...document.querySelectorAll('[role="option"]')].some(o=>o.textContent===${JSON.stringify(name)})`, "configured floor option");
  await click(ctx, `[...document.querySelectorAll('[role="option"]')].find(o=>o.textContent===${JSON.stringify(name)})`);
  await wait(ctx, `${selector("select-audit-floor")}?.textContent===${JSON.stringify(name)} && !document.querySelector('[role="listbox"]')`, "selected floor settled");
  await click(ctx, selector("button-continue-audit-floor"));
  await wait(ctx, `!!${selector("button-confirm-audit-floor")}`, "confirm floor");
  await click(ctx, selector("button-confirm-audit-floor"));
  await wait(ctx, `${selector("audit-floor-name")}?.textContent===${JSON.stringify(name)} && !${selector("input-audit-scan")}?.disabled`, "floor selected scanner enabled");
}
async function scan(ctx, serie) {
  await wait(ctx, `${selector("input-audit-scan")} && !${selector("input-audit-scan")}.disabled`, "enabled scanner");
  await text(ctx, selector("input-audit-scan"), serie);
  await enter(ctx);
}
async function count(ctx, expected) {
  await wait(ctx, `${selector("shared-escaneados")}?.textContent==="${expected}"`, `shared scan count ${expected}`);
}
async function finishGallery() {
  const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const figures = evidence.images.map(image =>
    `<figure><figcaption>${escape(image.name)} — ${escape(image.actor)}</figcaption><img alt="${escape(image.name)}" src="data:image/png;base64,${fs.readFileSync(path.join(root, image.file)).toString("base64")}"></figure>`).join("");
  fs.writeFileSync(`${root}/gallery.html`, `<!doctype html><meta charset="utf-8"><title>Auditoría colaborativa — navegador real aislado</title><style>body{font:16px system-ui;margin:24px;background:#f3f4f6;color:#17212b}figure{background:white;padding:16px;margin:20px 0;border-radius:12px}img{max-width:100%;height:auto}figcaption{font-weight:700;margin-bottom:14px}</style><h1>Auditoría colaborativa — evidencia aislada</h1><p>Estado: ${escape(evidence.status)}. Seis contextos Chromium, API real, datos sintéticos. ${evidence.checks.length} comprobaciones aprobadas.</p>${figures}`);
  fs.writeFileSync(`${root}/screenshot-manifest.json`, JSON.stringify(evidence.images, null, 2));
}
try {
  let port;
  for (let n = 0; n < 70; n++) {
    try { port = Number(fs.readFileSync(`${profile}/DevToolsActivePort`, "utf8").split("\n")[0]); break; } catch { await sleep(100); }
  }
  assert.ok(port, "Private Chromium started");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const [ok, fail] = pending.get(message.id); pending.delete(message.id);
      message.error ? fail(Error(message.error.message)) : ok(message.result);
    }
    if (message.method === "Network.responseReceived" && message.params.response.url.includes("/api/inventario/auditorias"))
      network.push({ sessionId: message.sessionId, url: new URL(message.params.response.url).pathname, status: message.params.response.status });
  };
  for (let i = 0; i < (captureOnly ? 1 : 6); i++) {
    const { browserContextId } = await call("Target.createBrowserContext");
    const { targetId } = await call("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    const ctx = { browserContextId, targetId, sessionId, mobile: i < 3 };
    contexts.push(ctx);
    await call("Page.enable", {}, sessionId);
    await call("Runtime.enable", {}, sessionId);
    await call("Network.enable", {}, sessionId);
    await call("Network.setUserAgentOverride", { userAgent: ctx.mobile ? mobileUA : desktopUA, platform: ctx.mobile ? "Android" : "Linux x86_64" }, sessionId);
    await call("Emulation.setDeviceMetricsOverride", { width: i === 0 ? 402 : 1366, height: i === 0 ? 874 : 1100, deviceScaleFactor: 1, mobile: ctx.mobile }, sessionId);
    await call("Emulation.setTouchEmulationEnabled", { enabled: ctx.mobile, maxTouchPoints: ctx.mobile ? 5 : 1 }, sessionId);
    await call("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
  }
  if (captureOnly) {
    await login(contexts[0], credentials.users[0]);
    await navigate(contexts[0]);
    await wait(contexts[0], `!!${selector(`button-audit-${evidence.auditId}`)}`, "closed audit history");
    await click(contexts[0], selector(`button-audit-${evidence.auditId}`));
    await wait(contexts[0], `!!${selector("row-audit-result-990260001")}`, "preserved closed audit result");
    const rowText = await js(contexts[0], `${selector("row-audit-result-990260001")}.innerText`);
    assert.ok(rowText.includes("Primer piso") && rowText.includes("Segundo piso") && rowText.includes("E2E Scanner 1"));
    await snap(contexts[0], "08-mobile-misplaced-two-floors-author", "row-audit-result-990260001");
    await call("Emulation.setDeviceMetricsOverride", { width: 1366, height: 1100, deviceScaleFactor: 1, mobile: false }, contexts[0].sessionId);
    await snap(contexts[0], "09-desktop-shared-authors-and-floor-evidence", "row-audit-result-990260001");
    check("Rendered misplaced row visibly includes both floor names and original author; screenshots inspected");
    evidence.status = "PASSED";
  } else {
  let auditId;
  if (remaining) {
    auditId = evidence.auditId;
    for (let i = 0; i < contexts.length; i++) await login(contexts[i], credentials.users[i]);
    await Promise.all(contexts.map(navigate));
    for (let i = 0; i < 5; i++) await join(contexts[i]);
    await chooseFloor(contexts[0], "Segundo piso");
    await chooseFloor(contexts[1], "Primer piso");
    await chooseFloor(contexts[2], "Tercer piso");
    await Promise.all(contexts.slice(3, 5).map(ctx => wait(ctx, `${selector("input-audit-scan")} && !${selector("input-audit-scan")}.disabled`, "desktop lease active")));
  } else {
  // Admin setup uses context6 temporarily; no seventh browser identity or mock API.
  await login(contexts[5], credentials.admin);
  await navigate(contexts[5]);
  await click(contexts[5], selector("select-audit-site"));
  await wait(contexts[5], `[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent.includes("E2E Scanner Sur"))`, "south site");
  await click(contexts[5], `[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes("E2E Scanner Sur"))`);
  await wait(contexts[5], `!!${selector("button-open-audit")}`, "empty south create button");
  check("Empty south site offers start to authorized creator");
  await snap(contexts[5], "01-empty-south-start", "button-open-audit");
  const existing = (await pool.query("SELECT id FROM auditorias_inventario WHERE ubicacion_id=$1 AND estado='ABIERTA'", [fixture.sites[0].id])).rows[0];
  const north = existing
    ? await api(contexts[5], `/inventario/auditorias/${existing.id}`)
    : await api(contexts[5], "/inventario/auditorias", "POST", { ubicacionId: fixture.sites[0].id });
  assert.equal(north.status, existing ? 200 : 201);
  evidence.auditId = north.body.id;
  evidence.folio = north.body.folioFormateado;
  auditId = north.body.id;
  await api(contexts[5], "/auth/logout", "POST");
  for (let i = 0; i < contexts.length; i++) await login(contexts[i], credentials.users[i]);
  await Promise.all(contexts.map(navigate));
  await Promise.all(contexts.map(ctx => wait(ctx, `document.body.innerText.includes("Unirme a la auditoría")`, "north explicit join card")));
  await sleep(3500);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM auditoria_inventario_participantes WHERE auditoria_id=$1", [auditId])).rows[0].n, 0);
  check("Six authenticated browsers browse without consuming seats");
  await snap(contexts[0], "02-mobile-explicit-join", "select-audit-site");
  await Promise.all(contexts.slice(0, 3).map(join));
  await chooseFloor(contexts[0], "Segundo piso");
  await chooseFloor(contexts[1], "Primer piso");
  await chooseFloor(contexts[2], "Tercer piso");
  check("Three concurrent mobile-UA touch contexts explicitly join and select three distinct configured floors");
  await Promise.all(contexts.slice(0, 3).map((ctx, i) => scan(ctx, `99026000${i + 1}`)));
  await Promise.all(contexts.slice(0, 3).map(ctx => count(ctx, 3)));
  for (let i = 0; i < 3; i++) await snap(contexts[i], `03-shared-three-user-${i + 1}`);
  check("Promise.all real input scans propagate shared count3 to all three");
  const first = (await pool.query("SELECT * FROM auditoria_inventario_escaneos WHERE auditoria_id=$1 AND serie='990260001'", [auditId])).rows[0];
  assert.equal(first.usuario_id, credentials.users[0].id);
  assert.equal(first.piso_real_id, fixture.sites[0].floors[1].id);
  assert.equal((await pool.query("SELECT piso_id FROM rollos WHERE serie='990260001'")).rows[0].piso_id, fixture.sites[0].floors[0].id);
  const detail = await api(contexts[0], `/inventario/auditorias/${auditId}`);
  const misplaced = detail.body.resultados.find(row => row.serie === "990260001");
  assert.equal(misplaced.clasificacion, "MAL_ACOMODADO");
  assert.equal(misplaced.pisoEsperado, "Primer piso");
  assert.equal(misplaced.pisoReal, "Segundo piso");
  check("MAL_ACOMODADO retains expected Primer piso, actual Segundo piso, original author; no autoapply");
  await Promise.all(contexts.slice(0, 3).map(ctx => scan(ctx, "990260004")));
  await Promise.all(contexts.slice(0, 3).map(ctx => count(ctx, 4)));
  const original = (await pool.query("SELECT usuario_id,piso_real_id FROM auditoria_inventario_escaneos WHERE auditoria_id=$1 AND serie='990260004'", [auditId])).rows;
  assert.equal(original.length, 1);
  await scan(contexts[0], "990260004");
  await wait(contexts[0], 'document.body.innerText.includes("Serie ya registrada")', "duplicate warning");
  await snap(contexts[0], "04-duplicate-original-author");
  assert.deepEqual((await pool.query("SELECT usuario_id,piso_real_id FROM auditoria_inventario_escaneos WHERE auditoria_id=$1 AND serie='990260004'", [auditId])).rows, original);
  check("Concurrent duplicate creates one row; repeated warning preserves original author and floor", original[0]);
  await Promise.all(contexts.slice(0, 3).map(async ctx => {
    const d = await api(ctx, `/inventario/auditorias/${auditId}`);
    assert.equal(d.body.totalEscaneados, 4);
    assert.equal(d.body.faltantes, 7);
    for (let i = 0; i < 3; i++) {
      assert.equal(d.body.resultados.find(r => r.serie === `99026000${i + 1}`).usuarioNombre, credentials.users[i].nombre);
    }
  }));
  check("All three real browser sessions see missing7 and all three per-roll authors");
  await Promise.all([join(contexts[3]), join(contexts[4])]);
  await Promise.all(contexts.slice(3, 5).map(ctx => wait(ctx, `!${selector("input-audit-scan")}?.disabled`, "desktop admitted")));
  assert.equal(await js(contexts[3], `${selector("audit-floor-name")}.textContent`), "Primer piso");
  assert.equal(await js(contexts[3], `!!${selector("button-change-audit-floor")}`), false);
  await snap(contexts[3], "05-desktop-fixed-primer-piso");
  check("Desktop UA admission fixes first configured Primer piso with no change control");
  }
  await join(contexts[5]);
  const limitUntil = Date.now() + 20000;
  while (!network.some(r => r.sessionId === contexts[5].sessionId && r.url.endsWith("/participar") && r.status === 409) && Date.now() < limitUntil) await sleep(150);
  await wait(contexts[5], '!document.body.innerText.includes("Uniéndote...") && document.querySelector(\'[data-testid="input-audit-scan"]\')?.disabled', "sixth blocked response settled");
  assert.ok(network.some(r => r.sessionId === contexts[5].sessionId && r.url.endsWith("/participar") && r.status === 409));
  await snap(contexts[5], "06-sixth-full-disabled");
  check("Actors4/5 admitted; actor6 explicit join returns409 and disables scanner");
  await navigate(contexts[0]);
  await join(contexts[0]);
  await chooseFloor(contexts[0], "Segundo piso");
  const beforeHeartbeat = (await pool.query("SELECT usuario_id,ultimo_at FROM auditoria_inventario_participantes WHERE auditoria_id=$1 ORDER BY usuario_id", [auditId])).rows;
  await sleep(22000);
  const afterHeartbeat = (await pool.query("SELECT usuario_id,ultimo_at FROM auditoria_inventario_participantes WHERE auditoria_id=$1 ORDER BY usuario_id", [auditId])).rows;
  assert.equal(afterHeartbeat.length, 5);
  assert.ok(afterHeartbeat.every((row, i) => new Date(row.ultimo_at) > new Date(beforeHeartbeat[i].ultimo_at)));
  check("Same-user refresh/rejoin at five allowed; all five original leases heartbeat");
  const forbidden = await api(contexts[0], `/inventario/auditorias/${auditId}/cerrar`, "POST", {});
  assert.equal(forbidden.status, 403);
  assert.equal(await js(contexts[0], `[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Cerrar Conteo"))`), false);
  check("Scanner with editar=true/autorizar=false gets close403 and hidden closure control");
  await api(contexts[5], "/auth/logout", "POST");
  await login(contexts[5], credentials.admin);
  const south = await api(contexts[5], "/inventario/auditorias", "POST", { ubicacionId: fixture.sites[1].id });
  assert.equal(south.status, 201);
  for (const action of ["participar", "escaneos"]) {
    const response = await api(contexts[0], `/inventario/auditorias/${south.body.id}/${action}`, "POST", action === "escaneos" ? { serie: "990260012", pisoId: fixture.sites[0].floor } : {});
    assert.equal(response.status, 403);
  }
  check("Scoped BODEGA cross-site join and scan both403");
  await navigate(contexts[5]);
  await click(contexts[5], selector("select-audit-site"));
  await wait(contexts[5], `[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent.includes("E2E Scanner Sur"))`, "south selector");
  await click(contexts[5], `[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes("E2E Scanner Sur"))`);
  await join(contexts[5]);
  await wait(contexts[5], 'document.body.innerText.includes("Faltan pisos configurados")', "no floors warning");
  assert.equal(await js(contexts[5], `${selector("input-audit-scan")}.disabled`), true);
  await snap(contexts[5], "07-no-floors-hard-block", "audit-floor-banner");
  const noFloor = await api(contexts[5], `/inventario/auditorias/${south.body.id}/escaneos`, "POST", { serie: "990260012" });
  assert.ok(noFloor.status >= 400 && noFloor.status < 500);
  check("No-active-floor site visibly disables scanning and backend rejects", noFloor.status);
  const closed = await api(contexts[5], `/inventario/auditorias/${auditId}/cerrar`, "POST", {});
  assert.equal(closed.status, 200);
  check("Seeded real ADMIN closes north audit through actual API; no stock confirmation");
  evidence.status = "PASSED";
  }
} catch (error) {
  evidence.status = "FAILED";
  evidence.error = error.message;
  for (const ctx of contexts) {
    try {
      evidence.lastUi ??= [];
      evidence.lastUi.push({ actor: ctx.actor, text: (await js(ctx, "document.body.innerText")).slice(-7000) });
    } catch {}
  }
  process.exitCode = 1;
} finally {
  save();
  await finishGallery();
  for (const ctx of contexts) { try { await call("Target.disposeBrowserContext", { browserContextId: ctx.browserContextId }); } catch {} }
  ws?.close();
  chrome.kill("SIGTERM");
  await pool.end();
  console.log(`Browser ${evidence.status}; ${evidence.checks.length} checks; evidence ${root}/browser-result.json; gallery ${root}/gallery.html`);
}