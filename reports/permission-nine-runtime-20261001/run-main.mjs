// MAIN ONLY. Runtime commands never inherit DATABASE_URL, PG*, or app secrets.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DisposablePostgresRunner, assertPostgres16Binaries, installSignalHandlers, redactSensitiveText } from "../../lib/db/src/run-isolated-tests.mjs";
import { prepareTestDatabase } from "../../lib/db/src/prepare-test-database.mjs";
import { installFinancialSchema, prepareActorsAndSource, receiveFrozenFixture } from "./fixture.mjs";

assert.equal(process.argv[2],"--main-authorized","MAIN must execute explicitly");
const root=path.resolve(import.meta.dirname,"../..");
process.chdir(root);
const out=fs.mkdtempSync(path.join(import.meta.dirname,"run-"));
fs.chmodSync(out,0o700);
fs.writeFileSync(path.join(import.meta.dirname,"latest-run.txt"),out+"\n");
const write=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2),{mode:0o600});
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const clean=Object.fromEntries(["PATH","HOME","USER","LANG","TMPDIR"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const {Pool}=createRequire(path.join(root,"lib/db/package.json"))("pg");
const apiFile=path.join(root,"artifacts/api-server/dist-driver-phones-20261001/index.mjs");
const ui=path.join(root,"artifacts/mariana-textil/dist-sidebar-order-20261001");
const pw=path.join(root,".cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs");
const {chromium}=await import(pathToFileURL(pw));
const files=Object.fromEntries(fs.readdirSync(ui,{recursive:true}).filter(f=>fs.statSync(path.join(ui,f)).isFile()).map(f=>[f,sha(fs.readFileSync(path.join(ui,f)))]));
const result={status:"PREPARING",liveDatabaseAccess:false,sourceChanges:false,apiSha256:sha(fs.readFileSync(apiFile)),
  apiFile,ui,frontendFiles:files,sqlProvenance:[],cases:[],limitations:[
    "Native synthetic disposable data, not live users or balances.",
    "Released financial installation replayed only on empty canonical disposable; construction closures retired by already committed release migrations. Native integrity triggers and refund closures retained.",
    "BODEGA/SISTEMAS role exclusions and CONTADOR E11 outer boundary are not coverage of inner ver gates.",
    "ajustes.ver has a UI gate only; dependent API permissions are constant, no invented API guard.",
    "Current canonical push/seed/initializers plus native financial schema, frozen released HTTP API/UI bytes; no application source import/build or HTTP mocks.",
  ]};
const runner=new DisposablePostgresRunner({parentEnvironment:clean,actorMode:true});
let pool,child,web,browser,fixture,origin,terminal=false,cleaned=false;
const secrets=[];
const redact=e=>redactSensitiveText(String(e?.stack||e),[...secrets,runner.password,runner.seedPassword,runner.testDatabaseUrl,runner.controlDatabaseUrl]);
const save=()=>write("result.json",result);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const listen=server=>new Promise((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",()=>resolve(server.address().port));
});
async function cleanup(){
  if(cleaned)return; cleaned=true;
  await browser?.close().catch(()=>{});
  if(web){web.closeAllConnections();await new Promise(r=>web.close(r));}
  if(child&&child.exitCode===null){
    const closed=new Promise(r=>child.once("close",r));
    child.kill("SIGTERM");const timer=setTimeout(()=>child.kill("SIGKILL"),3000);
    await closed;clearTimeout(timer);
  }
  await pool?.end();pool=null;
  const directory=runner.rootDirectory || runner.cluster?.rootDirectory;
  await runner.cleanup();
  result.cleanupPassed=!directory||!fs.existsSync(directory);
  fs.rmSync(path.join(out,"bootstrap.mjs"),{force:true});
  fs.rmSync(path.join(out,"localhost-key.pem"),{force:true});
  fs.rmSync(path.join(out,"localhost-cert.pem"),{force:true});
  // API diagnostics are private during retry, scrub ephemeral credentials at termination.
  const log=path.join(out,"private-api.log");
  if(fs.existsSync(log))fs.writeFileSync(log,redact(fs.readFileSync(log,"utf8")),{mode:0o600});
  save();
}
const removeSignals=installSignalHandlers(async()=>{runner.abort();await cleanup();},{});
async function finishReadiness(){
  assert.ok(browser&&fixture&&pool,"Private runtime and native source must already exist");
  const module=await import(pathToFileURL(path.join(import.meta.dirname,"cases.mjs")).href+`?readiness=${randomUUID()}`);
  // Close failed readiness login contexts without touching the owned API/DB.
  for(const context of browser.contexts())await context.close();
  const admin=await module.login(browser,origin,fixture.admin.usuario,runner.seedPassword);
  try{
    if(!fixture.cobro)result.receipt=await receiveFrozenFixture(admin.api,fixture);
  }finally{await admin.context.close();}
  result.nativeGraph=(await pool.query(`SELECT
    (SELECT count(*)::int FROM e5_recepciones WHERE id=$1) recepciones,
    (SELECT count(*)::int FROM e5_cobros WHERE id=$1) cobros,
    (SELECT count(*)::int FROM e5_operaciones WHERE cobro_id=$1) operaciones,
    (SELECT count(*)::int FROM e5_documentos WHERE cobro_id=$1) documentos`,[fixture.cobro])).rows[0];
  assert.equal(result.nativeGraph.recepciones,1);assert.equal(result.nativeGraph.cobros,1);
  assert.ok(result.nativeGraph.operaciones>0&&result.nativeGraph.documentos>0);
  result.fixture=fixture;write("fixture.json",fixture);save();
  await runCases();
}
async function runCases(ids){
  result.status="RUNNING";save();
  const module=await import(pathToFileURL(path.join(import.meta.dirname,"cases.mjs")).href+`?retry=${randomUUID()}`);
  const selected=fixture.actors.filter(a=>!ids||ids.includes(`${a.family}:${a.role}:${a.variant}`));
  assert.ok(selected.length,"No matching retry cases");
  for(const actor of selected){
    const id=`${actor.family}:${actor.role}:${actor.variant}`;
    const attempt=result.cases.filter(c=>c.id===id).length+1;
    let evidence;
    try{evidence=await module.exercise({browser,origin,actor,password:runner.seedPassword,fixture,out,attempt});}
    catch(error){evidence={id,attempt,status:"FAIL",error:redact(error)};}
    if(evidence.error)evidence.error=redact(evidence.error);
    result.cases.push(evidence);write(`case-${actor.family}-${actor.role}-${actor.variant}-${attempt}.json`,evidence);save();
  }
  // Positive → negative → fresh-positive is an observable auth/query-cache reset
  // proof; no DB reset/truncate or mutation of immutable E5 history.
  const resetActor=fixture.actors.find(a=>a.family==="e5"&&a.role==="CAJA"&&a.variant==="on");
  const reset=await module.exercise({browser,origin,actor:resetActor,password:runner.seedPassword,fixture,out,attempt:`reset-${result.cases.length}`});
  result.resetProof={kind:"fresh authenticated context after differential cases",status:reset.status,evidence:reset};
  const latest=Object.values(Object.fromEntries(result.cases.map(c=>[c.id,c])));
  result.dependentApiPairChecks=[];
  for(const role of ["TERMINAL","CAJA","CONTADOR"]){
    const on=latest.find(c=>c.id===`ajustes:${role}:on`),off=latest.find(c=>c.id===`ajustes:${role}:off`);
    if(!on?.checks?.length||!off?.checks?.length)continue;
    const equal=JSON.stringify(on.checks)===JSON.stringify(off.checks);
    result.dependentApiPairChecks.push({role,equal,meaning:role==="CONTADOR"?"E11 outer denial constant":"Exact same dependent HTTP bodies/statuses; no ajustes.ver API gate"});
  }
  result.status=latest.length===fixture.actors.length&&latest.every(c=>c.status==="PASS")&&reset.status==="PASS"?"PASS":"FAILED_PRESERVED";
  if(result.dependentApiPairChecks.some(p=>!p.equal))result.status="FAILED_PRESERVED";
  save();
}
try{
  assertPostgres16Binaries();
  await runner.start();await runner.verifyIdentity();
  const identity=JSON.stringify([runner.verifiedIdentity,runner.verifiedControlIdentity]);
  assert.equal(runner.verifiedIdentity.listen_addresses,"");
  result.identitySha256=sha(identity);
  await prepareTestDatabase({environment:runner.childEnvironment(),signal:runner.signal,onChild:(c,control)=>runner.trackChild(c,control)});
  await runner.verifyIdentity();
  assert.equal(JSON.stringify([runner.verifiedIdentity,runner.verifiedControlIdentity]),identity);
  pool=new Pool({connectionString:runner.testDatabaseUrl,max:1});
  await installFinancialSchema(pool,result.sqlProvenance);
  fixture=await prepareActorsAndSource(pool,runner.seedPassword);
  result.fixture={...fixture,actors:fixture.actors.map(a=>({...a}))};
  write("fixture.json",result.fixture);save();
  const reservation=http.createServer();const apiPort=await listen(reservation);await new Promise(r=>reservation.close(r));
  const bootstrap=path.join(out,"bootstrap.mjs");
  // Enforce effective target identity inside the API process before frozen import.
  fs.writeFileSync(bootstrap,`import net from 'node:net';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const {Pool}=createRequire(${JSON.stringify(path.join(root,"lib/db/package.json"))})('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
const i=(await p.query("select current_database() db,current_setting('data_directory') dir,current_setting('listen_addresses') listen")).rows[0];await p.end();
if(i.db!==${JSON.stringify(runner.database)}||i.dir!==${JSON.stringify(runner.verifiedIdentity.data_directory)}||i.listen!=='')throw Error('Wrong isolated API identity');
fs.writeFileSync(${JSON.stringify(path.join(out,"api-effective-identity.json"))},JSON.stringify({database:i.db,dataDirectoryHash:crypto.createHash('sha256').update(i.dir).digest('hex'),listen:i.listen}));
if(crypto.createHash('sha256').update(fs.readFileSync(${JSON.stringify(apiFile)})).digest('hex')!==${JSON.stringify(result.apiSha256)})throw Error('Frozen API changed');
const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object')a[0]={...a[0],host:'127.0.0.1'};else if(typeof a[1]==='string')a[1]='127.0.0.1';else a.splice(1,0,'127.0.0.1');return listen.apply(this,a)};
await import(${JSON.stringify(pathToFileURL(apiFile).href)});
`,{mode:0o600});
  const fd=fs.openSync(path.join(out,"private-api.log"),"w",0o600);
  child=spawn(process.execPath,[bootstrap],{cwd:root,env:{...clean,DATABASE_URL:runner.testDatabaseUrl,NODE_ENV:"development",PORT:String(apiPort),API_STARTUP_MODE:"NORMAL",API_INSPECTION_BOOT:"1",DB_POOL_MAX:"8"},stdio:["ignore",fd,fd]});
  fs.closeSync(fd);
  let ready=false;
  for(let i=0;i<240;i++){
    assert.equal(child.exitCode,null,"Isolated API exited");
    try{if((await fetch(`http://127.0.0.1:${apiPort}/api/healthz`)).ok){ready=true;break;}}catch{}
    await delay(500);
  }
  assert.ok(ready,"Isolated API startup timeout");
  // Frozen login sets Secure cookies. Serve the actual UI over local HTTPS;
  // never rewrite Set-Cookie or invent a token from a guessed JSON field.
  const keyFile=path.join(out,"localhost-key.pem"),certFile=path.join(out,"localhost-cert.pem");
  const cert=spawnSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","1",
    "-subj","/CN=localhost","-addext","subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-keyout",keyFile,"-out",certFile],{env:clean,stdio:"ignore"});
  assert.equal(cert.status,0,"Generate owned localhost TLS certificate");
  fs.chmodSync(keyFile,0o600);
  web=https.createServer({key:fs.readFileSync(keyFile),cert:fs.readFileSync(certFile)},(req,res)=>{
    const u=new URL(req.url,"http://localhost");
    if(u.pathname.startsWith("/api/")){
      const upstream=http.request({hostname:"127.0.0.1",port:apiPort,path:u.pathname+u.search,method:req.method,headers:{...req.headers,host:`127.0.0.1:${apiPort}`}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
      upstream.on("error",()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
    }
    let file=decodeURIComponent(u.pathname).slice(1);
    if(!file||!path.extname(file))file="index.html";
    if(!Object.hasOwn(files,file)){res.writeHead(404);res.end();return;}
    const bytes=fs.readFileSync(path.join(ui,file));
    if(sha(bytes)!==files[file]){res.writeHead(500);res.end("Frozen UI changed");return;}
    res.writeHead(200,{"content-type":({".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml"})[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(bytes);
  });
  origin=`https://127.0.0.1:${await listen(web)}`;
  result.origin=origin;save();
  browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  await finishReadiness();
  if(result.status==="PASS"){terminal=true;await cleanup();}
}catch(error){
  result.status="BLOCKED_PRESERVED";result.error=redact(error);save();
}
// MAIN may inspect the private evidence and patch only harness selectors, then
// request targeted retry without schema/actors/fixture recreation. No secrets in control.
// echo '{"retry":["e5:CAJA:on"]}' > RUN/control.json
// echo '{"cleanup":true}' > RUN/control.json
while(!terminal){
  result.awaitingControl=true;save();
  await delay(1000);
  const control=path.join(out,"control.json");
  if(!fs.existsSync(control))continue;
  let command;try{command=JSON.parse(fs.readFileSync(control,"utf8"));fs.unlinkSync(control);}catch{continue;}
  if(command.cleanup){terminal=true;await cleanup();break;}
  if(command.retryReadiness&&browser&&fixture&&pool){
    try{await finishReadiness();if(result.status==="PASS"){terminal=true;await cleanup();}}
    catch(error){result.status="BLOCKED_PRESERVED";result.error=redact(error);save();}
    continue;
  }
  if(command.retry&&browser&&fixture?.cobro){
    try{await runCases(command.retry);if(result.status==="PASS"){terminal=true;await cleanup();}}
    catch(error){result.status="FAILED_PRESERVED";result.error=redact(error);save();}
  }else{result.controlError="Only cleanup is available until native fixture and browser are ready.";save();}
}
removeSignals();
console.log(JSON.stringify({out,status:result.status,cleanupPassed:result.cleanupPassed}));
process.exitCode=result.status==="PASS"?0:1;