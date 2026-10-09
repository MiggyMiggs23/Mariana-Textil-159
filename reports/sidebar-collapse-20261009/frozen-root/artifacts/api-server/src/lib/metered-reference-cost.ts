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

/**
 * Parses NUMERIC(12,2) values as integer cents.  Keeping costs in cents avoids
 * binary floating-point rounding when reception costs are averaged.
 */
function parsedPositiveCost(value: string | null): bigint | null {
  if (value === null) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return cents > 0n ? cents : null;
}

function formatCents(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/**
 * Rounds a positive integer-cent average to cents using conventional half-up
 * rounding: an exact half-cent rounds away from zero.
 */
function averageCentsHalfUp(total: bigint, count: number): bigint {
  const divisor = BigInt(count);
  const quotient = total / divisor;
  return total % divisor * 2n >= divisor ? quotient + 1n : quotient;
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
      (row): row is MeteredCostRow & { parsedCost: bigint } =>
        row.parsedCost !== null &&
        Number.isFinite(row.receptionDate.getTime()) &&
        row.receptionDate <= asOf,
    );
  const periodRows = validRows.filter((row) => row.receptionDate >= periodStart);

  if (periodRows.length > 0) {
    const average = averageCentsHalfUp(
      periodRows.reduce((total, row) => total + row.parsedCost, 0n),
      periodRows.length,
    );
    const latestReceptionDate = periodRows.reduce(
      (latest, row) => (row.receptionDate > latest ? row.receptionDate : latest),
      periodRows[0]!.receptionDate,
    );
    return {
      cost: formatCents(average),
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
      cost: formatCents(latestKnown.parsedCost),
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