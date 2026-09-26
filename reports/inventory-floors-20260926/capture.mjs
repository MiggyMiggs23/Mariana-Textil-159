import http from "node:http";
import fs from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
import { response as commonResponse } from "../directorios-sitios-20260925/browser-local/fixtures.mjs";

const dist = resolve(process.argv[2] || "reports/print-corrections-20260926/labels/frozen-root/artifacts/mariana-textil/dist-inventory-floors-20260926");
const out = resolve("reports/inventory-floors-20260926/capturas");
await fs.mkdir(out, { recursive: true });
const sites = [
  { id: 901, nombre: "Sitio Alfa (fixture)", iniciales: "FA", tipo: "TIENDA", activa: true },
  { id: 902, nombre: "Sitio Beta (fixture)", iniciales: "FB", tipo: "BODEGA", activa: true },
];
const specs = [
  ["METRO", "Azul", [[901, 1, "Planta baja", 12.5], [901, 2, "Piso 1", 7.5], [902, 3, "Planta baja", 5]]],
  ["KILO", "Gris", [[901, 1, "Planta baja", 3.25]]],
  ["BOLSA", "Blanco", [[901, null, null, 4]]],
  ["PIEZA", "Rojo", [[902, 3, "Planta baja", 6]]],
];
const groups = specs.map(([unidad, color, entries], index) => {
  const ubicaciones = entries.map(([ubicacionId, pisoId, nombrePiso, qty]) => ({
    ubicacionId, nombreUbicacion: sites.find(s => s.id === ubicacionId).nombre,
    pisoId, nombrePiso, rollosCount: 1, cantidadTotal: String(qty), unidad,
  }));
  const total = entries.reduce((sum, e) => sum + e[3], 0);
  return {
    productoKey: `fixture-${index}`, telaProducto: ["Lino", "Felpa", "Retazos", "Paños"][index],
    coloresCount: 1, rollosCount: entries.length,
    totalMetros: unidad === "METRO" ? String(total) : "0",
    totalKilos: unidad === "KILO" ? String(total) : "0",
    totalBolsas: unidad === "BOLSA" ? String(total) : "0",
    totalPiezas: unidad === "PIEZA" ? String(total) : "0",
    colores: [{ productoId: 990 + index, color, sku: `FIX-${unidad}`, unidad, cantidadTotal: String(total), rollosCount: entries.length, ubicaciones }],
  };
});
let id = 9900;
const rollos = groups.flatMap(g => g.colores.flatMap(c => c.ubicaciones.map(l => ({
  id: ++id, serie: `FIX-${id}`, productoId: c.productoId, telaProducto: g.telaProducto,
  colorProducto: c.color, sku: c.sku, unidad: c.unidad, estado: "DISPONIBLE",
  ubicacionId: l.ubicacionId, nombreUbicacion: l.nombreUbicacion, pisoId: l.pisoId,
  nombrePiso: l.nombrePiso, cantidadActual: l.cantidadTotal, cantidadInicial: l.cantidadTotal,
}))));
const expected = { METRO: 25, KILO: 3.25, BOLSA: 4, PIEZA: 6 };
for (const [unit, qty] of Object.entries(expected)) {
  assert.equal(rollos.filter(r => r.unidad === unit).reduce((sum, r) => sum + Number(r.cantidadActual), 0), qty);
}
const requests = [];
const unexpected = [];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      requests.push(`${req.method} ${url.pathname}`);
      assert.equal(req.method, "GET", "No mutations allowed");
      let payload;
      if (url.pathname === "/api/auth/me") payload = { ...commonResponse(url), nombre: "Fixture sintético — sin BD", ubicacion: sites[0] };
      else if (url.pathname === "/api/locations") payload = sites;
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
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(await fs.readFile(join(dist, file)));
  } catch (e) { res.end(String(e)); }
});
await fs.access(join(dist, "index.html"));
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-background-networking"] });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1500 } });
  await page.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
  await page.goto(`${origin}/inventario`);
  await page.getByRole("heading", { name: "Control de Inventario" }).waitFor();
  await page.getByRole("button", { name: "Expandir todos", exact: true }).click();
  const totalsBefore = await page.locator("tfoot").innerText();
  const parentsBefore = await page.locator('[data-testid^="group-"]').allTextContents();
  await page.getByRole("button", { name: "Expandir ubicaciones de Azul", exact: true }).click();
  assert.equal(await page.locator("tfoot").innerText(), totalsBefore);
  assert.deepEqual(await page.locator('[data-testid^="group-"]').allTextContents(), parentsBefore);
  assert.equal(await page.getByText("Por ubicación", { exact: true }).count(), 3);
  for (const g of groups) {
    const cells = await page.locator(`[data-testid="group-${g.productoKey}"] td`).allTextContents();
    const unitIndex = ["METRO", "KILO", "BOLSA", "PIEZA"].indexOf(g.colores[0].unidad);
    assert.equal(Number(cells[5 + unitIndex].replace(/,/g, "")), expected[g.colores[0].unidad]);
    const child = page.locator("tr").filter({ has: page.getByText(g.colores[0].sku, { exact: true }) });
    assert((await child.innerText()).includes(String(expected[g.colores[0].unidad])));
  }
  const footer = await page.locator("tfoot td").allTextContents();
  for (let i = 0; i < 4; i++) assert.equal(Number(footer[footer.length - 4 + i].replace(/,/g, "")), Object.values(expected)[i]);
  await page.evaluate(() => {
    const banner = document.createElement("div");
    banner.textContent = "EVIDENCIA VISUAL · FIXTURE SINTÉTICO · SIN BASE DE DATOS · 25 METRO / 3.25 KILO / 4 BOLSA / 6 PIEZA";
    Object.assign(banner.style, { position: "fixed", bottom: "0", left: "0", right: "0", padding: "10px", background: "#fff4ca", color: "#513800", zIndex: "99999", textAlign: "center", font: "bold 16px sans-serif" });
    document.body.append(banner);
  });
  await page.screenshot({ path: join(out, "01-agrupado-global-fixture.png"), fullPage: true });
  const groupedText = await page.locator("main").innerText();
  await page.getByRole("tab", { name: "Detalle de Rollos" }).click();
  await page.getByText("FIX-9901", { exact: true }).waitFor();
  assert.equal(await page.getByText(/^Piso:/).count(), 6);
  assert.equal(await page.getByText("Piso: Sin piso", { exact: true }).count(), 1);
  await page.screenshot({ path: join(out, "02-detalle-rollos-fixture.png"), fullPage: true });
  assert.deepEqual(unexpected, []);
  await fs.writeFile(join(out, "descripcion-y-aserciones.json"), JSON.stringify({
    descripcion: "Aplicación real compilada candidata; datos íntegramente sintéticos servidos por HTTP loopback. Sin login, secretos ni acceso a base de datos. Banner añadido únicamente a DOM de captura.",
    dist, viewport: { width: 1800, height: 1500 }, expected, groups, rollos,
    assertions: ["Totales de fixture por unidad = sumas de rollos", "Totales de padres y pie de tabla coinciden por unidad", "Totales de colores coinciden", "Expandir no cambia padres ni pie", "Azul se desglosa en 3 filas: dos pisos de Alfa y Planta baja de Beta", "Gris y Rojo: piso único; Blanco: Sin piso", "Seis campos Piso en tarjetas, uno Sin piso", "Ninguna solicitud API inesperada; solo GET; tráfico externo bloqueado"],
    groupedText, detailText: await page.locator("main").innerText(), requests, unexpected,
  }, null, 2));
  console.log(JSON.stringify({ out, expected, screenshots: 2, assertions: "passed" }));
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}