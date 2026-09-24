import fs from "node:fs";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";
const root="/home/runner/workspace",local=root+"/.local/tanda-g-ampliada";
const cfg=JSON.parse(fs.readFileSync(local+"/month-database.json"));
assert.equal(cfg.dir,local+"/month-cluster");assert.equal(cfg.port,55443);
const target=new URL(cfg.url);
assert.equal(target.hostname,"127.0.0.1");assert.equal(target.port,"55443");assert.equal(target.pathname,"/tanda_ga_month");
const env={PATH:process.env.PATH,HOME:local,TZ:"UTC",LD_PRELOAD:local+"/month-clock.so"};
const action=process.argv[2];
let command,args;
if(action==="postgres"){
  assert.ok(!fs.existsSync(cfg.dir+"/postmaster.pid"),"Postmaster already exists; verify it, do not start twice");
  command="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/postgres";
  args=["-D",cfg.dir,"-p","55443","-k",local+"/month-socket","-h","127.0.0.1"];
}else if(action==="harness"||action==="proof"){
  const c=new pg.Client({connectionString:cfg.url});await c.connect();
  const row=(await c.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port")).rows[0];await c.end();
  assert.equal(row.db,"tanda_ga_month");assert.equal(row.directory,cfg.dir);assert.equal(row.port,55443);
  Object.assign(env,{NODE_ENV:"test",REQUIRE_ISOLATED_TEST_DATABASE:"1",TEST_DATABASE_URL:cfg.url,
    DATABASE_URL:"postgresql://postgres@127.0.0.1:55443/tanda_ga_witness",
    APPLICATION_DATABASE_URL:"postgresql://postgres@127.0.0.1:55443/tanda_ga_witness",
    MONTH_DATA_DIRECTORY:cfg.dir,MONTH_PG_PORT:"55443",
    MONTH_CLOCK_EXCLUSIVE:"MAIN_CONFIRMED_NO_OTHER_WORKER_DATABASES",
    MONTH_CLOCK_CONTROLLER:local+"/month-clock-controller"});
  command=process.execPath;
  args=[action==="proof"?root+"/reports/tanda-g-ampliada/tarea-3/clock/proof.mjs":local+"/month-run.mjs",...process.argv.slice(3)];
}else throw Error("Expected postgres, proof, or harness; MAIN owns persistent postgres and worker owns simulation");
const child=spawn(command,args,{cwd:root,env,stdio:"inherit"});
process.on("SIGTERM",()=>child.kill("SIGTERM"));process.on("SIGINT",()=>child.kill("SIGINT"));
child.on("error",()=>process.exit(1));
child.on("exit",code=>process.exit(code??1));