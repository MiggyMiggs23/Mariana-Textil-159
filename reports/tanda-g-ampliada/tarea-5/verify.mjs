import fs from "node:fs";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const root="/home/runner/workspace",r=root+"/.local/tanda-g-ampliada",out=root+"/reports/tanda-g-ampliada/tarea-5";
const cfg=JSON.parse(fs.readFileSync(r+"/worker-databases.json","utf8")).failure;
const pg=createRequire(root+"/scripts/package.json")("pg");
const c=new pg.Client({connectionString:cfg.url});await c.connect();
try{
 const identity=(await c.query("select current_database() db,current_user role,inet_server_port() port")).rows[0];
 assert.deepEqual(identity,{db:"tanda_ga_failure",role:"ga_failure",port:55442});
 const m=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json","utf8"));
 const result={identity,at:new Date().toISOString(),checks:{}};
 result.checks.soldRolls=(await c.query(`select count(*)::int sold,count(*) filter(where not exists(select 1 from ticket_lineas l join tickets t on t.id=l.ticket_id where l.rollo_id=r.id and t.estado='VENDIDO'))::int without_ticket from rollos r where r.id=any($1) and r.estado='VENDIDO'`,[m.rolls.map(x=>x.id)])).rows[0];
 result.checks.cashAbonos=(await c.query(`select count(*)::int movements,count(*) filter(where not exists(select 1 from recibos_abono_e3 r where r.movimiento_id=m.id))::int without_receipt from movimientos_credito m where m.cliente_id=$1 and m.tipo='ABONO' and m.operacion_productor='ABONO_ORDINARIO'`,[m.customer.id])).rows[0];
 const closed=(await c.query(`select s.id,s.estado,a.datos_despues->'cashSnapshot' snapshot from sesiones_caja s left join auditoria a on a.entidad='sesiones_caja' and a.entidad_id=s.id::text and a.accion='CERRAR_CAJA' where s.id=$1`,[m.sessions[0].id])).rows;
 result.checks.closedCash=closed.map(x=>({id:x.id,estado:x.estado,snapshotPresent:!!x.snapshot,documents:x.snapshot?.efectivoDesglose?.documentos?.map(d=>({origen:d.origen,id:d.id,importe:d.importe})),expected:x.snapshot?.efectivoDesglose?.efectivoEsperado}));
 assert.ok(result.checks.soldRolls.sold>0);assert.equal(result.checks.soldRolls.without_ticket,0);
 assert.ok(result.checks.cashAbonos.movements>0);assert.equal(result.checks.cashAbonos.without_receipt,0);
 assert.equal(closed.length,1);assert.equal(closed[0].estado,"CERRADA");assert.ok(closed[0].snapshot);
 assert.ok(result.checks.closedCash[0].documents.length>=2);
 result.status="PASS";fs.writeFileSync(out+"/invariants.json",JSON.stringify(result,null,2));
}finally{await c.end();}