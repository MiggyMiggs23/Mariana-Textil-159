import type { Pool } from "pg";

/** Repeatable startup migration; defaults only overwrite uncustomized role rows. */
export async function ensureEtiquetasSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS reimpresiones_etiqueta (
        id serial PRIMARY KEY,
        rollo_id integer NOT NULL REFERENCES rollos(id),
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        autorizado_por integer REFERENCES usuarios(id),
        motivo text NOT NULL,
        sitio_id integer NOT NULL REFERENCES ubicaciones(id),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS reimpresiones_etiqueta_rollo_idx
        ON reimpresiones_etiqueta (rollo_id);
      CREATE INDEX IF NOT EXISTS reimpresiones_etiqueta_created_at_idx
        ON reimpresiones_etiqueta (created_at);
      CREATE INDEX IF NOT EXISTS reimpresiones_etiqueta_usuario_idx
        ON reimpresiones_etiqueta (usuario_id);

      ALTER TABLE reimpresiones_etiqueta
        ADD COLUMN IF NOT EXISTS serie_snapshot text,
        ADD COLUMN IF NOT EXISTS sku_snapshot text,
        ADD COLUMN IF NOT EXISTS producto_snapshot text,
        ADD COLUMN IF NOT EXISTS tela_snapshot text,
        ADD COLUMN IF NOT EXISTS color_snapshot text,
        ADD COLUMN IF NOT EXISTS solicitante_nombre_snapshot text,
        ADD COLUMN IF NOT EXISTS solicitante_usuario_snapshot text,
        ADD COLUMN IF NOT EXISTS autorizador_nombre_snapshot text,
        ADD COLUMN IF NOT EXISTS autorizador_usuario_snapshot text,
        ADD COLUMN IF NOT EXISTS sitio_nombre_snapshot text;

      UPDATE reimpresiones_etiqueta re SET
        serie_snapshot = r.serie,
        sku_snapshot = p.sku,
        producto_snapshot = p.tela || ' ' || p.color,
        tela_snapshot = p.tela,
        color_snapshot = p.color,
        solicitante_nombre_snapshot = (SELECT nombre FROM usuarios WHERE id = re.usuario_id),
        solicitante_usuario_snapshot = (SELECT usuario FROM usuarios WHERE id = re.usuario_id),
        autorizador_nombre_snapshot = (SELECT nombre FROM usuarios WHERE id = re.autorizado_por),
        autorizador_usuario_snapshot = (SELECT usuario FROM usuarios WHERE id = re.autorizado_por),
        sitio_nombre_snapshot = (SELECT nombre FROM ubicaciones WHERE id = re.sitio_id)
      FROM rollos r
      JOIN productos p ON p.id = r.producto_id
      WHERE re.rollo_id = r.id
        AND (re.serie_snapshot IS NULL OR re.sku_snapshot IS NULL
          OR re.producto_snapshot IS NULL OR re.tela_snapshot IS NULL
          OR re.color_snapshot IS NULL OR re.solicitante_nombre_snapshot IS NULL
          OR re.solicitante_usuario_snapshot IS NULL OR re.sitio_nombre_snapshot IS NULL);

      ALTER TABLE reimpresiones_etiqueta
        ALTER COLUMN serie_snapshot SET NOT NULL,
        ALTER COLUMN sku_snapshot SET NOT NULL,
        ALTER COLUMN producto_snapshot SET NOT NULL,
        ALTER COLUMN tela_snapshot SET NOT NULL,
        ALTER COLUMN color_snapshot SET NOT NULL,
        ALTER COLUMN solicitante_nombre_snapshot SET NOT NULL,
        ALTER COLUMN solicitante_usuario_snapshot SET NOT NULL,
        ALTER COLUMN sitio_nombre_snapshot SET NOT NULL;

      -- A review is a separate append-only control event.  It never marks a
      -- reprint row as mutable or deletes/replaces audit evidence.
      CREATE TABLE IF NOT EXISTS revisiones_etiqueta (
        id serial PRIMARY KEY,
        rollo_id integer NOT NULL REFERENCES rollos(id),
        reimpresion_id integer NOT NULL REFERENCES reimpresiones_etiqueta(id),
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        revisor_nombre_snapshot text NOT NULL,
        revisor_usuario_snapshot text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS revisiones_etiqueta_rollo_reimpresion_uidx
        ON revisiones_etiqueta (rollo_id, reimpresion_id);
      CREATE INDEX IF NOT EXISTS revisiones_etiqueta_rollo_idx
        ON revisiones_etiqueta (rollo_id);
      CREATE INDEX IF NOT EXISTS revisiones_etiqueta_created_at_idx
        ON revisiones_etiqueta (created_at);
      CREATE INDEX IF NOT EXISTS revisiones_etiqueta_usuario_idx
        ON revisiones_etiqueta (usuario_id);

      CREATE OR REPLACE FUNCTION validar_revision_etiqueta_reimpresion()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM reimpresiones_etiqueta re
          WHERE re.id = NEW.reimpresion_id
            AND re.rollo_id = NEW.rollo_id
        ) THEN
          RAISE EXCEPTION 'La revisión no corresponde a la última reimpresión del rollo';
        END IF;
        RETURN NEW;
      END;
      $$;
      DROP TRIGGER IF EXISTS revisiones_etiqueta_reimpresion_fk_check
        ON revisiones_etiqueta;
      CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check
        BEFORE INSERT OR UPDATE ON revisiones_etiqueta
        FOR EACH ROW EXECUTE FUNCTION validar_revision_etiqueta_reimpresion();

      CREATE OR REPLACE FUNCTION bloquear_mutacion_revision_etiqueta()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'revisiones_etiqueta es un historial append-only';
      END;
      $$;
      DROP TRIGGER IF EXISTS revisiones_etiqueta_inmutable ON revisiones_etiqueta;
      CREATE TRIGGER revisiones_etiqueta_inmutable
        BEFORE UPDATE OR DELETE ON revisiones_etiqueta
        FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_revision_etiqueta();

      CREATE OR REPLACE FUNCTION bloquear_mutacion_reimpresion_etiqueta()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF current_setting('app.etiquetas_cleanup', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'reimpresiones_etiqueta es un registro inmutable';
      END;
      $$;
      DROP TRIGGER IF EXISTS reimpresiones_etiqueta_inmutable ON reimpresiones_etiqueta;
      CREATE TRIGGER reimpresiones_etiqueta_inmutable
        BEFORE UPDATE OR DELETE ON reimpresiones_etiqueta
        FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_reimpresion_etiqueta();

      INSERT INTO permisos_rol
        (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
      VALUES
        ('SUPERVISOR', 'etiquetas', true, true, false, false),
        ('BODEGA', 'etiquetas', true, true, false, false),
        ('TERMINAL', 'etiquetas', false, false, false, false),
        ('CAJA', 'etiquetas', false, false, false, false)
      ON CONFLICT (rol, modulo) DO UPDATE SET
        puede_ver = EXCLUDED.puede_ver,
        puede_crear = EXCLUDED.puede_crear,
        puede_editar = EXCLUDED.puede_editar,
        puede_autorizar = EXCLUDED.puede_autorizar
      WHERE permisos_rol.updated_por IS NULL;

      DELETE FROM permisos_rol WHERE rol = 'ADMIN' AND modulo = 'etiquetas';
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}