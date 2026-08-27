import type { Pool } from "pg";

/** Repeatable upgrade for immutable supplier-payment reversals. */
export async function ensurePagosProveedorSchema(pool: Pool): Promise<void> {
  await pool.query("ALTER TYPE tipo_pago_proveedor ADD VALUE IF NOT EXISTS 'REVERSO'");
  await pool.query(`
    ALTER TABLE pagos_proveedor
      ADD COLUMN IF NOT EXISTS movimiento_origen_id integer
      REFERENCES pagos_proveedor(id);
    CREATE UNIQUE INDEX IF NOT EXISTS pagos_proveedor_reverso_origen_uidx
      ON pagos_proveedor(movimiento_origen_id)
      WHERE tipo='REVERSO' AND movimiento_origen_id IS NOT NULL;
    CREATE OR REPLACE FUNCTION prevent_pago_proveedor_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Los pagos a proveedor son inmutables; registre un reverso o ajuste.';
    END $$;
    DROP TRIGGER IF EXISTS pagos_proveedor_inmutables ON pagos_proveedor;
    CREATE TRIGGER pagos_proveedor_inmutables
      BEFORE UPDATE OR DELETE ON pagos_proveedor
      FOR EACH ROW EXECUTE FUNCTION prevent_pago_proveedor_mutation();
  `);
}