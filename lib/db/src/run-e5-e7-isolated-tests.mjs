import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { DisposablePostgresRunner } from "./run-isolated-tests.mjs";

const isolatedEnvironment = { ...process.env };
for (const name of Object.keys(isolatedEnvironment)) {
  if (/^PG[A-Z0-9_]*$/i.test(name) ||
      ["DATABASE_URL", "APPLICATION_DATABASE_URL", "TEST_DATABASE_URL"].includes(name)) {
    delete isolatedEnvironment[name];
  }
}
const runner = new DisposablePostgresRunner({ parentEnvironment: isolatedEnvironment });
let root;
let passed = false;
try {
  await runner.start();
  root = runner.cluster.rootDirectory;
  await runner.verifyIdentity();
  const client = new pg.Client({ connectionString: runner.testDatabaseUrl });
  await client.connect();
  try {
    const packageFiles = [
      "reports/liberacion-simple-20260923/fixture.sql",
      "reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
      "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql",
      ...[1, 2, 3, 4].map(n => `reports/tanda-b-b0-b1-20260923/r5/sql/${n}.sql`),
    ];
    for (const file of packageFiles) {
      const sql = readFileSync(file, "utf8").replace(/^\\set ON_ERROR_STOP on\r?\n/, "");
      await client.query(sql);
      if (file.endsWith("/fixture.sql")) {
        await client.query(`
          INSERT INTO ubicaciones(id,nombre,iniciales,tipo,activa,created_at)
          VALUES (1,'Mariana disposable','MD','TIENDA',true,now());
          INSERT INTO usuarios(id,usuario,nombre,password_hash,rol,ubicacion_id,activo,alcance_consulta,created_at)
          VALUES (1,'admin','ADMIN disposable','not-a-login','ADMIN',NULL,true,'TODAS',now());
          INSERT INTO clientes(id,nombre,activo,es_sistema,dias_credito,limite_credito,saldo_credito,
            recibe_nota_sin_precios,created_at,updated_at)
          VALUES (1,'Cliente disposable',true,false,0,100,0,false,now(),now());
          INSERT INTO tickets(id,folio,uuid_cliente,ubicacion_id,cliente_id,estado,documento_tipo,
            autorizacion_estado,facturado,credito,created_at,cobrado,total,subtotal,iva,tasa_iva)
          VALUES
            (10,1010,'10000000-0000-4000-8000-000000000010',1,1,'VENDIDO','NOTA',
             'AUTORIZADA',false,true,now(),true,10,10,0,0),
            (11,1011,'10000000-0000-4000-8000-000000000011',1,1,'VENDIDO','NOTA',
             'AUTORIZADA',false,true,now(),true,10,10,0,0);
          INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
          VALUES
            ('VENTA_CREDITO','10000000-0000-4000-8000-000000000010',
             'OPERACION_CREDITO_SIN_DINERO',1,'{}'),
            ('VENTA_CREDITO','10000000-0000-4000-8000-000000000011',
             'OPERACION_CREDITO_SIN_DINERO',1,'{}');
          INSERT INTO movimientos_credito(id,cliente_id,ticket_id,tipo,importe,usuario_id,created_at,
            naturaleza,sitio_origen_id,operacion_productor,operacion_clave)
          VALUES
            (100,1,10,'VENTA_CREDITO',10,1,now(),'OPERACION_CREDITO_SIN_DINERO',1,
             'VENTA_CREDITO','10000000-0000-4000-8000-000000000010'),
            (101,1,11,'VENTA_CREDITO',10,1,now(),'OPERACION_CREDITO_SIN_DINERO',1,
             'VENTA_CREDITO','10000000-0000-4000-8000-000000000011')`);
      }
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS sesiones (
        id uuid PRIMARY KEY,
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        expira_at timestamptz NOT NULL,
        ip text NOT NULL,
        user_agent text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ticket_pagos (
        id integer PRIMARY KEY,
        ticket_id integer NOT NULL REFERENCES tickets(id),
        importe numeric(12,2) NOT NULL,
        forma_pago forma_pago_cuenta NOT NULL
      );
      CREATE SEQUENCE movimientos_credito_disposable_seq START 102 OWNED BY movimientos_credito.id;
      ALTER TABLE movimientos_credito ALTER COLUMN id SET DEFAULT nextval('movimientos_credito_disposable_seq');
      ALTER TABLE movimientos_credito ALTER COLUMN es_incobrable SET DEFAULT false;
      CREATE SEQUENCE solicitudes_pago_dirigido_disposable_seq OWNED BY solicitudes_pago_dirigido.id;
      ALTER TABLE solicitudes_pago_dirigido ALTER COLUMN id SET DEFAULT nextval('solicitudes_pago_dirigido_disposable_seq');
      CREATE SEQUENCE aplicaciones_credito_disposable_seq OWNED BY aplicaciones_credito.id;
      ALTER TABLE aplicaciones_credito ALTER COLUMN id SET DEFAULT nextval('aplicaciones_credito_disposable_seq');
      CREATE SEQUENCE auditoria_disposable_seq OWNED BY auditoria.id;
      ALTER TABLE auditoria ALTER COLUMN id SET DEFAULT nextval('auditoria_disposable_seq')`);
  } finally {
    await client.end();
  }
  const status = await new Promise((resolve, reject) => {
    const child = spawn("pnpm", [
      "--filter", "@workspace/api-server", "exec", "tsx",
      "src/lib/e5-e7.pg.integration.ts",
    ], {
      env: {
        ...runner.childEnvironment(),
        NODE_ENV: "test",
        REQUIRE_ISOLATED_TEST_DATABASE: "1",
        TEST_DATABASE_PREPARATION_PHASE: "initializers",
        E5_DISPOSABLE_LIFECYCLE: "1",
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (status !== 0) throw new Error(`E5/E7 disposable suite exited ${status}`);
  await runner.verifyIdentity();
  await runner.smoke();
  passed = true;
} finally {
  await runner.cleanup();
  if (root && existsSync(root)) throw new Error(`Disposable cluster retained: ${root}`);
}
if (!passed) throw new Error("E5/E7 disposable PostgreSQL verification did not pass");
process.stdout.write("E5_E7_DISPOSABLE_CLUSTER_DESTROYED_PASS\n");