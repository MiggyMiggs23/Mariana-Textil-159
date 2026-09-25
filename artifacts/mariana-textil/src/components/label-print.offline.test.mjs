#!/usr/bin/env node
// Isolated file:// Chromium regression: no app server, API, authentication or DB.
import assert from "node:assert/strict";
import { readFile, readdir, writeFile, mkdtemp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const component = path.join(root, "artifacts/mariana-textil/src/components/label-print.tsx");
const app = path.join(root, "artifacts/mariana-textil");
const reportDir = path.join(root, "reports/trabajo-nocturno-20260925/tarea-4");
const require = createRequire(path.join(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/package.json"));
const { build } = require("esbuild");
const products = JSON.parse(await readFile(path.join(root, "reports/prompt-l/full-products-readonly-export.json"), "utf8")).products;
const ordered = products.toSorted((a, b) => (b.tela + b.color).length - (a.tela + a.color).length);
const examples = ordered.slice(0, 20).map(p => ({ sku: p.sku, serie: "10000001", tela: p.tela, color: p.color, cantidad: "123.456", unidad: p.unidad }));
const extreme = { ...examples[0], tela: "SUPERCALIFRAGILISTICOEXPIALIDOSO".repeat(8), color: "ROJO", serie: "10000001" };
const badSerie = { ...examples[0], serie: "1234567890123456789012345678901234567890" };
const cases = [...examples, extreme, badSerie];
await mkdir(reportDir, { recursive: true });
const temp = await mkdtemp(path.join(tmpdir(), "label-offline-"));
const candidateAssets = path.join(app, "dist-night-task4/assets");
const candidateCss = (await readdir(candidateAssets).catch(() => []))
  .find(name => /^index-.*\.css$/.test(name));
const stylesheet = candidateCss
  ? path.join(candidateAssets, candidateCss)
  : path.join(app, "dist/public/assets/index-C1IeKHnl.css");
const css = await readFile(stylesheet, "utf8");
console.log(`Offline stylesheet: ${stylesheet}`);
const baseline = execFileSync("git", ["show", "HEAD:artifacts/mariana-textil/src/components/label-print.tsx"], { cwd: root, encoding: "utf8" });
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {LabelPrint} from ${JSON.stringify(component)};
const cases = ${JSON.stringify(cases)};
createRoot(document.getElementById("root")).render(
  React.createElement(React.Fragment, null, ...cases.map((d, i) =>
    React.createElement("div", {key:i, className:"case"}, React.createElement(LabelPrint,{data:d}))))
);
async function inspect() {
  const rows = [...document.querySelectorAll(".label-page")].map((page,i)=>{
    const name=page.querySelector('[data-testid="label-product-name"]');
    const serie=page.querySelector('[data-testid="label-serie"]');
    const header=name.getBoundingClientRect();
    const body=page.querySelector(".grid").getBoundingClientRect();
    const qr=page.querySelector("svg").getBoundingClientRect();
    return {sku:cases[i].sku, name:cases[i].tela+" - "+cases[i].color, serie:cases[i].serie,
      nameState:name.dataset.fitState, nameStep:name.dataset.fontStep,
      nameScroll:name.firstElementChild.scrollHeight, nameHeight:name.clientHeight, nameScrollWidth:name.firstElementChild.scrollWidth, nameWidth:name.clientWidth,
      serieState:serie?.dataset.fitState ?? null, serieText:serie?.textContent ?? null,
      blocked:page.dataset.printBlocked ?? null, error:page.querySelector('[data-testid="label-print-error"]')?.textContent ?? null,
      headerBottom:header.bottom, bodyTop:body.top,
      pageWidth:page.getBoundingClientRect().width, pageHeight:page.getBoundingClientRect().height,
      qrWidth:qr.width, qrHeight:qr.height};
  });
  document.body.setAttribute("data-result",encodeURIComponent(JSON.stringify(rows)));
}
setTimeout(()=>inspect().catch(e=>document.body.setAttribute("data-js-error", String(e))),1200);
`;
const cssExtra = `.case{margin:12px;display:inline-block;vertical-align:top}.label-page{display:flex;flex-direction:column;overflow:hidden;position:relative;box-sizing:border-box;width:100mm;height:70mm;padding:3mm}.label-page [data-testid="label-product-name"]{height:11mm;padding:0 1mm;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center}.label-page .grid{display:grid;grid-template-columns:31mm 30mm minmax(0,1fr);gap:1mm;flex:1;min-height:0;padding-top:2.5mm}.label-page .grid>div{min-width:0}.label-page .grid>div:first-child{display:flex;flex-direction:column;padding-right:3mm}.label-page .grid>div:first-child>div{flex:1}.label-page .grid>div:first-child>div:last-child{flex:1.25}@page{size:100mm 70mm;margin:0}@media print{body{margin:0}.case{display:block;margin:0;break-after:page}.case:nth-child(n+3){display:none}}`;

for (const variant of ["before", "after"]) {
  const js = (await build({
    stdin: { contents: entry, resolveDir: app, sourcefile: path.join(app, "src/components/offline-entry.tsx"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    plugins: [{
      name: "baseline",
      setup(b) {
        if (variant === "before") b.onLoad({ filter: /\/label-print\.tsx$/ }, () => ({ contents: baseline, loader: "tsx", resolveDir: path.dirname(component) }));
        if (variant === "after" && process.env.LABEL_TEST_MUTANT === "no-wrap") {
          b.onLoad({ filter: /\/label-print\.tsx$/ }, async () => ({
            contents: (await readFile(component, "utf8")).replace("        wrapTwoLines\n", "        wrapTwoLines={false}\n"),
            loader: "tsx", resolveDir: path.dirname(component),
          }));
        }
      },
    }],
    alias: { "@": path.join(app, "src") },
    loader: { ".png": "dataurl" },
  })).outputFiles[0].text;
  const file = path.join(temp, `${variant}.html`);
  await writeFile(file, `<html><head><meta charset="utf-8"><style>${css}${cssExtra}</style></head><body><div id="root"></div><script>window.onerror=(message)=>document.body.setAttribute("data-js-error",message);</script><script>${js}</script></body></html>`);
  const browser = "/repl/tools/bin/chromium";
  const flags = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--virtual-time-budget=3000", "--window-size=1250,950"];
  const output = execFileSync(browser, [...flags, "--dump-dom", `file://${file}`], { encoding: "utf8", maxBuffer: 8_000_000 });
  const encoded = output.match(/data-result="([^"]+)"/)?.[1];
  assert.ok(encoded, `Chromium did not finish ${variant} measurements: ${output.match(/data-js-error="([^"]+)/)?.[1] ?? "no JS error captured"}`);
  const rows = JSON.parse(decodeURIComponent(encoded.replaceAll("&amp;", "&")));
  await writeFile(path.join(reportDir, `${variant}-geometry.json`), JSON.stringify(rows, null, 2));
  execFileSync(browser, [...flags, `--screenshot=${path.join(reportDir, `${variant}-label.png`)}`, `file://${file}`], { stdio: "ignore" });
  if (variant === "after") {
    assert.equal(rows.length, cases.length);
    for (const row of rows.slice(0, examples.length)) {
      assert.equal(row.blocked, null, `Catalog item blocked: ${row.name}: ${row.error}`);
      assert.equal(row.nameState, "fits", row.name);
      assert.equal(row.serieState, "fits", row.name);
      assert.equal(row.serieText, row.serie);
      assert.ok(row.headerBottom <= row.bodyTop + 0.5, `Header overlaps body: ${row.name}`);
      assert.ok(Math.abs(row.pageWidth - 100 * 96 / 25.4) < 2);
      assert.ok(Math.abs(row.pageHeight - 70 * 96 / 25.4) < 2);
      assert.ok(Math.abs(row.qrWidth - 29 * 96 / 25.4) < 2);
    }
    assert.equal(rows.at(-2).blocked, "true");
    assert.ok(rows.at(-2).error.includes(extreme.tela));
    assert.equal(rows.at(-1).blocked, "true");
    assert.ok(rows.at(-1).error.includes(badSerie.serie));
  } else {
    assert.ok(rows.some(r => r.nameState === "overflow" || r.serieText === null), "Negative control must reproduce old defect");
  }
  console.log(`${variant}: ${rows.length} real component labels; ${rows.filter(r => r.blocked).length} explicitly blocked`);
}

// A second, strictly valid-only print fixture avoids the blocking alert of
// synthetic invalid values, and exercises Chromium's real print media/PDF.
if (!process.env.LABEL_TEST_MUTANT) {
  const printable = examples.slice(0, 2);
  const printEntry = entry.replace(JSON.stringify(cases), JSON.stringify(printable));
  const printJs = (await build({
    stdin: { contents: printEntry, resolveDir: app, sourcefile: path.join(app, "src/components/offline-print.tsx"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    alias: { "@": path.join(app, "src") },
    loader: { ".png": "dataurl" },
  })).outputFiles[0].text;
  const pdfCss = `${cssExtra}@media print{.case{break-after:page;page-break-after:always}.case:last-child{break-after:auto;page-break-after:auto}.case .label-page{break-after:auto!important;page-break-after:auto!important}}`;
  const file = path.join(temp, "print-valid.html");
  await writeFile(file, `<html><head><meta charset="utf-8"><style>${css}${pdfCss}</style></head><body><div id="root"></div><script>${printJs}</script></body></html>`);
  const pdf = path.join(reportDir, "after-two-labels-print.pdf");
  execFileSync("/repl/tools/bin/chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--virtual-time-budget=3000", "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, `file://${file}`,
  ], { stdio: "ignore", timeout: 35000 });
  const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  assert.match(info, /Pages:\s+2\b/);
  const pageSize = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
  assert.ok(pageSize, "PDF does not report physical page size");
  assert.ok(Math.abs(Number(pageSize[1]) - 100 * 72 / 25.4) < 0.6);
  assert.ok(Math.abs(Number(pageSize[2]) - 70 * 72 / 25.4) < 0.6);
  const printedText = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" }).toUpperCase();
  for (const row of printable) {
    assert.ok(printedText.includes(row.sku.toUpperCase()), `SKU missing in printed PDF: ${row.sku}`);
    assert.ok(printedText.includes(row.serie), `Series missing in printed PDF: ${row.serie}`);
  }
  const words = printable[1].color.toUpperCase().split(/\s+/);
  assert.ok(words.every(word => printedText.includes(word)), "Wrapped color missing in printed PDF");
  execFileSync("pdftoppm", ["-f", "2", "-l", "2", "-singlefile", "-png", "-r", "144", pdf, path.join(reportDir, "after-print-page-2")], { stdio: "ignore" });
  await writeFile(path.join(reportDir, "after-print-pdfinfo.txt"), info);
  console.log("print PDF: 2 pages, 100 x 70 mm, complete SKU/series/wrapped color");
}