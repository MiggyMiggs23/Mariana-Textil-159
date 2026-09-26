import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const [phase, sample] = process.argv.slice(2);
assert.ok(["baseline", "after"].includes(phase) && ["1", "2", "3"].includes(sample));
const infra = "reports/release-owner-20260926/infra/perf";
const ready = JSON.parse(fs.readFileSync(`${infra}/private-ready.json`));
const load = JSON.parse(fs.readFileSync(`${infra}/load-results.json`));
const config = JSON.parse(fs.readFileSync(`${infra}/candidate.json`));
if (phase === "after") {
  const proxy = JSON.parse(fs.readFileSync(`${infra}/candidate-frontend-ready.json`));
  assert.equal(proxy.existingApiPid, ready.pid);
  assert.equal(proxy.apiUrl, ready.apiUrl);
  assert.equal(proxy.apiSha256, ready.apiSha256);
  ready.url = proxy.url;
}
const uiConfig = phase === "after" ? JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "candidate.json"))) : config;
const expectedApi = "1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e";
const expectedUi = phase === "baseline"
  ? "02e8384c8f458daa0d29a958bc1c519ca7e2b75705a47db3d8b514527965ad78"
  : "af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
assert.equal(ready.database, "release_perf_20260926");
assert.equal(load.database, ready.database);
assert.equal(load.status, "LOADED");
assert.equal(load.after.tickets, 54750);
assert.equal(ready.url, phase === "after" ? "http://127.0.0.1:18239" : "http://127.0.0.1:18238");
assert.equal(hash(fs.readFileSync(config.apiEntry)), expectedApi);
assert.equal(config.apiSha256, expectedApi);
assert.equal(uiConfig.frontendFiles["index.html"], expectedUi);
const actor = JSON.parse(fs.readFileSync("/tmp/release-owner-20260926/release_perf_20260926/credentials.json")).admin;
const out = path.join(import.meta.dirname, "measurements");
fs.mkdirSync(out, { recursive: true });
const output = path.join(out, `${phase}-${sample}.json`);
assert.ok(!fs.existsSync(output), "Never overwrite a measured sample");
const result = {
  phase, sample: Number(sample), origin: ready.url, database: ready.database,
  apiSha256: expectedApi, frontendIndexSha256: expectedUi, apiPid: ready.pid,
  originDifference: phase === "after" ? "Candidate-only frontend proxy18239; baseline proxy18238 untouched; both forward same API18237 PID1540. Fresh independent browser/session per sample." : null,
  model: load.assumptions, range: { from: load.assumptions.start, through: load.end },
  definition: "Fresh browser/session; ordinary login/site selection excluded; full annual credit URL navigation through report-content visible plus two animation frames. No report request warmup. Exports only after third timed sample.",
  requests: [], errors: [],
};
const checkpoint = stage => {
  result.stage = stage;
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
};
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
const deadline = setTimeout(() => {
  result.status = "BLOCKED"; result.error = "Harness deadline 210s; retained, never treated as a fast sample.";
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  browser.close().finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 3000);
}, 210000);
page.setDefaultTimeout(90000);
await page.addInitScript(() => {
  window.__measurementLongTasks = [];
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__measurementLongTasks.push({ startEpochMs: performance.timeOrigin + e.startTime, durationMs: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
});
const pending = [], reportResponses = [];
let measuring = false;
page.on("response", response => {
  if (!response.url().startsWith(`${ready.url}/api/`)) return;
  const inMeasuredAction = measuring;
  if (inMeasuredAction && new URL(response.url()).pathname === "/api/reportes/clientes") reportResponses.push(response);
  pending.push((async () => {
    let timer;
    await Promise.race([response.finished(), new Promise(resolve => { timer = setTimeout(resolve, 15000); })]);
    clearTimeout(timer);
    const url = new URL(response.url()), headers = await response.allHeaders();
    result.requests.push({
      path: url.pathname, query: url.search, status: response.status(),
      method: response.request().method(), inMeasuredAction, timing: response.request().timing(),
      headers: Object.fromEntries(Object.entries(headers).filter(([key]) => key === "server-timing" || key === "cache-control" || key.startsWith("x-priority"))),
    });
  })().catch(error => result.errors.push(`response-collection:${error.name}`)));
});
page.on("pageerror", error => result.errors.push(error.name));
try {
  await page.route("**/*", route => new URL(route.request().url()).origin === ready.url ? route.continue() : route.abort());
  const login = await page.goto(`${ready.url}/login`);
  assert.equal(login.headers()["x-priority-api-sha256"], expectedApi);
  assert.equal(login.headers()["x-priority-ui-sha256"], expectedUi);
  await page.getByLabel("Usuario", { exact: true }).fill(actor.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(actor.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes("login"));
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: load.sites[0].nombre, exact: true }).click();
  console.log(JSON.stringify({ phase, sample, stage: "authenticated-site-ready" }));
  checkpoint("authenticated-site-ready");
  measuring = true;
  result.actionStartEpochMs = Date.now();
  const start = performance.now();
  result.actionStartNodeMonotonicMs = start;
  const navigation = await page.goto(`${ready.url}/reportes/clientes?periodo=personalizado&desde=${load.assumptions.start}&hasta=${load.end}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("report-content-clientes").waitFor();
  result.visibleDetectedEpochMs = Date.now();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  result.durationMs = performance.now() - start;
  result.actionEndEpochMs = Date.now();
  result.actionEndNodeMonotonicMs = start + result.durationMs;
  measuring = false;
  checkpoint("timed-visible");
  assert.equal(navigation.headers()["x-priority-api-sha256"], expectedApi);
  assert.equal(navigation.headers()["x-priority-ui-sha256"], expectedUi);
  result.browserAtVisible = await page.evaluate(() => ({
    timeOriginEpochMs: performance.timeOrigin, nowMs: performance.now(),
    navigation: performance.getEntriesByType("navigation").map(entry => entry.toJSON()),
    longTasks: window.__measurementLongTasks,
    reportTableRows: document.querySelectorAll('[data-testid^="report-table-"] tbody tr').length,
    creditTableRows: document.querySelectorAll('[data-testid="report-content-clientes"] tbody tr').length,
    domElements: document.getElementsByTagName("*").length,
    tables: [...document.querySelectorAll('[data-testid="report-content-clientes"] [data-testid^="report-table-"]')].map(table => ({
      id: table.getAttribute("data-testid"), rows: table.querySelectorAll("tbody tr").length,
      totalsText: table.querySelector("tfoot")?.textContent ?? null,
      pageStatus: table.querySelector('[role="status"]')?.textContent ?? null,
    })),
  }));
  await Promise.all(pending);
  assert.equal(reportResponses.length, 1, "Exactly one annual credit fetch during navigation");
  const response = reportResponses[0];
  assert.equal(response.status(), 200);
  const data = await response.json();
  result.report = {
    url: new URL(response.url()).pathname + new URL(response.url()).search,
    kpis: data.kpis, chartsSha256: hash(JSON.stringify(data.charts ?? [])),
    tables: (data.tables ?? []).map(table => ({
      id: table.id, rowCount: table.rows.length, totals: table.totals,
      rowsSha256: hash(JSON.stringify(table.rows)), columnsSha256: hash(JSON.stringify(table.columns)),
    })),
  };
  result.phaseIntervals = result.requests.filter(request => request.inMeasuredAction).map(request => ({
    path: request.path, actionToRequestStartMs: request.timing.startTime - result.actionStartEpochMs,
    requestDurationMs: request.timing.responseEnd,
    responseEndEpochMs: request.timing.startTime + request.timing.responseEnd,
    responseEndToVisibleMs: result.visibleDetectedEpochMs - (request.timing.startTime + request.timing.responseEnd),
  }));
  checkpoint("diagnostics-collected");
  await page.screenshot({ path: path.join(out, `${phase}-${sample}.png`), timeout: 15000 });
  // Export checks deliberately occur after timing, only after the last repeat.
  if (sample === "3") {
    result.exports = [];
    const ExcelJS = createRequire(path.resolve("artifacts/api-server/package.json"))("exceljs");
    for (const [testId, format] of [["download-excel", "xlsx"], ["download-pdf", "pdf"]]) {
      const downloadPromise = page.waitForEvent("download", { timeout: 180000 });
      await page.getByTestId(testId).click();
      const download = await downloadPromise;
      assert.equal(await download.failure(), null);
      const buffer = fs.readFileSync(await download.path());
      const entry = { format, bytes: buffer.length, sha256: hash(buffer) };
      assert.ok(buffer.length > 1000);
      if (format === "xlsx") {
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
        entry.sheets = workbook.worksheets.map(sheet => ({
          name: sheet.name, rowCount: sheet.rowCount,
          cellsSha256: hash(JSON.stringify(sheet.getSheetValues())),
        }));
        assert.ok(entry.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0) > result.report.tables.reduce((sum, table) => sum + table.rowCount, 0),
          "Workbook must contain the full report's rows plus headers, not a page");
      } else assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
      result.exports.push(entry);
    }
    if (phase === "after") {
      const content = page.getByTestId("report-content-clientes");
      const table = content.getByTestId("report-table-clientes");
      const totalsBefore = await table.locator("tfoot").innerText();
      const pageOneHash = hash(await table.locator("tbody").innerText());
      assert.equal(await table.locator("tbody tr").count(), 50);
      await table.getByRole("button", { name: "Siguiente", exact: true }).click();
      await assert.doesNotReject(() => table.getByRole("status").filter({ hasText: "Página 2" }).waitFor());
      assert.notEqual(hash(await table.locator("tbody").innerText()), pageOneHash);
      assert.equal(await table.locator("tfoot").innerText(), totalsBefore);
      await table.getByTestId("th-ventas").click();
      await table.getByRole("status").filter({ hasText: "Página 1" }).waitFor();
      assert.equal(await table.getByTestId("th-ventas").getAttribute("aria-sort"), "ascending");
      const sorted = [...data.tables.find(t => t.id === "clientes").rows].sort((a, b) => Number(a.ventas) - Number(b.ventas));
      const firstNameColumn = data.tables.find(t => t.id === "clientes").columns.find(c => c.kind === "text");
      if (firstNameColumn) assert.ok((await table.locator("tbody tr").first().innerText()).includes(String(sorted[0][firstNameColumn.key])));
      await table.getByRole("combobox").selectOption("25");
      assert.equal(await table.locator("tbody tr").count(), 25);
      assert.equal(await table.locator("tfoot").innerText(), totalsBefore);
      result.paginationUi = { nextPageChangesRows: true, fullTotalsUnchanged: true, sortAllBeforePage: true, pageSizeReset: true };
      // Actual built-page print DOM and print CSS, without invoking a dialog/PDF spooler.
      await page.emulateMedia({ media: "print" });
      await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
      result.printUi = await content.evaluate(root => ({
        tables: [...root.querySelectorAll('[data-testid^="report-table-"]')].map(table => ({
          id: table.getAttribute("data-testid")?.replace("report-table-", ""),
          rows: table.querySelectorAll("tbody tr").length,
          navigationDisplay: getComputedStyle(table.querySelector("nav")).display,
          headerPosition: getComputedStyle(table.querySelector("thead")).position,
          scrollWrappers: [...table.querySelectorAll("table")].flatMap(t => [t.parentElement, t.parentElement.parentElement]).map(el => ({
            overflow: getComputedStyle(el).overflow, maxHeight: getComputedStyle(el).maxHeight,
          })),
        })),
      }));
      for (const printed of result.printUi.tables) {
        assert.equal(printed.rows, Math.max(1, data.tables.find(t => t.id === printed.id).rows.length));
        assert.equal(printed.navigationDisplay, "none");
        assert.notEqual(printed.headerPosition, "sticky");
        for (const wrapper of printed.scrollWrappers) {
          assert.equal(wrapper.overflow, "visible"); assert.equal(wrapper.maxHeight, "none");
        }
      }
      await page.screenshot({ path: path.join(out, "after-3-print.png"), timeout: 15000 });
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      await page.emulateMedia({ media: "screen" });
      assert.equal(await table.locator("tbody tr").count(), 25);
      result.printUi.restoredScreenPage = true;
    }
  }
  result.status = result.errors.length || result.requests.some(request => request.status >= 500) ? "ERROR" : "MEASURED";
} catch (error) {
  result.status = "BLOCKED"; result.error = error.message;
  await page.screenshot({ path: path.join(out, `${phase}-${sample}-blocked.png`), timeout: 10000 }).catch(() => {});
} finally {
  await Promise.all(pending);
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  clearTimeout(deadline);
  await browser.close();
}
console.log(JSON.stringify({ phase, sample, status: result.status, durationMs: result.durationMs, rows: result.browserAtVisible?.creditTableRows, output }));
if (result.status !== "MEASURED") process.exitCode = 1;