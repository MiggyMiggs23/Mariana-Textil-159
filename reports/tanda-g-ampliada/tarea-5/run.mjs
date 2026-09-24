import fs from "node:fs";
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const root="/home/runner/workspace", privateRoot=root+"/.local/tanda-g-ampliada";
const report=root+"/reports/tanda-g-ampliada/tarea-5";
if(fs.existsSync(report+"/evidence.json"))fs.copyFileSync(report+"/evidence.json",report+"/attempt-"+Date.now()+".json");
const req=createRequire(root+"/artifacts/api-server/package.json");
const {build}=req("esbuild");
const cfg=JSON.parse(fs.readFileSync(privateRoot+"/worker-databases.json","utf8")).failure;
const url=new URL(cfg.url);
assert.equal(url.hostname,"127.0.0.1");assert.equal(url.port,"55442");assert.equal(url.pathname,"/tanda_ga_failure");assert.equal(url.username,"ga_failure");
Object.assign(process.env,{NODE_ENV:"test",REQUIRE_ISOLATED_TEST_DATABASE:"1",TEST_DATABASE_URL:cfg.url,DATABASE_URL:"postgresql://postgres@127.0.0.1:55442/tanda_ga_witness",APPLICATION_DATABASE_URL:"postgresql://postgres@127.0.0.1:55442/tanda_ga_witness"});
const frozen=privateRoot+"/frozen-source";
await build({stdin:{contents:'export {db,pool,createTestDatabaseGuard,assertPreparedTestDatabase} from "@workspace/db"; export {crearTicket,cobrarTicket,cerrarSesionCaja} from "./src/lib/pos"; export {e3Repository} from "./src/lib/e3-repository"; export {previewE3,confirmE3} from "./src/lib/e3-collection";',resolveDir:frozen+"/artifacts/api-server",sourcefile:"failure-seam.ts",loader:"ts"},outfile:privateRoot+"/failure-producers.mjs",bundle:true,platform:"node",format:"esm",banner:{js:'import {createRequire} from "node:module"; const require=createRequire(import.meta.url);'},external:["pg-native"],logLevel:"silent"});
const api=await import(privateRoot+"/failure-producers.mjs");
const pg=req(root+"/scripts/node_modules/pg/lib/index.js");
const observer=new pg.Client({connectionString:cfg.url,application_name:"tanda-ga-failure-observer"});
await observer.connect();
const manifest=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json","utf8"));
const guard=await api.createTestDatabaseGuard(observer,cfg.url,process.env.APPLICATION_DATABASE_URL);
await guard.assertIsolated();await api.assertPreparedTestDatabase(observer);
const cluster=(await observer.query("select current_database() db,current_user role,inet_server_port() port")).rows[0];
const postmaster=fs.readFileSync(privateRoot+"/cluster/postmaster.pid","utf8").split("\n");
assert.equal(postmaster[1],privateRoot+"/cluster");assert.equal(postmaster[3],"55442");
cluster.dir=postmaster[1];cluster.postmasterPid=Number(postmaster[0]);
assert.equal(cluster.db,"tanda_ga_failure");assert.equal(cluster.role,"ga_failure");assert.equal(cluster.port,55442);
const evidence={started:new Date().toISOString(),cluster,nativeGuards:true,frozen:JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/build-identity.json","utf8")).commit,cases:[]};
function save(){fs.writeFileSync(report+"/evidence.json",JSON.stringify(evidence,null,2));}
const hash=x=>createHash("sha256").update(x).digest("hex");
async function digest(){
 const tables=(await observer.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
 const business={},auth={};
 for(const {tablename:t} of tables){
  const q='"'+t.replaceAll('"','""')+'"';
  const result=(await observer.query(`select count(*)::int n,md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) hash from public.${q} t`)).rows[0];
  (/^sesiones$/.test(t)?auth:business)[t]=result;
 }
 const seq=(await observer.query("select sequencename,last_value from pg_sequences where schemaname='public' order by sequencename")).rows;
 return {business,auth,sequences:seq,businessHash:hash(JSON.stringify(business))};
}
let armed=null;
api.pool.on("error",()=>{});
function attach(client){
 if(client.failureSeam)return;client.failureSeam=true;
 client.on("error",()=>{});
 const query=client.query.bind(client);
 client.query=async (...args)=>{
  const text=typeof args[0]==="string"?args[0]:args[0].text;
  const result=await query(...args);
  if(armed&&!armed.hit&&armed.pattern.test(text)){
   const active=armed;active.hit=true;
   await query("SET application_name='tanda-ga-failure-target'");
   const own=(await query("select pg_backend_pid() pid,current_database() db,current_user role,inet_server_port() port,txid_current()::text txid")).rows[0];
   own.postmasterPid=Number(fs.readFileSync(`/proc/${own.pid}/status`,"utf8").match(/^PPid:\s+(\d+)/m)[1]);
   assert.equal(own.postmasterPid,cluster.postmasterPid);
   assert.equal(own.pid,client.processID);assert.equal(own.db,cluster.db);assert.equal(own.role,cluster.role);assert.equal(own.port,cluster.port);
   const native=await api.createTestDatabaseGuard({query},cfg.url,process.env.APPLICATION_DATABASE_URL);
   await native.assertIsolated();await api.assertPreparedTestDatabase({query});
   const target=(await observer.query("select pid,datname,usename,application_name,state,xact_start is not null in_transaction from pg_stat_activity where pid=$1",[own.pid])).rows[0];
   assert.equal(target.datname,cluster.db);assert.equal(target.usename,cluster.role);assert.equal(target.application_name,"tanda-ga-failure-target");assert.equal(target.state,"idle in transaction");assert.equal(target.in_transaction,true);
   active.boundary={own,target,statement:text.replace(/\$\d+/g,"?"),writeCompleted:true,commitSent:false,nativeGuards:true};
   const killed=(await observer.query("select pg_terminate_backend($1) terminated",[own.pid])).rows[0].terminated;
   assert.equal(killed,true);active.boundary.terminated=killed;
   // Do not synthesize failure: the producer's next real SQL sees the dead socket.
  }
  return result;
 };
}
api.pool.on("connect",attach);
for(const client of api.pool._clients)attach(client);
async function fault(name,pattern,work){
 const item={name,started:new Date().toISOString(),before:await digest()};evidence.cases.push(item);save();
 armed={pattern,hit:false};
 try{await work();item.unexpectedSuccess=true;}catch(error){item.error={message:error.message,code:error.code,cause:error.cause?.message};}
 item.boundary=armed.boundary;const hit=armed.hit;armed=null;
 item.after=await digest();item.rollbackExact=item.before.businessHash===item.after.businessHash;
 item.status=hit&&item.error&&item.rollbackExact?"PASS":"FAIL";save();
 assert.equal(item.status,"PASS",name+" fault did not prove rollback");return item;
}
async function control(name,work){
 const item={name,started:new Date().toISOString(),before:await digest()};evidence.cases.push(item);save();
 try {const result=await work();item.after=await digest();item.status="PASS";save();return result;}
 catch(error){item.status="FAIL";item.error={message:error.message,code:error.code,cause:error.cause?.message};save();throw error;}
}
try {
 const actor=manifest.actors.admin,site=manifest.sites[0].id,session=manifest.sessions[0].id;
 const available=(await observer.query("select id from rollos where ubicacion_id=$1 and cantidad_actual=10 and estado='DISPONIBLE' and id=any($2) order by id",[site,manifest.rolls.map(r=>r.id)])).rows;
 const roll=manifest.rolls.find(r=>r.id===available[0]?.id);
 assert.ok(roll,"fixture roll required");
 const saleInput={ubicacionId:site,usuarioTerminalId:actor.id,clienteId:manifest.customer.id,facturado:false,uuidCliente:randomUUID(),lineas:[{rolloId:roll.id,productoId:roll.productId,cantidad:"10",precioUnitario:"150",tipo:"NORMAL"}],ip:"tanda-ga-failure"};
 const sale=()=>api.db.transaction(tx=>api.crearTicket(tx,saleInput,true));
 await fault("sale-mid-inventory",/update\s+"?rollos"?\s+set/i,sale);
 const ticket=await control("sale-successful-retry",sale);
 evidence.ticketShape=Object.keys(ticket);save();
 await control("sale-idempotent-retry",async()=>{const before=await digest();await sale();assert.equal((await digest()).businessHash,before.businessHash);});
 const auth={user:{id:actor.id,rol:"ADMIN",ubicacionId:site},permissions:[],allowedLocationIds:[site]};
 const repo=api.e3Repository({auth,ip:"127.0.0.1",headers:{},socket:{remoteAddress:"127.0.0.1"}});
 const input={clienteId:manifest.customer.id,importeCentavos:10000,formaPago:"EFECTIVO",cuentaDestino:"CAJA_FISICA",sitioId:site,sesionCajaId:session,operacionClave:randomUUID()};
 const preview=await api.previewE3(repo,input,"CAJA",auth.user,new Date());input.previewToken=preview.previewToken;
 const abono=()=>api.confirmE3(repo,input,"CAJA",auth.user,new Date());
 await fault("abono-mid-movement",/insert\s+into\s+"?movimientos_credito"?/i,abono);
 const receipt=await control("abono-successful-retry",abono);
 await control("abono-idempotent-retry",async()=>{const before=await digest();const again=await abono();assert.equal(again.replay,true);assert.equal(again.recibo.folio,receipt.recibo.folio);assert.equal((await digest()).businessHash,before.businessHash);});
 const close=()=>api.db.transaction(tx=>api.cerrarSesionCaja(tx,{sesionId:session,usuarioId:actor.id,efectivoContado:"5100",ip:"tanda-ga-failure"}));
 await fault("close-mid-state",/update\s+"?sesiones_caja"?\s+set/i,close);
 await control("close-successful-retry",close);
 evidence.completed=new Date().toISOString();save();
}catch(error){evidence.blocker={message:error.message,stack:error.stack};save();process.exitCode=1;}
finally{await observer.end();await api.pool.end();}