import app, { requestDrain } from "./app";
import {
  ensurePendingCostsSchema,
  ensureClientesSchema,
  ensureSalidasSchema,
  ensureTicketIvaSchema,
  ensureCashSessionSchema,
  ensureTicketLineTypesSchema,
  ensureAdminAnalyticsSchema,
  ensureEtiquetasSchema,
  ensureSupervisorRole,
  ensureDocumentFoliosSchema,
  ensureEstadoRolloSchema,
  ensureProductMeterSchema,
  ensureProductUnitSchema,
  ensureProductPricingSchema,
  ensureProductColorSchema,
  ensureProductSpecificationsSchema,
  pool,
  ensureAuditSchema,
  ensureAplicacionesPagoProveedorSchema,
  ensurePagosProveedorSchema,
  ensureSolicitudesPagoDirigidoSchema,
  ensureCamionetasSchema,
  ensureChoferesSchema,
  ensureViajesSchema,
  ensureAuditoriaInventarioSchema,
  ensurePisosSchema,
  ensureCuadreFiscalSchema,
} from "@workspace/db";
import { logger } from "./lib/logger";
import { backfillCompras } from "./lib/compras-proveedor";
import { installGracefulShutdown, withSchemaStartupLock } from "./lib/server-lifecycle";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

export async function ensureStartupSchemas(): Promise<void> {
  const startedAt = performance.now();
  // Session locks belong to a connection. Holding this client until every
  // migration finishes prevents two API instances from interleaving DDL.
  const phase = async (name: string, operation: () => Promise<unknown>) => {
    const phaseStartedAt = performance.now();
    await operation();
    logger.info({ durationMs: Math.round(performance.now() - phaseStartedAt) }, `Schema startup phase complete: ${name}`);
  };
  await withSchemaStartupLock(pool, async () => {
    await phase("audit and logistics", async () => {
      await ensureAuditSchema(pool); await ensureCamionetasSchema(pool); await ensureChoferesSchema(pool);
      await ensureViajesSchema(pool); await ensurePagosProveedorSchema(pool);
      await ensureSolicitudesPagoDirigidoSchema(pool); await ensureAplicacionesPagoProveedorSchema(pool);
    });
    await phase("inventory and products", async () => {
      await ensureEstadoRolloSchema(pool); await ensureProductUnitSchema(pool); await ensureProductMeterSchema(pool);
      await ensureProductPricingSchema(pool); await ensureProductColorSchema(pool); await ensureProductSpecificationsSchema(pool);
    });
    await phase("roles and inventory audit", async () => {
      const migratedSupportUsers = await ensureSupervisorRole(pool);
      await ensureAuditoriaInventarioSchema(pool); await ensurePisosSchema(pool);
      logger.info({ migratedSupportUsers }, "Roles SUPERVISOR, SISTEMAS y CONTADOR verificados");
    });
    await phase("customers and tickets", async () => {
      await ensureClientesSchema(pool); await ensureTicketIvaSchema(pool); await ensureCashSessionSchema(pool);
      await ensureTicketLineTypesSchema(pool); await ensureSalidasSchema(pool); await ensureDocumentFoliosSchema(pool);
    });
    await phase("reporting and labels", async () => {
      await ensurePendingCostsSchema(pool); await ensureAdminAnalyticsSchema(pool);
      await ensureCuadreFiscalSchema(pool); await ensureEtiquetasSchema(pool);
    });
    logger.info({ durationMs: Math.round(performance.now() - startedAt) }, "Schema startup complete");
  });
}

export async function startServer() {
  await ensureStartupSchemas();
  const server = app.listen(port);
  server.on("error", async (err) => {
    logger.error({ err }, "Error listening on port");
    await pool.end();
    process.exitCode = 1;
  });
  server.on("listening", () => {
    logger.info({ port }, "Server listening");
  });
  const backfillController = new AbortController();
  const backfillPromise = backfillCompras({ signal: backfillController.signal })
    .then((inserted) => {
      logger.info({ inserted }, "Backfill de compras por proveedor completado");
    })
    .catch((err: unknown) => {
      if ((err as { name?: string }).name === "AbortError") {
        logger.info("Backfill de compras cancelado durante el apagado");
      } else {
        logger.error({ err }, "No se pudo completar el backfill de compras");
      }
      throw err;
    });
  installGracefulShutdown({
    app,
    server,
    pool,
    drain: requestDrain,
    backfill: { promise: backfillPromise, abort: () => backfillController.abort() },
    logger,
  });
}

if (process.env["NODE_ENV"] !== "test") {
  void startServer().catch(async (err: unknown) => {
    logger.error({ err }, "No se pudieron verificar los esquemas de la aplicación");
    await pool.end();
    process.exitCode = 1;
  });
}
