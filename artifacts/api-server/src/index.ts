import app from "./app";
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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void backfillCompras()
    .then((inserted) => {
      logger.info({ inserted }, "Backfill de compras por proveedor completado");
    })
    .catch((err: unknown) => {
      logger.error({ err }, "No se pudo completar el backfill de compras");
    });
});
