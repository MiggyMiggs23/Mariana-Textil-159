import fs from "node:fs";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";
const local="/home/runner/workspace/.local/tanda-g-ampliada";
const cfg=JSON.parse(fs.readFileSync(local+"/month-database.json"));
assert.equal(process.env.LD_PRELOAD,local+"/month-clock.so");
const c=new pg.Client({connectionString:cfg.url});await c.connect();
const controller=local+"/month-clock-controller";
const observations=[];
try {
  const id=(await c.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port")).rows[0];
  assert.equal(id.db,"tanda_ga_month");assert.equal(id.directory,local+"/month-cluster");assert.equal(id.port,55443);
  const manifest=JSON.parse(fs.readFileSync("reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json"));
  const sites=(await c.query("select count(*)::int n from ubicaciones where id=any($1)",[manifest.sites.map(s=>s.id)])).rows[0].n;
  const units=(await c.query("select unidad::text unit from productos where id=any($1) order by unidad::text",[manifest.products.map(p=>p.id)])).rows.map(p=>p.unit);
  assert.equal(sites,7);assert.deepEqual(units,["BOLSA","KILO","METRO","PIEZA"]);
  const connect=(await c.query("select datname,has_database_privilege(current_user,datname,'CONNECT') allowed from pg_database where not datistemplate order by datname")).rows;
  assert.ok(connect.every(r=>r.allowed===(r.datname==="tanda_ga_month")));
  id.fixtureSites=sites;id.fixtureUnits=units;id.connect=connect;
  for(let day=0;day<2;day++){
    const date=new Date(cfg.initial);date.setUTCDate(date.getUTCDate()+day);
    const before=process.hrtime.bigint();
    execFileSync(controller,[date.toISOString()]);
    await new Promise(r=>setTimeout(r,150));
    const elapsed=Number(process.hrtime.bigint()-before)/1e6;
    const row=(await c.query("select now()::text wall,extract(epoch from now())::float8 epoch,(now() at time zone 'America/Mexico_City')::date::text AS day")).rows[0];
    const harness=new Date();
    assert.ok(Math.abs(row.epoch*1000-harness.getTime())<2000);
    assert.equal(harness.toISOString().slice(0,10),date.toISOString().slice(0,10));
    assert.equal(row.day,date.toISOString().slice(0,10));
    assert.ok(elapsed>=100&&elapsed<10000,"Monotonic timer changed with wall time");
    observations.push({target:date.toISOString(),postgres:row.wall,epoch:row.epoch,harness:harness.toISOString(),monotonicElapsedMs:elapsed});
  }
  assert.ok(Math.abs(observations[1].epoch-observations[0].epoch-86400)<2);
  fs.writeFileSync("reports/tanda-g-ampliada/tarea-3/clock/proof.json",JSON.stringify({status:"PASS",identity:id,observations,sql:"SELECT now(); read-only identity and clock probes only",restoredTo:cfg.initial,noSimulationRun:true,monotonic:"CLOCK_MONOTONIC/RAW/BOOTTIME and all non-realtime IDs pass directly to kernel; 150ms Node timer remained real across one-day wall jump"},null,2));
} finally {
  execFileSync(controller,[cfg.initial]);await c.end();
}
console.log("PostgreSQL now(), harness Date, and monotonic progression: PASS.");