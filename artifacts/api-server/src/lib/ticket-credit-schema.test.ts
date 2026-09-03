import assert from "node:assert/strict";
import test from "node:test";
import { ensureClientesSchema, pool } from "@workspace/db";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Esta prueba modifica el esquema y solo puede ejecutarse con TEST_DATABASE_URL.",
  );
}

await test("la actualización de crédito de ticket es idempotente y conserva históricos", async () => {
  await pool.query(`
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_credito_plazo_check;
    ALTER TABLE tickets DROP COLUMN IF EXISTS fecha_vencimiento;
    ALTER TABLE tickets DROP COLUMN IF EXISTS dias_plazo;
    ALTER TABLE tickets DROP COLUMN IF EXISTS credito;
  `);

  await ensureClientesSchema(pool);
  await ensureClientesSchema(pool);

  const columns = await pool.query<{
    column_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(`
    SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema=current_schema() AND table_name='tickets'
       AND column_name IN ('credito', 'dias_plazo', 'fecha_vencimiento')
     ORDER BY column_name
  `);
  assert.deepEqual(columns.rows.map((row) => row.column_name), [
    "credito",
    "dias_plazo",
    "fecha_vencimiento",
  ]);
  assert.equal(columns.rows.find((row) => row.column_name === "credito")?.is_nullable, "NO");

  const fixture = await pool.query<{ id: number }>(`
    INSERT INTO tickets (
      folio,
      ubicacion_id,
      usuario_terminal_id,
      cliente_id,
      subtotal,
      total,
      uuid_cliente
    )
    SELECT
      COALESCE(MAX(t.folio), 0) + 100000,
      (SELECT id FROM ubicaciones ORDER BY id LIMIT 1),
      (SELECT id FROM usuarios ORDER BY id LIMIT 1),
      (SELECT id FROM clientes ORDER BY id LIMIT 1),
      0,
      0,
      gen_random_uuid()
    FROM tickets t
    RETURNING id
  `);

  await assert.rejects(
    () =>
      pool.query(
        "UPDATE tickets SET credito=true, dias_plazo=30, fecha_vencimiento=NULL WHERE id=$1",
        [fixture.rows[0]!.id],
      ),
    /tickets_credito_plazo_check/,
  );
});