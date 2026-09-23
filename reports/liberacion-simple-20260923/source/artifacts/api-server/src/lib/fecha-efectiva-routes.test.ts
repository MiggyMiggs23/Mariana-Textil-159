import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { pool } from "@workspace/db";
import clientesRouter from "../routes/clientes";
import { FECHA_EFECTIVA_ERROR_MESSAGE } from "./fecha-efectiva";

type RouteLayer = {
  route?: {
    path: string;
    methods: { post?: boolean };
    stack: Array<{ handle: RequestHandler }>;
  };
};

/**
 * Exercises the real JSON handlers over HTTP, not authentication.
 * No user/session is created. ALL database access is forbidden, including
 * reads, so a validation regression cannot reach a financial write.
 */
test("both payment handlers reject date-only/zoneless input over HTTP before any DB access", async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let databaseAttempts = 0;
  const prohibitDatabase = () => {
    databaseAttempts++;
    throw new Error("Database access is forbidden in this HTTP boundary test");
  };
  pool.query = prohibitDatabase as typeof pool.query;
  pool.connect = prohibitDatabase as typeof pool.connect;

  const app = express();
  app.use(express.json());
  const paths = [
    "/clientes/:id/pagos",
    "/clientes/:id/pagos/vista-previa",
  ];
  const layers = (clientesRouter as unknown as { stack: RouteLayer[] }).stack;
  for (const path of paths) {
    const route = layers.find(
      (layer) => layer.route?.path === path && layer.route.methods.post,
    )?.route;
    assert.ok(route, `The mounted POST route must exist: ${path}`);
    const handler = route.stack.at(-1)?.handle;
    assert.ok(handler, `The real route must have a handler: ${path}`);
    app.post(path, handler);
  }
  const onError: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ error: "Unexpected handler/database access" });
  };
  app.use(onError);

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const path of paths) {
      for (const fechaEfectiva of [
        "2026-09-15",
        "2026-09-15T12:00:00",
        "2026-02-30T12:00:00-06:00",
      ]) {
        const response = await fetch(`${base}${path.replace(":id", "6")}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            importe: 10,
            formaPago: "EFECTIVO",
            cuentaDestino: "CAJA_FISICA",
            fechaEfectiva,
          }),
        });
        assert.equal(response.status, 400, `${path}: ${fechaEfectiva}`);
        assert.deepEqual(await response.json(), {
          error: FECHA_EFECTIVA_ERROR_MESSAGE,
        });
      }
    }
    assert.equal(databaseAttempts, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await pool.end();
  }
});