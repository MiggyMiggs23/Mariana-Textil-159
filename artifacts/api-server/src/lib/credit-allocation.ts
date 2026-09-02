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
  linkedReductionCents?: number;
};
export type CreditAllocation = {
  sourceId: number;
  targetId: number;
  appliedCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
};
export type CreditAllocationBalance = {
  targetId: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
};
export type CreditLedgerMovement = {
  id: number;
  ticketId: number | null;
  directedMovimientoId?: number | null;
  movimientoOrigenId?: number | null;
  tipo: "VENTA_CREDITO" | "ABONO" | "REVERSO" | "AJUSTE";
  importe: string | number;
  createdAt: Date;
  fechaVencimiento?: string | Date | null;
  folio?: number | null;
  diasPlazo?: number | null;
  notas?: string | null;
};
export type CreditLedgerCharge = {
  movimientoId: number;
  ticketId: number | null;
  createdAt: Date;
  dueAt: string | null;
  originalCents: number;
  pendienteCents: number;
  folio: number | null;
  diasPlazo: number | null;
  notas: string | null;
  tipo: "VENTA_CREDITO" | "AJUSTE";
};

export function allocateCreditFifo(
  sources: CreditAllocationSource[],
  targets: CreditAllocationTarget[],
): {
  allocations: CreditAllocation[];
  balances: CreditAllocationBalance[];
  remainingCents: number;
} {
  const orderedTargets = targets.map((target) => ({
    ...target,
    balanceCents: Math.max(
      0,
      target.balanceCents - Math.max(0, target.linkedReductionCents ?? 0),
    ),
  })).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
  );
  let remainingCents = sources.reduce((sum, source) => sum + source.availableCents, 0);
  const allocations: CreditAllocation[] = [];
  const balances: CreditAllocationBalance[] = [];
  for (const target of orderedTargets) {
    const appliedCents = Math.min(remainingCents, target.balanceCents);
    if (appliedCents <= 0) {
      balances.push({
        targetId: target.id,
        balanceBeforeCents: target.balanceCents,
        balanceAfterCents: target.balanceCents,
      });
      continue;
    }
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
    balances.push({
      targetId: target.id,
      balanceBeforeCents: target.balanceCents,
      balanceAfterCents: target.balanceCents - appliedCents,
    });
  }
  return { allocations, balances, remainingCents };
}

export function moneyToCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function centsToMoney(value: number): string {
  return (value / 100).toFixed(2);
}

/** The sole FIFO interpretation of an immutable customer credit ledger. */
export function projectCreditLedger(movements: CreditLedgerMovement[]): {
  charges: CreditLedgerCharge[];
  allCharges: CreditLedgerCharge[];
  allocations: CreditAllocation[];
  overpaymentCents: number;
  balanceCents: number;
} {
  const ordered = [...movements].sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const cents = (value: string | number) => moneyToCents(value);
  const reversedAbonos = new Set(ordered.filter((m) =>
    m.tipo === "REVERSO" && m.movimientoOrigenId != null && cents(m.importe) > 0,
  ).map((m) => m.movimientoOrigenId!));
  const ticketReductions = new Map<number, number>();
  const chargeReductions = new Map<number, number>();
  for (const movement of ordered) {
    const amount = cents(movement.importe);
    const isLinkedReversal =
      movement.tipo === "REVERSO" &&
      movement.ticketId != null &&
      amount < 0;
    const isDirectedPayment =
      movement.tipo === "ABONO" &&
      movement.directedMovimientoId != null &&
      !reversedAbonos.has(movement.id) &&
      amount < 0;
    if (isLinkedReversal) {
      ticketReductions.set(
        movement.ticketId!,
        (ticketReductions.get(movement.ticketId!) ?? 0) - amount,
      );
    }
    if (isDirectedPayment) {
      chargeReductions.set(
        movement.directedMovimientoId!,
        (chargeReductions.get(movement.directedMovimientoId!) ?? 0) - amount,
      );
    }
  }
  const sources = ordered.flatMap((movement) => {
    const amount = cents(movement.importe);
    return (movement.tipo === "ABONO" &&
      movement.directedMovimientoId == null &&
      !reversedAbonos.has(movement.id)) ||
      (movement.tipo === "AJUSTE" && amount < 0)
      ? [{ id: movement.id, availableCents: Math.max(0, -amount) }] : [];
  });
  const chargeMovements = ordered.filter((movement) =>
    movement.tipo === "VENTA_CREDITO" || (movement.tipo === "AJUSTE" && cents(movement.importe) > 0));
  const allocation = allocateCreditFifo(sources, chargeMovements.map((movement) => ({
    id: movement.id,
    balanceCents: Math.max(0, cents(movement.importe)),
    createdAt: movement.createdAt,
    linkedReductionCents:
      (movement.tipo === "VENTA_CREDITO" && movement.ticketId != null
        ? ticketReductions.get(movement.ticketId) ?? 0
        : 0) +
      (chargeReductions.get(movement.id) ?? 0),
  })));
  const balances = new Map(allocation.balances.map((item) => [item.targetId, item.balanceAfterCents]));
  const allCharges = chargeMovements.map((movement) => ({
    movimientoId: movement.id,
    ticketId: movement.ticketId,
    createdAt: movement.createdAt,
    dueAt: movement.fechaVencimiento == null ? null : typeof movement.fechaVencimiento === "string"
      ? movement.fechaVencimiento.slice(0, 10) : movement.fechaVencimiento.toISOString().slice(0, 10),
    originalCents: Math.max(0, cents(movement.importe)),
    pendienteCents: balances.get(movement.id) ?? 0,
    folio: movement.folio ?? null,
    diasPlazo: movement.diasPlazo ?? null,
    notas: movement.notas ?? null,
    tipo: movement.tipo as "VENTA_CREDITO" | "AJUSTE",
  }));
  const charges = allCharges.filter((charge) => charge.pendienteCents > 0);
  const balanceCents = charges.reduce((sum, charge) => sum + charge.pendienteCents, 0);
  return { charges, allCharges, allocations: allocation.allocations, overpaymentCents: allocation.remainingCents, balanceCents };
}

export type CuentaDestino = "CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL";

export function isValidPaymentDestination(
  formaPago: string,
  cuentaDestino: string,
): cuentaDestino is CuentaDestino {
  return (
    (formaPago === "EFECTIVO" && cuentaDestino === "CAJA_FISICA") ||
    (formaPago === "TRANSFERENCIA" &&
      (cuentaDestino === "CUENTA_FISCAL" || cuentaDestino === "CUENTA_NO_FISCAL")) ||
    (formaPago === "FACTURADO" && cuentaDestino === "CUENTA_FISCAL")
  );
}