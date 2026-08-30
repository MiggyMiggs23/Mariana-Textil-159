import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { assertIsolatedTestDatabaseUrls } from "./lib/test-database-guard";
export { ensureTicketIvaSchema } from "./lib/ticket-iva-schema";
export { ensureCashSessionSchema } from "./lib/cash-session-schema";
export { ensureTicketLineTypesSchema } from "./lib/ticket-line-types-schema";
export { ensureSalidasSchema } from "./lib/salidas-schema";
export { ensurePendingCostsSchema } from "./lib/pending-costs-schema";
export { ensureClientesSchema } from "./lib/clientes-schema";
export { ensureAdminAnalyticsSchema } from "./lib/admin-analytics-schema";
export { ensureEtiquetasSchema } from "./lib/etiquetas-schema";
export { ensureSupervisorRole } from "./lib/role-migration";
export { ensureDocumentFoliosSchema } from "./lib/document-folios-schema";
export { ensureEstadoRolloSchema } from "./lib/estado-rollo-schema";
export { ensureProductMeterSchema } from "./lib/product-meter-schema";
export { ensureProductUnitSchema } from "./lib/product-unit-schema";
export { ensureProductPricingSchema } from "./lib/product-pricing-schema";
export { ensureProductColorSchema } from "./lib/product-color-schema";
export { ensureProductSpecificationsSchema } from "./lib/product-specifications-schema";
export { ensureAuditSchema } from "./lib/audit-schema";
export { ensureAplicacionesPagoProveedorSchema } from "./lib/aplicaciones-pago-proveedor-schema";
export { ensurePagosProveedorSchema } from "./lib/pagos-proveedor-schema";
export { ensureSolicitudesPagoDirigidoSchema } from "./lib/solicitudes-pago-dirigido-schema";
export { ensureCamionetasSchema } from "./lib/camionetas-schema";
export { ensureChoferesSchema } from "./lib/choferes-schema";
export { ensureViajesSchema } from "./lib/viajes-schema";
export { ensureAuditoriaInventarioSchema } from "./lib/auditoria-inventario-schema";
export { ensurePisosSchema } from "./lib/pisos-schema";
export { ensureCuadreFiscalSchema } from "./lib/cuadre-fiscal-schema";
export { createTestDatabaseGuard } from "./lib/test-database-guard";

const { Pool } = pg;

const isAutomatedTestProcess = process.argv.some((argument) =>
  /\.test\.[cm]?[jt]s$/.test(argument),
);

const requiresIsolatedTestDatabase =
  process.env.REQUIRE_ISOLATED_TEST_DATABASE === "1" ||
  Boolean(process.env.TEST_DATABASE_URL);
const isUnitTestProcess =
  process.env.NODE_ENV === "test" || isAutomatedTestProcess;
const disabledUnitTestDatabaseUrl =
  "postgresql://unit_test_disabled:unit_test_disabled@127.0.0.1:1/unit_test_database_access_is_disabled";

let connectionString = process.env.DATABASE_URL;

if (requiresIsolatedTestDatabase) {
  const testConnectionString = process.env.TEST_DATABASE_URL;
  const applicationConnectionString =
    process.env.APPLICATION_DATABASE_URL ?? process.env.DATABASE_URL;
  await assertIsolatedTestDatabaseUrls(
    testConnectionString,
    applicationConnectionString,
  );
  process.env.APPLICATION_DATABASE_URL = applicationConnectionString;
  process.env.DATABASE_URL = testConnectionString;
  connectionString = testConnectionString;
} else if (isUnitTestProcess) {
  // Pure unit suites may import modules that expose db helpers. Point them at
  // an unreachable local endpoint so an accidental query fails without ever
  // touching development.
  process.env.DATABASE_URL = disabledUnitTestDatabaseUrl;
  connectionString = disabledUnitTestDatabaseUrl;
}

if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

function integerEnv(
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

// Seven sites with roughly three simultaneous operators each imply 21 active
// requests. Thirty connections leave modest headroom for administrative work
// while remaining an explicit, bounded per-instance ceiling.
const poolMax = integerEnv("DB_POOL_MAX", 30, 1, 100);
const idleTimeoutMillis = integerEnv("DB_POOL_IDLE_TIMEOUT_MS", 30_000, 1_000, 300_000);
const connectionTimeoutMillis = integerEnv("DB_POOL_CONNECTION_TIMEOUT_MS", 5_000, 100, 60_000);
const statementTimeoutMillis = integerEnv("DB_STATEMENT_TIMEOUT_MS", 30_000, 1_000, 600_000);
const queryTimeoutMillis = integerEnv("DB_QUERY_TIMEOUT_MS", 35_000, 1_000, 600_000);

export const pool = new Pool({
  connectionString,
  max: poolMax,
  idleTimeoutMillis,
  connectionTimeoutMillis,
  statement_timeout: statementTimeoutMillis,
  query_timeout: queryTimeoutMillis,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
