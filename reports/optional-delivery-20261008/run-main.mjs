// MAIN ONLY: no inherited app DB URLs, credentials, or PG environment.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import {spawn,spawnSync} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {DisposablePostgresRunner,assertPostgres16Binaries,installSignalHandlers,redactSensitiveText} from "../../lib/db/src/run-isolated-tests.mjs";
import {prepareTestDatabase} from "../../lib/db/src/prepare-test-database.mjs";
import {installFinancialSchema,prepareFixture,seedReceipts,financialSnapshot,printAudit} from "../receipt-terminal-runtime-20261001/fixture.mjs";
import {login} from "../permission-nine-runtime-20261001/cases.mjs";

const args=process.argv.slice(2);
assert.equal(args.shift(),"--main-authorized","MAIN launch only, after candidate readiness");
const options={};
while(args.length){const key=args.shift();assert.match(key,/^--/);const value=args.shift();assert.ok(value&&!value.startsWith("--"));options[key.slice(2)]=value;}
for(const key of ["api","ui","playwright","candidate-ready"])assert.ok(options[key],`Required --${key}`);
const root=path.resolve(import.meta.dirname,"../..");process.chdir(root);
const apiFile=fs.realpathSync(options.api),ui=fs.realpathSync(options.ui),pw=fs.realpathSync(options.playwright);
const readyFile=fs.realpathSync(options["candidate-ready"]);
const sha=value=>createHash("sha256").update(value).digest("hex");
const files=Object.fromEntries(fs.readdirSync(ui,{recursive:true}).filter(f=>fs.statSync(path.join(ui,f)).isFile()).map(f=>[f,sha(fs.readFileSync(path.join(ui,f)))]));
const ready=JSON.parse(fs.readFileSync(readyFile));
assert.equal(ready.ready,true);assert.equal(ready.apiSha256,sha(fs.readFileSync(apiFile)));
assert.deepEqual(ready.frontendFiles,files,"Main readiness must pin every candidate UI byte");
assert.ok(files["index.html"]);
const out=fs.mkdtempSync(path.join(import.meta.dirname,"run-"));fs.chmodSync(out,0o700);
fs.writeFileSync(path.join(import.meta.dirname,"latest-run.txt"),out+"\n");
const write=(file,value)=>fs.writeFileSync(path.join(out,file),JSON.stringify(value,null,2),{mode:0o600});
const clean=Object.fromEntries(["PATH","HOME","USER","LANG","TMPDIR"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const {Pool}=createRequire(path.join(root,"lib/db/package.json"))("pg");
const runner=new DisposablePostgresRunner({parentEnvironment:clean,actorMode:true});
const result={status:"PREPARING",ownerPid:process.pid,apiFile,ui,apiSha256:ready.apiSha256,frontendFiles:files,
  appDatabaseAccess:false,sqlProvenance:[],commands:[],candidateReadyFile:readyFile};
let pool,child,web,browser,fixture,origin,baseline,terminal=false,cleaned=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const redact=e=>redactSensitiveText(String(e?.stack||e),[runner.password,runner.seedPassword,runner.testDatabaseUrl,runner.controlDatabaseUrl]);
const save=()=>write("result.json",result);
const persist=()=>write("fixture.json",fixture);
const listen=server=>new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",()=>resolve(server.address().port));});
async function cleanup(){
  if(cleaned)return;cleaned=true;
  await browser?.close().catch(()=>{});
  if(web){web.closeAllConnections();await new Promise(r=>web.close(r));}
  if(child&&child.exitCode===null){const done=new Promise(r=>child.once("close",r));child.kill("SIGTERM");const timer=setTimeout(()=>child.kill("SIGKILL"),3000);await done;clearTimeout(timer);}
  await pool?.end();pool=null;
  const directory=runner.rootDirectory||runner.cluster?.rootDirectory;
  await runner.cleanup();
  result.cleanup={passed:!directory||!fs.existsSync(directory),apiExited:!child||child.exitCode!==null||child.signalCode!==null,at:new Date().toISOString()};
  for(const file of ["credentials.json","bootstrap.mjs","localhost-key.pem","localhost-cert.pem"])fs.rmSync(path.join(out,file),{force:true});
  const log=path.join(out,"private-api.log");
  if(fs.existsSync(log))fs.writeFileSync(log,redact(fs.readFileSync(log,"utf8")),{mode:0o600});
  save();
}
const removeSignals=installSignalHandlers(async()=>{terminal=true;runner.abort();await cleanup();},{});
async function apiFixtures(){
  const session=await login(browser,origin,fixture.admin.username,runner.seedPassword);
  try {await seedReceipts(session.api,fixture,persist);}finally{await session.context.close();}
  result.status="READY_FOR_TESTING_AGENT";persist();save();
}
try {
  assertPostgres16Binaries();await runner.start();await runner.verifyIdentity();
  const identities=JSON.stringify([runner.verifiedIdentity,runner.verifiedControlIdentity]);
  assert.equal(runner.verifiedIdentity.listen_addresses,"");
  result.identitySha256=sha(identities);
  await prepareTestDatabase({environment:runner.childEnvironment(),signal:runner.signal,onChild:(c,control)=>runner.trackChild(c,control)});
  await runner.verifyIdentity();assert.equal(JSON.stringify([runner.verifiedIdentity,runner.verifiedControlIdentity]),identities);
  pool=new Pool({connectionString:runner.testDatabaseUrl,max:1});
  await installFinancialSchema(pool,result.sqlProvenance); await pool.query(fs.readFileSync("reports/tanda-d-20260923/tarea1-up.sql","utf8")); save();
  const reservation=http.createServer(),apiPort=await listen(reservation);await new Promise(r=>reservation.close(r));
  // Verify effective target IN the serving process, before importing candidate.
  const bootstrap=path.join(out,"bootstrap.mjs");
  fs.writeFileSync(bootstrap,`import net from 'node:net';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const {Pool}=createRequire(${JSON.stringify(path.join(root,"lib/db/package.json"))})('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
const i=(await p.query("select current_database() db,current_setting('data_directory') dir,current_setting('listen_addresses') listen")).rows[0];await p.end();
if(i.db!==${JSON.stringify(runner.database)}||i.dir!==${JSON.stringify(runner.verifiedIdentity.data_directory)}||i.listen!=='')throw Error('Wrong isolated API identity');
if(crypto.createHash('sha256').update(fs.readFileSync(${JSON.stringify(apiFile)})).digest('hex')!==${JSON.stringify(ready.apiSha256)})throw Error('Candidate API changed');
fs.writeFileSync(${JSON.stringify(path.join(out,"api-effective-identity.json"))},JSON.stringify({database:i.db,directoryHash:crypto.createHash('sha256').update(i.dir).digest('hex'),listen:i.listen}));
const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object')a[0]={...a[0],host:'127.0.0.1'};else if(typeof a[1]==='string')a[1]='127.0.0.1';else a.splice(1,0,'127.0.0.1');return listen.apply(this,a)};
await import(${JSON.stringify(pathToFileURL(apiFile).href)});
`,{mode:0o600});
  const fd=fs.openSync(path.join(out,"private-api.log"),"w",0o600);
  child=spawn(process.execPath,[bootstrap],{cwd:root,env:{...clean,DATABASE_URL:runner.testDatabaseUrl,NODE_ENV:"development",PORT:String(apiPort),API_STARTUP_MODE:"NORMAL",API_INSPECTION_BOOT:"1",DB_POOL_MAX:"8"},stdio:["ignore",fd,fd]});fs.closeSync(fd);
  let healthy=false;
  for(let i=0;i<240;i++){assert.equal(child.exitCode,null,"Isolated API exited");try{if((await fetch(`http://127.0.0.1:${apiPort}/api/healthz`)).ok){healthy=true;break;}}catch{}await delay(500);}
  assert.ok(healthy,"Candidate API startup timeout");
  // Candidate startup's native permission initializer must have run before actors.
  fixture=await prepareFixture(pool,runner.seedPassword);persist();
  const keyFile=path.join(out,"localhost-key.pem"),certFile=path.join(out,"localhost-cert.pem");
  const cert=spawnSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","1","-subj","/CN=localhost",
    "-addext","subjectAltName=DNS:localhost,IP:127.0.0.1","-keyout",keyFile,"-out",certFile],{env:clean,stdio:"ignore"});
  assert.equal(cert.status,0);fs.chmodSync(keyFile,0o600);
  web=https.createServer({key:fs.readFileSync(keyFile),cert:fs.readFileSync(certFile)},(req,res)=>{
    const u=new URL(req.url,"https://localhost");
    if(u.pathname.startsWith("/api/")){
      const upstream=http.request({hostname:"127.0.0.1",port:apiPort,path:u.pathname+u.search,method:req.method,
        headers:{...req.headers,host:`127.0.0.1:${apiPort}`}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
      upstream.on("error",()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
    }
    let file=decodeURIComponent(u.pathname).slice(1);if(!file||!path.extname(file))file="index.html";
    if(!Object.hasOwn(files,file)){res.writeHead(404);res.end();return;}
    const bytes=fs.readFileSync(path.join(ui,file));if(sha(bytes)!==files[file]){res.writeHead(500);res.end("Candidate UI changed");return;}
    res.writeHead(200,{"content-type":({".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml"})[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(bytes);
  });
  origin=`https://127.0.0.1:${await listen(web)}`;
  result.origin=origin;result.apiPid=child.pid;
  write("credentials.json",{origin,password:runner.seedPassword,admin:fixture.admin,actors:fixture.actors,playwright:pw,ownerPid:process.pid});
  const {chromium}=await import(pathToFileURL(pw));
  browser=await chromium.launch({executablePath:options.chromium||"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  await apiFixtures();
} catch(error){result.status="BLOCKED_PRESERVED";result.error=redact(error);save();}

// Stay alive even after a successful check: MAIN explicitly owns terminal cleanup.
while(!terminal){
  result.heartbeat=new Date().toISOString();save();await delay(1000);
  const control=path.join(out,"control.json");if(!fs.existsSync(control))continue;
  let command;try{command=JSON.parse(fs.readFileSync(control,"utf8"));fs.unlinkSync(control);}catch{continue;}
  const record={id:command.id||randomUUID(),at:new Date().toISOString(),command};
  try {
    if(command.action==="cleanup"){result.status="CLEANED";terminal=true;await cleanup();}
    else {
      assert.ok(pool&&fixture&&origin,"Bootstrap incomplete: cleanup only");
      await runner.verifyIdentity();
      assert.equal(child.exitCode,null,"Owned API is no longer alive");
      assert.equal(sha(fs.readFileSync(apiFile)),result.apiSha256);
      if(command.action==="retry-fixtures")await apiFixtures();
      else if(command.action==="snapshot"){
        baseline=await financialSnapshot(pool);
        write("financial-before.json",baseline);write("audit-before.json",await printAudit(pool));record.status="BASELINE_SAVED";
      } else if(command.action==="compare"){
        assert.ok(baseline,"Snapshot required AFTER all receipts, BEFORE printing");
        const after=await financialSnapshot(pool),audit=await printAudit(pool);
        write("financial-after.json",after);write("audit-after.json",audit);
        assert.deepEqual(after,baseline,"Printing/denials changed financial rows, amounts, status or immutable snapshots");
        record.status="FINANCIAL_UNCHANGED";
      } else if(command.action==="audit")write("audit-current.json",await printAudit(pool));
      else if(command.action==="terminal-permission"){
        assert.equal(typeof command.allowed,"boolean");
        const actor=fixture.actors.find(a=>a.role==="TERMINAL"&&a.variant==="default");
        await pool.query(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
          VALUES($1,'recibos_abonos',$2,false,false,false) ON CONFLICT(usuario_id,modulo)
          DO UPDATE SET puede_ver=excluded.puede_ver`,[actor.id,command.allowed]);
        record.actorId=actor.id;record.freshLoginRequired=true;
      } else throw Error("Unknown control action");
    }
    record.ok=true;
  }catch(error){record.ok=false;record.error=redact(error);}
  result.commands.push(record);write(`control-result-${record.id}.json`,record);save();
}
removeSignals();
console.log(JSON.stringify({out,status:result.status,cleanup:result.cleanup}));
process.exitCode=result.cleanup?.passed?0:1;