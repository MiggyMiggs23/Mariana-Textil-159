import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
export { ensureTicketIvaSchema } from "./lib/ticket-iva-schema";
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
export { ensureProductPricingSchema } from "./lib/product-pricing-schema";
export { ensureAuditSchema } from "./lib/audit-schema";
export { ensureAplicacionesPagoProveedorSchema } from "./lib/aplicaciones-pago-proveedor-schema";

const { Pool } = pg;

const isAutomatedTestProcess = process.argv.some((argument) =>
  /\.test\.[cm]?[jt]s$/.test(argument),
);

if (isAutomatedTestProcess) {
  const testConnectionString = process.env.TEST_DATABASE_URL;
  if (!testConnectionString) {
    throw new Error(
      "TEST_DATABASE_URL must be set before running database tests. Refusing to use the application database.",
    );
  }
  if (testConnectionString === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must point to a database different from DATABASE_URL.",
    );
  }
  process.env.DATABASE_URL = testConnectionString;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
