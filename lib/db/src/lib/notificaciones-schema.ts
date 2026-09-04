import type { Pool } from "pg";

/** Repeatable upgrade for user-addressed persistent system notifications. */
export async function ensureNotificacionesSchema(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificaciones_sistema (
      id serial PRIMARY KEY,
      tipo text NOT NULL,
      titulo text NOT NULL,
      mensaje text NOT NULL,
      entidad text NOT NULL,
      entidad_id text NOT NULL,
      leida_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE notificaciones_sistema
      ADD COLUMN IF NOT EXISTS destinatario_usuario_id integer
        REFERENCES usuarios(id);
    CREATE INDEX IF NOT EXISTS notificaciones_sistema_destinatario_leida_idx
      ON notificaciones_sistema(destinatario_usuario_id, leida_at, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_sistema_pago_dirigido_resuelto_uidx
      ON notificaciones_sistema(entidad, entidad_id, destinatario_usuario_id)
      WHERE tipo = 'PAGO_DIRIGIDO_RESUELTO';
  `);
}