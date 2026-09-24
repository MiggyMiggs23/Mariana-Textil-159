// Production producers on an owned PostgreSQL copy, never an application server.
// All imported business code is MAIN's frozen source. No SQL business writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {db,pool} from "../../../.local/tanda-g-ampliada/frozen-source/lib/db/src/index";
import {crearEntrada,transferirRolloInmediato} from "../../../.local/tanda-g-ampliada/frozen-source/artifacts/api-server/src/lib/inventario";
import {crearTicket,cobrarTicket,autorizarNota,cancelarTicket,abrirSesionCaja,cerrarSesionCaja,buildCorteCaja} from "../../../.local/tanda-g-ampliada/frozen-source/artifacts/api-server/src/lib/pos";
import {createE4CashOut} from "../../../.local/tanda-g-ampliada/frozen-source/artifacts/api-server/src/lib/e4-cash-out";
import {e4CashOutRepository} from "../../../.local/tanda-g-ampliada/frozen-source/artifacts/api-server/src/lib/e4-cash-out-repository";
import clientesRouter from "../../../.local/tanda-g-ampliada/frozen-source/artifacts/api-server/src/routes/clientes";

const out="reports/tanda-g-ampliada/tarea-3", setup="reports/tanda-g-ampliada/setup";
const report:any={status:"RUNNING",method:"Frozen production producers and final customer route handler with real PostgreSQL; not HTTP/auth-middleware coverage.",clock:"Externally controlled isolated process clock, never date-column rewrites or gate deletion.",assumptions:"Synthetic modest workload, not observed or claimed business volume. Daily: entry at all seven sites in all four units, four warehouse-to-store transfers, each store four cash and four credit lines, payment, advance, E4, unpaid-ticket cancellation, close.",days:[]};
const q=async(text:string,values:any[]=[]) => (await pool.query(text,values)).rows;
const save=()=>fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));
const progress=(s:string)=>fs.appendFileSync(`${out}/progress.txt`,`${new Date().toISOString()} ${s}\n`);
let f:any, day=0, stepNo=0;
const txrun=(fn:any)=>db.transaction(fn);
const ids=()=>f.products.map((p:any)=>p.id);
const sites=()=>f.sites.map((s:any)=>s.id);
async function identity(){
  const [r]=await q("select current_database() db,current_setting('data_directory') dir,inet_server_port() port,(now() at time zone 'America/Mexico_City')::date::text day");
  assert.equal(r.db,"tanda_ga_month");
  assert.equal(r.dir,process.env.MONTH_DATA_DIRECTORY,"Dedicated clock-controlled data directory must match MAIN handoff");
  assert.equal(r.port,Number(process.env.MONTH_PG_PORT));
  assert.ok(r.dir.includes("/.local/tanda-g-ampliada/"));
  return r;
}
async function snapshot(){
  const latest=await q("select distinct on (ubicacion_id) id,ubicacion_id from sesiones_caja where ubicacion_id=any($1) order by ubicacion_id,id desc",[sites()]);
  const cuts=await Promise.all(latest.map(async(s:any)=>({site:s.ubicacion_id,session:s.id,cut:await buildCorteCaja(db,s.id)})));
  return {
    cuts,
    inventory:await q(`select p.unidad,p.id producto_id,u.id ubicacion_id,
      coalesce((select sum(r.cantidad_actual) from rollos r where r.producto_id=p.id and r.ubicacion_id=u.id and r.estado in ('DISPONIBLE','MOSTRADOR')),0)::text physical,
      coalesce((select e.cantidad_total from existencias e where e.producto_id=p.id and e.ubicacion_id=u.id),0)::text cache,
      coalesce((select sum(m.cantidad) from movimientos m where m.producto_id=p.id and m.ubicacion_id=u.id),0)::text ledger
      from productos p cross join ubicaciones u where p.id=any($1) and u.id=any($2) order by u.id,p.id`,[ids(),sites()]),
    rolls:await q("select id,producto_id,ubicacion_id,estado,cantidad_actual::text from rollos where producto_id=any($1) order by id",[ids()]),
    debt:await q("select coalesce(sum(importe),0)::text balance,count(*)::int count from movimientos_credito where cliente_id=$1",[f.customer.id]),
    credit:await q("select id,tipo,importe::text,forma_pago,sesion_caja_id from movimientos_credito where cliente_id=$1 order by id",[f.customer.id]),
    sessions:await q("select id,ubicacion_id,fecha_operativa::text,estado,fondo_inicial::text from sesiones_caja where ubicacion_id=any($1) order by id",[sites()]),
    cash:await q(`select s.id,
      coalesce((select sum(p.importe) from ticket_pagos p join tickets t on t.id=p.ticket_id where t.sesion_caja_id=s.id),0)::text payments,
      coalesce((select sum(d.monto) from salidas_dinero_caja d where d.sesion_caja_id=s.id),0)::text withdrawals
      from sesiones_caja s where s.ubicacion_id=any($1) order by s.id`,[sites()]),
  };
}
type Delta={site:number,product:number,quantity:number};
async function step(name:string,deltas:Delta[],debtDelta:number,fn:()=>Promise<any>,cashDelta:{site:number,amount:number}|null=null){
  const entry:any={day,step:++stepNo,name,expected:{inventoryDeltas:deltas,debtDelta,cashDelta:cashDelta??"zero at every existing session"},before:await snapshot()};
  fs.writeFileSync(`${out}/pending-step.json`,JSON.stringify(entry,null,2));
  try{
    entry.result=await fn();entry.after=await snapshot();
    for(const before of entry.before.inventory){
      const after=entry.after.inventory.find((r:any)=>r.producto_id===before.producto_id&&r.ubicacion_id===before.ubicacion_id);
      const delta=deltas.filter(d=>d.product===before.producto_id&&d.site===before.ubicacion_id).reduce((n,d)=>n+d.quantity,0);
      for(const key of ["physical","cache","ledger"])assert.equal(Number(after[key]),Number(before[key])+delta,`${name} ${key} ${before.unidad} ${before.ubicacion_id}`);
      assert.equal(after.physical,after.cache);assert.equal(after.cache,after.ledger);
    }
    assert.equal(Number(entry.after.debt[0].balance),Number(entry.before.debt[0].balance)+debtDelta,`${name}: customer balance`);
    for(const before of entry.before.cuts){
      const after=entry.after.cuts.find((r:any)=>r.session===before.session);
      if(!after)continue; // a newly opened daily session replaces the previous cut
      const delta=cashDelta?.site===before.site?cashDelta.amount:0;
      assert.equal(Number(after.cut.efectivoEsperado),Number(before.cut.efectivoEsperado)+delta,`${name}: expected cash delta at ${before.site}`);
    }
    for(const after of entry.after.cuts){
      if(!entry.before.cuts.some((r:any)=>r.session===after.session))assert.equal(Number(after.cut.efectivoEsperado),5000,`${name}: new session opening fund`);
    }
    entry.status="PASS";return entry.result;
  }catch(e:any){entry.status="FAILED";entry.error={message:e.message,code:e.code};entry.after??=await snapshot();throw e;}
  finally{fs.appendFileSync(`${out}/journal.jsonl`,JSON.stringify(entry)+"\n");fs.unlinkSync(`${out}/pending-step.json`);}
}
const actor=(site:any)=>Object.values(f.actors).find((a:any)=>a.role==="CAJA"&&a.siteId===site.id) as any;
const auth=(a:any)=>({user:{id:a.id,rol:a.role,ubicacionId:a.siteId}});
async function payment(a:any,session:number,amount:number){
  const route=(clientesRouter as any).stack.find((l:any)=>l.route?.path==="/clientes/:id/pagos"&&l.route.methods.post).route;
  let status=200,value:any,error:any;
  const res:any={status(n:number){status=n;return res;},json(v:any){value=v;return res;}};
  await route.stack.at(-1).handle({params:{id:String(f.customer.id)},body:{importe:amount,formaPago:"EFECTIVO",cuentaDestino:"CAJA_FISICA",sitioOrigenId:a.siteId,sesionCajaId:session,naturaleza:"INGRESO_FISICO",operacionClave:randomUUID(),notas:"TANDA GA monthly workload"},auth:auth(a),ip:"127.0.0.1"},res,(e:any)=>{error=e});
  if(error)throw error;if(status>=400)throw Error(`Payment ${status}: ${JSON.stringify(value)}`);return value;
}
async function selectRoll(site:number,product:number){
  const [r]=await q("select id,cantidad_actual::text quantity from rollos where ubicacion_id=$1 and producto_id=$2 and estado='DISPONIBLE' and cantidad_actual=10 order by id limit 1",[site,product]);
  assert.ok(r,`No native 10-unit roll at site ${site}, product ${product}`);return r;
}
try{
  // Fail closed BEFORE writes, including before reading any inherited connection.
  assert.equal(process.env.NODE_ENV,"test");assert.equal(process.env.REQUIRE_ISOLATED_TEST_DATABASE,"1");
  const target=new URL(process.env.TEST_DATABASE_URL!);
  assert.equal(target.hostname,"127.0.0.1");assert.equal(target.pathname,"/tanda_ga_month");
  assert.equal(target.port,process.env.MONTH_PG_PORT);
  assert.equal(process.env.MONTH_CLOCK_EXCLUSIVE,"MAIN_CONFIRMED_NO_OTHER_WORKER_DATABASES");
  assert.ok(process.env.MONTH_CLOCK_CONTROLLER?.startsWith(process.cwd()+"/.local/tanda-g-ampliada/"));
  assert.ok(fs.existsSync(`${setup}/template-identity.json`),"MAIN cluster readiness pending");
  assert.ok(!fs.existsSync(`${out}/journal.jsonl`),"Fresh disposable copy and empty journal required; never blindly replay");
  f=JSON.parse(fs.readFileSync(`${setup}/fixture-manifest-redacted.json`,"utf8"));
  assert.equal(f.sites.length,7);assert.deepEqual(f.products.map((p:any)=>p.unidad).sort(),["BOLSA","KILO","METRO","PIEZA"]);
  report.initialIdentity=await identity();report.initial=await snapshot();save();
  const initialDate=report.initialIdentity.day;
  for(day=1;day<=30;day++){
    const date=new Date(`${initialDate}T18:00:00.000Z`);date.setUTCDate(date.getUTCDate()+day-1);
    const expectedDate=date.toISOString().slice(0,10);
    // Controller is supplied/owned by MAIN; it may advance only this dedicated
    // cluster and harness clock. It must not mutate database rows or SQL functions.
    execFileSync(process.env.MONTH_CLOCK_CONTROLLER!,[date.toISOString()],{timeout:30000,stdio:"pipe"});
    assert.equal((await identity()).day,expectedDate,"PostgreSQL clock did not advance");
    assert.equal(new Date().toISOString().slice(0,10),expectedDate,"Harness clock must match PostgreSQL");
    progress(`Day ${day}/30 ${expectedDate} starting`);save();
    for(const site of f.sites){
      await step(`entry:${site.id}`,f.products.map((p:any)=>({site:site.id,product:p.id,quantity:40})),0,()=>txrun(tx=>crearEntrada(tx,{ubicacionId:site.id,proveedorId:f.supplier.id,usuarioId:f.actors.admin.id,uuidCliente:randomUUID(),ip:"127.0.0.1",lineas:f.products.map((p:any)=>({productoId:p.id,costoUnitario:"100",cantidades:["10","10","10","10"]}))})));
    }
    for(let w=0;w<4;w++){
      const from=f.sites[w+3],to=f.sites[w%3],p=f.products[(day+w-1)%4],r=await selectRoll(from.id,p.id);
      await step(`transfer:${from.id}:${to.id}`,[{site:from.id,product:p.id,quantity:-10},{site:to.id,product:p.id,quantity:10}],0,()=>txrun(tx=>transferirRolloInmediato(tx,{rolloId:r.id,ubicacionOrigenId:from.id,ubicacionDestinoId:to.id,usuarioId:f.actors.admin.id,documentoTipo:"TRANSFERENCIA",documentoId:randomUUID(),uuidCliente:randomUUID(),justificacion:"TANDA GA monthly workload"})));
    }
    for(const site of f.sites.slice(0,3)){
      const a=actor(site);assert.ok(a);
      let [s]=await q("select id from sesiones_caja where ubicacion_id=$1 and estado='ABIERTA'",[site.id]);
      if(!s)s=await step(`open:${site.id}`,[],0,()=>txrun(tx=>abrirSesionCaja(tx,{ubicacionId:site.id,usuarioId:a.id,fondoInicial:"5000",ip:"127.0.0.1"})));
      const session=s.id;
      for(const credit of [false,true]){
        const lineas=[];
        for(const p of f.products){const r=await selectRoll(site.id,p.id);lineas.push({rolloId:r.id,productoId:p.id,tipo:"NORMAL" as const,cantidad:"10",precioUnitario:"150"});}
        // Charge each native unit independently and settle before the next,
        // keeping exposure under the unchanged fixture credit limit of 5000.
        for(const line of lineas){
          const ticket=await step(`ticket:${site.id}:${credit?"credit":"cash"}:${line.productoId}`,[{site:site.id,product:line.productoId,quantity:-10}],0,()=>txrun(tx=>crearTicket(tx,{ubicacionId:site.id,usuarioTerminalId:a.id,clienteId:f.customer.id,documentoTipo:credit?"NOTA":"TICKET",credito:credit,diasPlazo:credit?30:undefined,facturado:false,uuidCliente:randomUUID(),lineas:[line],ip:"127.0.0.1"},false)));
          if(credit){
            await step(`authorize:${ticket.id}`,[],1500,()=>txrun(tx=>autorizarNota(tx,{ticketId:ticket.id,sesionCajaId:session,usuarioId:a.id,ip:"127.0.0.1",creditRequest:{auth:auth(a)} as any,creditEvidence:{sitioOrigenId:site.id,sesionCajaId:session,naturaleza:"OPERACION_CREDITO_SIN_DINERO",operacionClave:randomUUID()}},false)));
            const [balance]=await q("select coalesce(sum(importe),0)::text amount from movimientos_credito where cliente_id=$1",[f.customer.id]);
            const paymentAmount=Math.max(0,Math.min(1500,Number(balance.amount)));
            if(paymentAmount)await step(`abono:${ticket.id}`,[],-paymentAmount,()=>payment(a,session,paymentAmount),{site:site.id,amount:paymentAmount});
          }else await step(`charge:${ticket.id}`,[],0,()=>txrun(tx=>cobrarTicket(tx,{ticketId:ticket.id,sesionCajaId:session,usuarioId:a.id,pagos:[{formaPago:"EFECTIVO",importe:"1500"}],ip:"127.0.0.1"},false)),{site:site.id,amount:1500});
        }
      }
      await step(`advance:${site.id}`,[],-100,()=>payment(a,session,100),{site:site.id,amount:100});
      const p=f.products[0],r=await selectRoll(site.id,p.id);
      const cancel=await step(`cancel-draft:${site.id}`,[{site:site.id,product:p.id,quantity:-10}],0,()=>txrun(tx=>crearTicket(tx,{ubicacionId:site.id,usuarioTerminalId:a.id,clienteId:f.customer.id,facturado:false,uuidCliente:randomUUID(),lineas:[{rolloId:r.id,productoId:p.id,tipo:"NORMAL",cantidad:"10",precioUnitario:"150"}],ip:"127.0.0.1"},false)));
      await step(`cancel:${cancel.id}`,[{site:site.id,product:p.id,quantity:10}],0,()=>txrun(tx=>cancelarTicket(tx,{ticketId:cancel.id,usuarioId:a.id,autorizadoPor:f.actors.admin.id,motivo:"TANDA GA unpaid cancellation",ip:"127.0.0.1"},false)));
      await step(`E4:${site.id}`,[],0,()=>txrun(tx=>createE4CashOut(e4CashOutRepository(tx),{id:a.id,rol:"CAJA",ubicacionId:site.id},{claveOperacion:randomUUID(),sesionCajaId:session,monto:"100",motivo:"TANDA GA monthly cash withdrawal",tipo:"EXTRAORDINARIA",cuentaOrigen:"CAJA_FISICA",ip:"127.0.0.1"})),{site:site.id,amount:-100});
      const cut=await buildCorteCaja(db,session);
      await step(`close:${site.id}`,[],0,()=>txrun(tx=>cerrarSesionCaja(tx,{sesionId:session,usuarioId:a.id,efectivoContado:cut.efectivoEsperado,ip:"127.0.0.1"})));
      const closed=await buildCorteCaja(db,session);
      assert.equal(Number(closed.diferencia),0);
      fs.appendFileSync(`${out}/cuts.jsonl`,JSON.stringify({day,site:site.id,session,before:cut,after:closed})+"\n");
      // Explicit negative proves the per-site per-calendar-day invariant remains.
      await assert.rejects(txrun(tx=>abrirSesionCaja(tx,{ubicacionId:site.id,usuarioId:a.id,fondoInicial:"5000",ip:"127.0.0.1"})),(e:any)=>e.code==="SESSION_ALREADY_EXISTS_TODAY");
    }
    report.days.push({day,date:expectedDate,steps:stepNo,status:"PASS"});save();progress(`Day ${day}/30 complete`);
  }
  report.final=await snapshot();report.status="PASS";report.completedDays=30;
}catch(e:any){report.status="BLOCKED_OR_FAILED";report.error={message:e.message,code:e.code};report.completedDays=report.days.length;process.exitCode=1;progress(`BLOCKED day ${day}: ${e.message}`);}
finally{save();await pool.end();}