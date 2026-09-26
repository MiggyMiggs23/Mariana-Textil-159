import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const out = "reports/print-corrections-20260926/labels";
const origin = "http://127.0.0.1:18428";
const credentials = JSON.parse(fs.readFileSync("/tmp/print-corrections-20260926/print_corrections_20260926/credentials.json")).admin;
const catalog = JSON.parse(fs.readFileSync("reports/print-corrections-20260926/infra/catalog-full.json")).products;
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const result = { origin, uiSha256: "0ca090ce957ef72c37cebbdb0663948b61d90eeb90d76bbc5cc1f0b20ae023c5", dialogs: [], catalogCount: catalog.length, phase: "login", pdfs: [] };
const save = () => fs.writeFileSync(`${out}/native-result.json`, JSON.stringify(result, null, 2));
page.on("dialog", async d => { result.dialogs.push(d.message()); await d.dismiss(); });
try {
  await page.goto(`${origin}/login`);
  await page.getByLabel("Usuario", { exact: true }).fill(credentials.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(credentials.password);
  const login = page.waitForResponse(r => r.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  assert.equal((await login).status(), 200);
  await page.waitForURL(url => url.pathname !== "/login");
  result.auth = { status: 200, expectedId: credentials.id };
  result.phase = "catalog";
  const inspect = () => [...document.querySelectorAll(".label-page")].map(p => {
    const n = p.querySelector('[data-testid="label-product-name"]');
    const t = n.firstElementChild;
    const box = n.getBoundingClientRect();
    return { name: n.textContent, font: n.dataset.fontStep, lines: n.dataset.lineLimit, fit: n.dataset.fitState, blocked: p.dataset.printBlocked ?? null,
      width: box.width, height: box.height, textWidth: t.scrollWidth, textHeight: t.scrollHeight,
      error: p.querySelector('[data-testid="label-print-error"]')?.textContent ?? null };
  });
  result.catalog = process.env.REUSE_CATALOG === "1"
    ? JSON.parse(fs.readFileSync(`${out}/native-result.json`)).catalog : [];
  result.catalogMethod = "Actual production CatalogLabelFitReport, batches of 25 authentic current read-only catalog products supplied to list endpoint; diagnostic series/quantity belong to existing report component, not real inventory.";
  let batch = [];
  await page.route("**/api/productos?*", route => route.fulfill({ json: batch }));
  await page.route("**/api/productos", route => route.fulfill({ json: batch }));
  for (let offset = result.catalog.length; offset < catalog.length; offset += 25) {
    batch = catalog.slice(offset, offset + 25);
    await page.goto(`${origin}/etiquetas?fitReport=1`);
    await page.getByTestId("catalog-label-fit-summary").waitFor({ timeout: 25000 });
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    result.catalog.push(...await page.evaluate(inspect));
    save();
    console.log(`Measured ${result.catalog.length}/${catalog.length}`);
  }
  await page.unrouteAll();
  result.summary = `${result.catalog.length} measured in production report batches`;
  assert.equal(result.catalog.length, catalog.length, "Full live catalog must be tested");
  result.overflows = result.catalog.filter(x => x.blocked || x.fit !== "fits");
  save();
  assert.equal(result.overflows.length, 0, JSON.stringify(result.overflows));
  await page.screenshot({ path: `${out}/catalog-native.png` });
  result.phase = "native-label-entry3";
  let printName, nativeDone, nativeError;
  await page.exposeFunction("captureNativePrint", async () => {
    try {
      const before = await page.evaluate(() => ({ body: document.body.className, targets: document.querySelectorAll('[data-print-target="active"]').length }));
      await page.emulateMedia({media:"print"});
      const geometry = await page.evaluate(inspect);
      assert(geometry.every(r => r.fit === "fits" && !r.blocked), JSON.stringify(geometry.filter(r => r.fit !== "fits" || r.blocked)));
      const pdf = `${out}/${printName}.pdf`;
      await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      const after = await page.evaluate(() => ({ body: document.body.className, targets: document.querySelectorAll('[data-print-target="active"]').length }));
      assert(before.body.includes("printing-labels"), "Actual print button must activate label mode");
      assert.equal(before.targets, 1);
      const info = execFileSync("pdfinfo", [pdf], {encoding:"utf8"});
      const text = execFileSync("pdftotext", ["-layout",pdf,"-"], {encoding:"utf8"});
      assert.match(info, new RegExp(`Pages:\\s+${geometry.length}\\b`));
      assert.match(info, /Page size:\s+282\.96 x 198 pts/);
      for (const row of geometry) {
        const compact = text.replace(/\s+/g," ");
        assert(compact.includes(row.name.replace(/\s+/g," ")), `Missing printed name: ${row.name}`);
      }
      fs.writeFileSync(`${out}/${printName}.txt`, text);
      fs.writeFileSync(`${out}/${printName}-pdfinfo.txt`, info);
      result.pdfs.push({ name:printName, pdf, before, after, geometry, info });
      execFileSync("pdftoppm",["-f","1","-l","1","-singlefile","-scale-to","1600","-png",pdf,`${out}/${printName}-page1`]);
      save();
      nativeDone = true;
    } catch(e) { nativeError = e; nativeDone = true; }
  });
  for (const [name, onlySerie] of [["etiquetas-top25-y-gabardina",null],["GABARDINA-METEPEC-1.50-MARINO","10000148"],["MEZCLILLA-DIAMANTINA-10-OZ-INDIGO-RAYADA","10000123"]]) {
    printName = name; nativeDone = false; nativeError = null;
    await page.emulateMedia({media:"screen"});
    await page.goto(`${origin}/entradas/3/etiquetas`);
    await page.locator(".label-page").first().waitFor({state:"attached"});
    if(onlySerie) {
      for(let serie=10000123; serie<=10000148; serie++) {
        if(String(serie)===onlySerie) continue;
        await page.getByText(String(serie),{exact:true}).first().click();
      }
    }
    await page.evaluate(() => { window.print = () => { void window.captureNativePrint(); }; });
    await page.getByRole("button",{name:"Imprimir Selección",exact:true}).click();
    for(let i=0;i<100&&!nativeDone;i++) await new Promise(r=>setTimeout(r,100));
    assert(nativeDone, `Native print not reached: ${result.dialogs.join("; ")}`);
    if(nativeError) throw nativeError;
  }
  result.phase = "complete";
  save();
} catch (e) { result.error = e.stack; result.url = page.url(); save(); result.body = (await page.locator("body").innerText({timeout:3000}).catch(()=>"unresponsive")).slice(0,6000); await page.screenshot({path:`${out}/failure.png`,timeout:3000}).catch(()=>{}); save(); throw e; }
finally { await browser.close(); }