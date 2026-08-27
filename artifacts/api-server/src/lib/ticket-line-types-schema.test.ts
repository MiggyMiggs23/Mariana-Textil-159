import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ensureTicketLineTypesSchema, pool } from "@workspace/db";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Esta prueba modifica el esquema y solo puede ejecutarse con TEST_DATABASE_URL.",
  );
}

await test("la migración desvincula y audita líneas METREADO legacy antes del constraint", async () => {
  const tag = `TLT${Date.now()}`;
  const fixture = await pool.query<{
    ubicacion_id: number;
    usuario_id: number;
    cliente_id: number;
  }>(`
    SELECT
      (SELECT id FROM ubicaciones ORDER BY id LIMIT 1) AS ubicacion_id,
      (SELECT id FROM usuarios WHERE rol = 'ADMIN' ORDER BY id LIMIT 1) AS usuario_id,
      (SELECT id FROM clientes ORDER BY id LIMIT 1) AS cliente_id
  `);
  const ids = fixture.rows[0];
  assert.ok(ids?.ubicacion_id && ids.usuario_id && ids.cliente_id);

  const product = await pool.query<{ id: number }>(
    `INSERT INTO productos (sku, tela, color, unidad, precio_sugerido)
     VALUES ($1, $2, 'Azul', 'METRO', 10)
     RETURNING id`,
    [tag, tag],
  );
  const productId = product.rows[0]!.id;
  const roll = await pool.query<{ id: number }>(
    `INSERT INTO rollos
       (serie, producto_id, ubicacion_id, estado, cantidad_inicial,
        cantidad_actual, costo_unitario, costo_total)
     VALUES ($1, $2, $3, 'MOSTRADOR', 10, 0, 5, 50)
     RETURNING id`,
    [`9${Date.now()}`, productId, ids.ubicacion_id],
  );
  const rolloId = roll.rows[0]!.id;
  const folio = await pool.query<{ value: number }>(
    "SELECT COALESCE(MAX(folio), 0) + 1 AS value FROM tickets",
  );

  await pool.query(`
    ALTER TABLE ticket_lineas
      DROP CONSTRAINT IF EXISTS ticket_lineas_tipo_rollo_costos_check,
      ALTER COLUMN tipo DROP NOT NULL;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tipo tipo_ticket;
  `);

  const ticket = await pool.query<{ id: number }>(
    `INSERT INTO tickets
       (folio, ubicacion_id, usuario_terminal_id, cliente_id, tipo,
        subtotal, iva, tasa_iva, total, estado, cobrado, facturado,
        uuid_cliente)
     VALUES ($1, $2, $3, $4, 'METREADO', 100, 16, 0.16, 116,
             'VENDIDO', true, false, $5)
     RETURNING id`,
    [
      folio.rows[0]!.value,
      ids.ubicacion_id,
      ids.usuario_id,
      ids.cliente_id,
      randomUUID(),
    ],
  );
  const ticketId = ticket.rows[0]!.id;
  const line = await pool.query<{ id: number }>(
    `INSERT INTO ticket_lineas
       (ticket_id, rollo_id, producto_id, tipo, cantidad, precio_unitario,
        precio_sugerido, importe, costo_unitario_congelado,
        costo_total_congelado)
      VALUES ($1, $2, $3, NULL, 10, 10, 10, 100, NULL, NULL)
     RETURNING id`,
    [ticketId, rolloId, productId],
  );
  const lineId = line.rows[0]!.id;

  try {
    await ensureTicketLineTypesSchema(pool);
    await ensureTicketLineTypesSchema(pool);

    const migrated = await pool.query<{
      tipo: string;
      rollo_id: number | null;
      costo_unitario_congelado: string | null;
      costo_total_congelado: string | null;
      costo_referencia_estado: string | null;
    }>(
      `SELECT tipo, rollo_id, costo_unitario_congelado, costo_total_congelado,
              costo_referencia_estado
       FROM ticket_lineas WHERE id = $1`,
      [lineId],
    );
    assert.deepEqual(migrated.rows, [{
      tipo: "METREADO",
      rollo_id: null,
      costo_unitario_congelado: null,
      costo_total_congelado: null,
      costo_referencia_estado: null,
    }]);

    const audit = await pool.query<{
      datos_antes: { rolloId: number };
      datos_despues: { rolloId: null };
    }>(
      `SELECT datos_antes, datos_despues
       FROM auditoria
       WHERE accion = 'MIGRACION_METREADO_SIN_ROLLO'
         AND entidad = 'ticket_lineas'
         AND entidad_id = $1`,
      [String(lineId)],
    );
    assert.equal(audit.rows.length, 1, "el upgrade repetido no duplica auditoría");
    assert.deepEqual(audit.rows[0]!.datos_antes, { rolloId });
    assert.deepEqual(audit.rows[0]!.datos_despues, { rolloId: null });

    const constraint = await pool.query<{ validated: boolean; definition: string }>(
      `SELECT convalidated AS validated, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conname = 'ticket_lineas_tipo_rollo_costos_check'`,
    );
    assert.equal(constraint.rows[0]?.validated, true);
    assert.match(constraint.rows[0]!.definition, /STALE_LAST_KNOWN/);
    assert.match(constraint.rows[0]!.definition, /AVERAGE_12_MONTHS/);
    assert.match(constraint.rows[0]!.definition, /NO_COST/);
    const oldColumn = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'tickets'
         AND column_name = 'tipo'`,
    );
    assert.equal(oldColumn.rowCount, 0);
  } finally {
    await pool.query("DELETE FROM ticket_lineas WHERE id = $1", [lineId]);
    await pool.query("DELETE FROM tickets WHERE id = $1", [ticketId]);
    await pool.query("DELETE FROM rollos WHERE id = $1", [rolloId]);
    await pool.query("DELETE FROM productos WHERE id = $1", [productId]);
  }
});