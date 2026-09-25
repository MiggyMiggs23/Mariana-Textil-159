// MAIN runs sequentially: node .../browser.mjs credit|cut|account|collection 0|1|2
import fs from "node:fs";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";

const root = process.cwd(), out = `${root}/reports/continuacion-rollos-20260925/performance`;
const privateDir = `${root}/private.local/roll-return-continuation`;
const origin = "http://127.0.0.1:43937", apiOrigin = "http://127.0.0.1:43936";
const [kind, sampleText] = process.argv.slice(2), sample = Number(sampleText);
if (!["credit", "cut", "account", "collection"].includes(kind) || ![0, 1, 2].includes(sample) ||
    process.env.MAIN_APPROVED_ANNUAL_BROWSER !== "yes") throw Error("MAIN approval, operation and sample 0..2 required");
const ready = JSON.parse(fs.readFileSync(`${root}/reports/continuacion-rollos-20260925/preparation/ready.json`, "utf8"));
const env = fs.readFileSync(`/proc/${ready.apiPid}/environ`, "utf8").split("\0");
if (ready.testDatabase !== "continue_test" || ready.postgresPort !== 55536 ||
    ready.origin !== origin || ready.apiOrigin !== apiOrigin || ready.applicationRowsCopied !== false ||
    !env.includes("DATABASE_URL=postgresql://postgres@127.0.0.1:55536/continue_test") ||
    !env.includes("PORT=43936") ||
    env.some(entry => entry.startsWith("TEST_DATABASE_URL="))) throw Error("Private API provenance mismatch");
const f = JSON.parse(fs.readFileSync(`${privateDir}/annual-fixture.json`, "utf8"));
const credentials = JSON.parse(fs.readFileSync(`${privateDir}/annual-credentials.json`, "utf8"));
const seed = JSON.parse(fs.readFileSync(`${out}/seed-result.json`, "utf8"));
if (seed.identity?.db !== "continue_test" || seed.identity?.port !== 55536 ||
    seed.identity?.directory !== `${privateDir}/cluster` ||
    seed.fixture?.tickets !== 54750 || seed.fixture?.movements !== 13687 ||
    !f.sites?.[0]?.nombre?.startsWith("ROLL RETURN PERF ")) throw Error("Wrong/unseeded copy");
const annual = { desde: "2025-09-25", hasta: "2026-09-24" };
const account = kind === "collection" ? credentials.caja : credentials.admin;
if (!account?.username || !account?.password || account.username !== f.actors[kind === "collection" ? "caja" : "admin"].username) {
  throw Error("Missing synthetic private credentials");
}
const result = {
  kind, sample, ready: false, annual, origin, apiOrigin,
  definition: "Fresh browser process per sample. Login/site selection excluded; navigation, click, HTTP and browser render measured separately. HTTP timings are not SQL timings.",
  requests: [], errors: []
};
const save = () => fs.writeFileSync(`${out}/${kind}-${sample}.json`, JSON.stringify(result, null, 2));
let browser, page;
const watchdog = setTimeout(() => {
  result.error = "Hard 120-second deadline; no valid ready sample";
  save(); browser?.close().finally(() => process.exit(2));
  setTimeout(() => process.exit(2), 2000);
}, 120000);
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || "/repl/tools/bin/chromium",
    args: ["--no-sandbox"], timeout: 15000 });
  page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.setDefaultTimeout(35000);
  page.on("pageerror", e => result.errors.push(`page: ${e.message}`));
  page.on("requestfailed", r => result.errors.push(`request: ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`));
  // Deny any non-private network destination, including the normal application preview.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === origin || url.origin === apiOrigin ? route.continue() : route.abort();
  });
  const pending = new Map();
  page.on("response", response => {
    const u = new URL(response.url());
    if (u.pathname.startsWith("/api/")) {
      const entry = { path: u.pathname, query: u.search, status: response.status(),
        method: response.request().method(), contentLength: response.headers()["content-length"] ?? null,
        timing: response.request().timing() };
      result.requests.push(entry);
      pending.set(response.request(), entry);
    }
  });
  page.on("requestfinished", request => {
    const entry = pending.get(request);
    if (entry) { entry.timing = request.timing(); pending.delete(request); }
  });
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Usuario", { exact: true }).fill(account.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(u => u.origin === origin && !u.pathname.includes("/login"));
  if (kind === "cut") {
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: f.sites[0].nombre, exact: true }).click();
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics
    .filter(m => ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "Nodes", "JSHeapUsedSize"].includes(m.name))
    .map(m => [m.name, m.value]));
  const before = await metrics(), start = performance.now();
  if (kind === "credit") {
    const params = new URLSearchParams({ periodo: "personalizado", ...annual });
    await page.goto(`${origin}/reportes/clientes?${params}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("filter-desde").waitFor();
    const visible = await page.evaluate(() => ({
      desde: document.querySelector('[data-testid="filter-desde"]')?.value,
      hasta: document.querySelector('[data-testid="filter-hasta"]')?.value,
      periodo: document.querySelector('[data-testid="filter-periodo"]')?.textContent?.trim(),
      rangeBadge: document.querySelector('[data-testid="combined-filter-bar"]')?.textContent?.includes("2025-09-25 - 2026-09-24")
    }));
    result.visibleRange = visible;
    if (visible.desde !== annual.desde || visible.hasta !== annual.hasta ||
        !visible.periodo?.includes("Personalizado") || !visible.rangeBadge) throw Error("365-day range not visibly selected");
    await page.getByTestId("report-content-clientes").waitFor();
    await page.getByTestId("report-content-pagos-dirigidos").waitFor();
  } else if (kind === "account") {
    await page.goto(`${origin}/clientes/${f.customer.id}`, { waitUntil: "domcontentloaded" });
    const click = performance.now();
    await page.getByRole("tab", { name: "Estado de cuenta", exact: true }).click();
    await page.getByTestId("e7-client-export").waitFor();
    await page.getByTestId("e7-movements").last().waitFor();
    result.clickReadyMs = performance.now() - click;
  } else {
    const ticket = seed.collectionTickets[sample];
    await page.goto(`${origin}${kind === "collection" ? `/cobros?tab=cartera&ticketId=${ticket.id}` : "/cobros"}`,
      { waitUntil: "domcontentloaded" });
    if (kind === "cut") {
      const caja = page.getByRole("button", { name: "Caja", exact: true });
      if (await caja.count()) await caja.click();
      await page.getByRole("heading", { name: "Caja Operativa", exact: true }).waitFor();
      result.preClickReadyMs = performance.now() - start;
      const click = performance.now();
      await page.getByRole("button", { name: "Realizar Corte", exact: true }).click();
      await page.getByRole("heading", { name: "Corte y Cierre de Caja", exact: true }).waitFor();
      await page.getByRole("dialog").getByText("Efectivo Esperado:", { exact: true }).waitFor();
      result.clickReadyMs = performance.now() - click;
    } else {
      const pay = page.getByText(`Ticket folio ${ticket.folio}`, { exact: true })
        .locator("xpath=../../..").getByRole("button", { name: "Cobrar", exact: true });
      await pay.click();
      await page.getByRole("button", { name: "Confirmar Pago", exact: true }).waitFor();
      await page.getByRole("button", { name: "Efectivo", exact: true }).click();
      result.preClickReadyMs = performance.now() - start;
      const click = performance.now();
      await page.getByRole("button", { name: "Confirmar Pago", exact: true }).click();
      await page.getByText("Ticket cobrado exitosamente", { exact: true }).waitFor();
      result.clickReadyMs = performance.now() - click;
      result.collectionTicket = ticket;
    }
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  result.routeReadyMs = performance.now() - start;
  const after = await metrics();
  result.render = Object.fromEntries(Object.entries(after).map(([key, value]) =>
    [key, { value, delta: value - (before[key] ?? 0) }]));
  result.http = result.requests.filter(r => r.path.startsWith("/api/")).map(r => ({
    path: r.path, query: r.query, status: r.status, bytesHeader: r.contentLength,
    ttfbMs: r.timing?.responseStart >= 0 ? r.timing.responseStart : null,
    responseMs: r.timing?.responseEnd >= 0 ? r.timing.responseEnd : null
  }));
  if (result.errors.length || result.http.some(r => r.status >= 400)) throw Error("Browser/API errors; sample invalid");
  result.ready = true;
} catch (e) {
  result.error = e.message;
  // Never call body.innerText(), locator count on giant reports, or take huge DOM snapshots.
} finally {
  save();
  clearTimeout(watchdog);
  await browser?.close();
}
console.log(JSON.stringify({ kind, sample, ready: result.ready, routeReadyMs: result.routeReadyMs,
  clickReadyMs: result.clickReadyMs, error: result.error }));
if (!result.ready) process.exitCode = 1;