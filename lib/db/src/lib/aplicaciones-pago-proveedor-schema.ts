import type pg from "pg";

/** Repeatable PostgreSQL migration for the immutable supplier allocation evidence. */
export async function ensureAplicacionesPagoProveedorSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS aplicaciones_pago_proveedor (
        id serial PRIMARY KEY,
        pago_proveedor_id integer NOT NULL REFERENCES pagos_proveedor(id),
        compra_proveedor_id integer NOT NULL REFERENCES pagos_proveedor(id),
        importe numeric(12,2) NOT NULL CHECK (importe > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT aplicaciones_pago_proveedor_pago_compra_uidx
          UNIQUE (pago_proveedor_id, compra_proveedor_id)
      );
      CREATE INDEX IF NOT EXISTS aplicaciones_pago_proveedor_compra_idx
        ON aplicaciones_pago_proveedor(compra_proveedor_id);
      -- A previous repeatable version may still have the old validator, whose
      -- totals included reversed payments. The reconciliation below computes
      -- its own conservative limits and the corrected trigger is recreated
      -- immediately afterwards in this same transaction.
      DROP TRIGGER IF EXISTS aplicaciones_pago_proveedor_validar_insert
        ON aplicaciones_pago_proveedor;
      -- Historical directed payments used entrada_id as their only allocation
      -- evidence. Materialize that evidence once, without editing either ledger
      -- or any application already recorded.
      DO $$
      DECLARE legacy RECORD;
      DECLARE compra_id integer;
      DECLARE pago_disponible numeric(12,2);
      DECLARE compra_pendiente numeric(12,2);
      DECLARE a_aplicar numeric(12,2);
      BEGIN
        FOR legacy IN
          SELECT p.id, p.entrada_id
          FROM pagos_proveedor p
          WHERE p.tipo = 'PAGO' AND p.entrada_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM pagos_proveedor r
              WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = p.id
            )
          ORDER BY p.fecha, p.id
        LOOP
          SELECT c.id INTO compra_id
          FROM pagos_proveedor c
          WHERE c.tipo = 'COMPRA' AND c.entrada_id = legacy.entrada_id
            AND c.proveedor_id = (
              SELECT proveedor_id FROM pagos_proveedor WHERE id = legacy.id
            )
          ORDER BY c.fecha, c.id
          LIMIT 1;

          IF compra_id IS NULL THEN
            RAISE EXCEPTION
              'Pago proveedor legado % refiere entrada % sin COMPRA correspondiente',
              legacy.id, legacy.entrada_id;
          END IF;

          -- An existing pair is immutable evidence. Never duplicate it on a
          -- repeated ensure; any unapplied remainder stays as supplier credit.
          IF EXISTS (
            SELECT 1 FROM aplicaciones_pago_proveedor
            WHERE pago_proveedor_id = legacy.id
              AND compra_proveedor_id = compra_id
          ) THEN
            CONTINUE;
          END IF;

          SELECT GREATEST(0, -p.importe - COALESCE(SUM(a.importe), 0))
            INTO pago_disponible
          FROM pagos_proveedor p
          LEFT JOIN aplicaciones_pago_proveedor a
            ON a.pago_proveedor_id = p.id
          WHERE p.id = legacy.id
          GROUP BY p.id, p.importe;

          SELECT GREATEST(0, c.importe - COALESCE(SUM(a.importe) FILTER (
            WHERE NOT EXISTS (
              SELECT 1 FROM pagos_proveedor r
              WHERE r.tipo = 'REVERSO'
                AND r.movimiento_origen_id = a.pago_proveedor_id
            )
          ), 0))
            INTO compra_pendiente
          FROM pagos_proveedor c
          LEFT JOIN aplicaciones_pago_proveedor a
            ON a.compra_proveedor_id = c.id
          WHERE c.id = compra_id
          GROUP BY c.id, c.importe;

          a_aplicar := LEAST(pago_disponible, compra_pendiente);
          IF a_aplicar > 0 THEN
            INSERT INTO aplicaciones_pago_proveedor
              (pago_proveedor_id, compra_proveedor_id, importe)
            VALUES (legacy.id, compra_id, a_aplicar);
          END IF;
        END LOOP;
      END $$;
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM aplicaciones_pago_proveedor a
          JOIN pagos_proveedor p ON p.id = a.pago_proveedor_id
          JOIN pagos_proveedor c ON c.id = a.compra_proveedor_id
          WHERE p.tipo <> 'PAGO' OR c.tipo <> 'COMPRA'
            OR p.proveedor_id <> c.proveedor_id
        ) THEN
          RAISE EXCEPTION
            'Existen aplicaciones proveedor inconsistentes por tipo o proveedor';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM pagos_proveedor p
          JOIN aplicaciones_pago_proveedor a ON a.pago_proveedor_id = p.id
          WHERE p.tipo = 'PAGO'
            AND NOT EXISTS (
              SELECT 1 FROM pagos_proveedor r
              WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = p.id
            )
          GROUP BY p.id, p.importe
          HAVING SUM(a.importe) > -p.importe
        ) OR EXISTS (
          SELECT 1
          FROM pagos_proveedor c
          JOIN aplicaciones_pago_proveedor a ON a.compra_proveedor_id = c.id
          WHERE c.tipo = 'COMPRA'
            AND NOT EXISTS (
              SELECT 1 FROM pagos_proveedor r
              WHERE r.tipo = 'REVERSO'
                AND r.movimiento_origen_id = a.pago_proveedor_id
            )
          GROUP BY c.id, c.importe
          HAVING SUM(a.importe) > c.importe
        ) THEN
          RAISE EXCEPTION
            'Existen aplicaciones proveedor que sobreaplican pago o compra';
        END IF;
      END $$;
      CREATE OR REPLACE FUNCTION validar_aplicacion_pago_proveedor()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE pago pagos_proveedor%ROWTYPE; compra pagos_proveedor%ROWTYPE;
      BEGIN
        SELECT * INTO pago FROM pagos_proveedor
          WHERE id = NEW.pago_proveedor_id FOR UPDATE;
        SELECT * INTO compra FROM pagos_proveedor
          WHERE id = NEW.compra_proveedor_id FOR UPDATE;
        IF pago.id IS NULL OR compra.id IS NULL OR pago.tipo <> 'PAGO'
          OR compra.tipo <> 'COMPRA' OR pago.proveedor_id <> compra.proveedor_id THEN
          RAISE EXCEPTION 'Aplicación proveedor inválida: pago PAGO y compra COMPRA del mismo proveedor requeridos';
        END IF;
        IF EXISTS (
          SELECT 1 FROM pagos_proveedor r
          WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = pago.id
        ) THEN
          RAISE EXCEPTION 'No se puede aplicar un pago proveedor revertido';
        END IF;
        IF NEW.importe <= 0
          OR NEW.importe > -pago.importe - COALESCE((
            SELECT SUM(a.importe)
            FROM aplicaciones_pago_proveedor a
            WHERE a.pago_proveedor_id = pago.id
              AND NOT EXISTS (
                SELECT 1 FROM pagos_proveedor r
                WHERE r.tipo = 'REVERSO'
                  AND r.movimiento_origen_id = a.pago_proveedor_id
              )
          ), 0)
          OR NEW.importe > compra.importe - COALESCE((
            SELECT SUM(a.importe)
            FROM aplicaciones_pago_proveedor a
            WHERE a.compra_proveedor_id = compra.id
              AND NOT EXISTS (
                SELECT 1 FROM pagos_proveedor r
                WHERE r.tipo = 'REVERSO'
                  AND r.movimiento_origen_id = a.pago_proveedor_id
              )
          ), 0) THEN
          RAISE EXCEPTION 'Aplicación proveedor excede el saldo disponible';
        END IF;
        RETURN NEW;
      END;
      $$;
      DROP TRIGGER IF EXISTS aplicaciones_pago_proveedor_validar_insert ON aplicaciones_pago_proveedor;
      CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert
        BEFORE INSERT ON aplicaciones_pago_proveedor FOR EACH ROW
        EXECUTE FUNCTION validar_aplicacion_pago_proveedor();
      CREATE OR REPLACE FUNCTION proteger_aplicaciones_pago_proveedor()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'aplicaciones_pago_proveedor es append-only';
      END;
      $$;
      DROP TRIGGER IF EXISTS aplicaciones_pago_proveedor_append_only ON aplicaciones_pago_proveedor;
      CREATE TRIGGER aplicaciones_pago_proveedor_append_only
        BEFORE UPDATE OR DELETE ON aplicaciones_pago_proveedor FOR EACH ROW
        EXECUTE FUNCTION proteger_aplicaciones_pago_proveedor();
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}