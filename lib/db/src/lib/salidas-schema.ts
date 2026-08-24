import type { Pool } from "pg";

/**
 * Creates the Salidas persistence layer and upgrades the old
 * `transferencias` permission alias. This is deliberately repeatable so it can
 * run at every API startup.
 */
export async function ensureSalidasSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE estado_salida AS ENUM (
          'REGISTRADA', 'SOLICITADA', 'ACEPTADA', 'RECHAZADA', 'PREPARADA',
          'ENVIADA', 'RECIBIDA', 'CERRADA', 'CANCELADA'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      ALTER TYPE estado_salida ADD VALUE IF NOT EXISTS 'REGISTRADA';

      CREATE TABLE IF NOT EXISTS salidas (
        id serial PRIMARY KEY,
        folio integer NOT NULL UNIQUE,
        origen_id integer NOT NULL REFERENCES ubicaciones(id),
        destino_id integer NOT NULL REFERENCES ubicaciones(id),
        estado estado_salida NOT NULL DEFAULT 'REGISTRADA',
        usuario_solicita_id integer REFERENCES usuarios(id),
        usuario_acepta_id integer REFERENCES usuarios(id),
        usuario_prepara_id integer REFERENCES usuarios(id),
        usuario_envia_id integer REFERENCES usuarios(id),
        usuario_recibe_id integer REFERENCES usuarios(id),
        usuario_cierra_id integer REFERENCES usuarios(id),
        usuario_cancela_id integer REFERENCES usuarios(id),
        solicitada_at timestamptz,
        aceptada_at timestamptz,
        preparada_at timestamptz,
        enviada_at timestamptz,
        recibida_at timestamptz,
        cerrada_at timestamptz,
        cancelada_at timestamptz,
        motivo_rechazo text,
        motivo_cancelacion text,
        nota_solicitud text,
        nota_envio text,
        nota_recepcion text,
        transportista text,
        uuid_cliente uuid NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE salidas
        ADD COLUMN IF NOT EXISTS usuario_cancela_id integer REFERENCES usuarios(id),
        ADD COLUMN IF NOT EXISTS cancelada_at timestamptz,
        ADD COLUMN IF NOT EXISTS autorizado_por_id integer REFERENCES usuarios(id);

      CREATE TABLE IF NOT EXISTS salida_lineas (
        id serial PRIMARY KEY,
        salida_id integer NOT NULL REFERENCES salidas(id),
        producto_id integer NOT NULL REFERENCES productos(id),
        cantidad_solicitada numeric(10, 3) NOT NULL,
        cantidad_enviada numeric(10, 3) NOT NULL DEFAULT 0,
        cantidad_recibida numeric(10, 3) NOT NULL DEFAULT 0,
        rollos_solicitados integer,
        nota text
      );

      CREATE TABLE IF NOT EXISTS salida_rollos (
        id serial PRIMARY KEY,
        salida_id integer NOT NULL REFERENCES salidas(id),
        linea_id integer NOT NULL REFERENCES salida_lineas(id),
        rollo_id integer NOT NULL REFERENCES rollos(id),
        cantidad_enviada numeric(10, 3) NOT NULL,
        cantidad_recibida numeric(10, 3),
        recibido boolean NOT NULL DEFAULT false,
        nota_diferencia text
      );

      CREATE TABLE IF NOT EXISTS salida_folio (
        id integer PRIMARY KEY DEFAULT 1,
        ultimo_folio integer NOT NULL DEFAULT 499
      );

      CREATE INDEX IF NOT EXISTS salidas_origen_estado_idx ON salidas (origen_id, estado);
      CREATE INDEX IF NOT EXISTS salidas_destino_estado_idx ON salidas (destino_id, estado);
      CREATE INDEX IF NOT EXISTS salidas_estado_idx ON salidas (estado);
      CREATE INDEX IF NOT EXISTS salidas_folio_idx ON salidas (folio);
      CREATE INDEX IF NOT EXISTS salidas_created_at_idx ON salidas (created_at);
      CREATE INDEX IF NOT EXISTS salida_rollos_rollo_salida_idx ON salida_rollos (rollo_id, salida_id);
      CREATE INDEX IF NOT EXISTS salida_lineas_salida_idx ON salida_lineas (salida_id);
      CREATE INDEX IF NOT EXISTS salida_lineas_producto_idx ON salida_lineas (producto_id);
      CREATE INDEX IF NOT EXISTS salida_rollos_salida_idx ON salida_rollos (salida_id);
      CREATE INDEX IF NOT EXISTS salida_rollos_linea_idx ON salida_rollos (linea_id);
      CREATE INDEX IF NOT EXISTS salida_rollos_rollo_idx ON salida_rollos (rollo_id);

      INSERT INTO salida_folio (id, ultimo_folio)
      VALUES (1, 499)
      ON CONFLICT (id) DO NOTHING;
    `);

    // transferencias wins when both aliases exist, preserving prior setup.
    await client.query(`
      DO $$ BEGIN
        IF to_regclass('public.permisos_rol') IS NOT NULL THEN
          INSERT INTO permisos_rol
            (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar, updated_at, updated_por)
          SELECT rol, 'salidas', puede_ver, puede_crear, puede_editar, puede_autorizar, updated_at, updated_por
          FROM permisos_rol WHERE modulo = 'transferencias'
          ON CONFLICT (rol, modulo) DO UPDATE SET
            puede_ver = EXCLUDED.puede_ver,
            puede_crear = EXCLUDED.puede_crear,
            puede_editar = EXCLUDED.puede_editar,
            puede_autorizar = EXCLUDED.puede_autorizar,
            updated_at = EXCLUDED.updated_at,
            updated_por = EXCLUDED.updated_por;

          INSERT INTO permisos_rol (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
          VALUES
            ('TERMINAL', 'salidas', true, false, false, false),
            ('CAJA', 'salidas', false, false, false, false),
            ('INVENTARIOS', 'salidas', true, true, false, false),
            ('BODEGA', 'salidas', true, true, false, false)
          ON CONFLICT (rol, modulo) DO UPDATE SET
            puede_ver = EXCLUDED.puede_ver,
            puede_crear = EXCLUDED.puede_crear,
            puede_editar = EXCLUDED.puede_editar,
            puede_autorizar = EXCLUDED.puede_autorizar
          WHERE permisos_rol.updated_por IS NULL;

          DELETE FROM permisos_rol
          WHERE rol = 'ADMIN' AND modulo IN ('salidas', 'transferencias');
        END IF;

        IF to_regclass('public.permisos_usuario') IS NOT NULL THEN
          INSERT INTO permisos_usuario
            (usuario_id, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar, updated_at, updated_por)
          SELECT usuario_id, 'salidas', puede_ver, puede_crear, puede_editar, puede_autorizar, updated_at, updated_por
          FROM permisos_usuario WHERE modulo = 'transferencias'
          ON CONFLICT (usuario_id, modulo) DO UPDATE SET
            puede_ver = EXCLUDED.puede_ver,
            puede_crear = EXCLUDED.puede_crear,
            puede_editar = EXCLUDED.puede_editar,
            puede_autorizar = EXCLUDED.puede_autorizar,
            updated_at = EXCLUDED.updated_at,
            updated_por = EXCLUDED.updated_por;
        END IF;
      END $$;
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}