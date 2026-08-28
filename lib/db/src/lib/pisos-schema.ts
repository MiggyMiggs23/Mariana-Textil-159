import type { Pool } from "pg";

/** Repeatable, data-preserving installation of the optional floor catalog. */
export async function ensurePisosSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7003058)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS pisos (
        id serial PRIMARY KEY,
        ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
        nombre text NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pisos_nombre_no_vacio CHECK (length(btrim(nombre)) > 0)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS pisos_ubicacion_nombre_ci_unique
        ON pisos (ubicacion_id, lower(nombre));
      ALTER TABLE rollos ADD COLUMN IF NOT EXISTS piso_id integer REFERENCES pisos(id);
      CREATE INDEX IF NOT EXISTS rollos_piso_idx ON rollos(piso_id);
      ALTER TABLE auditoria_inventario_snapshot
        ADD COLUMN IF NOT EXISTS piso_snapshot_id integer REFERENCES pisos(id),
        ADD COLUMN IF NOT EXISTS piso_snapshot text;
      ALTER TABLE auditoria_inventario_escaneos
        ADD COLUMN IF NOT EXISTS piso_real_id integer REFERENCES pisos(id),
        ADD COLUMN IF NOT EXISTS piso_real text;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}