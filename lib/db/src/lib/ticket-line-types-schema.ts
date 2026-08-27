import type { Pool } from "pg";

/**
 * Moves the legacy ticket-wide sale type onto every line.  It is deliberately
 * repeatable: installations already upgraded no longer have tickets.tipo, so
 * the backfill is only attempted while that legacy column still exists.
 */
export async function ensureTicketLineTypesSchema(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE ticket_lineas
      ADD COLUMN IF NOT EXISTS tipo tipo_ticket;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'tickets'
          AND column_name = 'tipo'
      ) THEN
        UPDATE ticket_lineas AS linea
        SET tipo = ticket.tipo
        FROM tickets AS ticket
        WHERE linea.ticket_id = ticket.id
          AND linea.tipo IS NULL;
      END IF;
    END $$;

    UPDATE ticket_lineas
    SET costo_unitario_congelado = NULL,
        costo_total_congelado = NULL
    WHERE tipo = 'METREADO';

    ALTER TABLE ticket_lineas
      ALTER COLUMN tipo SET NOT NULL,
      ALTER COLUMN costo_unitario_congelado DROP NOT NULL,
      ALTER COLUMN costo_total_congelado DROP NOT NULL;

    CREATE INDEX IF NOT EXISTS ticket_lineas_tipo_idx
      ON ticket_lineas (tipo);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ticket_lineas_tipo_rollo_costos_check'
      ) THEN
        ALTER TABLE ticket_lineas
          ADD CONSTRAINT ticket_lineas_tipo_rollo_costos_check
          CHECK (
            (tipo = 'NORMAL'
              AND rollo_id IS NOT NULL
              AND costo_unitario_congelado IS NOT NULL
              AND costo_total_congelado IS NOT NULL)
            OR
            (tipo = 'METREADO'
              AND rollo_id IS NULL
              AND costo_unitario_congelado IS NULL
              AND costo_total_congelado IS NULL)
          );
      END IF;
    END $$;

    ALTER TABLE tickets DROP COLUMN IF EXISTS tipo;
  `);
}