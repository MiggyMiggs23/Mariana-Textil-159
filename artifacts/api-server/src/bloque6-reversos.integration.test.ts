import assert from "node:assert/strict";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

test("Bloque 6: reversos conservan evidencia y restauran saldos en ambos ledgers", async (t) => {
  if (!testUrl) { t.skip("TEST_DATABASE_URL no está configurada."); return; }
  if (testUrl === appUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  // The DB package selects TEST_DATABASE_URL for test processes; import only
  // after the environment guard above, never fall back to DATABASE_URL.
  const { pool } = await import("@workspace/db");
  const { createTestDatabaseGuard } = await import("@workspace/db");
  const client = await pool.connect();
  const { assertIsolated } = await createTestDatabaseGuard(
    client,
    testUrl,
    appUrl,
  );
  const guard = async () => {
    if (testUrl === appUrl) throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
    await assertIsolated();
  };
  const write = async (text: string, values: unknown[] = []) => { await guard(); return client.query(text, values); };
  let sequence = 0;
  const rejects = async (text: string, values: unknown[] = []) => {
    const sp = `reverso_rechazado_${++sequence}`;
    await write(`SAVEPOINT ${sp}`);
    await assert.rejects(() => write(text, values));
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await write(`RELEASE SAVEPOINT ${sp}`);
  };
  try {
    await guard(); await client.query("BEGIN");
    const user = await client.query<{ id: number }>("SELECT id FROM usuarios WHERE activo LIMIT 1");
    if (!user.rows[0]) throw new Error("La base temporal requiere un usuario activo.");
    const usuarioId = user.rows[0].id;
    const clienteId = (await write(`INSERT INTO clientes(nombre,activo,es_sistema,dias_credito)
      VALUES ('Cliente reverso ' || txid_current(),true,false,0) RETURNING id`)).rows[0]!.id as number;
    const venta = (await write(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id)
      VALUES($1,'VENTA_CREDITO','100.00',$2) RETURNING id`, [clienteId, usuarioId])).rows[0]!.id as number;
    const abono = (await write(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id)
      VALUES($1,'ABONO','-100.00',$2) RETURNING id`, [clienteId, usuarioId])).rows[0]!.id as number;
    await write(`INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe) VALUES($1,$2,'100.00')`, [abono, venta]);
    assert.equal((await client.query(`SELECT SUM(importe)::text saldo FROM aplicaciones_credito WHERE venta_movimiento_id=$1`, [venta])).rows[0]?.saldo, "100.00");
    const reversoCliente = (await write(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id,notas)
      VALUES($1,'REVERSO','100.00',$2,$3,'abono capturado por error') RETURNING id`, [clienteId, abono, usuarioId])).rows[0]!.id as number;
    assert.ok(reversoCliente > 0);
    const reversoVenta = (await write(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id,notas)
      VALUES($1,'REVERSO','-100.00',$2,$3,'cancelación de venta autorizada') RETURNING id`, [clienteId, venta, usuarioId])).rows[0]!.id as number;
    assert.ok(reversoVenta > 0, "un reverso exacto de VENTA_CREDITO vinculada es válido");
    await rejects(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id)
      VALUES($1,'REVERSO','-99.00',$2,$3)`, [clienteId, venta, usuarioId]);
    await rejects(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id)
      VALUES($1,'REVERSO','100.00',$2,$3)`, [clienteId, venta, usuarioId]);
    const otroClienteId = (await write(`INSERT INTO clientes(nombre,activo,es_sistema,dias_credito)
      VALUES ('Cliente reverso ajeno ' || txid_current(),true,false,0) RETURNING id`)).rows[0]!.id as number;
    await rejects(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id)
      VALUES($1,'REVERSO','-100.00',$2,$3)`, [otroClienteId, venta, usuarioId]);
    const ajuste = (await write(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,usuario_id)
      VALUES($1,'AJUSTE','100.00',$2) RETURNING id`, [clienteId, usuarioId])).rows[0]!.id as number;
    await rejects(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id)
      VALUES($1,'REVERSO','-100.00',$2,$3)`, [clienteId, ajuste, usuarioId]);
    const ubicacionId = (await write("SELECT id FROM ubicaciones WHERE activa LIMIT 1")).rows[0]?.id as number | undefined;
    if (!ubicacionId) throw new Error("La base temporal requiere una ubicación activa.");
    const ticketId = (await write(`INSERT INTO tickets(
      folio,uuid_cliente,ubicacion_id,usuario_terminal_id,cliente_id,subtotal,iva,total,estado,cobrado
    ) VALUES(
      (SELECT COALESCE(MAX(folio), 0) + 1 FROM tickets),md5(random()::text)::uuid,$1,$2,$3,100,0,100,'VENDIDO',false
    ) RETURNING id`, [ubicacionId, usuarioId, clienteId])).rows[0]!.id as number;
    await rejects(`INSERT INTO movimientos_credito(cliente_id,ticket_id,tipo,importe,usuario_id)
      VALUES($1,$2,'REVERSO','-100.00',$3)`, [clienteId, ticketId, usuarioId]);
    const saldoActivoCliente = await client.query<{ saldo: string }>(`SELECT COALESCE(SUM(a.importe) FILTER (WHERE NOT EXISTS
      (SELECT 1 FROM movimientos_credito r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=a.abono_movimiento_id)),0)::text saldo
      FROM aplicaciones_credito a WHERE a.venta_movimiento_id=$1`, [venta]);
    assert.equal(saldoActivoCliente.rows[0]?.saldo, "0");
    assert.equal((await client.query(`SELECT SUM(importe)::text saldo FROM movimientos_credito WHERE cliente_id=$1`, [clienteId])).rows[0]?.saldo, "100.00");
    await rejects(`INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id,usuario_id) VALUES($1,'REVERSO','100.00',$2,$3)`, [clienteId, abono, usuarioId]);
    await rejects(`DELETE FROM movimientos_credito WHERE id=$1`, [reversoCliente]);

    const proveedorId = (await write(`INSERT INTO proveedores(nombre,tipo,moneda_default,activo)
      VALUES('Proveedor reverso ' || txid_current(),'NACIONAL','MXN',true) RETURNING id`)).rows[0]!.id as number;
    const compra = (await write(`INSERT INTO pagos_proveedor(proveedor_id,tipo,importe,fecha,usuario_id) VALUES($1,'COMPRA','100.00',now(),$2) RETURNING id`, [proveedorId, usuarioId])).rows[0]!.id as number;
    const pago = (await write(`INSERT INTO pagos_proveedor(proveedor_id,tipo,importe,forma_pago,fecha,usuario_id) VALUES($1,'PAGO','-100.00','EFECTIVO',now(),$2) RETURNING id`, [proveedorId, usuarioId])).rows[0]!.id as number;
    await write(`INSERT INTO aplicaciones_pago_proveedor(pago_proveedor_id,compra_proveedor_id,importe) VALUES($1,$2,'100.00')`, [pago, compra]);
    const reversoProveedor = (await write(`INSERT INTO pagos_proveedor(proveedor_id,tipo,importe,movimiento_origen_id,fecha,usuario_id,notas)
      VALUES($1,'REVERSO','100.00',$2,now(),$3,'pago capturado por error') RETURNING id`, [proveedorId, pago, usuarioId])).rows[0]!.id as number;
    const activoProveedor = await client.query<{ saldo: string }>(`SELECT COALESCE(SUM(a.importe) FILTER (WHERE NOT EXISTS
      (SELECT 1 FROM pagos_proveedor r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=a.pago_proveedor_id)),0)::text saldo
      FROM aplicaciones_pago_proveedor a WHERE a.compra_proveedor_id=$1`, [compra]);
    assert.equal(activoProveedor.rows[0]?.saldo, "0");
    assert.equal((await client.query(`SELECT SUM(importe)::text saldo FROM pagos_proveedor WHERE proveedor_id=$1`, [proveedorId])).rows[0]?.saldo, "100.00");
    await rejects(`INSERT INTO pagos_proveedor(proveedor_id,tipo,importe,movimiento_origen_id,fecha,usuario_id) VALUES($1,'REVERSO','100.00',$2,now(),$3)`, [proveedorId, pago, usuarioId]);
    await rejects(`DELETE FROM pagos_proveedor WHERE id=$1`, [reversoProveedor]);
  } finally { await client.query("ROLLBACK").catch(() => undefined); client.release(); }
});