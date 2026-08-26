import type { Pool } from "pg";

/** Repeatable upgrade from global to site-scoped document folios. */
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

       -- An ENTRADA movement historically stored the old global folio in
       -- documento_id. Convert that reference before renumbering folios. This
       -- block only runs while the old one-column unique constraint exists,
       -- making the data conversion safe to repeat.
       DO $folios$
       DECLARE
         constraint_row record;
         index_row record;
         has_global_unique boolean := false;
       BEGIN
         -- The roll itself is the stable source of truth for the entry that
         -- received it. Repair legacy movement references even on databases
         -- where folios were already migrated by an earlier startup.
         UPDATE movimientos m
            SET documento_id = r.recepcion_id::text
           FROM rollos r
          WHERE m.documento_tipo = 'ENTRADA'
            AND m.rollo_id = r.id
            AND r.recepcion_id IS NOT NULL
            AND m.documento_id IS DISTINCT FROM r.recepcion_id::text;

         SELECT EXISTS (
           SELECT 1
             FROM pg_constraint c
            WHERE c.conrelid = 'entradas'::regclass
              AND c.contype = 'u'
              AND pg_get_constraintdef(c.oid) ~ '^UNIQUE \(folio\)'
           UNION ALL
           SELECT 1
             FROM pg_index i
            WHERE i.indrelid = 'entradas'::regclass
              AND i.indisunique
              AND pg_get_indexdef(i.indexrelid) ~ 'UNIQUE INDEX .+ \(folio\)$'
         ) INTO has_global_unique;

         -- Remove every legacy unique constraint/index that applies only to
         -- folio. Composite uniqueness is installed below.
         FOR constraint_row IN
           SELECT c.conname
             FROM pg_constraint c
            WHERE c.conrelid = 'entradas'::regclass
              AND c.contype = 'u'
              AND pg_get_constraintdef(c.oid) ~ '^UNIQUE \(folio\)'
         LOOP
           EXECUTE format(
             'ALTER TABLE entradas DROP CONSTRAINT %I',
             constraint_row.conname
           );
         END LOOP;
         FOR index_row IN
           SELECT i.indexrelid::regclass AS name
             FROM pg_index i
            WHERE i.indrelid = 'entradas'::regclass
              AND i.indisunique
              AND pg_get_indexdef(i.indexrelid) ~ 'UNIQUE INDEX .+ \(folio\)$'
         LOOP
           EXECUTE format('DROP INDEX %s', index_row.name);
         END LOOP;

         IF has_global_unique THEN
           WITH renumeradas AS (
             SELECT id,
                    row_number() OVER (
                      PARTITION BY ubicacion_id
                      ORDER BY created_at, id
                    )::integer AS nuevo_folio
               FROM entradas
           )
           UPDATE entradas e
              SET folio = r.nuevo_folio
             FROM renumeradas r
            WHERE e.id = r.id;
         END IF;

         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conname = 'entradas_ubicacion_folio_uidx'
              AND conrelid = 'entradas'::regclass
         ) THEN
           CREATE UNIQUE INDEX IF NOT EXISTS entradas_ubicacion_folio_uidx
             ON entradas (ubicacion_id, folio);
         END IF;

         -- Replace the legacy singleton counters with one counter per site.
         -- Counters are derived from persisted documents, never from the
         -- previous global counter, so no existing document row is removed.
         ALTER TABLE entrada_folio DROP CONSTRAINT IF EXISTS entrada_folio_pkey;
         ALTER TABLE entrada_folio DROP COLUMN IF EXISTS id;
         ALTER TABLE entrada_folio ADD COLUMN IF NOT EXISTS ubicacion_id integer;
         DELETE FROM entrada_folio;
         INSERT INTO entrada_folio (ubicacion_id, ultimo_folio)
           SELECT u.id, COALESCE(MAX(e.folio), 0)
             FROM ubicaciones u
             LEFT JOIN entradas e ON e.ubicacion_id = u.id
            GROUP BY u.id;
         ALTER TABLE entrada_folio ALTER COLUMN ubicacion_id SET NOT NULL;
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'entrada_folio_pkey'
         ) THEN
           ALTER TABLE entrada_folio
             ADD CONSTRAINT entrada_folio_pkey PRIMARY KEY (ubicacion_id);
         END IF;
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'entrada_folio_ubicacion_fkey'
         ) THEN
           ALTER TABLE entrada_folio
             ADD CONSTRAINT entrada_folio_ubicacion_fkey
             FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
         END IF;

         IF to_regclass('public.salidas') IS NOT NULL THEN
           SELECT EXISTS (
             SELECT 1
               FROM pg_constraint c
              WHERE c.conrelid = 'salidas'::regclass
                AND c.contype = 'u'
                AND pg_get_constraintdef(c.oid) ~ '^UNIQUE \(folio\)'
             UNION ALL
             SELECT 1
               FROM pg_index i
              WHERE i.indrelid = 'salidas'::regclass
                AND i.indisunique
                AND pg_get_indexdef(i.indexrelid) ~ 'UNIQUE INDEX .+ \(folio\)$'
           ) INTO has_global_unique;
           FOR constraint_row IN
             SELECT c.conname FROM pg_constraint c
              WHERE c.conrelid = 'salidas'::regclass AND c.contype = 'u'
                AND pg_get_constraintdef(c.oid) ~ '^UNIQUE \(folio\)'
           LOOP
             EXECUTE format('ALTER TABLE salidas DROP CONSTRAINT %I', constraint_row.conname);
           END LOOP;
           FOR index_row IN
             SELECT i.indexrelid::regclass AS name FROM pg_index i
              WHERE i.indrelid = 'salidas'::regclass AND i.indisunique
                AND pg_get_indexdef(i.indexrelid) ~ 'UNIQUE INDEX .+ \(folio\)$'
           LOOP
             EXECUTE format('DROP INDEX %s', index_row.name);
           END LOOP;
           IF has_global_unique THEN
             WITH renumeradas AS (
               SELECT id,
                      row_number() OVER (
                        PARTITION BY origen_id
                        ORDER BY created_at, id
                      )::integer AS nuevo_folio
                 FROM salidas
             )
             UPDATE salidas s
                SET folio = r.nuevo_folio
               FROM renumeradas r
              WHERE s.id = r.id;
           END IF;
           CREATE UNIQUE INDEX IF NOT EXISTS salidas_origen_folio_uidx
             ON salidas (origen_id, folio);

           ALTER TABLE salida_folio DROP CONSTRAINT IF EXISTS salida_folio_pkey;
           ALTER TABLE salida_folio DROP COLUMN IF EXISTS id;
           ALTER TABLE salida_folio ADD COLUMN IF NOT EXISTS ubicacion_id integer;
           DELETE FROM salida_folio;
           INSERT INTO salida_folio (ubicacion_id, ultimo_folio)
             SELECT u.id, COALESCE(MAX(s.folio), 0)
               FROM ubicaciones u
               LEFT JOIN salidas s ON s.origen_id = u.id
              GROUP BY u.id;
           ALTER TABLE salida_folio ALTER COLUMN ubicacion_id SET NOT NULL;
           IF NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'salida_folio_pkey'
           ) THEN
             ALTER TABLE salida_folio
               ADD CONSTRAINT salida_folio_pkey PRIMARY KEY (ubicacion_id);
           END IF;
           IF NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'salida_folio_ubicacion_fkey'
           ) THEN
             ALTER TABLE salida_folio
               ADD CONSTRAINT salida_folio_ubicacion_fkey
               FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
           END IF;
         END IF;
       END
       $folios$;

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