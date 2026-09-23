type SqlExecutor = { query: (text: string, values?: unknown[]) => Promise<unknown> };

/** Adds durable Caja authorization without inferring it from legacy ticket states. */
export async function ensureTicketAuthorizationSchema(db: SqlExecutor): Promise<void> {
  await db.query(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS autorizado_at timestamptz;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS autorizacion_estado text NOT NULL DEFAULT 'NO_APLICA';
    UPDATE tickets t SET
      autorizacion_estado = CASE WHEN t.documento_tipo='NOTA' THEN
        CASE WHEN EXISTS (SELECT 1 FROM movimientos_credito m
          WHERE m.ticket_id=t.id AND m.tipo='VENTA_CREDITO')
          THEN 'AUTORIZADA' ELSE 'PENDIENTE' END
        ELSE 'NO_APLICA' END,
      autorizado_at = CASE WHEN t.documento_tipo='NOTA' THEN COALESCE(
        t.autorizado_at,
        (SELECT MIN(m.created_at) FROM movimientos_credito m
          WHERE m.ticket_id=t.id AND m.tipo='VENTA_CREDITO')
      ) ELSE t.autorizado_at END;
    CREATE TABLE IF NOT EXISTS autorizaciones_nota (
      id serial PRIMARY KEY,
      ticket_id integer NOT NULL UNIQUE REFERENCES tickets(id),
      sesion_caja_id integer NOT NULL REFERENCES sesiones_caja(id),
      usuario_id integer NOT NULL REFERENCES usuarios(id),
      movimiento_credito_id integer NOT NULL REFERENCES movimientos_credito(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS autorizaciones_nota_sesion_idx
      ON autorizaciones_nota(sesion_caja_id,created_at);
  `);
}