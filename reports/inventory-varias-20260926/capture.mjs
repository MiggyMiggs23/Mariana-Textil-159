// Adapted from reports/inventory-floors-20260926/capture.mjs.
// Real candidate UI, isolated synthetic GET-only HTTP fixtures; no managed API or DB.
import http from "node:http";
import fs from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
import { response as commonResponse } from "../directorios-sitios-20260925/browser-local/fixtures.mjs";

const dist = resolve(process.argv[2] || "artifacts/mariana-textil/dist-inventory-varias-20260926");
const out = resolve("reports/inventory-varias-20260926/capturas");
await fs.mkdir(out, { recursive: true });
const sites = [{ id: 901, nombre: "Bodega Cruces", iniciales: "BC", tipo: "BODEGA", activa: true }];
const makeLocation = (pisoId, nombrePiso, cantidadTotal) => ({
  ubicacionId: 901, nombreUbicacion: "Bodega Cruces", pisoId, nombrePiso,
  rollosCount: 1, cantidadTotal: String(cantidadTotal), unidad: "METRO",
});
const groups = [{
  productoKey: "fixture-licra-metalica", telaProducto: "Licra Metálica",
  coloresCount: 2, rollosCount: 3, totalMetros: "32.5",
  totalKilos: "0", totalBolsas: "0", totalPiezas: "0",
  colores: [
    { productoId: 990, color: "Plata", sku: "FIX-LM-PLATA", unidad: "METRO", cantidadTotal: "25", rollosCount: 2,
      ubicaciones: [makeLocation(9011, "Alta", 12.5), makeLocation(9012, "Baja", 12.5)] },
    { productoId: 991, color: "Dorado", sku: "FIX-LM-DORADO", unidad: "METRO", cantidadTotal: "7.5", rollosCount: 1,
      ubicaciones: [makeLocation(9012, "Baja", 7.5)] },
  ],
}];
let id = 9900;
const rollos = groups.flatMap(g => g.colores.flatMap(c => c.ubicaciones.map(l => ({
  id: ++id, serie: `FIX-${id}`, productoId: c.productoId, telaProducto: g.telaProducto,
  colorProducto: c.color, sku: c.sku, unidad: c.unidad, estado: "DISPONIBLE",
  ubicacionId: l.ubicacionId, nombreUbicacion: l.nombreUbicacion,
  pisoId: l.pisoId, nombrePiso: l.nombrePiso,
  cantidadActual: l.cantidadTotal, cantidadInicial: l.cantidadTotal,
}))));
assert.equal(rollos.length, 3);
assert.equal(rollos.reduce((sum, r) => sum + Number(r.cantidadActual), 0), 32.5);
const requests = [];
const unexpected = [];
const forbidden = [];
const servedAssets = new Map();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      requests.push(`${req.method} ${url.pathname}`);
      if (req.method !== "GET") {
        forbidden.push(`${req.method} ${url.pathname}`);
        res.writeHead(405);
        res.end("Read-only fixture server: mutations forbidden");
        return;
      }
      let payload;
      if (url.pathname === "/api/auth/me") payload = { ...commonResponse(url), nombre: "Fixture sintético — sin BD", ubicacion: sites[0] };
      else if (url.pathname === "/api/locations" || url.pathname === "/api/inventario/ubicaciones") payload = sites;
      else if (/existencias.*agrupadas/.test(url.pathname)) payload = groups;
      else if (url.pathname === "/api/inventario/rollos") payload = { items: rollos, total: rollos.length, page: 1, pageSize: 100 };
      else payload = commonResponse(url);
      if (payload === undefined) unexpected.push(url.pathname);
      res.writeHead(payload === undefined ? 404 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload ?? { error: `Missing fixture ${url.pathname}` }));
      return;
    }
    const file = !extname(url.pathname) ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    assert(!file.includes(".."));
    const bytes = await fs.readFile(join(dist, file));
    servedAssets.set(file, createHash("sha256").update(bytes).digest("hex"));
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(bytes);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(error));
  }
});
await fs.access(join(dist, "index.html"));
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-background-networking"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  page.setDefaultTimeout(20000);
  await page.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
  await page.goto(`${origin}/inventario`);
  await page.getByRole("heading", { name: "Control de Inventario" }).waitFor();
  const parent = page.locator('[data-testid="group-fixture-licra-metalica"]');
  await parent.waitFor();
  await page.locator("thead").getByText("Sitio", { exact: true }).waitFor();
  assert.equal((await parent.locator("td").nth(3).innerText()).trim(), "Varias");
  assert.equal(await page.getByText("FIX-LM-PLATA", { exact: true }).count(), 0);
  const footerBefore = await page.locator("tfoot").innerText();
  const parentBefore = await parent.innerText();
  const collapsedText = await page.locator("main").innerText();
  await page.evaluate(() => {
    const banner = document.createElement("div");
    banner.textContent = "EVIDENCIA VISUAL · DATOS SINTÉTICOS (FIXTURE HTTP) · SIN LOGIN REAL NI BASE DE DATOS";
    Object.assign(banner.style, { position: "fixed", bottom: "0", left: "0", right: "0", padding: "10px", background: "#fff4ca", color: "#513800", zIndex: "99999", textAlign: "center", font: "bold 14px sans-serif" });
    document.body.append(banner);
  });
  await page.screenshot({ path: join(out, "01-contraido.png"), fullPage: true });
  await parent.click();
  const multi = page.locator("tr").filter({ has: page.getByText("FIX-LM-PLATA", { exact: true }) });
  const single = page.locator("tr").filter({ has: page.getByText("FIX-LM-DORADO", { exact: true }) });
  await multi.waitFor();
  assert.equal((await multi.locator("td").nth(3).innerText()).trim(), "Varias");
  assert.equal(await multi.locator("td").nth(3).getAttribute("title"), "Varias");
  assert.equal((await single.locator("td").nth(3).innerText()).trim(), "Bodega Cruces · Baja");
  assert.equal(await single.getByRole("button").count(), 0);
  assert.equal(await page.getByText("Por ubicación", { exact: true }).count(), 0);
  assert.equal(await page.locator("tfoot").innerText(), footerBefore);
  assert.equal(await parent.innerText(), parentBefore);
  const expandedText = await page.locator("main").innerText();
  await page.screenshot({ path: join(out, "02-desplegado.png"), fullPage: true });
  await page.getByRole("button", { name: "Expandir ubicaciones de Plata", exact: true }).click();
  const detailRows = page.locator("tr").filter({ has: page.getByText("Por ubicación", { exact: true }) });
  assert.equal(await detailRows.count(), 2);
  const detailCells = [];
  for (let i = 0; i < 2; i++) {
    const cells = (await detailRows.nth(i).locator("td").allTextContents()).map(s => s.trim());
    detailCells.push(cells);
    assert.equal(cells[2], "Bodega Cruces");
    assert.equal(cells[3], `Bodega Cruces · ${i === 0 ? "Alta" : "Baja"}`);
    assert.equal(Number(cells[4]), 1);
    assert.equal(Number(cells[5]), 12.5);
    assert.equal(cells[6], "-");
  }
  assert.equal((await multi.locator("td").nth(3).innerText()).trim(), "Varias");
  assert.equal((await single.locator("td").nth(3).innerText()).trim(), "Bodega Cruces · Baja");
  assert.equal(await parent.innerText(), parentBefore);
  assert.equal(await page.locator("tfoot").innerText(), footerBefore);
  assert.equal(Number(await parent.locator("td").nth(4).innerText()), 3);
  assert.equal(Number(await parent.locator("td").nth(5).innerText()), 32.5);
  await page.screenshot({ path: join(out, "03-desglose.png"), fullPage: true });
  const detailText = await page.locator("main").innerText();
  await page.getByRole("button", { name: "Contraer ubicaciones de Plata", exact: true }).click();
  assert.equal(await detailRows.count(), 0);
  assert.equal((await multi.locator("td").nth(3).innerText()).trim(), "Varias");
  assert.deepEqual(unexpected, []);
  assert.deepEqual(forbidden, []);
  await fs.writeFile(join(out, "descripcion-y-aserciones.json"), JSON.stringify({
    descripcion: "Aplicación real compilada candidata; datos íntegramente sintéticos servidos por HTTP loopback. Sin login real, secretos ni acceso a base de datos. Banner añadido únicamente al DOM de captura.",
    dist, viewport: { width: 1600, height: 1050 }, groups, rollos,
    assertions: [
      "Producto contraído: Ubicación exactamente Varias, sin lista ni contador",
      "Producto expandido: Plata exactamente Varias, incluido title; ningún desglose hasta pulsar el color",
      "Dorado conserva exactamente Bodega Cruces · Baja y no tiene botón de expansión",
      "Plata expandido: Alta y Baja, 1 rollo y 12.5 METRO cada piso; cantidades consistentes con fixtures",
      "Resúmenes, total padre de 3 rollos/32.5 METRO y pie no cambian al expandir",
      "Color se puede contraer y vuelve a ocultar ambos pisos manteniendo Varias",
      "Ninguna solicitud API inesperada; solo GET; tráfico externo bloqueado",
    ],
    collapsedText, expandedText, detailText, detailCells, footerBefore,
    requests, unexpected, forbidden, servedAssets: Object.fromEntries(servedAssets),
  }, null, 2));
  console.log(JSON.stringify({ out, screenshots: 3, assertions: "passed", requests: requests.length }));
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}