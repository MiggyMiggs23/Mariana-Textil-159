/**
 * Operational cancellation read model used by the realtime dashboard.
 *
 * Cancellations are not accounted financial documents.  Their own event
 * timestamp and ticket state are therefore the source of truth for realtime
 * cancellation cards, stores, and drilldowns.
 */
export function buildRealtimeCancellationReadModel(alias = "t"): string {
  return `SELECT ${alias}.id,${alias}.ubicacion_id,${alias}.cancelado_at,${alias}.total importe
    FROM tickets ${alias}
    WHERE ${alias}.estado='CANCELADO'
      AND ${alias}.cancelado_at IS NOT NULL`;
}

/** Date/location window applied to the canonical cancellation rows. */
export function realtimeCancellationWindow(alias = "c"): string {
  return `($1::timestamptz IS NULL OR ${alias}.cancelado_at >= $1)
    AND ($2::timestamptz IS NULL OR ${alias}.cancelado_at <= $2)
    AND ($3::int IS NULL OR ${alias}.ubicacion_id=$3)`;
}

/** Shared cancellation denominator: accounted tickets plus cancellations. */
export function calculateRealtimeCancellationRate(
  accountedTickets: number,
  cancelledTickets: number,
): number {
  const denominator = accountedTickets + cancelledTickets;
  return denominator === 0 ? 0 : (cancelledTickets / denominator) * 100;
}