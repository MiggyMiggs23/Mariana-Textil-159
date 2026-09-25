import fs from "node:fs";
import {chromium} from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),dir=root+"/reports/trabajo-nocturno-20260925/tarea-6",origin="http://127.0.0.1:43927",result={cases:[]};
const b=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const ctx=await b.newContext({storageState:root+"/private.local/night-t56/accountant-F-browser.json",viewport:{width:1360,height:1000}});
const p=await ctx.newPage();p.setDefaultTimeout(12000);
await p.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
for(const [type,start,outcome] of [["DIA","2026-08-01","ACEPTADA"],["SEMANA","2026-08-03","ACEPTADA"],["MES","2026-08-01","ACEPTADA"],["DIA","2026-08-02","NO_CUADRA"]]){
 const item={type,start,outcome,status:"RUNNING"};result.cases.push(item);const prefix=`${dir}/reconcile-${type}-${outcome}`;
 try{
  await p.goto(origin+"/contabilidad/conciliaciones");
  const article=p.locator("article").filter({has:p.getByRole("heading",{name:new RegExp("^"+type+" · "+start)})});
  await article.getByRole("button",{name:"Revisar y congelar periodo",exact:true}).click();
  await p.getByRole("button",{name:"Revisar snapshot",exact:true}).click();
  await p.screenshot({path:prefix+"-before.png",fullPage:true});
  const [r]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/e11/conciliaciones"),p.getByRole("button",{name:"Confirmar snapshot inmutable",exact:true}).click()]);
  const snapshot=await r.json();item.snapshotStatus=r.status();if(r.status()>=400)throw Error(JSON.stringify(snapshot));item.id=snapshot.id;
  await p.goto(origin+"/contabilidad/conciliaciones/"+snapshot.id);
  await p.locator("select").selectOption(outcome);
  await p.getByLabel("Total del registro externo",{exact:true}).fill(snapshot.totalFacturado);
  await p.getByLabel("Referencia externa obligatoria (texto)",{exact:true}).fill("ENSAYO56-"+type+"-"+outcome);
  if(outcome==="NO_CUADRA")await p.locator("textarea").fill("Ensayo documental: discrepancia de composición con total cero en periodo vacío de copia sintética.");
  await p.getByRole("button",{name:"Revisar decisión documental",exact:true}).click();
  const [decision]=await Promise.all([p.waitForResponse(r=>r.request().method()==="POST"&&r.url().endsWith("/decisiones")),p.getByRole("button",{name:"Confirmar decisión",exact:true}).click()]);
  item.decisionStatus=decision.status();item.response=await decision.json();if(decision.status()>=400)throw Error(JSON.stringify(item.response));
  await p.getByText("Decisión documental registrada en la evidencia. Consulta la revisión actualizada.",{exact:true}).waitFor();
  await p.screenshot({path:prefix+"-after.png",fullPage:true});item.status="PASS";
 }catch(e){item.status="BLOCKED";item.error=e.message;await p.screenshot({path:prefix+"-blocked.png",fullPage:true}).catch(()=>{});fs.writeFileSync(prefix+"-blocked.txt",await p.locator("body").innerText().catch(()=>""));break;}
}
fs.writeFileSync(dir+"/reconciliation-result.json",JSON.stringify(result,null,2));await b.close();console.log(JSON.stringify(result));