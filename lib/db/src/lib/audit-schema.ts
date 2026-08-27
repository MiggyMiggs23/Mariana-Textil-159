import type { Pool } from "pg";

/**
 * Repeatable startup migration. Existing rows intentionally remain without
 * snapshots: current user data must never be presented as historical evidence.
 * The trigger centralizes enrichment for every SQL/Drizzle INSERT.
 */
export async function ensureAuditSchema(
  pool: Pick<Pool, "connect">,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE auditoria
        ADD COLUMN IF NOT EXISTS usuario_snapshot text,
        ADD COLUMN IF NOT EXISTS rol_snapshot text,
        ADD COLUMN IF NOT EXISTS sitio_id integer REFERENCES ubicaciones(id),
        ADD COLUMN IF NOT EXISTS sitio_snapshot text,
        ADD COLUMN IF NOT EXISTS modulo text;

      CREATE OR REPLACE FUNCTION enriquecer_auditoria()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        usuario_nombre text;
        usuario_rol text;
        usuario_sitio integer;
        sitio_nombre text;
      BEGIN
        IF NEW.usuario_id IS NOT NULL THEN
          SELECT usuario, rol::text, ubicacion_id
            INTO usuario_nombre, usuario_rol, usuario_sitio
            FROM usuarios WHERE id = NEW.usuario_id;
          NEW.usuario_snapshot := COALESCE(NEW.usuario_snapshot, usuario_nombre);
          NEW.rol_snapshot := COALESCE(NEW.rol_snapshot, usuario_rol);
          NEW.sitio_id := COALESCE(NEW.sitio_id, usuario_sitio);
        END IF;
        IF NEW.sitio_id IS NOT NULL AND NEW.sitio_snapshot IS NULL THEN
          SELECT nombre INTO sitio_nombre FROM ubicaciones WHERE id = NEW.sitio_id;
          NEW.sitio_snapshot := sitio_nombre;
        END IF;
        NEW.modulo := COALESCE(NEW.modulo,
          CASE
            WHEN NEW.accion LIKE 'LOGIN_%' OR NEW.accion = 'LOGOUT' OR NEW.entidad = 'sesiones' THEN 'auth'
            WHEN NEW.entidad IN ('usuarios', 'permisos_usuario', 'permisos_rol') THEN 'usuarios'
            WHEN NEW.entidad IN ('ubicaciones') THEN 'ubicaciones'
            WHEN NEW.entidad IN ('productos', 'precios_producto') THEN 'productos'
            WHEN NEW.entidad IN ('proveedores', 'compras', 'pagos_proveedor') THEN 'proveedores'
            WHEN NEW.entidad LIKE 'cliente%' OR NEW.entidad = 'movimientos_credito' THEN 'clientes'
            WHEN NEW.entidad IN ('tickets', 'ticket_pagos') THEN 'pos'
            WHEN NEW.entidad = 'sesiones_caja' THEN 'caja'
            WHEN NEW.entidad IN ('salidas', 'salida_rollos') THEN 'salidas'
            WHEN NEW.entidad IN ('reimpresiones_etiqueta') THEN 'etiquetas'
            WHEN NEW.entidad IN ('rollos', 'entradas', 'movimientos', 'existencias') THEN 'inventario'
            WHEN NEW.entidad LIKE 'contenedor%' THEN 'contenedores'
            ELSE NEW.entidad
          END);
        RETURN NEW;
      END;
      $$;
      DROP TRIGGER IF EXISTS auditoria_enriquecer_insert ON auditoria;
      CREATE TRIGGER auditoria_enriquecer_insert
        BEFORE INSERT ON auditoria
        FOR EACH ROW EXECUTE FUNCTION enriquecer_auditoria();

       CREATE OR REPLACE FUNCTION proteger_auditoria_append_only()
       RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF current_database() = 'parte5_audit_test_20260827'
            AND current_setting('app.audit_test_cleanup', true) = 'on' THEN
           RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
         END IF;
         RAISE EXCEPTION 'auditoria es append-only';
       END;
       $$;
       DROP TRIGGER IF EXISTS auditoria_append_only ON auditoria;
       CREATE TRIGGER auditoria_append_only
         BEFORE UPDATE OR DELETE ON auditoria
         FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_append_only();

      CREATE INDEX IF NOT EXISTS auditoria_created_idx ON auditoria (created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS auditoria_modulo_created_idx ON auditoria (modulo, created_at DESC);
      CREATE INDEX IF NOT EXISTS auditoria_sitio_created_idx ON auditoria (sitio_id, created_at DESC);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}