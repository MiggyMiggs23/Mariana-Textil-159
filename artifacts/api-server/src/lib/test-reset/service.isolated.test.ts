import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { CLEARED_TABLES, COUNTER_TABLES, PRESERVED_TABLES } from "./manifest";
import { inspectResetSchema, resetTestData } from "./service";
import { ensureDocumentFoliosSchema } from "../../../../../lib/db/src/lib/document-folios-schema";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";
import { e11AssignProfile, e11Identity } from "../e11-repository";
import { crearEntrada } from "../inventario";
import { crearTicket } from "../pos";

test("real PostgreSQL disposable reset: preservation, deletion, counters, rollback and relogin", { timeout: 120_000 }, async t => {
  // Never connect to the parent's DATABASE_URL. A private Unix socket + initdb
  // cluster makes accidentally reaching the app's database impossible.
  const root = mkdtempSync(join(tmpdir(), "test-reset-isolated-"));
  const data = join(root, "pgdata");
  execFileSync("initdb", ["-D", data, "-A", "trust", "-U", "reset_tester"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -h '' -p 25439`, "-w", "start"], { stdio: "pipe" });
  const pool = new pg.Pool({ host: root, port: 25439, user: "reset_tester", database: "postgres" });
  try {
    // Full schema-only capture: all installed functions, views, FKs and guards.
    // No CREATE TABLE extraction and no copy of application/business rows.
    const fullSchema = process.env.TEST_RESET_SCHEMA_FILE
      ?? resolve(import.meta.dirname, "../../../../../reports/test-reset-20260925/schema-only.sql");
    await pool.query(readFileSync(fullSchema, "utf8").replace(/^\\.*$/gm, ""));
    await pool.query("SET search_path=public,pg_catalog");
    const tables = await inspectResetSchema(pool);
    await pool.query(`INSERT INTO ubicaciones(id,nombre,iniciales,tipo) VALUES(1,'Mariana','MA','TIENDA');
      INSERT INTO usuarios(id,nombre,usuario,password_hash,rol,ubicacion_id)
      VALUES(1,'Admin sintético','test-admin','not-a-login-secret','ADMIN',1),(2,'Caja sintética','test-caja','not-a-login-secret','CAJA',1);
      INSERT INTO proveedores(id,nombre,tipo) VALUES(1,'Proveedor sintético','NACIONAL');
      INSERT INTO productos(id,sku,tela,color,unidad,precio_sugerido,precio_mayoreo,precio_menudeo) VALUES(1,'TEST-0001','Tela prueba','Azul','METRO',17,17,17);
      INSERT INTO clientes(id,nombre,es_sistema) VALUES(1,'Cliente interno',true),(2,'Cliente prueba',false);
      INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES('00000000-0000-4000-8000-000000000001',1,now()+interval '1 hour','local','test'),('00000000-0000-4000-8000-000000000002',2,now()+interval '1 hour','local','test');
      INSERT INTO ticket_folio(id,ultimo_folio) VALUES(1,1099);
      INSERT INTO series_consecutivo(id,ultimo_numero) VALUES(1,12345678);
      INSERT INTO precio_historial(producto_id,precio_lista_anterior,precio_lista_nuevo,motivo,usuario_id)
      VALUES(1,10,17,'Prueba sintética',1);`);
    await pool.query(`INSERT INTO entradas(id,fecha,folio,total_rollos,ubicacion_id,usuario_id,uuid_cliente)
      VALUES(1,now(),4,1,1,1,'00000000-0000-4000-8000-000000000010');
      INSERT INTO rollos(id,producto_id,serie,cantidad_actual,cantidad_inicial,ubicacion_id,estado,recepcion_id)
      VALUES(1,1,'12345678',5,5,1,'DISPONIBLE',1);
      INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES(1,1,5,1);
      INSERT INTO sesiones_caja(id,ubicacion_id,usuario_id,fecha_operativa,fondo_inicial) VALUES(1,1,2,current_date,50);
      INSERT INTO tickets(id,cliente_id,folio,subtotal,total,ubicacion_id,usuario_terminal_id,uuid_cliente)
      VALUES(1,2,1000,17,17,1,1,'00000000-0000-4000-8000-000000000011');
      INSERT INTO fondo_mariana(ubicacion_id) VALUES(1);`);
    const database = drizzle(pool, { schema });
    if (fullSchema) {
      await pool.query(`INSERT INTO usuarios(id,nombre,usuario,password_hash,rol)
        VALUES(3,'Contador sintético','test-contador','not-a-login-secret','CONTADOR')`);
      await database.transaction(async tx => {
        const actor = await e11Identity(tx, 1);
        await e11AssignProfile(tx, actor, 3, { uuid: "00000000-0000-4000-8000-000000000020", perfil: "A", revisionEsperada: 0, motivo: "Prueba de conservación" });
      });
    }
    await pool.query(`INSERT INTO fondo_movimientos(fondo_id,naturaleza,categoria,importe_centavos,motivo,autor_id,idempotency_key,idempotency_producer,payload_hash,conciliacion_inicial)
      SELECT id,'INGRESO','SALDO_INICIAL',5000,'saldo inicial',1,
      '00000000-0000-4000-8000-000000000040','FONDO_API_MOVIMIENTO_V1',repeat('a',64),
      '{"efectivoFisicoContado":"50.00","declaracionSinDuplicacion":true,"evidencia":"Prueba sintética"}'::jsonb FROM fondo_mariana;`);
    const before = new Map<string, unknown>();
    for (const name of PRESERVED_TABLES.filter(name => tables.includes(name))) {
      before.set(name, (await pool.query(`SELECT to_jsonb(t) AS row FROM "${name}" t ORDER BY to_jsonb(t)::text`)).rows);
    }
    const profileOperations = (await pool.query("SELECT to_jsonb(t) AS row FROM e11_operaciones t WHERE operacion='PERFIL' ORDER BY to_jsonb(t)::text")).rows;
    const profileResolutions = (await pool.query("SELECT to_jsonb(t) AS row FROM e11_resoluciones t WHERE accion='PERFIL' ORDER BY to_jsonb(t)::text")).rows;
    const input = { actorId: 1, sessionId: "00000000-0000-4000-8000-000000000001", confirmation: "BORRAR" };
    await assert.rejects(resetTestData(pool, input, { enabled: false }), /deshabilitado/);
    await assert.rejects(resetTestData(pool, { ...input, confirmation: "borrar" }, { enabled: true }), /BORRAR/);
    await assert.rejects(resetTestData(pool, { ...input, actorId: 2, sessionId: "00000000-0000-4000-8000-000000000002" }, { enabled: true }), /ADMIN/);
    await pool.query("CREATE TABLE unclassified_probe(id integer)");
    await assert.rejects(resetTestData(pool, input, { enabled: true }), /unclassified_probe/);
    await pool.query("DROP TABLE unclassified_probe");
    const triggerBefore = (await pool.query("SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname")).rows;
    const result = await resetTestData(pool, input, { enabled: true, protectCustomers: false });
    assert.equal(result.requiresLogin, true);
    assert.match(result.message, /Vuelve a iniciar sesión/);
    for (const name of CLEARED_TABLES.filter(name => tables.includes(name))) {
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "${name}"`)).rows[0].n, 0, name);
    }
    for (const [name, rows] of before) {
      assert.deepEqual((await pool.query(`SELECT to_jsonb(t) AS row FROM "${name}" t ORDER BY to_jsonb(t)::text`)).rows, rows, name);
    }
    assert.deepEqual((await pool.query("SELECT id FROM clientes ORDER BY id")).rows, [{ id: 1 }]);
    assert.deepEqual((await pool.query("SELECT operacion FROM e11_operaciones")).rows, [{ operacion: "PERFIL" }]);
    assert.deepEqual((await pool.query("SELECT to_jsonb(t) AS row FROM e11_operaciones t WHERE operacion='PERFIL' ORDER BY to_jsonb(t)::text")).rows, profileOperations);
    assert.deepEqual((await pool.query("SELECT to_jsonb(t) AS row FROM e11_resoluciones t WHERE accion='PERFIL' ORDER BY to_jsonb(t)::text")).rows, profileResolutions);
    await ensureDocumentFoliosSchema(pool);
    for (const name of COUNTER_TABLES.filter(name => tables.includes(name) && name !== "series_consecutivo")) {
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "${name}" WHERE ultimo_folio<>0`)).rows[0].n, 0, name);
    }
    assert.equal((await pool.query("SELECT ultimo_numero FROM series_consecutivo WHERE id=1")).rows[0].ultimo_numero, 10000000);
    assert.equal((await pool.query("SELECT ultimo_folio FROM ticket_folio WHERE id=1")).rows[0].ultimo_folio, 0);
    // Actual production services, not direct INSERTs or counter simulation.
    const freshEntry = await database.transaction(tx => crearEntrada(tx, {
      ubicacionId: 1, proveedorId: 1, usuarioId: 1, ip: "isolated-test",
      uuidCliente: "00000000-0000-4000-8000-000000000030",
      lineas: [{ productoId: 1, costoUnitario: "10", cantidades: ["2"] }],
    }));
    assert.equal(freshEntry.folio, 1);
    assert.equal(freshEntry.rollos[0].serie, "10000001");
    const freshTicket = await database.transaction(tx => crearTicket(tx, {
      ubicacionId: 1, usuarioTerminalId: 1, clienteId: 1, facturado: false,
      uuidCliente: "00000000-0000-4000-8000-000000000031", ip: "isolated-test",
      lineas: [{ rolloId: freshEntry.rollos[0].id, productoId: 1, tipo: "NORMAL", cantidad: "2", precioUnitario: "17" }],
    }, true));
    assert.ok(freshTicket);
    assert.equal(freshTicket.folio, 1);
    assert.deepEqual((await pool.query("SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgname<>'test_reset_history_immutable' ORDER BY tgname")).rows, triggerBefore);
    assert.equal((await pool.query("SELECT actor_id FROM test_reset_history")).rows[0].actor_id, 1);
    await assert.rejects(pool.query("TRUNCATE test_reset_history"), /no admite/);
    await assert.rejects(resetTestData(pool, input, { enabled: true }), /sesión ADMIN/);
    // New login works against the same preserved user, with new test data.
    await pool.query("INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES('00000000-0000-4000-8000-000000000001',1,now()+interval '1 hour','local','test')");
    await pool.query("INSERT INTO clientes(id,nombre,telefono,notas,dias_credito,limite_credito,saldo_credito) VALUES(3,'Cliente real protegido','123456','Conservar',30,900,123)");
    const customerProfiles = (await pool.query("SELECT to_jsonb(c)-'saldo_credito' AS row FROM clientes c ORDER BY id")).rows;
    await resetTestData(pool, input, { enabled: true, protectCustomers: true });
    assert.deepEqual((await pool.query("SELECT id FROM clientes ORDER BY id")).rows, [{ id: 1 }, { id: 3 }]);
    assert.deepEqual((await pool.query("SELECT to_jsonb(c)-'saldo_credito' AS row FROM clientes c ORDER BY id")).rows, customerProfiles);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM clientes WHERE saldo_credito<>0")).rows[0].n, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM test_reset_history")).rows[0].n, 2);
    // Failure AFTER truncation must roll back operations, sessions and guards.
    await pool.query("INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES('00000000-0000-4000-8000-000000000001',1,now()+interval '1 hour','local','test')");
    await database.transaction(tx => crearEntrada(tx, {
      ubicacionId: 1, proveedorId: 1, usuarioId: 1, ip: "isolated-test",
      uuidCliente: "00000000-0000-4000-8000-000000000032",
      lineas: [{ productoId: 1, costoUnitario: "10", cantidades: ["1"] }],
    }));
    await pool.query("ALTER TABLE test_reset_history ADD CONSTRAINT fail_rollback CHECK (actor_id<>1) NOT VALID");
    await assert.rejects(resetTestData(pool, input, { enabled: true }), /fail_rollback/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM sesiones")).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM entradas")).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM rollos")).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM clientes")).rows[0].n, 2);
    assert.deepEqual((await pool.query("SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgname<>'test_reset_history_immutable' ORDER BY tgname")).rows, triggerBefore);
    if (fullSchema) {
      await pool.query("ALTER TABLE test_reset_history DROP CONSTRAINT fail_rollback");
      const output = execFileSync(process.execPath, ["--import", "tsx", resolve(import.meta.dirname, "http-proof.fixture.ts")], {
        timeout: 60_000,
        env: {
          PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "development", LOG_LEVEL: "silent",
          RESET_TEST_SOCKET: root,
          DATABASE_URL: `postgresql://reset_tester@localhost:25439/postgres?host=${encodeURIComponent(root)}`,
        }, encoding: "utf8",
      });
      t.diagnostic(output.trim());
    }
    t.diagnostic(`Verified ${tables.length} classified tables, ${clearedCount(tables)} cleared tables, protected-row snapshots, restored guards, post-startup zero counters, new entry/roll/ticket, two resets, customer protection and forced rollback.`);
  } finally {
    await pool.end();
    execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(root, { recursive: true, force: true });
  }
});

function clearedCount(tables: string[]) {
  return CLEARED_TABLES.filter(name => tables.includes(name)).length;
}