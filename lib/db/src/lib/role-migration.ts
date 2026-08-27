import type { Pool } from "pg";

type Connectable = Pick<Pool, "connect">;

/**
 * Renames the legacy inventory role in place so PostgreSQL keeps every enum
 * reference in usuarios and permisos_rol intact.
 */
export async function ensureSupervisorRole(pool: Connectable): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(310031)");
    await client.query(`
      DO $$
      DECLARE
        has_legacy boolean;
        has_supervisor boolean;
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'INVENTARIOS'
        ) INTO has_legacy;
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SUPERVISOR'
        ) INTO has_supervisor;

        IF has_legacy AND has_supervisor THEN
          RAISE EXCEPTION
            'rol_usuario contiene INVENTARIOS y SUPERVISOR; se requiere reparación manual';
        ELSIF has_legacy THEN
          ALTER TYPE rol_usuario RENAME VALUE 'INVENTARIOS' TO 'SUPERVISOR';
        END IF;

       IF NOT EXISTS (
         SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SOPORTE'
       ) THEN
         ALTER TYPE rol_usuario ADD VALUE 'SOPORTE';
       END IF;

        IF EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'usuarios'
               AND column_name = 'alcance_consulta'
           ) AND
           EXISTS (
             SELECT 1
             FROM pg_type t
             JOIN pg_enum e ON e.enumtypid = t.oid
             WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SUPERVISOR'
           ) THEN
          EXECUTE $update$
            UPDATE usuarios
            SET alcance_consulta = 'TODAS'
            WHERE rol = 'SUPERVISOR'
              AND alcance_consulta IS DISTINCT FROM 'TODAS'
          $update$;
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