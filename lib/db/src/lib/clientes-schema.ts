import type { Pool } from "pg";

/**
 * Idempotent production upgrade. The system customer is installed before
 * legacy tickets are backfilled, so making cliente_id mandatory is safe.
 */
export async function ensureClientesSchema(pool: Pool): Promise<void> {
  // PostgreSQL does not allow a newly-added enum value to be used in the same
  // transaction that added it.
  await pool.query(
    "ALTER TYPE tipo_movimiento_credito ADD VALUE IF NOT EXISTS 'AJUSTE'",
  );
  await pool.query("BEGIN");
  try {
    await pool.query(`
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre text;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 0;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS forma_pago forma_pago_ticket;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS referencia text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS metadata text;
      ALTER TABLE movimientos_credito
        DROP CONSTRAINT IF EXISTS movimientos_credito_importe_tipo_check;
      ALTER TABLE movimientos_credito
        ADD CONSTRAINT movimientos_credito_importe_tipo_check CHECK (
          (tipo = 'VENTA_CREDITO' AND importe > 0)
          OR (tipo IN ('ABONO', 'REVERSO') AND importe < 0)
          OR (tipo = 'AJUSTE' AND importe <> 0)
        );
    `);
    await pool.query(`
      -- Do not overwrite a historical customer that happened to use id=1.
      -- Foreign keys are deliberately dropped/recreated inside this transaction
      -- because they are not ON UPDATE CASCADE in older installations.
      DO $$
      DECLARE replacement_id integer;
      BEGIN
        IF EXISTS (SELECT 1 FROM clientes WHERE id = 1 AND NOT es_sistema) THEN
          SELECT nextval(pg_get_serial_sequence('clientes', 'id')) INTO replacement_id;
          ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_cliente_id_clientes_id_fk;
          ALTER TABLE movimientos_credito DROP CONSTRAINT IF EXISTS movimientos_credito_cliente_id_clientes_id_fk;
          UPDATE tickets SET cliente_id = replacement_id WHERE cliente_id = 1;
          UPDATE movimientos_credito SET cliente_id = replacement_id WHERE cliente_id = 1;
          UPDATE clientes SET id = replacement_id WHERE id = 1;
          ALTER TABLE tickets ADD CONSTRAINT tickets_cliente_id_clientes_id_fk
            FOREIGN KEY (cliente_id) REFERENCES clientes(id);
          ALTER TABLE movimientos_credito ADD CONSTRAINT movimientos_credito_cliente_id_clientes_id_fk
            FOREIGN KEY (cliente_id) REFERENCES clientes(id);
        END IF;
      END $$;
      INSERT INTO clientes
        (id, nombre, activo, es_sistema, limite_credito, saldo_credito, dias_credito)
      VALUES (1, 'Venta a Público', true, true, 0, 0, 0)
      ON CONFLICT (id) DO UPDATE SET
        nombre = CASE WHEN clientes.es_sistema THEN 'Venta a Público' ELSE clientes.nombre END,
        activo = true, es_sistema = true, limite_credito = 0, dias_credito = 0;
      SELECT setval(pg_get_serial_sequence('clientes', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM clientes), 1), true);
      UPDATE tickets SET cliente_id = 1 WHERE cliente_id IS NULL;
      ALTER TABLE tickets ALTER COLUMN cliente_id SET NOT NULL;
      CREATE INDEX IF NOT EXISTS tickets_cliente_created_at_idx
        ON tickets (cliente_id, created_at);
      -- FIFO allocates every negative ledger entry to the oldest credit sale.
      -- It is the single source for aging in both detail and global cartera.
      CREATE OR REPLACE FUNCTION credit_fifo_aging(p_cliente_id integer)
      RETURNS TABLE (
        movimiento_id integer, ticket_id integer, created_at timestamptz,
        due_at timestamptz, original numeric, pendiente numeric
      ) LANGUAGE sql STABLE AS $$
        WITH fifo_negatives AS (
          SELECT COALESCE(SUM(-importe), 0) AS total
          FROM movimientos_credito
          WHERE cliente_id = p_cliente_id AND (
            tipo = 'ABONO' OR
            (tipo = 'AJUSTE' AND importe < 0 AND ticket_id IS NULL)
          )
        ), ventas AS (
          SELECT m.id, m.ticket_id, m.created_at,
            GREATEST(0, m.importe - COALESCE((
              SELECT SUM(-r.importe) FROM movimientos_credito r
              WHERE r.cliente_id=m.cliente_id AND r.tipo='REVERSO'
                AND r.ticket_id=m.ticket_id
            ),0)) AS neto,
            c.dias_credito
          FROM movimientos_credito m JOIN clientes c ON c.id=m.cliente_id
          WHERE m.cliente_id=p_cliente_id AND m.tipo='VENTA_CREDITO'
        ), ordenadas AS (
          SELECT v.*,
            COALESCE(SUM(v.neto) OVER (
              ORDER BY v.created_at, v.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0) AS antes
          FROM ventas v
        )
        SELECT v.id, v.ticket_id, v.created_at,
          v.created_at + (v.dias_credito * interval '1 day'), v.neto,
          GREATEST(0, v.neto - GREATEST(0, n.total - v.antes))
        FROM ordenadas v CROSS JOIN fifo_negatives n
        WHERE GREATEST(0, v.neto - GREATEST(0, n.total - v.antes)) > 0
      $$;
      CREATE OR REPLACE FUNCTION prevent_financial_record_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';
      END $$;
      DROP TRIGGER IF EXISTS movimientos_credito_inmutables ON movimientos_credito;
      CREATE TRIGGER movimientos_credito_inmutables
        BEFORE UPDATE OR DELETE ON movimientos_credito
        FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
      DROP TRIGGER IF EXISTS ticket_pagos_inmutables ON ticket_pagos;
      CREATE TRIGGER ticket_pagos_inmutables
        BEFORE UPDATE OR DELETE ON ticket_pagos
        FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}