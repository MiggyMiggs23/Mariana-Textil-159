import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import {
  db,
  ensureSalidasSchema,
  existenciasTable,
  movimientosTable,
  pool,
  productosTable,
  rollosTable,
  salidaLineasTable,
  salidaRollosTable,
  salidasTable,
  sesionesTable,
  ubicacionesTable,
  usuariosTable,
  type RolUsuario,
} from "@workspace/db";
import app from "./app";
import { crearRollo } from "./lib/inventario";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error("Las pruebas HTTP de Salidas solo pueden usar TEST_DATABASE_URL.");
}

const run = `SALAPI-${Date.now()}`;
const userIds: number[] = [];
const sessionIds: string[] = [];
const locationIds: number[] = [];
const productIds: number[] = [];
const rollIds: number[] = [];
const salidaIds: number[] = [];

let server: Server;
let baseUrl = "";
let originId = 0;
let destinationId = 0;
let otherId = 0;
let productId = 0;
let firstRolloId = 0;
let secondRolloId = 0;

const cookies = new Map<string, string>();

async function createUser(role: RolUsuario, ubicacionId: number | null) {
  const [user] = await db
    .insert(usuariosTable)
    .values({
      nombre: `${role} ${run}`,
      usuario: `${role.toLowerCase()}-${ubicacionId ?? "global"}-${run}`,
      passwordHash: "not-used-in-session-tests",
      rol: role,
      ubicacionId,
      alcanceConsulta: role === "ADMIN" ? "TODAS" : "PROPIA",
      activo: true,
    })
    .returning();
  assert.ok(user);
  userIds.push(user.id);
  const sessionId = randomUUID();
  await db.insert(sesionesTable).values({
    id: sessionId,
    usuarioId: user.id,
    expiraAt: new Date(Date.now() + 60 * 60 * 1000),
    ip: "127.0.0.1",
    userAgent: "salidas-api-test",
  });
  sessionIds.push(sessionId);
  cookies.set(role + String(ubicacionId), `mariana_session=${sessionId}`);
  return user;
}

async function api(
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function createBody(uuidCliente: string) {
  return {
    uuidCliente,
    origenId: originId,
    destinoId: destinationId,
    notaSolicitud: null,
    lineas: [
      {
        productoId: productId,
        cantidadSolicitada: "15",
        rollosSolicitados: 1,
        nota: null,
      },
    ],
  };
}

before(async () => {
  await ensureSalidasSchema(pool);
  await pool.query(`
    UPDATE permisos_rol
    SET puede_autorizar = false
    WHERE rol = 'INVENTARIOS' AND modulo = 'salidas'
  `);
  const locations = await db
    .insert(ubicacionesTable)
    .values([
      { nombre: `Origen ${run}`, tipo: "BODEGA" },
      { nombre: `Destino ${run}`, tipo: "TIENDA" },
      { nombre: `Otra ${run}`, tipo: "TIENDA" },
    ])
    .returning();
  [originId, destinationId, otherId] = locations.map((location) => location.id);
  locationIds.push(...locations.map((location) => location.id));

  const [product] = await db
    .insert(productosTable)
    .values({
      sku: run,
      tela: `Tela ${run}`,
      color: "Negro",
      unidad: "METRO",
      precioSugerido: "100.00",
    })
    .returning();
  assert.ok(product);
  productId = product.id;
  productIds.push(product.id);

  const admin = await createUser("ADMIN", null);
  await createUser("CAJA", null);
  const terminal = await createUser("TERMINAL", destinationId);
  const inventories = await createUser("INVENTARIOS", destinationId);
  const warehouse = await createUser("BODEGA", originId);
  await createUser("BODEGA", destinationId);
  await createUser("BODEGA", otherId);
  assert.ok(admin && terminal && inventories && warehouse);

  for (const quantity of ["15", "15"]) {
    const result = await db.transaction((tx) =>
      crearRollo(tx, {
        productoId: productId,
        ubicacionId: originId,
        cantidadInicial: quantity,
        costoUnitario: "25.00",
        usuarioId: admin.id,
        estado: "DISPONIBLE",
      }),
    );
    rollIds.push(result.rollo.id);
  }
  [firstRolloId, secondRolloId] = rollIds;

  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el servidor HTTP de prueba."));
        return;
      }
      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
    server.on("error", reject);
  });
});

test("aplica permisos de Salidas por rol, ubicación y etapa", async () => {
  const terminalCookie = cookies.get(`TERMINAL${destinationId}`)!;
  const destinationCookie = cookies.get(`INVENTARIOS${destinationId}`)!;
  const destinationWarehouseCookie = cookies.get(`BODEGA${destinationId}`)!;
  const originCookie = cookies.get(`BODEGA${originId}`)!;
  const otherCookie = cookies.get(`BODEGA${otherId}`)!;
  const adminCookie = cookies.get("ADMINnull")!;
  const unassignedCookie = cookies.get("CAJAnull")!;

  const deniedPendingCount = await api("GET", "/salidas/pendientes-count", unassignedCookie);
  assert.equal(deniedPendingCount.status, 403);

  const deniedCreate = await api("POST", "/salidas", terminalCookie, createBody(randomUUID()));
  assert.equal(deniedCreate.status, 403);

  const salidasLocations = await api("GET", "/locations", destinationCookie);
  assert.equal(salidasLocations.status, 200, JSON.stringify(salidasLocations.body));
  assert.ok(
    salidasLocations.body.some((location: { id: number }) => location.id === originId),
    "Un usuario de Salidas debe poder consultar ubicaciones de origen.",
  );
  assert.ok(
    salidasLocations.body.some((location: { id: number }) => location.id === destinationId),
    "Un usuario de Salidas debe poder consultar su ubicación destino.",
  );

  const created = await api("POST", "/salidas", destinationCookie, {
    ...createBody(randomUUID()),
    destinoId: otherId,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.destinoId, destinationId, "El destino no ADMIN debe forzarse a su ubicación.");
  salidaIds.push(created.body.id);

  const deniedAccept = await api(
    "POST",
    `/salidas/${created.body.id}/aceptar`,
    destinationCookie,
    {},
  );
  assert.equal(deniedAccept.status, 403);

  const accepted = await api("POST", `/salidas/${created.body.id}/aceptar`, originCookie, {});
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

  const deniedPrepare = await api(
    "POST",
    `/salidas/${created.body.id}/preparar`,
    destinationCookie,
    { lineas: [{ lineaId: accepted.body.lineas[0].id, rolloIds: [firstRolloId] }] },
  );
  assert.equal(deniedPrepare.status, 403);

  const prepared = await api("POST", `/salidas/${created.body.id}/preparar`, originCookie, {
    lineas: [{ lineaId: accepted.body.lineas[0].id, rolloIds: [firstRolloId] }],
  });
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));

  const retiredMove = await api(
    "POST",
    `/inventario/rollos/${firstRolloId}/mover`,
    originCookie,
    { ubicacionOrigenId: originId, ubicacionTransitoId: otherId },
  );
  assert.equal(retiredMove.status, 410);
  assert.equal(retiredMove.body.code, "SALIDAS_FLOW_REQUIRED");

  const sent = await api("POST", `/salidas/${created.body.id}/enviar`, originCookie, {
    transportista: "Unidad API",
    notaEnvio: null,
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));

  const deniedReceive = await api("POST", `/salidas/${created.body.id}/recibir`, originCookie, {
    rollos: [{ rolloId: firstRolloId, recibido: true, cantidadRecibida: "15" }],
  });
  assert.equal(deniedReceive.status, 403);

  const retiredReceive = await api(
    "POST",
    `/inventario/rollos/${firstRolloId}/recibir`,
    destinationWarehouseCookie,
    { ubicacionDestinoId: destinationId },
  );
  assert.equal(retiredReceive.status, 410);
  assert.equal(retiredReceive.body.code, "SALIDAS_FLOW_REQUIRED");

  const receivedAtDestination = await api(
    "POST",
    `/salidas/${created.body.id}/recibir`,
    destinationWarehouseCookie,
    { rollos: [{ rolloId: firstRolloId, recibido: true, cantidadRecibida: "15" }] },
  );
  assert.equal(receivedAtDestination.status, 200, JSON.stringify(receivedAtDestination.body));

  const deniedClose = await api("POST", `/salidas/${created.body.id}/cerrar`, destinationCookie, {});
  assert.equal(deniedClose.status, 403);

  const closed = await api("POST", `/salidas/${created.body.id}/cerrar`, adminCookie, {});
  assert.equal(closed.status, 200, JSON.stringify(closed.body));

  const ownList = await api("GET", "/salidas", destinationCookie);
  assert.equal(ownList.status, 200);
  assert.ok(ownList.body.items.some((item: { id: number }) => item.id === created.body.id));

  const unrelatedList = await api("GET", "/salidas", otherCookie);
  assert.equal(unrelatedList.status, 200);
  assert.ok(!unrelatedList.body.items.some((item: { id: number }) => item.id === created.body.id));
});

test("ADMIN puede operar el flujo completo sin restricción de ubicación", async () => {
  const adminCookie = cookies.get("ADMINnull")!;
  const created = await api("POST", "/salidas", adminCookie, createBody(randomUUID()));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  salidaIds.push(created.body.id);
  const accepted = await api("POST", `/salidas/${created.body.id}/aceptar`, adminCookie, {});
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  const prepared = await api("POST", `/salidas/${created.body.id}/preparar`, adminCookie, {
    lineas: [{ lineaId: accepted.body.lineas[0].id, rolloIds: [secondRolloId] }],
  });
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  const sent = await api("POST", `/salidas/${created.body.id}/enviar`, adminCookie, {
    transportista: "Unidad admin",
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const received = await api("POST", `/salidas/${created.body.id}/recibir`, adminCookie, {
    rollos: [{ rolloId: secondRolloId, recibido: true, cantidadRecibida: "15" }],
  });
  assert.equal(received.status, 200, JSON.stringify(received.body));
  const closed = await api("POST", `/salidas/${created.body.id}/cerrar`, adminCookie, {});
  assert.equal(closed.status, 200, JSON.stringify(closed.body));

  const cancellable = await api("POST", "/salidas", adminCookie, createBody(randomUUID()));
  assert.equal(cancellable.status, 201, JSON.stringify(cancellable.body));
  salidaIds.push(cancellable.body.id);
  const cancelled = await api(
    "POST",
    `/salidas/${cancellable.body.id}/cancelar`,
    adminCookie,
    { motivo: "Solicitud cancelada por prueba" },
  );
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.canceladoPorId, cancelled.body.solicitadoPorId);
  assert.ok(cancelled.body.nombreCanceladoPor);
  assert.ok(cancelled.body.fechaCancelacion);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await db.transaction(async (tx) => {
    if (sessionIds.length > 0) {
      await tx.delete(sesionesTable).where(inArray(sesionesTable.id, sessionIds));
    }
    if (salidaIds.length > 0) {
      await tx.delete(salidaRollosTable).where(inArray(salidaRollosTable.salidaId, salidaIds));
      await tx.delete(salidaLineasTable).where(inArray(salidaLineasTable.salidaId, salidaIds));
      await tx.delete(salidasTable).where(inArray(salidasTable.id, salidaIds));
    }
    if (rollIds.length > 0) {
      await tx.delete(movimientosTable).where(inArray(movimientosTable.rolloId, rollIds));
      await tx.delete(rollosTable).where(inArray(rollosTable.id, rollIds));
    }
    if (productIds.length > 0) {
      await tx.delete(existenciasTable).where(inArray(existenciasTable.productoId, productIds));
      await tx.delete(productosTable).where(inArray(productosTable.id, productIds));
    }
    if (userIds.length > 0) {
      await tx.delete(usuariosTable).where(inArray(usuariosTable.id, userIds));
    }
    if (locationIds.length > 0) {
      await tx.delete(ubicacionesTable).where(inArray(ubicacionesTable.id, locationIds));
    }
  });
});