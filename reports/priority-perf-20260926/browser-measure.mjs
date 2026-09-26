import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const operation = process.argv[2], sample = process.argv[3] || "1";
if (!["default", "nombre", "search", "activity", "credit"].includes(operation) || !/^\d+$/.test(sample)) throw Error("Invalid measurement");
const root = new URL("./", import.meta.url);
const ready = JSON.parse(fs.readFileSync(new URL("./private-ready.json", root)));
const load = JSON.parse(fs.readFileSync(new URL("./load-results.json", root)));
const candidate = JSON.parse(fs.readFileSync(new URL("./candidate.json", root)));
if (ready.database !== "priority_perf_20260926" || ready.url !== "http://127.0.0.1:18238" || load.status !== "LOADED")
  throw Error("Dedicated loaded performance server required");
if (crypto.createHash("sha256").update(fs.readFileSync(candidate.apiEntry)).digest("hex") !== ready.apiSha256)
  throw Error("Frozen candidate mismatch");
const actor = JSON.parse(fs.readFileSync("/tmp/priority-perf-20260926/credentials.json")).admin;
const out = new URL("./measurements-aligned/", root); fs.mkdirSync(out, { recursive: true });
const result = { operation, sample, apiSha256: ready.apiSha256, frontendIndexSha256: candidate.frontendFiles["index.html"],
  thresholdMs: operation === "credit" ? 3000 : 2000, requests: [], errors: [],
  definition: "Fresh real browser/session; action to visible loaded table plus two animation frames; setup/login excluded. Default request sort observed, never inferred from current source." };
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
page.setDefaultTimeout(45000);
await page.addInitScript(() => {
  window.__measurementLongTasks = [];
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__measurementLongTasks.push({
        startEpochMs: performance.timeOrigin + entry.startTime, durationMs: entry.duration,
      });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
});
const pending = [];
let measuring = false;
page.on("response", r => {
  if (!r.url().startsWith(`${ready.url}/api/`)) return;
  const inMeasuredAction = measuring;
  pending.push((async () => {
    let completionTimer;
    const completion = await Promise.race([
      r.finished().then(() => "finished", () => "closed"),
      new Promise(resolve => { completionTimer = setTimeout(() => resolve("incomplete"), 10000); }),
    ]);
    clearTimeout(completionTimer);
    const u = new URL(r.url()), headers = await r.allHeaders();
    if (u.searchParams.has("q")) u.searchParams.set("q", `[redacted:${u.searchParams.get("q").length}]`);
    result.requests.push({ path: u.pathname, query: u.search, status: r.status(), inMeasuredAction, completion,
      method: r.request().method(), timing: r.request().timing(), headers: Object.fromEntries(Object.entries(headers).filter(([k]) =>
        k === "server-timing" || k === "cache-control" || k.startsWith("x-client") || k.startsWith("x-query") || k.startsWith("x-db"))) });
  })().catch(() => { result.collectionErrors = (result.collectionErrors ?? 0) + 1; }));
});
page.on("pageerror", e => result.errors.push(e.name));
try {
  await page.route("**/*", r => new URL(r.request().url()).origin === ready.url ? r.continue() : r.abort());
  await page.goto(`${ready.url}/login`);
  await page.getByLabel("Usuario", { exact: true }).fill(actor.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(actor.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(u => !u.pathname.includes("login"));
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: load.sites[0].nombre, exact: true }).click();
  console.log(JSON.stringify({ operation, sample, stage: "authenticated-site-ready" }));
  const tableReady = async () => {
    await page.locator('table[aria-busy="false"]').waitFor();
    await page.locator('a[href^="/clientes/"]').first().waitFor();
  };
  if (!["default", "credit"].includes(operation)) {
    await page.getByRole("link", { name: "Clientes", exact: true }).click(); await tableReady();
  }
  let search;
  if (operation === "search") search = (await page.locator('a[href^="/clientes/"]').first().innerText()).trim();
  measuring = true;
  result.actionStartEpochMs = Date.now();
  const start = performance.now();
  result.actionStartNodeMonotonicMs = start;
  if (operation === "default") {
    await page.getByRole("link", { name: "Clientes", exact: true }).click(); await tableReady();
  } else if (operation === "credit") {
    result.range = { from: load.assumptions.start, through: load.end };
    await page.goto(`${ready.url}/reportes/clientes?periodo=personalizado&desde=${load.assumptions.start}&hasta=${load.end}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("report-content-clientes").waitFor();
  } else {
    const response = page.waitForResponse(r => {
      const u = new URL(r.url());
      return u.pathname === "/api/clientes/listado" && (operation === "search" ? u.searchParams.get("q") === search :
        u.searchParams.get("sort") === (operation === "nombre" ? "nombre" : "lastActivity"));
    });
    if (operation === "search") await page.getByTestId("input-search-clients").fill(search);
    else await page.getByTestId(`sort-clients-${operation === "nombre" ? "nombre" : "lastActivity"}`).click();
    await response; await tableReady();
  }
  result.visibleDetectedEpochMs = Date.now();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  result.durationMs = performance.now() - start;
  result.actionEndEpochMs = Date.now();
  result.actionEndNodeMonotonicMs = start + result.durationMs;
  measuring = false;
  // Snapshot/DOM counting is diagnostic overhead, never part of acceptance time.
  result.browserAtVisible = await page.evaluate(() => ({
    timeOriginEpochMs: performance.timeOrigin,
    nowMs: performance.now(),
    visibleEpochMs: performance.timeOrigin + performance.now(),
    navigation: performance.getEntriesByType("navigation").map(e => e.toJSON()),
    longTasks: window.__measurementLongTasks,
    reportTableRows: document.querySelectorAll('[data-testid^="report-table-"] tbody tr').length,
    directoryRows: document.querySelectorAll('[data-testid^="row-client-"]').length,
    domElements: document.getElementsByTagName("*").length,
  }));
  console.log(JSON.stringify({ operation, sample, stage: "visible" }));
  await Promise.all(pending);
  result.phaseIntervals = result.requests.filter(r => r.inMeasuredAction).map(r => ({
    path: r.path,
    actionToRequestStartMs: r.timing.startTime - result.actionStartEpochMs,
    requestDurationMs: r.timing.responseEnd,
    responseEndToVisibleMs: result.visibleDetectedEpochMs - (r.timing.startTime + r.timing.responseEnd),
  }));
  result.status = result.errors.length || result.requests.some(r => r.status >= 500) ? "ERROR" :
    result.durationMs < result.thresholdMs ? "PASS" : "SLOW";
  await page.screenshot({ path: new URL(`${operation}-${sample}.png`, out).pathname });
} catch (error) {
  result.status = "BLOCKED"; result.error = error.message;
  await page.screenshot({ path: new URL(`${operation}-${sample}-blocked.png`, out).pathname }).catch(() => {});
} finally {
  await Promise.all(pending);
  fs.writeFileSync(new URL(`${operation}-${sample}.json`, out), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ operation, sample, status: result.status, durationMs: result.durationMs }));