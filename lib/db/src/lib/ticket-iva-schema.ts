import type { Pool } from "pg";

/**
 * Safe, repeatable schema upgrade for deployments created before IVA became a
 * ticket-level field. It intentionally leaves existing ticket totals intact:
 * historical rows receive zero IVA instead of being recalculated.
 */
export async function ensureTicketIvaSchema(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS iva numeric(12, 2) NOT NULL DEFAULT 0;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS tasa_iva numeric(5, 4) NOT NULL DEFAULT 0.1600;
  `);
}
