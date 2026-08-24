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
});

if (!process.env.TEST_DATABASE_URL) {
  test("DB API integration suite is guarded", { skip: "TEST_DATABASE_URL required" }, () => {});
}