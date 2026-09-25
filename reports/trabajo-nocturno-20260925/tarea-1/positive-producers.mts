import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "../../../lib/db/src/index";
import { e5Command, e5Capabilities, type E5Actor } from "../../../artifacts/api-server/src/lib/e5";
import { e5Repository } from "../../../artifacts/api-server/src/lib/e5-repository";
import { loadCustomerCreditLedgerInTransaction } from "../../../artifacts/api-server/src/lib/credit-aging-read-model";
import { e11Identity, e11AssignProfile, e11Prepare, e11FiscalSales, e11FiscalClients,
  e11CreateSnapshot, e11DecideSnapshot } from "../../../artifacts/api-server/src/lib/e11-repository";
import { e11Capability, e11Period } from "../../../artifacts/api-server/src/lib/e11";
import { E5_ENABLED, E5_REFUND_ENABLED } from "../../../artifacts/api-server/src/lib/e5-feature";

assert.equal(process.env.REQUIRE_ISOLATED_TEST_DATABASE, "1");
assert.ok(process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL !== process.env.APPLICATION_DATABASE_URL);
const identity = (await pool.query("SELECT current_database() name")).rows[0];
assert.match(identity.name, /^isolated_test_/);
assert.equal(E5_ENABLED, true);
assert.equal(E5_REFUND_ENABLED, false);
const deps = { ledger: (tx: any, client: number) => loadCustomerCreditLedgerInTransaction(client, tx),
  cash: async () => { throw new Error("No cash refund or Fondo in this rehearsal"); } };
const evidence = { descripcion: "Ensayo autorizado disposable", referencias: ["night-financial"] };
try {
  const admin = (await pool.query("SELECT id,nombre FROM usuarios WHERE usuario='admin' AND rol='ADMIN'")).rows[0];
  assert.ok(admin);
  const site = (await pool.query("SELECT id FROM ubicaciones WHERE nombre='Mariana'")).rows[0].id;
  const actor: E5Actor = { ...admin, rol: "ADMIN", ubicacionId: null, ip: "127.0.0.1",
    ver: true, recibirCaja: true, recibirCliente: true, todas: true, capacidadAE11: false };
  const customer = (await pool.query("INSERT INTO clientes(nombre,es_sistema) VALUES ('Ensayo financiero disposable',false) RETURNING id")).rows[0].id;
  const notes: { id: number; movement: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const key = randomUUID();
    const ticket = (await pool.query(`INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,cliente_id,usuario_terminal_id,
      estado,documento_tipo,autorizacion_estado,facturado,credito,cobrado,total,subtotal,iva,tasa_iva,dias_plazo,fecha_vencimiento)
      VALUES ($1,$2,$3,$4,$5,'VENDIDO','NOTA','AUTORIZADA',false,true,true,10,10,0,0,30,current_date+30) RETURNING id`,
    [12000 + i, key, site, customer, admin.id])).rows[0].id;
    await pool.query(`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
      VALUES ('VENTA_CREDITO',$1,'OPERACION_CREDITO_SIN_DINERO',$2,'{"ensayo":"no monetario"}')`, [key, admin.id]);
    const movement = (await pool.query(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,
      naturaleza,sitio_origen_id,operacion_productor,operacion_clave)
      VALUES ($1,$2,'VENTA_CREDITO',10,$3,'OPERACION_CREDITO_SIN_DINERO',$4,'VENTA_CREDITO',$5) RETURNING id`,
    [customer, ticket, admin.id, site, key])).rows[0].id;
    notes.push({ id: ticket, movement });
  }
  const receive = () => db.transaction(async tx => {
    const repo = e5Repository(tx, deps), context = await repo.context(customer, site, actor);
    return e5Command(repo, actor, "RECIBIR", { claveOperacion: randomUUID(), clienteId: customer, ubicacionId: site,
      versionContexto: context.versionContexto, entrada: "CLIENTE", importe: "10.00", formaPago: "TRANSFERENCIA",
      cuentaDestino: "CUENTA_FISCAL", notasIndicadas: [notes[0].id], evidencia: evidence });
  });
  let detail = await receive();
  assert.equal(detail.importePendiente, "10.00");
  assert.equal(e5Capabilities(actor, detail).puedeDevolver, false);
  const command = (action: any, input: any) => db.transaction(async tx => {
    const repo = e5Repository(tx, deps), context = await repo.context(customer, site, actor);
    return e5Command(repo, actor, action, { claveOperacion: randomUUID(), revisionEsperada: detail.revision,
      versionContexto: context.versionContexto, ...input }, detail.id);
  });
  const allocations = [{ notaId: notes[0].id, movimientoVentaId: notes[0].movement, importe: "10.00" }];
  await assert.rejects(command("PROPONER", { asignaciones: [{ notaId: notes[1].id,
    movimientoVentaId: notes[1].movement, importe: "10.00" }], evidencia: evidence }), /destino indicado/);
  detail = await command("PROPONER", { asignaciones: allocations, evidencia: evidence });
  detail = await db.transaction(tx => e5Command(e5Repository(tx, deps), actor, "RECHAZAR",
    { claveOperacion: randomUUID(), revisionEsperada: detail.revision, propuestaId: detail.propuestaVigenteId, motivo: "Ensayo rechazo" }, detail.id));
  assert.equal(detail.importePendiente, "10.00");
  assert.equal(detail.propuestaVigenteId, undefined);
  detail = await command("PROPONER", { asignaciones: allocations, evidencia: evidence });
  detail = await command("AUTORIZAR", { propuestaId: detail.propuestaVigenteId,
    asignaciones: [{ ...allocations[0], importe: "4.00" }], evidencia: evidence });
  assert.equal(detail.importePendiente, "6.00");
  assert.equal(detail.importeAplicado, "4.00");
  await assert.rejects(db.transaction(tx => e5Command(e5Repository(tx, deps), actor, "DEVOLVER", {}, detail.id)), /permanece cerrada/);
  const physical = (await pool.query("SELECT count(*)::int n FROM e5_recepciones")).rows[0].n;
  assert.equal(physical, 1);
  console.log("E5_REAL_PG_RECEIVE_REJECT_REPROPOSE_PARTIAL_PASS; exact physical receipt count 1");

  // Only the two CONTADOR synthetic actors explicitly authorized for isolated T6.
  const counters = (await pool.query(`INSERT INTO usuarios(usuario,nombre,password_hash,rol)
    VALUES ('night_f','ContadorF disposable',crypt(gen_random_uuid()::text,gen_salt('bf')),'CONTADOR'),
      ('night_a','ContadorA disposable',crypt(gen_random_uuid()::text,gen_salt('bf')),'CONTADOR')
    RETURNING id,usuario`)).rows;
  const fid = counters.find(c => c.usuario === "night_f").id, aid = counters.find(c => c.usuario === "night_a").id;
  const f = await db.transaction(tx => e11Identity(tx, fid));
  assert.equal(f.perfil, "F");
  await db.transaction(async tx => e11AssignProfile(tx, await e11Identity(tx, admin.id), aid, {
    uuid: randomUUID(), revisionEsperada: 0, perfil: "A", motivo: "Sólo ensayo T6 desechable" }));
  const a = await db.transaction(tx => e11Identity(tx, aid));
  assert.equal(a.perfil, "A");
  assert.throws(() => e11Capability(f, "E5_PREPARAR"));
  assert.throws(() => e11Capability(a, "FISCAL_CONCILIAR"));
  const prepared = await db.transaction(async tx => {
    const ctx = await e5Repository(tx, deps).context(customer, site, actor);
    return e11Prepare(tx, a, detail.id, { uuid: randomUUID(), perfilVersion: a.perfilVersion,
      revisionEsperada: detail.revision, fuenteRevision: ctx.versionContexto,
      asignaciones: [{ ...allocations[0], importe: "6.00" }] }, "127.0.0.1");
  }, { isolationLevel: "serializable" });
  assert.ok(prepared);
  assert.equal((await pool.query("SELECT count(*)::int n FROM e5_aplicaciones")).rows[0].n, 1, "A preparation must not apply");
  const aActor: E5Actor = { ...actor, id: aid, rol: "CONTADOR", capacidadAE11: true, e11PerfilVersion: a.perfilVersion };
  await assert.rejects(db.transaction(tx => e5Command(e5Repository(tx, deps), aActor, "AUTORIZAR", {}, detail.id)), /no autorizada/);
  detail = (await db.transaction(tx => e5Repository(tx, deps).load(detail.id, actor)))!;
  detail = await command("AUTORIZAR", { propuestaId: detail.propuestaVigenteId,
    asignaciones: [{ ...allocations[0], importe: "6.00" }], evidencia: evidence });
  assert.equal(detail.importePendiente, "0.00");
  assert.equal(detail.importeAplicado, "10.00");
  assert.equal((await pool.query("SELECT count(*)::int n FROM e5_recepciones")).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM e5_aplicaciones")).rows[0].n, 2);
  console.log("E5_ADMIN_COMPLETES_A_PROPOSAL_WITHOUT_SECOND_RECEIPT_PASS");
  assert.equal((await db.transaction(tx => e11FiscalSales(tx))).items.length, 0, "unbilled notes excluded");
  assert.equal((await db.transaction(tx => e11FiscalClients(tx))).length, 0, "unbilled client excluded");
  // Authorized synthetic fiscal source in this disposable, not an app invoice.
  await pool.query(`INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,cliente_id,usuario_terminal_id,
    estado,documento_tipo,facturado,credito,cobrado,total,subtotal,iva,tasa_iva,cobrado_at)
    VALUES(12500,$1,$2,$3,$4,'VENDIDO','TICKET',true,false,true,15.50,15.50,0,0,'2026-08-03T18:00:00Z')`,
    [randomUUID(), site, customer, admin.id]);
  const fiscal = await db.transaction(tx => e11FiscalSales(tx));
  assert.equal(fiscal.items.length, 1, "only facturado enters fiscal source");
  assert.equal(fiscal.totalFacturado, "15.50");
  assert.equal(/limiteCredito|saldo|telefono|correo/.test(JSON.stringify(fiscal)), false);
  for (const tipo of ["DIA", "SEMANA", "MES"] as const) {
    const inicio = tipo === "MES" ? "2026-08-01" : "2026-08-03";
    const period = e11Period(tipo, inicio, new Date());
    const snapshot = await db.transaction(async tx => {
      const sales = await e11FiscalSales(tx, period.inicio, period.finExclusivo);
      return e11CreateSnapshot(tx, f, { uuid: randomUUID(), perfilVersion: f.perfilVersion,
        tipo, inicio, fuenteRevision: sales.fuenteRevision, revisionAnteriorId: null });
    }, { isolationLevel: "serializable" });
    assert.equal(period.obligatorio, tipo !== "DIA");
    assert.equal(snapshot.cantidadVentas, 1);
    assert.equal(snapshot.totalFacturado, "15.50");
    await db.transaction(tx => e11DecideSnapshot(tx, f, snapshot.id, {
      uuid: randomUUID(), perfilVersion: f.perfilVersion, resultado: tipo === "MES" ? "NO_CUADRA" : "ACEPTADA",
      revisionEsperada: snapshot.revision, fuenteRevision: snapshot.fuenteRevision,
      totalExterno: tipo === "MES" ? "1.00" : "15.50",
      referenciaExterna: "Registro sintético de ensayo", observacion: "Ensayo fiscal" }), { isolationLevel: "serializable" });
  }
  assert.equal((await pool.query("SELECT count(*)::int n FROM notificaciones_sistema WHERE tipo='E11_NO_CUADRA'")).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM e5_devoluciones")).rows[0].n, 0);
  console.log("E11_REAL_PG_DEFAULT_F_EXPLICIT_A_PREPARE_ONLY_PERIODS_ADMIN_ALERT_PASS");
} finally { await pool.end(); }