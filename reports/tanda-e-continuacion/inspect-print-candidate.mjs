import fs from "node:fs";
import pg from "../../scripts/node_modules/pg/lib/index.js";
const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy",options:"-c default_transaction_read_only=on"});
try{
 await c.connect();await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const q=async(s)=>(await c.query(s)).rows;
 const identity=(await q("SELECT current_database() database,current_setting('transaction_read_only') readonly"))[0];
 if(identity.database!=="tanda_e_continuacion_copy"||identity.readonly!=="on")throw Error("Identity guard");
 const money=await q("SELECT id,tipo,importe,operacion_productor,sesion_caja_id FROM movimientos_credito WHERE cliente_id=8 ORDER BY id");
 const receipts=await q("SELECT folio,movimiento_id FROM recibos_abono_e3 WHERE cliente_id=8");
 const prints=await q("SELECT id,accion,created_at FROM auditoria WHERE entidad='recibos_abono_e3' AND entidad_id='E3-835-00000001' ORDER BY id");
 const session=await q("SELECT id,estado,cerrada_at,efectivo_contado FROM sesiones_caja WHERE id=46 AND ubicacion_id=835");
 const payments=await q("SELECT p.id,p.ticket_id,p.forma_pago,p.importe FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id WHERE t.ubicacion_id=835 ORDER BY p.id");
 const pending=await q("SELECT id,folio,total FROM tickets WHERE ubicacion_id=835 AND documento_tipo='TICKET' AND estado='VENDIDO' AND NOT cobrado");
 const cancelled=await q("SELECT id,folio,estado,cobrado FROM tickets WHERE ubicacion_id=835 AND id=113");
 await c.query("ROLLBACK");
 const output=process.argv[2]??"candidate-print-db-check.json";
 if(!/^[a-z0-9-]+\.json$/.test(output))throw Error("Invalid evidence filename");
 fs.writeFileSync("reports/tanda-e-continuacion/"+output,JSON.stringify({timestamp:new Date().toISOString(),identity,money,receipts,prints,session,payments,pending,cancelled},null,2));
 console.log(JSON.stringify({money,prints,session,pending},null,2));
}finally{await c.end();}