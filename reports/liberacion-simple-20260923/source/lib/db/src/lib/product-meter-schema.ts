import type { Pool } from "pg";

/**
 * Repeatable startup migration for the per-product metered-sale lock.
 * Existing and future KILO products are kept false at the database boundary.
 */
export async function ensureProductMeterSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS se_vende_por_metro boolean;

      UPDATE productos
      SET se_vende_por_metro = false
      WHERE se_vende_por_metro IS NULL
         OR (unidad = 'KILO' AND se_vende_por_metro);

      ALTER TABLE productos
        ALTER COLUMN se_vende_por_metro SET DEFAULT false,
        ALTER COLUMN se_vende_por_metro SET NOT NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'productos'::regclass
            AND conname = 'productos_kilo_no_venta_metro_check'
        ) THEN
          ALTER TABLE productos
            ADD CONSTRAINT productos_kilo_no_venta_metro_check
            CHECK (unidad <> 'KILO' OR se_vende_por_metro = false);
        END IF;
      END $$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}