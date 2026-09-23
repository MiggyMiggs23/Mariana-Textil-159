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
  // Do not repurpose forma_pago_ticket: its CREDITO value belongs to POS.
  // This conversion preserves every historical value while enabling FACTURADO
  // specifically for customer account movements.
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE forma_pago_cuenta AS ENUM
        ('EFECTIVO', 'TRANSFERENCIA', 'FACTURADO', 'CHEQUE', 'OTRO', 'CREDITO');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
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
       ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS forma_pago forma_pago_cuenta;
       ALTER TABLE movimientos_credito
         ALTER COLUMN forma_pago TYPE forma_pago_cuenta
         USING forma_pago::text::forma_pago_cuenta;
       ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS cuenta_destino text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS referencia text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS metadata text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS dias_plazo integer;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS es_incobrable boolean NOT NULL DEFAULT false;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS motivo_incobrable text;
      ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS autorizado_por integer REFERENCES usuarios(id);
       ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS movimiento_origen_id integer REFERENCES movimientos_credito(id);
       -- Credit intent is committed in POS before cash collection. Existing
       -- tickets are historical non-reservations, so false/null is the safe
       -- backfill and preserves the paired-value invariant.
       ALTER TABLE tickets ADD COLUMN IF NOT EXISTS credito boolean NOT NULL DEFAULT false;
       ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dias_plazo integer;
       ALTER TABLE tickets ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
       UPDATE tickets
       SET credito = false, dias_plazo = NULL, fecha_vencimiento = NULL
       WHERE credito IS NULL
          OR (credito = false AND (dias_plazo IS NOT NULL OR fecha_vencimiento IS NOT NULL))
          OR (credito = true AND (dias_plazo NOT IN (7, 15, 30, 60) OR fecha_vencimiento IS NULL));
       ALTER TABLE tickets ALTER COLUMN credito SET DEFAULT false;
       ALTER TABLE tickets ALTER COLUMN credito SET NOT NULL;
       ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_credito_plazo_check;
       ALTER TABLE tickets ADD CONSTRAINT tickets_credito_plazo_check CHECK (
         (credito = false AND dias_plazo IS NULL AND fecha_vencimiento IS NULL)
         OR (credito = true AND dias_plazo IN (7, 15, 30, 60) AND fecha_vencimiento IS NOT NULL)
       );
       CREATE UNIQUE INDEX IF NOT EXISTS movimientos_credito_reverso_origen_uidx
         ON movimientos_credito(movimiento_origen_id)
         WHERE tipo = 'REVERSO' AND movimiento_origen_id IS NOT NULL;
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
       CREATE TABLE IF NOT EXISTS aplicaciones_credito (
         id serial PRIMARY KEY,
         abono_movimiento_id integer NOT NULL REFERENCES movimientos_credito(id),
         venta_movimiento_id integer NOT NULL REFERENCES movimientos_credito(id),
         importe numeric(12,2) NOT NULL CHECK (importe > 0),
         created_at timestamptz NOT NULL DEFAULT now(),
         CONSTRAINT aplicaciones_credito_abono_venta_uidx
           UNIQUE (abono_movimiento_id, venta_movimiento_id)
       );
       CREATE INDEX IF NOT EXISTS aplicaciones_credito_venta_idx
         ON aplicaciones_credito (venta_movimiento_id);
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
          OR (tipo = 'ABONO' AND importe < 0)
          OR (tipo = 'REVERSO' AND importe <> 0)
          OR (tipo = 'AJUSTE' AND importe <> 0)
        );
       ALTER TABLE movimientos_credito
         DROP CONSTRAINT IF EXISTS movimientos_credito_cuenta_destino_check;
       ALTER TABLE movimientos_credito
         ADD CONSTRAINT movimientos_credito_cuenta_destino_check CHECK (
           cuenta_destino IS NULL OR cuenta_destino IN
             ('CAJA_FISICA', 'CUENTA_FISCAL', 'CUENTA_NO_FISCAL')
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
      CREATE OR REPLACE FUNCTION prevent_financial_record_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';
      END $$;
       CREATE OR REPLACE FUNCTION validate_credit_application()
       RETURNS trigger LANGUAGE plpgsql AS $$
       DECLARE abono movimientos_credito%ROWTYPE;
       DECLARE venta movimientos_credito%ROWTYPE;
       DECLARE cliente_bloqueo integer;
       BEGIN
         SELECT cliente_id INTO cliente_bloqueo
           FROM movimientos_credito WHERE id = NEW.abono_movimiento_id;
         IF cliente_bloqueo IS NOT NULL THEN
           PERFORM 1 FROM clientes
             WHERE id = cliente_bloqueo FOR UPDATE;
         END IF;
         SELECT * INTO abono FROM movimientos_credito
           WHERE id = NEW.abono_movimiento_id FOR UPDATE;
         SELECT * INTO venta FROM movimientos_credito
           WHERE id = NEW.venta_movimiento_id FOR UPDATE;
         IF abono.id IS NULL OR venta.id IS NULL
           OR abono.tipo <> 'ABONO' OR venta.tipo <> 'VENTA_CREDITO'
           OR abono.cliente_id IS DISTINCT FROM venta.cliente_id THEN
           RAISE EXCEPTION 'Una aplicación debe enlazar un ABONO y una VENTA_CREDITO del mismo cliente.';
         END IF;
         IF EXISTS (
           SELECT 1 FROM movimientos_credito r
           WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = abono.id
         ) THEN
           RAISE EXCEPTION 'No se puede aplicar un ABONO revertido.';
         END IF;
         IF NEW.importe <= 0
           OR NEW.importe > -abono.importe - COALESCE((
             SELECT SUM(a.importe) FROM aplicaciones_credito a
             WHERE a.abono_movimiento_id = abono.id
               AND NOT EXISTS (
                 SELECT 1 FROM movimientos_credito r
                 WHERE r.tipo = 'REVERSO'
                   AND r.movimiento_origen_id = a.abono_movimiento_id
               )
           ), 0) THEN
           RAISE EXCEPTION 'La aplicación de crédito excede el saldo disponible.';
         END IF;
         RETURN NEW;
       END $$;
       CREATE OR REPLACE FUNCTION validate_credit_reversal()
       RETURNS trigger LANGUAGE plpgsql AS $$
       DECLARE origen movimientos_credito%ROWTYPE;
       BEGIN
         IF NEW.tipo <> 'REVERSO' THEN RETURN NEW; END IF;
         IF NEW.movimiento_origen_id IS NULL THEN
           RAISE EXCEPTION 'El reverso debe referenciar su movimiento de origen.';
         END IF;
          SELECT * INTO origen FROM movimientos_credito WHERE id=NEW.movimiento_origen_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';
          END IF;
          IF origen.tipo = 'ABONO'
            AND origen.cliente_id = NEW.cliente_id
            AND origen.importe < 0
            AND NEW.importe = -origen.importe THEN
            RETURN NEW;
          END IF;
          IF origen.tipo = 'VENTA_CREDITO'
            AND origen.cliente_id = NEW.cliente_id
            AND origen.importe > 0
            AND NEW.importe = -origen.importe
            AND NEW.ticket_id IS NOT DISTINCT FROM origen.ticket_id THEN
            RETURN NEW;
          END IF;
          RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';
       END $$;
      DROP TRIGGER IF EXISTS movimientos_credito_inmutables ON movimientos_credito;
      CREATE TRIGGER movimientos_credito_inmutables
        BEFORE UPDATE OR DELETE ON movimientos_credito
        FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
      DROP TRIGGER IF EXISTS ticket_pagos_inmutables ON ticket_pagos;
      CREATE TRIGGER ticket_pagos_inmutables
        BEFORE UPDATE OR DELETE ON ticket_pagos
        FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
       DROP TRIGGER IF EXISTS aplicaciones_credito_inmutables ON aplicaciones_credito;
       CREATE TRIGGER aplicaciones_credito_inmutables
         BEFORE UPDATE OR DELETE ON aplicaciones_credito
         FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
       DROP TRIGGER IF EXISTS aplicaciones_credito_validas ON aplicaciones_credito;
       CREATE TRIGGER aplicaciones_credito_validas
         BEFORE INSERT ON aplicaciones_credito
         FOR EACH ROW EXECUTE FUNCTION validate_credit_application();
       DROP TRIGGER IF EXISTS movimientos_credito_reversos_validos ON movimientos_credito;
       CREATE TRIGGER movimientos_credito_reversos_validos
         BEFORE INSERT ON movimientos_credito
         FOR EACH ROW EXECUTE FUNCTION validate_credit_reversal();
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}