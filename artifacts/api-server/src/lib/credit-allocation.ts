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
  /**
   * Historical compatibility marker.  This field is intentionally retained
   * for notes written by the old manual-favor flow: those notes continue to
   * reject a favor that predates them.  New notes must not write this marker.
   */
  preventImplicitFavor?: boolean;
  /**
   * Historical append-only application evidence for a marked note.  These
   * rows are loaded from aplicaciones_credito and are applied before normal
   * FIFO; prospective auto-favor rows are intentionally not loaded here.
   */
  explicitFavorApplications?: CreditFavorApplication[];
  /**
   * Immutable application rows already consuming this ABONO's database
   * budget.  This is storage evidence only; it is never subtracted from the
   * canonical financial projection.
   */
  immutableAppliedCents?: number;
};
export type CreditFavorApplication = {
  sourceId: number;
  targetId: number;
  amountCents: number;
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

/**
 * The balance shown beside a ledger movement is a projection of the complete
 * prefix ending at that movement.  It is deliberately separate from
 * `saldoCorridoHistorico` (the old raw signed SUM kept by the API for
 * compatibility).
 */
export type CreditMovementProjection = {
  movementId: number;
  saldoDeudorProyectadoCents: number;
  saldoAFavorProyectadoCents: number;
};

export type CreditLedgerProjectionOptions = {
  /**
   * Prefix balances are needed by the account statement UI/export.  Keep the
   * default off for aging/limit reads that only need the final balance.
   */
  includeMovementProjections?: boolean;
};

export type AutomaticFavorCandidate = {
  source: CreditLedgerMovement;
  appliedCents: number;
};

export type AutomaticFavorEligibility = {
  autorizable: boolean;
  motivoBloqueo: string | null;
};

/**
 * Checks whether the append-only evidence table can document the allocations
 * proposed by the canonical projector.  This is a storage-capability guard,
 * not a second balance calculation: negative AJUSTE movements are valid
 * ledger sources but applications_credito only accepts ABONO sources.
 */
export function evaluateAutomaticFavorEligibility(
  candidates: AutomaticFavorCandidate[],
): AutomaticFavorEligibility {
  for (const candidate of candidates) {
    if (candidate.appliedCents <= 0) continue;
    if (candidate.source.tipo !== "ABONO") {
      return {
        autorizable: false,
        motivoBloqueo:
          "No se puede documentar el saldo a favor automático porque proviene de un ajuste negativo; aplicaciones_credito solo acepta ABONO.",
      };
    }
    const consumedCents = Math.max(
      0,
      candidate.source.immutableAppliedCents ?? 0,
    );
    const sourceCents = Math.max(0, -moneyToCents(candidate.source.importe));
    const availableForEvidenceCents = Math.max(
      0,
      sourceCents - consumedCents,
    );
    if (candidate.appliedCents > availableForEvidenceCents) {
      return {
        autorizable: false,
        motivoBloqueo:
          "No se puede documentar el saldo a favor automático porque el ABONO ya tiene aplicaciones inmutables consumidas.",
      };
    }
  }
  return { autorizable: true, motivoBloqueo: null };
}

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
function projectCreditLedgerCore(movements: CreditLedgerMovement[]): {
  charges: CreditLedgerCharge[];
  allCharges: CreditLedgerCharge[];
  allocations: CreditAllocation[];
  overpaymentCents: number;
  overpaymentSources: Array<{
    movementId: number;
    availableCents: number;
    tipo: CreditLedgerMovement["tipo"];
  }>;
  balanceCents: number;
} {
  const ordered = [...movements].sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const cents = (value: string | number) => moneyToCents(value);
  const reversedAbonos = new Set(ordered.filter((m) =>
    m.tipo === "REVERSO" && m.movimientoOrigenId != null && cents(m.importe) > 0,
  ).map((m) => m.movimientoOrigenId!));
  const ticketReductions = new Map<number, number>();
  const directedPayments: CreditLedgerMovement[] = [];
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
    if (isDirectedPayment) directedPayments.push(movement);
  }
  const sourceMovements = ordered.filter((movement) => {
    const amount = cents(movement.importe);
    return (movement.tipo === "ABONO" &&
      !reversedAbonos.has(movement.id)) ||
      (movement.tipo === "AJUSTE" && amount < 0);
  });
  const baseTargetBalances = new Map<number, number>();
  const chargeMovements = ordered.filter((movement) =>
    movement.tipo === "VENTA_CREDITO" || (movement.tipo === "AJUSTE" && cents(movement.importe) > 0));
  for (const movement of chargeMovements) {
    baseTargetBalances.set(
      movement.id,
      Math.max(
        0,
        Math.max(0, cents(movement.importe)) -
          (movement.tipo === "VENTA_CREDITO" && movement.ticketId != null
            ? ticketReductions.get(movement.ticketId) ?? 0
            : 0),
      ),
    );
  }
  const directedReservedBySource = new Map<number, number>();
  for (const payment of directedPayments) {
    const targetId = payment.directedMovimientoId!;
    const targetBalance = baseTargetBalances.get(targetId) ?? 0;
    const appliedCents = Math.min(
      targetBalance,
      Math.max(0, -cents(payment.importe)),
    );
    if (appliedCents <= 0) continue;
    baseTargetBalances.set(targetId, targetBalance - appliedCents);
    directedReservedBySource.set(payment.id, appliedCents);
  }

  // Project each receipt in ledger order.  This preserves the historical
  // FIFO interpretation while making explicit applications residual-aware:
  // ordinary older debt consumes a receipt first, and only its residual can
  // be explicitly directed to a later note.  A marked note is protected only
  // from receipts that predate it; later receipts remain ordinary FIFO.
  //
  // `preventImplicitFavor` is read-only historical compatibility.  New
  // charges omit it, so an available favor can settle them automatically
  // regardless of whether the source predates the charge.
  const balances = new Map(
    chargeMovements.map((movement) => [
      movement.id,
      baseTargetBalances.get(movement.id) ?? 0,
    ]),
  );
  const explicitAllocations: CreditAllocation[] = [];
  const allocations: CreditAllocation[] = [];
  const overpaymentSources = new Map<number, number>();
  const sourceIds = new Set(sourceMovements.map((movement) => movement.id));
  const targetById = new Map(chargeMovements.map((movement) => [movement.id, movement]));
  const movementPrecedes = (
    left: CreditLedgerMovement,
    right: CreditLedgerMovement,
  ) =>
    left.createdAt.getTime() < right.createdAt.getTime() ||
    (left.createdAt.getTime() === right.createdAt.getTime() && left.id < right.id);
  const canImplicitlyApply = (
    source: CreditLedgerMovement,
    target: CreditLedgerMovement,
  ) =>
    // Unmarked historical charges preserve the old global FIFO projection.
    !target.preventImplicitFavor || movementPrecedes(target, source);

  for (const source of sourceMovements) {
    let remainingCents = Math.max(
      0,
      Math.max(0, -cents(source.importe)) -
        (directedReservedBySource.get(source.id) ?? 0),
    );
    const applyNormal = (
      targetPredicate: (target: CreditLedgerMovement) => boolean,
    ) => {
      for (const target of chargeMovements) {
        if (remainingCents <= 0) break;
        if (!targetPredicate(target) || !canImplicitlyApply(source, target)) {
          continue;
        }
        const balanceBeforeCents = balances.get(target.id) ?? 0;
        if (balanceBeforeCents <= 0) continue;
        const appliedCents = Math.min(remainingCents, balanceBeforeCents);
        balances.set(target.id, balanceBeforeCents - appliedCents);
        remainingCents -= appliedCents;
        allocations.push({
          sourceId: source.id,
          targetId: target.id,
          appliedCents,
          balanceBeforeCents,
          balanceAfterCents: balanceBeforeCents - appliedCents,
        });
      }
    };

    const applications =
      source.tipo === "ABONO" ? source.explicitFavorApplications ?? [] : [];
    for (const application of applications) {
      if (
        application.sourceId !== source.id ||
        !sourceIds.has(source.id) ||
        !Number.isFinite(application.amountCents) ||
        application.amountCents <= 0
      ) {
        continue;
      }
      const target = targetById.get(application.targetId);
      if (!target) continue;
      // Before targeting this note, settle all older implicitly eligible
      // charges. This prevents explicit evidence from reopening an older note.
      applyNormal((candidate) =>
        candidate.id !== target.id && movementPrecedes(candidate, target),
      );
      if (remainingCents <= 0) break;
      const balanceBeforeCents = balances.get(target.id) ?? 0;
      const appliedCents = Math.min(
        remainingCents,
        balanceBeforeCents,
        application.amountCents,
      );
      if (appliedCents <= 0) continue;
      balances.set(target.id, balanceBeforeCents - appliedCents);
      remainingCents -= appliedCents;
      explicitAllocations.push({
        sourceId: source.id,
        targetId: target.id,
        appliedCents,
        balanceBeforeCents,
        balanceAfterCents: balanceBeforeCents - appliedCents,
      });
    }
    // Any residual ordinary credit follows FIFO. Crucially, a marked note
    // becomes eligible once the receipt itself is later than that note.
    applyNormal(() => true);
    overpaymentSources.set(source.id, remainingCents);
  }
  const overpaymentCents = [...overpaymentSources.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
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
  return {
    charges,
    allCharges,
    allocations: [...allocations, ...explicitAllocations],
    overpaymentCents,
    overpaymentSources: sourceMovements.map((movement) => ({
      movementId: movement.id,
      availableCents: overpaymentSources.get(movement.id) ?? 0,
      tipo: movement.tipo,
    })),
    balanceCents,
  };
}

function projectSimpleLedgerPrefixes(
  ordered: CreditLedgerMovement[],
): CreditMovementProjection[] {
  const targets: Array<{
    movement: CreditLedgerMovement;
    balanceCents: number;
  }> = [];
  const sources: Array<{
    movement: CreditLedgerMovement;
    remainingCents: number;
  }> = [];
  const result: CreditMovementProjection[] = [];
  const movementPrecedes = (
    left: CreditLedgerMovement,
    right: CreditLedgerMovement,
  ) =>
    left.createdAt.getTime() < right.createdAt.getTime() ||
    (left.createdAt.getTime() === right.createdAt.getTime() && left.id < right.id);
  const canImplicitlyApply = (
    source: CreditLedgerMovement,
    target: CreditLedgerMovement,
  ) =>
    !target.preventImplicitFavor || movementPrecedes(target, source);

  for (const movement of ordered) {
    const amountCents = moneyToCents(movement.importe);
    const isTarget =
      movement.tipo === "VENTA_CREDITO" ||
      (movement.tipo === "AJUSTE" && amountCents > 0);
    const isSource =
      (movement.tipo === "ABONO" && amountCents < 0) ||
      (movement.tipo === "AJUSTE" && amountCents < 0);

    if (isTarget) {
      const target = { movement, balanceCents: amountCents };
      // A favor that predates an unmarked new note is consumed when the note
      // enters the ledger.  This is the prospective auto-application rule.
      for (const source of sources) {
        if (source.remainingCents <= 0 || !canImplicitlyApply(source.movement, movement)) {
          continue;
        }
        const applied = Math.min(source.remainingCents, target.balanceCents);
        source.remainingCents -= applied;
        target.balanceCents -= applied;
        if (target.balanceCents <= 0) break;
      }
      targets.push(target);
    }

    if (isSource) {
      const source = {
        movement,
        remainingCents: Math.max(0, -amountCents),
      };
      for (const target of targets) {
        if (source.remainingCents <= 0) break;
        if (!canImplicitlyApply(source.movement, target.movement)) continue;
        const applied = Math.min(source.remainingCents, target.balanceCents);
        source.remainingCents -= applied;
        target.balanceCents -= applied;
      }
      sources.push(source);
    }

    result.push({
      movementId: movement.id,
      saldoDeudorProyectadoCents: targets.reduce(
        (sum, target) => sum + target.balanceCents,
        0,
      ),
      saldoAFavorProyectadoCents: sources.reduce(
        (sum, source) => sum + source.remainingCents,
        0,
      ),
    });
  }
  return result;
}

/**
 * Projects the immutable credit ledger and, when requested, exposes the
 * canonical balance after every chronological prefix.  Consumers must use
 * these values instead of rebuilding a running balance with SUM(importe):
 * the latter cannot represent FIFO applications, reversals, or historical
 * favor exceptions.
 *
 * Prefixes use the exact core projector when reversals, directed payments, or
 * explicit applications are present.  A plain FIFO ledger uses an equivalent
 * incremental projection to keep the statement path bounded at O(n²), while
 * callers that only need the final balance leave this option off entirely.
 */
export function projectCreditLedger(
  movements: CreditLedgerMovement[],
  options: CreditLedgerProjectionOptions = {},
): {
  charges: CreditLedgerCharge[];
  allCharges: CreditLedgerCharge[];
  allocations: CreditAllocation[];
  overpaymentCents: number;
  overpaymentSources: Array<{
    movementId: number;
    availableCents: number;
    tipo: CreditLedgerMovement["tipo"];
  }>;
  balanceCents: number;
  movementProjections: CreditMovementProjection[];
} {
  const ordered = [...movements].sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const projection = projectCreditLedgerCore(ordered);
  const movementProjections = options.includeMovementProjections === true
    ? ordered.some((movement) =>
        movement.tipo === "REVERSO" ||
        movement.directedMovimientoId != null ||
        (movement.explicitFavorApplications?.length ?? 0) > 0)
      ? ordered.map((_, index) => {
          const prefix = projectCreditLedgerCore(ordered.slice(0, index + 1));
          return {
            movementId: ordered[index]!.id,
            saldoDeudorProyectadoCents: prefix.balanceCents,
            saldoAFavorProyectadoCents: prefix.overpaymentCents,
          };
        })
      : projectSimpleLedgerPrefixes(ordered)
    : [];
  return { ...projection, movementProjections };
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