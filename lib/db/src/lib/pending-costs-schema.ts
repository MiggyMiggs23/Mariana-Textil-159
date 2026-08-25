import type { Pool } from "pg";

/**
 * Repeatable upgrade for cost-pending receptions and the BODEGA baseline.
 * Role rows changed by an administrator (updated_por is non-null) are never
 * overwritten.
 */
export async function ensurePendingCostsSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE rollos ALTER COLUMN costo_unitario DROP NOT NULL;
      ALTER TABLE rollos ALTER COLUMN costo_total DROP NOT NULL;
      ALTER TABLE entradas ALTER COLUMN total_costo DROP NOT NULL;

      DO $$ BEGIN
        IF to_regclass('public.permisos_rol') IS NOT NULL THEN
          INSERT INTO permisos_rol
            (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
          VALUES
            ('BODEGA', 'dashboard', true, false, false, false),
            ('BODEGA', 'inventario', true, false, false, false),
            ('BODEGA', 'entradas', true, true, false, false),
            ('BODEGA', 'salidas', true, true, false, false),
            ('BODEGA', 'movimientos', true, false, false, false),
            ('BODEGA', 'ajustes', true, true, false, false)
          ON CONFLICT (rol, modulo) DO UPDATE SET
            puede_ver = EXCLUDED.puede_ver,
            puede_crear = EXCLUDED.puede_crear,
            puede_editar = EXCLUDED.puede_editar,
            puede_autorizar = EXCLUDED.puede_autorizar,
            updated_at = now()
          WHERE permisos_rol.updated_por IS NULL;

          UPDATE permisos_rol
          SET puede_ver = false, puede_crear = false, puede_editar = false,
              puede_autorizar = false, updated_at = now()
          WHERE rol = 'BODEGA'
            AND modulo NOT IN
              ('dashboard','inventario','entradas','salidas','movimientos','ajustes')
            AND updated_por IS NULL;

          DELETE FROM permisos_rol WHERE rol = 'ADMIN';
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