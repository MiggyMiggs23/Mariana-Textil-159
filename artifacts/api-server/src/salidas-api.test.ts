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
const listPageFile = new URL("artifacts/mariana-textil/src/pages/salidas.tsx", root);
const detailPageFile = new URL("artifacts/mariana-textil/src/pages/salida-detail.tsx", root);
const createPageFile = new URL("artifacts/mariana-textil/src/pages/salida-nueva.tsx", root);

test("Block 2 contract exposes two-step creation and sending without legacy workflow", async () => {
  const [route, spec] = await Promise.all([readFile(routeFile, "utf8"), readFile(specFile, "utf8")]);
  assert.match(route, /"\/salidas\/exportar"/);
  assert.match(route, /"\/salidas\/rollos\/serie\/:serie"/);
  assert.match(route, /requierePermiso\("salidas", "crear"\)/);
  assert.match(route, /El origen debe ser tu ubicación asignada/);
  assert.doesNotMatch(route, /"\/salidas\/:id\/(aceptar|rechazar|preparar|cerrar)"/);
  assert.match(route, /"\/salidas\/:id\/enviar"/);
  assert.doesNotMatch(route, /pendientes-count/);
  assert.match(spec, /\/salidas\/exportar:/);
  assert.match(spec, /\/salidas\/rollos\/serie\/\{serie\}:/);
  assert.doesNotMatch(spec, /operationId: (aceptarSalida|rechazarSalida|prepararSalida|cerrarSalida|getSalidasPendientesCount)/);
  assert.match(spec, /operationId: enviarSalida/);
  assert.match(spec, /enum: \[ARMANDO, EN_TRANSITO, RECIBIDA, CANCELADA\]/);
  for (const obsolete of ["SalidaLineaInput", "PrepararSalidaInput", "PrepararSalidaLineaInput", "EnviarSalidaInput", "RecibirSalidaInput", "RecibirSalidaRolloInput", "PendientesCount"]) {
    assert.doesNotMatch(spec, new RegExp(`^    ${obsolete}:`, "m"));
  }
  const exportContract = spec.slice(spec.indexOf("/salidas/exportar:"), spec.indexOf("/salidas/rollos/serie/"));
  for (const filter of ["fechaDesde", "fechaHasta", "origenId", "destinoId", "productoId", "usuarioId", "estado", "search"]) {
    assert.match(exportContract, new RegExp(`name: ${filter}`));
  }
});

test("Block 3 reception is site-authoritative, one-step, audited, and QR-driven", async () => {
  const receptionPageFile = new URL("artifacts/mariana-textil/src/components/recepcion-salidas.tsx", root);
  const documentPageFile = new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root);
  const serviceFile = new URL("artifacts/api-server/src/lib/salidas.ts", root);
  const [route, spec, listPage, receptionPage, documentPage, service] = await Promise.all([
    readFile(routeFile, "utf8"),
    readFile(specFile, "utf8"),
    readFile(listPageFile, "utf8"),
    readFile(receptionPageFile, "utf8"),
    readFile(documentPageFile, "utf8"),
    readFile(serviceFile, "utf8"),
  ]);
  assert.match(spec, /operationId: listSalidasRecepcion/);
  assert.match(spec, /operationId: getSalidaRecepcion/);
  assert.match(spec, /operationId: recibirSalida/);
  assert.match(route, /auth\.user\.rol === "ADMIN" && auth\.user\.alcanceConsulta === "TODAS"/);
  assert.match(route, /Esta salida está destinada a otra ubicación/);
  assert.match(route, /estados: \["EN_TRANSITO"\]/);
  assert.match(service, /requireState\(salida, \["EN_TRANSITO"\], "recibir"\)/);
  assert.match(service, /accion: "RECIBIR"/);
  assert.match(service, /completa: input\.completa/);
  assert.match(service, /notificacionesSistemaTable/);
  assert.match(listPage, /TabsTrigger value="recepcion">Recepción/);
  assert.match(receptionPage, /CampoEscaneo/);
  assert.match(receptionPage, /¿Llegó completo\?/);
  assert.match(receptionPage, /Confirmar recepción de todos los rollos/);
  assert.match(documentPage, /QRCodeSVG/);
  assert.match(documentPage, /tab=recepcion&folio=/);
});

test("Block 2 frontend only presents the four states and explicit send action", async () => {
  const [listPage, detailPage, createPage] = await Promise.all([
    readFile(listPageFile, "utf8"),
    readFile(detailPageFile, "utf8"),
    readFile(createPageFile, "utf8"),
  ]);
  for (const source of [listPage, detailPage]) {
    assert.match(source, /ARMANDO/);
    assert.match(source, /EN_TRANSITO/);
    assert.doesNotMatch(source, /SOLICITADA|ACEPTADA|RECHAZADA|PREPARADA|ENVIADA|CERRADA/);
  }
  assert.match(detailPage, /useEnviarSalida/);
  assert.match(detailPage, /salida\.estado === 'ARMANDO'/);
  assert.match(createPage, /El inventario no se moverá hasta enviarla/);
});

test("schema migration replaces the PostgreSQL enum with the exact four states", async () => {
  const source = await readFile(schemaUpgradeFile, "utf8");
  const createType = source.indexOf("CREATE TYPE estado_salida AS ENUM");
  const arming = source.indexOf("'ARMANDO'", createType);
  const tableDefault = source.indexOf("DEFAULT 'ARMANDO'", createType);
  assert.ok(createType >= 0 && arming > createType && tableDefault > arming);
  assert.match(source, /ALTER COLUMN estado TYPE estado_salida_replacement/);
  assert.match(source, /'REGISTRADA', 'SOLICITADA', 'ACEPTADA', 'PREPARADA', 'ARMANDO'/);
});

if (!process.env.TEST_DATABASE_URL) {
  test("DB API integration suite is guarded", { skip: "TEST_DATABASE_URL required" }, () => {});
}