import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import ExcelJS from "exceljs";
import {
  db,
  entradasTable,
  movimientosTable,
  permisosUsuarioTable,
  pool,
  productosTable,
  rollosTable,
  salidasTable,
  sesionesTable,
  ticketsTable,
  tipoMovimientoEnum,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import app from "./app";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Las pruebas HTTP de Kardex requieren NODE_ENV=test y TEST_DATABASE_URL.",
  );
}

const run = `KDX-${randomUUID()}`;
const ids = {
  users: [] as number[],
  sessions: [] as string[],
  locations: [] as number[],
  products: [] as number[],
  rolls: [] as number[],
  movements: [] as number[],
  entries: [] as number[],
  tickets: [] as number[],
  salidas: [] as number[],
};
let server: Server;
let baseUrl = "";
let adminCookie = "";
let ownCookie = "";
let allCookie = "";
let terminalCookie = "";
let productId = 0;
let ownLocationId = 0;
let otherLocationId = 0;
let inactiveLocationId = 0;
let ticketFolio = 0;
let salidaFolio = 0;
let july2021ExpectedIds: number[] = [];

async function user(
  rol: "ADMIN" | "BODEGA" | "TERMINAL",
  locationId: number | null,
  alcanceConsulta: "PROPIA" | "TODAS",
) {
  const [created] = await db
    .insert(usuariosTable)
    .values({
      nombre: `${rol} ${alcanceConsulta} ${run}`,
      usuario: `${rol}-${alcanceConsulta}-${run}`,
      passwordHash: "not-used",
      rol,
      ubicacionId: locationId,
      alcanceConsulta,
      activo: true,
    })
    .returning();
  assert.ok(created);
  ids.users.push(created.id);
  if (rol !== "ADMIN") {
    await db.insert(permisosUsuarioTable).values({
      usuarioId: created.id,
      modulo: "movimientos",
      puedeVer: true,
    });
  }
  const session = randomUUID();
  await db.insert(sesionesTable).values({
    id: session,
    usuarioId: created.id,
    expiraAt: new Date(Date.now() + 3_600_000),
    ip: "127.0.0.1",
    userAgent: "kardex-api-test",
  });
  ids.sessions.push(session);
  return { created, cookie: `mariana_session=${session}` };
}

async function request(path: string, cookie: string) {
  return fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie } });
}

before(async () => {
  const locations = await db
    .insert(ubicacionesTable)
    .values([
      { nombre: `Propia ${run}`, tipo: "BODEGA", activa: true },
      { nombre: `Otra ${run}`, tipo: "TIENDA", activa: true },
      { nombre: `Inactiva ${run}`, tipo: "TIENDA", activa: false },
    ])
    .returning();
  ids.locations.push(...locations.map(({ id }) => id));
  [ownLocationId, otherLocationId, inactiveLocationId] = ids.locations;

  const [product] = await db
    .insert(productosTable)
    .values({
      sku: run,
      tela: `Tela ${run}`,
      color: `Color ${run}`,
      unidad: "METRO",
      precioSugerido: "123.00",
    })
    .returning();
  assert.ok(product);
  productId = product.id;
  ids.products.push(product.id);

  const admin = await user("ADMIN", null, "TODAS");
  const own = await user("BODEGA", ownLocationId, "PROPIA");
  const all = await user("BODEGA", ownLocationId, "TODAS");
  const terminal = await user("TERMINAL", ownLocationId, "PROPIA");
  adminCookie = admin.cookie;
  ownCookie = own.cookie;
  allCookie = all.cookie;
  terminalCookie = terminal.cookie;

  const rolls = await db
    .insert(rollosTable)
    .values(
      ids.locations.map((locationId, index) => ({
        serie: `${run}-${index}`,
        productoId: productId,
        ubicacionId: locationId,
        estado: "DISPONIBLE" as const,
        cantidadInicial: "100",
        cantidadActual: "100",
        costoUnitario: "99",
        costoTotal: "9900",
      })),
    )
    .returning();
  ids.rolls.push(...rolls.map(({ id }) => id));

  const folio = 1_000_000_000 + Math.floor(Math.random() * 100_000_000);
  const [entry] = await db
    .insert(entradasTable)
    .values({
      folio,
      ubicacionId: ownLocationId,
      usuarioId: admin.created.id,
      fecha: new Date(),
      totalRollos: 1,
      totalCosto: "1",
      uuidCliente: randomUUID(),
    })
    .returning();
  assert.ok(entry);
  ids.entries.push(entry.id);

  const documentFolio = 1_100_000_000 + Math.floor(Math.random() * 10_000_000);
  ticketFolio = documentFolio;
  salidaFolio = documentFolio + 1;
  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      folio: documentFolio,
      ubicacionId: ownLocationId,
      usuarioTerminalId: terminal.created.id,
      tipo: "NORMAL",
      subtotal: "10",
      iva: "0",
      tasaIva: "0",
      total: "10",
      uuidCliente: randomUUID(),
    })
    .returning();
  assert.ok(ticket);
  ids.tickets.push(ticket.id);
  const [salida] = await db
    .insert(salidasTable)
    .values({
      folio: salidaFolio,
      origenId: ownLocationId,
      destinoId: otherLocationId,
      usuarioSolicitaId: admin.created.id,
      uuidCliente: randomUUID(),
    })
    .returning();
  assert.ok(salida);
  ids.salidas.push(salida.id);

  const base = new Date("2025-01-15T12:00:00.000Z");
  const values = tipoMovimientoEnum.enumValues.map((tipo, index) => ({
    rolloId: rolls[index % rolls.length]!.id,
    productoId: productId,
    ubicacionId: ids.locations[index % ids.locations.length]!,
    tipo,
    cantidad: index % 2 ? "-1" : "1",
    saldoPosterior: String(100 - index),
    usuarioId: admin.created.id,
    documentoTipo:
      tipo === "RECEPCION"
        ? "ENTRADA"
        : tipo === "VENTA"
          ? "TICKET"
          : tipo === "TRANSFERENCIA_SALIDA"
            ? "SALIDA"
            : tipo === "TRANSFERENCIA_ENTRADA"
              ? "RECEPCION_SALIDA"
              : tipo === "ALTA"
                ? "TICKET"
          : null,
    documentoId:
      tipo === "RECEPCION"
        ? String(folio)
        : tipo === "VENTA"
          ? String(ticket.id)
          : tipo === "TRANSFERENCIA_SALIDA" ||
              tipo === "TRANSFERENCIA_ENTRADA"
            ? String(salida.id)
            : tipo === "ALTA"
              ? "2147483647"
              : null,
    justificacion: tipo === "AJUSTE_NEGATIVO" ? `Búsqueda ${run}` : null,
    revisado: tipo !== "AJUSTE_NEGATIVO",
    createdAt:
      tipo === "ALTA"
        ? new Date("2025-01-15T05:59:59.000Z")
        : tipo === "RECEPCION"
          ? new Date("2025-01-15T06:00:00.000Z")
          : new Date(base.getTime() + index * 1000),
  }));
  const inserted = await db.insert(movimientosTable).values(values).returning();
  ids.movements.push(...inserted.map(({ id }) => id));
  const sale = inserted.find(({ tipo }) => tipo === "VENTA")!;
  const cancellation = inserted.find(({ tipo }) => tipo === "CANCELACION")!;
  await db
    .update(movimientosTable)
    .set({ movimientoOrigenId: sale.id })
    .where(inArray(movimientosTable.id, [cancellation.id]));

  const historical = await db
    .insert(movimientosTable)
    .values([
      {
        rolloId: rolls[0]!.id,
        productoId: productId,
        ubicacionId: ownLocationId,
        tipo: "ALTA",
        cantidad: "1",
        saldoPosterior: "1",
        usuarioId: admin.created.id,
        justificacion: `${run} before July 2021`,
        createdAt: new Date("2021-07-01T04:59:59.999Z"),
      },
      {
        rolloId: rolls[0]!.id,
        productoId: productId,
        ubicacionId: ownLocationId,
        tipo: "AJUSTE_POSITIVO",
        cantidad: "1",
        saldoPosterior: "2",
        usuarioId: admin.created.id,
        justificacion: `${run} July 2021 start`,
        createdAt: new Date("2021-07-01T05:00:00.000Z"),
      },
      {
        rolloId: rolls[0]!.id,
        productoId: productId,
        ubicacionId: ownLocationId,
        tipo: "AJUSTE_NEGATIVO",
        cantidad: "-1",
        saldoPosterior: "1",
        usuarioId: admin.created.id,
        justificacion: `${run} July 2021 end`,
        createdAt: new Date("2021-07-02T04:59:59.999Z"),
      },
      {
        rolloId: rolls[0]!.id,
        productoId: productId,
        ubicacionId: ownLocationId,
        tipo: "ALTA",
        cantidad: "1",
        saldoPosterior: "2",
        usuarioId: admin.created.id,
        justificacion: `${run} after July 2021`,
        createdAt: new Date("2021-07-02T05:00:00.000Z"),
      },
    ])
    .returning();
  ids.movements.push(...historical.map(({ id }) => id));
  july2021ExpectedIds = historical.slice(1, 3).map(({ id }) => id);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (ids.movements.length)
    await db.delete(movimientosTable).where(inArray(movimientosTable.id, ids.movements));
  if (ids.entries.length)
    await db.delete(entradasTable).where(inArray(entradasTable.id, ids.entries));
  if (ids.tickets.length)
    await db.delete(ticketsTable).where(inArray(ticketsTable.id, ids.tickets));
  if (ids.salidas.length)
    await db.delete(salidasTable).where(inArray(salidasTable.id, ids.salidas));
  if (ids.rolls.length)
    await db.delete(rollosTable).where(inArray(rollosTable.id, ids.rolls));
  if (ids.sessions.length)
    await db.delete(sesionesTable).where(inArray(sesionesTable.id, ids.sessions));
  if (ids.users.length) {
    await db.delete(permisosUsuarioTable).where(inArray(permisosUsuarioTable.usuarioId, ids.users));
    await db.delete(usuariosTable).where(inArray(usuariosTable.id, ids.users));
  }
  if (ids.products.length)
    await db.delete(productosTable).where(inArray(productosTable.id, ids.products));
  if (ids.locations.length)
    await db.delete(ubicacionesTable).where(inArray(ubicacionesTable.id, ids.locations));
  await pool.end();
});

test("history covers types, order, pagination, search, documents and safe fields", async () => {
  const all = await request(
    `/inventario/kardex?productoId=${productId}&incluirUbicacionesInactivas=true`,
    adminCookie,
  );
  assert.equal(all.status, 200);
  const body = await all.json() as any;
  assert.deepEqual(
    new Set(body.movimientos.map((row: any) => row.tipo)),
    new Set(tipoMovimientoEnum.enumValues),
  );
  assert.ok(body.movimientos.every((row: any, index: number, rows: any[]) =>
    index === 0 || new Date(rows[index - 1].createdAt) >= new Date(row.createdAt)));
  assert.ok(body.movimientos.every((row: any) =>
    !("costoUnitario" in row) && !("costoTotal" in row) &&
    !("margen" in row) && !("profit" in row)));
  assert.ok(body.movimientos.every((row: any) => typeof row.saldoPosterior === "string"));
  assert.ok(body.movimientos.every((row: any) =>
    row.referenciaRolloRuta === `/inventario/rollos/${row.rolloId}`));
  assert.match(body.movimientos.find((row: any) => row.tipo === "RECEPCION").documentoRuta, /\/entradas\/\d+\/documento/);
  const sale = body.movimientos.find((row: any) => row.tipo === "VENTA");
  assert.equal(sale.documentoRuta, `/tickets/${ids.tickets[0]}`);
  assert.equal(sale.documentoEtiqueta, `Ticket ${ticketFolio}`);
  const cancellation = body.movimientos.find((row: any) => row.tipo === "CANCELACION");
  assert.equal(cancellation.documentoRuta, `/tickets/${ids.tickets[0]}`);
  const dispatch = body.movimientos.find((row: any) => row.tipo === "TRANSFERENCIA_SALIDA");
  assert.equal(dispatch.documentoRuta, `/salidas/${ids.salidas[0]}`);
  assert.equal(dispatch.documentoEtiqueta, "Salida a sitio");
  const reception = body.movimientos.find((row: any) => row.tipo === "TRANSFERENCIA_ENTRADA");
  assert.equal(reception.documentoRuta, `/salidas/${ids.salidas[0]}`);
  assert.equal(reception.documentoEtiqueta, "Entrada por salida");
  const stale = body.movimientos.find((row: any) => row.tipo === "ALTA");
  assert.equal(stale.documentoTipo, "TICKET");
  assert.equal(stale.documentoRuta, null);
  assert.equal(stale.documentoEtiqueta, null);

  const page = await request(
    `/inventario/kardex?productoId=${productId}&page=2&pageSize=2`,
    adminCookie,
  );
  const paged = await page.json() as any;
  assert.equal(paged.movimientos.length, 2);
  assert.equal(paged.page, 2);
  const search = await request(`/inventario/kardex?buscar=${encodeURIComponent(run)}`, adminCookie);
  assert.ok(((await search.json()) as any).total > 0);
  assert.notEqual(ticketFolio, ids.tickets[0]);
  const ticketFolioSearch = await request(
    `/inventario/kardex?buscar=${ticketFolio}&incluirUbicacionesInactivas=true`,
    adminCookie,
  );
  const ticketRows = ((await ticketFolioSearch.json()) as any).movimientos;
  assert.ok(ticketRows.some((row: any) => row.tipo === "VENTA"));
  assert.ok(ticketRows.some((row: any) => row.tipo === "CANCELACION"));
  assert.notEqual(salidaFolio, ids.salidas[0]);
  const salidaFolioSearch = await request(
    `/inventario/kardex?buscar=${salidaFolio}&incluirUbicacionesInactivas=true`,
    adminCookie,
  );
  const salidaRows = ((await salidaFolioSearch.json()) as any).movimientos;
  assert.ok(salidaRows.some((row: any) => row.tipo === "TRANSFERENCIA_SALIDA"));
  assert.ok(salidaRows.some((row: any) => row.tipo === "TRANSFERENCIA_ENTRADA"));
  const typeFilter = await request("/inventario/kardex?tipos=VENTA&tipos=RECEPCION", adminCookie);
  assert.ok(((await typeFilter.json()) as any).movimientos.every((row: any) =>
    row.tipo === "VENTA" || row.tipo === "RECEPCION"));
  const businessDate = await request(
    `/inventario/kardex?productoId=${productId}&desde=2025-01-15&incluirUbicacionesInactivas=true`,
    adminCookie,
  );
  const businessRows = ((await businessDate.json()) as any).movimientos;
  assert.ok(!businessRows.some((row: any) => row.tipo === "ALTA"));
  assert.ok(businessRows.some((row: any) => row.tipo === "RECEPCION"));
  const dstBusinessDate = await request(
    `/inventario/kardex?productoId=${productId}&desde=2021-07-01&hasta=2021-07-01`,
    adminCookie,
  );
  assert.equal(dstBusinessDate.status, 200);
  const dstRows = ((await dstBusinessDate.json()) as any).movimientos;
  assert.deepEqual(
    new Set(dstRows.map((row: any) => row.id)),
    new Set(july2021ExpectedIds),
  );
  const malformedDate = await request(
    `/inventario/kardex?desde=2025-02-30`,
    adminCookie,
  );
  assert.equal(malformedDate.status, 400);
});

test("scope, inactive policy and filter metadata are enforced", async () => {
  const own = await request("/inventario/kardex", ownCookie);
  assert.ok(((await own.json()) as any).movimientos.every((row: any) => row.ubicacionId === ownLocationId));
  const all = await request("/inventario/kardex", allCookie);
  assert.ok(((await all.json()) as any).movimientos.some((row: any) => row.ubicacionId === otherLocationId));
  const forbidden = await request("/inventario/kardex?incluirUbicacionesInactivas=true", allCookie);
  assert.equal(forbidden.status, 403);
  const filters = await request("/inventario/kardex/filtros", ownCookie);
  const metadata = await filters.json() as any;
  assert.deepEqual(metadata.ubicaciones.map((location: any) => location.id), [ownLocationId]);
  assert.deepEqual(new Set(metadata.tipos), new Set(tipoMovimientoEnum.enumValues));

  const terminal = await request(
    `/inventario/kardex?productoId=${productId}`,
    terminalCookie,
  );
  assert.equal(terminal.status, 200);
  const terminalRows = ((await terminal.json()) as any).movimientos;
  assert.ok(terminalRows.length > 0);
  assert.ok(terminalRows.every((row: any) =>
    typeof row.saldoPosterior === "string" &&
    !Object.keys(row).some((key) => /costo|margen|profit|ganancia/i.test(key))));
});

test("XLSX export is a real filtered workbook without sensitive columns", async () => {
  const response = await request(
    `/inventario/kardex/exportar?productoId=${productId}&tipos=VENTA&incluirUbicacionesInactivas=true`,
    adminCookie,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /spreadsheetml/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await response.arrayBuffer()) as never,
  );
  const sheet = workbook.getWorksheet("Kardex");
  assert.ok(sheet);
  assert.deepEqual((sheet!.getRow(1).values as unknown[]).slice(1), [
    "Fecha", "Hora", "Tipo", "SKU", "Producto", "Serie", "Ubicación",
    "Cantidad", "Unidad", "Usuario", "Documento", "Justificación",
  ]);
  assert.equal(sheet!.getCell("C2").value, "VENTA");
});