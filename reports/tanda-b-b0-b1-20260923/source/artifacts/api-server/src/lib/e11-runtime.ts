import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { E11_ENABLED, E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED, E11_E5_PREPARATION_ENABLED } from "./e11-feature";
import { E5_ENABLED, E5_CONTADOR_A_ENABLED } from "./e5-feature";
import type { E5Sql } from "./e5-repository";
import type { CreditLedgerMovement } from "./credit-allocation";

export type E11RuntimeFlags = Readonly<{
  enabled: boolean; profiles: boolean; reconciliation: boolean; preparation: boolean;
  e5Enabled: boolean; e5ContadorA: boolean;
}>;
export type E11Transaction = <T>(work: (tx: E5Sql) => Promise<T>,
  options?: { isolationLevel: "serializable" }) => Promise<T>;
export type E11Runtime = Readonly<{
  flags: E11RuntimeFlags;
  now: () => Date;
  uuid: () => string;
  transaction: E11Transaction;
  ledger: (tx: E5Sql, clientId: number) => Promise<CreditLedgerMovement[]>;
}>;
export type E11RuntimeOptions = Partial<Omit<E11Runtime, "flags">> & { flags?: Partial<E11RuntimeFlags> };
const production: E11Runtime = Object.freeze({
  flags: Object.freeze({ enabled: E11_ENABLED, profiles: E11_PROFILE_ASSIGNMENT_ENABLED,
    reconciliation: E11_RECONCILIATION_ENABLED, preparation: E11_E5_PREPARATION_ENABLED,
    e5Enabled: E5_ENABLED, e5ContadorA: E5_CONTADOR_A_ENABLED }),
  now: () => new Date(), uuid: randomUUID,
  transaction: async <T>(work: (tx: E5Sql) => Promise<T>, options?: { isolationLevel: "serializable" }) => {
    const { db } = await import("@workspace/db");
    return db.transaction(tx => work(tx), options);
  },
  ledger: async (tx: E5Sql, clientId: number) => {
    const { loadCustomerCreditLedgerInTransaction } = await import("./credit-aging-read-model");
    return loadCustomerCreditLedgerInTransaction(clientId, tx);
  },
});
const context = new AsyncLocalStorage<E11Runtime>();
/** Internal only: no HTTP, environment or user override is mapped to this context. */
export const e11Runtime = (): E11Runtime => context.getStore() ?? production;
/** Isolated async scope, not a mutable process-wide gate or a replacement authorization policy. */
export function createE11Runtime(options: E11RuntimeOptions = {}) {
  const runtime: E11Runtime = Object.freeze({ ...production, ...options,
    flags: Object.freeze({ ...production.flags, ...options.flags }) });
  return Object.freeze({ run<T>(work: () => T): T { return context.run(runtime, work); } });
}