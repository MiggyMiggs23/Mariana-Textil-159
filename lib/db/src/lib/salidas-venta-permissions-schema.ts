import type { Pool } from "pg";

/**
 * Installs the location-scoped SALIDAS_VENTA permission defaults. The module
 * is denied at role level and enabled by inherited site configuration only at
 * Mariana. Rows explicitly customized by an administrator are never changed.
 */
export async function ensureSalidasVentaPermissions(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permisos_ubicacion (
      id serial PRIMARY KEY,
      ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
      rol rol_usuario NOT NULL,
      modulo text NOT NULL,
      puede_ver boolean NOT NULL DEFAULT false,
      puede_crear boolean NOT NULL DEFAULT false,
      puede_editar boolean NOT NULL DEFAULT false,
      puede_autorizar boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_por integer REFERENCES usuarios(id),
      CONSTRAINT permisos_ubicacion_ubicacion_rol_modulo_unique
        UNIQUE (ubicacion_id, rol, modulo)
    );

    -- Upgrade installations that may have created the location table before
    -- role-scoped defaults were introduced. These are permission metadata rows,
    -- not operational records, so widening the key is non-destructive.
    ALTER TABLE permisos_ubicacion
      ADD COLUMN IF NOT EXISTS rol rol_usuario NOT NULL DEFAULT 'TERMINAL',
      ADD COLUMN IF NOT EXISTS modulo text NOT NULL DEFAULT 'salidas_venta',
      ADD COLUMN IF NOT EXISTS puede_ver boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS puede_crear boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS puede_editar boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS puede_autorizar boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_por integer REFERENCES usuarios(id);
    ALTER TABLE permisos_ubicacion
      ALTER COLUMN rol DROP DEFAULT,
      ALTER COLUMN modulo DROP DEFAULT;
    UPDATE permisos_ubicacion
       SET rol = 'TERMINAL'
     WHERE rol IS NULL;
    UPDATE permisos_ubicacion
       SET modulo = 'salidas_venta'
     WHERE modulo IS NULL;
    ALTER TABLE permisos_ubicacion
      ALTER COLUMN rol SET NOT NULL,
      ALTER COLUMN modulo SET NOT NULL;
    ALTER TABLE permisos_ubicacion
      DROP CONSTRAINT IF EXISTS permisos_ubicacion_ubicacion_modulo_unique;
    DO $constraint$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'permisos_ubicacion_ubicacion_rol_modulo_unique'
           AND conrelid = 'permisos_ubicacion'::regclass
      ) THEN
        ALTER TABLE permisos_ubicacion
          ADD CONSTRAINT permisos_ubicacion_ubicacion_rol_modulo_unique
          UNIQUE (ubicacion_id, rol, modulo);
      END IF;
    END $constraint$;

    INSERT INTO permisos_rol
      (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
    SELECT rol, 'salidas_venta', false, false, false, false
      FROM unnest(ARRAY[
        'TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'SISTEMAS', 'CONTADOR'
      ]::rol_usuario[]) AS seeded_role(rol)
    ON CONFLICT (rol, modulo) DO UPDATE SET
      puede_ver = false,
      puede_crear = false,
      puede_editar = false,
      puede_autorizar = false,
      updated_at = now()
    WHERE permisos_rol.updated_por IS NULL;

    INSERT INTO permisos_ubicacion
      (ubicacion_id, rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
    SELECT id, rol, 'salidas_venta',
           lower(btrim(nombre)) = 'mariana' AND rol = 'TERMINAL',
           lower(btrim(nombre)) = 'mariana' AND rol = 'TERMINAL',
           false,
           false
      FROM ubicaciones
      CROSS JOIN unnest(ARRAY[
        'TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'SISTEMAS', 'CONTADOR'
      ]::rol_usuario[]) AS rol
     WHERE tipo IN ('TIENDA', 'BODEGA')
    ON CONFLICT (ubicacion_id, rol, modulo) DO UPDATE SET
      puede_ver = EXCLUDED.puede_ver,
      puede_crear = EXCLUDED.puede_crear,
      puede_editar = EXCLUDED.puede_editar,
      puede_autorizar = EXCLUDED.puede_autorizar,
      updated_at = now()
    WHERE permisos_ubicacion.updated_por IS NULL;
  `);
}