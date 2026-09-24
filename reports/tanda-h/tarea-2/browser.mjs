import fs from "node:fs";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(), phase=process.argv[2], origin="http://127.0.0.1:43882";
if(!["pre","post","account"].includes(phase))throw Error("Expected pre/post/account");
const out=root+"/reports/tanda-h/tarea-2/browser-"+phase+(process.env.PERF_RUN?"-"+process.env.PERF_RUN:"");
fs.mkdirSync(out,{recursive:true});
const creds=JSON.parse(fs.readFileSync(root+"/.local/tanda-h/credentials.json")).admin;
const fixture=JSON.parse(fs.readFileSync(root+"/reports/tanda-h/setup/fixture-manifest-redacted.json"));
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"],timeout:15000});
const results=[], requests=[]; let sample=null;
try{
 const context=await browser.newContext({viewport:{width:1360,height:1000}});
 let page=await context.newPage();page.setDefaultTimeout(15000);
 let cdp=await context.newCDPSession(page);await cdp.send("Performance.enable");
 const tags=new WeakMap();
 context.on("request",r=>tags.set(r,sample));
 context.on("requestfinished",r=>{if(tags.get(r)&&r.url().startsWith(origin+"/api/"))requests.push({sample:tags.get(r),path:new URL(r.url()).pathname+new URL(r.url()).search,method:r.method(),timing:r.timing()});});
 context.on("response",r=>{if(tags.get(r.request())&&r.status()>=400)requests.push({sample:tags.get(r.request()),path:new URL(r.url()).pathname,status:r.status()});});
 const authStart=performance.now();
 await page.goto(origin+"/login",{waitUntil:"domcontentloaded"});
 await page.getByLabel("Usuario",{exact:true}).fill(creds.username);await page.getByLabel("Contraseña",{exact:true}).fill(creds.password);
 await page.getByRole("button",{name:"Ingresar",exact:true}).click();await page.waitForURL(u=>!u.pathname.includes("login"));
 const authMs=performance.now()-authStart;
 const siteStart=performance.now();
 await page.getByRole("combobox").first().click();await page.getByRole("option",{name:fixture.sites[0].nombre,exact:true}).click();
 const siteSelectionMs=performance.now()-siteStart;
 const cases=process.env.PERF_CASES?process.env.PERF_CASES.split(","):phase==="account"?["account"]:["credit","cut"];
 for(const name of cases)for(let i=0;i<Number(process.env.PERF_SAMPLES||3);i++){
  if(name!=="account"){
   await page.close();
   page=await context.newPage();page.setDefaultTimeout(15000);
   cdp=await context.newCDPSession(page);await cdp.send("Performance.enable");
  }
  sample=`${name}-${i}`;
  const before=(await cdp.send("Performance.getMetrics")).metrics;
  const start=performance.now();let error=null,ready=false, actionMs=null;
  try{
   if(name==="account"){
    await page.getByRole("link",{name:"Clientes",exact:true}).click();
    await page.locator(`a[href="/clientes/${fixture.customer.id}"]`).first().click();
   }else await page.goto(origin+(name==="credit"?"/reportes/clientes":"/cobros"),{waitUntil:"domcontentloaded",timeout:15000});
   if(name==="credit")await page.getByTestId("report-content-clientes").waitFor();
   if(name==="cut"){
    await page.getByRole("combobox").first().click();
    await page.getByRole("option",{name:fixture.sites[0].nombre,exact:true}).click();
    const caja=page.getByRole("button",{name:"Caja",exact:true});if(await caja.count())await caja.click();
    await page.getByRole("heading",{name:"Caja Operativa",exact:true}).waitFor();
    const action=performance.now();
    await page.getByRole("button",{name:"Realizar Corte",exact:true}).click();
    await page.getByRole("heading",{name:"Corte y Cierre de Caja",exact:true}).waitFor();
    await page.getByRole("dialog").getByText("Efectivo Esperado:",{exact:true}).waitFor();
    actionMs=performance.now()-action;
   }
   if(name==="account"){
    await page.getByRole("tab",{name:"Estado de cuenta",exact:true}).click();
    await page.getByTestId("e7-client-export").waitFor({timeout:20000});
    await page.getByTestId("e7-global-four").waitFor();
   }
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   ready=true;
  }catch(e){error=e.message;}
  const elapsedMs=performance.now()-start;
  const after=(await cdp.send("Performance.getMetrics")).metrics;
  const cpu=Object.fromEntries(after.filter(m=>["TaskDuration","ScriptDuration","LayoutDuration","RecalcStyleDuration","Nodes","JSHeapUsedSize"].includes(m.name)).map(m=>[m.name,{value:m.value,delta:m.value-(before.find(b=>b.name===m.name)?.value||0)}]));
  results.push({name,sample:i,elapsedMs,actionMs,ready,error,cpu});
  fs.writeFileSync(out+"/results.json",JSON.stringify({authMs,siteSelectionMs,definition:"Full document navigation through data content ready plus two animation frames; authentication and initial site selection reported separately. Cut action also reported separately.",results,requests},null,2));
  await page.screenshot({path:out+"/"+sample+".png",timeout:5000}).catch(()=>{});
  fs.writeFileSync(out+"/"+sample+".txt",await page.locator("body").innerText({timeout:2000}).catch(e=>e.message));
  console.log(JSON.stringify(results.at(-1)));
  sample=null;if(error)break;
 }
}finally{await browser.close();}