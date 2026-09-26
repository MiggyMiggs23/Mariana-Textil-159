import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const out="reports/print-corrections-20260926/labels";
const origin="http://127.0.0.1:18428";
const credentials=JSON.parse(fs.readFileSync("/tmp/print-corrections-20260926/print_corrections_20260926/credentials.json")).admin;
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const result={origin,entry:2,pdf:`${out}/ENTRADA-MA000001-PISOS-ORIGINALES.pdf`,dialogs:[]};
page.on("dialog",async d=>{result.dialogs.push(d.message());await d.dismiss()});
try {
  await page.goto(`${origin}/login`);
  await page.getByLabel("Usuario",{exact:true}).fill(credentials.usuario);
  await page.getByLabel("Contraseña",{exact:true}).fill(credentials.password);
  await page.getByRole("button",{name:"Ingresar",exact:true}).click();
  await page.waitForURL(u=>u.pathname!=="/login");
  await page.goto(`${origin}/entradas/2/documento`);
  await page.getByRole("button",{name:"Imprimir / Guardar PDF",exact:true}).waitFor();
  result.screenText=await page.locator("body").innerText();
  let done=false,error;
  await page.exposeFunction("captureNativePrint",async()=>{
    try {
      result.bodyAtNative=await page.evaluate(()=>document.body.className);
      assert(result.bodyAtNative.includes("print-entrada"));
      await page.pdf({path:result.pdf,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
      result.pdfinfo=execFileSync("pdfinfo",[result.pdf],{encoding:"utf8"});
      result.text=execFileSync("pdftotext",["-layout",result.pdf,"-"],{encoding:"utf8"});
      assert.match(result.text,/\bPISO\b/);
      assert.match(result.text,/Planta Alta/);
      assert.match(result.text,/Planta Baja/);
      assert.doesNotMatch(result.text,/Sin evidencia/);
      fs.writeFileSync(`${out}/ENTRADA-MA000001-PISOS-ORIGINALES.txt`,result.text);
      execFileSync("pdftoppm",["-f","1","-l","1","-singlefile","-scale-to","1800","-png",result.pdf,`${out}/ENTRADA-MA000001-PISOS-ORIGINALES-page1`]);
    }catch(e){error=e}
    done=true;
  });
  await page.evaluate(()=>{window.print=()=>{void window.captureNativePrint()}});
  await page.getByRole("button",{name:"Imprimir / Guardar PDF",exact:true}).click();
  for(let i=0;i<100&&!done;i++)await new Promise(r=>setTimeout(r,100));
  assert(done,"Native print not invoked");if(error)throw error;
  result.status="passed";
}catch(e){result.error=e.stack;throw e}
finally{fs.writeFileSync(`${out}/native-entrada-result.json`,JSON.stringify(result,null,2));await browser.close()}