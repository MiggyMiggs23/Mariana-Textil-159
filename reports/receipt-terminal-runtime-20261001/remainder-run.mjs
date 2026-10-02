// MAIN ONLY. Reuses existing isolated data; owns a NEW browser only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {randomUUID} from "node:crypto";
import {login,control,receiptPaths,assertAuditDelta} from "./browser-tools.mjs";
import {verifyApprovedGuard} from "./approved-guard-proof.mjs";

const [authorization,runArg,focus]=process.argv.slice(2);
assert.equal(authorization,"--main-authorized");
assert.ok(!focus||focus==="--skip-terminal-e3","Optional continuation flag: --skip-terminal-e3");
assert.ok(runArg,"Existing isolated run directory is required; no bootstrap or receipt creation");
const run=fs.realpathSync(runArg);
assert.equal(path.dirname(run),fs.realpathSync(import.meta.dirname),"Only owned receipt harness runs");
const read=file=>JSON.parse(fs.readFileSync(path.join(run,file),"utf8"));
const credentials=read("credentials.json"),fixture=read("fixture.json");
const receipts=read("browser-receipts.json");
const state=read("result.json");
assert.equal(state.status,"READY_FOR_TESTING_AGENT");
assert.equal(credentials.origin,state.origin);
assert.match(credentials.origin,/^https:\/\/127\.0\.0\.1:\d+$/);
assert.ok(fs.existsSync(path.join(run,"financial-before.json")),"Existing post-reception baseline required");
const out=fs.mkdtempSync(path.join(run,"remainder-"));fs.chmodSync(out,0o700);
const result={status:"RUNNING",out,started:new Date().toISOString(),ownerPid:process.pid,
  continuation:focus||null,
  origin:credentials.origin,newReceiptsCreated:false,checks:[],prints:[],expected:[],
  instrumentation:"Fresh native Playwright browser. Only window.print stub and deferred removal of already-present app e5-print; no debugger, CSS or class injection."};
const write=(file,data)=>fs.writeFileSync(path.join(out,file),JSON.stringify(data,null,2),{mode:0o600});
const save=()=>write("result.json",result);
let server,browser,current,terminalChanged=false;
save();console.log(JSON.stringify({out,status:result.status}));
const bounded=(promise,ms,label)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(`${label} exceeded ${ms}ms`)),ms);
  promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
});
// Hard terminal limit even if a browser transport promise never settles.
const watchdog=setTimeout(()=>{
  result.status="TIMEOUT";result.error="Hard 240-second limit; owned browser killed, existing harness preserved";save();
  server?.process()?.kill("SIGKILL");process.exit(124);
},240000);
const record=(name,evidence)=>{result.checks.push({name,...evidence});save();};
const command=(name,args)=>{
  const r=spawnSync(name,args,{encoding:"utf8",timeout:12000,maxBuffer:4*1024*1024});
  assert.equal(r.status,0,`${name} failed: ${r.stderr}`);return r.stdout;
};
const ownSite=fixture.sites[0].id;
const own=receipts.filter(r=>r.site===ownSite);
assert.equal(own.filter(r=>r.family==="e3").length,1);
assert.equal(own.filter(r=>r.family==="e5").length,2);
const foreign=fixture.receipts.filter(r=>r.site!==ownSite);
assert.ok(foreign.some(r=>r.family==="e3")&&foreign.some(r=>r.family==="e5"));
const terminal=fixture.actors.find(a=>a.role==="TERMINAL");
const custom=fixture.actors.find(a=>a.variant==="custom-granted");
const customOff=fixture.actors.find(a=>a.variant==="custom-denied");
assert.ok(terminal&&custom&&customOff);
const descriptor=r=>({family:r.family,folio:r.folio,id:r.id,documentId:r.documentId,source:r.source});
async function session(actor,allowed){
  if(current){await bounded(current.context.close(),5000,"Close previous fresh context");current=null;}
  current=await bounded(login(browser,credentials.origin,actor.username,credentials.password),35000,`Login ${actor.role}`);
  current.page.setDefaultTimeout(12000);
  current.page.setDefaultNavigationTimeout(15000);
  const me=await current.api("GET","/api/auth/me");
  assert.equal(me.body.id,actor.id);
  const permission=me.body.permisos.find(p=>p.modulo==="recibos_abonos");
  assert.equal(permission?.puedeVer,allowed,`Effective ${actor.role} receipt permission`);
  record("fresh-context-permission",{actorId:actor.id,role:actor.role,permission});
  return current;
}
async function lists(s,allowed,scope=true){
  for(const url of ["/api/caja/recibos-e3","/api/e5/recibos"]){
    const r=await s.api("GET",url);assert.equal(r.status,allowed?200:403,JSON.stringify(r));
    if(allowed&&scope){
      const rows=r.body;assert.ok(Array.isArray(rows));
      for(const item of own.filter(x=>url.includes("/e5/")?x.family==="e5":x.family==="e3"))
        assert.ok(rows.some(row=>item.family==="e3"?row.folio===item.folio:row.id===item.documentId),"Own receipt missing from list");
      for(const item of foreign){
        const json=JSON.stringify(rows);
        assert.ok(!json.includes(item.family==="e3"?item.folio:item.documentId),"Other-store receipt leaked in list");
        const source=fixture.sources.find(x=>x.client===item.client);
        assert.ok(!json.includes(source.clientName),"Other-store customer leaked");
        const search=await s.api("GET",`${url}?buscar=${encodeURIComponent(source.clientName)}`);
        assert.equal(search.status,200);assert.deepEqual(search.body,[]);
      }
    }
    record("receipt-list",{actorId:(await s.api("GET","/api/auth/me")).body.id,...r});
  }
}
async function discover(s,r,label,scoped=true){
  const p=s.page,paths=receiptPaths(r);
  await p.goto(credentials.origin+"/recibos-abonos");
  const search=p.getByLabel("Buscar recibos por folio o cliente",{exact:true});
  await search.waitFor();
  await p.locator(`a[href="${paths.ui}"]`).first().waitFor();
  for(const other of scoped?foreign:[]){
    assert.equal(await p.locator(`a[href="${receiptPaths(other).ui}"]`).count(),0);
    const source=fixture.sources.find(x=>x.client===other.client);
    assert.ok(!(await p.locator("body").innerText()).includes(source.clientName),"Foreign customer in visible unfiltered discovery");
  }
  await p.screenshot({path:path.join(out,`${label}-unfiltered.png`),fullPage:true});
  const name=r.body?.clienteNombre||r.body?.recibo?.clienteNombre;
  await search.fill(name);
  const link=p.locator(`a[href="${paths.ui}"]`).first();await link.waitFor();
  for(const other of scoped?foreign:[])assert.equal(await p.locator(`a[href="${receiptPaths(other).ui}"]`).count(),0);
  await p.screenshot({path:path.join(out,`${label}-discovery.png`),fullPage:true});
  await link.click();await p.waitForURL(`**${paths.ui}`);
  const doc=await s.api("GET",paths.get);assert.equal(doc.status,200,JSON.stringify(doc));
  const body=doc.body;
  assert.ok(body.folio&&body.clienteNombre);
  return {paths,body};
}
async function print(s,actor,r,label,document){
  const page=s.page,paths=receiptPaths(r);
  // Defers only the app's cleanup of its own real class, after native print
  // is requested. In particular, this never adds e5-print or any styles.
  await page.evaluate(()=>{
    const originalRemove=DOMTokenList.prototype.remove,originalPrint=window.print;
    const capture={requested:false,classAtPrint:false,deferred:0};
    window.__receiptCapture=capture;
    DOMTokenList.prototype.remove=function(...tokens){
      if(this===document.body.classList&&tokens.includes("e5-print")&&capture.requested&&this.contains("e5-print")){
        capture.deferred++;const other=tokens.filter(t=>t!=="e5-print");
        if(other.length)originalRemove.apply(this,other);return;
      }
      return originalRemove.apply(this,tokens);
    };
    window.print=()=>{capture.requested=true;capture.classAtPrint=document.body.classList.contains("e5-print");};
    window.__releaseReceiptCapture=()=>{
      DOMTokenList.prototype.remove=originalRemove;window.print=originalPrint;
      if(capture.deferred)originalRemove.call(document.body.classList,"e5-print");
      delete window.__releaseReceiptCapture;
    };
  });
  try{
    const reason=page.getByLabel("Motivo de impresión / reimpresión",{exact:true});
    // E5 body mounts asynchronously after discovery navigation. count() is
    // instantaneous and used to skip the required motive before it mounted.
    if(r.family==="e5"){
      await reason.waitFor({state:"visible",timeout:15000});
      await reason.fill(`Bounded isolated receipt proof ${label}`);
      assert.equal(await reason.inputValue(),`Bounded isolated receipt proof ${label}`);
    }
    write(`${label}-before-click.json`,await page.evaluate(()=>({
      url:location.pathname,text:document.body.innerText,
      motive:Array.from(document.querySelectorAll("input")).map(n=>({value:n.value,disabled:n.disabled})),
      readyPages:document.querySelectorAll(".e3-sheet:not(.e3-probe),.e5-doc-sheet:not(.e5-doc-probe)").length
    })));
    const responsePromise=page.waitForResponse(x=>new URL(x.url()).pathname===paths.print&&x.request().method()==="POST",{timeout:15000});
    responsePromise.catch(()=>{});
    await page.getByRole("button",{name:"Solicitar impresión / reimpresión",exact:true}).click({timeout:15000});
    const response=await responsePromise;assert.equal(response.status(),200,await response.text());
    await page.waitForFunction(()=>window.__receiptCapture?.requested===true,{},{timeout:15000});
    const capture=await page.evaluate(()=>({...window.__receiptCapture,bodyClass:document.body.className}));
    if(r.family==="e5"){assert.equal(capture.classAtPrint,true);assert.ok(capture.deferred>0);assert.ok(capture.bodyClass.split(" ").includes("e5-print"));}
    await page.screenshot({path:path.join(out,`${label}-print-state.png`),fullPage:true,timeout:12000});
    const file=path.join(out,`${label}.pdf`);
    await bounded(page.pdf({path:file,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false}),15000,"Natural PDF");
    const info=command("pdfinfo",[file]),textFile=path.join(out,`${label}.txt`);
    command("pdftotext",["-layout",file,textFile]);
    const text=fs.readFileSync(textFile,"utf8");
    assert.ok(text.includes(document.folio));assert.ok(text.includes(document.clienteNombre));
    const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    assert.ok(pages>0);const chunks=text.split("\f");if(!chunks.at(-1).trim())chunks.pop();
    assert.equal(chunks.length,pages);for(const chunk of chunks)assert.ok(chunk.replace(/\s/g,"").length>60,"Blank PDF page");
    command("pdftoppm",["-png","-r","80",file,path.join(out,`${label}-raster`)]);
    result.prints.push({label,actorId:actor.id,receipt:descriptor(r),file,pages,info,capture,textLength:text.length,auditStatus:response.status()});
    result.expected.push({actorId:actor.id,family:r.family,document:r.family==="e3"?r.folio:r.documentId});
    save();
  }finally{await bounded(page.evaluate(()=>window.__releaseReceiptCapture?.()),4000,"Release real application cleanup").catch(()=>{});}
}
async function deny(s,r,label){
  const paths=receiptPaths(r),checks=[];
  for(const [method,url,body] of [["GET",paths.get],["POST",paths.print,{motivo:"Denied remainder proof",...(r.family==="e5"?{claveOperacion:randomUUID()}:{})}]]){
    const response=await s.api(method,url,body);checks.push(response);
    assert.ok([403,404].includes(response.status),JSON.stringify(response));
    for(const key of ["clienteNombre","clienteId","importeRecibido","importeCentavos","snapshot","notasIndicadas","sitioNombre"])
      assert.ok(!JSON.stringify(response.body).includes(`"${key}"`),`Denial metadata ${key}`);
  }
  await s.page.goto(credentials.origin+paths.ui);
  await s.page.waitForFunction(()=>!document.body.innerText.includes("Cargando")&&
    /Sin acceso|sin permiso|no existe|no hay evidencia|no permitido|no autorizado|fuera|snapshot|no disponible|no encontrado|no pertenece|denegado|no puede|prohibido/i.test(document.body.innerText),{},{timeout:12000});
  assert.equal(await s.page.getByRole("button",{name:"Solicitar impresión / reimpresión",exact:true}).count(),0);
  const name=r.body?.clienteNombre||r.body?.recibo?.clienteNombre;
  if(name)assert.ok(!(await s.page.locator("body").innerText()).includes(name));
  await s.page.screenshot({path:path.join(out,`${label}-denied.png`),fullPage:true});
  record(label,{receipt:descriptor(r),checks});
}
let auditBefore;
try{
  result.approvedGuardBefore=await bounded(verifyApprovedGuard(run),15000,"Approved guard identity/hash");
  save();
  const {chromium}=await import(pathToFileURL(credentials.playwright));
  // launchServer provides an exact owned child PID for hard timeout cleanup.
  server=await chromium.launchServer({executablePath:"/repl/tools/bin/chromium",headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage"],timeout:20000});
  result.browserPid=server.process().pid;save();
  browser=await chromium.connect(server.wsEndpoint(),{timeout:15000});
  await control(run,"audit");auditBefore=read("audit-current.json");write("audit-start.json",auditBefore);
  result.preexistingAuditCount=auditBefore.audit.length;
  result.preexistingSinceFinancialBaseline=auditBefore.audit.filter(a=>!read("audit-before.json").audit.some(b=>b.id===a.id));
  // Earlier aborted attempts are preserved and reported, not erased or counted
  // as this run's prints.
  let s=await session(terminal,true);await lists(s,true);
  for(const r of own.filter(r=>focus!=="--skip-terminal-e3"||r.family!=="e3")){const label=`terminal-${r.source||r.family}`;const doc=await discover(s,r,label);
    await print(s,terminal,r,`${label}-1`,doc.body);await print(s,terminal,r,`${label}-2`,doc.body);}
  for(const [i,r] of foreign.entries())await deny(s,r,`foreign-${i}`);
  for(const actor of [fixture.admin,custom]){
    s=await session(actor,true);await lists(s,true,actor!==fixture.admin);
    for(const r of [own.find(r=>r.family==="e3"),own.find(r=>r.family==="e5")]){
      const label=`${actor===fixture.admin?"admin-default":"custom-granted"}-${r.family}`;
      const doc=await discover(s,r,label,actor!==fixture.admin);await print(s,actor,r,label,doc.body);
    }
  }
  s=await session(customOff,false);await lists(s,false);
  for(const r of [own[0],own.find(x=>x.family==="e5")])await deny(s,r,`custom-denied-${r.family}`);
  await control(run,"terminal-permission",{allowed:false});terminalChanged=true;
  s=await session(terminal,false);await lists(s,false);
  await s.page.goto(credentials.origin+"/recibos-abonos");
  await s.page.getByRole("heading",{name:"Sin acceso",exact:true}).waitFor();
  await s.page.screenshot({path:path.join(out,"terminal-discovery-denied.png"),fullPage:true});
  for(const [i,r] of own.entries())await deny(s,r,`terminal-denied-${i}`);
  await control(run,"terminal-permission",{allowed:true});terminalChanged=false;
  s=await session(terminal,true);await lists(s,true);
  for(const r of [own.find(x=>x.family==="e3"),own.find(x=>x.family==="e5")]){
    const label=`terminal-restored-${r.family}`,doc=await discover(s,r,label);
    await print(s,terminal,r,label,doc.body);
  }
  await control(run,"compare");
  // nativeGuards stores pg_get_triggerdef, NOT pg_get_functiondef. The
  // approved function-only DDL changes no field in the original financial
  // snapshot. Therefore keep exact comparison: never mask a guard mismatch.
  assert.deepEqual(read("financial-after.json"),read("financial-before.json"),
    "Original financial rows or native trigger definitions changed");
  result.approvedGuardAfter=await bounded(verifyApprovedGuard(run),15000,"Final approved guard identity/hash");
  const after=read("audit-after.json");write("audit-end.json",after);
  assertAuditDelta(auditBefore,after,result.expected);
  result.financialUnchanged=true;result.auditDeltaPassed=true;
  result.status="PASS_DIGITAL_ASSERTIONS_RASTER_REVIEW_REQUIRED";
}catch(error){
  result.status="FAIL";result.error=String(error?.stack||error).replaceAll(credentials.password,"[REDACTED]");
  save();
  if(current)try{
    await bounded(current.page.screenshot({path:path.join(out,"failure-ui.png"),fullPage:true}),5000,"Failure screenshot");
    write("failure-ui.json",await bounded(current.page.evaluate(()=>({url:location.pathname,text:document.body.innerText,
      inputs:Array.from(document.querySelectorAll("input")).map(n=>({value:n.value,disabled:n.disabled})),
      printButtons:Array.from(document.querySelectorAll("button")).filter(n=>n.textContent.includes("impresión")).map(n=>({text:n.textContent,disabled:n.disabled})),
      e5Pages:document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length})),3000,"Failure DOM"));
  }catch{}
  // Bounded evidence and financial comparison on failure, not a new baseline.
  try{await bounded(control(run,"compare"),12000,"Failure financial compare");result.financialUnchanged=true;}catch(e){result.compareError=String(e.message);}
  try{await bounded(control(run,"audit"),8000,"Failure audit");write("audit-failure.json",read("audit-current.json"));}catch{}
}finally{
  if(terminalChanged)try{await bounded(control(run,"terminal-permission",{allowed:true}),8000,"Restore own actor permission");}catch(e){result.restoreError=e.message;}
  try{await bounded(browser?.close()||Promise.resolve(),5000,"Close owned browser");}catch{server?.process()?.kill("SIGKILL");}
  try{await bounded(server?.close()||Promise.resolve(),3000,"Close owned browser server");}catch{server?.process()?.kill("SIGKILL");}
  clearTimeout(watchdog);result.finished=new Date().toISOString();result.existingHarnessPreserved=true;save();
}
console.log(JSON.stringify({out,status:result.status,financialUnchanged:result.financialUnchanged,auditDeltaPassed:result.auditDeltaPassed}));
process.exitCode=result.status.startsWith("PASS")?0:1;