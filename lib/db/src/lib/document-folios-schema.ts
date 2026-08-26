import type { Pool } from "pg";

/**
 * Repeatable schema upgrade for site initials. Folio counters and document
 * migration are added in the next scoped block.
 */
export async function ensureDocumentFoliosSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE ubicaciones ADD COLUMN IF NOT EXISTS iniciales text;

      UPDATE ubicaciones
         SET iniciales = CASE nombre
           WHEN 'Mariana' THEN 'MA'
           WHEN 'Cruces' THEN 'CR'
           WHEN 'Coco' THEN 'CO'
           WHEN 'Tomás' THEN 'TO'
           WHEN 'Don Nacho' THEN 'DN'
           WHEN 'Lucas Alamán' THEN 'LA'
           WHEN 'Bodega Cruces' THEN 'BC'
           WHEN 'En tránsito' THEN 'TR'
           WHEN 'Externo' THEN 'EX'
           ELSE iniciales
         END
       WHERE iniciales IS NULL;

      DO $initials$
      DECLARE
        location_row record;
        candidate text;
        candidate_number integer := 0;
      BEGIN
        FOR location_row IN
          SELECT id FROM ubicaciones WHERE iniciales IS NULL ORDER BY id
        LOOP
          LOOP
            candidate :=
              chr(65 + ((candidate_number / 676) % 26)) ||
              chr(65 + ((candidate_number / 26) % 26)) ||
              chr(65 + (candidate_number % 26));
            candidate_number := candidate_number + 1;
            EXIT WHEN NOT EXISTS (
              SELECT 1 FROM ubicaciones WHERE iniciales = candidate
            );
          END LOOP;
          UPDATE ubicaciones SET iniciales = candidate WHERE id = location_row.id;
        END LOOP;
      END
      $initials$;

      ALTER TABLE ubicaciones ALTER COLUMN iniciales SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS ubicaciones_iniciales_uidx
        ON ubicaciones (iniciales);

      DO $constraint$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_constraint
           WHERE conname = 'ubicaciones_iniciales_formato_check'
             AND conrelid = 'ubicaciones'::regclass
        ) THEN
          ALTER TABLE ubicaciones
            ADD CONSTRAINT ubicaciones_iniciales_formato_check
            CHECK (iniciales ~ '^[A-Z]{2,3}$');
        END IF;
      END
      $constraint$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}