import fs from "node:fs";
import pg from "../../scripts/node_modules/pg/lib/index.js";
const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy",options:"-c default_transaction_read_only=on"});
try {
 await c.connect();
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const q=async(s,p=[]) => (await c.query(s,p)).rows;
 const identity=(await q("select current_database() database,current_setting('transaction_read_only') readonly"))[0];
 if(identity.database!=="tanda_e_continuacion_copy"||identity.readonly!=="on")throw Error("Identity guard");
 const tickets=await q("SELECT id,folio,documento_tipo,total,estado,cobrado,cobrado_at,credito,sesion_caja_id,created_at FROM tickets WHERE ubicacion_id=835 ORDER BY id");
 const payments=await q("SELECT p.id,p.ticket_id,p.forma_pago,p.importe,p.created_at FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id WHERE t.ubicacion_id=835 ORDER BY p.id");
 const sessions=await q("SELECT id,estado,fondo_inicial,efectivo_contado,abierta_at,cerrada_at,fecha_operativa FROM sesiones_caja WHERE ubicacion_id=835 ORDER BY id");
 const credit=await q("SELECT m.id,m.tipo,m.importe,m.sesion_caja_id FROM movimientos_credito m JOIN sesiones_caja s ON s.id=m.sesion_caja_id WHERE s.ubicacion_id=835");
 const retained=await q("SELECT m.importe,m.sesion_caja_id FROM cobros_credito_pendientes_e1 m JOIN sesiones_caja s ON s.id=m.sesion_caja_id WHERE s.ubicacion_id=835");
 const outflows=await q("SELECT m.id,m.monto,m.cuenta_origen,m.sesion_caja_id FROM salidas_dinero_caja m JOIN sesiones_caja s ON s.id=m.sesion_caja_id WHERE s.ubicacion_id=835");
 const cuts=await q("SELECT a.id,a.accion,a.entidad_id,a.created_at FROM auditoria a JOIN sesiones_caja s ON a.entidad_id=s.id::text WHERE a.entidad='sesiones_caja' AND a.accion='CERRAR_CAJA' AND s.ubicacion_id=835");
 const expected=credit.length||retained.length?null:sessions.map(s=>({sessionId:s.id,expected:(Number(s.fondo_inicial)+payments.filter(p=>p.forma_pago==="EFECTIVO"&&tickets.some(t=>t.id===p.ticket_id&&t.sesion_caja_id===s.id&&t.estado==="VENDIDO")).reduce((a,p)=>a+Number(p.importe),0)-outflows.filter(o=>o.sesion_caja_id===s.id&&o.cuenta_origen==="CAJA_FISICA").reduce((a,o)=>a+Number(o.monto),0)).toFixed(2)}));
 await c.query("ROLLBACK");
 const logs=fs.readFileSync(".local/tanda-e-continuacion/api-runtime.log","utf8").split("\n");
 const events=[];
 for(const line of logs){try{const r=JSON.parse(line);const url=r.req?.url;if(!url&&!r.err)continue;events.push({time:r.time,method:r.req?.method,path:url?.split("?")[0],status:r.res?.statusCode,errorType:r.err?.type,errorCode:r.err?.code,message:r.msg==="request completed"||r.msg==="request errored"?r.msg:undefined});}catch{}}
 if(events.length===0){
 for(const block of logs.join("\n").split(/(?=^\[\d\d:\d\d:\d\d)/m)){
 const time=block.match(/^\[([^\]]+)\]/)?.[1],method=block.match(/"method":\s*"([^"]+)"/)?.[1],path=block.match(/"url":\s*"([^"]+)"/)?.[1]?.split("?")[0],status=block.match(/"statusCode":\s*(\d+)/)?.[1];
 if(path)events.push({time,method,path,status:status?Number(status):null});
 else if(/\] ERROR /.test(block))events.push({time,errorType:"API ERROR (details omitted)"});
 }
 }
 const report={timestamp:new Date().toISOString(),scope:"read-only repeatable-read site835; logs are API-wide metadata only, no headers/query strings/bodies",identity,tickets,payments,sessions,credit,retained,outflows,closedCutEvidence:cuts,expectedCash:expected,expectedCashNote:expected?"Initial fund plus paid VENDIDO cash tickets minus physical outflows; no session credit/retained records. Not a UI screenshot.":"Credit records present; expected calculation deferred to canonical reader.",recentApiEvents:events.slice(-100),recentErrors:events.filter(e=>e.status>=400||e.errorType).slice(-20)};
 fs.writeFileSync("reports/tanda-e-continuacion/intermediate-state.json",JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await c.end();}