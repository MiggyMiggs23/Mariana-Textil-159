import assert from "node:assert/strict";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;
const expectedDatabase = "parte6_credit_test_20260827";

test("aplicaciones_credito is append-only and only links customer ABONOs to sales", async (t) => {
  if (!testDatabaseUrl) {
    t.skip("TEST_DATABASE_URL no está configurada; integración PostgreSQL omitida.");
    return;
  }
  if (testDatabaseUrl === applicationDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  }
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  try {
    // This guard deliberately runs on the same connection that will write.
    const database = await client.query<{ current_database: string }>(
      "SELECT current_database()",
    );
    if (database.rows[0]?.current_database !== expectedDatabase) {
      throw new Error("La integración se negó a escribir fuera de la base temporal autorizada.");
    }
    await client.query("BEGIN");
    const write = async (
      text: string,
      values: unknown[] = [],
    ) => {
      // Compare against the process value captured before @workspace/db's
      // test-only connection guard intentionally swaps DATABASE_URL.
      if (testDatabaseUrl === applicationDatabaseUrl) {
        throw new Error("TEST_DATABASE_URL dejó de ser distinta de DATABASE_URL.");
      }
      const guard = await client.query<{ current_database: string }>(
        "SELECT current_database()",
      );
      if (guard.rows[0]?.current_database !== expectedDatabase) {
        throw new Error("La integración se negó a escribir fuera de la base temporal autorizada.");
      }
      return client.query(text, values);
    };
    const seed = await client.query<{ cliente_id: number; usuario_id: number }>(`
      SELECT c.id AS cliente_id, u.id AS usuario_id
      FROM clientes c CROSS JOIN usuarios u
      WHERE c.activo AND NOT c.es_sistema AND u.activo
      LIMIT 1
    `);
    if (!seed.rows[0]) {
      t.skip("La base temporal no contiene cliente y usuario activos para la prueba.");
      return;
    }
    const { cliente_id: clienteId, usuario_id: usuarioId } = seed.rows[0];
    const sale = async (amount: string) =>
      (await write(
        `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,forma_pago)
         VALUES($1,'VENTA_CREDITO',$2,$3,'CREDITO') RETURNING id`,
        [clienteId, amount, usuarioId],
      )).rows[0]!.id;
    const saleOne = await sale("42.00");
    const saleTwo = await sale("35.00");
    const abono = (await write(
      `INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino)
       VALUES($1,'ABONO','-100.00',$2,'TRANSFERENCIA','CUENTA_FISCAL') RETURNING id`,
      [clienteId, usuarioId],
    )).rows[0]!.id;
    await write(
      `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
       VALUES($1,$2,'42.00'),($1,$3,'35.00')`,
      [abono, saleOne, saleTwo],
    );
    const assigned = await client.query<{ total: string }>(
      `SELECT SUM(importe)::text AS total FROM aplicaciones_credito WHERE abono_movimiento_id=$1`,
      [abono],
    );
    assert.equal(assigned.rows[0]?.total, "77.00");
    // 23.00 remains as negative-ledger credit, available to a subsequent sale.
    assert.equal(100 - Number(assigned.rows[0]?.total), 23);
    await assert.rejects(
      () => write(
        `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
         VALUES($1,$2,'0')`,
        [abono, saleOne],
      ),
    );
    await assert.rejects(
      () => write(
        `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
         VALUES($1,$2,'1.00')`,
        [saleOne, saleTwo],
      ),
    );
    await assert.rejects(
      () => write("UPDATE aplicaciones_credito SET importe='1.00' WHERE abono_movimiento_id=$1", [abono]),
    );
    await assert.rejects(
      () => write("DELETE FROM aplicaciones_credito WHERE abono_movimiento_id=$1", [abono]),
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});