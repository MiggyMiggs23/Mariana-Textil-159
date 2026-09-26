// Opt-in disposable-schema PostgreSQL regression. Never imports application DB initializers.
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { createE11Runtime } from "./e11-runtime";
import { e11Execute, e11FinanceClient, e11FinanceClients, e11Identity } from "./e11-repository";
import * as aging from "./credit-aging-read-model";
import { e11Hash } from "./e11";

const approved = process.env.E11_STABILITY_PG_APPROVED === "fresh-disposable-after-main-stop";
const connectionString = process.env.TEST_DATABASE_URL;
const databaseName = process.env.E11_STABILITY_TEST_DATABASE;
const dialect = new PgDialect();
const flags = { enabled: true, profiles: true, reconciliation: true, preparation: true,
  e5Enabled: true, e5ContadorA: true };

test("real PG: canonical bulk parity, lock compatibility, rolled-back read retry, revocation", {
  skip: !approved,
}, async t => {
  assert.ok(connectionString && databaseName, "MAIN must supply explicit fresh disposable target");
  const target = new URL(connectionString);
  assert.equal(decodeURIComponent(target.pathname.slice(1)), databaseName);
  assert.match(databaseName, /(?:test|disposable|stability)|^priority_(?:fiscal_)?20260926$/i);
  if (process.env.DATABASE_URL) assert.notEqual(target.href, new URL(process.env.DATABASE_URL).href);
  const schema = `e11_stability_${randomUUID().replaceAll("-", "")}`;
  const control = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  assert.equal((await control.query("SELECT current_database() AS name")).rows[0].name, databaseName);
  await control.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000,
    options: `-c search_path=${schema} -c statement_timeout=5000 -c lock_timeout=1000` });
  const db = drizzle(pool);
  const session = randomUUID();
  try {
    await pool.query(`
      CREATE TABLE usuarios(id int PRIMARY KEY, rol text, activo boolean);
      CREATE TABLE sesiones(id uuid PRIMARY KEY, usuario_id int, expira_at timestamptz, created_at timestamptz);
      CREATE TABLE e11_perfiles(usuario_id int PRIMARY KEY, perfil text, version int);
      CREATE TABLE clientes(id int PRIMARY KEY,nombre text,telefono text,correo text,limite_credito numeric(14,2),es_sistema boolean);
      CREATE TABLE tickets(id int PRIMARY KEY,folio int);
      CREATE TABLE movimientos_credito(id int PRIMARY KEY,cliente_id int,ticket_id int,movimiento_origen_id int,
        tipo text,importe numeric(14,2),created_at timestamptz,fecha_vencimiento date,dias_plazo int,notas text,metadata text);
      CREATE TABLE solicitudes_pago_dirigido(tipo text,estado text,movimiento_id int,documento_movimiento_id int);
      CREATE TABLE aplicaciones_credito(id int PRIMARY KEY,abono_movimiento_id int,venta_movimiento_id int,importe numeric(14,2));
      INSERT INTO usuarios VALUES(7,'CONTADOR',true);
      INSERT INTO e11_perfiles VALUES(7,'A',1);
      INSERT INTO clientes SELECT id,'Synthetic '||id,NULL,NULL,1000,false FROM generate_series(2,101) id;
      INSERT INTO movimientos_credito VALUES
        (1,2,NULL,NULL,'VENTA_CREDITO',100,now()-interval '2 days',current_date,0,NULL,NULL),
        (2,2,NULL,NULL,'ABONO',-30,now()-interval '1 day',NULL,NULL,NULL,NULL);
    `);
    await pool.query("INSERT INTO sesiones VALUES($1,7,now()+interval '8 hours',now())", [session]);
    const runtime = createE11Runtime({ flags,
      ledger: (tx, id) => aging.loadCustomerCreditLedgerInTransaction(id, tx),
      projections: (tx, ids) => aging.loadCustomerCreditProjectionsInTransaction(ids, tx),
      transaction: (work, options) => db.transaction(tx => work(tx), options),
    });
    await t.test("directory exactly matches all canonical individual DTOs; two queries", async () => {
      await runtime.run(() => db.transaction(async tx => {
        let queries = 0;
        const counting = { execute: async (query: any) => { queries++; return tx.execute(query); } };
        const result = await e11FinanceClients(counting);
        assert.equal(queries, 2);
        const expected = [];
        for (let id = 2; id <= 101; id++) expected.push((await e11FinanceClient(tx, id)).cliente);
        assert.deepEqual(result, expected);
        assert.equal(e11Hash(result), e11Hash(expected));
        assert.equal(result[0].saldo, "70.00");
      }));
    });
    await t.test("identity row lock permits renewal but blocks logout deletion", async () => {
      let release!: () => void, ready!: () => void;
      const held = new Promise<void>(r => { release = r; });
      const acquired = new Promise<void>(r => { ready = r; });
      const holder = runtime.run(() => db.transaction(async tx => {
        await e11Identity(tx, 7, session); ready(); await held;
      }));
      await acquired;
      try {
        await pool.query("UPDATE sesiones SET expira_at=expira_at+interval '1 second' WHERE id=$1", [session]);
        await assert.rejects(() => pool.query("DELETE FROM sesiones WHERE id=$1", [session]),
          (error: any) => error.code === "55P03");
      } finally { release(); await holder; }
    });
    await t.test("deterministic real 40001 restarts full read after rollback, delivers once", async () => {
      let injected = false, conflicts = 0, delivered = 0, transactions = 0;
      const retryRuntime = createE11Runtime({ flags, transaction: async (work, options) => {
        transactions++;
        try {
          return await db.transaction(async tx => {
            const intercepted = { execute: async (query: any) => {
              const text = dialect.sqlToQuery(query).sql;
              if (!injected && options?.isolationLevel === "serializable" && text.includes("FROM usuarios")) {
                injected = true;
                // The preceding advisory-lock SELECT established the snapshot.
                // User FOR SHARE is intentionally retained; force its real 40001
                // with a committed concurrent version (no identity value change).
                await pool.query("UPDATE usuarios SET activo=activo WHERE id=7");
              }
              return tx.execute(query);
            } };
            return work(intercepted);
          }, options);
        } catch (error: any) {
          if ((error.code ?? error.cause?.code) === "40001") conflicts++;
          throw error; // Drizzle has already awaited ROLLBACK before this catch.
        }
      } });
      await retryRuntime.run(() => e11Execute({ userId: 7, sessionId: session, capability: "FINANZAS_LIMITADAS_LEER",
        readOnly: true, work: async () => "safe", parse: String, deliver: () => { delivered++; } }));
      assert.equal(conflicts, 1); assert.equal(transactions, 3); assert.equal(delivered, 1);
    });
    await t.test("deleted session cannot be reauthorized", async () => {
      await pool.query("DELETE FROM sesiones WHERE id=$1", [session]);
      await assert.rejects(() => runtime.run(() => db.transaction(tx => e11Identity(tx, 7, session))),
        (error: any) => error.code === "NO_AUTENTICADO");
    });
    assert.equal(pool.waitingCount, 0);
  } finally {
    await pool.end();
    await control.query(`DROP SCHEMA "${schema}" CASCADE`);
    await control.end();
  }
});