import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { baselineE1E2 } from "../trabajo-nocturno-20260925/tarea-1/baseline-e1-e2.mjs";

// Same canonical financial installation used by rehearse-producers.mjs.
// The release migrations retire construction closures, NOT integrity guards.
// No DISABLE TRIGGER, replication-role changes, guard bypass or source imports.
export async function installFinancialSchema(pool, provenance) {
  const released = JSON.parse(fs.readFileSync("reports/trabajo-nocturno-20260925/tarea-1/apply-task1-operator-result.json"));
  assert.equal(released.status, "COMMITTED");
  assert.equal((await pool.query("SELECT to_regclass('public.e5_cobros') t")).rows[0].t, null,
    "Only install on a fresh canonical disposable; never reinstall existing E5");
  await pool.query("ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS e2_insert_xid xid8; ALTER TABLE cobros_credito_pendientes_e1 ADD COLUMN IF NOT EXISTS e2_insert_xid xid8");
  await pool.query(baselineE1E2());
  const files = [
    "reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
    "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql",
    ...[1, 2, 3, 4].map(n => `reports/tanda-b-b0-b1-20260923/r5/sql/${n}.sql`),
    "reports/trabajo-nocturno-20260925/tarea-2/historical-pre-e11-graph.sql",
    "reports/e11/01-preparado.sql",
    "reports/trabajo-nocturno-20260925/tarea-1/installed-graph-readonly.sql",
    "reports/trabajo-nocturno-20260925/tarea-1/01-candidate-not-approved.sql",
    "reports/trabajo-nocturno-20260925/tarea-2/00-graph-correction-candidate.sql",
    "reports/trabajo-nocturno-20260925/tarea-2/00b-fiscal-folio-correction-candidate.sql",
    "reports/trabajo-nocturno-20260925/tarea-2/01-candidate-not-approved.sql",
  ];
  for (const file of files) {
    let text = fs.readFileSync(file, "utf8").replace(/^\\set ON_ERROR_STOP on\r?\n/, "");
    provenance.push({ file, sha256: createHash("sha256").update(text).digest("hex") });
    if (file.endsWith("/01-install-prepared.sql"))
      text = "BEGIN;\n" + text.slice(text.indexOf("CREATE FUNCTION public.e3_receipt_immutable()"));
    await pool.query(text);
  }
  const disabled = await pool.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O'");
  assert.deepEqual(disabled.rows, [], "No disabled native guards");
  const refund = await pool.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='e5_closed' AND tgenabled='O'");
  assert.equal(refund.rows[0].n, 2, "Released monetary refund closures retained");
}

export async function prepareActorsAndSource(pool, password) {
  const admin = (await pool.query("SELECT id,usuario FROM usuarios WHERE usuario='admin' AND rol='ADMIN'")).rows[0];
  const site = (await pool.query("SELECT id FROM ubicaciones WHERE nombre='Mariana' AND activa")).rows[0]?.id;
  assert.ok(admin && site);
  const client = (await pool.query("INSERT INTO clientes(nombre,es_sistema,dias_credito,limite_credito) VALUES('Permission nine disposable',false,30,100) RETURNING id")).rows[0].id;
  // Native non-monetary note + E1 operation provenance from positive-producers.mts.
  // E5 receipt itself is produced later through the frozen HTTP API.
  const key = randomUUID();
  const ticket = (await pool.query(`INSERT INTO tickets(folio,uuid_cliente,ubicacion_id,cliente_id,usuario_terminal_id,
    estado,documento_tipo,autorizacion_estado,facturado,credito,cobrado,total,subtotal,iva,tasa_iva,dias_plazo,fecha_vencimiento)
    VALUES(12000,$1,$2,$3,$4,'VENDIDO','NOTA','AUTORIZADA',false,true,true,10,10,0,0,30,current_date+30) RETURNING id`,
  [key, site, client, admin.id])).rows[0].id;
  await pool.query(`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
    VALUES('VENTA_CREDITO',$1,'OPERACION_CREDITO_SIN_DINERO',$2,'{"fixture":"permission-nine-native"}')`, [key, admin.id]);
  const creditMovement = (await pool.query(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id,
    naturaleza,sitio_origen_id,operacion_productor,operacion_clave)
    VALUES($1,$2,'VENTA_CREDITO',10,$3,'OPERACION_CREDITO_SIN_DINERO',$4,'VENTA_CREDITO',$5) RETURNING id`,
  [client, ticket, admin.id, site, key])).rows[0].id;
  const roles = ["TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS", "CONTADOR"];
  const actors = [];
  for (const role of roles) for (const family of ["e5", ...(["TERMINAL", "CAJA", "CONTADOR"].includes(role) ? ["ajustes"] : [])]) {
    for (const variant of family === "e5" ? ["on", "off", "or"] : ["on", "off"]) {
      const username = `nine_${family}_${role.toLowerCase()}_${variant}`;
      const user = (await pool.query(`INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta)
        VALUES($1,$1,crypt($2,gen_salt('bf',10)),$3,$4,'PROPIA') RETURNING id`, [username,password,role,site])).rows[0];
      // Explicit complete matrix: inherited defaults cannot mask the varied cell.
      await pool.query(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
        SELECT $1,modulo,true,false,false,false FROM permisos_rol GROUP BY modulo`, [user.id]);
      await pool.query(`UPDATE permisos_usuario SET puede_ver=false WHERE usuario_id=$1 AND modulo IN ('caja_abonos','clientes_finanzas')`, [user.id]);
      if (family === "e5") await pool.query(`UPDATE permisos_usuario SET puede_ver=true WHERE usuario_id=$1 AND modulo=$2`,
        [user.id, variant === "or" ? "clientes_finanzas" : variant === "on" ? "caja_abonos" : "__none__"]);
      else await pool.query(`UPDATE permisos_usuario SET puede_ver=$2,puede_autorizar=true WHERE usuario_id=$1 AND modulo='ajustes'`, [user.id, variant === "on"]);
      const matrix = (await pool.query(`SELECT modulo,puede_ver,puede_crear,puede_editar,puede_autorizar FROM permisos_usuario WHERE usuario_id=$1 ORDER BY modulo`, [user.id])).rows;
      actors.push({ id:user.id, username, role, family, variant, matrix });
    }
  }
  for (const on of actors.filter(a => a.variant === "on")) {
    const off = actors.find(a => a.family === on.family && a.role === on.role && a.variant === "off");
    const changes = on.matrix.filter((p,i) => JSON.stringify(p) !== JSON.stringify(off.matrix[i]));
    assert.equal(changes.length, 1);
    assert.equal(changes[0].modulo, on.family === "e5" ? "caja_abonos" : "ajustes");
    assert.deepEqual(on.matrix.map(p => ({...p,puede_ver:p.modulo===changes[0].modulo?false:p.puede_ver})),off.matrix);
  }
  // Consistent native stock ledger fixture for the adjustment dependent readers.
  const product = (await pool.query("INSERT INTO productos(sku,tela,color,unidad) VALUES('NINE-RUNTIME','Disposable fabric','Azul','METRO') RETURNING id")).rows[0].id;
  const roll = (await pool.query("INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual) VALUES('990000001',$1,$2,'DISPONIBLE',10,10) RETURNING id", [product,site])).rows[0].id;
  const movement = (await pool.query(`INSERT INTO movimientos(rollo_id,producto_id,ubicacion_id,tipo,cantidad,saldo_posterior,usuario_id,documento_tipo,documento_id)
    VALUES($1,$2,$3,'ALTA',10,10,$4,'FIXTURE','permission-nine-native') RETURNING id`, [roll,product,site,admin.id])).rows[0].id;
  await pool.query("INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,10,1)", [product,site]);
  return { admin, site, client, ticket, creditMovement, actors, product, roll, movement };
}

export async function receiveFrozenFixture(api, fixture) {
  const context = await api("GET", `/api/e5/contexto?clienteId=${fixture.client}&ubicacionId=${fixture.site}`);
  assert.equal(context.status, 200, JSON.stringify(context.body));
  fixture.receiptInput ??= {
    claveOperacion: randomUUID(), clienteId: fixture.client, ubicacionId: fixture.site,
    versionContexto: context.body.versionContexto, entrada: "CLIENTE",
    importe: "10.00", formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL",
    notasIndicadas: [fixture.ticket],
    evidencia: { descripcion:"Recepción sintética nativa aislada", referencias:["permission-nine-runtime"] },
  };
  const result = await api("POST", "/api/e5/cobros", fixture.receiptInput);
  assert.ok([200,201].includes(result.status), JSON.stringify(result));
  assert.equal(result.body.importePendiente, "10.00");
  assert.equal(result.body.clienteId, fixture.client);
  assert.equal(result.body.ubicacionId, fixture.site);
  fixture.cobro = result.body.id;
  assert.ok(fixture.cobro);
  return result;
}