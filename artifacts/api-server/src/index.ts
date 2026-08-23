import app from "./app";
import { ensureTicketIvaSchema, pool } from "@workspace/db";
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
  await ensureTicketIvaSchema(pool);
  logger.info("Esquema de IVA de tickets verificado");

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
  logger.error({ err }, "No se pudo verificar el esquema de IVA de tickets");
  process.exit(1);
});
