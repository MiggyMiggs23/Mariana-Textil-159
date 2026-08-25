import type { Pool } from "pg";

/**
 * Idempotent production upgrade. The system customer is installed before
 * legacy tickets are backfilled, so making cliente_id mandatory is safe.
 */
export async function ensureClientesSchema(pool: Pool): Promise<void> {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  // PostgreSQL does not allow a newly-added enum value to be used in the same
  // transaction that added it.
  await pool.query(
    "ALTER TYPE tipo_movimiento_credito ADD VALUE IF NOT EXISTS 'AJUSTE'",
  );
  await pool.query("BEGIN");
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'clientes'
            AND column_name = 'direccion'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'clientes'
            AND column_name = 'direccion_particular'
        ) THEN
          ALTER TABLE clientes RENAME COLUMN direccion TO direccion_particular;
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'clientes'
            AND column_name = 'direccion'
        ) THEN
          UPDATE clientes
          SET direccion_particular = COALESCE(direccion_particular, direccion);
          ALTER TABLE clientes DROP COLUMN direccion;
        END IF;
      END $$;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion_particular text;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion_entrega text;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre text;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 0;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS forma_pago forma_pago_ticket;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS referencia text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS metadata text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS dias_plazo integer;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS es_incobrable boolean NOT NULL DEFAULT false;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS motivo_incobrable text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS autorizado_por integer REFERENCES usuarios(id);
      CREATE TABLE IF NOT EXISTS cliente_documentos (
        id serial PRIMARY KEY,
        public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        cliente_id integer NOT NULL REFERENCES clientes(id),
        tipo text NOT NULL DEFAULT 'INE' CHECK (tipo = 'INE'),
        lado text NOT NULL CHECK (lado IN ('FRENTE', 'REVERSO')),
        nombre_archivo text NOT NULL,
        ruta_archivo text NOT NULL UNIQUE,
        mime_type text NOT NULL,
        tamano_bytes integer NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880),
        subido_por integer NOT NULL REFERENCES usuarios(id),
        subido_at timestamptz NOT NULL DEFAULT now(),
        vigente boolean NOT NULL DEFAULT true,
        reemplaza_id integer REFERENCES cliente_documentos(id)
      );
      CREATE INDEX IF NOT EXISTS cliente_documentos_cliente_idx
        ON cliente_documentos(cliente_id);
      CREATE UNIQUE INDEX IF NOT EXISTS cliente_documentos_slot_vigente_uidx
        ON cliente_documentos(cliente_id, lado) WHERE vigente;
       CREATE TABLE IF NOT EXISTS notificaciones_credito (
         id serial PRIMARY KEY,
         ticket_id integer NOT NULL UNIQUE REFERENCES tickets(id),
         cliente_id integer NOT NULL REFERENCES clientes(id),
         cliente_nombre text NOT NULL,
         folio integer NOT NULL,
         importe numeric(12,2) NOT NULL,
         dias_plazo integer NOT NULL CHECK (dias_plazo IN (7, 15, 30, 60)),
         fecha_vencimiento date NOT NULL,
         cajero_id integer NOT NULL REFERENCES usuarios(id),
         cajero_nombre text NOT NULL,
         tienda_id integer NOT NULL REFERENCES ubicaciones(id),
         tienda_nombre text NOT NULL,
         urgente boolean NOT NULL DEFAULT false,
         leida_at timestamptz,
         created_at timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS notificaciones_credito_leida_created_idx
         ON notificaciones_credito (leida_at, created_at);
       CREATE INDEX IF NOT EXISTS notificaciones_credito_cliente_idx
         ON notificaciones_credito (cliente_id);
      ALTER TABLE movimientos_credito DROP CONSTRAINT IF EXISTS movimientos_credito_plazo_check;
      ALTER TABLE movimientos_credito ADD CONSTRAINT movimientos_credito_plazo_check CHECK (
        (dias_plazo IS NULL AND fecha_vencimiento IS NULL)
        OR (dias_plazo IN (7, 15, 30, 60) AND fecha_vencimiento IS NOT NULL)
      );
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
      INSERT INTO clientes (nombre, activo, es_sistema, limite_credito, saldo_credito, dias_credito)
      SELECT seed.nombre, true, false, 0, 0, 0
      FROM (VALUES
        ('Rafael Flores'), ('Jacinta Mendoza'), ('Hilario Bonifacio'),
        ('Jesús López'), ('José López'), ('Miguel Esteban')
      ) AS seed(nombre)
      WHERE NOT EXISTS (
        SELECT 1 FROM clientes c
        WHERE lower(translate(btrim(c.nombre),
          'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) =
              lower(translate(btrim(seed.nombre),
          'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
      );
      SELECT setval(pg_get_serial_sequence('clientes', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM clientes), 1), true);
      UPDATE tickets SET cliente_id = 1 WHERE cliente_id IS NULL;
      ALTER TABLE tickets ALTER COLUMN cliente_id SET NOT NULL;
      -- The API preflight makes this a friendly 409; this partial expression
      -- index is the authoritative protection against simultaneous requests.
      -- System and inactive records deliberately do not reserve a name.
      CREATE UNIQUE INDEX IF NOT EXISTS clientes_activos_no_sistema_nombre_normalizado_uidx
        ON clientes (lower(btrim(nombre)))
        WHERE activo AND NOT es_sistema;
      CREATE INDEX IF NOT EXISTS tickets_cliente_created_at_idx
        ON tickets (cliente_id, created_at);
      -- FIFO allocates every negative ledger entry to the oldest credit sale.
      -- It is the single source for aging in both detail and global cartera.
      DROP FUNCTION IF EXISTS credit_fifo_aging(integer);
      CREATE OR REPLACE FUNCTION credit_fifo_aging(p_cliente_id integer)
      RETURNS TABLE (
        movimiento_id integer, ticket_id integer, created_at timestamptz,
        due_at date, original numeric, pendiente numeric
      ) LANGUAGE sql STABLE AS $$
        WITH fifo_negatives AS (
          SELECT COALESCE(SUM(-importe), 0) AS total
          FROM movimientos_credito
          WHERE cliente_id = p_cliente_id AND (
            tipo = 'ABONO' OR
            (tipo = 'AJUSTE' AND importe < 0)
          )
        ), cargos AS (
          SELECT m.id, m.ticket_id, m.created_at,
            GREATEST(0, m.importe - CASE
              WHEN m.tipo = 'VENTA_CREDITO' THEN COALESCE((
                SELECT SUM(-r.importe) FROM movimientos_credito r
                WHERE r.cliente_id=m.cliente_id AND r.tipo='REVERSO'
                  AND r.ticket_id=m.ticket_id
              ),0)
              ELSE 0
            END) AS neto,
            m.fecha_vencimiento
          FROM movimientos_credito m
          WHERE m.cliente_id=p_cliente_id AND (
            m.tipo='VENTA_CREDITO' OR (m.tipo='AJUSTE' AND m.importe > 0)
          )
        ), ordenadas AS (
          SELECT v.*,
            COALESCE(SUM(v.neto) OVER (
              ORDER BY v.created_at, v.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0) AS antes
          FROM cargos v
        )
        SELECT v.id, v.ticket_id, v.created_at,
          v.fecha_vencimiento, v.neto,
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