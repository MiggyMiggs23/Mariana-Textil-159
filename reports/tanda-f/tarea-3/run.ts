// Real frozen producers, real PostgreSQL. No HTTP server or mocked repository.
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { db, pool } from "../../../.local/tanda-f/source/lib/db/src/index";
import { sql } from "../../../.local/tanda-f/source/artifacts/api-server/node_modules/drizzle-orm";
import { crearTicket, cobrarTicket } from "../../../.local/tanda-f/source/artifacts/api-server/src/lib/pos";
import { createE4CashOut } from "../../../.local/tanda-f/source/artifacts/api-server/src/lib/e4-cash-out";
import { e4CashOutRepository } from "../../../.local/tanda-f/source/artifacts/api-server/src/lib/e4-cash-out-repository";
import clientesRouter from "../../../.local/tanda-f/source/artifacts/api-server/src/routes/clientes";

const out = "reports/tanda-f/tarea-3";
const followup=["1","2"].includes(process.env.TANDA_F_ABONO_ONLY ?? "");
const onlyRetry=process.env.TANDA_F_ABONO_ONLY==="2";
const report: any = followup ? JSON.parse(fs.readFileSync(`${out}/results.json`,"utf8")) : { started: new Date().toISOString(), methodology: "Frozen real producers + real PostgreSQL; customer payments invoke the unmodified production route handler with real auth actor IDs (not HTTP/middleware coverage). PostgreSQL-held deterministic blockers, polling pg_stat_activity, 20s barrier deadline, 30s lock timeout, 45s statement timeout.", cases: [] };
const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
const progress = (s: string) => fs.appendFileSync(`${out}/progress.txt`, `${new Date().toISOString()} ${s}\n`);
const q = async (text: string, values: any[] = []) => (await pool.query(text, values)).rows;
async function identity() {
  const [r] = await q("select current_database() db,current_setting('data_directory') dir,inet_server_port() port,pg_postmaster_start_time() started");
  assert.equal(r.db, "tanda_f_concurrency");
  assert.equal(r.port, 55440);
  assert.equal(r.dir, `${process.cwd()}/.local/tanda-f/cluster`);
  const pid = fs.readFileSync(".local/tanda-f/cluster/postmaster.pid", "utf8").split("\n")[0];
  const cmd = execFileSync("ps", ["-p", pid, "-o", "args="], { encoding: "utf8" });
  assert.match(cmd, /postgres.*-D .*\.local\/tanda-f\/cluster.*-p 55440/);
  return { ...r, pid, command: cmd.trim() };
}
async function snapshot() {
  return {
    cash: await q("select s.id,s.fondo_inicial,coalesce((select sum(p.importe) from ticket_pagos p join tickets t on t.id=p.ticket_id where t.sesion_caja_id=s.id),0)::text payments,coalesce((select sum(d.monto) from salidas_dinero_caja d where d.sesion_caja_id=s.id),0)::text withdrawals from sesiones_caja s where s.id=46"),
    payments: await q("select p.id,p.ticket_id,p.importe,t.sesion_caja_id from ticket_pagos p join tickets t on t.id=p.ticket_id where t.ubicacion_id=836 order by p.id"),
    credit: await q("select id,tipo,importe,forma_pago,sesion_caja_id from movimientos_credito where cliente_id=8 order by id"),
    inventory: await q("select p.id,p.unidad,e.cantidad_total::text cache,(select coalesce(sum(r.cantidad_actual),0)::text from rollos r where r.producto_id=p.id and r.ubicacion_id=836 and r.estado in ('DISPONIBLE','MOSTRADOR')) rolls,(select coalesce(sum(m.cantidad),0)::text from movimientos m where m.producto_id=p.id and m.ubicacion_id=836) ledger from productos p join existencias e on e.producto_id=p.id and e.ubicacion_id=836 where p.id between 2078 and 2081 order by p.id"),
    rolls: await q("select id,estado,cantidad_actual from rollos where id between 6233 and 6240 order by id"),
  };
}
const txrun = (fn: any) => db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL lock_timeout='30s'`);
  await tx.execute(sql`SET LOCAL statement_timeout='45s'`);
  return fn(tx);
});
async function race(name: string, lock: string, jobs: (() => Promise<any>)[], check: any) {
  progress(`START ${name}`); await identity();
  const c: any = { name, before: await snapshot() }; report.cases.push(c); save();
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(lock);
    const promises = jobs.map(async fn => {
      try { const value = await fn(); return { ok: true, id: value?.id, status: value?.status, value }; }
      catch (e: any) { return { ok: false, code: e.code, message: e.message, causes: Array.from((function*(){let v=e.cause;for(let i=0;v&&i<5;i++,v=v.cause)yield {code:v.code,message:v.message,detail:v.detail};})()) }; }
    });
    const deadline = Date.now() + 20000;
    for (;;) {
      const waits = await q("select pid,wait_event_type,wait_event,left(query,240) query,pg_blocking_pids(pid) blockers from pg_stat_activity where datname=current_database() and wait_event_type='Lock'");
      c.lastObservedWaits=waits;
      if (waits.length >= 2) { c.barrier = waits; break; }
      if (Date.now() > deadline) { c.barrierError = "Two blocked concurrent backends not observed within 20 seconds"; break; }
      await new Promise(r => setTimeout(r, 30));
    }
    await blocker.query("COMMIT");
    c.results = await Promise.all(promises);
    c.after = await snapshot();
    assert.ok(c.barrier, c.barrierError);
    check(c);
    c.result = "PASS";
  } catch (e: any) { c.result = "FAIL_OR_BLOCKED"; c.error = e.message; await blocker.query("ROLLBACK").catch(() => {}); }
  finally { blocker.release(); save(); progress(`END ${name} ${c.result}`); }
}
const ticket = (roll: number, actor = 235, customer = 8) => txrun(tx => crearTicket(tx, {
  ubicacionId: 836, usuarioTerminalId: actor, clienteId: customer, facturado: false,
  uuidCliente: randomUUID(), lineas: [{ rolloId: roll, productoId: 2078, tipo: "NORMAL", cantidad: "10", precioUnitario: "150" }], ip: "127.0.0.1",
}, false));
const charge = (id: number, actor: number) => txrun(tx => cobrarTicket(tx, {
  ticketId: id, sesionCajaId: 46, usuarioId: actor, pagos: [{ formaPago: "EFECTIVO", importe: "1500" }], ip: "127.0.0.1",
}, false));
function count(c: any, success: number) { assert.equal(c.results.filter((r: any) => r.ok).length, success); }
try {
  report.identity = await identity(); save(); progress("Verified private PostgreSQL PID, data directory, port, database; starting fixtures.");
  // Natural role, synthetic actor site assignment only in owned disposable DB.
  await q("update usuarios set ubicacion_id=836 where id=241 and rol='CAJA' and usuario='tandaf-caja2'");
  let [customer2] = await q("select id from clientes where nombre='TANDA F CONCURRENCY SECOND CUSTOMER' and activo");
  if (!customer2) [customer2] = await q("insert into clientes(nombre,activo,limite_credito,dias_credito) values('TANDA F CONCURRENCY SECOND CUSTOMER',true,5000,30) returning id");
  report.fixtures = { secondCashier: 241, site: 836, secondCustomer: customer2.id };
  if (!followup) {
  report.initial = await snapshot(); save();
  const a = await ticket(6233), b = await ticket(6234);
  await race("two_cashiers_distinct_tickets_same_session", "select id from sesiones_caja where id=46 for update", [() => charge(a.id, 236), () => charge(b.id, 241)], c => {
    count(c, 2);
    assert.equal(c.after.payments.length - c.before.payments.length, 2);
    assert.equal(Number(c.after.cash[0].payments) - Number(c.before.cash[0].payments), 3000);
  });
  const duplicate = await ticket(6235);
  await race("two_cashiers_same_ticket_negative", `select id from tickets where id=${duplicate.id} for update`, [() => charge(duplicate.id,236), () => charge(duplicate.id,241)], c => {
    count(c,1); assert.equal(c.results.find((r: any) => !r.ok).code,"ALREADY_CHARGED");
    assert.equal(c.after.payments.length-c.before.payments.length,1);
    assert.equal(Number(c.after.cash[0].payments)-Number(c.before.cash[0].payments),1500);
  });
  await race("two_users_same_roll_inventory_pair", "select pg_advisory_xact_lock(hashtextextended('2078:836',650001))", [() => ticket(6236,235), () => ticket(6236,241,customer2.id)], c => {
    count(c,1);
    for(const field of ["cache","rolls","ledger"]) assert.equal(Number(c.before.inventory[0][field])-Number(c.after.inventory[0][field]),10);
    assert.equal(c.after.rolls.find((r: any) => r.id===6236).estado,"VENDIDO");
  });
  }
  const route = (clientesRouter as any).stack.find((l: any) => l.route?.path === "/clientes/:id/pagos" && l.route.methods.post).route;
  const handler = route.stack.at(-1).handle;
  async function abono(actor: number, key=randomUUID()) {
    let status = 200, result: any;
    const req = { params: {id:"8"}, body: { importe:100,formaPago:"EFECTIVO",cuentaDestino:"CAJA_FISICA",sitioOrigenId:836,sesionCajaId:46,naturaleza:"INGRESO_FISICO",operacionClave:key,notas:"TANDA F concurrent real abono" }, auth: {user:{id:actor,rol:"CAJA",ubicacionId:836}}, ip:"127.0.0.1" };
    const res: any = { status(n: number){status=n;return res},json(v:any){result=v;return res} };
    let error: any; await handler(req,res,(e:any)=>{error=e}); if(error)throw error;
    if(status>=400) throw Object.assign(new Error(result?.error ?? "abono rejected"),{code:status});
    return {status,id:result?.id};
  }
  if (!onlyRetry) await race(followup ? "two_client_abonos_claim_table_barrier" : "two_client_abonos", followup ? "LOCK TABLE operaciones_credito_e1 IN SHARE MODE" : "select pg_advisory_xact_lock(650006,8)", [()=>abono(236),()=>abono(241)], c=>{
    count(c,2); assert.equal(c.after.credit.length-c.before.credit.length,2);
    const delta=c.after.credit.slice(c.before.credit.length); assert.equal(delta.reduce((s:any,r:any)=>s+Number(r.importe),0),-200);
  });
  if(onlyRetry) {
    await identity();
    const c=report.cases.at(-1);
    const loserIndex=c.results.findIndex((r:any)=>r.causes?.some((e:any)=>e.code==="40001"));
    assert.ok(loserIndex>=0);
    const key=c.results[loserIndex].message.match(/params: ABONO_ORDINARIO,([a-f0-9-]{36}),/)[1];
    report.abonoManualRetry={note:"Explicit diagnostic retry, same actor and exact operation UUID/intent; not an application automatic retry.",before:await snapshot(),claimsBefore:await q("select clave from operaciones_credito_e1 where clave=$1",[key])};
    assert.equal(report.abonoManualRetry.claimsBefore.length,0);
    report.abonoManualRetry.response=await abono([236,241][loserIndex],key);
    report.abonoManualRetry.after=await snapshot();
    assert.equal(report.abonoManualRetry.after.credit.length-report.abonoManualRetry.before.credit.length,1);
    report.abonoManualRetry.replay=await abono([236,241][loserIndex],key);
    report.abonoManualRetry.afterReplay=await snapshot();
    assert.equal(report.abonoManualRetry.afterReplay.credit.length,report.abonoManualRetry.after.credit.length);
    report.abonoManualRetry.result="PASS: rollback atomic, explicit retry succeeds, exact replay does not duplicate";
    progress("Abono 40001 atomic rollback and exact UUID retry/replay verified.");
  }
  if (!followup) {
  const repoBalance = await txrun(async tx => { const repo=e4CashOutRepository(tx);return repo.cashBalance((await repo.session(46))!); });
  const amount = (Number(repoBalance)*0.7).toFixed(2);
  report.e4 = { cashBefore:repoBalance,eachWithdrawal:amount,combined:(Number(amount)*2).toFixed(2) };
  const withdraw=(actor:number)=>txrun(tx=>createE4CashOut(e4CashOutRepository(tx),{id:actor,rol:"CAJA",ubicacionId:836},{claveOperacion:randomUUID(),sesionCajaId:46,monto:amount,motivo:"TANDA F concurrent insufficient combined cash",tipo:"EXTRAORDINARIA",cuentaOrigen:"CAJA_FISICA",ip:"127.0.0.1"}));
  await race("two_e4_withdrawals_insufficient_combined_cash","select id from sesiones_caja where id=46 for update",[()=>withdraw(236),()=>withdraw(241)],c=>{
    count(c,1);assert.equal(c.results.find((r:any)=>!r.ok).code,"E4_CAJA_INSUFICIENTE");
    assert.equal(Number(c.after.cash[0].withdrawals)-Number(c.before.cash[0].withdrawals),Number(amount));
  });
  }
  report.final=await snapshot();
  report.finalCash=await txrun(async tx=>{const repo=e4CashOutRepository(tx);return repo.cashBalance((await repo.session(46))!);});
} catch(e:any) { report.fatal={message:e.message,stack:e.stack};progress(`FATAL ${e.message}`); }
finally { report.finished=new Date().toISOString();save();await pool.end(); }