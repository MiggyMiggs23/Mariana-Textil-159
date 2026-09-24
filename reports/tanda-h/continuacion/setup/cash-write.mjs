// Native service mutations, COPY only; execute AFTER paired index proof.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const root=process.cwd(),privateRoot=root+"/private.local/tanda-h-resume",out=root+"/reports/tanda-h/continuacion/setup/cash-write.json";
if(fs.existsSync(out))throw Error("Refusing duplicate write benchmark");
const cfg=JSON.parse(fs.readFileSync(privateRoot+"/worker-databases.json")).browser;
const f=JSON.parse(fs.readFileSync(root+"/reports/tanda-h/continuacion/setup/fixture-manifest-redacted.json"));
process.env.NODE_ENV="test";process.env.REQUIRE_ISOLATED_TEST_DATABASE="1";process.env.TEST_DATABASE_URL=cfg.url;
process.env.DATABASE_URL="postgresql://postgres@127.0.0.1:55445/tanda_hr_witness";process.env.APPLICATION_DATABASE_URL=process.env.DATABASE_URL;
const {db,pool}=await import(privateRoot+"/frozen-source/lib/db/src/index.ts");
const {crearTicket,cobrarTicket}=await import(privateRoot+"/frozen-source/artifacts/api-server/src/lib/pos.ts");
const samples=[];
try{
 const identity=(await pool.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
 if(identity.db!=="tanda_hr_browser"||identity.actor!=="hr_browser"||identity.port!==55445)throw Error("Isolation mismatch");
 const customer=(await pool.query("INSERT INTO clientes(nombre,dias_credito,limite_credito) VALUES('TANDA H RESUME SMALL CUSTOMER',30,5000) RETURNING id,nombre")).rows[0];
 f.customer=customer;
 fs.writeFileSync(root+"/reports/tanda-h/continuacion/setup/small-customer.json",JSON.stringify(customer,null,2));
 for(const source of f.rolls.filter(r=>r.siteId===f.sites[0].id).slice(0,3)){
  const roll=(await pool.query("select cantidad_actual::text cantidad from public.rollos where id=$1 and estado='DISPONIBLE'",[source.id])).rows[0];
  if(!roll)throw Error("Native source roll unavailable");
  const ticket=await db.transaction(tx=>crearTicket(tx,{ubicacionId:f.sites[0].id,usuarioTerminalId:f.actors.terminal.id,clienteId:f.customer.id,facturado:false,credito:false,uuidCliente:randomUUID(),lineas:[{rolloId:source.id,productoId:source.productId,cantidad:roll.cantidad,precioUnitario:"100.00",tipo:"NORMAL"}],ip:"127.0.0.1"},true));
  const start=performance.now();
  const collected=await db.transaction(tx=>cobrarTicket(tx,{ticketId:ticket.id,sesionCajaId:f.sessions[0].id,usuarioId:f.actors.caja.id,pagos:[{formaPago:"EFECTIVO",importe:ticket.total}],ip:"127.0.0.1"},true));
  const committedMs=performance.now()-start;
  const payments=(await pool.query("select id,ticket_id,forma_pago,importe from public.ticket_pagos where ticket_id=$1",[ticket.id])).rows;
  const persisted=(await pool.query("select id,cobrado,sesion_caja_id,total from public.tickets where id=$1",[ticket.id])).rows[0];
  samples.push({ticketId:ticket.id,committedMs,persisted,payments,source,returnedCollected:collected.cobrado});
  fs.writeFileSync(out,JSON.stringify({identity,definition:"Native cobrarTicket transaction through successful COMMIT; ticket creation excluded, no browser/network latency claim; each ticket uses original fully traced fresh synthetic receipt roll and native cash session.",samples},null,2));
  console.log(JSON.stringify({ticketId:ticket.id,committedMs}));
 }
}finally{await pool.end();}