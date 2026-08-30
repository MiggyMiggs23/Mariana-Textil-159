import type { Pool } from "pg";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "./advisory-locks.mjs";

/** Repeatable, history-preserving schema upgrade for the vehicle catalog. */
export async function ensureCamionetasSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await transactionAdvisoryLock(client, ADVISORY_LOCK_NAMESPACES.SCHEMA_CAMIONETAS);
    await client.query(`
      CREATE TABLE IF NOT EXISTS camionetas (
        id serial PRIMARY KEY,
        nombre text NOT NULL,
        placas text NOT NULL,
        marca text,
        modelo text,
        tipo text NOT NULL,
        activa boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT camionetas_tipo_check CHECK (tipo IN ('PROPIA', 'CONTRATADA'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS camionetas_placas_unique ON camionetas (placas);
      CREATE INDEX IF NOT EXISTS camionetas_activa_idx ON camionetas (activa);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}