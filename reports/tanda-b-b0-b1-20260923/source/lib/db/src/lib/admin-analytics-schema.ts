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
    CREATE INDEX IF NOT EXISTS ticket_lineas_producto_ticket_reportes_idx
      ON ticket_lineas (producto_id, ticket_id);
    CREATE INDEX IF NOT EXISTS movimientos_ubicacion_created_reportes_idx
      ON movimientos (ubicacion_id, created_at);
    CREATE INDEX IF NOT EXISTS rollos_ubicacion_producto_reportes_idx
      ON rollos (ubicacion_id, producto_id);
  `);
}