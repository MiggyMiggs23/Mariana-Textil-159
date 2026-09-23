import type { Pool } from "pg";

/** Repeatable, data-preserving migration for the three catalog price modes. */
export async function ensureProductPricingSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE precio_modo AS ENUM ('ROLLO', 'MAYOREO', 'MENUDEO');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS precio_mayoreo numeric(12,2),
        ADD COLUMN IF NOT EXISTS precio_menudeo numeric(12,2);

      ALTER TABLE precio_historial
        ADD COLUMN IF NOT EXISTS modo_precio precio_modo;

      UPDATE precio_historial
      SET modo_precio = 'ROLLO'
      WHERE modo_precio IS NULL;

      ALTER TABLE precio_historial
        ALTER COLUMN modo_precio SET DEFAULT 'ROLLO',
        ALTER COLUMN modo_precio SET NOT NULL,
        ALTER COLUMN precio_lista_anterior DROP NOT NULL;

      CREATE INDEX IF NOT EXISTS precio_historial_producto_modo_created_idx
        ON precio_historial(producto_id, modo_precio, created_at);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}