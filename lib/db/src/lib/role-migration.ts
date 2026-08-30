import type { Pool } from "pg";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "./advisory-locks.mjs";

type Connectable = Pick<Pool, "connect">;

/**
 * Renames legacy roles in place so PostgreSQL keeps every enum reference in
 * usuarios and permisos_rol intact, and ensures all current roles exist.
 */
export async function ensureSupervisorRole(pool: Connectable): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await transactionAdvisoryLock(client, ADVISORY_LOCK_NAMESPACES.SCHEMA_ROLE);
    const supportUsers = await client.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM usuarios
      WHERE rol::text = 'SOPORTE'
    `);
    await client.query(`
      DO $$
      DECLARE
        has_legacy boolean;
        has_supervisor boolean;
        has_soporte boolean;
        has_sistemas boolean;
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

        SELECT EXISTS (
          SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SOPORTE'
        ) INTO has_soporte;
        SELECT EXISTS (
          SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SISTEMAS'
        ) INTO has_sistemas;

        IF has_soporte AND has_sistemas THEN
          RAISE EXCEPTION
            'rol_usuario contiene SOPORTE y SISTEMAS; se requiere reparación manual';
        ELSIF has_soporte THEN
          ALTER TYPE rol_usuario RENAME VALUE 'SOPORTE' TO 'SISTEMAS';
        ELSIF NOT has_sistemas THEN
          ALTER TYPE rol_usuario ADD VALUE 'SISTEMAS';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'CONTADOR'
        ) THEN
          ALTER TYPE rol_usuario ADD VALUE 'CONTADOR';
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
    return supportUsers.rows[0]?.count ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}