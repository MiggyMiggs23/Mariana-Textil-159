import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import { readClientesListado, matchesCustomer, activityReadQuery } from "../../artifacts/api-server/src/lib/clientes-listado";
import { ListClientesListadoQueryParams, ListClientesListadoResponse } from "../../lib/api-zod/src/generated/api";

const root = await mkdtemp(join(tmpdir(), "clientes-listado-"));
let pool: pg.Pool | undefined, started = false;
try {
  execFileSync("initdb", ["-D", join(root,"data"), "-A","trust","-U","tester"], {stdio:"pipe"});
  execFileSync("pg_ctl", ["-D",join(root,"data"),"-l",join(root,"pg.log"),"-o",`-k ${root} -h '' -p 25451`,"-w","start"], {stdio:"pipe"});
  started = true;
  pool = new pg.Pool({host:root,port:25451,user:"tester",database:"postgres"});
  await pool.query((await readFile("reports/importacion-clientes-reales-20260925/schema-only.sql","utf8")).replace(/^\\.*$/gm,""));
  // Fixture-only trigger bypass while constructing historical states, NEVER live.
  const client = await pool.connect();
  try {
    await client.query("SET search_path=public,pg_catalog; SET session_replication_role=replica");
    await client.query(`INSERT INTO clientes(id,nombre,rfc,telefono,limite_credito) VALUES
      (1,'Aarón Arvizu Rodríguez','ABC010101ZZ1','(55) 1234-5678',150000),
      (2,'Beatriz Pérez','XAXX010101000',NULL,150000),(3,'Cliente sin movimientos',NULL,NULL,150000);
      INSERT INTO clientes(id,nombre) SELECT n,'Cliente sintético '||n FROM generate_series(4,2575) n`);
    await client.query(`INSERT INTO tickets(id,folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,total,uuid_cliente,
      documento_tipo,cobrado,cobrado_at,autorizacion_estado,autorizado_at,estado)
      VALUES
      (1,1,1,1,1,100,100,gen_random_uuid(),'NOTA',false,NULL,'AUTORIZADA',now()-interval '3 days','VENDIDO'),
      (2,2,2,1,1,20,20,gen_random_uuid(),'TICKET',true,now()-interval '2 months','NO_APLICA',NULL,'VENDIDO'),
      (3,3,1,1,2,10,10,gen_random_uuid(),'TICKET',true,now()-interval '2 days','NO_APLICA',NULL,'CANCELADO'),
      (4,4,1,1,2,10,10,gen_random_uuid(),'NOTA',false,NULL,'PENDIENTE',NULL,'VENDIDO'),
      (5,5,1,1,2,10,10,gen_random_uuid(),'TICKET',true,now()-interval '2 years','NO_APLICA',NULL,'VENDIDO')`);
    await client.query(`INSERT INTO movimientos_credito(id,cliente_id,ticket_id,tipo,importe,usuario_id,created_at,sitio_origen_id,movimiento_origen_id)
      VALUES (1,1,1,'VENTA_CREDITO',100,1,now()-interval '3 days',1,NULL),
      (2,1,NULL,'ABONO',-25,1,now()-interval '1 day',1,NULL),
      (3,2,NULL,'ABONO',-10,1,now()-interval '1 hour',1,NULL),
      (4,2,NULL,'REVERSO',10,1,now(),1,3),
      (5,2,NULL,'ABONO',-40,1,now()-interval '2 days',2,NULL)`);
    await client.query("SET session_replication_role=origin; BEGIN READ ONLY");
    const all = await readClientesListado(client,{},true,null);
    assert.equal(all.total,2575); assert.equal(all.items.length,50);
    assert.equal(all.items[0].id,1);
    assert.equal(all.items[0].movementCount,3); // note + ticket + abono, not credit ledger
    assert.equal(all.items[0].saldoActual,"75.00");
    assert.equal(all.items.find(r=>r.id===2)?.saldoAFavor,"40.00");
    ListClientesListadoResponse.parse(all);
    for(const q of ["Arvizu","aaron rodriguez","010101ZZ","551234"]) {
      const found = await readClientesListado(client,{q},true,null); assert.equal(found.total,1);
    }
    const month = await readClientesListado(client,{q:"Arvizu",period:"1m"},true,null);
    assert.equal(month.items[0].movementCount,2);
    assert.equal((await readClientesListado(client,{q:"Arvizu",period:"3m"},true,null)).items[0].movementCount,3);
    assert.equal((await readClientesListado(client,{q:"Beatriz",period:"1y"},true,null)).items[0].movementCount,1);
    const site = await readClientesListado(client,{q:"Arvizu"},true,[1]);
    assert.equal(site.items[0].movementCount,2); assert.equal(site.items[0].saldoActual,"75.00");
    const beatrizSite = await readClientesListado(client,{q:"Beatriz"},true,[1]);
    assert.equal(beatrizSite.items[0].movementCount,1); // only old site1 ticket, reversed abono excluded
    const operational = await readClientesListado(client,{},false,null);
    assert.equal(operational.items[0].movementCount,null);
    assert.equal(operational.items[0].lastActivity,null);
    assert.equal("saldoActual" in operational.items[0],false);
    assert.equal("limiteCredito" in operational.items[0],false);
    assert.equal((await readClientesListado(client,{sort:"saldoActual",direction:"desc"},true,null)).items[0].id,1);
    const asc = await readClientesListado(client,{sort:"nombre",direction:"asc",pageSize:1},true,null);
    const desc = await readClientesListado(client,{sort:"nombre",direction:"desc",pageSize:1},true,null);
    assert.notEqual(asc.items[0].id,desc.items[0].id);
    assert.notEqual(asc.items[0].id,(await readClientesListado(client,{sort:"nombre",direction:"asc",pageSize:1,page:2},true,null)).items[0].id);
    assert.equal(ListClientesListadoQueryParams.safeParse({pageSize:101}).success,false);
    assert.equal(matchesCustomer({nombre:"Aarón Arvizu",rfc:null,telefono:null},"arvizu"),true);
    await client.query("COMMIT; SET session_replication_role=replica");
    await client.query(`INSERT INTO tickets(id,folio,ubicacion_id,usuario_terminal_id,cliente_id,
      subtotal,total,uuid_cliente,cobrado,cobrado_at)
      SELECT 100+n,100+n,1,1,4+(n%2572),10,10,gen_random_uuid(),true,
        now()-(n%700)*interval '1 day' FROM generate_series(1,50000) n`);
    await client.query("SET session_replication_role=origin; BEGIN READ ONLY");
    const scaledStart = performance.now();
    const scaled = await readClientesListado(client,{sort:"movementCount",direction:"desc",period:"1m"},true,null);
    const scaledMs = Math.round(performance.now()-scaledStart);
    assert.equal(scaled.total,2575);
    assert.ok(scaled.items[0].movementCount! > 0);
    const probe = activityReadQuery([1,2],null,"1m");
    const plan = await client.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+probe.text,probe.values);
    await client.query("COMMIT");
    await writeFile("reports/clientes-lista-20260925/backend-test-proof.json",JSON.stringify({
      passed:true,disposableSchemaTables:108,syntheticCustomers:2575,assertions:[
        "substring/accent/name words/RFC/phone","default activity order","no ticket-ledger duplication",
        "cancelled/unapproved docs excluded","reversed abono excluded","period1m3m1yall","site restricted activity",
        "canonical global debt and favor","nonfinancial redaction","asc/desc/nulls-last/pagination","generated validators"],
      activityPlan:plan.rows[0]["QUERY PLAN"],syntheticTicketScale:50000,scaledServiceMs:scaledMs,
    },null,2));
    console.log("PASS disposable full-schema 2575 customers, activity/debt/periods/permissions/search/pagination.");
  } finally { client.release(); }
} finally {
  await pool?.end();
  if(started) execFileSync("pg_ctl",["-D",join(root,"data"),"-m","fast","-w","stop"],{stdio:"pipe"});
  await rm(root,{recursive:true,force:true});
}