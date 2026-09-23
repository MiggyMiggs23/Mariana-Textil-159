// MAIN only: one lifecycle, private socket, TCP disabled, no external DB target.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {report,root,distName,requireMain,verifyPreparation,pgTools,json,write,run,catalog,auxiliary,digest,canonical,verifyOutputs,runtimePin,fingerprints} from "./common.mjs";
import {closedEnv} from "../../tanda-b-off-preparada-20260923/common.mjs";
import {fixture,project,projectAuxiliary} from "./projection.mjs";
requireMain();verifyPreparation();
for(const k of Object.keys(process.env)) if(/^(PG|DATABASE_URL$|TEST_DATABASE_URL$|APPLICATION_DATABASE_URL$|NODE_OPTIONS$)/.test(k)) throw Error(`Inherited selector forbidden ${k}`);
const pin=runtimePin(),bin=pgTools(),manifest=verifyOutputs();
assert.equal(json(path.join(report,"evidencia/preflight-cli.json")).status,"PASS");
const attempt=process.env.TANDA_B_ATTEMPT;assert.match(attempt||"",/^[a-zA-Z0-9_-]{1,40}$/);
const port=Number(process.env.TANDA_B_API_PORT);assert.ok(Number.isInteger(port)&&port>1024&&port<65536);
const evidence=path.join(report,"evidencia",`rehearsal-${attempt}`);fs.mkdirSync(evidence);
const live=json(path.join(report,"evidencia/live/catalog-B0-real.json"));
const base=fs.mkdtempSync(path.join(os.tmpdir(),"tanda-b-b0-b1-"));fs.chmodSync(base,0o700);
const socket=path.join(base,"socket"),data=path.join(base,"data");fs.mkdirSync(socket);
const clean={PATH:`${bin}:${process.env.PATH}`,HOME:base,LANG:"C.UTF-8"};
const pg={...clean,PGHOST:socket,PGPORT:"55449",PGUSER:live.role,PGDATABASE:"tanda_b_disposable"};
const sql=input=>{
  const r=spawnSync(path.join(bin,"psql"),["-X","-qAt","-v","ON_ERROR_STOP=1"],{env:pg,input,encoding:"utf8",timeout:120000,maxBuffer:128*1024*1024});
  if(r.status!==0) {
    const f=path.join(evidence,"sql-failure.json");
    if(!fs.existsSync(f))write(f,{status:r.status,stderr:r.stderr,inputSha256:digest(input)});
    throw Error(`Disposable SQL failed exit ${r.status}; sql-failure.json retained`);
  }
  return r.stdout.trim();
};
const read=()=>catalog({...pg,PGOPTIONS:"-c default_transaction_read_only=on"},bin);
const readAux=()=>auxiliary({...pg,PGOPTIONS:"-c default_transaction_read_only=on"},bin);
const q=s=>`"${s.replaceAll('"','""')}"`;
function snapshot() {
  const c=read(),tables={},sequences={};
  for(const r of c.schemaRows.filter(r=>r.kind==="table")) {
    const v=sql(`BEGIN READ ONLY; SELECT to_jsonb(t)::text FROM ${q(r.schema_name)}.${q(r.object_name)} t ORDER BY to_jsonb(t)::text; ROLLBACK;`);
    tables[r.object_name]={sha256:digest(v),count:v?v.split("\n").length:0};
  }
  for(const r of c.schemaRows.filter(r=>r.kind==="sequence")) sequences[r.object_name]=sql(`BEGIN READ ONLY; SELECT last_value::text||':'||is_called::text FROM ${q(r.schema_name)}.${q(r.object_name)}; ROLLBACK;`);
  return {...fingerprints(c),auxiliarySha256:digest(canonical(readAux())),tables,sequences};
}
let child,fd,attempted=false,cleaning=false;
const result={status:"FAIL",phaseBExecuted:false,allGates:"OFF",liveSqlApplied:false,fixture:"MINIMAL_NOT_REAL_B0",candidateStopped:false};
async function stop() {
  if(!child)return;
  const c=child;
  const exists=()=>{try{process.kill(-c.pid,0);return true;}catch(e){if(e.code==="ESRCH")return false;throw e;}};
  if(c.pid) {
    // Kill the group even when its original leader has already exited.
    try{process.kill(-c.pid,"SIGTERM");}catch(e){if(e.code!=="ESRCH")throw e;}
    const graceful=Date.now()+3000;
    while(exists()&&Date.now()<graceful)await new Promise(r=>setTimeout(r,100));
    if(exists()){try{process.kill(-c.pid,"SIGKILL");}catch(e){if(e.code!=="ESRCH")throw e;}}
    const deadline=Date.now()+5000;
    while(exists()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
    if(exists())throw Error("Candidate process group cleanup timeout");
  }
  result.candidateProcessGroupGone=true;
  child=undefined;if(fd!==undefined){fs.closeSync(fd);fd=undefined;}result.candidateStopped=true;
}
async function cleanup() {
  if(cleaning)return;cleaning=true;
  try{await stop();}catch(e){result.cleanupError=e.message;result.status="FAIL_CLEANUP";}
  if(attempted) result.postgresStopExit=spawnSync(path.join(bin,"pg_ctl"),["-D",data,"-m","immediate","-w","stop"],{env:clean,timeout:30000}).status;
  if(!child&&(!attempted||result.postgresStopExit===0)) fs.rmSync(base,{recursive:true,force:true});
  result.disposableDestroyed=!fs.existsSync(base);
  if(!result.disposableDestroyed){result.status="FAIL_CLEANUP";result.preservedCluster=base;}
  write(path.join(evidence,"terminal.json"),result);
}
for(const signal of ["SIGINT","SIGTERM"]) process.once(signal,async()=>{result.status=`INTERRUPTED_${signal}`;await cleanup();process.exit(1);});
async function boot(bundle,hash,label) {
  assert.equal(digest(fs.readFileSync(bundle)),hash,"Bundle hash");
  const reservation=net.createServer();
  await new Promise((resolve,reject)=>{reservation.once("error",reject);reservation.listen(port,"127.0.0.1",resolve);});
  await new Promise(resolve=>reservation.close(resolve));
  const env={...clean,...closedEnv,NODE_ENV:"development",API_INSPECTION_BOOT:"1",PORT:String(port),
    DATABASE_URL:`postgresql://${encodeURIComponent(live.role)}@localhost:55449/tanda_b_disposable?host=${encodeURIComponent(socket)}`};
  fd=fs.openSync(path.join(evidence,`${label}.log`),"wx");
  const wrapper=path.join(report,"loopback-start.mjs");
  child=spawn(process.execPath,[wrapper,bundle],{cwd:root,env,detached:true,stdio:["ignore",fd,fd]});
  let error;child.once("error",e=>{error=e;});
  try {
    const end=Date.now()+30000;
    while(Date.now()<end) {
      if(error||child.exitCode!==null||child.signalCode!==null) throw Error(`${label} failed before readiness`);
      const log=fs.readFileSync(path.join(evidence,`${label}.log`),"utf8");
      if(log.includes("Inspection boot:")&&log.includes("Server listening")) {
        const health=await fetch(`http://127.0.0.1:${port}/api/healthz`,{signal:AbortSignal.timeout(3000)});
        assert.equal(health.status,200);
        const probes=[];
        for(const route of ["/e5/cobros","/e11/identidad","/e7/disponibilidad"]) {
          const r=await fetch(`http://127.0.0.1:${port}/api${route}`,{signal:AbortSignal.timeout(3000)});
          assert.ok([401,403,404].includes(r.status),`${route} unexpectedly open`);
          probes.push({route,status:r.status,scope:"Unauthenticated denial only; not authenticated feature proof"});
        }
        return {status:"PASS_INSPECTION_START",health:200,probes,sha256:hash,
          loopbackWrapperSha256:digest(fs.readFileSync(wrapper)),bind:"127.0.0.1",bundleModified:false};
      }
      await new Promise(r=>setTimeout(r,150));
    }
    throw Error(`${label} timeout`);
  } finally {await stop();}
}
try {
  run(path.join(bin,"initdb"),["-U",live.role,"-A","trust","--no-locale","-E","UTF8","-D",data],{env:clean});
  attempted=true;
  run(path.join(bin,"pg_ctl"),["-D",data,"-l",path.join(base,"postgres.log"),"-o",`-k ${socket} -h "" -p 55449`,"-w","start"],{env:clean});
  run(path.join(bin,"createdb"),["tanda_b_disposable"],{env:{...pg,PGDATABASE:"postgres"}});
  assert.equal(sql("SELECT current_database();"),"tanda_b_disposable");
  const ddl=fixture(live);fs.writeFileSync(path.join(evidence,"fixture-minimal.sql"),ddl,{flag:"wx"});sql(ddl);
  const before=read();write(path.join(evidence,"fixture-before.json"),before);
  const auxBefore=readAux();write(path.join(evidence,"auxiliary-fixture-before.json"),auxBefore);
  const inventory=json(path.join(report,"sql-inventory.json"));
  for(const entry of Object.values(inventory.inputs)) {
    const file=fs.readFileSync(path.join(report,entry.copy));assert.equal(digest(file),entry.sha256);
    sql("SET search_path=public,pg_catalog;\n"+file.toString());
  }
  const after=read();write(path.join(evidence,"fixture-after.json"),after);
  const auxAfter=readAux();write(path.join(evidence,"auxiliary-fixture-after.json"),auxAfter);
  const p=project(live,before,after);
  write(path.join(evidence,"catalog-B1-projected.json"),p.projected);
  write(path.join(evidence,"exact-delta.json"),p.evidence);
  const a=projectAuxiliary(json(path.join(report,"evidencia/live/auxiliary-B0-real.json")),auxBefore,auxAfter);
  write(path.join(evidence,"auxiliary-B1-projected.json"),a.projected);
  write(path.join(evidence,"auxiliary-exact-delta.json"),a.delta);
  result.auxiliary="PASS_RI_AND_DEPENDENCIES";
  result.projection="PASS_EXACT_FOUR_REPLACEMENTS";
  const stable=snapshot();write(path.join(evidence,"before-startup.json"),stable);
  // Real mutations, NOT a modified JS snapshot: verify row AND sequence sensors.
  sql("UPDATE public.tanda_b_probe SET value='sensitivity';");
  assert.notDeepEqual(snapshot().tables,stable.tables);
  sql("UPDATE public.tanda_b_probe SET value='disposable-only';");
  sql("SELECT nextval('public.tanda_b_probe_id_seq');");
  assert.notDeepEqual(snapshot().sequences,stable.sequences);
  sql("SELECT setval('public.tanda_b_probe_id_seq',1,true);");
  assert.deepEqual(snapshot(),stable);
  result.rowAndSequenceSensitivity="PASS_REAL_DISPOSABLE_MUTATIONS";
  const candidate=path.join(root,"artifacts/api-server",distName,"index.mjs");
  try {result.candidate=await boot(candidate,manifest.outputs[path.relative(root,candidate)],"candidate");}
  catch(e) {
    result.candidate={status:"FAIL",reason:e.message};
    assert.deepEqual(snapshot(),stable,"Failed candidate changed fixture");
    result.control=await boot(path.join(root,"artifacts/api-server/dist-e2-20260927/index.mjs"),pin.bundleSha256,"control-e2");
    assert.deepEqual(snapshot(),stable,"Control changed fixture");
    throw Error("Candidate failed; control comparison recorded on SAME minimal fixture");
  }
  const end=snapshot();write(path.join(evidence,"after-startup.json"),end);assert.deepEqual(end,stable);
  result.invariance="PASS_CATALOG_ROWS_SEQUENCES";verifyOutputs();assert.deepEqual(runtimePin(),pin);
  result.status="PASS_DISPOSABLE_MAIN_REVIEW_PENDING";
} catch(e){result.error=e.message;process.exitCode=1;}
finally{await cleanup();}
if(result.status.startsWith("FAIL"))process.exitCode=1;
console.log(JSON.stringify(result));