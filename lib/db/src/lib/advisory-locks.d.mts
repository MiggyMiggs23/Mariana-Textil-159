export type AdvisoryLockNamespace =
  (typeof ADVISORY_LOCK_NAMESPACES)[keyof typeof ADVISORY_LOCK_NAMESPACES];

export declare const ADVISORY_LOCK_NAMESPACES: Readonly<{
  INVENTORY_PAIR: 650001;
  INVENTORY_ENTRY_IDEMPOTENCY: 650002;
  INVENTORY_AUDIT_SITE: 650003;
  POS_TICKET_IDEMPOTENCY: 650004;
  CASH_SESSION_SITE: 650005;
  CUSTOMER_CREDIT: 650006;
  SUPPLIER_LEDGER: 650007;
  OUTBOUND_DRAFT: 650008;
  OUTBOUND_IDEMPOTENCY: 650009;
  PRODUCT_CATALOG: 650010;
  PRODUCT_PRICING: 650011;
  ADMIN_RECOVERY: 650012;
  SCHEMA_ROLE: 650013;
  SCHEMA_CAMIONETAS: 650014;
  SCHEMA_CHOFERES: 650015;
  SCHEMA_VIAJES: 650016;
  SCHEMA_INVENTORY_AUDIT: 650017;
  SCHEMA_PISOS: 650018;
  SCHEMA_STARTUP: 650022;
  EXTRAORDINARY_EXIT_IDEMPOTENCY: 650023;
  SCHEMA_EQUIPOS: 650024;
  STOCK_MINIMUM: 650025;
  SCRIPT_PRODUCT_NORMALIZATION: 650019;
  SCRIPT_BAG_PRODUCTS: 650020;
  SCRIPT_OPERATIONAL_CLEANUP: 650021;
}>;

type DrizzleExecutor = { execute(query: unknown): Promise<unknown> };
type PgQueryConfig = {
  text: string;
  values: readonly unknown[];
  query_timeout: number;
};
type PgExecutor = {
  query(query: string | PgQueryConfig, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
type Executor = DrizzleExecutor | PgExecutor;

export declare function transactionAdvisoryLock(
  executor: Executor,
  namespace: AdvisoryLockNamespace,
  key?: number | string,
): Promise<void>;
export declare function sessionAdvisoryLock(
  executor: Executor,
  namespace: AdvisoryLockNamespace,
  key?: number | string,
  options?: { queryTimeoutMs?: number },
): Promise<void>;
export declare function trySessionAdvisoryLock(
  executor: Executor,
  namespace: AdvisoryLockNamespace,
  key?: number | string,
): Promise<boolean>;
export declare function releaseSessionAdvisoryLock(
  executor: Executor,
  namespace: AdvisoryLockNamespace,
  key?: number | string,
): Promise<boolean>;