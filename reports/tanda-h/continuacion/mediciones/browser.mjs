import fs from "node:fs";
import { chromium } from "../../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),out=root+"/reports/tanda-h/continuacion/mediciones",origin="http://127.0.0.1:43884",name=process.argv[2]||"small",sample=process.argv[3]||"0";
const f=JSON.parse(fs.readFileSync(root+"/reports/tanda-h/continuacion/setup/fixture-manifest-redacted.json"));
const creds=JSON.parse(fs.readFileSync(root+"/private.local/tanda-h-resume/credentials.json"))[name==="cash"?"caja":"admin"];
const result={name,sample,ready:false,requests:[],auth:[],definition:"Fresh browser process per sample; native login and site selection excluded from route readiness; network timings are not SQL timings."};
const save=()=>fs.writeFileSync(`${out}/${name}-${sample}.json`,JSON.stringify(result,null,2));
let browser,page;
const watchdog=setTimeout(()=>{result.error="Hard 90-second per-process deadline";save();browser?.close().finally(()=>process.exit(2));setTimeout(()=>process.exit(2),2000);},90000);
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME||"/repl/tools/bin/chromium",args:["--no-sandbox"],timeout:15000});
 page=await browser.newPage({viewport:{width:1360,height:1000}});page.setDefaultTimeout(20000);
 result.pageErrors=[];result.failedRequests=[];
 page.on("pageerror",e=>result.pageErrors.push(e.message));
 page.on("requestfailed",r=>result.failedRequests.push({path:new URL(r.url()).pathname,error:r.failure()}));
 await page.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 page.on("response",async r=>{
  const path=new URL(r.url()).pathname;if(!path.startsWith("/api/"))return;
  result.requests.push({path,status:r.status(),method:r.request().method()});
  if(path.includes("/auth/")||path.includes("/e7/disponibilidad")){
   let body;try{const d=await r.json();body=path.endsWith("/me")?{id:d.id,rol:d.rol,error:d.error,message:d.message}:path.includes("disponibilidad")?d:{error:d.error,message:d.message};}catch{body={parse:"non-json"};}
   result.auth.push({path,status:r.status(),body});save();
  }
 });
 page.on("requestfinished",r=>{if(r.url().startsWith(origin+"/api/"))result.requests.push({path:new URL(r.url()).pathname,timing:r.timing()});});
 const login=performance.now();
 await page.goto(origin+"/login",{waitUntil:"domcontentloaded"});
 await page.getByLabel("Usuario",{exact:true}).fill(creds.username);await page.getByLabel("Contraseña",{exact:true}).fill(creds.password);
 await page.getByRole("button",{name:"Ingresar",exact:true}).click();await page.waitForURL(u=>!u.pathname.includes("login"));
 result.loginMs=performance.now()-login;
 if(name!=="cash"){await page.getByRole("combobox").first().click();await page.getByRole("option",{name:f.sites[0].nombre,exact:true}).click();}
 const cdp=await page.context().newCDPSession(page);await cdp.send("Performance.enable");
 const before=(await cdp.send("Performance.getMetrics")).metrics;const start=performance.now();
 if(name==="small"||name==="large"){
  await page.getByRole("link",{name:"Clientes",exact:true}).click();
  await page.locator(`a[href="/clientes/${name==="small"?9:f.customer.id}"]`).first().click();
  const click=performance.now();await page.getByRole("tab",{name:"Estado de cuenta",exact:true}).click();
  await page.getByTestId("e7-client-export").waitFor();await page.getByTestId("e7-movements").last().waitFor();
  result.clickReadyMs=performance.now()-click;
 }else if(name==="credit"){
  await page.goto(origin+"/reportes/clientes",{waitUntil:"domcontentloaded"});await page.getByTestId("report-content-clientes").waitFor();
 }else{
  await page.goto(origin+(name==="cash"?`/cobros?tab=cartera&ticketId=${process.argv[4]}`:"/cobros"),{waitUntil:"domcontentloaded"});
  if(name==="cut"){
   await page.getByRole("combobox").first().click();await page.getByRole("option",{name:f.sites[0].nombre,exact:true}).click();
   const b=page.getByRole("button",{name:"Caja",exact:true});if(await b.count())await b.click();
   await page.getByRole("heading",{name:"Caja Operativa",exact:true}).waitFor();
   const click=performance.now();await page.getByRole("button",{name:"Realizar Corte",exact:true}).click();
   await page.getByRole("heading",{name:"Corte y Cierre de Caja",exact:true}).waitFor();await page.getByRole("dialog").getByText("Efectivo Esperado:",{exact:true}).waitFor();result.clickReadyMs=performance.now()-click;
  }else{
   const ticket=JSON.parse(fs.readFileSync(out+"/cash-persisted.json")).tickets.find(t=>t.id===Number(process.argv[4]));
   await page.getByText(`Ticket folio ${ticket.folio}`,{exact:true}).locator("xpath=../../..").getByRole("button",{name:"Cobrar",exact:true}).click();
   await page.getByRole("button",{name:"Confirmar Pago",exact:true}).waitFor();result.pendingReadyMs=performance.now()-start;
   await page.getByRole("button",{name:"Efectivo",exact:true}).click();
   await page.screenshot({path:`${out}/${name}-${sample}-ready.png`,timeout:5000});
   const click=performance.now();
   await page.getByRole("button",{name:"Confirmar Pago",exact:true}).click();
   await page.getByText("Ticket cobrado exitosamente",{exact:true}).waitFor();
   result.clickReadyMs=performance.now()-click;
  }
 }
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 result.routeReadyMs=performance.now()-start;result.ready=true;
 const after=(await cdp.send("Performance.getMetrics")).metrics;
 result.cdp=Object.fromEntries(after.filter(m=>["TaskDuration","ScriptDuration","LayoutDuration","RecalcStyleDuration","Nodes","JSHeapUsedSize"].includes(m.name)).map(m=>[m.name,{value:m.value,delta:m.value-(before.find(b=>b.name===m.name)?.value||0)}]));
 await page.screenshot({path:`${out}/${name}-${sample}.png`,timeout:5000});
}catch(e){result.error=e.message;if(page){result.body=await page.locator("body").innerText({timeout:2000}).catch(e=>e.message);await page.screenshot({path:`${out}/${name}-${sample}-blocked.png`,timeout:3000}).catch(()=>{});}}
finally{save();clearTimeout(watchdog);await browser?.close();}
console.log(JSON.stringify({name,sample,ready:result.ready,error:result.error,routeReadyMs:result.routeReadyMs}));