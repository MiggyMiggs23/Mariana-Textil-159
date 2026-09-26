import type { Pool } from "pg";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "./advisory-locks.mjs";

/** Additive only: no rewriting historical audits, movements or adjustments. */
export async function ensureAuditoriaResolucionesSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await transactionAdvisoryLock(client, ADVISORY_LOCK_NAMESPACES.SCHEMA_INVENTORY_AUDIT);
    await client.query(`
      ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'REACTIVACION_FALTANTE';
      ALTER TABLE notificaciones_sistema ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'NORMAL';
      CREATE TABLE IF NOT EXISTS auditoria_sobrante_contextos (
        auditoria_id integer NOT NULL REFERENCES auditorias_inventario(id),
        serie text NOT NULL,
        contexto jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(auditoria_id, serie)
      );
      CREATE TABLE IF NOT EXISTS auditoria_sobrante_decisiones (
        id serial PRIMARY KEY,
        auditoria_id integer NOT NULL REFERENCES auditorias_inventario(id),
        serie text NOT NULL,
        rollo_id integer REFERENCES rollos(id),
        decision text NOT NULL CHECK (decision IN ('DEJAR','REGRESAR','INVESTIGAR')),
        motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        salida_id integer REFERENCES salidas(id),
        uuid_cliente uuid NOT NULL UNIQUE,
        contexto jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS auditoria_sobrante_decisiones_audit_serie_idx
        ON auditoria_sobrante_decisiones(auditoria_id, serie, id);
      CREATE TABLE IF NOT EXISTS auditoria_faltante_reactivaciones (
        id serial PRIMARY KEY,
        rollo_id integer NOT NULL REFERENCES rollos(id),
        auditoria_origen_id integer NOT NULL REFERENCES auditorias_inventario(id),
        movimiento_baja_id bigint NOT NULL UNIQUE REFERENCES movimientos(id),
        movimiento_reactivacion_id bigint NOT NULL UNIQUE REFERENCES movimientos(id),
        ubicacion_aparicion_id integer NOT NULL REFERENCES ubicaciones(id),
        piso_aparicion_id integer REFERENCES pisos(id),
        cantidad_restaurada numeric(10,3) NOT NULL CHECK(cantidad_restaurada > 0),
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        motivo text NOT NULL CHECK(length(trim(motivo)) >= 10),
        origen text NOT NULL CHECK(origen IN ('AUDITORIA','ROLLO')),
        uuid_cliente uuid NOT NULL UNIQUE,
        auditorias_posteriores jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_auditoria_cerrada_uidx
        ON notificaciones_sistema(entidad, entidad_id)
        WHERE tipo = 'AUDITORIA_INVENTARIO_CERRADA';
      CREATE OR REPLACE FUNCTION proteger_auditoria_resolucion_append_only()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'La evidencia y las decisiones de auditoría son append-only; registre un hecho nuevo.';
        END;
      $$;
      DO $$
      DECLARE t text;
      BEGIN
        FOREACH t IN ARRAY ARRAY['auditoria_sobrante_contextos','auditoria_sobrante_decisiones','auditoria_faltante_reactivaciones']
        LOOP
          IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=t || '_append_only' AND tgrelid=t::regclass) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_resolucion_append_only()', t || '_append_only', t);
          END IF;
        END LOOP;
      END;
      $$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}