import fs from "node:fs";
import assert from "node:assert/strict";
const dir=new URL("./",import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name+".json",dir),"utf8"));
const sum=xs=>xs.reduce((a,b)=>a+Number(b),0);
const ledger=x=>sum(x.movimientos_credito.map(m=>m.importe));
const before=read("before-limit"),limit=read("after-limit"),partial=read("after-partial"),settled=read("after-all-settled"),advance=read("after-advance"),final=read("final-state");
for(const x of [before,limit,partial,settled,advance,final])assert.equal(x.identity.readonly,"on");
assert.equal(ledger(before),4500);assert.equal(ledger(limit),4500);
assert.equal(limit.tickets.filter(t=>t.autorizacion_estado==="PENDIENTE").length,1);
assert.equal(limit.movimientos_credito.filter(m=>m.tipo==="VENTA_CREDITO").length,3);
assert.equal(ledger(partial),4000);assert.equal(ledger(settled),0);assert.equal(ledger(advance),-300);assert.equal(ledger(final),1200);
const sales=final.movimientos_credito.filter(m=>m.tipo==="VENTA_CREDITO").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)||a.id-b.id);
assert.deepEqual(sales.map(m=>m.sitio_origen_id),[836,837,838,838]);
const payments=final.movimientos_credito.filter(m=>m.tipo==="ABONO");
assert.equal(payments.length,5);assert.equal(sum(payments.map(m=>-Number(m.importe))),4800);
const expected=[[500],[1000],[1500,500],[1000],[300]];
const expectedSales=[[55],[55],[56,57],[57],[63]];
for(const [i,p] of payments.entries()){
 const allocations=final.applications.filter(a=>a.abono_movimiento_id===p.id).sort((a,b)=>a.id-b.id);
 assert.deepEqual(allocations.map(a=>Number(a.importe)),expected[i]);
 assert.deepEqual(allocations.map(a=>a.venta_movimiento_id),expectedSales[i]);
 assert.equal(p.ticket_id,null);
}
assert.equal(advance.applications.filter(a=>a.abono_movimiento_id===payments[4].id).length,0);
assert.equal(final.recibos_abono_e3.length,5);
const result={pass:true,mutations:"Actual browser UI only; assertion source SQL sessions read-only",oldestOrder:sales.slice(0,3).map(m=>({movementId:m.id,siteId:m.sitio_origen_id,at:m.created_at})),initialAuthorizedDebt:4500,blockedAuthorizationProjectedDebt:6000,hardLimit:5000,afterPartial:4000,afterFirstThreeSettled:0,advanceWithoutDirectedNote:300,afterAdvanceNetLedger:-300,favorAppliedToFourthNote:300,finalDebt:1200,totalAuthorizedCredit:6000,totalPhysicalPayments:4800,receiptCount:5,negativeApiLimitAttempt:"NOT RUN: natural UI disables authorization; no disabled-control bypass",allAssertionsPassed:true};
fs.writeFileSync(new URL("assertions.json",dir),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));