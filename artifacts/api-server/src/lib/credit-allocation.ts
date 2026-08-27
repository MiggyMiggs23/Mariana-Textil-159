/**
 * Generic FIFO allocator for a credit ledger. Amounts are integer cents so the
 * same algorithm can be reused by customer and supplier ledgers without
 * decimal rounding differences.
 */
export type CreditAllocationSource = { id: number; availableCents: number };
export type CreditAllocationTarget = {
  id: number;
  balanceCents: number;
  createdAt: Date;
};
export type CreditAllocation = {
  sourceId: number;
  targetId: number;
  appliedCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
};

export function allocateCreditFifo(
  sources: CreditAllocationSource[],
  targets: CreditAllocationTarget[],
): { allocations: CreditAllocation[]; remainingCents: number } {
  const orderedTargets = [...targets].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
  );
  let remainingCents = sources.reduce((sum, source) => sum + source.availableCents, 0);
  const allocations: CreditAllocation[] = [];
  for (const target of orderedTargets) {
    if (remainingCents <= 0) break;
    const appliedCents = Math.min(remainingCents, target.balanceCents);
    if (appliedCents <= 0) continue;
    // Sources are consumed in their supplied (ledger) order.
    let left = appliedCents;
    for (const source of sources) {
      if (left <= 0) break;
      const amount = Math.min(source.availableCents, left);
      if (amount <= 0) continue;
      allocations.push({
        sourceId: source.id,
        targetId: target.id,
        appliedCents: amount,
        balanceBeforeCents: target.balanceCents - (appliedCents - left),
        balanceAfterCents: target.balanceCents - (appliedCents - left + amount),
      });
      source.availableCents -= amount;
      left -= amount;
      remainingCents -= amount;
    }
  }
  return { allocations, remainingCents };
}

export function moneyToCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function centsToMoney(value: number): string {
  return (value / 100).toFixed(2);
}

export type CuentaDestino = "CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL";

export function isValidPaymentDestination(
  formaPago: string,
  cuentaDestino: string,
): cuentaDestino is CuentaDestino {
  return (
    (formaPago === "EFECTIVO" && cuentaDestino === "CAJA_FISICA") ||
    (formaPago === "TRANSFERENCIA" &&
      (cuentaDestino === "CUENTA_FISCAL" || cuentaDestino === "CUENTA_NO_FISCAL"))
  );
}