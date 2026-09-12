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
  ensureStockMinimosSchema,
  ensureCamionetasSchema,
  ensureChoferesSchema,
  ensureViajesSchema,
  ensureAuditoriaInventarioSchema,
  ensurePisosSchema,
  ensureCuadreFiscalSchema,
  ensureCajaPermissions,
  ensureSalidasVentaPermissions,
  ensureEquiposSchema,
} from "@workspace/db";
import { logger } from "./lib/logger";
import { backfillCompras } from "./lib/compras-proveedor";
import {
  runStockMinimumPoller,
} from "./lib/stock-minimos";
import {
  installGracefulShutdown,
  observeBackgroundTask,
  withSchemaStartupLock,
} from "./lib/server-lifecycle";

function requireServerPort(): number {
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
  return port;
}

export async function ensureStartupSchemas(): Promise<void> {
  const startedAt = performance.now();
  const initializer = async <T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const initializerStartedAt = performance.now();
    try {
      const result = await operation();
      logger.info(
        { durationMs: Math.round(performance.now() - initializerStartedAt) },
        `Schema initializer complete: ${name}`,
      );
      return result;
    } catch (error) {
      throw new Error(`Schema initializer failed: ${name}`, { cause: error });
    }
  };
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
      await initializer("ensureAuditSchema", () => ensureAuditSchema(startupPool));
      await initializer("ensureNotificacionesSchema", () => ensureNotificacionesSchema(startupPool));
      await initializer("ensureStockMinimosSchema", () => ensureStockMinimosSchema(startupPool));
      await initializer("ensureCamionetasSchema", () => ensureCamionetasSchema(startupPool));
      await initializer("ensureChoferesSchema", () => ensureChoferesSchema(startupPool));
      await initializer("ensureViajesSchema", () => ensureViajesSchema(startupPool));
      await initializer("ensureEquiposSchema", () => ensureEquiposSchema(startupPool));
      await initializer("ensurePagosProveedorSchema", () => ensurePagosProveedorSchema(startupPool));
      await initializer("ensureSolicitudesPagoDirigidoSchema", () => ensureSolicitudesPagoDirigidoSchema(startupPool));
      await initializer("ensureAplicacionesPagoProveedorSchema", () => ensureAplicacionesPagoProveedorSchema(startupPool));
    });
    await phase("inventory and products", async () => {
      await initializer("ensureEstadoRolloSchema", () => ensureEstadoRolloSchema(startupPool));
      await initializer("ensureExtraordinaryExitsSchema", () => ensureExtraordinaryExitsSchema(startupPool));
      await initializer("ensureProductUnitSchema", () => ensureProductUnitSchema(startupPool));
      await initializer("ensureProductMeterSchema", () => ensureProductMeterSchema(startupPool));
      await initializer("ensureProductPricingSchema", () => ensureProductPricingSchema(startupPool));
      await initializer("ensureProductColorSchema", () => ensureProductColorSchema(startupPool));
      await initializer("ensureProductSpecificationsSchema", () => ensureProductSpecificationsSchema(startupPool));
    });
    await phase("roles and inventory audit", async () => {
      const migratedSupportUsers = await initializer("ensureSupervisorRole", () => ensureSupervisorRole(startupPool));
      await initializer("ensureAuditoriaInventarioSchema", () => ensureAuditoriaInventarioSchema(startupPool));
      await initializer("ensurePisosSchema", () => ensurePisosSchema(startupPool));
      logger.info({ migratedSupportUsers }, "Roles SUPERVISOR, SISTEMAS y CONTADOR verificados");
    });
    await phase("customers and tickets", async () => {
      await initializer("ensureClientesSchema", () => ensureClientesSchema(startupPool));
      await initializer("ensureTicketIvaSchema", () => ensureTicketIvaSchema(startupPool));
      await initializer("ensureCashSessionSchema", () => ensureCashSessionSchema(startupPool));
      await initializer("ensureTicketAuthorizationSchema", () => ensureTicketAuthorizationSchema(startupPool));
      await initializer("ensureTicketLineTypesSchema", () => ensureTicketLineTypesSchema(startupPool));
      await initializer("ensureSalidasSchema", () => ensureSalidasSchema(startupPool));
      await initializer("ensureDocumentFoliosSchema", () => ensureDocumentFoliosSchema(startupPool));
    });
    await phase("reporting and labels", async () => {
      await initializer("ensurePendingCostsSchema", () => ensurePendingCostsSchema(startupPool));
      await initializer("ensureAdminAnalyticsSchema", () => ensureAdminAnalyticsSchema(startupPool));
      await initializer("ensureCuadreFiscalSchema", () => ensureCuadreFiscalSchema(startupPool));
      await initializer("ensureEtiquetasSchema", () => ensureEtiquetasSchema(startupPool));
      // Run after module-specific migrations, some of which maintain legacy
      // defaults, so the strict inherited CAJA baseline is the final state.
      await initializer("ensureCajaPermissions", () => ensureCajaPermissions(startupPool));
      await initializer("ensureSalidasVentaPermissions", () => ensureSalidasVentaPermissions(startupPool));
    });
    logger.info({ durationMs: Math.round(performance.now() - startedAt) }, "Schema startup complete");
  });
}

export async function startServer() {
  await ensureStartupSchemas();
  const port = requireServerPort();
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
  const stockMinimumController = new AbortController();
  const stockMinimumPromise = observeBackgroundTask(
    runStockMinimumPoller({
      signal: stockMinimumController.signal,
      onError(error) {
        logger.error({ err: error }, "No se pudo evaluar stock mínimo");
      },
    }),
    {
      onFulfilled() {
        logger.info("Evaluador de stock mínimo detenido");
      },
      onRejected(err) {
        logger.error({ err }, "No se pudo iniciar el evaluador de stock mínimo");
      },
    },
  );
  const backgroundTasks = {
    promise: Promise.all([backfillPromise, stockMinimumPromise]).then(() => undefined),
    abort() {
      backfillController.abort();
      stockMinimumController.abort();
    },
  };
  installGracefulShutdown({
    app,
    server,
    pool,
    drain: requestDrain,
    backfill: backgroundTasks,
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
