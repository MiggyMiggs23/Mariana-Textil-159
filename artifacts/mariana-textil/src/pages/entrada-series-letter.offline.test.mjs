/**
 * Isolated actual-component/native Chromium PDF fixture; no app server, API,
 * authentication, database or workflow. Uses the active frozen UI CSS/deps.
 * Diagnostic print-state test, not a physical-printer or print-dialog test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launchChromium, createPage, closePage, evaluate, extractPdf,
  findRasterTool } from "./laser-documents-pdf-regression.test.mjs";

const root = process.cwd();
const app = "artifacts/mariana-textil";
const frozen = path.join(root, "reports/inventory-floors-20260926/frozen-root");
const out = path.join(root, "reports/floor-level-and-letter-20260926/print");
fs.mkdirSync(out, { recursive: true });
const { build } = await import(path.join(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/lib/main.js"));
const sourcePath = `${app}/src/pages/entrada-documento.tsx`;
const before = fs.readFileSync(path.join(frozen, sourcePath), "utf8");
const after = fs.readFileSync(path.join(root, sourcePath), "utf8");
const cssFile = fs.readdirSync(path.join(root, app, "dist-inventory-floors-20260926/assets")).find(f => f.endsWith(".css"));
const baselineCss = fs.readFileSync(path.join(root, app, "dist-inventory-floors-20260926/assets", cssFile), "utf8");
const currentCss = fs.readFileSync(path.join(root, app, "src/index.css"), "utf8");
const scopedCss = currentCss.match(/\/\* Standalone Entrada series: Letter geometry[\s\S]*?\/\* End standalone Entrada series \*\//)?.[0] ?? "";
// Cache the same real Inter weights requested by the application's index.html.
const fontCssPath = path.join(out, "inter-inline.css");
if (!fs.existsSync(fontCssPath)) {
  let css = execFileSync("curl", ["--fail", "-Ls", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"], { encoding: "utf8" });
  for (const url of new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]))) {
    const data = execFileSync("curl", ["--fail", "-Ls", url]);
    css = css.replaceAll(url, `data:font/ttf;base64,${data.toString("base64")}`);
  }
  fs.writeFileSync(fontCssPath, css);
}
const fonts = fs.readFileSync(fontCssPath, "utf8");
function fixture(counts) {
  let serial = 1000000;
  const lineas = counts.map((count, i) => ({
    productoId: i + 1, telaProducto: "Algodón fixture", colorProducto: "Azul",
    skuProducto: `SKU-${i + 1}`, rollosCount: count, cantidadTotal: String(count),
    unidadProducto: "METRO", pisoEntrada: "Primer piso",
  }));
  return { id: 1, folioFormateado: "QA-SERIES", createdAt: "2026-09-26T12:00:00Z",
    nombreUsuario: "Fixture sin persistencia", nombreProveedor: "Proveedor fixture",
    nombreUbicacion: "Sitio fixture", observaciones: "Diagnóstico aislado",
    lineas, rollos: counts.flatMap((count, i) => Array.from({ length: count }, () =>
      ({ productoId: i + 1, serie: String(++serial) }))) };
}
async function bundle(source) {
  const result = await build({
    stdin: { contents: `import React from "react";import{createRoot}from"react-dom/client";import Entrada from"fixture-component";createRoot(document.getElementById("root")).render(<Entrada/>);`,
      resolveDir: path.join(frozen, app), loader: "tsx" },
    bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "import.meta.env.BASE_URL": '"/"' },
    alias: { "@": path.join(frozen, app, "src") }, loader: { ".png": "dataurl" },
    plugins: [{ name: "isolated-entry-fixture", setup(b) {
      b.onResolve({ filter: /^fixture-component$/ }, () => ({ path: "component", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: source, loader: "tsx", resolveDir: path.join(frozen, app, "src/pages") }));
      b.onResolve({ filter: /^(@workspace\/api-client-react|wouter)$/ }, args => ({ path: args.path, namespace: "fixture-data" }));
      b.onLoad({ filter: /.*/, namespace: "fixture-data" }, args => ({ contents: args.path === "wouter" ?
        `export const useParams=()=>({id:"1"});` :
        `export const useGetEntrada=()=>({data:window.__fixture,isLoading:false});export const getGetEntradaQueryKey=()=>["fixture"];` }));
    }}],
  });
  return result.outputFiles[0].text;
}
const browser = await launchChromium();
const rasterTool = findRasterTool();
assert.ok(rasterTool, "ImageMagick required for physical ink-bound verification");
const report = { status: "RUNNING", fixtureOnly: true, databaseAccess: false, browser: browser.browserVersion, scenarios: [] };
try {
  const variants = [
    ["before", before, ""],
    ["after", after, scopedCss],
    ["probe39", before.replace("const seriesRowsPerPage = 22;", "const seriesRowsPerPage = 39;"), scopedCss],
  ];
  for (const [variant, source, extraCss] of variants) {
    const js = await bundle(source);
    const scenarios = variant === "probe39" ? [[156]] : [[88], [89], [152], [153], [1, 148], [1, 149], [4]];
    for (const counts of scenarios) {
      const data = fixture(counts);
      const name = `${variant}-${counts.join("-")}`;
      const page = await createPage(browser);
      try {
        page.cdp.on("Fetch.requestPaused", params => void page.cdp.call("Fetch.fulfillRequest",
          { requestId: params.requestId, responseCode: 200, body: Buffer.from("<!doctype html><html></html>").toString("base64"),
            responseHeaders: [{ name: "Content-Type", value: "text/html" }] }, page.sessionId), page.sessionId);
        await page.cdp.call("Fetch.enable", { patterns: [{ urlPattern: "*" }] }, page.sessionId);
        await page.cdp.call("Page.navigate", { url: "http://entrada-fixture.invalid/" }, page.sessionId);
        await evaluate(page, async () => { while (document.readyState !== "complete") await new Promise(r => setTimeout(r, 10)); });
        await page.cdp.call("Emulation.setEmulatedMedia", { media: "print" }, page.sessionId);
        const { frameTree } = await page.cdp.call("Page.getFrameTree", {}, page.sessionId);
        await page.cdp.call("Page.setDocumentContent", { frameId: frameTree.frame.id, html:
          `<!doctype html><html><head><style>${fonts}\n${baselineCss}\n@media print{${extraCss}}</style></head><body class="print-entrada"><div id="root"></div></body></html>` }, page.sessionId);
        await page.cdp.call("Runtime.evaluate", { expression: `window.__fixture=${JSON.stringify(data)};${js}` }, page.sessionId);
        await evaluate(page, async () => {
          for (let i = 0; i < 100 && !document.querySelector(".document-page"); i++) await new Promise(r => setTimeout(r, 30));
          await document.fonts.ready;
          await Promise.all([...document.images].map(i => i.decode()));
        });
        const geometry = await evaluate(page, () => {
          const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
          return [...document.querySelectorAll(".document-page")].map(p => {
            const frame = p.querySelector(".document-page-frame"), table = p.querySelector(".series-table table");
            return { kind: p.dataset.pageKind, page: rect(p), frame: rect(frame),
              table: table && rect(table), header: table && rect(table.tHead),
              rows: table ? [...table.tBodies[0].rows].map(r => rect(r)) : [],
              font: table && { size: getComputedStyle(table.querySelector("td")).fontSize, family: getComputedStyle(table.querySelector("td")).fontFamily },
              interLoaded: document.fonts.check('700 11px Inter'),
              signatures: p.querySelectorAll(".document-footer").length };
          });
        });
        assert.ok(geometry.length > 0);
        assert.ok(geometry.every(p => p.interLoaded));
        const pdfPath = path.join(out, `${name}.pdf`);
        const pdfData = await page.cdp.call("Page.printToPDF", { printBackground: true, preferCSSPageSize: true,
          paperWidth: 8.5, paperHeight: 11, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 }, page.sessionId);
        fs.writeFileSync(pdfPath, Buffer.from(pdfData.data, "base64"));
        // Global page deliberately retains its previous dimensions.
        const pdf = extractPdf(pdfPath, { widthMm: 216, heightMm: 279 });
        const rows = counts.reduce((n, count) => n + Math.ceil(count / 4), 0);
        const cap = Number(source.match(/const seriesRowsPerPage = (\d+)/)[1]);
        if (variant !== "probe39") {
          assert.equal(pdf.pageCount, 1 + (rows === 1 ? 0 : Math.ceil(rows / cap)), name);
          for (const roll of data.rollos) assert.equal(pdf.pages.join(" ").split(roll.serie).length - 1, 1, `${name}: serial ${roll.serie}`);
          for (const p of geometry.filter(p => p.kind === "series")) {
            assert.equal(p.font.size, "11px");
            assert.equal(p.signatures, 0);
            assert.ok(p.table.bottom + 8 <= p.frame.bottom - 1 + 0.05, `${name}: bottom padding`);
            assert.ok(p.rows.every(r => r.height === 24), `${name}: unchanged row height`);
          }
        }
        const nativeSizes = execFileSync("pdfinfo", ["-f", "1", "-l", String(pdf.pageCount), pdfPath], { encoding: "utf8" });
        if (variant === "after" && scopedCss && rows > 1) {
          assert.match(nativeSizes, /Page\s+2 size:\s+612 x 792 pts/);
        }
        const sizes = [...nativeSizes.matchAll(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+) pts/g)]
          .map(m => ({ width: Number(m[1]), height: Number(m[2]) }));
        assert.equal(sizes.length, pdf.pageCount);
        const prefix = path.join(out, name);
        execFileSync("pdftoppm", ["-png", "-r", "96", pdfPath, prefix]);
        const inkBounds = sizes.map((size, index) => {
          const image = `${prefix}-${index + 1}.png`;
          const trim = execFileSync(rasterTool, [image, "-alpha", "off", "-fuzz", "0%", "-format", "%@", "info:"], { encoding: "utf8" }).trim();
          const match = trim.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
          assert.ok(match, trim);
          const [, w, h, x, y] = match.map(Number);
          const clearanceMm = { left: x * 25.4 / 96, top: y * 25.4 / 96,
            right: size.width * 25.4 / 72 - (x + w) * 25.4 / 96,
            bottom: size.height * 25.4 / 72 - (y + h) * 25.4 / 96 };
          if (variant !== "probe39") for (const mm of Object.values(clearanceMm)) assert.ok(mm >= 5.25, `${name}: ${JSON.stringify(clearanceMm)}`);
          return { image, clearanceMm };
        });
        if (variant === "probe39") assert.ok(geometry.find(p => p.kind === "series").table.bottom + 9 > geometry.find(p => p.kind === "series").frame.bottom, "39 rows must violate existing padding");
        report.scenarios.push({ name, counts, cap, geometry, pageCount: pdf.pageCount, nativeSizes, inkBounds, pdfPath });
        console.log(name, pdf.pageCount, geometry.filter(p => p.kind === "series").map(p =>
          ({ rows: p.rows.length, frameHeight: p.frame.height, tableHeight: p.table.height, gap: p.frame.bottom - p.table.bottom })));
      } finally { await closePage(page); }
    }
  }
  // Both have identical page totals: enforce pixel-exact unchanged global and
  // embedded rendering, not just matching source strings.
  for (const name of ["4", "153"]) assert.deepEqual(
    fs.readFileSync(path.join(out, `before-${name}-1.png`)),
    fs.readFileSync(path.join(out, `after-${name}-1.png`)),
    `${name}: global/embedded page changed`,
  );
  report.status = "PASSED";
} finally {
  fs.writeFileSync(path.join(out, "geometry.json"), JSON.stringify(report, null, 2));
  await browser.close();
}