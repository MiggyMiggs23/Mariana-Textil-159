// Usage: node capture.mjs before | pre-simplification | after [absolute-dist-directory]
// Private loopback HTTP fixture and isolated headless Chrome; never contacts live API.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { response, locations } from "./fixtures.mjs";

const root = resolve(import.meta.dirname, "../../../");
const report = import.meta.dirname;
const mode = process.argv[2];
const defaults = {
  before: join(root, "artifacts/mariana-textil/dist-clientes-lista-20260925"),
  "pre-simplification": join(report, "pre-simplification-dist"),
};
if (!["before", "pre-simplification", "after", "after-cruces-store"].includes(mode)) throw Error("Mode must be before, pre-simplification, after, after-cruces-store");
const dist = resolve(process.argv[3] || defaults[mode] || "");
if (!dist || (mode.startsWith("after") && !process.argv[3])) throw Error("Supply an explicitly built final dist directory for after captures");
const out = join(report, "screenshots", mode);
await mkdir(out, { recursive: true });
const unexpected = new Set();
const external = new Set();
const browserErrors = [];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const payload = req.method === "GET" ? response(url, { crucesStore: mode === "after-cruces-store" }) : undefined;
      res.writeHead(payload === undefined ? 404 : 200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      if (payload === undefined) unexpected.add(`${req.method} ${url.pathname}`);
      res.end(JSON.stringify(payload === undefined ? { error: `Fixture missing: ${req.method} ${url.pathname}` } : payload));
      return;
    }
    const file = url.pathname === "/" || !extname(url.pathname) ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    if (file.includes("..")) throw Error("Invalid path");
    const bytes = await readFile(join(dist, file));
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(bytes);
  } catch (error) {
    res.writeHead(404); res.end(String(error));
  }
});
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), "mariana-local-chromium-"));
const chrome = spawn("/repl/tools/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
  "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdpPortFile = join(profile, "DevToolsActivePort");
let debuggerPort;
for (let n = 0; n < 100; n++) {
  try { debuggerPort = Number((await readFile(cdpPortFile, "utf8")).split("\n")[0]); break; }
  catch { await sleep(100); }
}
if (!debuggerPort) throw Error("Private Chromium did not start");
const tab = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
let seq = 0;
const pending = new Map();
ws.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.method === "Runtime.exceptionThrown") {
    const text = String(data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text);
    browserErrors.push(text); console.error("BROWSER EXCEPTION", text.slice(0, 1200));
  }
  if (data.method === "Runtime.consoleAPICalled" && data.params?.type === "error") {
    const text = JSON.stringify(data.params.args.map(a => a.description || a.value));
    browserErrors.push(text); console.error("BROWSER CONSOLE", text.slice(0, 1400));
  }
  if (data.id && pending.has(data.id)) {
    const [ok, fail] = pending.get(data.id); pending.delete(data.id);
    data.error ? fail(Error(JSON.stringify(data.error))) : ok(data.result);
  }
};
const call = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++seq; pending.set(id, [ok, fail]); ws.send(JSON.stringify({ id, method, params }));
});
const js = async expression => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
  return result.result.value;
};
const click = async expression => {
  const rect = await js(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()`);
  if (!rect) return false;
  await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await sleep(350);
  return true;
};
const snap = async (name, fullPage = false) => {
  const body = await js("document.body.innerText.slice(0,15000)");
  if (!body || body.includes("Something went wrong") || body.includes("Iniciar sesión") || body.includes("Sin acceso") || body.length < 70) throw Error(`Refusing invalid screenshot ${name}: ${body?.slice(0,250)}`);
  const data = (await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage })).data;
  const file = join(out, `${name}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  console.log(`CAPTURE ${file} (${Buffer.from(data, "base64").length} bytes): ${body.replace(/\s+/g, " ").slice(0,170)}`);
};
const assertCreditOptions = async context => {
  const options = await js("[...document.querySelectorAll('[role=option]')].map(x=>x.innerText)");
  const missingStores = locations.slice(0, 3).filter(x => !options.some(y => y.includes(x.nombre)));
  const presentWarehouses = locations.slice(3).filter(x => options.some(y => y.includes(x.nombre)));
  if (!options.some(x => x.includes("Global")) || missingStores.length || presentWarehouses.length) throw Error(`${context} credit options invalid: ${JSON.stringify(options)}`);
};
const goto = async (path, heading) => {
  await call("Page.navigate", { url: `http://127.0.0.1:${port}${path}` });
  for (let i = 0; i < 65; i++) {
    await sleep(180);
    const ok = await js(`document.body.innerText.includes(${JSON.stringify(heading)}) && !document.body.innerText.includes("Something went wrong") && !document.body.innerText.includes("Iniciar sesión")`).catch(() => false);
    if (await js("document.body.innerText.includes('Something went wrong')").catch(() => false)) throw Error(`React error boundary at ${path}`);
    if (ok) { await sleep(650); return; }
  }
  throw Error(`Page failed to render ${path}: ${await js("document.body.innerText.slice(0,600)")}`);
};
await call("Page.enable");
await call("Runtime.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 1512, height: 1080, deviceScaleFactor: 1, mobile: false });
await call("Network.enable");
await call("Network.setBlockedURLs", { urls: ["https://fonts.googleapis.com/*", "https://fonts.gstatic.com/*"] });
try {
  const pages = mode === "before" ? [["clientes", "Clientes"], ["proveedores", "Proveedores"]] :
    mode === "after-cruces-store" ? [["clientes", "Clientes"]] :
    [["clientes", "Clientes"], ["proveedores", "Proveedores"], ["inventario", "Inventario"], ["entradas", "Entradas"], ["salidas", "Salidas"], ["viajes", "Viajes"], ["movimientos", "Movimientos"], ["cobros", "Cobros"], ["reportes", "Reportes"]];
  for (const [path, heading] of pages) {
    await goto(`/${path}`, heading);
    await snap(path);
    if (path === "clientes") {
      for (const [tab, suffix] of [["tab-cartera", "cartera"], ["tab-analysis", "analisis"]]) {
        if (await click(`document.querySelector('[data-testid="${tab}"]')`)) {
          await sleep(900); await snap(`clientes-${suffix}`);
          if (suffix === "cartera") {
            const labels = await js("document.body.innerText");
            if (mode === "before" && !labels.includes("Bodega Cruces")) throw Error("Frozen before cartera should expose legacy warehouse selector");
            if (mode !== "before" && locations.slice(3).some(x => labels.includes(x.nombre) && !(mode === "after-cruces-store" && x.id === 7))) throw Error("Credit cartera selector exposed a BODEGA");
            if (mode === "after-cruces-store" && !labels.includes("Bodega Cruces")) throw Error("Reclassified Cruces store absent from cartera");
            if (await click("document.querySelector('[data-testid=\"cartera-scope-selector\"] button, [aria-label=\"Sitio de cartera\"]')")) await snap("clientes-cartera-selector");
          } else {
            if (await click("document.querySelector('[data-testid=\"client-analytics-details\"] summary, details summary')")) await snap("clientes-analisis-expandido");
            await snap("clientes-analisis-pagina-completa", true);
          }
        }
      }
    }
    if (path === "proveedores") {
      const tabs = await js("[...document.querySelectorAll('[role=tab]')].map(e=>({text:e.innerText,value:e.getAttribute('data-state')}))");
      console.log("SUPPLIER TABS", JSON.stringify(tabs));
      for (const keyword of ["Análisis", "Finanzas"]) {
        if (await click(`[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes(${JSON.stringify(keyword)}))`)) {
          await sleep(800); await snap("proveedores-analisis");
          if (await click("document.querySelector('[data-testid=\"supplier-analytics-details\"] summary')")) await snap("proveedores-analisis-expandido");
          await snap("proveedores-analisis-pagina-completa", true);
          break;
        }
      }
      if (await click("[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('compras'))")) {
        await sleep(700);
        const historyText = await js("document.body.innerText");
        if (!historyText.includes("Bodega Tomás") || !historyText.includes("Lino")) throw Error("Supplier latest-purchases fixture did not render a real contract row");
        await snap("proveedores-ultimas-compras");
      }
    }
    if (["inventario", "entradas", "salidas", "viajes", "movimientos"].includes(path)) {
      if (await click("[...document.querySelectorAll('button[role=combobox]')].find(e=>e.textContent.includes('Vista Global') && e.getBoundingClientRect().width>30)")) {
        console.log("SITE SELECTOR", JSON.stringify(await js("[...document.querySelectorAll('button[role=combobox]')].map(e=>({text:e.innerText,state:e.getAttribute('data-state')}))")));
        const options = await js("[...document.querySelectorAll('[role=option]')].map(x=>x.innerText)");
        const missing = locations.filter(x => !options.some(y => y.includes(x.nombre)));
        if (missing.length) throw Error(`${path} missing active sites: ${missing.map(x => x.nombre).join(", ")}; options: ${options.join(" / ")}`);
        await snap(`${path}-sitios-abierto`);
        await click("[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.includes('Bodega Cruces'))");
        await snap(`${path}-bodega-cruces`);
      } else console.warn(`${path}: header selector not found`);
    }
    if (path === "reportes" && await click("[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('Clientes'))")) {
      await sleep(600); await snap("reportes-clientes-credito");
      if (await click("document.querySelector('[aria-label=\"Sitio de crédito\"]')")) { await assertCreditOptions("Reportes"); await snap("reportes-clientes-credito-selector"); }
    }
    if (path === "cobros" && await click("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Cartera / Estado de cuenta'))")) {
      await snap("cobros-cartera");
      if (await click("document.querySelector('[aria-label=\"Sitio de crédito\"]')")) { await assertCreditOptions("Cobros"); await snap("cobros-cartera-selector"); }
    }
  }
  if (mode !== "after-cruces-store") {
    if (mode !== "before") {
      await goto("/proveedores/12", "Hilados del Centro");
      const supplierText = await js("document.body.innerText");
      if (!supplierText.includes("5555555555") || !supplierText.includes("HCE250101AB1")) throw Error("Supplier details lost telephone or RFC");
      await snap("proveedor-ficha-telefono-rfc");
    } else console.log("Frozen clients-lista build has no full supplier contact detail; comparison uses pre-simplification vs final");
    await goto("/clientes/41", "Textiles Aurora");
    const detailText = await js("document.body.innerText");
    if (!detailText.includes("5512345678") || !detailText.includes("TAU250101AB1")) throw Error("Client details lost telephone or RFC");
    await snap("cliente-ficha-telefono-rfc");
    for (const [tab, name] of [["Últimas ventas", "cliente-ultimas-ventas"], ["Estado de cuenta", "cliente-estado-cuenta"]]) {
      if (!await click(`[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes(${JSON.stringify(tab)}))`)) {
        if (mode === "before") { console.log(`Frozen clients-lista build has no detail tab ${tab}; comparison uses pre-simplification vs final`); continue; }
        throw Error(`Missing client detail tab ${tab}`);
      }
      await sleep(700);
      const text = await js("document.body.innerText");
      if (text.includes("No se pudo cargar") || text.includes("Something went wrong")) throw Error(`Client detail failed ${tab}: ${text.slice(-650)}`);
      if (tab === "Últimas ventas") {
        if (!text.includes("725") || !text.includes("1,200")) throw Error(`Latest sale fixture failed to render: ${text.slice(-650)}`);
        const links = await js("[...document.querySelectorAll('a')].filter(e=>e.textContent.includes('725')).map(e=>({text:e.innerText,href:e.getAttribute('href')}))");
        if (!links.some(x => x.href === "/tickets/725")) throw Error(`Latest sale has no original ticket link: ${JSON.stringify(links)}`);
        console.log("LATEST SALE LINKS", JSON.stringify(links));
      }
      await snap(name);
      if (tab === "Últimas ventas") {
        await click("[...document.querySelectorAll('a')].find(e=>e.textContent.trim()==='725' && e.getAttribute('href')==='/tickets/725')");
        await sleep(700);
        const route = await js("location.pathname");
        if (route !== "/tickets/725") throw Error(`Latest-sale click failed to navigate: ${route}`);
        const ticketText = await js("document.body.innerText");
        if (ticketText.includes("Something went wrong") || ticketText.includes("Documento no encontrado") || ticketText.includes("No se pudo cargar")) throw Error(`Ticket document failed: ${ticketText.slice(0,450)}`);
        await snap("cliente-venta-documento-original");
        await goto("/clientes/41", "Textiles Aurora");
      }
    }
  }
  const manifest = { mode, dist, capturedAt: new Date().toISOString(), missingApiFixtures: [...unexpected], browserErrors, blockedExternal: [...external] };
  await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("MISSING API FIXTURES", JSON.stringify([...unexpected]));
  if (unexpected.size || browserErrors.length) throw Error(`Capture incomplete: ${unexpected.size} unstubbed API(s), ${browserErrors.length} browser error(s)`);
} catch (error) {
  console.error("CAPTURE FAILED", error);
  throw error;
} finally {
  ws.close(); chrome.kill("SIGTERM"); server.close();
  await new Promise(ok => chrome.once("exit", ok));
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}