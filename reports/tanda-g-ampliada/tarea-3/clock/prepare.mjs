import fs from "node:fs";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash,randomBytes} from "node:crypto";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";
const root="/home/runner/workspace", local=root+"/.local/tanda-g-ampliada";
const dir=local+"/month-cluster", socket=local+"/month-socket", port=55443;
const bin="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const report=root+"/reports/tanda-g-ampliada/tarea-3/clock";
const env={PATH:process.env.PATH,HOME:local,TZ:"UTC"};
function run(cmd,args,extra={}) {
  const p=spawnSync(cmd,args,{env:{...env,...extra},encoding:"utf8",timeout:120000});
  if(p.status!==0)throw Error(`${cmd.split("/").at(-1)} failed (private preparation output withheld)`);
  return p.stdout;
}
assert.ok(!fs.existsSync(dir),"Refuse to overwrite existing month cluster");
const expected=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/template-identity.json"));
assert.equal(createHash("sha256").update(fs.readFileSync(local+"/template.dump")).digest("hex"),expected.sha256);
run("cc",["-shared","-fPIC","-O2","-Wall","-Wextra",report+"/process-clock.c","-o",local+"/month-clock.so"]);
run("cc",["-O2","-Wall","-Wextra","-DCONTROLLER",report+"/process-clock.c","-o",local+"/month-clock-controller"]);
fs.chmodSync(local+"/month-clock.so",0o700);
fs.chmodSync(local+"/month-clock-controller",0o700);
fs.writeFileSync(local+"/month-clock-offset","0\n",{mode:0o600});
fs.mkdirSync(socket,{mode:0o700});
run(bin+"/initdb",["-D",dir,"-U","postgres","--auth-local=trust","--auth-host=scram-sha-256","--encoding=UTF8","--locale=C"]);
fs.appendFileSync(dir+"/postgresql.conf","\ntimezone = 'America/Mexico_City'\n");
fs.writeFileSync(dir+"/pg_hba.conf","local all postgres trust\nhost all postgres 127.0.0.1/32 trust\nhost all all 127.0.0.1/32 scram-sha-256\n",{mode:0o600});
// Only an ephemeral preparation/proof postmaster; MAIN owns persistent launch.
run(bin+"/pg_ctl",["-D",dir,"-l",local+"/month-preparation.log","-o",`-p ${port} -k ${socket} -h 127.0.0.1`,"-w","start"],{LD_PRELOAD:local+"/month-clock.so"});
let c;
try {
  c=new pg.Client({host:socket,port,user:"postgres",database:"postgres"});await c.connect();
  await c.query("create database tanda_ga_month");
  await c.query("create database tanda_ga_witness");
  await c.end();
  run(bin+"/pg_restore",["--exit-on-error","--no-owner","--no-acl","-h",socket,"-p",String(port),"-U","postgres","-d","tanda_ga_month",local+"/template.dump"]);
  c=new pg.Client({host:socket,port,user:"postgres",database:"tanda_ga_month"});await c.connect();
  const password=randomBytes(32).toString("hex");
  await c.query(`create role ga_month login password '${password}' nosuperuser nocreatedb nocreaterole noreplication`);
  await c.query("grant pg_read_all_settings to ga_month");
  for(const db of ["postgres","template1","tanda_ga_witness","tanda_ga_month"])await c.query(`revoke connect on database ${db} from public`);
  await c.query("grant connect on database tanda_ga_month to ga_month");
  await c.query("grant usage,create on schema public to ga_month");
  await c.query("grant all on all tables in schema public to ga_month");
  await c.query("grant all on all sequences in schema public to ga_month");
  const identity=(await c.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port")).rows[0];
  assert.equal(identity.directory,dir);
  const databases=(await c.query("select datname from pg_database where not datistemplate order by 1")).rows.map(x=>x.datname);
  assert.deepEqual(databases,["postgres","tanda_ga_month","tanda_ga_witness"]);
  const metrage=(await c.query("select count(*)::int n from productos where se_vende_por_metro")).rows[0].n;assert.equal(metrage,0);
  const fixtureDate=(await c.query("select max(fecha_operativa)::text AS day from sesiones_caja where estado='ABIERTA'")).rows[0].day;
  assert.match(fixtureDate,/^\d{4}-\d{2}-\d{2}$/);
  const initial=fixtureDate+"T18:00:00.000Z";
  fs.writeFileSync(local+"/month-database.json",JSON.stringify({url:`postgresql://ga_month:${password}@127.0.0.1:${port}/tanda_ga_month`,dir,port,initial}),{mode:0o600});
  run(local+"/month-clock-controller",[initial]);
  await c.end();c=null;
  run(process.execPath,[report+"/proof.mjs"],{LD_PRELOAD:local+"/month-clock.so"});
  fs.writeFileSync(report+"/preparation.json",JSON.stringify({database:"tanda_ga_month",directory:dir,port,databases,metrage,fixtureDate,templateSha256:expected.sha256,source:"Sanitized template.dump verified against setup/template-identity.json; no app DB connection",status:"prepared and stopped",clock:"PRIVATE process wall-clock offset; monotonic clocks unmodified"},null,2));
} finally {
  if(c)await c.end().catch(()=>{});
  run(bin+"/pg_ctl",["-D",dir,"-m","fast","-w","stop"]);
}
console.log("Exclusive monthly cluster prepared, clock proof saved, postmaster stopped.");