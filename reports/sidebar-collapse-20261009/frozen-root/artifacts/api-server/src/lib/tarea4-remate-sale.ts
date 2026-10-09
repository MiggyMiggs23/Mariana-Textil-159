export type RemateSaleDecision = {
  allowed: boolean;
  remate: boolean;
  rolloIds: number[];
  requiresPhysicalValidation: boolean;
};

type RemateSaleInput = {
  released: boolean;
  priceCents: number;
  costCents: number | null;
  rolloIds: readonly number[];
  activeRollIds: ReadonlySet<number>;
  /** Whether the pre-remate path already rejected this kind of below-cost sale. */
  legacyBlocksBelowCost: boolean;
  /**
   * Only for canonical FIFO consumers: permit work inside the transaction, but
   * require a second decision from the physical movements before commit.
   */
  allowDeferredPhysicalSources?: boolean;
};

/**
 * Pure policy for the future POS connection. A request cannot declare itself a
 * remate: every physical source must be present in the server-read active set.
 */
export function decideRemateSale(input: RemateSaleInput): RemateSaleDecision {
  const rolloIds = [...new Set(input.rolloIds)];
  const belowCost =
    input.costCents != null && input.priceCents < input.costCents;

  if (!input.released) {
    return {
      allowed: !belowCost || !input.legacyBlocksBelowCost,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    };
  }
  if (rolloIds.length === 0 && input.allowDeferredPhysicalSources) {
    return {
      allowed: true,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: true,
    };
  }
  if (!belowCost) {
    return {
      allowed: true,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    };
  }
  if (
    rolloIds.length === 0 ||
    rolloIds.some(
      id => !Number.isSafeInteger(id) || id <= 0 || !input.activeRollIds.has(id),
    )
  ) {
    return {
      allowed: false,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    };
  }
  return {
    allowed: true,
    remate: true,
    rolloIds,
    requiresPhysicalValidation: false,
  };
}

/**
 * Keeps the closed path schema-independent: with the gate off, the lookup is
 * never invoked and the prepared remate table need not exist.
 */
export async function loadActiveRemateRollIds(
  released: boolean,
  rolloIds: readonly number[],
  lookup: (rolloIds: readonly number[]) => Promise<readonly number[]>,
): Promise<ReadonlySet<number>> {
  if (!released) return new Set();
  const requested = [...new Set(rolloIds)].filter(
    id => Number.isSafeInteger(id) && id > 0,
  );
  if (requested.length === 0) return new Set();
  const requestedSet = new Set(requested);
  const active = await lookup(requested);
  return new Set(active.filter(id => requestedSet.has(id)));
}

export async function decideConsumedRemateSale(
  input: {
    released: boolean;
    priceCents: number;
    movements: ReadonlyArray<{ rolloId: number | null }>;
  },
  loadPhysicalSources: (
    rolloIds: readonly number[],
  ) => Promise<ReadonlyArray<{ rolloId: number; costCents: number | null }>>,
  loadActiveRollIds: (
    rolloIds: readonly number[],
  ) => Promise<readonly number[]>,
): Promise<RemateSaleDecision> {
  if (!input.released) {
    return {
      allowed: true,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    };
  }
  const rolloIds = [
    ...new Set(
      input.movements
        .map(movement => movement.rolloId)
        .filter((id): id is number => id != null),
    ),
  ];
  const physicalSources = await loadPhysicalSources(rolloIds);
  const physicalById = new Map(
    physicalSources.map(source => [source.rolloId, source]),
  );
  if (
    rolloIds.length === 0 ||
    rolloIds.some(id => {
      const cost = physicalById.get(id)?.costCents;
      return cost == null || !Number.isSafeInteger(cost) || cost <= 0;
    })
  ) {
    return {
      allowed: false,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    };
  }
  const belowCostRollIds = rolloIds.filter(
    id => physicalById.get(id)!.costCents! > input.priceCents,
  );
  if (belowCostRollIds.length === 0) {
    return {
      allowed: true,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    };
  }
  const activeRollIds = await loadActiveRemateRollIds(
    input.released,
    belowCostRollIds,
    loadActiveRollIds,
  );
  return decideRemateSale({
    released: input.released,
    priceCents: input.priceCents,
    // Each ID above was compared with its own locked physical cost.
    costCents: input.priceCents + 1,
    rolloIds: belowCostRollIds,
    activeRollIds,
    legacyBlocksBelowCost: false,
  });
}