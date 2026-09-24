import fs from "node:fs";
import pg from "../../scripts/node_modules/pg/lib/index.js";
const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy",options:"-c default_transaction_read_only=on"});
try{
 await c.connect();await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const q=async(s)=>(await c.query(s)).rows;
 const identity=(await q("SELECT current_database() database,current_setting('transaction_read_only') readonly"))[0];
 if(identity.database!=="tanda_e_continuacion_copy"||identity.readonly!=="on")throw Error("Identity guard");
 const tickets=await q("SELECT id,folio,total,estado,cobrado,sesion_caja_id,cancelado_at,cancelado_por,motivo_cancelacion FROM tickets WHERE ubicacion_id=835 AND id IN(112,113) ORDER BY id");
 const payments=await q("SELECT id,ticket_id,forma_pago,importe FROM ticket_pagos WHERE ticket_id IN(112,113)");
 const lines=await q("SELECT ticket_id,rollo_id,cantidad,precio_unitario,importe,costo_unitario_congelado,costo_total_congelado,(importe-costo_total_congelado)::text margin FROM ticket_lineas WHERE ticket_id IN(112,113)");
 const rolls=await q("SELECT id,serie,estado,cantidad_actual,costo_total FROM rollos WHERE id IN(6237,6238) AND ubicacion_id=835");
 const movements=await q("SELECT id,rollo_id,tipo,cantidad,saldo_posterior,documento_tipo,documento_id FROM movimientos WHERE rollo_id IN(6237,6238) AND ubicacion_id=835 ORDER BY id");
 const outflows=await q("SELECT id,sesion_caja_id,monto,motivo,cuenta_origen,creado_por_id FROM salidas_dinero_caja WHERE sesion_caja_id=46");
 const audit=await q("SELECT id,accion,entidad,entidad_id,datos_despues,created_at FROM auditoria WHERE (entidad_id IN('112','113','6237') AND created_at>='2026-09-24T03:21:00Z') OR (datos_despues::text LIKE '%TANDA EC salida suficiente%') ORDER BY id");
 const session=await q(`SELECT s.id,s.estado,s.fondo_inicial,s.cerrada_at,
 (s.fondo_inicial+COALESCE((SELECT sum(p.importe) FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id WHERE t.sesion_caja_id=s.id AND t.estado='VENDIDO' AND p.forma_pago='EFECTIVO'),0)
 +COALESCE((SELECT -sum(m.importe) FROM movimientos_credito m WHERE m.sesion_caja_id=s.id AND m.tipo='ABONO' AND m.naturaleza='INGRESO_FISICO' AND m.forma_pago='EFECTIVO' AND m.cuenta_destino='CAJA_FISICA'),0)
 -COALESCE((SELECT sum(o.monto) FROM salidas_dinero_caja o WHERE o.sesion_caja_id=s.id AND o.cuenta_origen='CAJA_FISICA'),0))::text expected_cash
 FROM sesiones_caja s WHERE s.id=46 AND s.ubicacion_id=835`);
 const financialIsolation=await q("SELECT (SELECT count(*) FROM ticket_pagos WHERE ticket_id=113) cancelled_ticket_payments,(SELECT count(*) FROM movimientos_credito WHERE ticket_id=113) cancelled_ticket_credit_movements,(SELECT sum(importe) FROM movimientos_credito WHERE cliente_id=8)::text customer8_debt");
 await c.query("ROLLBACK");
 const r={timestamp:new Date().toISOString(),identity,tickets,payments,lines,rolls,movements,outflows,audit,session,financialIsolation};
  const output=process.argv[2]??"remate-e4-cancel-reconciliation.json";
  if(!/^[a-z0-9-]+\.json$/.test(output))throw Error("Invalid evidence filename");
  fs.writeFileSync("reports/tanda-e-continuacion/"+output,JSON.stringify(r,null,2));
 console.log(JSON.stringify({...r,audit:audit.map(a=>({id:a.id,accion:a.accion,entidad:a.entidad,entidad_id:a.entidad_id}))},null,2));
}finally{await c.end();}