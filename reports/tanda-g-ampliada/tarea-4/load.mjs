import fs from "node:fs";
import os from "node:os";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const root=process.cwd(), privateRoot=root+"/.local/tanda-g-ampliada";
const out=root+"/reports/tanda-g-ampliada/tarea-4";
const cfg=JSON.parse(fs.readFileSync(privateRoot+"/worker-databases.json","utf8")).performance;
const fixture=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json","utf8"));
const c=new pg.Client({connectionString:cfg.url});await c.connect();
const identity=(await c.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
if(identity.db!=="tanda_ga_performance"||identity.port!==55442||identity.actor!=="ga_performance")throw Error("Isolation failure");
const tables=["tickets","ticket_lineas","ticket_pagos","movimientos_credito","rollos","clientes","productos","sesiones_caja"];
const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,Number((await c.query(`select count(*) n from ${t}`)).rows[0].n)])));
const before=await counts();
const existing=await c.query("select count(*) n from tickets where folio>=1800000000");
if(Number(existing.rows[0].n))throw Error("Already loaded; refusing duplicate fixtures");
const start=performance.now();
await c.query("BEGIN");await c.query("set local statement_timeout='100s'");
try{
 const sites=fixture.sites.slice(0,3).map(s=>s.id),products=fixture.products.map(p=>p.id),sessions=fixture.sessions.map(s=>s.id);
 // 365 days * 50 tickets/store/day * 3 stores; explicit hypothetical assumption.
 await c.query(`INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,total,estado,cobrado,cobrado_at,usuario_caja_id,sesion_caja_id,uuid_cliente,created_at,credito,dias_plazo,fecha_vencimiento,iva,tasa_iva)
 SELECT 1800000000+g,($1::int[])[1+(g-1)%3],$2,$3,100,116,'VENDIDO',g%20<>0,
 CASE WHEN g%20<>0 THEN '2025-09-24'::timestamptz+((g-1)/150)*interval '1 day' END,$4,
 CASE WHEN (g-1)/150=364 THEN ($5::int[])[1+(g-1)%3] END,
 md5('TANDA-GA-PERF-'||g)::uuid,'2025-09-24'::timestamptz+((g-1)/150)*interval '1 day',
 g%4=0,CASE WHEN g%4=0 THEN 30 END,CASE WHEN g%4=0 THEN ('2025-09-24'::date+(g-1)/150+30) END,16,0.16
 FROM generate_series(1,54750) g`,[sites,fixture.actors.terminal.id,fixture.customer.id,fixture.actors.caja.id,sessions]);
 await c.query(`INSERT INTO rollos(serie,producto_id,ubicacion_id,proveedor_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total,notas)
 SELECT 'GA-PERF-'||g,($1::int[])[1+(g-1)%4],($2::int[])[1+(g-1)%7],$3,
 CASE WHEN g<=54750 THEN 'VENDIDO'::estado_rollo ELSE 'DISPONIBLE'::estado_rollo END,1,CASE WHEN g<=54750 THEN 0 ELSE 1 END,50,50,'Bulk performance only'
 FROM generate_series(1,89750) g`,[products,fixture.sites.map(s=>s.id),fixture.supplier.id]);
 await c.query(`INSERT INTO ticket_lineas(ticket_id,rollo_id,producto_id,cantidad,precio_unitario,precio_sugerido,importe,costo_unitario_congelado,costo_total_congelado,tipo)
 SELECT t.id,r.id,r.producto_id,1,100,100,100,50,50,'NORMAL' FROM tickets t JOIN rollos r ON r.serie='GA-PERF-'||(t.folio-1800000000) WHERE t.folio>1800000000`);
 await c.query(`INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,created_at,usuario_id)
 SELECT id,'EFECTIVO',116,created_at,$1 FROM tickets WHERE folio>1800000000 AND cobrado AND NOT credito`,[fixture.actors.caja.id]);
 await c.query(`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
 SELECT 'VENTA_CREDITO',uuid_cliente,'OPERACION_CREDITO_SIN_DINERO',$1,jsonb_build_object('benchmark',true,'ticketId',id) FROM tickets WHERE folio>1800000000 AND credito`,[fixture.actors.caja.id]);
 await c.query(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,notas,created_at,dias_plazo,fecha_vencimiento,sitio_origen_id,naturaleza,operacion_productor,operacion_clave)
 SELECT cliente_id,id,'VENTA_CREDITO',116,$1,'Bulk performance only',created_at,30,fecha_vencimiento,ubicacion_id,'OPERACION_CREDITO_SIN_DINERO','VENTA_CREDITO',uuid_cliente FROM tickets WHERE folio>1800000000 AND credito`,[fixture.actors.caja.id]);
 await c.query("COMMIT");
}catch(e){await c.query("ROLLBACK");await c.end();throw e;}
const after=await counts();
const settings=(await c.query("select name,setting,unit from pg_settings where name=ANY($1)",[["shared_buffers","work_mem","max_connections","effective_cache_size","max_parallel_workers_per_gather"]])).rows;
const indexes=(await c.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=ANY($1) order by tablename,indexname",[tables])).rows;
fs.writeFileSync(out+"/load-results.json",JSON.stringify({at:new Date(),identity,before,after,loadMs:performance.now()-start,assumptions:{days:365,stores:3,ticketsPerStoreDay:50,tickets:54750,creditShare:"25%",pendingShare:"5%",availableRolls:35000,customerSkew:"all synthetic tickets assigned to one stress customer",products:4,notRealAnnualVolume:true,notCorrectnessSimulation:true},hardware:{cpus:os.cpus().length,cpuModel:os.cpus()[0].model,memoryBytes:os.totalmem(),cgroupMemory:fs.readFileSync("/sys/fs/cgroup/memory.max","utf8").trim(),cgroupCpu:fs.readFileSync("/sys/fs/cgroup/cpu.max","utf8").trim()},settings,indexes},null,2));
await c.end();console.log(JSON.stringify({identity,before,after}));