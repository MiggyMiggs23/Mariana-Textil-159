import { sql } from "drizzle-orm";

/**
 * PostgreSQL advisory-lock key spaces. Every independently serialized domain
 * owns one unique signed int32 namespace; business identifiers are always the
 * second key (or are hashed with the namespace as the seed).
 */
export const ADVISORY_LOCK_NAMESPACES = Object.freeze({
  INVENTORY_PAIR: 650001,
  INVENTORY_ENTRY_IDEMPOTENCY: 650002,
  INVENTORY_AUDIT_SITE: 650003,
  POS_TICKET_IDEMPOTENCY: 650004,
  CASH_SESSION_SITE: 650005,
  CUSTOMER_CREDIT: 650006,
  SUPPLIER_LEDGER: 650007,
  OUTBOUND_DRAFT: 650008,
  OUTBOUND_IDEMPOTENCY: 650009,
  PRODUCT_CATALOG: 650010,
  PRODUCT_PRICING: 650011,
  ADMIN_RECOVERY: 650012,
  SCHEMA_ROLE: 650013,
  SCHEMA_CAMIONETAS: 650014,
  SCHEMA_CHOFERES: 650015,
  SCHEMA_VIAJES: 650016,
  SCHEMA_INVENTORY_AUDIT: 650017,
  SCHEMA_PISOS: 650018,
  SCHEMA_STARTUP: 650022,
  EXTRAORDINARY_EXIT_IDEMPOTENCY: 650023,
  SCHEMA_EQUIPOS: 650024,
  SCRIPT_PRODUCT_NORMALIZATION: 650019,
  SCRIPT_BAG_PRODUCTS: 650020,
  SCRIPT_OPERATIONAL_CLEANUP: 650021,
});

function assertNamespace(namespace) {
  if (
    !Number.isInteger(namespace) ||
    namespace < -2147483648 ||
    namespace > 2147483647 ||
    !Object.values(ADVISORY_LOCK_NAMESPACES).includes(namespace)
  ) {
    throw new TypeError("Unknown advisory-lock namespace.");
  }
}

function assertNumericKey(key) {
  if (!Number.isInteger(key) || key < -2147483648 || key > 2147483647) {
    throw new TypeError("Advisory-lock numeric keys must be signed int32 values.");
  }
}

function validate(kind, namespace, key) {
  assertNamespace(namespace);
  if (typeof key === "number") assertNumericKey(key);
  else if (typeof key !== "string") {
    throw new TypeError("Advisory-lock keys must be numbers or strings.");
  }
  return kind;
}

async function run(executor, kind, namespace, key, options) {
  validate(kind, namespace, key);
  if ("execute" in executor && typeof executor.execute === "function") {
    return executor.execute(
      typeof key === "number"
        ? sql`SELECT ${sql.raw(kind)}(${namespace}, ${key})`
        : sql`SELECT ${sql.raw(kind)}(hashtextextended(${key}, ${namespace}))`,
    );
  }
  const text =
    typeof key === "number"
      ? `SELECT ${kind}($1::int, $2::int)`
      : `SELECT ${kind}(hashtextextended($2::text, $1::int))`;
  const values = [namespace, key];
  return options?.queryTimeoutMs === undefined
    ? executor.query(text, values)
    : executor.query({
        text,
        values,
        query_timeout: options.queryTimeoutMs,
      });
}

/**
 * Acquire a transaction-scoped lock. Numeric keys use PostgreSQL's two-int32
 * form; text/composite keys use its one-int64 form with the namespace as hash
 * seed.
 */
export async function transactionAdvisoryLock(executor, namespace, key = 0) {
  await run(executor, "pg_advisory_xact_lock", namespace, key);
}

/** Session-scoped counterpart supporting namespaced numeric and text keys. */
export async function sessionAdvisoryLock(
  executor,
  namespace,
  key = 0,
  options,
) {
  await run(executor, "pg_advisory_lock", namespace, key, options);
}

/** Attempt a session-scoped lock without waiting. */
export async function trySessionAdvisoryLock(executor, namespace, key = 0) {
  const result = await run(executor, "pg_try_advisory_lock", namespace, key);
  const row = result.rows?.[0];
  return Boolean(row && Object.values(row)[0]);
}

/** Release a session-scoped advisory lock held by this connection. */
export async function releaseSessionAdvisoryLock(executor, namespace, key = 0) {
  const result = await run(executor, "pg_advisory_unlock", namespace, key);
  const row = result.rows?.[0];
  return Boolean(row && Object.values(row)[0]);
}