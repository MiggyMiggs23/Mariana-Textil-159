/**
 * Optional private E10 browser-check server. This is not an application route
 * and never imports production authentication. It serves only the isolated
 * frontend build and actual Fondo router on 127.0.0.1:43110.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  E10_TARGET,
  assertE10DestinationBeforeConnect,
  connectExactE10,
} from "./e10-isolation-harness.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST = resolve(ROOT, "reports/e10-aislado-2026-09-18/aislamiento.json");
const ASSETS = resolve(ROOT, "artifacts/mariana-textil/dist/public");
const PORT = 43110;
const ACK = "E10_PRIVATE_LOOPBACK_PREVIEW";

async function main() {
  assert.deepEqual(process.argv.slice(2), ["--serve", "--ack", ACK],
    "Exact private-preview acknowledgement required.");
  const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
  assert.equal(manifest.status, "READY", "REFUSED BEFORE CONNECT: manifest is not READY");
  assert.equal(manifest.verification?.status, "PASS");
  assert.deepEqual(manifest.target, {
    socketDirectory: E10_TARGET.host,
    port: E10_TARGET.port,
    database: E10_TARGET.database,
    dataDirectory: E10_TARGET.dataDirectory,
    systemIdentifier: E10_TARGET.systemIdentifier,
    role: E10_TARGET.user,
    listenAddresses: "",
    backendNetworkAddress: null,
  });
  assertE10DestinationBeforeConnect({
    host: E10_TARGET.host, port: E10_TARGET.port, database: E10_TARGET.database, user: E10_TARGET.user,
  });
  assert.equal(await fs.realpath(ASSETS), ASSETS, "Preview asset directory redirected or absent");
  const index = await fs.readFile(resolve(ASSETS, "index.html"), "utf8");
  assert.match(index, /<script/i, "Isolated frontend build is absent");
  const assetNames = await fs.readdir(resolve(ASSETS, "assets"));
  const javascript = await Promise.all(assetNames.filter((name) => name.endsWith(".js"))
    .map((name) => fs.readFile(resolve(ASSETS, "assets", name), "utf8")));
  assert.ok(javascript.some((source) => source.includes("/api/fondo")),
    "Refused: frontend build does not contain the enabled E10 route/client");

  for (const key of ["DATABASE_URL", "APPLICATION_DATABASE_URL", "TEST_DATABASE_URL",
    "DATABASE_TEST_URL", "PGPASSWORD", "PGPASSFILE", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) {
    delete process.env[key];
  }
  process.env.NODE_ENV = "test";
  process.env.FONDO_E10_ENABLED = "true";
  const destination = {
    host: E10_TARGET.host, port: E10_TARGET.port, database: E10_TARGET.database, user: E10_TARGET.user,
  };
  const guardedPool: any = {
    connect: async () => {
      const client = await connectExactE10(destination);
      return Object.assign(client, { release: () => { void client.end(); } });
    },
    query: async (text: string, values?: readonly unknown[]) => {
      const client = await connectExactE10(destination);
      try { return await client.query(text, values as any[]); }
      finally { await client.end(); }
    },
  };
  const actorResult = await guardedPool.query(`SELECT id,nombre,usuario,rol::text rol,
    alcance_consulta::text alcance_consulta,activo,ultimo_acceso
    FROM usuarios WHERE activo IS TRUE AND rol::text='ADMIN' ORDER BY id LIMIT 1`);
  assert.equal(actorResult.rows.length, 1, "Existing ADMIN actor absent");
  const actor = actorResult.rows[0];

  // Only after manifest/destination/environment validation.
  const [{ createFondoRouter }, expressModule] = await Promise.all([
    import("../../artifacts/api-server/src/routes/fondo"),
    Promise.resolve(createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url))("express")),
  ]);
  const express: any = expressModule;
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((req: any, _res: any, next: any) => {
    req.auth = {
      sessionId: "e10-preview-in-process-context-not-a-session",
      user: {
        id: actor.id, nombre: actor.nombre, usuario: actor.usuario, rol: "ADMIN",
        ubicacionId: null, alcanceConsulta: actor.alcance_consulta, activo: actor.activo,
        ultimoAcceso: actor.ultimo_acceso, createdAt: new Date(0), passwordHash: "not-loaded",
      },
      location: null,
    };
    next();
  });
  app.get("/api/auth/me", (_req: any, res: any) => {
    res.json({
      id: actor.id,
      nombre: actor.nombre,
      usuario: actor.usuario,
      rol: "ADMIN",
      ubicacion: null,
      alcanceConsulta: actor.alcance_consulta,
      activo: actor.activo,
      ultimoAcceso: actor.ultimo_acceso,
      permisos: [],
    });
  });
  const admin = (req: any, res: any, next: any) => {
    if (req.auth?.user?.rol !== "ADMIN") {
      res.status(403).json({ error: "No tienes permisos para esta operación." });
      return;
    }
    next();
  };
  app.use("/api", createFondoRouter({ db: guardedPool, authorizeAdmin: [admin], enabled: () => true }));
  app.use(express.static(ASSETS, { index: false, fallthrough: true }));
  app.get("/{*path}", (_req: any, res: any) => res.sendFile(resolve(ASSETS, "index.html")));
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(error?.name === "ZodError" ? 400 : 500).json({
      error: error?.name === "ZodError" ? "Solicitud inválida." : "Error interno.",
      code: error?.name === "ZodError" ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
    });
  });
  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(JSON.stringify({
      status: "READY",
      url: `http://127.0.0.1:${PORT}/fondo`,
      port: PORT,
      assets: "artifacts/mariana-textil/dist/public",
      boundary: "harness-only in-process AuthContext; no login/session/user writes",
      stop: "SIGTERM or Ctrl-C immediately after the one browser check",
    }));
  });
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

await main();