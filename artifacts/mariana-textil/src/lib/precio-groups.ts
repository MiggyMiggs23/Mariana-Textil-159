export const spanishPriceCollator = new Intl.Collator("es-MX", {
  sensitivity: "base",
  numeric: true,
});

export type PriceGroupItem = {
  id: number;
  sku: string;
  tela: string;
  color: string;
};

export type PriceGroup<T extends PriceGroupItem> = {
  key: string;
  tela: string;
  products: T[];
};

export function normalizeTela(tela: string): string {
  return tela.trim().toLocaleLowerCase("es-MX");
}

export function groupPricesByTela<T extends PriceGroupItem>(
  products: readonly T[],
): PriceGroup<T>[] {
  const groups = new Map<string, PriceGroup<T>>();

  for (const product of products) {
    const key = normalizeTela(product.tela);
    const existing = groups.get(key);
    if (existing) {
      existing.products.push(product);
    } else {
      groups.set(key, {
        key,
        tela: product.tela,
        products: [product],
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      products: [...group.products].sort(
        (left, right) =>
          spanishPriceCollator.compare(left.color, right.color) ||
          spanishPriceCollator.compare(left.sku, right.sku),
      ),
    }))
    .sort((left, right) =>
      spanishPriceCollator.compare(left.tela.trim(), right.tela.trim()),
    );
}

export type DuplicateTelaSpelling = {
  normalizedTela: string;
  spellings: string[];
};

/**
 * Produces a non-UI data-quality report for callers/tests without querying the DB.
 */
export function findDuplicateRawTelaSpellings<T extends Pick<PriceGroupItem, "tela">>(
  products: readonly T[],
): DuplicateTelaSpelling[] {
  const spellingsByKey = new Map<string, Set<string>>();
  for (const product of products) {
    const key = normalizeTela(product.tela);
    const spellings = spellingsByKey.get(key) ?? new Set<string>();
    spellings.add(product.tela);
    spellingsByKey.set(key, spellings);
  }

  return [...spellingsByKey.entries()]
    .filter(([, spellings]) => spellings.size > 1)
    .map(([normalizedTela, spellings]) => ({
      normalizedTela,
      spellings: [...spellings],
    }))
    .sort((left, right) =>
      spanishPriceCollator.compare(left.normalizedTela, right.normalizedTela),
    );
}

export function isBulkSelectable(
  product: {
    unidad: string;
    seVendePorMetro: boolean;
  },
  mode: "ROLLO" | "MAYOREO" | "MENUDEO",
): boolean {
  return (
    mode === "ROLLO" ||
    (product.unidad !== "KILO" && product.seVendePorMetro)
  );
}

export function countBelowCost<T extends {
  preciosPorModo: Record<string, { costoUnitarioBase: string | null }>;
}>(
  products: readonly T[],
  mode: "ROLLO" | "MAYOREO" | "MENUDEO",
  newPrice: number,
): number {
  return products.filter((product) => {
    const cost = product.preciosPorModo[mode]?.costoUnitarioBase;
    return cost != null && newPrice - Number(cost) < 0;
  }).length;
}