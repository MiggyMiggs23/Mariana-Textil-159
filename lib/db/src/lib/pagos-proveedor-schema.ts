import type { Pool } from "pg";

/** Repeatable upgrades for supplier-payment idempotency and reversals. */
export async function ensurePagosProveedorSchema(pool: Pool): Promise<void> {
  await pool.query("ALTER TYPE tipo_pago_proveedor ADD VALUE IF NOT EXISTS 'REVERSO'");
  // Extending the enum retains CHEQUE and OTRO rows already in the ledger.
  await pool.query("ALTER TYPE forma_pago_proveedor ADD VALUE IF NOT EXISTS 'FACTURADO'");
  await pool.query(`
    ALTER TABLE pagos_proveedor
      ADD COLUMN IF NOT EXISTS movimiento_origen_id integer
      REFERENCES pagos_proveedor(id);
  `);
  const duplicatePurchases = await pool.query<{ entrada_id: number }>(`
    SELECT entrada_id
    FROM pagos_proveedor
    WHERE tipo='COMPRA' AND entrada_id IS NOT NULL
    GROUP BY entrada_id
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicatePurchases.rowCount) {
    throw new Error(
      "No se puede garantizar una sola COMPRA por Entrada: existen cargos duplicados que requieren conciliación manual.",
    );
  }
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS pagos_proveedor_entrada_compra_idx
      ON pagos_proveedor(entrada_id)
      WHERE tipo='COMPRA' AND entrada_id IS NOT NULL;
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