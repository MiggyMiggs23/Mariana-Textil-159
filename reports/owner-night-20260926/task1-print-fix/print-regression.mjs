import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const dir = import.meta.dirname;
const parent = JSON.parse(fs.readFileSync("reports/priority-20260926/credit-presentation/candidate.json"));
const candidate = JSON.parse(fs.readFileSync(path.join(dir, "candidate.json")));
const cssFor = manifest => fs.readFileSync(path.join(manifest.frontendRoot, Object.keys(manifest.frontendFiles).find(name => name.endsWith(".css"))), "utf8");
const dialogSource = fs.readFileSync(path.join(dir, "frozen-root/artifacts/mariana-textil/src/components/ui/dialog.tsx"), "utf8");
const classes = dialogSource.match(/"(fixed left-\[50%\][^"]+)"/)?.[1];
assert.ok(classes, "Use the exact production DialogContent positioning classes");
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const result = { source: "Exact frozen production CSS and DialogContent classes in isolated browser DOM fixtures; no app/API/DB/server work", cases: [] };
try {
  for (const [version, manifest] of [["baseline", parent], ["candidate", candidate]]) {
    for (const placement of ["direct-body", "nested-portal", "inside-root"]) {
      const doc = `<section role="dialog" class="${classes} corte-print max-h-[92dvh] overflow-y-auto sm:max-w-4xl"><h1>CORTE REGRESSION DOCUMENT</h1><p>Saldo efectivo 1234.56</p><p>FIN CORTE</p></section>`;
      const root = placement === "inside-root" ? `<div id="root"><p>UNRELATED ROOT SECRET</p>${doc}</div>` : `<div id="root">UNRELATED ROOT SECRET</div>`;
      const portal = placement === "direct-body" ? doc : placement === "nested-portal" ? `<div id="portal"><aside>UNRELATED PORTAL SECRET</aside>${doc}</div>` : "";
      await page.setContent(`<style>${cssFor(manifest)}</style><body class="print-corte">${root}<div id="overlay">UNRELATED OVERLAY SECRET</div><article class="credito-print">UNRELATED CREDIT SECRET</article><article class="viaje-page">UNRELATED TRIP SECRET</article>${portal}</body>`);
      await page.emulateMedia({ media: "print" });
      const measured = await page.locator(".corte-print").evaluate(el => {
        const style = getComputedStyle(el), rect = el.getBoundingClientRect();
        return { display: style.display, visibility: style.visibility, x: rect.x, y: rect.y, width: rect.width, height: rect.height, translate: style.translate, transform: style.transform,
          portalDisplay: document.getElementById("portal") ? getComputedStyle(document.getElementById("portal")).display : null,
          overlayDisplay: getComputedStyle(document.getElementById("overlay")).display };
      });
      const pdfPath = path.join(dir, `${version}-${placement}.pdf`);
      await page.pdf({ path: pdfPath, format: "Letter", printBackground: true });
      const extracted = spawnSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
      assert.equal(extracted.status, 0);
      const text = extracted.stdout;
      const entry = { version, placement, ...measured, pdfBytes: fs.statSync(pdfPath).size, hasCorteTitle: text.includes("CORTE REGRESSION DOCUMENT"), hasFinalLine: text.includes("FIN CORTE"), leaksUnrelatedDocument: text.includes("UNRELATED") };
      if (version === "baseline" && placement === "direct-body") {
        assert.equal(measured.display, "none");
        assert.equal(entry.hasCorteTitle, false);
        result.baselineBlankReproduced = true;
      }
      if (version === "candidate") {
        assert.notEqual(measured.display, "none");
        assert.equal(measured.visibility, "visible");
        assert.equal(measured.x, 0); assert.equal(measured.y, 0);
        assert.ok(["none", "0px", "0px 0px"].includes(measured.translate)); assert.equal(measured.transform, "none");
        assert.ok(measured.width > 0 && measured.height > 0);
        assert.equal(entry.hasCorteTitle, true); assert.equal(entry.hasFinalLine, true);
        assert.equal(entry.leaksUnrelatedDocument, false);
        assert.equal(measured.overlayDisplay, "none");
        if (placement === "nested-portal") assert.equal(measured.portalDisplay, "contents");
        await page.screenshot({ path: path.join(dir, `candidate-${placement}.png`) });
        // Outside the targeted print mode, no corte document gains print visibility.
        await page.evaluate(() => { document.body.className = "print-viaje"; });
        const inactivePath = path.join(dir, `other-mode-${placement}.pdf`);
        await page.pdf({ path: inactivePath, format: "Letter" });
        const inactiveText = spawnSync("pdftotext", [inactivePath, "-"], { encoding: "utf8" }).stdout;
        assert.ok(!inactiveText.includes("CORTE REGRESSION DOCUMENT"));
      }
      result.cases.push(entry);
    }
  }
  result.status = "PASS";
  const actual = fs.readFileSync("artifacts/mariana-textil/src/index.css");
  assert.ok(actual.equals(fs.readFileSync(path.join(dir, "frozen-root/artifacts/mariana-textil/src/index.css"))));
  candidate.verification.browser = "Built production CSS regression PASS: baseline direct portal blank reproduced; candidate direct/nested/root computed print geometry + extracted PDF text pass; no unrelated-document leakage. MAIN native financial-copy retest pending.";
  fs.writeFileSync(path.join(dir, "candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
} finally {
  fs.writeFileSync(path.join(dir, "print-regression.json"), JSON.stringify(result, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify(result));