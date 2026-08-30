import type { Pool } from "pg";

/**
 * Adds the typed reason carried only by extraordinary inventory write-offs.
 * Repeatable so installations created before the feature upgrade safely.
 */
export async function ensureExtraordinaryExitsSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      DO $migration$
      DECLARE
        current_values text[];
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'motivo_salida_extraordinaria'
        ) THEN
          CREATE TYPE motivo_salida_extraordinaria AS ENUM (
            'MERMA', 'ROBO', 'MUESTRA'
          );
        END IF;

        SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
          INTO current_values
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'motivo_salida_extraordinaria';
        IF current_values <> ARRAY['MERMA', 'ROBO', 'MUESTRA'] THEN
          RAISE EXCEPTION
            'motivo_salida_extraordinaria has unexpected values: %',
            current_values;
        END IF;
      END
      $migration$;

      ALTER TABLE movimientos
        ADD COLUMN IF NOT EXISTS motivo_salida_extraordinaria
          motivo_salida_extraordinaria;

      CREATE INDEX IF NOT EXISTS movimientos_motivo_salida_extraordinaria_idx
        ON movimientos (motivo_salida_extraordinaria);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}