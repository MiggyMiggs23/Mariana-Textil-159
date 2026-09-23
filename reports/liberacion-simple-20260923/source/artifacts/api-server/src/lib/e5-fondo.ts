import { FondoError, type FondoExecutor } from "./fondo";
import { E5_ENABLED } from "./e5-feature";

/** Runs inside the same locked transaction as the inverse, never in a store reader. */
export async function assertE5NoIndependentInverse(tx: FondoExecutor, id: string, enabled = E5_ENABLED) {
  if (!enabled) return;
  const result = await tx.query("SELECT 1 FROM e5_devoluciones WHERE movimiento_fondo_id=$1::uuid", [id]);
  if (result.rows.length) {
    throw new FondoError(409, "E5_DEVOLUCION_INMUTABLE", "Una devolución E5 no admite un inverso independiente.");
  }
}