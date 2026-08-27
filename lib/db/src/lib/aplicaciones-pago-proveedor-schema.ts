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
      CREATE OR REPLACE FUNCTION validar_aplicacion_pago_proveedor()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE pago pagos_proveedor%ROWTYPE; compra pagos_proveedor%ROWTYPE;
      BEGIN
        SELECT * INTO pago FROM pagos_proveedor WHERE id = NEW.pago_proveedor_id;
        SELECT * INTO compra FROM pagos_proveedor WHERE id = NEW.compra_proveedor_id;
        IF pago.id IS NULL OR compra.id IS NULL OR pago.tipo <> 'PAGO'
          OR compra.tipo <> 'COMPRA' OR pago.proveedor_id <> compra.proveedor_id THEN
          RAISE EXCEPTION 'Aplicación proveedor inválida: pago PAGO y compra COMPRA del mismo proveedor requeridos';
        END IF;
        IF NEW.importe <= 0
          OR NEW.importe > -pago.importe - COALESCE((SELECT SUM(importe) FROM aplicaciones_pago_proveedor WHERE pago_proveedor_id = pago.id), 0)
          OR NEW.importe > compra.importe - COALESCE((SELECT SUM(importe) FROM aplicaciones_pago_proveedor WHERE compra_proveedor_id = compra.id), 0) THEN
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