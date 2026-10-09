import fs from "node:fs";
import assert from "node:assert/strict";
import {login} from "../permission-nine-runtime-20261001/cases.mjs";
const dir=import.meta.dirname,run=fs.readFileSync(dir+"/latest-run.txt","utf8").trim();
assert.equal(JSON.parse(fs.readFileSync(run+"/result.json")).status,"READY_FOR_TESTING_AGENT");
const credentials=JSON.parse(fs.readFileSync(run+"/credentials.json","utf8"));
const {chromium}=await import(credentials.playwright);
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const deadline=setTimeout(()=>{void browser.close();process.exitCode=1;},60000);
const expected=["Sitios","Usuarios","Permisos","Camionetas","Choferes","Equipos","Conciliación de Kardex","Conciliaciones documentales","Administrar perfiles A/F","Bitácora"];
try {
 const {page,errors}=await login(browser,credentials.origin,credentials.admin.username,credentials.password);
 page.setDefaultTimeout(15000);
 await page.goto(credentials.origin+"/clientes",{waitUntil:"domcontentloaded"});
 const sidebar=page.locator("aside");
 const group=sidebar.locator("div.px-3").filter({has:page.getByRole("button",{name:"CONFIGURACIÓN",exact:true})}).first();
 await group.getByRole("link",{name:"Administrar perfiles A/F",exact:true}).waitFor();
 assert.equal(await sidebar.getByText("ADMINISTRACIÓN CONTABLE",{exact:true}).count(),0);
 assert.deepEqual(await group.locator("a").allTextContents(),expected);
 const hrefs=await group.locator("a").evaluateAll(a=>a.map(x=>x.getAttribute("href")));
 assert.deepEqual(hrefs,["/ubicaciones","/usuarios","/permisos","/directorio/camionetas","/directorio/choferes","/equipos","/administracion/conciliacion","/contabilidad/conciliaciones","/usuarios","/auditoria"]);
 for(const title of ["INVENTARIO","OPERACIÓN","CAJA","DIRECTORIO"]){
   const button=sidebar.getByRole("button",{name:title,exact:true});
   if(await button.count() && await button.getAttribute("aria-expanded")==="true")await button.click();
 }
 const reset=sidebar.getByRole("button",{name:"Borrar datos de prueba",exact:true});
 await reset.waitFor();
 assert.ok((await reset.boundingBox()).y > (await group.getByRole("link",{name:"Bitácora",exact:true}).boundingBox()).y);
 await page.evaluate(()=>document.fonts.ready);
 fs.mkdirSync(dir+"/screenshots",{recursive:true});
 await sidebar.screenshot({path:dir+"/screenshots/configuration-desktop.png"});
 // Both identical /usuarios destinations must remain distinct React entries.
 assert.equal(await group.locator('a[href="/usuarios"]').count(),2);
 assert.ok(!errors.some(e=>/same key|duplicate key/i.test(e)));
 await page.setViewportSize({width:390,height:1000});
 await page.locator("header").filter({visible:true}).getByRole("button").filter({has:page.locator("svg.lucide-menu")}).click();
 const mobile=page.locator('nav[data-history-scroll-key="sidebar-mobile"]');
 const mobileGroup=mobile.locator("div.px-3").filter({has:page.getByRole("button",{name:"CONFIGURACIÓN",exact:true})}).first();
 await mobileGroup.getByRole("link",{name:"Administrar perfiles A/F",exact:true}).waitFor();
 assert.deepEqual(await mobileGroup.locator("a").allTextContents(),expected);
 assert.equal(await mobile.getByText("ADMINISTRACIÓN CONTABLE",{exact:true}).count(),0);
 assert.ok((await mobile.getByRole("button",{name:"Borrar datos de prueba",exact:true}).boundingBox()).y > (await mobileGroup.getByRole("link",{name:"Bitácora",exact:true}).boundingBox()).y);
 await page.screenshot({path:dir+"/screenshots/configuration-mobile.png"});
 fs.writeFileSync(dir+"/capture-result.json",JSON.stringify({passed:true,order:expected,hrefs,desktop:true,mobile:true,removedSection:true,resetLast:true,errors},null,2));
 console.log("PASS ordered configuration, removed section, preserved hrefs, reset last; desktop/mobile");
} finally {clearTimeout(deadline);await browser.close();}
