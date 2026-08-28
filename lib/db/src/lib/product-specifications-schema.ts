import type { Pool } from "pg";

/**
 * Repeatable startup migration for manually captured textile specifications.
 * No backfill is performed: existing products intentionally remain NULL.
 */
export async function ensureProductSpecificationsSchema(
  pool: Pick<Pool, "connect">,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS ancho_cm numeric(10, 2),
        ADD COLUMN IF NOT EXISTS composicion text,
        ADD COLUMN IF NOT EXISTS gramaje_gm2 numeric(10, 2);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}