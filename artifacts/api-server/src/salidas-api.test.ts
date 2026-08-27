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
const inventoryRouteFile = new URL("artifacts/api-server/src/routes/inventario.ts", root);
const serviceFile = new URL("artifacts/api-server/src/lib/salidas.ts", root);
const specFile = new URL("lib/api-spec/openapi.yaml", root);
const schemaUpgradeFile = new URL("lib/db/src/lib/salidas-schema.ts", root);
const listPageFile = new URL("artifacts/mariana-textil/src/pages/salidas.tsx", root);
const detailPageFile = new URL("artifacts/mariana-textil/src/pages/salida-detail.tsx", root);
const createPageFile = new URL("artifacts/mariana-textil/src/pages/salida-nueva.tsx", root);
const counterPageFile = new URL("artifacts/mariana-textil/src/components/salida-mostrador.tsx", root);
const salidaSchemaFile = new URL("lib/db/src/schema/salidas.ts", root);

test("Salida capture persists its draft roll-by-roll and finalizes in one action", async () => {
  const [route, spec] = await Promise.all([readFile(routeFile, "utf8"), readFile(specFile, "utf8")]);
  assert.match(route, /"\/salidas\/exportar"/);
  assert.match(route, /"\/salidas\/borrador"/);
  assert.match(route, /"\/salidas\/borrador\/rollos"/);
  assert.doesNotMatch(route, /router\.post\(\s*"\/salidas",/);
  assert.match(route, /"\/salidas\/:id\/rollos\/:rolloId"/);
  assert.match(route, /requierePermiso\("salidas", "crear"\)/);
  assert.match(route, /No puedes operar desde ese origen/);
  assert.doesNotMatch(route, /"\/salidas\/:id\/(aceptar|rechazar|preparar|cerrar)"/);
  assert.match(route, /"\/salidas\/:id\/enviar"/);
  assert.doesNotMatch(route, /pendientes-count/);
  assert.match(spec, /\/salidas\/exportar:/);
  assert.match(spec, /operationId: getBorradorSalida/);
  assert.match(spec, /operationId: agregarRolloBorradorSalida/);
  assert.doesNotMatch(spec, /operationId: crearSalida\s*$/m);
  assert.match(spec, /operationId: quitarRolloBorradorSalida/);
  assert.match(spec, /operationId: getDocumentoSalida/);
  assert.doesNotMatch(spec, /operationId: escanearRolloSalida/);
  assert.doesNotMatch(spec, /operationId: (aceptarSalida|rechazarSalida|prepararSalida|cerrarSalida|getSalidasPendientesCount)/);
  assert.match(spec, /operationId: enviarSalida/);
  assert.match(spec, /enum: \[ARMANDO, EN_TRANSITO, RECIBIDA, CANCELADA\]/);
  for (const obsolete of ["SalidaLineaInput", "PrepararSalidaInput", "PrepararSalidaLineaInput", "RecibirSalidaRolloInput", "PendientesCount"]) {
    assert.doesNotMatch(spec, new RegExp(`^    ${obsolete}:`, "m"));
  }
  const exportContract = spec.slice(spec.indexOf("/salidas/exportar:"), spec.indexOf("/salidas/ubicaciones:"));
  for (const filter of ["fechaDesde", "fechaHasta", "origenId", "destinoId", "productoId", "usuarioId", "estado", "search"]) {
    assert.match(exportContract, new RegExp(`name: ${filter}`));
  }
});

test("Block 3 reception is site-authoritative, one-step, audited, and QR-driven", async () => {
  const receptionPageFile = new URL("artifacts/mariana-textil/src/components/recepcion-salidas.tsx", root);
  const documentPageFile = new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root);
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
  assert.match(route, /"\/salidas\/recepcion\/:id"/);
  assert.match(route, /\.where\(eq\(salidasTable\.id, id\)\)/);
  assert.match(spec, /\/salidas\/recepcion\/\{id\}:/);
  assert.match(spec, /Obtiene por id interno una salida/);
  assert.match(documentPage, /QRCodeSVG/);
  assert.match(documentPage, /tab=recepcion&id=\$\{salida\.id\}/);
  assert.match(documentPage, /ESCANEAR PARA RECIBIR/);
  assert.match(receptionPage, /setSalidaId\(salida\.id\)/);
  assert.match(receptionPage, /salida\.folioFormateado/);
});

test("Block 1 counter exit is one-step, site-scoped, persisted and printable", async () => {
  const documentPageFile = new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root);
  const [route, inventoryRoute, service, spec, listPage, counterPage, documentPage, schema] =
    await Promise.all([
      readFile(routeFile, "utf8"),
      readFile(inventoryRouteFile, "utf8"),
      readFile(serviceFile, "utf8"),
      readFile(specFile, "utf8"),
      readFile(listPageFile, "utf8"),
      readFile(counterPageFile, "utf8"),
      readFile(documentPageFile, "utf8"),
      readFile(salidaSchemaFile, "utf8"),
    ]);
  assert.match(spec, /\/salidas\/mostrador:/);
  assert.match(spec, /operationId: crearSalidaMostrador/);
  assert.doesNotMatch(spec, /\/inventario\/rollos\/\{id\}\/salida-mostrador:/);
  assert.doesNotMatch(inventoryRoute, /"\/rollos\/:id\/salida-mostrador"/);
  assert.match(spec, /enum: \[TRASLADO, MOSTRADOR\]/);
  assert.match(route, /requierePermiso\("salidas", "crear"\)/);
  assert.match(route, /auth\.user\.rol === "ADMIN"/);
  assert.match(route, /auth\.user\.ubicacionId === body\.origenId/);
  assert.match(service, /modalidad: "MOSTRADOR"/);
  assert.match(service, /destinoId: null/);
  assert.match(service, /await salidaMostrador\(tx/);
  assert.match(service, /accion: "CREAR_MOSTRADOR"/);
  assert.match(service, /rolloIds: rollos\.map/);
  assert.match(schema, /"TRASLADO" \| "MOSTRADOR"/);
  assert.match(listPage, /TabsTrigger value="mostrador">A mostrador/);
  assert.match(counterPage, /<CampoEscaneo/);
  assert.match(counterPage, /useCrearSalidaMostrador/);
  assert.match(documentPage, /salida\.modalidad === "MOSTRADOR"/);
  assert.match(documentPage, /<QRCodeSVG/);
});

test("Frontend finalizes from Salida Nueva and detail has no second send action", async () => {
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
  assert.doesNotMatch(detailPage, /useEnviarSalida|Enviar salida|btn-action-send/);
  assert.match(detailPage, /salida\.estado === 'EN_TRANSITO' \|\| salida\.estado === 'RECIBIDA'/);
  assert.match(detailPage, /btn-print-salida-disabled/);
  assert.match(detailPage, /La hoja de traslado estará disponible cuando la mercancía esté en tránsito/);
  assert.match(createPage, /confirma la salida para enviarlos al destino/);
  assert.match(createPage, /useAgregarRolloBorradorSalida/);
  assert.match(createPage, /useQuitarRolloBorradorSalida/);
  assert.match(createPage, /useGetBorradorSalida/);
  assert.match(createPage, /Guardar y enviar/);
  assert.match(createPage, /setLocation\(`\/salidas\/\$\{data\.id\}`\)/);
  assert.doesNotMatch(createPage, /Ver detalle/);
  assert.match(createPage, /draftQuery\.isFetching/);
  assert.match(createPage, /queryClient\.cancelQueries/);
  assert.doesNotMatch(createPage, /Guardar armado/);
});

test("schema migration replaces the PostgreSQL enum with the exact four states", async () => {
  const source = await readFile(schemaUpgradeFile, "utf8");
  const createType = source.indexOf("CREATE TYPE estado_salida AS ENUM");
  const arming = source.indexOf("'ARMANDO'", createType);
  const tableDefault = source.indexOf("DEFAULT 'ARMANDO'", createType);
  assert.ok(createType >= 0 && arming > createType && tableDefault > arming);
  assert.match(source, /ALTER COLUMN estado TYPE estado_salida_replacement/);
  assert.match(source, /'REGISTRADA', 'SOLICITADA', 'ACEPTADA', 'PREPARADA', 'ARMANDO'/);
  assert.match(source, /actividad_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(source, /salidas_estado_actividad_idx/);
  assert.match(source, /salidas_borrador_usuario_origen_uidx/);
  const service = await readFile(serviceFile, "utf8");
  assert.match(service, /const SALIDA_DRAFT_VISIBILITY_WINDOW_HOURS = 24/);
  assert.match(service, /Borradores anteriores a esta ventana dejan de mostrarse por defecto/);
});

if (!process.env.TEST_DATABASE_URL) {
  test("DB API integration suite is guarded", { skip: "TEST_DATABASE_URL required" }, () => {});
}