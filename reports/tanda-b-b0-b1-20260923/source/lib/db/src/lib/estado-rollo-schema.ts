import type { Pool } from "pg";

/**
 * Retires the legacy ABIERTO state without deleting roll or ledger history.
 * Repeatable so every installation can run it safely during API startup.
 */
export async function ensureEstadoRolloSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      DO $migration$
      DECLARE
        current_values text[];
      BEGIN
        IF EXISTS (
          SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'estado_rollo'
             AND e.enumlabel = 'ABIERTO'
        ) AND NOT EXISTS (
          SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'estado_rollo'
             AND e.enumlabel = 'MOSTRADOR'
        ) THEN
          ALTER TYPE estado_rollo RENAME VALUE 'ABIERTO' TO 'MOSTRADOR';
        END IF;

        SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
          INTO current_values
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'estado_rollo';

        IF current_values <> ARRAY[
          'PROGRAMADO', 'DISPONIBLE', 'EN_TRANSITO',
          'MOSTRADOR', 'VENDIDO', 'BAJA'
        ] THEN
          UPDATE rollos
             SET estado = 'MOSTRADOR'
           WHERE estado::text = 'ABIERTO';

          DROP TYPE IF EXISTS estado_rollo_replacement;
          CREATE TYPE estado_rollo_replacement AS ENUM (
            'PROGRAMADO', 'DISPONIBLE', 'EN_TRANSITO',
            'MOSTRADOR', 'VENDIDO', 'BAJA'
          );
          ALTER TABLE rollos ALTER COLUMN estado DROP DEFAULT;
          ALTER TABLE rollos ALTER COLUMN estado TYPE estado_rollo_replacement
            USING estado::text::estado_rollo_replacement;
          DROP TYPE estado_rollo;
          ALTER TYPE estado_rollo_replacement RENAME TO estado_rollo;
          ALTER TABLE rollos ALTER COLUMN estado SET DEFAULT 'PROGRAMADO';
        END IF;
      END
      $migration$;

      UPDATE rollos
         SET cantidad_actual = 0,
             updated_at = now()
       WHERE estado = 'MOSTRADOR'
         AND cantidad_actual <> 0;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}