import fs from "node:fs";
import {randomUUID} from "node:crypto";
const root=process.cwd(),p=root+"/private.local/tanda-h-resume",out=root+"/reports/tanda-h/continuacion/mediciones/cash-tickets.json";
const cfg=JSON.parse(fs.readFileSync(p+"/worker-databases.json")).browser,f=JSON.parse(fs.readFileSync(root+"/reports/tanda-h/continuacion/setup/fixture-manifest-redacted.json"));
process.env.NODE_ENV="test";process.env.REQUIRE_ISOLATED_TEST_DATABASE="1";process.env.TEST_DATABASE_URL=cfg.url;
process.env.DATABASE_URL="postgresql://postgres@127.0.0.1:55445/tanda_hr_witness";process.env.APPLICATION_DATABASE_URL=process.env.DATABASE_URL;
const {db,pool}=await import(p+"/frozen-source/lib/db/src/index.ts");
const {crearTicket}=await import(p+"/frozen-source/artifacts/api-server/src/lib/pos.ts");
try{
 const identity=(await pool.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
 if(identity.db!=="tanda_hr_browser"||identity.actor!=="hr_browser"||identity.port!==55445)throw Error("Wrong copy");
 if(process.argv.includes("--verify")){
  const created=JSON.parse(fs.readFileSync(out));
  const ids=created.samples.map(s=>s.ticketId);
  const tickets=(await pool.query("select id,folio,cobrado,sesion_caja_id,total from tickets where id=any($1::int[])",[ids])).rows;
  const payments=(await pool.query("select id,ticket_id,forma_pago,importe from ticket_pagos where ticket_id=any($1::int[])",[ids])).rows;
  const sessions=(await pool.query("select id,estado,ubicacion_id from sesiones_caja where id=$1",[f.sessions[0].id])).rows;
  fs.writeFileSync(out.replace("cash-tickets","cash-persisted"),JSON.stringify({identity,tickets,payments,sessions},null,2));
 }else{
  if(fs.existsSync(out))throw Error("Refusing duplicate producer");
  const samples=[];
  for(const source of f.rolls.filter(r=>r.siteId===f.sites[0].id).slice(3,6)){
   const roll=(await pool.query("select cantidad_actual::text cantidad from rollos where id=$1 and estado='DISPONIBLE'",[source.id])).rows[0];if(!roll)throw Error("Roll not available");
   const ticket=await db.transaction(tx=>crearTicket(tx,{ubicacionId:f.sites[0].id,usuarioTerminalId:f.actors.terminal.id,clienteId:9,facturado:false,credito:false,uuidCliente:randomUUID(),lineas:[{rolloId:source.id,productoId:source.productId,cantidad:roll.cantidad,precioUnitario:"100.00",tipo:"NORMAL"}],ip:"127.0.0.1"},true));
   samples.push({ticketId:ticket.id,total:ticket.total,source});
   fs.writeFileSync(out,JSON.stringify({identity,samples},null,2));
  }
 }
}finally{await pool.end();}