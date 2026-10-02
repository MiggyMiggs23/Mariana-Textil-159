import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
export {login} from "../permission-nine-runtime-20261001/cases.mjs";

export async function control(run, action, extra={}) {
  const id=randomUUID(),file=path.join(run,"control.json");
  assert.ok(!fs.existsSync(file),"A control command is already pending");
  fs.writeFileSync(file,JSON.stringify({id,action,...extra}),{mode:0o600});
  const result=path.join(run,`control-result-${id}.json`);
  for(let i=0;i<120;i++){
    if(fs.existsSync(result)){const r=JSON.parse(fs.readFileSync(result));assert.equal(r.ok,true,JSON.stringify(r));return r;}
    await new Promise(r=>setTimeout(r,500));
  }
  throw Error(`Control ${id} timed out; do not assume completed`);
}
const command=(name,args)=>{const r=spawnSync(name,args,{encoding:"utf8",timeout:60000});assert.equal(r.status,0,`${name}: ${r.stderr}`);return r.stdout;};

// Freeze ONLY the native print invocation. The app performs its actual button
// handler, freshness check, audit POST and temporary e5-print class itself.
// CDP captures while JS is paused at window.print, before finally removes it.
// Never manually add a class, inject CSS, replace HTTP, or select page ranges.
export async function auditedPdf({page,out,name,expectedText,auditPath}) {
  assert.match(name,/^[a-zA-Z0-9_-]+$/);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Debugger.enable");
  await page.evaluate(()=>{window.__receiptOriginalPrint=window.print;window.print=()=>{debugger;};});
  let rejectPause;
  const paused=new Promise((resolve,reject)=>{
    rejectPause=reject;
    cdp.once("Debugger.paused",resolve);
  });
  const timer=setTimeout(()=>rejectPause(Error("Audited button did not reach native print")),45000);
  const audit=page.waitForResponse(r=>new URL(r.url()).pathname===auditPath && r.request().method()==="POST",{timeout:45000});
  const reason=page.getByLabel("Motivo de impresión / reimpresión",{exact:true});
  if(await reason.count())await reason.fill(`Isolated proof ${name}`);
  const click=page.getByRole("button",{name:"Solicitar impresión / reimpresión",exact:true}).click({timeout:45000});
  // Attach rejection immediately: a timeout must not be an unhandled rejection.
  click.catch(()=>{});audit.catch(()=>{});
  try {
    const response=await audit;assert.equal(response.status(),200,await response.text());
    const event=await paused;
    const frame=event.callFrames[0].callFrameId;
    const state=await cdp.send("Debugger.evaluateOnCallFrame",{callFrameId:frame,
      expression:"JSON.stringify({bodyClass:document.body.className,root:!!document.querySelector('#e5-document-pages,.e3-sheet'),url:location.pathname})",returnByValue:true});
    const printState=JSON.parse(state.result.value);
    if(auditPath.startsWith("/api/e5/"))assert.ok(printState.bodyClass.split(" ").includes("e5-print"));
    assert.ok(printState.root);
    const screenshot=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});
    fs.writeFileSync(path.join(out,`${name}-print-state.png`),Buffer.from(screenshot.data,"base64"));
    const pdf=await cdp.send("Page.printToPDF",{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    const file=path.join(out,`${name}.pdf`);fs.writeFileSync(file,Buffer.from(pdf.data,"base64"));
    const info=command("pdfinfo",[file]),textFile=path.join(out,`${name}.txt`);
    command("pdftotext",["-layout",file,textFile]);
    const text=fs.readFileSync(textFile,"utf8");
    assert.ok(text.replace(/\s/g,"").length>100,"Blank/near-blank PDF is NOT a pass");
    for(const value of expectedText)assert.ok(text.includes(value),`PDF missing ${value}`);
    const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);assert.ok(pages>0);
    const extracted=text.split("\f");if(!extracted.at(-1).trim())extracted.pop();
    assert.equal(extracted.length,pages);
    for(const [i,content] of extracted.entries())assert.ok(content.trim().length>30,`Blank PDF page ${i+1}`);
    command("pdftoppm",["-png","-r","96",file,path.join(out,`${name}-raster`)]);
    const evidence={name,file,pages,info,textLength:text.length,printState,audit:{path:auditPath,status:response.status(),body:await response.json()},
      capture:"Real audited button; native print intercepted with CDP pause solely for natural full-document PDF before temporary class cleanup. No CSS/class injection."};
    fs.writeFileSync(path.join(out,`${name}-pdf.json`),JSON.stringify(evidence,null,2));
    return evidence;
  }finally{
    clearTimeout(timer);
    await cdp.send("Debugger.resume").catch(()=>{});
    await cdp.send("Debugger.disable").catch(()=>{});
    await click.catch(()=>{});
    await page.evaluate(()=>{window.print=window.__receiptOriginalPrint;delete window.__receiptOriginalPrint;}).catch(()=>{});
    await cdp.detach();
  }
}

export function receiptPaths(r) {
  return r.family==="e3" ? {ui:`/recibos-e3/${r.folio}`,get:`/api/recibos-e3/${r.folio}`,print:`/api/recibos-e3/${r.folio}/impresiones`}
    : {ui:`/cobros/pendientes/${r.id}/documentos/${r.documentId}`,get:`/api/e5/cobros/${r.id}/documentos/${r.documentId}`,print:`/api/e5/cobros/${r.id}/documentos/${r.documentId}/impresiones`};
}

export async function denyReceipt(session, r, out, label) {
  const paths=receiptPaths(r),responses=[];
  for(const [method,url,body] of [["GET",paths.get],["POST",paths.print,{motivo:"isolated negative print",...(r.family==="e5"?{claveOperacion:randomUUID()}:{})}]]){
    const response=await session.api(method,url,body);responses.push(response);
    assert.ok([403,404].includes(response.status),JSON.stringify(response));
    // Preserve requestId in evidence, ignore it only for cross-request comparisons.
    const json=JSON.stringify(response.body);
    const name=r.body?.clienteNombre||r.body?.recibo?.clienteNombre;
    if(name)assert.ok(!json.includes(name),"Denial leaked customer metadata");
    for(const key of ["clienteId","clienteNombre","importeRecibido","importeCentavos","snapshot","notasIndicadas","sitioNombre","ubicacionNombre"])
      assert.ok(!json.includes(`"${key}"`),`Denial leaked ${key}`);
  }
  await session.page.goto(new URL(paths.ui,session.page.url()).href);
  await Promise.any([
    session.page.getByRole("alert").first().waitFor({state:"visible"}),
    session.page.getByRole("heading",{name:"Sin acceso",exact:true}).waitFor({state:"visible"}),
    session.page.getByText(/sin permiso para consultar|Sin permiso efectivo|Sin acceso a este documento/i).first().waitFor({state:"visible"}),
  ]);
  await session.page.getByRole("button",{name:"Solicitar impresión / reimpresión",exact:true}).waitFor({state:"hidden"});
  const visibleText=await session.page.locator("body").innerText();
  const customer=r.body?.clienteNombre||r.body?.recibo?.clienteNombre;
  if(customer)assert.ok(!visibleText.includes(customer),"Denied direct UI leaked receipt customer");
  await session.page.screenshot({path:path.join(out,`${label}-denied.png`),fullPage:true});
  return responses;
}

export function assertAuditDelta(before, after, expected) {
  const old=new Set(before.audit.map(a=>a.id));
  const added=after.audit.filter(a=>!old.has(a.id));
  assert.equal(added.length,expected.length,"Exactly one append-only print audit per button (none for denied attempts)");
  const unmatched=[...added];
  for(const item of expected){
    const index=unmatched.findIndex(a=>a.usuario_id===item.actorId && a.entidad_id===item.document &&
      a.accion===(item.family==="e3"?"E3_RECIBO_IMPRESION_SOLICITADA":"E5_IMPRIMIR"));
    assert.ok(index>=0,`Missing print audit ${JSON.stringify(item)}`);unmatched.splice(index,1);
  }
  assert.equal(after.e5.length-before.e5.length,expected.filter(e=>e.family==="e5").length);
  for(const prior of before.audit)assert.deepEqual(after.audit.find(a=>a.id===prior.id),prior,"Existing print audit mutated");
  for(const prior of before.e5)assert.deepEqual(after.e5.find(a=>a.clave===prior.clave),prior,"Existing E5 print audit mutated");
}