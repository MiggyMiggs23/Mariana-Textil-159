import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root="reports/postrelease-review-20260926/tarea-3";
const cfg=JSON.parse(fs.readFileSync(root+"/browser-targeted-ready.json"));
assert.equal(cfg.origin,"http://127.0.0.1:18338");
assert.ok(cfg.privateCredentials.includes("/postreview_permissions_20260926/"));
const credentials=JSON.parse(fs.readFileSync(cfg.privateCredentials));
const fixtures=JSON.parse(fs.readFileSync(root+"/fixtures.json"));
const folder=root+"/native-targeted-"+Date.now();fs.mkdirSync(folder);
const result={status:"RUNNING",origin:cfg.origin,policy:"Business mutations blocked; only login and audit1 participation/heartbeat allowed",actors:[],cells:[],requests:[],preventedMutations:[]};
const save=()=>fs.writeFileSync(folder+"/result.json",JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const observe=async l=>({count:await l.count(),visible:await l.first().isVisible(),enabled:await l.count()?await l.first().isEnabled():false});
const settle=async p=>{await p.waitForTimeout(1800);await p.waitForLoadState("networkidle",{timeout:4000}).catch(()=>{});};
const capture=async(p,role,operation,control,extra={})=>{
  const file=folder+"/"+role+"-"+operation+".png";await p.screenshot({path:file,fullPage:true});
  const text=await p.locator("body").innerText();
  fs.writeFileSync(folder+"/"+role+"-"+operation+".txt",text);
  result.cells.push({role,operation,control:await observe(control),file,...extra,boundary:text.split("\n").filter(x=>/sin acceso|no tienes|sin permiso|participante|piso real|ABIERTA|Abierta/i.test(x))});save();
};
try{
 for(const role of (process.env.UI_ROLES?.split(",")??["ADMIN","CAJA","TERMINAL","SUPERVISOR","BODEGA","SISTEMAS"])){
  const context=await browser.newContext({viewport:{width:1360,height:1000},timezoneId:"America/Mexico_City"});
  await context.route("**/*",route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin!==cfg.origin)return route.abort();
   if(!["GET","HEAD"].includes(r.method())&&!(r.method()==="POST"&&["/api/auth/login","/api/inventario/auditorias/1/participar"].includes(u.pathname))){
    result.preventedMutations.push({role,path:u.pathname,method:r.method()});save();return route.abort();
   }
   return route.continue();
  });
  const p=await context.newPage();p.setDefaultTimeout(12000);
  p.on("response",r=>{const u=new URL(r.url());if(u.pathname.startsWith("/api/"))result.requests.push({role,path:u.pathname,method:r.request().method(),status:r.status()});});
  try{
   const r=await p.goto(cfg.origin+"/login"),h=await r.allHeaders();
   assert.equal(h["x-priority-api-sha256"],"3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea");
   assert.equal(h["x-priority-ui-sha256"],"af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5");
   assert.equal(h["x-priority-clock"],"system");
   await p.getByLabel("Usuario",{exact:true}).fill(credentials[role].usuario);
   await p.getByLabel("Contraseña",{exact:true}).fill(credentials[role].password);
   await p.getByRole("button",{name:"Ingresar",exact:true}).click();await p.waitForURL(u=>u.pathname!=="/login");
   const me=await p.evaluate(async()=>{const r=await fetch("/api/auth/me");return r.json();});assert.equal(me.rol,role);
   result.actors.push({role,id:me.id,site:me.ubicacion?.id,permissions:me.permisos});
   await p.goto(cfg.origin+"/inventario/auditorias");await settle(p);
   const site=p.getByTestId("select-audit-site");
   if(await site.count()&&await site.isEnabled()){
    await site.click();const option=p.getByRole("option").filter({hasText:/· Mariana$/});await option.click();await settle(p);
    const history=p.getByTestId("button-audit-1");if(await history.count())await history.click();await settle(p);
    const join=p.getByTestId("button-audit-detail-join");
    if(await join.isVisible()){
     const response=p.waitForResponse(r=>new URL(r.url()).pathname==="/api/inventario/auditorias/1/participar"&&r.request().method()==="POST");
     await join.click();assert.equal((await response).status(),200);await settle(p);
    }
   }
   await capture(p,role,"audit-scan",p.getByTestId("input-audit-scan"),{fixture:1,floor:await p.getByTestId("audit-floor-name").innerText().catch(()=>null)});
   await capture(p,role,"audit-confirm",p.getByTestId("button-confirm-audit"),{fixture:1,eligibility:"No close/count/confirm performed; if audit is open, confirmation absence is not action-permission evidence."});
   if(role!=="CAJA"){
    await p.goto(cfg.origin+"/cobros");await settle(p);
    const combo=p.getByRole("combobox").first();
    if(await combo.count()&&await combo.isEnabled()){await combo.click();const option=p.getByRole("option",{name:"Mariana",exact:true});if(await option.count())await option.click();else await p.keyboard.press("Escape");await settle(p);}
    const caption=p.getByText("Ticket folio 1",{exact:true});
    if(role==="ADMIN")await caption.waitFor({timeout:20000});
    const visible=await caption.count()>0;
    await capture(p,role,"ticket1-collect",visible?caption.locator("xpath=ancestor::div[.//button[normalize-space()='Cobrar']][1]").getByRole("button",{name:"Cobrar",exact:true}):p.getByRole("button",{name:"Cobrar",exact:true}),{fixture:1,fixtureVisible:visible});
   }
   if(["ADMIN","CAJA"].includes(role)){
    await p.goto(cfg.origin+"/salidas");await settle(p);
    const combo=p.getByRole("combobox").first();
    if(await combo.count()&&await combo.isEnabled()){await combo.click();const option=p.getByRole("option",{name:"Mariana",exact:true});if(await option.count())await option.click();else await p.keyboard.press("Escape");await settle(p);}
    const folio=fixtures.salida.data.folioFormateado;
    await capture(p,role,"salida1-cancel",p.getByRole("button",{name:`Cancelar salida ${folio}`,exact:true}),{fixture:1,folio,fixtureVisible:(await p.locator("body").innerText()).includes(folio)});
   }
  }catch(e){result.cells.push({role,error:e.message});save();}
  finally{await context.close();}
 }
}finally{
 await browser.close();result.status=result.cells.some(c=>c.error)?"OBSERVATIONS_WITH_BLOCKER":"TARGETED_OBSERVATIONS_COMPLETE";save();
 console.log(JSON.stringify({status:result.status,evidence:folder,cells:result.cells.map(c=>({role:c.role,operation:c.operation,control:c.control,fixtureVisible:c.fixtureVisible,floor:c.floor,error:c.error})),preventedMutations:result.preventedMutations.length,serverErrors:result.requests.filter(r=>r.status>=500).length}));
}