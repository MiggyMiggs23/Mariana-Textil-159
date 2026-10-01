import type { Pool } from "pg";

/**
 * Moves the legacy ticket-wide sale type onto every line.  It is deliberately
 * repeatable: installations already upgraded no longer have tickets.tipo, so
 * the backfill is only attempted while that legacy column still exists.
 * Cost provenance is intentionally added nullable and never backfilled:
 * pre-column metered lines remain explicitly unknown historical evidence.
 */
export async function ensureTicketLineTypesSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE ticket_lineas
        ADD COLUMN IF NOT EXISTS tipo tipo_ticket,
        ADD COLUMN IF NOT EXISTS costo_referencia_estado text;

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

      INSERT INTO auditoria
        (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip)
      SELECT
        NULL,
        'MIGRACION_METREADO_SIN_ROLLO',
        'ticket_lineas',
        linea.id::text,
        jsonb_build_object('rolloId', linea.rollo_id),
        jsonb_build_object('rolloId', NULL),
        'sistema:migracion'
      FROM ticket_lineas AS linea
      WHERE linea.tipo = 'METREADO'
        AND linea.rollo_id IS NOT NULL;

      -- Only repair the malformed legacy rows above.  Do not touch valid
      -- METREADO rows: their frozen costs are historical accounting facts.
      UPDATE ticket_lineas
      SET rollo_id = NULL,
          costo_unitario_congelado = NULL,
          costo_total_congelado = NULL,
          costo_referencia_estado = NULL
      WHERE tipo = 'METREADO'
        AND rollo_id IS NOT NULL;

      ALTER TABLE ticket_lineas
        ALTER COLUMN tipo SET NOT NULL,
        ALTER COLUMN costo_unitario_congelado DROP NOT NULL,
        ALTER COLUMN costo_total_congelado DROP NOT NULL;

      CREATE INDEX IF NOT EXISTS ticket_lineas_tipo_idx
        ON ticket_lineas (tipo);

      -- Part 2 used this name for a stricter METREADO check.  Drop it by
      -- name on every run before installing the final, repeatable rule.
      ALTER TABLE ticket_lineas
        DROP CONSTRAINT IF EXISTS ticket_lineas_tipo_rollo_costos_check;

      ALTER TABLE ticket_lineas
        ADD CONSTRAINT ticket_lineas_tipo_rollo_costos_check
        CHECK (
          (tipo = 'NORMAL'
            AND rollo_id IS NOT NULL
            AND costo_unitario_congelado IS NOT NULL
            AND costo_total_congelado IS NOT NULL
            AND costo_referencia_estado IS NULL)
          OR
          (tipo = 'METREADO'
            AND rollo_id IS NULL
            AND (
              (costo_unitario_congelado IS NULL
                AND costo_total_congelado IS NULL
                AND (costo_referencia_estado IS NULL
                  OR costo_referencia_estado = 'NO_COST'))
              OR
              (costo_unitario_congelado IS NOT NULL
                AND costo_total_congelado IS NOT NULL
                AND (costo_referencia_estado IS NULL
                  OR costo_referencia_estado IN (
                    'AVERAGE_12_MONTHS',
                    'STALE_LAST_KNOWN'
                  )))
            ))
        );

      ALTER TABLE tickets DROP COLUMN IF EXISTS tipo;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}