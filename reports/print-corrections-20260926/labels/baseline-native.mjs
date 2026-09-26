import fs from "node:fs";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const out="reports/print-corrections-20260926/labels";
const origin="http://127.0.0.1:18428";
const credentials=JSON.parse(fs.readFileSync("/tmp/print-corrections-20260926/print_corrections_20260926/credentials.json")).admin;
const baseline="artifacts/mariana-textil/dist-postreview-final-20260926/assets/index-CB9hQHvT.js";
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const result={method:"Browser-only response replacement of v3 main JS with exact frozen released task4 main JS; same native copied API and unchanged CSS; no runtime switch.",baseline,dialogs:[]};
page.on("dialog",async d=>{result.dialogs.push(d.message());await d.dismiss()});
try{
 await page.route("**/assets/index-D4z_f2Rd.js",r=>r.fulfill({contentType:"application/javascript",body:fs.readFileSync(baseline)}));
 await page.goto(`${origin}/login`);
 await page.getByLabel("Usuario",{exact:true}).fill(credentials.usuario);
 await page.getByLabel("Contraseña",{exact:true}).fill(credentials.password);
 await page.getByRole("button",{name:"Ingresar",exact:true}).click();
 await page.waitForURL(u=>u.pathname!=="/login");
 await page.goto(`${origin}/entradas/3/etiquetas`);
 await page.locator(".label-page").first().waitFor({state:"attached"});
 for(let serie=10000123;serie<10000148;serie++)await page.getByText(String(serie),{exact:true}).first().click();
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 result.before=await page.locator(".label-page").evaluate(p=>({name:p.querySelector('[data-testid="label-product-name"]').textContent,blocked:p.dataset.printBlocked,error:p.querySelector('[data-testid="label-print-error"]')?.textContent,width:p.getBoundingClientRect().width}));
 let done=false;
 await page.exposeFunction("captureNativePrint",async()=>{
   result.nativeReached=true;
   try{await page.pdf({path:`${out}/baseline-example-diagnostic.pdf`,preferCSSPageSize:true,printBackground:true});}catch(e){result.pdfError=String(e)}
   done=true;
 });
 await page.evaluate(()=>{window.print=()=>{void window.captureNativePrint()}});
 await page.getByRole("button",{name:"Imprimir Selección",exact:true}).click();
 for(let i=0;i<80&&!done;i++)await new Promise(r=>setTimeout(r,100));
 result.finished=done;
}catch(e){result.error=e.stack}
finally{fs.writeFileSync(`${out}/baseline-native-result.json`,JSON.stringify(result,null,2));await browser.close()}