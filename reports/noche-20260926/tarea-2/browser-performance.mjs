import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const phase = process.argv[2], operation = process.argv[3], sample = process.argv[4] || "1";
if (!["before", "after"].includes(phase) || !["list", "search", "account", "payment", "cut", "credit"].includes(operation) || !/^\d+$/.test(sample))
  throw Error("Usage: browser-performance.mjs before|after list|search|account|payment|cut|credit sample");
const root = new URL("./", import.meta.url);
const ready = JSON.parse(fs.readFileSync(new URL("./private-ready.json", root)));
const load = JSON.parse(fs.readFileSync(new URL("./load-results.json", root)));
if (ready.database !== "noche_20260926" || ready.url !== "http://127.0.0.1:18228" || load.status !== "LOADED")
  throw Error("Ready annual disposable required");
const origin = ready.url;
const credentials = JSON.parse(fs.readFileSync("/tmp/noche-20260926/credentials.json")).admin;
const paymentFixture = operation === "payment"
  ? JSON.parse(fs.readFileSync("/tmp/noche-20260926/payment-input-fresh.json"))[phase]?.[Number(sample) - 1] : null;
const out = new URL(operation === "payment" ? "./payment-fresh/" : "./measurements/", root); fs.mkdirSync(out, { recursive: true });
const candidate = JSON.parse(fs.readFileSync(new URL("./candidate.json", root)));
if (crypto.createHash("sha256").update(fs.readFileSync(candidate.apiEntry)).digest("hex") !== ready.apiSha256)
  throw Error("API fingerprint mismatch");
const result = { phase, operation, sample, status: "RUNNING", thresholdMs: operation === "credit" ? 3000 : 2000,
  definition: "Fresh browser and real login per sample; login/site selection excluded. User action until visible data ready plus two animation frames. No SQL latency substitution.",
  apiSha256: ready.apiSha256, frontendIndexSha256: candidate.frontendFiles["index.html"],
  paymentCohortsNotIndexComparison: operation === "payment", requests: [], errors: [] };
const save = () => fs.writeFileSync(new URL(`${phase}-${operation}-${sample}.json`, out), JSON.stringify(result, null, 2));
let browser, page;
try {
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  page = await browser.newPage({ viewport: { width: 1360, height: 1000 } }); page.setDefaultTimeout(30000);
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page.on("pageerror", e => result.errors.push(e.message));
  page.on("response", r => { if (r.url().startsWith(`${origin}/api/`)) result.requests.push({
    path: new URL(r.url()).pathname, query: new URL(r.url()).search, status: r.status(), method: r.request().method(),
  }); });
  result.network = [];
  page.on("requestfinished", r => { if (r.url().startsWith(`${origin}/api/`)) result.network.push({
    path: new URL(r.url()).pathname, timing: r.timing(),
  }); });
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Usuario", { exact: true }).fill(credentials.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(u => !u.pathname.includes("login"));
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: load.sites[0].nombre, exact: true }).click();
  let start;
  const tableReady = async () => {
    await page.locator('table[aria-busy="false"]').waitFor();
    await page.locator('a[href^="/clientes/"]').first().waitFor();
  };
  if (operation === "list") {
    start = performance.now();
    await page.getByRole("link", { name: "Clientes", exact: true }).click();
    await tableReady();
  } else if (operation === "search") {
    await page.goto(`${origin}/clientes`, { waitUntil: "domcontentloaded" }); await tableReady();
    // Existing customer name obtained from the rendered directory, not fabricated search data.
    const text = (await page.locator('a[href^="/clientes/"]').first().innerText()).trim();
    result.searchTextLength = text.length;
    start = performance.now();
    const response = page.waitForResponse(r => r.url().includes("/api/clientes") && [...new URL(r.url()).searchParams.values()].includes(text));
    await page.getByTestId("input-search-clients").fill(text);
    await response; await tableReady();
  } else if (operation === "account") {
    await page.goto(`${origin}/clientes/${load.customerId}`, { waitUntil: "domcontentloaded" });
    const tab = page.getByRole("tab", { name: "Estado de cuenta", exact: true }); await tab.waitFor();
    start = performance.now(); await tab.click();
    await page.getByTestId("e7-client-export").waitFor(); await page.getByTestId("e7-movements").last().waitFor();
  } else if (operation === "credit") {
    result.visibleRange = { start: load.assumptions.start, end: load.end };
    start = performance.now();
    await page.goto(`${origin}/reportes/clientes?periodo=personalizado&desde=${load.assumptions.start}&hasta=${load.end}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("report-content-clientes").waitFor();
  } else if (operation === "cut") {
    await page.goto(`${origin}/cobros`, { waitUntil: "domcontentloaded" });
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: load.sites[0].nombre, exact: true }).click();
    const caja = page.getByRole("button", { name: "Caja", exact: true }); if (await caja.count()) await caja.click();
    await page.getByRole("heading", { name: "Caja Operativa", exact: true }).waitFor();
    start = performance.now(); await page.getByRole("button", { name: "Realizar Corte", exact: true }).click();
    await page.getByRole("heading", { name: "Corte y Cierre de Caja", exact: true }).waitFor();
    await page.getByRole("dialog").getByText("Efectivo Esperado:", { exact: true }).waitFor();
    result.definition += " Cut measures ready closure dialog, not irreversible close.";
  } else {
    // MAIN/flow worker must supply freshly created native, fully traced tickets.
    // Never replay a previously collected ticket or use bulk SQL load rolls to prove producer correctness.
    const ticket = paymentFixture;
    if (!ticket?.id || !ticket?.folio || !ticket?.nativeProvenance) throw Error("Fresh native payment fixture missing");
    await page.goto(`${origin}/cobros`, { waitUntil: "domcontentloaded" });
    await page.getByRole("combobox").first().click();
    if (ticket.ubicacionId !== load.sites[0].id) throw Error("Native payment site mismatch");
    await page.getByRole("option", { name: load.sites[0].nombre, exact: true }).click();
    await page.getByText(`Ticket folio ${ticket.folio}`, { exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Cobrar']][1]")
      .getByRole("button", { name: "Cobrar", exact: true }).click();
    await page.getByRole("button", { name: "Efectivo", exact: true }).click();
    start = performance.now();
    const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().includes("/cobrar"));
    await page.getByRole("button", { name: "Confirmar Pago", exact: true }).click();
    result.paymentStatus = (await response).status();
    await page.getByText("Ticket cobrado exitosamente", { exact: true }).waitFor();
    result.ticketId = ticket.id;
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  result.durationMs = performance.now() - start;
  result.status = result.durationMs <= result.thresholdMs ? "PASS" : "SLOW";
  if (result.errors.length || result.requests.some(r => r.status >= 500)) result.status = "ERROR";
  await page.screenshot({ path: new URL(`${phase}-${operation}-${sample}.png`, out).pathname });
} catch (error) {
  result.status = "BLOCKED"; result.error = error.message;
  if (page) await page.screenshot({ path: new URL(`${phase}-${operation}-${sample}-blocked.png`, out).pathname }).catch(() => {});
} finally {
  save(); await browser?.close();
}
console.log(JSON.stringify({ operation, phase, sample, status: result.status, durationMs: result.durationMs, error: result.error }));