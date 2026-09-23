-- Supplier utility physical-trace ledger.
--
-- Review/apply explicitly with the deployment migration process. This file is
-- intentionally not imported by application startup and must not be replaced
-- with drizzle-kit push.
--
-- The table starts empty: historical sales without definite physical evidence
-- are not guessed or backfilled.

BEGIN;

CREATE TABLE IF NOT EXISTS ticket_linea_consumos (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  ticket_linea_id INTEGER NOT NULL REFERENCES ticket_lineas(id),
  movimiento_id BIGINT NOT NULL REFERENCES movimientos(id),
  rollo_id INTEGER NOT NULL REFERENCES rollos(id),
  entrada_id INTEGER NOT NULL REFERENCES entradas(id),
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  cantidad_milesimas BIGINT NOT NULL CHECK (cantidad_milesimas > 0),
  ingreso_centavos BIGINT NOT NULL CHECK (ingreso_centavos >= 0),
  costo_centavos BIGINT CHECK (costo_centavos IS NULL OR costo_centavos >= 0),
  tipo TEXT NOT NULL,
  reversa_de_id BIGINT REFERENCES ticket_linea_consumos(id),
  idempotencia TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_linea_consumos_tipo_reversa_check CHECK (
    (tipo = 'CONSUMO' AND reversa_de_id IS NULL)
    OR (tipo = 'REVERSA' AND reversa_de_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_linea_consumos_idempotencia_uidx
  ON ticket_linea_consumos (idempotencia);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_linea_consumos_movimiento_consumo_uidx
  ON ticket_linea_consumos (movimiento_id)
  WHERE tipo = 'CONSUMO';
CREATE UNIQUE INDEX IF NOT EXISTS ticket_linea_consumos_reversa_uidx
  ON ticket_linea_consumos (reversa_de_id)
  WHERE tipo = 'REVERSA';
CREATE INDEX IF NOT EXISTS ticket_linea_consumos_ticket_linea_idx
  ON ticket_linea_consumos (ticket_linea_id);
CREATE INDEX IF NOT EXISTS ticket_linea_consumos_ticket_idx
  ON ticket_linea_consumos (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_linea_consumos_rollo_idx
  ON ticket_linea_consumos (rollo_id);
CREATE INDEX IF NOT EXISTS ticket_linea_consumos_proveedor_idx
  ON ticket_linea_consumos (proveedor_id);

CREATE OR REPLACE FUNCTION ticket_linea_consumos_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  original ticket_linea_consumos%ROWTYPE;
  movement movimientos%ROWTYPE;
  reversal_quantity BIGINT;
  reversal_revenue BIGINT;
  reversal_cost BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'ticket_linea_consumos is append-only';
  END IF;

  IF NEW.movimiento_id IS NULL THEN
    RAISE EXCEPTION 'ticket_linea_consumos requires a movement';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM ticket_lineas
     WHERE id = NEW.ticket_linea_id
       AND ticket_id = NEW.ticket_id
  ) THEN
    RAISE EXCEPTION 'allocation line does not belong to its ticket';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM rollos r
      JOIN entradas e ON e.id = r.recepcion_id
     WHERE r.id = NEW.rollo_id
       AND r.recepcion_id = NEW.entrada_id
       AND e.proveedor_id = NEW.proveedor_id
  ) THEN
    RAISE EXCEPTION 'allocation source does not match roll entry supplier';
  END IF;

  SELECT *
    INTO movement
    FROM movimientos
   WHERE id = NEW.movimiento_id;
  IF NOT FOUND OR movement.rollo_id <> NEW.rollo_id
     OR movement.tipo NOT IN ('VENTA', 'CANCELACION')
     OR movement.documento_id IS DISTINCT FROM NEW.ticket_id::text THEN
    RAISE EXCEPTION 'allocation movement does not match its ticket and roll';
  END IF;

  IF NEW.tipo = 'CONSUMO' THEN
    IF NEW.reversa_de_id IS NOT NULL
       OR movement.tipo <> 'VENTA' THEN
      RAISE EXCEPTION 'CONSUMO must reference a VENTA movement and no reversal';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tipo <> 'REVERSA' OR NEW.reversa_de_id IS NULL
     OR movement.tipo <> 'CANCELACION' THEN
    RAISE EXCEPTION 'REVERSA must reference a cancellation movement and source';
  END IF;

  SELECT *
    INTO original
    FROM ticket_linea_consumos
   WHERE id = NEW.reversa_de_id
     AND tipo = 'CONSUMO'
   FOR UPDATE;
  IF NOT FOUND
     OR original.ticket_id <> NEW.ticket_id
     OR original.ticket_linea_id <> NEW.ticket_linea_id
     OR original.rollo_id <> NEW.rollo_id
     OR original.entrada_id <> NEW.entrada_id
     OR original.proveedor_id <> NEW.proveedor_id
     OR original.movimiento_id IS DISTINCT FROM movement.movimiento_origen_id
     OR (original.costo_centavos IS NULL) <> (NEW.costo_centavos IS NULL) THEN
    RAISE EXCEPTION 'REVERSA source identity does not match its CONSUMO';
  END IF;

  SELECT COALESCE(SUM(cantidad_milesimas), 0),
         COALESCE(SUM(ingreso_centavos), 0),
         COALESCE(SUM(costo_centavos), 0)
    INTO reversal_quantity, reversal_revenue, reversal_cost
    FROM ticket_linea_consumos
   WHERE reversa_de_id = original.id
     AND tipo = 'REVERSA';
  IF NEW.cantidad_milesimas > original.cantidad_milesimas - reversal_quantity
     OR NEW.ingreso_centavos > original.ingreso_centavos - reversal_revenue
     OR NEW.costo_centavos IS NOT NULL
        AND NEW.costo_centavos > original.costo_centavos - reversal_cost THEN
    RAISE EXCEPTION 'REVERSA exceeds the remaining CONSUMO allocation';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'ticket_linea_consumos_append_only'
       AND tgrelid = 'ticket_linea_consumos'::regclass
  ) THEN
    CREATE TRIGGER ticket_linea_consumos_append_only
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_linea_consumos
      FOR EACH ROW
      EXECUTE FUNCTION ticket_linea_consumos_guard();
  END IF;
END;
$$;

ALTER TABLE ticket_linea_consumos
  ENABLE ALWAYS TRIGGER ticket_linea_consumos_append_only;

COMMENT ON TABLE ticket_linea_consumos IS
  'Immutable physical roll allocations for accounted supplier utility; empty for historical records without evidence.';
COMMENT ON COLUMN ticket_linea_consumos.cantidad_milesimas IS
  'Positive physical quantity in thousandths.';
COMMENT ON COLUMN ticket_linea_consumos.ingreso_centavos IS
  'Positive revenue allocation in integer cents, assigned with deterministic largest remainder.';
COMMENT ON COLUMN ticket_linea_consumos.costo_centavos IS
  'Frozen physical cost in integer cents; NULL means utility unavailable.';

COMMIT;