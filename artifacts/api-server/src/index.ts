import app, { requestDrain } from "./app";
import {
  ensurePendingCostsSchema,
  ensureClientesSchema,
  ensureSalidasSchema,
  ensureTicketIvaSchema,
  ensureCashSessionSchema,
  ensureTicketAuthorizationSchema,
  ensureTicketLineTypesSchema,
  ensureAdminAnalyticsSchema,
  ensureEtiquetasSchema,
  ensureSupervisorRole,
  ensureDocumentFoliosSchema,
  ensureEstadoRolloSchema,
  ensureExtraordinaryExitsSchema,
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
  ensureNotificacionesSchema,
  ensureCamionetasSchema,
  ensureChoferesSchema,
  ensureViajesSchema,
  ensureAuditoriaInventarioSchema,
  ensurePisosSchema,
  ensureCuadreFiscalSchema,
  ensureCajaPermissions,
  ensureSalidasVentaPermissions,
} from "@workspace/db";
import { logger } from "./lib/logger";
import { backfillCompras } from "./lib/compras-proveedor";
import {
  installGracefulShutdown,
  observeBackgroundTask,
  withSchemaStartupLock,
} from "./lib/server-lifecycle";

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
  await withSchemaStartupLock(pool, async (executor) => {
    const startupPool = executor as unknown as typeof pool;
    await phase("audit and logistics", async () => {
      await ensureAuditSchema(startupPool); await ensureNotificacionesSchema(startupPool); await ensureCamionetasSchema(startupPool); await ensureChoferesSchema(startupPool);
      await ensureViajesSchema(startupPool); await ensurePagosProveedorSchema(startupPool);
      await ensureSolicitudesPagoDirigidoSchema(startupPool); await ensureAplicacionesPagoProveedorSchema(startupPool);
    });
    await phase("inventory and products", async () => {
      await ensureEstadoRolloSchema(startupPool); await ensureExtraordinaryExitsSchema(startupPool); await ensureProductUnitSchema(startupPool); await ensureProductMeterSchema(startupPool);
      await ensureProductPricingSchema(startupPool); await ensureProductColorSchema(startupPool); await ensureProductSpecificationsSchema(startupPool);
    });
    await phase("roles and inventory audit", async () => {
      const migratedSupportUsers = await ensureSupervisorRole(startupPool);
      await ensureAuditoriaInventarioSchema(startupPool); await ensurePisosSchema(startupPool);
      logger.info({ migratedSupportUsers }, "Roles SUPERVISOR, SISTEMAS y CONTADOR verificados");
    });
    await phase("customers and tickets", async () => {
      await ensureClientesSchema(startupPool); await ensureTicketIvaSchema(startupPool); await ensureCashSessionSchema(startupPool); await ensureTicketAuthorizationSchema(startupPool);
      await ensureTicketLineTypesSchema(startupPool); await ensureSalidasSchema(startupPool); await ensureDocumentFoliosSchema(startupPool);
    });
    await phase("reporting and labels", async () => {
      await ensurePendingCostsSchema(startupPool); await ensureAdminAnalyticsSchema(startupPool);
      await ensureCuadreFiscalSchema(startupPool); await ensureEtiquetasSchema(startupPool);
      // Run after module-specific migrations, some of which maintain legacy
      // defaults, so the strict inherited CAJA baseline is the final state.
      await ensureCajaPermissions(startupPool);
      await ensureSalidasVentaPermissions(startupPool);
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
  const backfillPromise = observeBackgroundTask(
    backfillCompras({ signal: backfillController.signal }),
    {
      onFulfilled(inserted) {
      logger.info({ inserted }, "Backfill de compras por proveedor completado");
      },
      onRejected(err) {
        if ((err as { name?: string }).name === "AbortError") {
          logger.info("Backfill de compras cancelado durante el apagado");
        } else {
          logger.error({ err }, "No se pudo completar el backfill de compras");
        }
      },
    },
  );
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
