import app from "./app";
import {
  ensurePendingCostsSchema,
  ensureClientesSchema,
  ensureSalidasSchema,
  ensureTicketIvaSchema,
  ensureAdminAnalyticsSchema,
  ensureEtiquetasSchema,
  ensureSupervisorRole,
  ensureDocumentFoliosSchema,
  pool,
} from "@workspace/db";
import { logger } from "./lib/logger";
import { backfillCompras } from "./lib/compras-proveedor";

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

async function startServer() {
  await ensureSupervisorRole(pool);
  logger.info("Rol SUPERVISOR verificado");
  await ensureDocumentFoliosSchema(pool);
  logger.info("Iniciales de sitios verificadas");
  await ensureClientesSchema(pool);
  logger.info("Esquema de clientes verificado");
  await ensureTicketIvaSchema(pool);
  logger.info("Esquema de IVA de tickets verificado");
  await ensureSalidasSchema(pool);
  logger.info("Esquema de Salidas verificado");
  await ensurePendingCostsSchema(pool);
  await ensureAdminAnalyticsSchema(pool);
  await ensureEtiquetasSchema(pool);
  logger.info("Esquema de Etiquetas verificado");
  logger.info("Esquema de costos pendientes verificado");

  const server = app.listen(port);
  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
  server.on("listening", () => {
    logger.info({ port }, "Server listening");
  });
  void backfillCompras()
    .then((inserted) => {
      logger.info({ inserted }, "Backfill de compras por proveedor completado");
    })
    .catch((err: unknown) => {
      logger.error({ err }, "No se pudo completar el backfill de compras");
    });
}

void startServer().catch((err: unknown) => {
  logger.error({ err }, "No se pudieron verificar los esquemas de la aplicación");
  process.exit(1);
});
