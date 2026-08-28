import type { Pool } from "pg";

/** Repeatable production upgrade for the daily Mexico City cash-session invariant. */
export async function ensureCashSessionSchema(pool: Pick<Pool, "query">): Promise<void> {
  await pool.query(`
    ALTER TABLE sesiones_caja ADD COLUMN IF NOT EXISTS fecha_operativa date;
    UPDATE sesiones_caja
      SET fecha_operativa = (abierta_at AT TIME ZONE 'America/Mexico_City')::date
      WHERE fecha_operativa IS NULL;
    ALTER TABLE sesiones_caja ALTER COLUMN fecha_operativa SET NOT NULL;
    -- Historical data legitimately contains multiple sessions per day.  Keep every
    -- row intact and guard new openings in a separate one-row-per-day table.
    DROP INDEX IF EXISTS sesiones_caja_ubicacion_fecha_operativa_uidx;
    CREATE TABLE IF NOT EXISTS sesiones_caja_dias (
      ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
      fecha_operativa date NOT NULL,
      sesion_caja_id integer REFERENCES sesiones_caja(id),
      PRIMARY KEY (ubicacion_id, fecha_operativa)
    );
    INSERT INTO sesiones_caja_dias (ubicacion_id, fecha_operativa, sesion_caja_id)
      SELECT DISTINCT ON (ubicacion_id, fecha_operativa) ubicacion_id, fecha_operativa, id
      FROM sesiones_caja
      ORDER BY ubicacion_id, fecha_operativa, abierta_at, id
      ON CONFLICT (ubicacion_id, fecha_operativa) DO NOTHING;
    CREATE UNIQUE INDEX IF NOT EXISTS sesiones_caja_una_abierta_ubicacion_idx
      ON sesiones_caja (ubicacion_id) WHERE estado = 'ABIERTA';
    CREATE TABLE IF NOT EXISTS salidas_dinero_caja (
      id serial PRIMARY KEY,
      sesion_caja_id integer NOT NULL REFERENCES sesiones_caja(id),
      monto numeric(12,2) NOT NULL CHECK (monto > 0),
      motivo text NOT NULL CHECK (char_length(trim(motivo)) BETWEEN 1 AND 500),
      proveedor_id integer REFERENCES proveedores(id),
      cuenta_origen text NOT NULL CHECK (cuenta_origen IN ('CAJA_FISICA','CUENTA_NO_FISCAL','CUENTA_FISCAL')),
      creado_por_id integer NOT NULL REFERENCES usuarios(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS salidas_dinero_caja_sesion_created_idx
      ON salidas_dinero_caja (sesion_caja_id, created_at);
    CREATE INDEX IF NOT EXISTS salidas_dinero_caja_proveedor_idx
      ON salidas_dinero_caja (proveedor_id);
  `);
}