// MAIN-authorized one-shot replacement after the documented harness-clock incident.
import fs from "node:fs";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";
const root="/home/runner/workspace",local=root+"/.local/tanda-g-ampliada";
const out=root+"/reports/tanda-g-ampliada/tarea-3",archive=out+"/failed-attempt-clock-resume";
const dir=local+"/month-cluster",socket=local+"/month-socket",port=55443;
const bin="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const cfg=JSON.parse(fs.readFileSync(local+"/month-database.json"));
assert.equal(cfg.dir,dir);assert.equal(cfg.port,port);
const url=new URL(cfg.url);
assert.equal(url.hostname,"127.0.0.1");assert.equal(url.port,"55443");assert.equal(url.pathname,"/tanda_ga_month");assert.equal(url.username,"ga_month");
assert.ok(!fs.existsSync(archive),"One-shot archive already exists: no replay");
const incident=JSON.parse(fs.readFileSync(out+"/clock-resume-incident.json"));
assert.equal(incident.classification,"HARNESS_CLOCK_ERROR_NOT_PRODUCT_DEFECT");
const templateHash=createHash("sha256").update(fs.readFileSync(local+"/template.dump")).digest("hex");
assert.equal(templateHash,JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/template-identity.json")).sha256);
for(const pid of fs.readdirSync("/proc").filter(p=>/^\d+$/.test(p))){
  let cmd;try{cmd=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0");}catch{continue;}
  assert.ok(!cmd.includes(local+"/month-run.mjs"),"Monthly harness still alive: refuse reset");
  assert.ok(!(cmd.some(a=>a.endsWith("/clock/launch.mjs"))&&cmd.includes("harness")),"Harness launcher still alive");
}
const env={PATH:process.env.PATH,HOME:local,TZ:"UTC"};
function run(cmd,args,extra={}){
  const p=spawnSync(cmd,args,{env:{...env,...extra},encoding:"utf8",timeout:120000});
  if(p.status!==0)throw Error(`${cmd.split("/").at(-1)} failed; private output withheld`);
  return p.stdout;
}
async function connect(database="postgres"){
  const c=new pg.Client({host:socket,port,user:"postgres",database});await c.connect();
  const id=(await c.query("select current_database() db,current_setting('data_directory') dir,current_setting('port')::int port")).rows[0];
  assert.equal(id.db,database);assert.equal(id.dir,dir);assert.equal(id.port,port);return c;
}
function validatePid(){
  const lines=fs.readFileSync(dir+"/postmaster.pid","utf8").split("\n"),pid=Number(lines[0]);
  assert.ok(Number.isSafeInteger(pid)&&pid>1);assert.equal(lines[1],dir);assert.equal(Number(lines[3]),port);
  const args=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0");
  assert.equal(args[0],bin+"/postgres");assert.ok(args.includes(dir));assert.ok(args.includes("55443"));
}
if(fs.existsSync(dir+"/postmaster.pid")){
  validatePid();
  const c=await connect();
  const names=(await c.query("select datname from pg_database where not datistemplate order by 1")).rows.map(r=>r.datname);
  assert.deepEqual(names,["postgres","tanda_ga_month","tanda_ga_witness"]);
  await c.end();
  run(bin+"/pg_ctl",["-D",dir,"-m","fast","-w","stop"]);
}
assert.ok(!fs.existsSync(dir+"/postmaster.pid"));
fs.mkdirSync(archive); // exclusive mkdir: failed attempt is preserved exactly once
const files=[];
for(const name of ["results.json","progress.txt","journal.jsonl.gz","journal.jsonl","cuts.jsonl","pending-step.json","clock-resume-incident.json"]){
  const path=out+"/"+name;if(!fs.existsSync(path))continue;
  const bytes=fs.readFileSync(path);
  files.push({name,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
  fs.renameSync(path,archive+"/"+name);
}
for(const name of ["INFORME.md","run.ts"]){
  fs.copyFileSync(out+"/"+name,archive+"/"+name,fs.constants.COPYFILE_EXCL);
}
fs.writeFileSync(archive+"/archive-manifest.json",JSON.stringify({classification:incident.classification,completedDays:29,fullMonthPass:false,files,method:"Original failed evidence moved byte-for-byte; no history repair"},null,2),{flag:"wx"});
// Postmaster stopped: clock reset cannot alter the failed database's committed history.
run(local+"/month-clock-controller",[cfg.initial]);
run(bin+"/pg_ctl",["-D",dir,"-l",local+"/month-restore.log","-o",`-p ${port} -k ${socket} -h 127.0.0.1`,"-w","start"],{LD_PRELOAD:local+"/month-clock.so"});
let c;
try{
  validatePid();c=await connect();
  await c.query("DROP DATABASE tanda_ga_month");
  await c.query("CREATE DATABASE tanda_ga_month");
  await c.end();c=null;
  run(bin+"/pg_restore",["--exit-on-error","--no-owner","--no-acl","-h",socket,"-p","55443","-U","postgres","-d","tanda_ga_month",local+"/template.dump"]);
  c=await connect("tanda_ga_month");
  await c.query("REVOKE CONNECT ON DATABASE tanda_ga_month FROM PUBLIC");
  await c.query("GRANT CONNECT ON DATABASE tanda_ga_month TO ga_month");
  await c.query("GRANT USAGE,CREATE ON SCHEMA public TO ga_month");
  await c.query("GRANT ALL ON ALL TABLES IN SCHEMA public TO ga_month");
  await c.query("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ga_month");
  const manifest=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json"));
  const sites=(await c.query("select count(*)::int n from ubicaciones where id=any($1)",[manifest.sites.map(s=>s.id)])).rows[0].n;
  const units=(await c.query("select unidad::text unit from productos where id=any($1) order by unidad::text",[manifest.products.map(p=>p.id)])).rows.map(p=>p.unit);
  assert.equal(sites,7);assert.deepEqual(units,["BOLSA","KILO","METRO","PIEZA"]);
  const metrage=(await c.query("select count(*)::int n from productos where se_vende_por_metro")).rows[0].n;assert.equal(metrage,0);
  const sessions=(await c.query("select fecha_operativa::text fecha,estado::text estado,count(*)::int n from sesiones_caja where ubicacion_id=any($1) group by 1,2 order by 1,2",[manifest.sites.map(s=>s.id)])).rows;
  assert.ok(sessions.some(s=>s.estado==="ABIERTA"&&s.fecha===cfg.initial.slice(0,10)&&s.n===3));
  const clock=(await c.query("select now()::text wall,(now() at time zone 'America/Mexico_City')::date::text AS day")).rows[0];
  assert.equal(clock.day,cfg.initial.slice(0,10));
  await c.end();c=null;
  fs.writeFileSync(out+"/clock/fresh-restore.json",JSON.stringify({status:"RESTORED_FRESH_STOPPED",database:"tanda_ga_month",directory:dir,port,templateSha256:templateHash,archive:"failed-attempt-clock-resume",clock,sites,units,metrage,sessions,simulationRun:false,historyRepair:false,shared55442Touched:false,mainPersistentRestartRequired:true},null,2),{flag:"wx"});
}finally{
  if(c)await c.end().catch(()=>{});
  validatePid();run(bin+"/pg_ctl",["-D",dir,"-m","fast","-w","stop"]);
}
console.log("Failed evidence archived once; exclusive month database restored fresh; clock reset; postmaster STOPPED. MAIN persistent restart required.");