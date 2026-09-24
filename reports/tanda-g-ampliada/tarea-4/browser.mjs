import fs from "node:fs";
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY="1";
import {chromium} from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),out=root+"/reports/tanda-g-ampliada/tarea-4/browser"+(process.env.PERF_RUN?"/"+process.env.PERF_RUN:""),origin="http://127.0.0.1:43864";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:root+"/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",env:{...process.env,LD_LIBRARY_PATH:root+"/.local/tanda-g-ampliada/performance-browser-libs"},args:["--no-sandbox"],timeout:20000});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 page.setDefaultTimeout(20000);
 await page.route("**/*",route=>{const u=new URL(route.request().url());return u.origin===origin||["data:","blob:"].includes(u.protocol)?route.continue():route.abort();});
 const role=process.env.PERF_ROLE||"admin",creds=JSON.parse(fs.readFileSync(root+"/.local/tanda-g-ampliada/credentials.json"))[role];
 await page.goto(origin+"/login");await page.getByLabel("Usuario",{exact:true}).fill(creds.username);await page.getByLabel("Contraseña",{exact:true}).fill(creds.password);
 await page.getByRole("button",{name:"Ingresar",exact:true}).click();await page.waitForURL(u=>!u.pathname.includes("login"));
 const requests=[],requestSamples=new WeakMap();let sample=null;
 page.on("request",req=>requestSamples.set(req,sample));
 page.on("requestfailed",req=>{if(requestSamples.get(req))requests.push({sample:requestSamples.get(req),url:new URL(req.url()).pathname,failure:req.failure()});});
 page.on("requestfinished",req=>{if(requestSamples.get(req)&&req.url().startsWith(origin+"/api/"))requests.push({sample:requestSamples.get(req),url:new URL(req.url()).pathname+new URL(req.url()).search,method:req.method(),timing:req.timing()});});
 page.on("response",res=>{if(requestSamples.get(res.request())&&res.url().startsWith(origin+"/api/"))requests.push({sample:requestSamples.get(res.request()),url:new URL(res.url()).pathname,status:res.status()});});
 const cases=process.env.PERF_PROBE?[{name:"probe",path:process.env.PERF_PROBE}]:[
  {name:"cashier",path:"/cobros"},
  {name:"client_statement",path:"/clientes/8"},
  {name:"grouped_stock",path:"/inventario"},
  {name:"cash_cut",path:"/cobros"},
  {name:"credit_reports",path:"/reportes/clientes"},
 ];
 for(const test of cases.filter(t=>!process.env.PERF_CASES||process.env.PERF_CASES.split(",").includes(t.name))){
  for(let i=0;i<(process.env.PERF_PROBE?1:3);i++){
   sample=test.name+"-"+i;const start=performance.now();let error=null;
   try{
    await page.goto(origin+test.path,{waitUntil:"domcontentloaded"});
    if(test.name==="probe"){await page.waitForTimeout(4000);}
    if(test.name==="cashier"||test.name==="cash_cut"){
     if(role==="admin"){await page.getByRole("combobox").first().click();await page.getByRole("option",{name:/TANDA GA TIENDA 1/}).click();}
     const cashButton=page.getByRole("button",{name:"Caja",exact:true});if(await cashButton.count())await cashButton.click();
     await page.getByRole("heading",{name:"Caja Operativa",exact:true}).waitFor();
     await page.getByRole("button",{name:"Cobrar",exact:true}).first().waitFor();
     if(test.name==="cash_cut"){await page.getByRole("button",{name:"Realizar Corte",exact:true}).click();await page.getByRole("heading",{name:"Corte y Cierre de Caja",exact:true}).waitFor();await page.getByRole("dialog").getByText("Efectivo esperado",{exact:false}).first().waitFor();}
    }
    if(test.name==="client_statement"){
     await page.getByRole("tab",{name:"Estado de cuenta",exact:true}).click();
     await page.getByTestId("e7-movements").waitFor();
     await page.getByTestId("e7-movements").locator("tbody tr").first().waitFor();
    }
    if(test.name==="grouped_stock"){
     await page.getByRole("heading",{name:"Control de Inventario"}).waitFor();
     await page.getByText("Cargando inventario...",{exact:true}).waitFor({state:"hidden"});
     await page.locator("tbody tr").filter({hasText:"TANDA GA"}).first().waitFor();
    }
    if(test.name==="credit_reports"){
     await page.getByRole("heading",{name:"Reportes y Decisiones"}).waitFor();
     await page.getByTestId("report-content-clientes").waitFor();
    }
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   }catch(e){error=e.message;}
   const elapsedMs=performance.now()-start;
   results.push({name:test.name,role,sample:i,elapsedMs,error,ready:!error});
   fs.writeFileSync(out+"/results-"+role+".json",JSON.stringify({origin,firstTouchOnly:true,results,requests},null,2));
   try{await page.screenshot({path:out+"/"+sample+".png",fullPage:false,timeout:8000});}catch(e){fs.writeFileSync(out+"/"+sample+"-screenshot-error.txt",e.message);}
   let text="";
   try{text=await page.locator("body").innerText({timeout:5000});fs.writeFileSync(out+"/"+sample+".txt",text);}catch{}
   console.log(JSON.stringify({name:test.name,sample:i,elapsedMs,error,bodyTail:text.slice(-1200)}));
   sample=null;
   if(error)break;
  }
 }
}finally{await browser.close();}