import assert from "node:assert/strict";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;
const expectedDatabase = "parte6_credit_test_20260827";

test("aplicaciones_pago_proveedor valida PAGO→COMPRA, límites y append-only", async (t) => {
  if (!testDatabaseUrl) {
    t.skip("TEST_DATABASE_URL no está configurada; integración PostgreSQL omitida.");
    return;
  }
  if (testDatabaseUrl === applicationDatabaseUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  const guard = async () => {
    if (testDatabaseUrl === applicationDatabaseUrl) throw new Error("TEST_DATABASE_URL dejó de ser distinta de DATABASE_URL.");
    const database = await client.query<{ current_database: string }>("SELECT current_database()");
    if (database.rows[0]?.current_database !== expectedDatabase) {
      throw new Error("La integración se negó a escribir fuera de la base temporal autorizada.");
    }
  };
  const write = async (text: string, values: unknown[] = []) => {
    await guard(); // same connection immediately before every write
    return client.query(text, values);
  };
  let savepointSequence = 0;
  const expectWriteRejects = async (text: string, values: unknown[] = []) => {
    const savepoint = `expected_failure_${++savepointSequence}`;
    await write(`SAVEPOINT ${savepoint}`);
    await assert.rejects(() => write(text, values));
    // PostgreSQL does not permit the identity SELECT while the transaction is
    // aborted, so this control statement restores the savepoint first.
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await write(`RELEASE SAVEPOINT ${savepoint}`);
  };
  try {
    await guard(); // required before BEGIN on this exact writing connection
    await client.query("BEGIN");
    const activeUser = await client.query<{ id: number }>(
      "SELECT id FROM usuarios WHERE activo LIMIT 1",
    );
    let usuarioId = activeUser.rows[0]?.id;
    if (!usuarioId) {
      const admin = await client.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE rol='ADMIN' LIMIT 1",
      );
      usuarioId = admin.rows[0]?.id;
    }
    if (!usuarioId) {
      usuarioId = (await write(
        `INSERT INTO usuarios(nombre,usuario,password_hash,rol,activo,alcance_consulta)
         VALUES('Integración Parte 6','parte6-integracion-' || txid_current()::text,'no-login','ADMIN',true,'TODAS')
         RETURNING id`,
      )).rows[0]!.id as number;
    }
    const proveedorId = (await write(
      `INSERT INTO proveedores(nombre,tipo,moneda_default,activo)
       VALUES('Proveedor temporal integración Parte 6 ' || txid_current()::text,'NACIONAL','MXN',true)
       RETURNING id`,
    )).rows[0]!.id as number;
    const compra = async (amount: string) => (await write(
      `INSERT INTO pagos_proveedor(proveedor_id,tipo,importe,fecha,usuario_id)
       VALUES($1,'COMPRA',$2,now(),$3) RETURNING id`, [proveedorId, amount, usuarioId],
    )).rows[0]!.id as number;
    const compraUno = await compra("42.00");
    const compraDos = await compra("35.00");
    const pago = (await write(
      `INSERT INTO pagos_proveedor(proveedor_id,tipo,importe,forma_pago,fecha,usuario_id)
       VALUES($1,'PAGO','-100.00','TRANSFERENCIA',now(),$2) RETURNING id`, [proveedorId, usuarioId],
    )).rows[0]!.id as number;
    await write(
      `INSERT INTO aplicaciones_pago_proveedor(pago_proveedor_id,compra_proveedor_id,importe)
       VALUES($1,$2,'42.00'),($1,$3,'35.00')`, [pago, compraUno, compraDos],
    );
    const assigned = await client.query<{ total: string }>(
      `SELECT SUM(importe)::text total FROM aplicaciones_pago_proveedor WHERE pago_proveedor_id=$1`, [pago],
    );
    assert.equal(assigned.rows[0]?.total, "77.00");
    assert.equal(100 - Number(assigned.rows[0]?.total), 23);
    await expectWriteRejects(
      `INSERT INTO aplicaciones_pago_proveedor(pago_proveedor_id,compra_proveedor_id,importe) VALUES($1,$2,'0')`,
      [pago, compraUno],
    );
    await expectWriteRejects(
      `INSERT INTO aplicaciones_pago_proveedor(pago_proveedor_id,compra_proveedor_id,importe) VALUES($1,$2,'1.00')`,
      [compraUno, compraDos],
    );
    const compraTres = await compra("50.00");
    await expectWriteRejects(
      `INSERT INTO aplicaciones_pago_proveedor(pago_proveedor_id,compra_proveedor_id,importe) VALUES($1,$2,'23.01')`,
      [pago, compraTres],
    );
    await expectWriteRejects(
      `UPDATE aplicaciones_pago_proveedor SET importe='1.00' WHERE pago_proveedor_id=$1`, [pago],
    );
    await expectWriteRejects(
      `DELETE FROM aplicaciones_pago_proveedor WHERE pago_proveedor_id=$1`, [pago],
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});