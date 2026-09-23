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
      DO $migration$
      DECLARE
        unknown_state text;
        current_values text[];
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_salida') THEN
          CREATE TYPE estado_salida AS ENUM ('ARMANDO', 'EN_TRANSITO', 'RECIBIDA', 'ENTREGADA', 'CANCELADA');
        ELSE
          SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
            INTO current_values
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'estado_salida';

          IF current_values <> ARRAY['ARMANDO', 'EN_TRANSITO', 'RECIBIDA', 'ENTREGADA', 'CANCELADA'] THEN
            IF to_regclass('public.salidas') IS NOT NULL THEN
              SELECT estado::text INTO unknown_state
                FROM salidas
               WHERE estado::text NOT IN (
                 'REGISTRADA', 'SOLICITADA', 'ACEPTADA', 'PREPARADA',
                 'ENVIADA', 'RECIBIDA', 'CERRADA', 'RECHAZADA', 'CANCELADA',
                  'ARMANDO', 'EN_TRANSITO', 'ENTREGADA'
               )
               LIMIT 1;
              IF unknown_state IS NOT NULL THEN
                RAISE EXCEPTION 'Estado de salida sin mapeo: %', unknown_state;
              END IF;
            END IF;

            DROP TYPE IF EXISTS estado_salida_replacement;
            CREATE TYPE estado_salida_replacement AS ENUM (
              'ARMANDO', 'EN_TRANSITO', 'RECIBIDA', 'ENTREGADA', 'CANCELADA'
            );
            IF to_regclass('public.salidas') IS NOT NULL THEN
              -- A partial-index predicate stores an expression typed with the
              -- current enum. PostgreSQL cannot rewrite that predicate while
              -- the column is changing to the replacement enum, so remove it
              -- transactionally and recreate it below after the type swap.
              DROP INDEX IF EXISTS salidas_borrador_usuario_origen_uidx;
              ALTER TABLE salidas ALTER COLUMN estado DROP DEFAULT;
              ALTER TABLE salidas ALTER COLUMN estado TYPE estado_salida_replacement
                USING (
                  CASE
                    WHEN estado::text IN ('REGISTRADA', 'SOLICITADA', 'ACEPTADA', 'PREPARADA', 'ARMANDO') THEN 'ARMANDO'
                    WHEN estado::text IN ('ENVIADA', 'EN_TRANSITO') THEN 'EN_TRANSITO'
                    WHEN estado::text IN ('RECIBIDA', 'CERRADA') THEN 'RECIBIDA'
                    WHEN estado::text = 'ENTREGADA' THEN 'ENTREGADA'
                    WHEN estado::text IN ('RECHAZADA', 'CANCELADA') THEN 'CANCELADA'
                  END
                )::estado_salida_replacement;
            END IF;
            DROP TYPE estado_salida;
            ALTER TYPE estado_salida_replacement RENAME TO estado_salida;
          END IF;
        END IF;
      END
      $migration$;

      CREATE TABLE IF NOT EXISTS salidas (
        id serial PRIMARY KEY,
         folio integer NOT NULL,
        origen_id integer NOT NULL REFERENCES ubicaciones(id),
        destino_id integer REFERENCES ubicaciones(id),
        cliente_id integer REFERENCES clientes(id),
        ticket_id integer REFERENCES tickets(id),
        modalidad text NOT NULL DEFAULT 'TRASLADO',
        estado estado_salida NOT NULL DEFAULT 'ARMANDO',
        usuario_solicita_id integer REFERENCES usuarios(id),
        usuario_acepta_id integer REFERENCES usuarios(id),
        usuario_prepara_id integer REFERENCES usuarios(id),
        usuario_envia_id integer REFERENCES usuarios(id),
        usuario_recibe_id integer REFERENCES usuarios(id),
        usuario_cierra_id integer REFERENCES usuarios(id),
        usuario_cancela_id integer REFERENCES usuarios(id),
        usuario_entrega_id integer REFERENCES usuarios(id),
        solicitada_at timestamptz,
        aceptada_at timestamptz,
        preparada_at timestamptz,
        enviada_at timestamptz,
        recibida_at timestamptz,
        cerrada_at timestamptz,
        cancelada_at timestamptz,
        entregada_at timestamptz,
        motivo_rechazo text,
        motivo_cancelacion text,
        nota_solicitud text,
        nota_envio text,
        nota_recepcion text,
        transportista text,
        uuid_cliente uuid NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        actividad_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE salidas
        ALTER COLUMN estado SET DEFAULT 'ARMANDO',
        ADD COLUMN IF NOT EXISTS modalidad text NOT NULL DEFAULT 'TRASLADO',
        ADD COLUMN IF NOT EXISTS cliente_id integer REFERENCES clientes(id),
        ADD COLUMN IF NOT EXISTS ticket_id integer REFERENCES tickets(id),
        ADD COLUMN IF NOT EXISTS usuario_cancela_id integer REFERENCES usuarios(id),
        ADD COLUMN IF NOT EXISTS usuario_entrega_id integer REFERENCES usuarios(id),
        ADD COLUMN IF NOT EXISTS cancelada_at timestamptz,
        ADD COLUMN IF NOT EXISTS entregada_at timestamptz,
        ADD COLUMN IF NOT EXISTS autorizado_por_id integer REFERENCES usuarios(id),
        ADD COLUMN IF NOT EXISTS actividad_at timestamptz;

      ALTER TABLE salidas ALTER COLUMN destino_id DROP NOT NULL;
      ALTER TABLE salidas DROP CONSTRAINT IF EXISTS salidas_modalidad_check;
      ALTER TABLE salidas ADD CONSTRAINT salidas_modalidad_check
        CHECK (modalidad IN ('TRASLADO', 'MOSTRADOR', 'VENTA_CLIENTE'));
      ALTER TABLE salidas DROP CONSTRAINT IF EXISTS salidas_venta_cliente_shape_check;
      ALTER TABLE salidas ADD CONSTRAINT salidas_venta_cliente_shape_check
        CHECK (modalidad <> 'VENTA_CLIENTE' OR (cliente_id IS NOT NULL AND destino_id IS NULL));
      ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS salida_id integer;
      DO $migration$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint AS constraint_definition
          JOIN pg_attribute AS constrained_column
            ON constrained_column.attrelid = constraint_definition.conrelid
           AND constrained_column.attnum = ANY(constraint_definition.conkey)
          WHERE constraint_definition.contype = 'f'
            AND constraint_definition.conrelid = 'public.movimientos'::regclass
            AND constraint_definition.confrelid = 'public.salidas'::regclass
            AND constrained_column.attname = 'salida_id'
        ) THEN
          ALTER TABLE movimientos
            ADD CONSTRAINT movimientos_salida_id_salidas_id_fk
            FOREIGN KEY (salida_id) REFERENCES salidas(id);
        END IF;
      END
      $migration$;
      CREATE INDEX IF NOT EXISTS movimientos_salida_idx ON movimientos (salida_id);

      UPDATE salidas
         SET actividad_at = COALESCE(
           recibida_at,
           enviada_at,
           cancelada_at,
           preparada_at,
           solicitada_at,
           created_at,
           now()
         )
       WHERE actividad_at IS NULL;

      ALTER TABLE salidas
        ALTER COLUMN actividad_at SET DEFAULT now(),
        ALTER COLUMN actividad_at SET NOT NULL;

      WITH duplicate_drafts AS (
        SELECT id,
               row_number() OVER (
                 PARTITION BY usuario_solicita_id, origen_id
                 ORDER BY actividad_at DESC, id DESC
               ) AS position
          FROM salidas
         WHERE estado = 'ARMANDO'
           AND usuario_solicita_id IS NOT NULL
      )
      UPDATE salidas AS s
         SET estado = 'CANCELADA',
             cancelada_at = now(),
             actividad_at = now(),
             motivo_cancelacion = COALESCE(
               s.motivo_cancelacion,
               'Borrador duplicado cerrado durante actualización'
             )
        FROM duplicate_drafts AS d
       WHERE s.id = d.id
         AND d.position > 1;

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
         ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id),
         ultimo_folio integer NOT NULL DEFAULT 0
      );

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

      CREATE INDEX IF NOT EXISTS salidas_origen_estado_idx ON salidas (origen_id, estado);
      CREATE INDEX IF NOT EXISTS salidas_destino_estado_idx ON salidas (destino_id, estado);
      CREATE INDEX IF NOT EXISTS salidas_cliente_estado_idx ON salidas (cliente_id, estado);
      CREATE INDEX IF NOT EXISTS salidas_ticket_idx ON salidas (ticket_id);
      CREATE INDEX IF NOT EXISTS salidas_estado_idx ON salidas (estado);
      CREATE INDEX IF NOT EXISTS salidas_folio_idx ON salidas (folio);
      CREATE INDEX IF NOT EXISTS salidas_created_at_idx ON salidas (created_at);
      CREATE INDEX IF NOT EXISTS salidas_estado_actividad_idx ON salidas (estado, actividad_at);
      DROP INDEX IF EXISTS salidas_borrador_usuario_origen_uidx;
      CREATE UNIQUE INDEX salidas_borrador_usuario_origen_uidx
        ON salidas (usuario_solicita_id, origen_id)
        WHERE estado = 'ARMANDO' AND modalidad = 'TRASLADO'
          AND usuario_solicita_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS salida_rollos_rollo_salida_idx ON salida_rollos (rollo_id, salida_id);
      CREATE INDEX IF NOT EXISTS salida_lineas_salida_idx ON salida_lineas (salida_id);
      CREATE INDEX IF NOT EXISTS salida_lineas_producto_idx ON salida_lineas (producto_id);
      CREATE INDEX IF NOT EXISTS salida_rollos_salida_idx ON salida_rollos (salida_id);
      CREATE INDEX IF NOT EXISTS salida_rollos_linea_idx ON salida_rollos (linea_id);
      CREATE INDEX IF NOT EXISTS salida_rollos_rollo_idx ON salida_rollos (rollo_id);
      CREATE INDEX IF NOT EXISTS notificaciones_sistema_leida_created_idx
        ON notificaciones_sistema (leida_at, created_at);

    `);

    // Migrate the legacy alias only into rows that were not explicitly
    // customized by an administrator.
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
            updated_por = EXCLUDED.updated_por
          WHERE permisos_rol.updated_por IS NULL;

          INSERT INTO permisos_rol (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
          VALUES
            ('TERMINAL', 'salidas', true, false, false, false),
            ('CAJA', 'salidas', true, false, false, false),
      ('SUPERVISOR', 'salidas', true, true, true, false),
            ('BODEGA', 'salidas', true, true, false, false)
          ON CONFLICT (rol, modulo) DO UPDATE SET
            puede_ver = EXCLUDED.puede_ver,
            puede_crear = EXCLUDED.puede_crear,
            puede_editar = EXCLUDED.puede_editar,
            puede_autorizar = EXCLUDED.puede_autorizar
          WHERE permisos_rol.updated_por IS NULL;

          -- Keep existing installations aligned with the documented CAJA
          -- defaults without overwriting rows explicitly customized by ADMIN.
          INSERT INTO permisos_rol
            (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
          VALUES
            ('CAJA', 'dashboard', false, false, false, false),
            ('CAJA', 'pos', false, false, false, false),
            ('CAJA', 'entradas', false, false, false, false),
            ('CAJA', 'movimientos', false, false, false, false),
            ('CAJA', 'inventario', true, false, false, false),
            ('CAJA', 'productos', false, false, false, false),
            ('CAJA', 'ajustes', false, false, false, false),
            ('CAJA', 'clientes', true, false, false, false),
            ('CAJA', 'clientes_credito', true, false, false, false),
            ('CAJA', 'clientes_precios', false, false, false, false),
            ('CAJA', 'clientes_finanzas', true, false, false, false),
            ('CAJA', 'proveedores', false, false, false, false),
            ('CAJA', 'proveedores_finanzas', false, false, false, false),
            ('CAJA', 'contenedores', false, false, false, false),
            ('CAJA', 'ubicaciones', false, false, false, false),
            ('CAJA', 'usuarios', false, false, false, false),
            ('CAJA', 'permisos', false, false, false, false),
            ('CAJA', 'resumen_caja', true, false, false, false),
            ('CAJA', 'cortes', true, true, false, false),
            ('CAJA', 'cobros_pagos', true, true, false, false),
            ('CAJA', 'reportes', false, false, false, false),
            ('CAJA', 'conciliacion', false, false, false, false),
            ('CAJA', 'auditoria', false, false, false, false)
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
            updated_por = EXCLUDED.updated_por
          WHERE permisos_usuario.updated_por IS NULL;
        END IF;
      END $$;
    `);

    const structure = await client.query<{
      has_column: boolean;
      has_foreign_key: boolean;
      has_index: boolean;
    }>(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'movimientos'
            AND column_name = 'salida_id'
            AND data_type = 'integer'
            AND is_nullable = 'YES'
        ) AS has_column,
        EXISTS (
          SELECT 1
          FROM pg_constraint AS constraint_definition
          JOIN pg_attribute AS constrained_column
            ON constrained_column.attrelid = constraint_definition.conrelid
           AND constrained_column.attnum = ANY(constraint_definition.conkey)
          WHERE constraint_definition.contype = 'f'
            AND constraint_definition.conrelid = 'public.movimientos'::regclass
            AND constraint_definition.confrelid = 'public.salidas'::regclass
            AND constrained_column.attname = 'salida_id'
        ) AS has_foreign_key,
        EXISTS (
          SELECT 1
          FROM pg_index AS index_definition
          JOIN pg_attribute AS indexed_column
            ON indexed_column.attrelid = index_definition.indrelid
           AND indexed_column.attnum = ANY(index_definition.indkey)
          WHERE index_definition.indrelid = 'public.movimientos'::regclass
            AND indexed_column.attname = 'salida_id'
            AND index_definition.indisvalid
        ) AS has_index
    `);
    const applied = structure.rows[0];
    const missing = [
      !applied?.has_column ? "columna movimientos.salida_id" : null,
      !applied?.has_foreign_key
        ? "FK movimientos.salida_id → salidas.id"
        : null,
      !applied?.has_index ? "índice sobre movimientos(salida_id)" : null,
    ].filter((item): item is string => item !== null);
    if (missing.length > 0) {
      throw new Error(
        `Inicializador de Salidas incompleto; faltan: ${missing.join(", ")}.`,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}