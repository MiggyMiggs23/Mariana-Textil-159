import { validateCashSnapshot } from "./caja-cash-ledger";

/** Preserve each old reader's legacy result, but never recompute an E2 cut.
 * Commercial refunds are already included in that immutable cash snapshot. */
export function analyticsCutDifference(row: { id: unknown; diferencia: unknown; cash_snapshots?: unknown }): string {
  if (row.cash_snapshots == null) return String(row.diferencia);
  if (!Array.isArray(row.cash_snapshots) || row.cash_snapshots.length !== 1) {
    throw new Error("E2: snapshot de cierre duplicado o inválido en analítica");
  }
  return validateCashSnapshot(row.cash_snapshots[0], Number(row.id)).diferencia;
}