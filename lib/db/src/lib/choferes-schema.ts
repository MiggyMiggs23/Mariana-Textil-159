import type { Pool } from "pg";

/** Repeatable, history-preserving schema upgrade for the driver catalog. */
export async function ensureChoferesSchema(
  pool: Pick<Pool, "connect">,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7003004)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS choferes (
        id serial PRIMARY KEY,
        nombre_completo text NOT NULL,
        telefono text NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS choferes_activo_idx ON choferes (activo);
      CREATE INDEX IF NOT EXISTS choferes_nombre_completo_idx ON choferes (nombre_completo);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
