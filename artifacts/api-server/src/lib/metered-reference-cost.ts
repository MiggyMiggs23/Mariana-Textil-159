import { and, eq, lte } from "drizzle-orm";
import { entradasTable, rollosTable } from "@workspace/db/schema";

export type MeteredReferenceCost =
  | {
      cost: string;
      status: "AVERAGE_12_MONTHS";
      isOlderThan12Months: false;
      rollsIncluded: number;
      latestReceptionDate: Date;
    }
  | {
      cost: string;
      status: "STALE_LAST_KNOWN";
      isOlderThan12Months: true;
      rollsIncluded: 1;
      latestReceptionDate: Date;
    }
  | {
      cost: null;
      status: "NO_COST";
      isOlderThan12Months: false;
      rollsIncluded: 0;
      latestReceptionDate: null;
    };

export type MeteredCostRow = {
  rollId: number;
  costPerUnit: string | null;
  receptionDate: Date;
};

type MeteredCostDatabase = Pick<typeof import("@workspace/db").db, "select">;

function twelveCalendarMonthsBefore(asOf: Date): Date {
  const year = asOf.getUTCFullYear() - 1;
  const month = asOf.getUTCMonth();
  const lastDayInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    month,
    Math.min(asOf.getUTCDate(), lastDayInTargetMonth),
    asOf.getUTCHours(),
    asOf.getUTCMinutes(),
    asOf.getUTCSeconds(),
    asOf.getUTCMilliseconds(),
  ));
}

function parsedPositiveCost(value: string | null): number | null {
  if (value === null) return null;
  const cost = Number(value);
  return Number.isFinite(cost) && cost > 0 ? cost : null;
}

/**
 * Computes the metered-sale reference cost from reception history.
 * Every received roll has equal weight; its quantity is deliberately absent.
 */
export function calculateMeteredReferenceCost(
  rows: MeteredCostRow[],
  asOf: Date,
): MeteredReferenceCost {
  if (!Number.isFinite(asOf.getTime())) {
    throw new Error("The metered reference cost requires a valid as-of date.");
  }

  const periodStart = twelveCalendarMonthsBefore(asOf);
  const validRows = rows
    .map((row) => ({ ...row, parsedCost: parsedPositiveCost(row.costPerUnit) }))
    .filter(
      (row): row is MeteredCostRow & { parsedCost: number } =>
        row.parsedCost !== null &&
        Number.isFinite(row.receptionDate.getTime()) &&
        row.receptionDate <= asOf,
    );
  const periodRows = validRows.filter((row) => row.receptionDate >= periodStart);

  if (periodRows.length > 0) {
    const average =
      periodRows.reduce((total, row) => total + row.parsedCost, 0) /
      periodRows.length;
    const latestReceptionDate = periodRows.reduce(
      (latest, row) => (row.receptionDate > latest ? row.receptionDate : latest),
      periodRows[0]!.receptionDate,
    );
    return {
      cost: average.toFixed(2),
      status: "AVERAGE_12_MONTHS",
      isOlderThan12Months: false,
      rollsIncluded: periodRows.length,
      latestReceptionDate,
    };
  }

  const latestKnown = validRows.reduce<(typeof validRows)[number] | null>(
    (latest, row) =>
      latest === null ||
      row.receptionDate > latest.receptionDate ||
      (row.receptionDate.getTime() === latest.receptionDate.getTime() &&
        row.rollId > latest.rollId)
        ? row
        : latest,
    null,
  );
  if (latestKnown) {
    return {
      cost: latestKnown.parsedCost.toFixed(2),
      status: "STALE_LAST_KNOWN",
      isOlderThan12Months: true,
      rollsIncluded: 1,
      latestReceptionDate: latestKnown.receptionDate,
    };
  }

  return {
    cost: null,
    status: "NO_COST",
    isOlderThan12Months: false,
    rollsIncluded: 0,
    latestReceptionDate: null,
  };
}

/**
 * Shared server-side entry point. Reception age is based on entradas.fecha,
 * never on the roll's creation timestamp.
 */
export async function meteredReferenceCost(
  database: MeteredCostDatabase,
  productId: number,
  asOf: Date,
): Promise<MeteredReferenceCost> {
  if (!Number.isFinite(asOf.getTime())) {
    throw new Error("The metered reference cost requires a valid as-of date.");
  }
  const rows = await database
    .select({
      rollId: rollosTable.id,
      costPerUnit: rollosTable.costoUnitario,
      receptionDate: entradasTable.fecha,
    })
    .from(rollosTable)
    .innerJoin(entradasTable, eq(rollosTable.recepcionId, entradasTable.id))
    .where(
      and(
        eq(rollosTable.productoId, productId),
        lte(entradasTable.fecha, asOf),
      ),
    );

  return calculateMeteredReferenceCost(rows, asOf);
}