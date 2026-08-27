import type { Pool } from "pg";

/** Repeatable production upgrade for directed-payment review requests. */
export async function ensureSolicitudesPagoDirigidoSchema(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE tipo_solicitud_pago_dirigido AS ENUM ('CLIENTE','PROVEEDOR');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE estado_solicitud_pago_dirigido AS ENUM ('PENDIENTE','APROBADA','RECHAZADA');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS solicitudes_pago_dirigido (
      id serial PRIMARY KEY, tipo tipo_solicitud_pago_dirigido NOT NULL,
      entidad_id integer NOT NULL, documento_movimiento_id integer NOT NULL,
      importe numeric(12,2) NOT NULL CHECK (importe > 0), forma_pago text NOT NULL,
      cuenta_destino text, fecha_efectiva timestamptz,
      referencia text, notas text, motivo text NOT NULL CHECK (char_length(trim(motivo)) >= 10),
      motivo_rechazo text CHECK (motivo_rechazo IS NULL OR char_length(trim(motivo_rechazo)) >= 10),
      solicitante_id integer NOT NULL REFERENCES usuarios(id),
      solicitante_nombre text NOT NULL DEFAULT '', autorizador_id integer REFERENCES usuarios(id),
      autorizador_nombre text, contraparte_nombre text NOT NULL DEFAULT '', documento_folio text NOT NULL DEFAULT '',
      movimiento_id integer,
      estado estado_solicitud_pago_dirigido NOT NULL DEFAULT 'PENDIENTE',
      resuelta_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS solicitudes_pago_dirigido_estado_idx
      ON solicitudes_pago_dirigido(estado, created_at);
    CREATE INDEX IF NOT EXISTS solicitudes_pago_dirigido_entidad_idx
      ON solicitudes_pago_dirigido(tipo, entidad_id);
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS cuenta_destino text;
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS fecha_efectiva timestamptz;
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS motivo_rechazo text;
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS solicitante_nombre text NOT NULL DEFAULT '';
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS autorizador_nombre text;
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS contraparte_nombre text NOT NULL DEFAULT '';
    ALTER TABLE solicitudes_pago_dirigido ADD COLUMN IF NOT EXISTS documento_folio text NOT NULL DEFAULT '';
    ALTER TABLE solicitudes_pago_dirigido DROP CONSTRAINT IF EXISTS solicitudes_pago_dirigido_resolved_check;
    ALTER TABLE solicitudes_pago_dirigido ADD CONSTRAINT solicitudes_pago_dirigido_resolved_check CHECK
      ((estado='PENDIENTE' AND autorizador_id IS NULL AND resuelta_at IS NULL)
       OR (estado='APROBADA' AND autorizador_id IS NOT NULL AND movimiento_id IS NOT NULL AND resuelta_at IS NOT NULL)
       OR (estado='RECHAZADA' AND autorizador_id IS NOT NULL AND motivo_rechazo IS NOT NULL AND resuelta_at IS NOT NULL));
  `);
}