import type { Pool } from "pg";

/**
 * Repeatable startup migration for product units.
 *
 * PostgreSQL requires enum values to be committed before they can be used, so
 * this migration adds enum values and keeps units that cannot be sold by
 * length locked at the database boundary.
 */
export async function ensureProductUnitSchema(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query(`ALTER TYPE unidad_producto ADD VALUE IF NOT EXISTS 'BOLSA';`);
  await pool.query(`ALTER TYPE unidad_producto ADD VALUE IF NOT EXISTS 'PIEZA';`);

  await pool.query(`
    ALTER TABLE productos
      DROP CONSTRAINT IF EXISTS productos_kilo_no_venta_metro_check;

    ALTER TABLE productos
      ADD CONSTRAINT productos_kilo_no_venta_metro_check
      CHECK (unidad NOT IN ('KILO', 'PIEZA') OR se_vende_por_metro = false);
  `);
}