// Run only after MAIN explicitly hands off the exclusive writer window.
// Historical SQL fixtures measure load, not the correctness of transaction producers.
import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const out = new URL("./", import.meta.url);
const config = { days: 365, stores: 3, ticketsPerStoreDay: 50, start: "2025-09-27" };
if (process.argv[2] !== "--main-authorized-writer-window") throw Error("MAIN writer handoff required");
if (fs.existsSync(new URL("./load-results.json", out))) throw Error("Already loaded");
const url = new URL(JSON.parse(fs.readFileSync("/tmp/noche-20260926/test-env.json")).TEST_DATABASE_URL);
if (url.pathname !== "/noche_20260926" || !url.hostname.endsWith(".neon.tech")) throw Error("Wrong copy");
const admin = JSON.parse(fs.readFileSync("/tmp/noche-20260926/credentials.json")).admin;
const c = new pg.Client({ connectionString: url.href });
await c.connect();
if ((await c.query("select current_database() db")).rows[0].db !== "noche_20260926") throw Error("Wrong effective database");
const tables = ["clientes", "tickets", "ticket_lineas", "ticket_pagos", "movimientos_credito", "rollos", "sesiones_caja"];
const counts = async () => Object.fromEntries(await Promise.all(tables.map(async t =>
  [t, (await c.query(`SELECT count(*)::int n FROM public.${t}`)).rows[0].n])));
const before = await counts();
const customers = (await c.query("SELECT id FROM clientes WHERE id<>1 ORDER BY id")).rows.map(r => r.id);
if (customers.length < 2575) throw Error("Inherited customer population missing");
const realCustomers = customers.slice(0, 2575);
const n = config.days * config.stores * config.ticketsPerStoreDay;
const started = performance.now();
await c.query("BEGIN");
try {
  await c.query("SET LOCAL statement_timeout='900s'");
  if ((await c.query("SELECT 1 FROM tickets WHERE folio BETWEEN 1900000001 AND 1900054750 LIMIT 1")).rowCount)
    throw Error("Synthetic folio range already occupied");
  const sites = [], sessions = [];
  for (let i = 0; i < config.stores; i++) {
    const site = (await c.query("INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'TIENDA') RETURNING id,nombre",
      [`NOCHE PERF ${i + 1}`, ["NPA", "NPB", "NPC"][i]])).rows[0];
    sites.push(site);
    sessions.push((await c.query(`INSERT INTO sesiones_caja(ubicacion_id,usuario_id,fondo_inicial,fecha_operativa)
      VALUES($1,$2,0,(now() AT TIME ZONE 'America/Mexico_City')::date) RETURNING id`, [site.id, admin.id])).rows[0].id);
  }
  const products = [];
  for (let i = 1; i <= 4; i++) products.push((await c.query(
    `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,notas)
     VALUES($1,$2,'Azul','METRO',100,'Synthetic annual performance only') RETURNING id`,
    [`NPERF${i}`, `Noche synthetic fabric ${i}`])).rows[0].id);
  const supplier = (await c.query("SELECT id FROM proveedores ORDER BY id LIMIT 1")).rows[0];
  if (!supplier) throw Error("Copied supplier required");
  await c.query(`INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,total,estado,cobrado,cobrado_at,usuario_caja_id,sesion_caja_id,uuid_cliente,created_at,credito,dias_plazo,fecha_vencimiento,iva,tasa_iva)
    SELECT 1900000000+g,($1::int[])[1+(g-1)%3],$2,($3::int[])[1+(g-1)%2575],100,116,'VENDIDO',g%20<>0,
    CASE WHEN g%20<>0 THEN $4::date+((g-1)/150)*interval '1 day'+interval '12 hours' END,$2,
    CASE WHEN (g-1)/150=364 THEN ($5::int[])[1+(g-1)%3] END,
    md5('NOCHE20260926-PERF-'||g)::uuid,$4::date+((g-1)/150)*interval '1 day'+interval '12 hours',
    g%4=0,CASE WHEN g%4=0 THEN 30 END,CASE WHEN g%4=0 THEN $4::date+(g-1)/150+30 END,16,0.16
    FROM generate_series(1,$6::int) g`, [sites.map(s => s.id), admin.id, realCustomers, config.start, sessions, n]);
  await c.query(`INSERT INTO rollos(serie,producto_id,ubicacion_id,proveedor_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total,notas)
    SELECT 'NPERF-'||g,($1::int[])[1+(g-1)%4],($2::int[])[1+(g-1)%3],$3,
    'VENDIDO',1,0,50,50,'Synthetic annual performance only; not native purchase provenance'
    FROM generate_series(1,$4::int) g`, [products, sites.map(s => s.id), supplier.id, n]);
  await c.query(`INSERT INTO ticket_lineas(ticket_id,rollo_id,producto_id,cantidad,precio_unitario,precio_sugerido,importe,costo_unitario_congelado,costo_total_congelado,tipo)
    SELECT t.id,r.id,r.producto_id,1,100,100,100,50,50,'NORMAL' FROM tickets t
    JOIN rollos r ON r.serie='NPERF-'||(t.folio-1900000000) WHERE t.folio BETWEEN 1900000001 AND 1900054750`);
  await c.query(`INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,created_at,usuario_id)
    SELECT id,CASE WHEN folio%2=0 THEN 'TRANSFERENCIA'::forma_pago_ticket ELSE 'EFECTIVO'::forma_pago_ticket END,116,created_at,$1
    FROM tickets WHERE folio BETWEEN 1900000001 AND 1900054750 AND cobrado AND NOT credito`, [admin.id]);
  await c.query(`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
    SELECT 'VENTA_CREDITO',uuid_cliente,'OPERACION_CREDITO_SIN_DINERO',$1,jsonb_build_object('benchmark',true,'ticketId',id)
    FROM tickets WHERE folio BETWEEN 1900000001 AND 1900054750 AND credito`, [admin.id]);
  await c.query(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,notas,created_at,dias_plazo,fecha_vencimiento,sitio_origen_id,naturaleza,operacion_productor,operacion_clave)
    SELECT cliente_id,id,'VENTA_CREDITO',116,$1,'Synthetic annual performance only',created_at,30,fecha_vencimiento,ubicacion_id,
    'OPERACION_CREDITO_SIN_DINERO','VENTA_CREDITO',uuid_cliente
    FROM tickets WHERE folio BETWEEN 1900000001 AND 1900054750 AND credito`, [admin.id]);
  await c.query("SET CONSTRAINTS ALL IMMEDIATE");
  await c.query("COMMIT");
  const after = await counts();
  const evidence = { status: "LOADED", database: "noche_20260926", before, after,
    loadMs: performance.now() - started, assumptions: { ...config, tickets: n, clientsDistributed: 2575,
      distribution: "round robin across copied customers, 4 meter products and 3 synthetic stores",
      credit: "every fourth ticket", unpaid: "every twentieth ticket (subset of credit)",
      notObservedBusinessAnnualVolume: true, notCorrectnessSimulation: true },
    sites, sessions, products, adminId: admin.id, customerId: realCustomers[0],
    end: "2026-09-26", at: new Date().toISOString() };
  fs.writeFileSync(new URL("./load-results.json", out), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ status: evidence.status, before, after }));
} catch (error) {
  await c.query("ROLLBACK");
  fs.writeFileSync(new URL("./load-error.json", out), JSON.stringify({ status: "FAILED", code: error.code, message: error.message, at: new Date().toISOString() }, null, 2));
  throw error;
} finally { await c.end(); }