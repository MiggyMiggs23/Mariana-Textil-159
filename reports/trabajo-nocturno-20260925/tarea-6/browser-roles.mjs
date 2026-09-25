import fs from "node:fs";
import {randomBytes} from "node:crypto";
import {chromium} from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),dir=root+"/reports/trabajo-nocturno-20260925/tarea-6",priv=root+"/private.local/night-t56",origin="http://127.0.0.1:43927";
const stage=process.argv[2]||"create",result={stage,status:"RUNNING",steps:[]};
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const creds=fs.existsSync(priv+"/accountants.json")?JSON.parse(fs.readFileSync(priv+"/accountants.json")):{F:{username:"night56f",password:randomBytes(18).toString("hex")},A:{username:"night56a",password:randomBytes(18).toString("hex")}};
fs.writeFileSync(priv+"/accountants.json",JSON.stringify(creds),{mode:0o600});
const reused=["F","A"].includes(stage)&&fs.existsSync(priv+"/accountant-"+stage+"-browser.json");
const context=await browser.newContext({viewport:{width:1360,height:1000},...(["create","assign"].includes(stage)?{storageState:priv+"/admin-browser-state.json"}:reused?{storageState:priv+"/accountant-"+stage+"-browser.json"}:{})});
const p=await context.newPage();p.setDefaultTimeout(12000);
await p.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const snap=async(name)=>{await p.screenshot({path:`${dir}/${stage}-${name}.png`,fullPage:true});fs.writeFileSync(`${dir}/${stage}-${name}.txt`,await p.locator("body").innerText());};
try{
 if(stage==="create"||stage==="assign"){
  await p.goto(origin+"/usuarios");
  for(const role of stage==="assign"?[]:["F","A"]){
   await p.getByRole("button",{name:"Nuevo Usuario",exact:true}).click();
   await p.locator("#user-name").fill("NOCTURNO56 CONTADOR "+role);await p.locator("#user-username").fill(creds[role].username);
   await p.getByRole("dialog").getByRole("combobox").first().click();await p.getByRole("option",{name:"Contador",exact:true}).click();
   await p.locator("#user-password").fill(creds[role].password);await snap(role+"-before");
   const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"),p.getByRole("button",{name:"Crear usuario",exact:true}).click()]);
   const b=await r.json();result.steps.push({action:"create-"+role,status:r.status(),id:b.id});
   if(r.status()>=400)throw Error(JSON.stringify(b));creds[role].id=b.id;
   fs.writeFileSync(priv+"/accountants.json",JSON.stringify(creds),{mode:0o600});
   await p.getByRole("dialog").waitFor({state:"hidden"});await snap(role+"-created");
  }
  await p.getByRole("row").filter({hasText:"night56a"}).getByRole("button",{name:"Perfil contable A/F",exact:true}).click();
  await p.getByRole("dialog").locator("select").selectOption("A");await p.getByRole("dialog").locator("textarea").fill("ENSAYO56 perfil A autorizado solo desechable");
  await p.getByRole("button",{name:"Revisar cambio de perfil",exact:true}).click();await snap("A-assignment-before");
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="PUT"&&r.url().includes("/perfil")),p.getByRole("button",{name:"Confirmar asignación ADMIN",exact:true}).click()]);
  const b=await r.json();result.steps.push({action:"assign-A",status:r.status(),body:b});if(r.status()>=400)throw Error(JSON.stringify(b));
  await p.getByText(/Perfil A confirmado/).waitFor();await snap("A-assigned");
 }else{
  const role=stage;if(!reused){await p.goto(origin+"/login");await p.getByLabel("Usuario",{exact:true}).fill(creds[role].username);await p.getByLabel("Contraseña",{exact:true}).fill(creds[role].password);
  const [login]=await Promise.all([p.waitForResponse(r=>r.url().endsWith("/api/auth/login")),p.getByRole("button",{name:"Ingresar",exact:true}).click()]);
  if(login.status()!==200)throw Error("Native login "+login.status());await p.waitForURL(u=>!u.pathname.includes("login"));}else await p.goto(origin+"/");
  await p.getByRole("heading",{name:"Contabilidad · "+role,exact:true}).waitFor();await snap("home");
  const api=async path=>p.evaluate(async path=>{const r=await fetch(path,{credentials:"include"});return {status:r.status,body:await r.json()};},path);
  const identity=await api("/api/e11/identidad");const identityBody=identity.body;
  result.steps.push({action:"identity",status:identity.status,body:identityBody});
  if(identityBody.perfil!==role)throw Error("Wrong effective profile");
  for(const endpoint of ["/api/fondo","/api/proveedores/1/pagos","/api/tickets/1","/api/clientes/1","/api/e11/fiscal/facturas/1","/api/e11/fiscal/facturas/2"]){
   const r=await api(endpoint);result.steps.push({action:"authenticated-probe",endpoint,...r});
  }
  if(role==="F"){
   await p.getByLabel("Desde (día CDMX)",{exact:true}).fill("2026-09-24");
   await p.getByLabel("Hasta, exclusivo (día CDMX)",{exact:true}).fill("2026-09-25");
   await p.getByRole("button",{name:"Consultar intervalo",exact:true}).click();
   await p.getByRole("link",{name:"Documento interno 1001",exact:true}).waitFor();await snap("invoiced-list");
   if(await p.getByRole("link",{name:"Documento interno 1000",exact:true}).count())throw Error("Uninvoiced document leaked in fiscal UI");
   await p.getByRole("link",{name:"Documento interno 1001",exact:true}).click();await p.getByText("1160.00",{exact:false}).count();await snap("invoiced-detail");
   result.steps.push({action:"native-invoiced-list-and-detail",status:"PASS",included:1001,excluded:1000});
  }
  await p.getByRole("link",{name:role==="F"?"Conciliaciones":"Clientes",exact:true}).count().then(n=>result.steps.push({action:"navigation-link-count",role,count:n}));
  await p.goto(origin+"/fondo");await p.getByText(/no puede acceder|no autorizada|sin acceso/i).first().waitFor();await snap("fondo-denied");
  await p.goto(origin+(role==="F"?"/contabilidad/conciliaciones":"/contabilidad/preparaciones"));
  await p.waitForTimeout(700);await snap("documentary-or-preparation");
  await context.storageState({path:priv+"/accountant-"+role+"-browser.json"});fs.chmodSync(priv+"/accountant-"+role+"-browser.json",0o600);
 }
 result.status="PASS_STEPS_ONLY";
}catch(e){result.status="BLOCKED";result.error=e.message;await snap("blocked").catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(`${dir}/${stage}-result.json`,JSON.stringify(result,null,2));await browser.close();}
console.log(JSON.stringify(result));