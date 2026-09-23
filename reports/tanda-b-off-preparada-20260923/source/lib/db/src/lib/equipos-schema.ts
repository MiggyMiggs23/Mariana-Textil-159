import type { Pool } from "pg";
import {
  CHECKLIST_KEYS_EQUIPO,
  TIPOS_EQUIPO,
} from "./equipos-catalog";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "./advisory-locks.mjs";

function sqlLiteralList(values: readonly string[]): string {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");
}

const tipoConstraintValues = sqlLiteralList(TIPOS_EQUIPO);
const checklistConstraintValues = sqlLiteralList(CHECKLIST_KEYS_EQUIPO);

/** Repeatable, structure-validating schema and permission baseline. */
export async function ensureEquiposSchema(
  pool: Pick<Pool, "connect">,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await transactionAdvisoryLock(
      client,
      ADVISORY_LOCK_NAMESPACES.SCHEMA_EQUIPOS,
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS equipos (
        id serial PRIMARY KEY,
        ubicacion_id integer NOT NULL,
        tipo text NOT NULL,
        identificador text NOT NULL,
        marca text NOT NULL,
        modelo text NOT NULL,
        numero_serie text,
        notas text,
        creado_por integer NOT NULL,
        actualizado_por integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE equipos
        ADD COLUMN IF NOT EXISTS id serial,
        ADD COLUMN IF NOT EXISTS ubicacion_id integer,
        ADD COLUMN IF NOT EXISTS tipo text,
        ADD COLUMN IF NOT EXISTS identificador text,
        ADD COLUMN IF NOT EXISTS marca text,
        ADD COLUMN IF NOT EXISTS modelo text,
        ADD COLUMN IF NOT EXISTS numero_serie text,
        ADD COLUMN IF NOT EXISTS notas text,
        ADD COLUMN IF NOT EXISTS creado_por integer,
        ADD COLUMN IF NOT EXISTS actualizado_por integer,
        ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
      CREATE SEQUENCE IF NOT EXISTS equipos_id_seq;
      ALTER SEQUENCE equipos_id_seq OWNED BY equipos.id;
      ALTER TABLE equipos
        ALTER COLUMN id SET DEFAULT nextval('equipos_id_seq');
      SELECT setval(
        'equipos_id_seq',
        COALESCE((SELECT max(id) + 1 FROM equipos), 1),
        false
      );
      UPDATE equipos SET created_at = now() WHERE created_at IS NULL;
      UPDATE equipos SET updated_at = now() WHERE updated_at IS NULL;
      ALTER TABLE equipos
        ALTER COLUMN id SET NOT NULL,
        ALTER COLUMN ubicacion_id SET NOT NULL,
        ALTER COLUMN tipo SET NOT NULL,
        ALTER COLUMN identificador SET NOT NULL,
        ALTER COLUMN marca SET NOT NULL,
        ALTER COLUMN modelo SET NOT NULL,
        ALTER COLUMN creado_por SET NOT NULL,
        ALTER COLUMN actualizado_por SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT now(),
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN updated_at SET DEFAULT now(),
        ALTER COLUMN updated_at SET NOT NULL;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos'::regclass AND contype = 'p'
        ) THEN
          ALTER TABLE equipos ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos'::regclass AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE
              'FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)%'
        ) THEN
          ALTER TABLE equipos ADD CONSTRAINT equipos_ubicacion_id_fkey
            FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos'::regclass AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE
              'FOREIGN KEY (creado_por) REFERENCES usuarios(id)%'
        ) THEN
          ALTER TABLE equipos ADD CONSTRAINT equipos_creado_por_fkey
            FOREIGN KEY (creado_por) REFERENCES usuarios(id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos'::regclass AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE
              'FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)%'
        ) THEN
          ALTER TABLE equipos ADD CONSTRAINT equipos_actualizado_por_fkey
            FOREIGN KEY (actualizado_por) REFERENCES usuarios(id);
        END IF;
      END $$;
      ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_tipo_check;
      ALTER TABLE equipos ADD CONSTRAINT equipos_tipo_check
        CHECK (tipo IN (${tipoConstraintValues}));
      CREATE UNIQUE INDEX IF NOT EXISTS equipos_ubicacion_identificador_ci_unique
        ON equipos (ubicacion_id, lower(identificador));
      CREATE INDEX IF NOT EXISTS equipos_ubicacion_tipo_idx
        ON equipos (ubicacion_id, tipo);

      CREATE TABLE IF NOT EXISTS equipos_checklist (
        equipo_id integer NOT NULL,
        item_key text NOT NULL,
        checked_por integer NOT NULL,
        checked_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE equipos_checklist
        ADD COLUMN IF NOT EXISTS equipo_id integer,
        ADD COLUMN IF NOT EXISTS item_key text,
        ADD COLUMN IF NOT EXISTS checked_por integer,
        ADD COLUMN IF NOT EXISTS checked_at timestamptz DEFAULT now();
      UPDATE equipos_checklist SET checked_at = now() WHERE checked_at IS NULL;
      ALTER TABLE equipos_checklist
        ALTER COLUMN equipo_id SET NOT NULL,
        ALTER COLUMN item_key SET NOT NULL,
        ALTER COLUMN checked_por SET NOT NULL,
        ALTER COLUMN checked_at SET DEFAULT now(),
        ALTER COLUMN checked_at SET NOT NULL;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos_checklist'::regclass AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE
              'FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE%'
        ) THEN
          ALTER TABLE equipos_checklist
            ADD CONSTRAINT equipos_checklist_equipo_id_fkey
            FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos_checklist'::regclass AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE
              'FOREIGN KEY (checked_por) REFERENCES usuarios(id)%'
        ) THEN
          ALTER TABLE equipos_checklist
            ADD CONSTRAINT equipos_checklist_checked_por_fkey
            FOREIGN KEY (checked_por) REFERENCES usuarios(id);
        END IF;
      END $$;
      ALTER TABLE equipos_checklist
        DROP CONSTRAINT IF EXISTS equipos_checklist_item_key_check;
      ALTER TABLE equipos_checklist
        ADD CONSTRAINT equipos_checklist_item_key_check
        CHECK (item_key IN (${checklistConstraintValues}));
      CREATE UNIQUE INDEX IF NOT EXISTS equipos_checklist_equipo_item_unique
        ON equipos_checklist (equipo_id, item_key);
      CREATE INDEX IF NOT EXISTS equipos_checklist_equipo_idx
        ON equipos_checklist (equipo_id);

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM (
            VALUES
              ('equipos', 'id', 'integer', 'NO', true),
              ('equipos', 'ubicacion_id', 'integer', 'NO', false),
              ('equipos', 'tipo', 'text', 'NO', false),
              ('equipos', 'identificador', 'text', 'NO', false),
              ('equipos', 'marca', 'text', 'NO', false),
              ('equipos', 'modelo', 'text', 'NO', false),
              ('equipos', 'numero_serie', 'text', 'YES', false),
              ('equipos', 'notas', 'text', 'YES', false),
              ('equipos', 'creado_por', 'integer', 'NO', false),
              ('equipos', 'actualizado_por', 'integer', 'NO', false),
              ('equipos', 'created_at', 'timestamp with time zone', 'NO', true),
              ('equipos', 'updated_at', 'timestamp with time zone', 'NO', true),
              ('equipos_checklist', 'equipo_id', 'integer', 'NO', false),
              ('equipos_checklist', 'item_key', 'text', 'NO', false),
              ('equipos_checklist', 'checked_por', 'integer', 'NO', false),
              ('equipos_checklist', 'checked_at', 'timestamp with time zone', 'NO', true)
          ) AS expected(table_name, column_name, data_type, is_nullable, needs_default)
          LEFT JOIN information_schema.columns actual
            ON actual.table_schema = current_schema()
           AND actual.table_name = expected.table_name
           AND actual.column_name = expected.column_name
          WHERE actual.column_name IS NULL
             OR actual.data_type <> expected.data_type
             OR actual.is_nullable <> expected.is_nullable
             OR (expected.needs_default AND actual.column_default IS NULL)
        ) THEN
          RAISE EXCEPTION 'Incompatible equipos schema: column validation failed';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'equipos'::regclass AND contype = 'p'
            AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
        ) THEN
          RAISE EXCEPTION 'Incompatible equipos schema: primary key must be id';
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid IN ('equipos'::regclass, 'equipos_checklist'::regclass)
            AND NOT convalidated
        ) THEN
          RAISE EXCEPTION 'Incompatible equipos schema: unvalidated constraint';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_index
          WHERE indexrelid =
            'equipos_ubicacion_identificador_ci_unique'::regclass
            AND indisunique AND indisvalid
            AND position(
              '(ubicacion_id, lower(identificador))'
              IN pg_get_indexdef(indexrelid)
            ) > 0
        ) OR NOT EXISTS (
          SELECT 1 FROM pg_index
          WHERE indexrelid =
            'equipos_checklist_equipo_item_unique'::regclass
            AND indisunique AND indisvalid
            AND position(
              '(equipo_id, item_key)' IN pg_get_indexdef(indexrelid)
            ) > 0
        ) OR NOT EXISTS (
          SELECT 1 FROM pg_index
          WHERE indexrelid = 'equipos_ubicacion_tipo_idx'::regclass
            AND indisvalid
            AND position(
              '(ubicacion_id, tipo)' IN pg_get_indexdef(indexrelid)
            ) > 0
        ) OR NOT EXISTS (
          SELECT 1 FROM pg_index
          WHERE indexrelid = 'equipos_checklist_equipo_idx'::regclass
            AND indisvalid
            AND position('(equipo_id)' IN pg_get_indexdef(indexrelid)) > 0
        ) THEN
          RAISE EXCEPTION 'Incompatible equipos schema: index validation failed';
        END IF;
      END $$;

      INSERT INTO permisos_rol
        (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
      SELECT rol, 'equipos',
        rol = 'SISTEMAS'::rol_usuario,
        rol = 'SISTEMAS'::rol_usuario,
        rol = 'SISTEMAS'::rol_usuario,
        false
      FROM unnest(ARRAY[
        'TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'SISTEMAS', 'CONTADOR'
      ]::rol_usuario[]) AS roles(rol)
      ON CONFLICT (rol, modulo) DO UPDATE SET
        puede_ver = EXCLUDED.puede_ver,
        puede_crear = EXCLUDED.puede_crear,
        puede_editar = EXCLUDED.puede_editar,
        puede_autorizar = EXCLUDED.puede_autorizar,
        updated_at = now()
      WHERE permisos_rol.updated_por IS NULL;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}