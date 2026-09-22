/**
 * Task 51 / Block 6: real HTTP coverage for the transport catalog and trips.
 * This suite is deliberately opt-in: it writes only to an explicitly isolated
 * database. Cleanup is performed by deleting the disposable Neon branch,
 * because the audit log is intentionally append-only.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { sql } from "drizzle-orm";
import {
  camionetasTable, choferesTable, clientesTable, db, permisosUsuarioTable, productosTable, rollosTable, salidasTable,
  salidaLineasTable, salidaRollosTable, ticketLineasTable, ticketsTable, ubicacionesTable, usuariosTable, viajeFolioTable,
} from "@workspace/db";
import app from "./app";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
  throw new Error("viajes integration requires explicit TEST_DATABASE_URL and REQUIRE_ISOLATED_TEST_DATABASE=1");
}
const databaseResult = await db.execute<{ database: string }>(sql`select current_database() as database`);
const database = databaseResult.rows[0]?.database;
if (database === "heliumdb") throw new Error("Refusing to run viajes integration against heliumdb");

const run = `VJ${randomUUID().replaceAll("-", "")}`;
let server: Server | undefined;
let base = "";
const ids = { users: [] as number[], locations: [] as number[], trucks: [] as number[], drivers: [] as number[], products: [] as number[], rolls: [] as number[], tickets: [] as number[], exits: [] as number[], trips: [] as number[] };

async function start() {
  await new Promise<void>((resolve, reject) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") return reject(new Error("Could not allocate HTTP port"));
      base = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
    server.on("error", reject);
  });
}
async function request(method: string, path: string, body?: unknown, cookie?: string) {
  const response = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = response.headers.get("content-type")?.includes("application/json")
    ? await response.json() as Record<string, unknown>
    : { raw: await response.text() };
  return { status: response.status, body: value, cookie: response.headers.get("set-cookie")?.match(/mariana_session=([^;]+)/)?.[0] ?? cookie ?? "" };
}
async function makeUser(rol: "ADMIN" | "BODEGA", ubicacionId: number | null) {
  const password = "Task51!pass";
  const [row] = await db.insert(usuariosTable).values({
    nombre: `Task 51 ${rol}`, usuario: `${rol.toLowerCase()}_${run}`.slice(0, 64).toLowerCase(),
    passwordHash: sql`crypt(${password}, gen_salt('bf', 8))`, rol, ubicacionId,
    alcanceConsulta: rol === "BODEGA" ? "PROPIA" : "TODAS",
  }).returning({ id: usuariosTable.id, usuario: usuariosTable.usuario });
  ids.users.push(row!.id);
  return { ...row!, password };
}
async function makeLocation(suffix: string) {
  const [row] = await db.insert(ubicacionesTable).values({
    nombre: `Task 51 ${suffix} ${run}`, iniciales: suffix, tipo: "TIENDA",
  }).returning({ id: ubicacionesTable.id });
  ids.locations.push(row!.id);
  return row!.id;
}

test("Task 51 Block 6: catalogs and viaje projection preserve dispatch invariants", async () => {
  const initials = () => randomUUID().replaceAll("-", "").slice(0, 3)
    .split("").map((character) => String.fromCharCode(65 + Number.parseInt(character, 16))).join("");
  const initialsA = initials();
  const initialsB = initials();
  try {
    const originA = await makeLocation(initialsA);
    const originB = await makeLocation(initialsB);
    const [customer] = await db.select({ id: clientesTable.id }).from(clientesTable).limit(1);
    assert.ok(customer, "seed must provide a customer");
    const admin = await makeUser("ADMIN", null);
    const bodega = await makeUser("BODEGA", originA);
    await db.insert(permisosUsuarioTable).values({
      usuarioId: bodega.id, modulo: "viajes", puedeVer: true, puedeCrear: true,
    });
    await start();
    const adminSession = await request("POST", "/auth/login", { usuario: admin.usuario, password: admin.password });
    const bodegaSession = await request("POST", "/auth/login", { usuario: bodega.usuario, password: bodega.password });
    assert.equal(adminSession.status, 200);
    assert.equal(bodegaSession.status, 200);

    const denied = await request("POST", "/camionetas", { nombre: "Denied", placas: `X${run.slice(0, 5)}`, tipo: "PICKUP" }, bodegaSession.cookie);
    assert.equal(denied.status, 403, "non-admin cannot mutate transport catalog");
    const truck = await request("POST", "/camionetas", { nombre: `Camioneta ${run}`, placas: `vj-${run.slice(0, 6)}`, tipo: "PROPIA" }, adminSession.cookie);
    const driver = await request("POST", "/choferes", { nombreCompleto: `Chofer ${run}`, telefono: "5551234567" }, adminSession.cookie);
    assert.equal(truck.status, 201); assert.equal(driver.status, 201);
    ids.trucks.push(truck.body.id as number); ids.drivers.push(driver.body.id as number);
    assert.equal((await request("PATCH", `/camionetas/${truck.body.id}`, { activa: false }, adminSession.cookie)).status, 200);
    assert.equal((await request("PATCH", `/choferes/${driver.body.id}`, { activo: false }, adminSession.cookie)).status, 200);
    const operational = await request("GET", "/viajes/catalogo-operativo", undefined, adminSession.cookie);
    assert.equal(operational.status, 200);
    assert.equal((operational.body.camionetas as Array<{ id: number }>).some((x) => x.id === truck.body.id), false);
    assert.equal((operational.body.choferes as Array<{ id: number }>).some((x) => x.id === driver.body.id), false);
    assert.equal((await request("GET", `/camionetas/${truck.body.id}`, undefined, adminSession.cookie)).status, 200, "historical catalog row remains");
    assert.equal((await request("GET", `/choferes/${driver.body.id}`, undefined, adminSession.cookie)).status, 200);
    assert.equal((await request("PATCH", `/camionetas/${truck.body.id}`, { activa: true }, adminSession.cookie)).status, 200);
    assert.equal((await request("PATCH", `/choferes/${driver.body.id}`, { activo: true }, adminSession.cookie)).status, 200);

    const [metro, kilo] = await db.insert(productosTable).values([
      { sku: `M${run}`.slice(0, 64), tela: "Metro", color: run, unidad: "METRO", precioSugerido: "10.00" },
      { sku: `K${run}`.slice(0, 64), tela: "Kilo", color: run, unidad: "KILO", precioSugerido: "10.00" },
    ]).returning({ id: productosTable.id });
    ids.products.push(metro!.id, kilo!.id);
    const [notaMetro, notaKilo, ticket, notaOtherOrigin] = await db.insert(ticketsTable).values([
      { folio: 800000 + ids.users[0]!, ubicacionId: originA, usuarioTerminalId: admin.id, clienteId: customer!.id, documentoTipo: "NOTA", notaSinPrecios: true, nombreDestinatario: "Destino nota metro", direccionEntregaSnapshot: "Calle Metro", subtotal: "10", iva: "0", total: "10", uuidCliente: randomUUID() },
      { folio: 810000 + ids.users[0]!, ubicacionId: originA, usuarioTerminalId: admin.id, clienteId: customer!.id, documentoTipo: "NOTA", notaSinPrecios: true, nombreDestinatario: "Destino nota kilo", direccionEntregaSnapshot: "Calle Kilo", subtotal: "10", iva: "0", total: "10", uuidCliente: randomUUID() },
      { folio: 820000 + ids.users[0]!, ubicacionId: originA, usuarioTerminalId: admin.id, clienteId: customer!.id, documentoTipo: "TICKET", subtotal: "10", iva: "0", total: "10", uuidCliente: randomUUID() },
      { folio: 821000 + ids.users[0]!, ubicacionId: originB, usuarioTerminalId: admin.id, clienteId: customer!.id, documentoTipo: "NOTA", notaSinPrecios: true, subtotal: "10", iva: "0", total: "10", uuidCliente: randomUUID() },
    ]).returning({ id: ticketsTable.id });
    ids.tickets.push(notaMetro!.id, notaKilo!.id, ticket!.id, notaOtherOrigin!.id);
    const [physicalRoll, preparedExitRoll] = await db.insert(rollosTable).values([{
      serie: String(9_000_000 + ids.users[0]!),
      productoId: metro!.id,
      ubicacionId: originA,
      estado: "VENDIDO",
      cantidadInicial: "4.000",
      cantidadActual: "4.000",
      costoUnitario: "5.00",
      costoTotal: "20.00",
    }, {
      serie: String(9_100_000 + ids.users[0]!),
      productoId: metro!.id, ubicacionId: originA, estado: "DISPONIBLE",
      cantidadInicial: "2.000", cantidadActual: "2.000", costoUnitario: "5.00", costoTotal: "10.00",
    }]).returning({ id: rollosTable.id, serie: rollosTable.serie });
    ids.rolls.push(physicalRoll!.id, preparedExitRoll!.id);
    await db.insert(ticketLineasTable).values([
      { ticketId: notaMetro!.id, rolloId: physicalRoll!.id, productoId: metro!.id, tipo: "NORMAL", cantidad: "4.000", precioUnitario: "10", precioSugerido: "10", importe: "40", costoUnitarioCongelado: "5", costoTotalCongelado: "20" },
      { ticketId: notaMetro!.id, productoId: metro!.id, tipo: "METREADO", cantidad: "2.500", precioUnitario: "10", precioSugerido: "10", importe: "25", costoReferenciaEstado: "NO_COST" },
      { ticketId: notaKilo!.id, productoId: kilo!.id, tipo: "METREADO", cantidad: "3.000", precioUnitario: "10", precioSugerido: "10", importe: "30", costoReferenciaEstado: "NO_COST" },
    ]);
    const [exit] = await db.insert(salidasTable).values({ folio: 830000 + ids.users[0]!, origenId: originA, destinoId: originB, modalidad: "TRASLADO", estado: "ARMANDO", usuarioSolicitaId: admin.id, uuidCliente: randomUUID() }).returning({ id: salidasTable.id });
    ids.exits.push(exit!.id);
    const [exitLine] = await db.insert(salidaLineasTable).values({ salidaId: exit!.id, productoId: metro!.id, cantidadSolicitada: "2.000", cantidadEnviada: "0", cantidadRecibida: "0", rollosSolicitados: 1 }).returning({ id: salidaLineasTable.id });
    await db.insert(salidaRollosTable).values({ salidaId: exit!.id, lineaId: exitLine!.id, rolloId: preparedExitRoll!.id, cantidadEnviada: "2.000", recibido: false });

    const create = (origenId: number, ticketIds: number[] = [], salidaIds: number[] = []) => request("POST", "/viajes", { origenId, camionetaId: truck.body.id, choferId: driver.body.id, salidaAt: "2026-09-01T12:00:00.000Z", ticketIds, salidaIds }, adminSession.cookie);
    const trip = await create(originA, [notaMetro!.id, notaKilo!.id], [exit!.id]);
    assert.equal(trip.status, 201); ids.trips.push(trip.body.id as number); assert.equal(trip.body.folio, 1);
    const bodegaCatalog = await request("GET", "/viajes/catalogo-operativo", undefined, bodegaSession.cookie);
    assert.equal(bodegaCatalog.status, 200);
    assert.deepEqual((bodegaCatalog.body.ubicaciones as Array<{ id: number }>).map((location) => location.id), [originA]);
    assert.equal((await request("GET", `/viajes/elegibles?origenId=${originB}`, undefined, bodegaSession.cookie)).status, 403);
    assert.equal((await request("POST", "/viajes", { origenId: originB, camionetaId: truck.body.id, choferId: driver.body.id, salidaAt: "2026-09-01", salidaIds: [exit!.id] }, bodegaSession.cookie)).status, 403);
    assert.equal((await create(originA, [notaOtherOrigin!.id])).status, 409, "admin cannot attach a ticket from another origin");
    const projection = await request("GET", `/viajes/${trip.body.id}`, undefined, adminSession.cookie);
    assert.equal(projection.status, 200); assert.equal(projection.body.documentos, 3);
    assert.equal(projection.body.totalRollos, 2);
    assert.equal(projection.body.totalMetros, "8.500"); assert.equal(projection.body.totalKilos, "3.000");
    assert.equal((projection.body.rollos as Array<{ serie: string }>).some((rollo) => rollo.serie === physicalRoll!.serie), true);
    assert.deepEqual(new Set(projection.body.destinos as string[]), new Set(["Calle Metro", "Calle Kilo", `Task 51 ${initialsB} ${run}`]));
    assert.equal((await request("POST", "/viajes", { origenId: originA, camionetaId: truck.body.id, choferId: driver.body.id, salidaAt: "2026-09-01", ticketIds: [notaMetro!.id] }, adminSession.cookie)).status, 409);
    assert.equal((await create(originA, [ticket!.id])).status, 409, "cash ticket cannot attach");
    const otherOrigin = await create(originB, [], []); assert.equal(otherOrigin.status, 400);
    const secondB = await db.insert(salidasTable).values({ folio: 840000 + ids.users[0]!, origenId: originB, destinoId: originA, modalidad: "TRASLADO", estado: "ARMANDO", uuidCliente: randomUUID() }).returning({ id: salidasTable.id });
    ids.exits.push(secondB[0]!.id);
    assert.equal((await create(originA, [], [secondB[0]!.id])).status, 409, "admin cannot attach a salida from another origin");
    const tripB = await create(originB, [], [secondB[0]!.id]); assert.equal(tripB.status, 201); ids.trips.push(tripB.body.id as number); assert.equal(tripB.body.folio, 1);
    const secondAExit = await db.insert(salidasTable).values({ folio: 850000 + ids.users[0]!, origenId: originA, destinoId: originB, modalidad: "TRASLADO", estado: "ARMANDO", uuidCliente: randomUUID() }).returning({ id: salidasTable.id });
    ids.exits.push(secondAExit[0]!.id);
    const tripA2 = await create(originA, [], [secondAExit[0]!.id]); assert.equal(tripA2.status, 201); ids.trips.push(tripA2.body.id as number); assert.equal(tripA2.body.folio, 2);
    const bodegaList = await request("GET", `/viajes?origenId=${originB}`, undefined, bodegaSession.cookie);
    assert.equal(bodegaList.status, 200);
    assert.equal((bodegaList.body as unknown as Array<{ origenId: number }>).every((row) => row.origenId === originA), true);
    assert.equal((await request("GET", `/viajes/${tripB.body.id}`, undefined, bodegaSession.cookie)).status, 403);
    const list = async (query = "") => request("GET", `/viajes${query}`, undefined, adminSession.cookie);
    const listAll = await list();
    assert.equal(listAll.status, 200);
    assert.equal((listAll.body as unknown as Array<unknown>).length >= 3, true);
    const listSummary = (listAll.body as unknown as Array<{ id: number, documentos: number, totalRollos: number, totalMetros: string, totalKilos: string }>).find((row) => row.id === trip.body.id);
    assert.ok(listSummary);
    assert.equal(listSummary.documentos, 3); assert.equal(listSummary.totalRollos, 2);
    assert.equal(listSummary.totalMetros, "8.500"); assert.equal(listSummary.totalKilos, "3.000");
    const containsTrip = (response: { body: Record<string, unknown> }) => (response.body as unknown as Array<{ id: number }>).some((row) => row.id === trip.body.id);
    assert.equal(containsTrip(await list("?fechaDesde=2026-09-01T00:00:00.000Z")), true);
    assert.equal(containsTrip(await list("?fechaDesde=2026-09-02T00:00:00.000Z")), false);
    assert.equal(containsTrip(await list("?fechaHasta=2026-09-02T00:00:00.000Z")), true);
    assert.equal(containsTrip(await list("?fechaHasta=2026-09-01T00:00:00.000Z")), false);
    assert.equal((await list(`?camionetaId=${truck.body.id}`)).body.length, 3);
    assert.equal((await list(`?camionetaId=${Number(truck.body.id) + 1_000_000}`)).body.length, 0);
    assert.equal((await list(`?choferId=${driver.body.id}`)).body.length, 3);
    assert.equal((await list(`?choferId=${Number(driver.body.id) + 1_000_000}`)).body.length, 0);
    assert.equal((await list(`?origenId=${originA}`)).body.length, 2);
    assert.equal((await list(`?origenId=${Number(originA) + 1_000_000}`)).body.length, 0);
    assert.equal(containsTrip(await list("?destino=calle%20metro")), true, "destination filtering is case-insensitive");
    assert.equal((await list("?destino=sin%20coincidencia")).body.length, 0);
    const combined = await list(`?fechaDesde=2026-09-01T00:00:00.000Z&fechaHasta=2026-09-02T00:00:00.000Z&camionetaId=${truck.body.id}&choferId=${driver.body.id}&origenId=${originA}&destino=CALLE%20METRO`);
    assert.equal(combined.status, 200); assert.equal(combined.body.length, 1);
    assert.equal((combined.body as unknown as Array<{ id: number }>)[0]!.id, trip.body.id);
    const sent = await request("POST", `/salidas/${exit!.id}/enviar`, {}, adminSession.cookie);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.estado, "EN_TRANSITO");
    assert.equal(sent.body.transportista, null);
    assert.equal(sent.body.transporteEfectivo, `Camioneta ${run} · ${`vj-${run.slice(0, 6)}`.toUpperCase()} · Chofer ${run}`);
    assert.equal((await request("DELETE", `/viajes/${trip.body.id}`, undefined, adminSession.cookie)).status, 404);
    assert.equal((await request("DELETE", `/camionetas/${truck.body.id}`, undefined, adminSession.cookie)).status, 404);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
});