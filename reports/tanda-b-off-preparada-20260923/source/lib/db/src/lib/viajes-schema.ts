import type { Pool } from "pg";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "./advisory-locks.mjs";

/** Repeatable upgrade for immutable trip headers, per-site counters and links. */
export async function ensureViajesSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await transactionAdvisoryLock(client, ADVISORY_LOCK_NAMESPACES.SCHEMA_VIAJES);
    await client.query(`
      CREATE TABLE IF NOT EXISTS viaje_folio (
        ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id),
        ultimo_folio integer NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS viajes (
        id serial PRIMARY KEY, folio integer NOT NULL,
        origen_id integer NOT NULL REFERENCES ubicaciones(id),
        camioneta_id integer NOT NULL REFERENCES camionetas(id),
        chofer_id integer NOT NULL REFERENCES choferes(id),
        salida_at timestamptz NOT NULL, observaciones text,
        creado_por_id integer NOT NULL REFERENCES usuarios(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT viajes_origen_folio_unique UNIQUE (origen_id, folio)
      );
      CREATE INDEX IF NOT EXISTS viajes_salida_at_idx ON viajes(salida_at);
      CREATE INDEX IF NOT EXISTS viajes_camioneta_idx ON viajes(camioneta_id);
      CREATE INDEX IF NOT EXISTS viajes_chofer_idx ON viajes(chofer_id);
      CREATE TABLE IF NOT EXISTS viaje_tickets (
        viaje_id integer NOT NULL REFERENCES viajes(id),
        ticket_id integer NOT NULL REFERENCES tickets(id),
        CONSTRAINT viaje_tickets_ticket_unique UNIQUE(ticket_id)
      );
      CREATE INDEX IF NOT EXISTS viaje_tickets_viaje_idx ON viaje_tickets(viaje_id);
      CREATE TABLE IF NOT EXISTS viaje_salidas (
        viaje_id integer NOT NULL REFERENCES viajes(id),
        salida_id integer NOT NULL REFERENCES salidas(id),
        CONSTRAINT viaje_salidas_salida_unique UNIQUE(salida_id)
      );
      CREATE INDEX IF NOT EXISTS viaje_salidas_viaje_idx ON viaje_salidas(viaje_id);
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}