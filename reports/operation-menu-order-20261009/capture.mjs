import fs from "node:fs";
import assert from "node:assert/strict";
import {login} from "../permission-nine-runtime-20261001/cases.mjs";
const dir=import.meta.dirname;
const run=fs.readFileSync(dir+"/latest-run.txt","utf8").trim();
const credentials=JSON.parse(fs.readFileSync(run+"/credentials.json","utf8"));
assert.equal(JSON.parse(fs.readFileSync(run+"/result.json")).status,"READY_FOR_TESTING_AGENT");
const {chromium}=await import(credentials.playwright);
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const deadline=setTimeout(()=>{void browser.close();process.exitCode=1;},60000);
try {
 const {page,errors}=await login(browser,credentials.origin,credentials.admin.username,credentials.password);
 page.setDefaultTimeout(15000);
 await page.goto(credentials.origin+"/clientes",{waitUntil:"domcontentloaded"});
 const sidebar=page.locator("aside");
 const group=sidebar.locator("div.px-3").filter({has:page.getByRole("button",{name:"OPERACIÓN",exact:true})}).first();
 await group.getByRole("button",{name:"OPERACIÓN",exact:true}).waitFor();
 for(const title of ["INVENTARIO","CAJA","DIRECTORIO","CONFIGURACIÓN","ADMINISTRACIÓN CONTABLE"]){
   const button=sidebar.getByRole("button",{name:title,exact:true});
   if(await button.count() && await button.getAttribute("aria-expanded")==="true")await button.click();
 }
 assert.deepEqual(await group.locator("a").allTextContents(),["Movimientos","POS","Entradas","Salidas","Recibos de abonos","Viajes"]);
 assert.deepEqual(await group.locator("a").evaluateAll(a=>a.map(x=>x.getAttribute("href"))),["/movimientos","/pos","/entradas","/salidas","/recibos-abonos","/viajes"]);
 await page.evaluate(()=>document.fonts.ready);
 fs.mkdirSync(dir+"/screenshots",{recursive:true});
 await sidebar.screenshot({path:dir+"/screenshots/operation-order-desktop.png"});
 await page.setViewportSize({width:390,height:844});
 await page.locator("header").filter({visible:true}).getByRole("button").filter({has:page.locator("svg.lucide-menu")}).click();
 const mobile=page.locator('nav[data-history-scroll-key="sidebar-mobile"]');
 await mobile.getByRole("button",{name:"OPERACIÓN",exact:true}).waitFor();
 assert.deepEqual(await mobile.locator("div.px-3").filter({has:page.getByRole("button",{name:"OPERACIÓN",exact:true})}).first().locator("a").allTextContents(),["Movimientos","POS","Entradas","Salidas","Recibos de abonos","Viajes"]);
 await page.screenshot({path:dir+"/screenshots/operation-order-mobile.png"});
 fs.writeFileSync(dir+"/capture-result.json",JSON.stringify({passed:true,order:["Movimientos","POS","Entradas","Salidas","Recibos de abonos","Viajes"],desktop:true,mobile:true,errors},null,2));
 console.log("PASS actual sidebar order, labels and hrefs; desktop/mobile captured");
} finally {clearTimeout(deadline);await browser.close();}
