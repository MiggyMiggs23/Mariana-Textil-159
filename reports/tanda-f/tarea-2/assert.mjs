import fs from "node:fs";
import assert from "node:assert/strict";
import {dir} from "./browser.mjs";
const names=["00-baseline","01-container","02-entry","03-entry-confirmed","04-transfer","05-reception","06-partial-blocked","07-transfer-cancel-before","08-cancelled","09-multiunit-transit","10-multiunit-received"];
const results=[];
for(const name of names){
 const s=JSON.parse(fs.readFileSync(dir+"/"+name+".json","utf8"));
 assert.equal(s.balances.length,12);
 for(const b of s.balances){assert.equal(Number(b.roll_qty),Number(b.cache_qty));assert.equal(Number(b.cache_qty),Number(b.ledger_qty));}
 assert.equal(Number(s.customerDebt[0].sum),1200);
 const transit={};
 for(const unit of ["METRO","KILO","PIEZA","BOLSA"]){
  const product=s.balances.find(b=>b.unit===unit).product;
  const ledger=s.movements.filter(m=>m.producto_id===product&&m.ubicacion_id===8).reduce((a,m)=>a+Number(m.cantidad),0);
  const rolls=s.rolls.filter(r=>r.producto_id===product&&r.ubicacion_id===8&&r.estado==="EN_TRANSITO").reduce((a,r)=>a+Number(r.cantidad_actual),0);
  assert.equal(rolls,ledger);transit[unit]={rolls,ledger};
 }
 results.push({snapshot:name,siteProductUnitRows:12,physicalCacheLedger:"PASS",customer8Debt1200:"PASS",transit});
}
const final=JSON.parse(fs.readFileSync(dir+"/10-multiunit-received.json","utf8"));
const audit=JSON.parse(fs.readFileSync(dir+"/final-audit.json","utf8"));
for(const cache of audit.caches){
 const rolls=final.rolls.filter(r=>r.ubicacion_id===cache.ubicacion_id&&r.producto_id===cache.producto_id&&r.estado==="DISPONIBLE");
 assert.equal(rolls.length,cache.rollos_count);
 assert.equal(rolls.reduce((a,r)=>a+Number(r.cantidad_actual),0),Number(cache.cantidad_total));
}
assert.equal(audit.partialEnabledCount[0].count,"0");
assert.equal(final.rolls.find(r=>r.id===6329).ubicacion_id,837);
assert.equal(final.rolls.find(r=>r.id===6330).ubicacion_id,836);
fs.writeFileSync(dir+"/assertions.json",JSON.stringify({results,finalCacheCounts:"PASS",enabledPartialProducts:0},null,2));console.log("PASS: 132 physical quantity comparisons; transit roll/ledger by unit; final cache counts; unchanged customer8 debt.");