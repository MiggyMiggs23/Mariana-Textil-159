import fs from "node:fs";
import pg from "../../scripts/node_modules/pg/lib/index.js";
const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy",options:"-c default_transaction_read_only=on"});
try{
 await c.connect();await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const q=async(s)=>(await c.query(s)).rows;
 const identity=(await q("SELECT current_database() database,current_setting('transaction_read_only') readonly"))[0];
 if(identity.database!=="tanda_e_continuacion_copy"||identity.readonly!=="on")throw Error("Identity guard");
 const notes=await q("SELECT id,folio,total,documento_tipo,credito,dias_plazo,sesion_caja_id FROM tickets WHERE ubicacion_id=835 AND cliente_id=8");
 const movements=await q("SELECT id,ticket_id,tipo,importe,naturaleza,forma_pago,cuenta_destino,sesion_caja_id,operacion_productor,created_at FROM movimientos_credito WHERE cliente_id=8 ORDER BY id");
 const applications=await q("SELECT a.id,a.abono_movimiento_id,a.venta_movimiento_id,a.importe FROM aplicaciones_credito a JOIN movimientos_credito m ON m.id=a.abono_movimiento_id WHERE m.cliente_id=8");
 const receipts=await q("SELECT folio,movimiento_id,cliente_id,sesion_operativa_id,origen FROM recibos_abono_e3 WHERE cliente_id=8");
 const debt=await q("SELECT sum(importe)::text debt FROM movimientos_credito WHERE cliente_id=8");
 const printAudits=await q("SELECT id,accion,entidad,entidad_id,created_at FROM auditoria WHERE (entidad_id='E3-835-00000001' OR datos_despues::text LIKE '%E3-835-00000001%') ORDER BY id");
 const session=await q(`SELECT s.id,s.estado,s.fondo_inicial,
 (s.fondo_inicial+COALESCE((SELECT sum(p.importe) FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id WHERE t.sesion_caja_id=s.id AND t.estado='VENDIDO' AND p.forma_pago='EFECTIVO'),0)
 +COALESCE((SELECT -sum(m.importe) FROM movimientos_credito m WHERE m.sesion_caja_id=s.id AND m.tipo='ABONO' AND m.naturaleza='INGRESO_FISICO' AND m.forma_pago='EFECTIVO' AND m.cuenta_destino='CAJA_FISICA'),0)
 -COALESCE((SELECT sum(o.monto) FROM salidas_dinero_caja o WHERE o.sesion_caja_id=s.id AND o.cuenta_origen='CAJA_FISICA'),0))::text expected_cash
 FROM sesiones_caja s WHERE s.id=46 AND s.ubicacion_id=835`);
 await c.query("ROLLBACK");
 const r={timestamp:new Date().toISOString(),identity,notes,movements,applications,receipts,debt,printAudits,session};
 fs.writeFileSync("reports/tanda-e-continuacion/credit-reconciliation.json",JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));
}finally{await c.end();}