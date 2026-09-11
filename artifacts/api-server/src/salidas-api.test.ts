/**
 * Contract-level regression coverage for the immediate Salidas API.  Database
 * integration scenarios live in lib/salidas.test.ts and are intentionally
 * guarded so an accidental local run cannot mutate a shared database.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import type { AuthContext } from "./middlewares/auth";
import {
  canAccessSalidaStage,
  canOperate,
  canRead,
  resolvePendingVentaClienteOriginId,
} from "./routes/salidas";

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

function auth(
  overrides: Partial<AuthContext["user"]> = {},
): AuthContext {
  return {
    sessionId: "contract-test",
    location: null,
    user: {
      id: 1,
      nombre: "Contract test",
      usuario: "contract-test",
      passwordHash: "",
      rol: "BODEGA",
      ubicacionId: 7,
      activo: true,
      alcanceConsulta: "PROPIA",
      ultimoAcceso: null,
      createdAt: new Date(0),
      ...overrides,
    },
  };
}

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
  assert.match(spec, /enum: \[ARMANDO, EN_TRANSITO, RECIBIDA, ENTREGADA, CANCELADA\]/);
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
  assert.match(documentPage, /<PrintableDocumentHeader[\s\S]*qrUrl=\{qrUrl\}/);
  assert.match(documentPage, /tab=recepcion&id=\$\{salida\.id\}/);
  assert.match(documentPage, /qrLabel=\{`QR para abrir salida/);
  assert.match(receptionPage, /setSalidaId\(salida\.id\)/);
  assert.match(receptionPage, /salida\.folioFormateado/);
});

test("Salida document exposes full location names without a separate initials field", async () => {
  const [service, spec] = await Promise.all([
    readFile(serviceFile, "utf8"),
    readFile(specFile, "utf8"),
  ]);
  const salidaContract = spec.slice(
    spec.indexOf("    SalidaResumen:"),
    spec.indexOf("    SalidaListResult:"),
  );

  assert.match(salidaContract, /nombreOrigen/);
  assert.match(salidaContract, /nombreDestino/);
  assert.doesNotMatch(salidaContract, /inicialesSitio/);
  assert.doesNotMatch(service, /inicialesSitio:/);
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
  assert.match(spec, /enum: \[TRASLADO, MOSTRADOR, VENTA_CLIENTE\]/);
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
  assert.match(documentPage, /salida\.lineas\.slice/);
  assert.match(documentPage, /formatNumber\(line\.rollosEnviados/);
  assert.match(documentPage, /formatNumber\(line\.cantidadEnviada/);
  assert.doesNotMatch(documentPage, /No\. de<br\/>Serie|\{rollo\.serie\}/);
  assert.match(documentPage, /<PrintableDocumentHeader[\s\S]*qrUrl=\{qrUrl\}/);
});

test("Frontend finalizes from Salida Nueva and detail has no second send action", async () => {
  const [listPage, detailPage, createPage, statusPresentation, route] = await Promise.all([
    readFile(listPageFile, "utf8"),
    readFile(detailPageFile, "utf8"),
    readFile(createPageFile, "utf8"),
     readFile(new URL("../../../lib/api-zod/src/salida-estado-presentation.ts", import.meta.url), "utf8"),
    readFile(routeFile, "utf8"),
  ]);
  assert.match(listPage, /<SalidaEstadoBadge estado=\{salida\.estado\}/);
   assert.match(statusPresentation, /ARMANDO:\s*"Armando"/);
   assert.match(statusPresentation, /EN_TRANSITO:\s*"En tránsito"/);
  assert.match(route, /getSalidaEstadoPresentation\(\{[\s\S]*documentoVenta: item\.documentoVenta[\s\S]*autorizada: item\.autorizada/);
  assert.match(detailPage, /ARMANDO/);
  assert.match(detailPage, /EN_TRANSITO/);
  for (const source of [listPage, detailPage, statusPresentation]) {
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

test("Pending-sale generation requires an explicit authorized store and preserves business error codes", async () => {
  const pendingSalePageFile = new URL(
    "artifacts/mariana-textil/src/components/salidas-pendientes-cobro.tsx",
    root,
  );
  const [route, spec, pendingSalePage] = await Promise.all([
    readFile(routeFile, "utf8"),
    readFile(specFile, "utf8"),
    readFile(pendingSalePageFile, "utf8"),
  ]);
  const endpoint = route.slice(
    route.indexOf('router.post("/salidas/venta-cliente/generar-venta"'),
    route.indexOf('router.get("/salidas/ubicaciones"', route.indexOf('router.post("/salidas/venta-cliente/generar-venta"')),
  );
  const input = spec.slice(
    spec.indexOf("    GenerarVentaDesdeSalidasCommonInput:"),
    spec.indexOf("    GenerarVentaDesdeSalidasTicketInput:"),
  );

  assert.match(input, /required: \[uuidCliente, ubicacionId, clienteId, salidaIds, precios\]/);
  assert.match(endpoint, /SALE_LOCATION_REQUIRED/);
  assert.match(endpoint, /canOperate\(req\.auth!, body\.ubicacionId\)/);
  assert.match(endpoint, /saleLocation\.tipo !== "TIENDA"/);
  assert.match(endpoint, /ubicacionId: body\.ubicacionId/);
  assert.doesNotMatch(endpoint, /ubicacionId: req\.auth!\.user\.ubicacionId!/);
  assert.match(route, /error instanceof PosError/);
  assert.match(route, /res\.status\(error\.status\)\.json\(\{ error: error\.message, code: error\.code \}\)/);
  assert.match(route, /"SALIDA_SELECTION_CHANGED"/);
  assert.match(route, /"ROLLO_BLOQUEADO"/);
  assert.match(pendingSalePage, /location\.activa && location\.tipo === "TIENDA"/);
  assert.match(pendingSalePage, /ubicacionId: saleLocationId/);
  assert.match(pendingSalePage, /saleLocationId === null/);
});

test("pending-sale reads scope the actual query to an assigned origin and fail closed", async () => {
  const route = await readFile(routeFile, "utf8");
  const endpointStart = route.indexOf(
    'router.get("/salidas/venta-cliente/pendientes"',
  );
  const endpointEnd = route.indexOf(
    'router.post("/salidas/venta-cliente/generar-venta"',
    endpointStart,
  );
  const endpoint = route.slice(endpointStart, endpointEnd);

  assert.equal(
    resolvePendingVentaClienteOriginId(auth({ ubicacionId: 7 })),
    7,
  );
  assert.throws(
    () =>
      resolvePendingVentaClienteOriginId(
        auth({ ubicacionId: null, alcanceConsulta: "PROPIA" }),
      ),
    /ubicación asignada/,
  );
  assert.equal(
    resolvePendingVentaClienteOriginId(
      auth({ rol: "ADMIN", ubicacionId: null }),
    ),
    undefined,
  );
  assert.equal(
    resolvePendingVentaClienteOriginId(
      auth({ rol: "ADMIN", ubicacionId: 7, alcanceConsulta: "TODAS" }),
    ),
    undefined,
  );
  assert.equal(
    resolvePendingVentaClienteOriginId(
      auth({ ubicacionId: null, alcanceConsulta: "TODAS" }),
    ),
    undefined,
  );
  assert.equal(
    resolvePendingVentaClienteOriginId(
      auth({ rol: "CAJA", ubicacionId: 7, alcanceConsulta: "TODAS" }),
    ),
    7,
  );
  assert.throws(
    () =>
      resolvePendingVentaClienteOriginId(
        auth({ rol: "CAJA", ubicacionId: null, alcanceConsulta: "TODAS" }),
      ),
    /ubicación asignada/,
  );

  assert.match(
    endpoint,
    /requireSession,\s*requierePermiso\("salidas_venta", "ver"\)/,
  );
  assert.match(
    endpoint,
    /resolvePendingVentaClienteOriginId\(req\.auth!\)/,
  );
  assert.match(endpoint, /eq\(salidasTable\.origenId, visibleOriginId\)/);
  assert.match(endpoint, /\.where\(and\(\.\.\.pendingConditions\)\)/);
});

test("supervisors operate only on their own origin or destination while read scope stays unchanged", () => {
  const supervisor = auth({ rol: "SUPERVISOR", ubicacionId: 7 });
  const salida = { origenId: 7, destinoId: 11 };
  const originOtherSite = { origenId: 9, destinoId: 11 };
  const destinationOtherSite = { origenId: 9, destinoId: 12 };

  assert.equal(canOperate(supervisor, 7), true);
  assert.equal(canOperate(supervisor, 9), false);
  assert.equal(canAccessSalidaStage(supervisor, salida, "origin"), true);
  assert.equal(
    canAccessSalidaStage(supervisor, destinationOtherSite, "origin"),
    false,
  );
  assert.equal(
    canAccessSalidaStage(
      supervisor,
      { origenId: 9, destinoId: 7 },
      "destination",
    ),
    true,
  );
  assert.equal(
    canAccessSalidaStage(supervisor, destinationOtherSite, "destination"),
    false,
  );
  assert.equal(
    canAccessSalidaStage(supervisor, originOtherSite, "either"),
    false,
  );
  assert.equal(
    canAccessSalidaStage(supervisor, { origenId: 9, destinoId: 7 }, "either"),
    true,
  );
  assert.equal(
    canAccessSalidaStage(
      auth({ rol: "SUPERVISOR", ubicacionId: null }),
      { origenId: 9, destinoId: null },
      "either",
    ),
    false,
  );

  // Keep the existing document-read policy distinct from operational scope.
  assert.equal(canRead(supervisor, 99, null), true);
  assert.equal(canRead(auth({ ubicacionId: 7 }), 7, 99), true);
  assert.equal(canRead(auth({ ubicacionId: 7 }), 99, 11), false);
});

test("ADMIN retains origin, destination and either-stage access", () => {
  const admin = auth({
    rol: "ADMIN",
    ubicacionId: null,
    alcanceConsulta: "TODAS",
  });
  const salida = { origenId: 7, destinoId: 11 };

  for (const stage of ["origin", "destination", "either"] as const) {
    assert.equal(canAccessSalidaStage(admin, salida, stage), true, stage);
  }
  assert.equal(
    canAccessSalidaStage(admin, { origenId: 7, destinoId: null }, "either"),
    true,
  );
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