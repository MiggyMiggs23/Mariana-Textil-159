/**
 * Contract-level regression coverage for the immediate Salidas API.  Database
 * integration scenarios live in lib/salidas.test.ts and are intentionally
 * guarded so an accidental local run cannot mutate a shared database.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../../..", import.meta.url);
const routeFile = new URL("artifacts/api-server/src/routes/salidas.ts", root);
const specFile = new URL("lib/api-spec/openapi.yaml", root);
const schemaUpgradeFile = new URL("lib/db/src/lib/salidas-schema.ts", root);

test("PROMPT 7 route contract exposes immediate creation, scan, export and cancellation only", async () => {
  const [route, spec] = await Promise.all([readFile(routeFile, "utf8"), readFile(specFile, "utf8")]);
  assert.match(route, /"\/salidas\/exportar"/);
  assert.match(route, /"\/salidas\/rollos\/serie\/:serie"/);
  assert.match(route, /requierePermiso\("salidas", "crear"\)/);
  assert.match(route, /El origen debe ser tu ubicación asignada/);
  assert.doesNotMatch(route, /"\/salidas\/:id\/(aceptar|rechazar|preparar|enviar|recibir|cerrar)"/);
  assert.doesNotMatch(route, /pendientes-count/);
  assert.match(spec, /\/salidas\/exportar:/);
  assert.match(spec, /\/salidas\/rollos\/serie\/\{serie\}:/);
  assert.doesNotMatch(spec, /operationId: (aceptarSalida|rechazarSalida|prepararSalida|enviarSalida|recibirSalida|cerrarSalida|getSalidasPendientesCount)/);
  for (const obsolete of ["SalidaLineaInput", "PrepararSalidaInput", "PrepararSalidaLineaInput", "EnviarSalidaInput", "RecibirSalidaInput", "RecibirSalidaRolloInput", "PendientesCount"]) {
    assert.doesNotMatch(spec, new RegExp(`^    ${obsolete}:`, "m"));
  }
  const exportContract = spec.slice(spec.indexOf("/salidas/exportar:"), spec.indexOf("/salidas/rollos/serie/"));
  for (const filter of ["fechaDesde", "fechaHasta", "origenId", "destinoId", "productoId", "usuarioId", "estado", "search"]) {
    assert.match(exportContract, new RegExp(`name: ${filter}`));
  }
});

test("fresh-schema DDL declares REGISTRADA before using it as the table default", async () => {
  const source = await readFile(schemaUpgradeFile, "utf8");
  const createType = source.indexOf("CREATE TYPE estado_salida AS ENUM");
  const registered = source.indexOf("'REGISTRADA'", createType);
  const tableDefault = source.indexOf("DEFAULT 'REGISTRADA'", createType);
  assert.ok(createType >= 0 && registered > createType && tableDefault > registered);
  assert.match(source, /ALTER TYPE estado_salida ADD VALUE IF NOT EXISTS 'REGISTRADA'/);
});

if (!process.env.TEST_DATABASE_URL) {
  test("DB API integration suite is guarded", { skip: "TEST_DATABASE_URL required" }, () => {});
}