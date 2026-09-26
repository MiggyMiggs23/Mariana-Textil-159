import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const dir="/tmp/release-owner-20260926",report=path.resolve("reports/release-owner-20260926/infra");
const read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const source=new URL(process.env.DATABASE_URL),target=new URL(read(`${dir}/neon.json`).TEST_DATABASE_URL);
target.hostname=target.hostname.replace("-pooler","");
if(!target.hostname.endsWith(".neon.tech")||target.hostname===source.hostname)throw Error("Isolated target required");
const run=(cmd,args,u,readonly=false)=>{
  const r=spawnSync(cmd,args,{encoding:"utf8",maxBuffer:10_000_000,env:{PATH:process.env.PATH,HOME:process.env.HOME,
    PGHOST:u.hostname,PGPORT:u.port||"5432",PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),
    PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:u.searchParams.get("sslmode")||"prefer",
    ...(readonly?{PGOPTIONS:"-c default_transaction_read_only=on"}:{})}});
  fs.writeFileSync(`${dir}/${cmd}-${Date.now()}.diagnostic`,r.stderr||"",{mode:0o600});
  if(r.status!==0)throw Error(`${cmd} failed; restricted diagnostic retained`);
};
const sourceC=new pg.Client({connectionString:source.href,options:"-c default_transaction_read_only=on"});
await sourceC.connect();await sourceC.query("BEGIN READ ONLY");
const sourceIdentity=(await sourceC.query("SELECT current_database() database,current_setting('server_version') version,current_setting('transaction_read_only') readonly")).rows[0];
const originalClients=(await sourceC.query("SELECT count(*)::int total,count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
await sourceC.query("ROLLBACK");await sourceC.end();
run("pg_dump",["--format=custom","--no-owner","--no-acl","--file",`${dir}/application.dump`],source,true);
fs.chmodSync(`${dir}/application.dump`,0o600);
const original=read("reports/priority-20260926/candidate.json");
if(original.apiSha256!=="1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e"||
 original.frontendFiles["index.html"]!=="02e8384c8f458daa0d29a958bc1c519ca7e2b75705a47db3d8b514527965ad78"||
 hash(fs.readFileSync(original.apiEntry))!==original.apiSha256)throw Error("Baseline v8/UI mismatch");
const code=fs.readFileSync(original.apiEntry,"utf8"),marker="    db = drizzle(pool, { schema: schema_exports });";
if(code.split(marker).length!==2)throw Error("Observer hook ambiguous");
const observed=path.join(path.dirname(original.apiEntry),"release-observed.mjs");
fs.writeFileSync(observed,code.replace(marker,"    globalThis.__releaseObservePool(pool);\n"+marker));
const baseCandidate={...original,originalApiEntry:original.apiEntry,originalApiSha256:original.apiSha256,
 apiEntry:observed,apiSha256:hash(fs.readFileSync(observed)),instrumentation:"One observer hook; baseline business logic unchanged; one pg_backend_pid SELECT per physical connection"};
const databases=[];
for(const [kind,database,apiPort,webPort] of [["login","release_login_20260926",18227,18228],["perf","release_perf_20260926",18237,18238]]){
  const privateDir=`${dir}/${database}`,reports=`${report}/${kind}`;
  fs.mkdirSync(privateDir,{recursive:true,mode:0o700});fs.mkdirSync(reports,{recursive:true});
  const control=new pg.Client({connectionString:target.href});await control.connect();
  if((await control.query("SELECT 1 FROM pg_database WHERE datname=$1",[database])).rowCount)throw Error("Refusing existing copy overwrite");
  await control.query(`CREATE DATABASE ${database}`);await control.end();
  const url=new URL(target);url.pathname=`/${database}`;
  run("pg_restore",["--exit-on-error","--no-owner","--no-acl","--dbname",database,`${dir}/application.dump`],url);
  const c=new pg.Client({connectionString:url.href});await c.connect();
  const clients=(await c.query("SELECT count(*)::int total,count(*) FILTER(WHERE id<>1)::int nonsystem FROM clientes")).rows[0];
  if(clients.nonsystem!==originalClients.nonsystem)throw Error("Copy customer count mismatch");
  const actors=[];
  for(const suffix of kind==="login"?["admin","F","A","audit1","audit2"]:["admin"]){
    const password=crypto.randomBytes(28).toString("base64url");
    const actor=(await c.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,alcance_consulta)
      VALUES($1,$2,crypt($3,gen_salt('bf',12)),'ADMIN','TODAS') RETURNING id,usuario`,
      [`Release isolated ${kind} ${suffix}`,`e2e.release.${kind}.${suffix}`,password])).rows[0];
    actors.push({...actor,password,fixtureLabel:suffix});
  }
  await c.end();
  fs.writeFileSync(`${privateDir}/test-env.json`,JSON.stringify({TEST_DATABASE_URL:url.href}),{mode:0o600});
  fs.writeFileSync(`${privateDir}/credentials.json`,JSON.stringify({admin:actors[0],actors}),{mode:0o600});
  fs.writeFileSync(`${reports}/candidate.json`,JSON.stringify(kind==="perf"?original:baseCandidate,null,2));
  for(const name of ["api-bootstrap.mjs","launch-private.mjs"]){
    let text=fs.readFileSync(`reports/priority-20260926/${name}`,"utf8")
      .replaceAll("../../lib/db/","../../../../lib/db/")
      .replaceAll("/tmp/priority-20260926",privateDir)
      .replaceAll("reports/priority-20260926",`reports/release-owner-20260926/infra/${kind}`)
      .replaceAll("priority_20260926",database)
      .replaceAll("18227",String(apiPort)).replaceAll("18228",String(webPort));
    if(name==="api-bootstrap.mjs"&&kind==="login")text='import "../observer.mjs";\n'+text;
    fs.writeFileSync(`${reports}/${name}`,text);
  }
  if(kind==="perf"){
    const loader=fs.readFileSync("reports/noche-20260926/tarea-2/annual-load.mjs","utf8")
      .replaceAll("../../../lib/db/","../../../../lib/db/")
      .replaceAll("/tmp/noche-20260926",privateDir).replaceAll("noche_20260926",database);
    fs.writeFileSync(`${reports}/annual-load.mjs`,loader);
  }
  databases.push({kind,database,clients,actors:actors.map(({password,...a})=>a),ports:[apiPort,webPort],
    reportDir:reports,privateDir,started:false,annualLoad:kind==="perf"?"PENDING":"NOT_APPLICABLE"});
}
fs.writeFileSync(`${report}/copy-ready.json`,JSON.stringify({status:"RESTORED_NOT_STARTED",
 branch:"br-falling-king-axocxbt1",project:"withered-block-09991755",sourceIdentity,originalClients,
 dumpSha256:hash(fs.readFileSync(`${dir}/application.dump`)),dumpMethod:"Complete consistent pg_dump READ ONLY; owners/ACL excluded only; constraints/triggers/data restored",
 baselineApiSha256:original.apiSha256,observedApiSha256:baseCandidate.apiSha256,
 frontendIndexSha256:original.frontendFiles["index.html"],databases,at:new Date().toISOString()},null,2));
console.log("TWO_COMPLETE_COPIES_READY_NOT_STARTED; separate login/performance DBs; annual loader pending");