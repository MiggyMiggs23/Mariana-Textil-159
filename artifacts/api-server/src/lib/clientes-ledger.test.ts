import assert from "node:assert/strict";
import test from "node:test";
import { ensureClientesSchema, pool } from "@workspace/db";

test("linked legacy negative adjustment keeps ledger and aging consistent", async () => {
  await ensureClientesSchema(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: number }>(
      "SELECT id FROM usuarios WHERE activo ORDER BY id LIMIT 1",
    );
    const location = await client.query<{ id: number }>(
      "SELECT id FROM ubicaciones WHERE activa ORDER BY id LIMIT 1",
    );
    assert.ok(user.rows[0], "seed must include an active user");
    assert.ok(location.rows[0], "seed must include an active location");

    const customer = await client.query<{ id: number }>(
      `INSERT INTO clientes (nombre, activo, limite_credito, dias_credito)
       VALUES ($1, true, 1000, 30) RETURNING id`,
      [`Ledger aging ${Date.now()}`],
    );
    const customerId = customer.rows[0]!.id;
    const ticket = await client.query<{ id: number }>(
      `INSERT INTO tickets
        (folio, uuid_cliente, ubicacion_id, usuario_terminal_id, cliente_id,
         tipo, subtotal, iva, tasa_iva, total, facturado)
       VALUES (
         (SELECT COALESCE(MAX(folio), 0) + 100000 FROM tickets),
         gen_random_uuid(), $1, $2, $3, 'NORMAL', 100, 0, 0, 100, false
       ) RETURNING id`,
      [location.rows[0]!.id, user.rows[0]!.id, customerId],
    );
    const ticketId = ticket.rows[0]!.id;

    await client.query(
      `INSERT INTO movimientos_credito
        (cliente_id, ticket_id, tipo, importe, usuario_id, notas)
       VALUES
        ($1, $2, 'VENTA_CREDITO', 100, $3, 'Venta de prueba'),
        ($1, $2, 'AJUSTE', -40, $3, 'Ajuste ligado legado')`,
      [customerId, ticketId, user.rows[0]!.id],
    );

    const ledger = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(importe), 0)::text AS total
       FROM movimientos_credito WHERE cliente_id = $1`,
      [customerId],
    );
    const aging = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(pendiente), 0)::text AS total
       FROM credit_fifo_aging($1)`,
      [customerId],
    );

    assert.equal(ledger.rows[0]!.total, "60.00");
    assert.equal(aging.rows[0]!.total, ledger.rows[0]!.total);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});