// External fail-closed release preflight. Never imports the application.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
export const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
    : JSON.stringify(value) ?? "null";
export const hash = value => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");

export function connectionEnvironment(env) {
  if (env.API_INSPECTION_BOOT !== "1" || env.NODE_ENV !== "development"
    || (env.API_STARTUP_MODE && env.API_STARTUP_MODE !== "NORMAL")
    || env.API_LIMITED_STARTUP_APPROVAL) throw new Error("INSPECTION environment mismatch before database access.");
  if (env.TEST_DATABASE_URL || env.APPLICATION_DATABASE_URL || env.REQUIRE_ISOLATED_TEST_DATABASE === "1"
    || env.NODE_OPTIONS) throw new Error("Alternate runtime database/preload selectors forbidden.");
  for (const key of ["FONDO_E10_ENABLED", "CREDIT_REFUNDS_ENABLED", "CREDIT_CASH_INCOME_ENABLED",
    "CREDIT_ABONO_EVIDENCE_ENABLED", "CREDIT_PENDING_RECEIPTS_ENABLED", "CREDIT_HISTORICAL_ATTRIBUTION_ENABLED"]) {
    if (env[key] && !["0", "false"].includes(env[key])) throw new Error(`Closed feature environment mismatch: ${key}`);
  }
  if (!env.DATABASE_URL) throw new Error("Explicit runtime DATABASE_URL required.");
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL URL required.");
  // Use the SAME connection as the runtime; never inherit a different PG target.
  return {
    PATH: env.PATH ?? "", HOME: env.HOME ?? "", LANG: "C.UTF-8",
    PGHOST: url.searchParams.get("host") || url.hostname,
    PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGCONNECT_TIMEOUT: "5", PGAPPNAME: "e2-release-preflight",
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
    PGOPTIONS: "-c default_transaction_read_only=on",
  };
}

export function readCatalog(env) {
  const pgEnv = connectionEnvironment(env);
  const result = spawnSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    env: pgEnv, encoding: "utf8", input: readFileSync(path.join(directory, "release-catalog.sql"), "utf8"),
    maxBuffer: 16 * 1024 * 1024, timeout: 30000,
  });
  if (result.status !== 0) throw new Error(`Read-only catalog query failed (exit ${result.status}); connection details withheld.`);
  return JSON.parse(result.stdout.trim());
}

export function verifyCatalog(actual, expected, phase = "after") {
  for (const field of ["database", "databaseOid", "schema", "role", "serverVersionNum"]) {
    if (actual[field] !== expected.identity[field]) throw new Error(`Release identity mismatch: ${field}`);
  }
  if (actual.readOnly !== "on" || Number(actual.enabledEventTriggers) !== 0) throw new Error("Read-only/event-trigger guard mismatch.");
  if (!["before", "after"].includes(phase)) throw new Error("Unknown release phase.");
  const schemaSha256 = phase === "before" ? expected.baseSchemaSha256 : expected.schemaSha256;
  const attributesSha256 = phase === "before" ? expected.baseAttributesSha256 : expected.attributesSha256;
  if (hash(actual.schemaRows) !== schemaSha256) throw new Error("Complete release catalog mismatch.");
  if (hash(actual.attributes) !== attributesSha256) throw new Error("Release attributes/privileges/enum mismatch.");
  return { database: actual.database, databaseOid: actual.databaseOid, rows: actual.schemaRows.length,
    schemaSha256, attributesSha256, phase, mode: "INSPECTION", capture: false, refund: false };
}

export function main() {
  const expected = JSON.parse(readFileSync(path.join(directory, "release-expected.json"), "utf8"));
  if (process.argv.slice(2).some(arg => arg !== "--before")) throw new Error("Unknown preflight argument.");
  const result = verifyCatalog(readCatalog(process.env), expected, process.argv.includes("--before") ? "before" : "after");
  console.log(`E2_COMPLETE_RELEASE_PREFLIGHT=PASS ${JSON.stringify(result)}`);
}
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) { console.error(`E2_RELEASE_PREFLIGHT=FAIL ${error.message}`); process.exitCode = 1; }
}