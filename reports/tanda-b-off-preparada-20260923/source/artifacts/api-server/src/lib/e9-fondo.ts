import { FondoError, type FondoExecutor } from "./fondo";
import { E9_ENABLED } from "./e9-feature";

export async function assertE9NoIndependentInverse(tx: FondoExecutor, id: string, enabled = E9_ENABLED) {
  if (!enabled) return;
  const result = await tx.query("SELECT 1 FROM e9_entregas WHERE movimiento_fondo_id=$1::uuid", [id]);
  if (result.rows.length) throw new FondoError(409, "E9_RECEPCION_INMUTABLE", "Una recepción E9 no admite un inverso independiente ni ajuste de investigación.");
}
/** Called only behind the existing ADMIN Fondo route, never from store readers. */
export async function readE9FundOrigin(tx: FondoExecutor, id: string, enabled = E9_ENABLED) {
  if (!enabled) return undefined;
  const result = await tx.query<{ id: string; corte_id: number }>(
    "SELECT id,corte_id FROM e9_entregas WHERE movimiento_fondo_id=$1::uuid", [id]);
  const row = result.rows[0];
  return row ? { entregaId: row.id, corteId: row.corte_id,
    corteHref: `/caja/cortes?sesionId=${row.corte_id}` } : undefined;
}