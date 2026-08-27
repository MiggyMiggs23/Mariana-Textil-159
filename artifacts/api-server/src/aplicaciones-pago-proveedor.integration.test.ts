import assert from "node:assert/strict";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;

test("aplicaciones_pago_proveedor valida PAGO→COMPRA, límites y append-only", async (t) => {
  if (!testDatabaseUrl) {
    t.skip("TEST_DATABASE_URL no está configurada; integración PostgreSQL omitida.");
    return;
  }
  if (testDatabaseUrl === applicationDatabaseUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  const { pool } = await import("@workspace/db");
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const client = await pool.connect();
  const { assertIsolated } = await createTestDatabaseGuard(
    client,
    testDatabaseUrl,
    applicationDatabaseUrl,
  );
  const guard = async () => {
    if (testDatabaseUrl === applicationDatabaseUrl) throw new Error("TEST_DATABASE_URL dejó de ser distinta de DATABASE_URL.");
    await assertIsolated();
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
    const reverso = (await write(
      `INSERT INTO pagos_proveedor
         (proveedor_id,tipo,importe,movimiento_origen_id,fecha,usuario_id)
       VALUES($1,'REVERSO','100.00',$2,now(),$3) RETURNING id`,
      [proveedorId, pago, usuarioId],
    )).rows[0]!.id as number;
    assert.ok(reverso > 0);
    const pagoNuevo = (await write(
      `INSERT INTO pagos_proveedor
         (proveedor_id,tipo,importe,forma_pago,fecha,usuario_id)
       VALUES($1,'PAGO','-42.00','EFECTIVO',now(),$2) RETURNING id`,
      [proveedorId, usuarioId],
    )).rows[0]!.id as number;
    await write(
      `INSERT INTO aplicaciones_pago_proveedor
         (pago_proveedor_id,compra_proveedor_id,importe)
       VALUES($1,$2,'42.00')`,
      [pagoNuevo, compraUno],
    );
    await expectWriteRejects(
      `INSERT INTO aplicaciones_pago_proveedor
         (pago_proveedor_id,compra_proveedor_id,importe)
       VALUES($1,$2,'1.00')`,
      [pago, compraTres],
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});

test("ensure materializa pago legado dirigido una sola vez", async (t) => {
  if (!testDatabaseUrl) {
    t.skip("TEST_DATABASE_URL no está configurada; integración PostgreSQL omitida.");
    return;
  }
  if (testDatabaseUrl === applicationDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  }
  const { ensureAplicacionesPagoProveedorSchema, pool } =
    await import("@workspace/db");
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const client = await pool.connect();
  const { assertIsolated } = await createTestDatabaseGuard(
    client,
    testDatabaseUrl,
    applicationDatabaseUrl,
  );
  const guard = async () => {
    if (testDatabaseUrl === applicationDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL dejó de ser distinta de DATABASE_URL.");
    }
    await assertIsolated();
  };
  const write = async (text: string, values: unknown[] = []) => {
    await guard();
    return client.query(text, values);
  };
  try {
    await guard();
    await client.query("BEGIN");
    const seed = await client.query<{ usuario_id: number; ubicacion_id: number }>(
      `SELECT u.id usuario_id, b.id ubicacion_id
       FROM usuarios u CROSS JOIN ubicaciones b
       WHERE u.activo AND b.activa LIMIT 1`,
    );
    if (!seed.rows[0]) {
      throw new Error("La base temporal requiere usuario y ubicación activos.");
    }
    const { usuario_id: usuarioId, ubicacion_id: ubicacionId } = seed.rows[0];
    const proveedorId = (await write(
      `INSERT INTO proveedores(nombre,tipo,moneda_default,activo)
       VALUES('Proveedor legado ' || txid_current(),'NACIONAL','MXN',true)
       RETURNING id`,
    )).rows[0]!.id as number;
    const entradaId = (await write(
      `INSERT INTO entradas
         (folio,ubicacion_id,proveedor_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente)
       VALUES((SELECT COALESCE(MAX(folio),0)+1 FROM entradas WHERE ubicacion_id=$1),
         $1,$2,$3,now(),0,'80.00',gen_random_uuid()) RETURNING id`,
      [ubicacionId, proveedorId, usuarioId],
    )).rows[0]!.id as number;
    const compraId = (await write(
      `INSERT INTO pagos_proveedor
         (proveedor_id,entrada_id,tipo,importe,fecha,usuario_id)
       VALUES($1,$2,'COMPRA','80.00',now(),$3) RETURNING id`,
      [proveedorId, entradaId, usuarioId],
    )).rows[0]!.id as number;
    const pagoId = (await write(
      `INSERT INTO pagos_proveedor
         (proveedor_id,entrada_id,tipo,importe,forma_pago,fecha,usuario_id)
       VALUES($1,$2,'PAGO','-100.00','EFECTIVO',now(),$3) RETURNING id`,
      [proveedorId, entradaId, usuarioId],
    )).rows[0]!.id as number;

    let ensureSequence = 0;
    const guardedPool = {
      connect: async () => ({
        query: async (text: string, values?: unknown[]) => {
          if (text === "BEGIN") {
            await guard();
            return client.query(`SAVEPOINT ensure_${++ensureSequence}`);
          }
          if (text === "COMMIT") {
            await guard();
            return client.query(`RELEASE SAVEPOINT ensure_${ensureSequence}`);
          }
          if (text === "ROLLBACK") {
            await guard();
            await client.query(`ROLLBACK TO SAVEPOINT ensure_${ensureSequence}`);
            return client.query(`RELEASE SAVEPOINT ensure_${ensureSequence}`);
          }
          await guard();
          return client.query(text, values);
        },
        release: () => undefined,
      }),
    };
    await ensureAplicacionesPagoProveedorSchema(guardedPool as never);
    await ensureAplicacionesPagoProveedorSchema(guardedPool as never);
    const applications = await client.query<{ count: number; total: string }>(
      `SELECT COUNT(*)::int count,COALESCE(SUM(importe),0)::text total
       FROM aplicaciones_pago_proveedor
       WHERE pago_proveedor_id=$1 AND compra_proveedor_id=$2`,
      [pagoId, compraId],
    );
    assert.deepEqual(applications.rows[0], { count: 1, total: "80.00" });
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});