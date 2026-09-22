import { sql } from "drizzle-orm";
import type { FondoExecutor } from "./fondo";
import type { E12Executor } from "./e12-cash-ledger";
/** Uses the existing Drizzle transaction; parameters are never interpolated as SQL. */
export function e12FondoExecutor(tx: E12Executor): FondoExecutor {
  return { async query<T>(text: string, values: readonly unknown[] = []) {
    const parts = text.split(/(\$\d+)/g).filter(Boolean).map(part =>
      /^\$\d+$/.test(part) ? sql`${values[Number(part.slice(1)) - 1]}` : sql.raw(part));
    const result = await tx.execute(sql.join(parts, sql.raw("")));
    return { rows: result.rows as T[] };
  } };
}