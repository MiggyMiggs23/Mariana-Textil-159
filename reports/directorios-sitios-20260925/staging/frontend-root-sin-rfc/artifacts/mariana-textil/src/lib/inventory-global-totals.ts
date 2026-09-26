export interface GroupedInventoryValues {
  rollosCount: number;
  totalMetros: string;
  totalKilos: string;
  totalBolsas: string;
}

export interface GroupedInventoryTotals {
  rollosCount: number;
  totalMetros: string;
  totalKilos: string;
  totalBolsas: string;
}

interface DecimalParts {
  coefficient: bigint;
  scale: number;
}

function parseSavedDecimal(value: string): DecimalParts {
  const normalized = value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new TypeError(`Cantidad guardada inválida: ${value}`);
  }

  const fraction = match[3] ?? "";
  const sign = match[1] === "-" ? -1n : 1n;
  return {
    coefficient: sign * BigInt(`${match[2]}${fraction}`),
    scale: fraction.length,
  };
}

function addSavedDecimals(values: readonly string[]): string {
  const parts = values.map(parseSavedDecimal);
  const scale = parts.reduce((maximum, value) => Math.max(maximum, value.scale), 0);
  const coefficient = parts.reduce(
    (total, value) => total + value.coefficient * (10n ** BigInt(scale - value.scale)),
    0n,
  );
  const sign = coefficient < 0n ? "-" : "";
  const digits = (coefficient < 0n ? -coefficient : coefficient).toString();

  if (scale === 0) return `${sign}${digits}`;

  const padded = digits.padStart(scale + 1, "0");
  return `${sign}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}

/**
 * Totals exactly the grouped rows already returned for the active view.
 * Decimal strings are added before the shared formatter performs visible rounding.
 */
export function calculateGroupedInventoryTotals(
  groups: readonly GroupedInventoryValues[],
): GroupedInventoryTotals {
  return {
    rollosCount: groups.reduce((total, group) => total + group.rollosCount, 0),
    totalMetros: addSavedDecimals(groups.map((group) => group.totalMetros)),
    totalKilos: addSavedDecimals(groups.map((group) => group.totalKilos)),
    totalBolsas: addSavedDecimals(groups.map((group) => group.totalBolsas)),
  };
}