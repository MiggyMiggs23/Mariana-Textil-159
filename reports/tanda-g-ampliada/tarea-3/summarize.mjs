import fs from "node:fs";
import assert from "node:assert/strict";
import {createGunzip} from "node:zlib";
import {createInterface} from "node:readline";
import {createHash} from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const out="reports/tanda-g-ampliada/tarea-3";
const results=JSON.parse(fs.readFileSync(`${out}/results.json`));
assert.equal(results.status,"PASS");assert.equal(results.completedDays,30);
const counts={},days={},seen=new Set();
let steps=0,first,last;
for await(const line of createInterface({input:fs.createReadStream(`${out}/journal.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity})){
  const r=JSON.parse(line);assert.equal(r.status,"PASS");assert.ok(!seen.has(r.step));seen.add(r.step);
  steps++;first??=r;last=r;days[r.day]=(days[r.day]??0)+1;
  const kind=r.name.split(":")[0];counts[kind]=(counts[kind]??0)+1;
  assert.equal(r.before.inventory.length,28);assert.equal(r.after.inventory.length,28);
  for(const row of r.after.inventory){assert.equal(row.physical,row.cache);assert.equal(row.cache,row.ledger);}
}
assert.equal(Object.keys(days).length,30);
const cuts=fs.readFileSync(`${out}/cuts.jsonl`,"utf8").trim().split("\n").map(JSON.parse);
assert.equal(cuts.length,90);assert.equal(new Set(cuts.map(c=>c.session)).size,90);
for(const c of cuts)assert.equal(Number(c.after.diferencia),0);
const f=JSON.parse(fs.readFileSync("reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json"));
const cfg=JSON.parse(fs.readFileSync(".local/tanda-g-ampliada/month-database.json"));
const url=new URL(cfg.url);assert.equal(url.hostname,"127.0.0.1");assert.equal(url.port,"55443");assert.equal(url.pathname,"/tanda_ga_month");
const c=new pg.Client({connectionString:cfg.url});await c.connect();
let db;
try{
  await c.query("BEGIN READ ONLY");
  const query=async(sql,args=[]) => (await c.query(sql,args)).rows;
  const identity=(await query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port,current_setting('transaction_read_only') read_only"))[0];
  assert.equal(identity.port,55443);assert.equal(identity.directory,cfg.dir);assert.equal(identity.read_only,"on");
  const sessions=await query("select ubicacion_id,count(*)::int sessions,count(distinct fecha_operativa)::int dates,count(*) filter(where estado='CERRADA')::int closed,min(fecha_operativa)::text first,max(fecha_operativa)::text last from sesiones_caja where ubicacion_id=any($1) group by ubicacion_id order by ubicacion_id",[f.sites.map(s=>s.id)]);
  assert.equal(sessions.length,3);for(const s of sessions){assert.equal(s.sessions,30);assert.equal(s.dates,30);assert.equal(s.closed,30);}
  const gates=await query("select ubicacion_id,count(*)::int gates,count(distinct fecha_operativa)::int dates from sesiones_caja_dias where ubicacion_id=any($1) group by ubicacion_id order by ubicacion_id",[f.sites.map(s=>s.id)]);
  for(const g of gates){assert.equal(g.gates,30);assert.equal(g.dates,30);}assert.equal(gates.length,3);
  const credit=await query("select tipo,count(*)::int movements,sum(importe)::text amount from movimientos_credito where cliente_id=$1 group by tipo order by tipo",[f.customer.id]);
  const monotonic=await query("select count(*)::int inverted from (select created_at,lag(created_at) over(order by id) previous from movimientos_credito where cliente_id=$1) s where created_at<previous",[f.customer.id]);
  assert.equal(monotonic[0].inverted,0);
  db={identity,sessions,gates,credit,creditTimestampInversions:monotonic[0].inverted};
  await c.query("COMMIT");
}finally{await c.end();}
const byUnit=Object.fromEntries(f.products.map(p=>[p.unidad,{initial:results.initial.inventory.filter(i=>i.producto_id===p.id).reduce((n,i)=>n+Number(i.physical),0),final:results.final.inventory.filter(i=>i.producto_id===p.id).reduce((n,i)=>n+Number(i.physical),0)}]));
const sha=async path=>{const h=createHash("sha256");for await(const chunk of fs.createReadStream(path))h.update(chunk);return h.digest("hex");};
const summary={status:"PASS",scope:"Synthetic 30-calendar-date controlled process-clock run, not actual observed business volume",completedDays:30,steps,counts,stepsPerDay:days,sites:7,nativeUnits:Object.keys(byUnit),totalsByUnit:byUnit,firstDate:results.days[0].date,lastDate:results.days.at(-1).date,uniqueClosedCuts:90,allCutDifferencesZero:true,finalCustomerNetBalance:results.final.debt[0].balance,db,evidence:{journalSha256:await sha(`${out}/journal.jsonl.gz`),cutsSha256:await sha(`${out}/cuts.jsonl`),resultsSha256:await sha(`${out}/results.json`)},excluded:"Previous failed clock-resume attempt retained separately; no events from it included."};
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify({status:summary.status,steps,counts,totalsByUnit:byUnit,finalCustomerNetBalance:summary.finalCustomerNetBalance,credit:db.credit},null,2));