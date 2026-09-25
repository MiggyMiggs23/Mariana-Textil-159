// MAIN explicitly authorized exact released remate and rehearsed E11 SQL, disposable only.
import fs from "node:fs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const expected=JSON.parse(fs.readFileSync("reports/trabajo-nocturno-20260925/tarea-5/ownership.json"));
const c=new pg.Client({connectionString:"postgresql://postgres@127.0.0.1:55526/night56_test",connectionTimeoutMillis:5000});
const result={files:[],status:"RUNNING"};
await c.connect();
try{
 const identity=(await c.query("select current_database() database,inet_server_port() port,current_setting('data_directory') directory,pg_postmaster_start_time() started")).rows[0];
 assert.equal(identity.database,expected.identity.database);assert.equal(identity.port,expected.identity.port);assert.equal(identity.directory,expected.identity.directory);assert.equal(identity.started.toISOString(),expected.identity.started);
 result.identity=identity;
 result.before=(await c.query("select md5(pg_get_functiondef('public.e11_graph()'::regprocedure)) e11_graph")).rows[0];
 const prior=JSON.parse(fs.readFileSync("reports/trabajo-nocturno-20260925/tarea-2/task56-additional-graph-correction.json"));
 assert.equal(prior.status,"PASS");assert.equal(prior.identity.database,identity.database);assert.equal(prior.identity.started,identity.started.toISOString());
 assert.equal(result.before.e11_graph,prior.graph.md5);result.alreadyAppliedGraphCorrection=prior;
 assert.equal((await c.query("select to_regclass('public.tarea4_rollo_remate') relation")).rows[0].relation,null);
 for(const path of ["reports/tanda-d-20260923/tarea1-up.sql","reports/trabajo-nocturno-20260925/tarea-2/01-candidate-not-approved.sql"]){
  const text=fs.readFileSync(path,"utf8");await c.query(text);result.files.push({path,sha256:createHash("sha256").update(text).digest("hex"),applied:true});
 }
 result.after=(await c.query("select md5(pg_get_functiondef('public.e11_graph()'::regprocedure)) e11_graph,(select count(*)::int from pg_trigger where tgname='e5_closed' and tgenabled='O') e5_closed,(select count(*)::int from pg_trigger where tgname='e11_closed' and tgenabled='O') e11_closed")).rows[0];
 assert.equal(result.after.e5_closed,9);assert.equal(result.after.e11_closed,0);
 result.status="PASS_DISPOSABLE_ONLY";
}catch(e){await c.query("ROLLBACK");result.status="STOP";result.error=e.message;process.exitCode=1;}
finally{await c.end();fs.writeFileSync("reports/trabajo-nocturno-20260925/tarea-5/released-provision-result.json",JSON.stringify(result,null,2));}
console.log(JSON.stringify(result));