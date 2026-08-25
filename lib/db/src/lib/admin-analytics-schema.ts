import type { Pool } from "pg";

/**
 * Idempotent indexes for the read-only ADMIN analytics queries. This follows
 * the existing startup upgrade convention and never mutates business data.
 */
export async function ensureAdminAnalyticsSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS sesiones_caja_cerrada_at_idx
      ON sesiones_caja (cerrada_at) WHERE estado = 'CERRADA';
    CREATE INDEX IF NOT EXISTS tickets_created_at_idx
      ON tickets (created_at);
    CREATE INDEX IF NOT EXISTS tickets_sesion_estado_idx
      ON tickets (sesion_caja_id, estado);
    CREATE INDEX IF NOT EXISTS tickets_cobrado_created_at_idx
      ON tickets (created_at, ubicacion_id) WHERE cobrado = true;
  `);
}