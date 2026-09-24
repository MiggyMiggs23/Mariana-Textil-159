import fs from "node:fs";
import {spawnSync,spawn} from "node:child_process";
import {randomBytes,createHash} from "node:crypto";
import pg from "/home/runner/workspace/scripts/node_modules/pg/lib/index.js";
const root="/home/runner/workspace", r=root+"/private.local/tanda-h-resume", report=root+"/reports/tanda-h/continuacion/setup";
const PG="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const workers=["browser"], port=55445;
function command(name,args){const x=spawnSync(PG+"/"+name,args,{encoding:"utf8",timeout:90000});if(x.status!==0)throw Error(name+" failed");return x.stdout;}
function clusterIdentity(){
 const pid=Number(fs.readFileSync(r+"/cluster/postmaster.pid","utf8").split("\n")[0]);
 const args=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0");
 if(!args.includes(r+"/cluster")||!args.includes(String(port)))throw Error("Cluster identity mismatch");
 return pid;
}
function start(){if(fs.existsSync(r+"/cluster/postmaster.pid")){clusterIdentity();return;}command("pg_ctl",["-D",r+"/cluster","-l",r+"/postgres-runtime.log","-o",`-p ${port} -k ${r}/socket -h 127.0.0.1`,"-w","start"]);clusterIdentity();}
function stop(){if(fs.existsSync(r+"/cluster/postmaster.pid")){clusterIdentity();command("pg_ctl",["-D",r+"/cluster","-m","fast","-w","stop"]);}}
async function client(database,user="postgres",password){const c=new pg.Client({host:"127.0.0.1",port,user,password,database,connectionTimeoutMillis:8000,statement_timeout:15000});await c.connect();return c;}
const action=process.argv[2], worker=process.argv[3];
if(action==="start")start();
else if(action==="stop")stop();
else if(action==="seal"){
 start();
 try{
 const manifest=JSON.parse(fs.readFileSync(report+"/fixture-manifest-redacted.json","utf8"));
 const admin=await client("postgres"), credentials={}, identities=[];
 for(const name of ["template",...workers,"witness"]){
  const db="tanda_hr_"+name;
  await admin.query(`REVOKE CONNECT ON DATABASE ${db} FROM PUBLIC`);
  const c=await client(db);
  const identity=(await c.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port,current_setting('server_version_num') version")).rows[0];
  if(identity.db!==db||identity.directory!==r+"/cluster"||identity.port!==port)throw Error("Copy identity mismatch");
  if(name!=="witness"){
   identity.roles=(await c.query("select unnest(enum_range(null::rol_usuario))::text role")).rows.map(x=>x.role);
   identity.sites=(await c.query("select tipo,count(*)::int n from ubicaciones where id=any($1) group by tipo",[manifest.sites.map(x=>x.id)])).rows;
   identity.admin=(await c.query("select count(*)::int n from usuarios where usuario='admin' and rol='ADMIN' and activo")).rows[0].n;
   if(identity.admin!==1||identity.roles.length!==7)throw Error("Actor guard mismatch");
  }else identity.tables=(await c.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n;
  if(workers.includes(name)){
   const role="hr_"+name,password=randomBytes(32).toString("hex");
   await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
   await admin.query(`GRANT CONNECT ON DATABASE ${db} TO ${role}`);
   await c.query(`GRANT USAGE,CREATE ON SCHEMA public TO ${role}`);
   await c.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${role}`);
   await c.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
   credentials[name]={url:`postgresql://${role}:${password}@127.0.0.1:${port}/${db}`,db,role,apiPort:43874+workers.indexOf(name),uiPort:43884+workers.indexOf(name)};
  }
  identities.push(identity);await c.end();
 }
 const connectMatrix=(await admin.query("select r.rolname,d.datname,has_database_privilege(r.rolname,d.datname,'CONNECT') allowed from pg_roles r cross join pg_database d where r.rolname like 'hr_%' and d.datname like 'tanda_hr_%' order by 1,2")).rows;
 if(connectMatrix.some(x=>x.allowed!==(x.datname==="tanda_"+x.rolname)))throw Error("Sibling access guard mismatch");
 await admin.end();
 fs.writeFileSync(r+"/worker-databases.json",JSON.stringify(credentials,null,2),{mode:0o600});
 // Require credentials for TCP worker roles, including against any sibling database.
 fs.writeFileSync(r+"/cluster/pg_hba.conf","local all postgres trust\nhost all postgres 127.0.0.1/32 trust\nhost all all 127.0.0.1/32 scram-sha-256\n",{mode:0o600});
 command("pg_ctl",["-D",r+"/cluster","reload"]);
 const schema=command("pg_dump",["-h","127.0.0.1","-p",String(port),"-U","postgres","-d","tanda_hr_template","--schema-only","--no-owner","--no-acl"]);
 fs.writeFileSync(r+"/actual-schema.sql",schema,{mode:0o600});
 fs.writeFileSync(report+"/copy-identities.json",JSON.stringify({identities,connectMatrix,schemaSha256:createHash("sha256").update(schema).digest("hex"),testsRun:false},null,2));
 console.log("Worker identities sealed; sibling CONNECT denied; no application started.");
 }finally{stop();}
}else if(action==="api"||action==="ui"){
 if(!workers.includes(worker))throw Error("Named worker required");
 clusterIdentity();
 const cfg=JSON.parse(fs.readFileSync(r+"/worker-databases.json","utf8"))[worker];
 const c=await client(cfg.db);
 const id=(await c.query("select current_database() db,current_setting('data_directory') directory")).rows[0];await c.end();
 if(id.db!==cfg.db||id.directory!==r+"/cluster")throw Error("Wrong database");
 const env={PATH:process.env.PATH,HOME:r};
 let script;
 if(action==="api"){
  script=report+"/api-runner.mjs";
  Object.assign(env,{NODE_ENV:"test",PORT:String(cfg.apiPort),REQUIRE_ISOLATED_TEST_DATABASE:"1",TEST_DATABASE_URL:cfg.url,DATABASE_URL:"postgresql://postgres@127.0.0.1:55445/tanda_hr_witness",APPLICATION_DATABASE_URL:"postgresql://postgres@127.0.0.1:55445/tanda_hr_witness",SESSION_SECRET:fs.readFileSync(r+"/session-secret","utf8"),WORKER:worker});
 }else{
  script=report+"/proxy.mjs";
  Object.assign(env,{STATIC_ROOT:r+"/frozen-source/artifacts/mariana-textil/dist/public",API_PORT:String(cfg.apiPort),PROXY_PORT:String(cfg.uiPort)});
 }
 const child=spawn(process.execPath,[script],{env,stdio:"inherit"});
 fs.writeFileSync(r+`/${worker}-${action}.pid`,String(child.pid),{mode:0o600});
 process.on("SIGTERM",()=>child.kill("SIGTERM"));process.on("SIGINT",()=>child.kill("SIGTERM"));
 child.on("exit",code=>process.exit(code??1));
}else if(action==="teardown"){
 if(fs.existsSync(r)){
  for(const name of workers)for(const kind of ["api","ui"]){
   const file=r+`/${name}-${kind}.pid`;if(!fs.existsSync(file))continue;
   const pid=Number(fs.readFileSync(file,"utf8"));
   if(!Number.isSafeInteger(pid)||pid<2)throw Error("Invalid pid");
   if(fs.existsSync(`/proc/${pid}/cmdline`)){
    const cmd=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8");
    if(!cmd.includes(report+"/"))throw Error("Unrelated PID; refusing cleanup");
    process.kill(pid,"SIGTERM");
   }
  }
  await new Promise(ok=>setTimeout(ok,1500));stop();
  if(process.argv.includes("--remove"))fs.rmSync(r,{recursive:true});
 }
 fs.writeFileSync(report+"/teardown-verification.json",JSON.stringify({at:new Date().toISOString(),removed:!fs.existsSync(r)},null,2));
}else throw Error("Usage: lifecycle.mjs start|stop|seal|api WORKER|ui WORKER|teardown [--remove]");