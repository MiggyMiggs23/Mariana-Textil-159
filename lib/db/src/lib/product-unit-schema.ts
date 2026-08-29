import type { Pool } from "pg";

/**
 * Repeatable startup migration for product units.
 *
 * PostgreSQL requires enum values to be committed before they can be used, so
 * this migration intentionally performs only the additive enum change.
 */
export async function ensureProductUnitSchema(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query(`
    ALTER TYPE unidad_producto ADD VALUE IF NOT EXISTS 'BOLSA';
  `);
}