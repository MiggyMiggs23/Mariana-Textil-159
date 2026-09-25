// Run only after MAIN has provisioned and approved the disposable copy.
// This is a performance fixture, not an inventory-correctness simulation.
import fs from "node:fs";
import pg from "../../../scripts/node_modules/pg/lib/index.js";

const root = process.cwd();
const dir = `${root}/reports/continuacion-rollos-20260925/performance`;
const privateDir = `${root}/private.local/roll-return-continuation`;
const ready = JSON.parse(fs.readFileSync(`${root}/reports/continuacion-rollos-20260925/preparation/ready.json`, "utf8"));
const url = `postgresql://postgres@127.0.0.1:${ready.postgresPort}/${ready.testDatabase}`;
if (process.env.MAIN_APPROVED_ANNUAL_SEED !== "yes") throw Error("MAIN approval required");
const parsed = new URL(url);
if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55536" || parsed.pathname !== "/continue_test" ||
    ready.applicationRowsCopied !== false || ready.origin !== "http://127.0.0.1:43937" ||
    ready.apiOrigin !== "http://127.0.0.1:43936") {
  throw Error("Refusing non-disposable PostgreSQL target");
}
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  const identity = (await c.query(`SELECT current_database() db, inet_server_port() port,
    current_setting('data_directory') directory, current_user actor`)).rows[0];
  if (identity.db !== "continue_test" || identity.port !== 55536 ||
      identity.directory !== `${privateDir}/cluster`) throw Error("Private cluster identity not verified");

  // Provision first with provision.mjs: no guessed IDs, no source actor identities.
  const f = JSON.parse(fs.readFileSync(`${privateDir}/annual-fixture.json`, "utf8"));
  if (f.sites?.length !== 3 || f.products?.length !== 4 ||
      !f.sites.every(s => s.nombre.startsWith("ROLL RETURN PERF ")) ||
      !f.customer?.nombre?.startsWith("ROLL RETURN PERF ") ||
      !["terminal", "caja"].every(k => f.actors?.[k]?.username?.startsWith("roll-return-perf-")) ||
      f.actors?.admin?.username !== JSON.parse(fs.readFileSync(`${privateDir}/credentials.json`, "utf8")).admin.username) {
    throw Error("Missing canonical-admin provisioned synthetic fixture manifest");
  }
  // Earlier disposable campaigns have other synthetic actors; zero application
  // rows copied is attested by preparation/ready.json, not username patterns.
  for (const s of f.sites) {
    const row = (await c.query("SELECT nombre FROM ubicaciones WHERE id=$1", [s.id])).rows[0];
    if (row?.nombre !== s.nombre) throw Error("Site identity mismatch");
  }
  for (const k of ["admin", "terminal", "caja"]) {
    const a = f.actors[k], row = (await c.query("SELECT usuario,rol,activo FROM usuarios WHERE id=$1", [a.id])).rows[0];
    if (row?.usuario !== a.username || row?.rol !== k.toUpperCase() || !row.activo) throw Error("Actor identity mismatch");
  }
  const customer = (await c.query("SELECT nombre FROM clientes WHERE id=$1", [f.customer.id])).rows[0];
  if (customer?.nombre !== f.customer.nombre) throw Error("Synthetic customer mismatch");
  for (const p of f.products) {
    const row = (await c.query("SELECT sku FROM productos WHERE id=$1", [p.id])).rows[0];
    if (row?.sku !== p.sku || !row.sku.startsWith("ROLL-RETURN-PERF-")) throw Error("Product identity mismatch");
  }
  if (f.sessions?.length !== 3 || f.sessions.some((s, i) => s.ubicacion_id !== f.sites[i].id)) throw Error("Session/site mismatch");
  const sessions = (await c.query("SELECT id,ubicacion_id,estado FROM sesiones_caja WHERE id=ANY($1::int[])", [f.sessions.map(s => s.id)])).rows;
  if (sessions.length !== 3 || sessions.some(s => s.estado !== "ABIERTA" ||
      !f.sessions.some(expected => expected.id === s.id && expected.ubicacion_id === s.ubicacion_id))) {
    throw Error("Synthetic sessions unavailable");
  }
  const existing = (await c.query("SELECT count(*)::int n FROM tickets WHERE folio BETWEEN 1800000001 AND 1800054750")).rows[0].n;
  if (existing) throw Error("Fixture already exists; refusing duplicate load");
  const before = {};
  for (const table of ["tickets", "movimientos_credito", "operaciones_credito_e1", "ticket_lineas", "ticket_pagos"]) {
    before[table] = Number((await c.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);
  }
  const started = performance.now();
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL statement_timeout='180s'");
    const sites = f.sites.map(s => s.id), sessionIds = f.sessions.map(s => s.id);
    // UTC inclusive dates 2025-09-25..2026-09-24 (365 days), 50 per site per day.
    // Credit notes are authorized and have matching E1 operations and ledger entries.
    await c.query(`INSERT INTO tickets(folio,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,total,iva,tasa_iva,
      estado,documento_tipo,autorizacion_estado,autorizado_por,autorizado_at,cobrado,cobrado_at,
      usuario_caja_id,sesion_caja_id,uuid_cliente,created_at,credito,dias_plazo,fecha_vencimiento)
       SELECT 1800000000+g,($1::int[])[1+(g-1)%3],$2::int,$3::int,100,116,16,0.16,'VENDIDO',
      CASE WHEN g%4=0 THEN 'NOTA' ELSE 'TICKET' END,
      CASE WHEN g%4=0 THEN 'AUTORIZADA' ELSE 'NO_APLICA' END,
       CASE WHEN g%4=0 THEN $4::int END,
      CASE WHEN g%4=0 THEN '2025-09-25T18:00:00Z'::timestamptz+((g-1)/150)*interval '1 day' END,
      g%20<>1,
      CASE WHEN g%4<>0 AND g%20<>1 THEN '2025-09-25T18:00:00Z'::timestamptz+((g-1)/150)*interval '1 day' END,
       $5::int,CASE WHEN (g-1)/150>=363 THEN ($6::int[])[1+(g-1)%3] END,
      md5('ROLL-RETURN-ANNUAL-20260925-'||g)::uuid,
      '2025-09-25T18:00:00Z'::timestamptz+((g-1)/150)*interval '1 day',
      g%4=0,CASE WHEN g%4=0 THEN 30 END,
      CASE WHEN g%4=0 THEN '2025-09-25'::date+(g-1)/150+30 END
      FROM generate_series(1,54750) g`,
      [sites, f.actors.terminal.id, f.customer.id, f.actors.admin.id, f.actors.caja.id, sessionIds]);
    // METREADO needs no fabricated roll provenance; frozen reference cost is explicit.
    await c.query(`INSERT INTO ticket_lineas(ticket_id,producto_id,cantidad,precio_unitario,precio_sugerido,
      importe,costo_unitario_congelado,costo_total_congelado,tipo)
      SELECT t.id,($1::int[])[1+(t.folio-1800000001)%4],1,100,100,100,50,50,'METREADO'
      FROM tickets t WHERE t.folio BETWEEN 1800000001 AND 1800054750`, [f.products.map(p => p.id)]);
    await c.query(`INSERT INTO ticket_pagos(ticket_id,forma_pago,importe,created_at,usuario_id)
       SELECT id,'EFECTIVO',116,created_at,$1::int FROM tickets
      WHERE folio BETWEEN 1800000001 AND 1800054750 AND documento_tipo='TICKET' AND cobrado`, [f.actors.caja.id]);
    await c.query(`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
       SELECT 'VENTA_CREDITO',uuid_cliente,'OPERACION_CREDITO_SIN_DINERO',$1::int,
      jsonb_build_object('fixture','roll-return-annual-20260925','ticketId',id)
      FROM tickets WHERE folio BETWEEN 1800000001 AND 1800054750 AND credito`, [f.actors.caja.id]);
    await c.query(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,notas,
      created_at,dias_plazo,fecha_vencimiento,sitio_origen_id,naturaleza,operacion_productor,operacion_clave)
       SELECT cliente_id,id,'VENTA_CREDITO',116,$1::int,'Synthetic annual performance only',
      created_at,30,fecha_vencimiento,ubicacion_id,'OPERACION_CREDITO_SIN_DINERO',
      'VENTA_CREDITO',uuid_cliente FROM tickets
      WHERE folio BETWEEN 1800000001 AND 1800054750 AND credito`, [f.actors.caja.id]);
    const check = (await c.query(`SELECT count(*)::int tickets,
      count(*) FILTER (WHERE credito)::int notes,
      count(DISTINCT (ubicacion_id,created_at::date))::int site_days,
      min(created_at)::text first, max(created_at)::text last
      FROM tickets WHERE folio BETWEEN 1800000001 AND 1800054750`)).rows[0];
    if (check.tickets !== 54750 || check.notes !== 13687 || check.site_days !== 1095) throw Error("Fixture cardinality mismatch");
    const movements = (await c.query(`SELECT count(*)::int n FROM movimientos_credito m
      JOIN tickets t ON t.id=m.ticket_id WHERE t.folio BETWEEN 1800000001 AND 1800054750`)).rows[0].n;
    if (movements !== 13687) throw Error("Financial evidence mismatch");
    const collectionTickets = (await c.query(`SELECT id,folio FROM tickets
      WHERE folio BETWEEN 1800000001 AND 1800054750 AND ubicacion_id=$1
      AND sesion_caja_id=$2 AND documento_tipo='TICKET' AND NOT cobrado
      ORDER BY id DESC LIMIT 3`, [f.sites[0].id, f.sessions[0].id])).rows;
    if (collectionTickets.length !== 3) throw Error("Three disposable pending tickets required");
    await c.query("COMMIT");
    const after = {};
    for (const table of Object.keys(before)) {
      after[table] = Number((await c.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);
    }
    if (after.tickets - before.tickets !== 54750 ||
        after.movimientos_credito - before.movimientos_credito !== 13687 ||
        after.operaciones_credito_e1 - before.operaciones_credito_e1 !== 13687 ||
        after.ticket_lineas - before.ticket_lineas !== 54750) {
      throw Error("Post-commit financial cardinality mismatch; STOP, do not replay");
    }
    fs.writeFileSync(`${dir}/seed-result.json`, JSON.stringify({
      identity, before, after, fixture: { ...check, movements, days: 365, sites: 3, salesPerSiteDay: 50,
        hypothetical: true, notRealAnnualVolume: true, inventoryCorrectnessSimulation: false },
      collectionTickets,
      seedMs: performance.now()-started
    }, null, 2));
  } catch (e) { await c.query("ROLLBACK"); throw e; }
} finally { await c.end(); }