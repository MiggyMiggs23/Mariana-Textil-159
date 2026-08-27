import assert from "node:assert/strict";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;

test("aplicaciones_credito is append-only and only links customer ABONOs to sales", async (t) => {
  if (!testDatabaseUrl) {
    t.skip("TEST_DATABASE_URL no está configurada; integración PostgreSQL omitida.");
    return;
  }
  if (testDatabaseUrl === applicationDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  }
  const { pool } = await import("@workspace/db");
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const client = await pool.connect();
  try {
    const { assertIsolated } = await createTestDatabaseGuard(
      client,
      testDatabaseUrl,
      applicationDatabaseUrl,
    );
    await assertIsolated();
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
      await assertIsolated();
      return client.query(text, values);
    };
    let savepointSequence = 0;
    const expectWriteRejects = async (text: string, values: unknown[] = []) => {
      const savepoint = `credito_rechazado_${++savepointSequence}`;
      await write(`SAVEPOINT ${savepoint}`);
      await assert.rejects(() => write(text, values));
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await write(`RELEASE SAVEPOINT ${savepoint}`);
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
    await expectWriteRejects(
        `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
         VALUES($1,$2,'0')`,
        [abono, saleOne],
    );
    await expectWriteRejects(
        `INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
         VALUES($1,$2,'1.00')`,
        [saleOne, saleTwo],
    );
    await expectWriteRejects(
      "UPDATE aplicaciones_credito SET importe='1.00' WHERE abono_movimiento_id=$1",
      [abono],
    );
    await expectWriteRejects(
      "DELETE FROM aplicaciones_credito WHERE abono_movimiento_id=$1",
      [abono],
    );
    await write(
      `INSERT INTO movimientos_credito
         (cliente_id,tipo,importe,movimiento_origen_id,usuario_id)
       VALUES($1,'REVERSO','100.00',$2,$3)`,
      [clienteId, abono, usuarioId],
    );
    const saleAfterReverse = await sale("23.00");
    const availableAfterReverse = await client.query<{ disponible: string }>(
      `SELECT COALESCE(SUM(-ab.importe-COALESCE(used.total,0)),0)::text disponible
       FROM movimientos_credito ab
       LEFT JOIN LATERAL (
         SELECT SUM(a.importe) total FROM aplicaciones_credito a
         WHERE a.abono_movimiento_id=ab.id
       ) used ON true
       WHERE ab.cliente_id=$1 AND ab.tipo='ABONO'
         AND NOT EXISTS (SELECT 1 FROM movimientos_credito r
           WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=ab.id)`,
      [clienteId],
    );
    assert.equal(availableAfterReverse.rows[0]?.disponible, "0");
    await expectWriteRejects(
      `INSERT INTO aplicaciones_credito
         (abono_movimiento_id,venta_movimiento_id,importe)
       VALUES($1,$2,'23.00')`,
      [abono, saleAfterReverse],
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});