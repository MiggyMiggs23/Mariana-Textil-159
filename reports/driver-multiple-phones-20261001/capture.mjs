// Browser-contract journey against the frozen candidate and synthetic loopback API only.
import http from "node:http";
import fs from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";

const dist = resolve("artifacts/mariana-textil/dist-driver-phones-20261001");
const out = resolve("reports/driver-multiple-phones-20261001/capturas");
await fs.access(join(dist, "index.html"));
await fs.mkdir(out, { recursive: true });
const legacy = { id: 1, nombreCompleto: "Chofer de prueba", telefono: "5550100001", activo: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
let row = { ...legacy };
const requests = [], writes = [], unexpected = [];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      let body = "";
      for await (const chunk of req) body += chunk;
      requests.push({ method: req.method, path: url.pathname });
      let payload;
      if (url.pathname === "/api/auth/me" && req.method === "GET") payload = {
        id: 1, nombre: "Usuario de prueba", usuario: "fixture-local", rol: "ADMIN",
        permisos: [{ modulo: "choferes", puedeVer: true, puedeCrear: true, puedeEditar: true }],
      };
      else if (url.pathname === "/api/e11/disponibilidad" && req.method === "GET") payload = {
        enabled: true, perfiles: true, conciliacion: true, preparacionE5: true,
      };
      else if (url.pathname === "/api/e11/identidad" && req.method === "GET") payload = {
        usuarioId: 1, rolBase: "ADMIN", perfil: null, perfilVersion: 1,
        permisosVersion: "fixture-local", capacidades: ["PERFILES_ADMINISTRAR"],
      };
      else if (url.pathname === "/api/choferes" && req.method === "GET") payload = [row];
      else if (req.method === "GET" && url.pathname === "/api/admin/test-reset") payload = { enabled: false, protectCustomers: true, preserves: [], clears: [], confirmation: "BORRAR" };
      else if (req.method === "GET" && url.pathname === "/api/notificaciones/feed") payload = { events: [], total: 0, cursor: null };
      else if (req.method === "GET" && url.pathname === "/api/notificaciones") payload = { sistema: [], notificaciones: [], totalNoLeidas: 0 };
      else if (req.method === "GET" && url.pathname === "/api/inventario/ajustes/pendientes") payload = [];
      else if (req.method === "GET" && url.pathname === "/api/inventario/entradas/pendientes-costo/count") payload = { count: 0 };
      else if (req.method === "GET" && url.pathname === "/api/etiquetas/alertas/count") payload = { count: 0, threshold: 3 };
      else if (url.pathname === "/api/choferes/1" && req.method === "PATCH") {
        const data = JSON.parse(body);
        writes.push({ method: req.method, path: url.pathname, data });
        row = { ...row, ...data, updatedAt: "2026-10-01T00:00:00Z" };
        payload = row;
      } else {
        unexpected.push(`${req.method} ${url.pathname}`);
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Missing synthetic fixture" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }
    const file = !extname(url.pathname) ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    assert(!file.includes(".."));
    const bytes = await fs.readFile(join(dist, file));
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(bytes);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-background-networking"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
  page.setDefaultTimeout(12000);
  page.on("console", msg => console.log("browser-console", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("browser-pageerror", err.message));
  page.on("requestfailed", req => console.log("request-failed", req.url(), req.failure()?.errorText));
  await page.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
  await page.goto(`${origin}/directorio/choferes`);
  console.log("initial-page", await page.title(), page.url(), (await page.locator("body").innerText()).slice(0, 1000), requests, unexpected);
  await page.getByRole("heading", { name: "Choferes" }).waitFor();
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).waitFor();
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).click();
  assert.equal(await page.getByTestId("input-chofer-telefono-0").inputValue(), "5550100001");
  for (let i = 1; i < 5; i++) {
    await page.getByTestId("button-agregar-chofer-telefono").click();
    await page.getByTestId(`input-chofer-telefono-${i}`).fill(`555010000${i + 1}`);
    await page.getByTestId(`input-chofer-etiqueta-${i}`).fill(["Personal", "Trabajo", "Casa", "Emergencia"][i - 1]);
  }
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).waitFor();
  assert.equal(writes.length, 1);
  const firstPhones = [
    { numero: "5550100001" }, { numero: "5550100002", etiqueta: "Personal" },
    { numero: "5550100003", etiqueta: "Trabajo" }, { numero: "5550100004", etiqueta: "Casa" },
    { numero: "5550100005", etiqueta: "Emergencia" },
  ];
  assert.deepEqual(writes[0], { method: "PATCH", path: "/api/choferes/1", data: {
    nombreCompleto: "Chofer de prueba", activo: true, telefono: "5550100001", telefonos: firstPhones,
  } });
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).click();
  for (let i = 0; i < 5; i++) {
    assert.equal(await page.getByTestId(`input-chofer-telefono-${i}`).inputValue(), `555010000${i + 1}`);
  }
  await page.evaluate(() => {
    const b = document.createElement("div");
    b.textContent = "EVIDENCIA VISUAL · DATOS DE PRUEBA · SIN LOGIN REAL NI BASE DE DATOS";
    Object.assign(b.style, { position: "fixed", top: "0", left: "0", right: "0", padding: "12px", background: "#fff0c2", color: "#513800", zIndex: "99999", textAlign: "center", font: "bold 16px sans-serif" });
    document.body.append(b);
  });
  await page.screenshot({ path: join(out, "ficha-varios-telefonos.png"), fullPage: true });
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByPlaceholder("Buscar por nombre o teléfono...").fill("5550100005");
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).waitFor();
  assert.equal(await page.getByText("5550100001", { exact: true }).count(), 2);
  assert.equal(await page.getByText("5550100005", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).click();
  await page.getByRole("button", { name: "Quitar teléfono 1" }).click();
  assert.equal(await page.getByTestId("input-chofer-telefono-0").inputValue(), "5550100002");
  assert.equal(await page.getByTestId("input-chofer-etiqueta-0").inputValue(), "Personal");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].data, {
    nombreCompleto: "Chofer de prueba", activo: true, telefono: "5550100002",
    telefonos: [
      { numero: "5550100002", etiqueta: "Personal" }, { numero: "5550100003", etiqueta: "Trabajo" },
      { numero: "5550100004", etiqueta: "Casa" }, { numero: "5550100005", etiqueta: "Emergencia" },
    ],
  });
  await page.getByRole("button", { name: "Editar Chofer de prueba" }).click();
  assert.equal(await page.getByTestId("input-chofer-telefono-0").inputValue(), "5550100002");
  assert.equal(await page.getByTestId("input-chofer-etiqueta-0").inputValue(), "Personal");
  for (let i = 1; i < 4; i++) assert.equal(await page.getByTestId(`input-chofer-etiqueta-${i}`).inputValue(), ["Trabajo", "Casa", "Emergencia"][i - 1]);
  assert.deepEqual(unexpected, []);
  await fs.writeFile(join(out, "assertions.json"), JSON.stringify({
    description: "Frozen candidate UI against a synthetic stateful loopback API; no real database or authentication.",
    dist, screenshot: "capturas/ficha-varios-telefonos.png", fixture: legacy,
    writes, persistedFinalState: row, requests, unexpected,
    assertions: [
      "Legacy one-phone fixture opened in edit; four labeled phones added for five total.",
      "PATCH used 5550100001 as telefono and sent the ordered complete telefonos array.",
      "Mock API persisted PATCH response; reopening displayed all five numbers.",
      "Searching secondary number 5550100005 retained the driver result; directory showed primary number only.",
      "Removing primary promoted 5550100002 with Personal label; PATCH contained all four remaining entries and exact new telefono.",
      "Reopened ficha retained promoted principal and all remaining labels.",
    ],
  }, null, 2));
  console.log(JSON.stringify({ result: "passed", out, requests, writes, screenshot: join(out, "ficha-varios-telefonos.png") }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}