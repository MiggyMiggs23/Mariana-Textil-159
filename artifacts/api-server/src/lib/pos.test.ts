import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  auditoriaTable,
  clientesTable,
  db,
  entradasTable,
  ensureProductMeterSchema,
  existenciasTable,
  movimientosCreditoTable,
  notificacionesCreditoTable,
  movimientosTable,
  productosTable,
  pool,
  rollosTable,
  sesionesCajaTable,
  ticketFolioTable,
  ticketLineasTable,
  ticketPagosTable,
  ticketsTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import { crearRollo } from "./inventario";
import {
  abrirSesionCaja,
  buildCorteCaja,
  buildTicketDetail,
  cancelarTicket,
  cerrarSesionCaja,
  cobrarTicket,
  crearTicket,
  listarTicketsCajaOperativa,
  listarTicketsPendientesCaja,
  PosError,
  quantityTimesMoneyCents,
  validarPrecioPos,
} from "./pos";

const RUN = `POS${Date.now()}`;
const [testUser] = await db
  .select({ id: usuariosTable.id })
  .from(usuariosTable)
  .limit(1);
if (!testUser) {
  throw new Error("POS tests require at least one seeded user.");
}
const USER_ID = testUser.id;
let passed = 0;
let failed = 0;
let seq = 0;

const createdProductIds: number[] = [];
const createdLocationIds: number[] = [];
const createdClientIds: number[] = [];
const createdEntryIds: number[] = [];
const createdRolloIds: number[] = [];
const createdTicketIds: number[] = [];
const createdSessionIds: number[] = [];

await ensureProductMeterSchema(pool);

const [folioBefore] = await db
  .select()
  .from(ticketFolioTable)
  .where(eq(ticketFolioTable.id, 1))
  .limit(1);

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed += 1;
  } catch (error) {
    process.stdout.write(
      `  ✗ ${name}\n    ${(error as Error).stack ?? String(error)}\n`,
    );
    failed += 1;
  }
}

await test("POS monetary line totals use exact thousandths times cents arithmetic", async () => {
  // 2.675 × 1.00 = 2.675, which freezes at 2.68 by conventional half-up.
  assert.equal(quantityTimesMoneyCents("2.675", 100), 268);
  assert.equal(quantityTimesMoneyCents("1.005", 100), 101);
});

async function makeLocation() {
  const [row] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `${RUN} Tienda ${++seq}`,
      iniciales: `P${String.fromCharCode(65 + Math.floor(seq / 26))}${String.fromCharCode(65 + (seq % 26))}`,
      tipo: "TIENDA",
    })
    .returning();
  createdLocationIds.push(row!.id);
  return row!.id;
}

async function makeProduct(
  precioSugerido = "100.00",
  unidad: "METRO" | "KILO" = "METRO",
  seVendePorMetro = unidad === "METRO",
) {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(productosTable)
    .values({
      sku: tag,
      tela: `Tela ${tag}`,
      color: `Color ${tag}`,
      unidad,
      precioSugerido,
      precioMayoreo: precioSugerido,
      precioMenudeo: precioSugerido,
      seVendePorMetro,
    })
    .returning();
  createdProductIds.push(row!.id);
  return row!.id;
}

async function makeRollo(
  productoId: number,
  ubicacionId: number,
  cantidad = "10.000",
  costo = "50.00",
) {
  const { rollo, entryId } = await db.transaction(async (tx) => {
    const created = await crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: cantidad,
      costoUnitario: costo,
      usuarioId: USER_ID,
      estado: "DISPONIBLE",
    });
    const [entry] = await tx
      .insert(entradasTable)
      .values({
        folio: 1_800_000_000 + ++seq,
        ubicacionId,
        usuarioId: USER_ID,
        fecha: new Date(),
        totalRollos: 1,
        totalCosto: (Number(cantidad) * Number(costo)).toFixed(2),
        uuidCliente: randomUUID(),
      })
      .returning({ id: entradasTable.id });
    await tx
      .update(rollosTable)
      .set({ recepcionId: entry!.id })
      .where(eq(rollosTable.id, created.rollo.id));
    return {
      rollo: { ...created.rollo, recepcionId: entry!.id },
      entryId: entry!.id,
    };
  });
  createdRolloIds.push(rollo.id);
  createdEntryIds.push(entryId);
  return rollo;
}

async function makeClient(limit = "1000.00") {
  const [row] = await db
    .insert(clientesTable)
    .values({
      nombre: `${RUN} Cliente ${++seq}`,
      limiteCredito: limit,
    })
    .returning();
  createdClientIds.push(row!.id);
  return row!.id;
}

async function sale(input: {
  ubicacionId: number;
  productoId: number;
  rolloId?: number | null;
  cantidad: string;
  precio: string;
  tipo?: "NORMAL" | "METREADO";
  clienteId?: number | null;
  facturado?: boolean;
  uuid?: string;
}) {
  const result = await db.transaction((tx) =>
    crearTicket(
      tx,
      {
        ubicacionId: input.ubicacionId,
        usuarioTerminalId: USER_ID,
        clienteId: input.clienteId ?? 1,
        tipo: input.tipo ?? "NORMAL",
        facturado: input.facturado ?? false,
        uuidCliente: input.uuid ?? randomUUID(),
        lineas: [
          {
            rolloId: input.rolloId ?? null,
            productoId: input.productoId,
            tipo: input.tipo ?? "NORMAL",
            cantidad: input.cantidad,
            precioUnitario: input.precio,
          },
        ],
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  assert.ok(result);
  if (!createdTicketIds.includes(result.id)) {
    createdTicketIds.push(result.id);
  }
  return result;
}

await test("POS-01 venta normal descuenta inventario e idempotencia conserva folio", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);
  const uuid = randomUUID();
  const first = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "10",
    precio: "75",
    uuid,
  });
  const duplicate = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "10",
    precio: "75",
    uuid,
  });
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.folio, first.folio);
  const [updated] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(updated!.estado, "VENDIDO");
  const ventas = await db
    .select()
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.documentoTipo, "TICKET"),
        eq(movimientosTable.documentoId, String(first.id)),
      ),
    );
  assert.equal(ventas.length, 1);
});

await test("POS-02 precio bajo costo falla sin revelar costo ni vender rollo", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "8", "60");
  const [producto] = await db
    .select({ tela: productosTable.tela, color: productosTable.color })
    .from(productosTable)
    .where(eq(productosTable.id, productoId))
    .limit(1);
  const expectedMessage = `El precio de ${producto!.tela} ${producto!.color} serie ${rollo.serie} está por debajo del mínimo permitido.`;
  const validation = await validarPrecioPos(db, {
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    precioUnitario: "59",
  });
  assert.deepEqual(validation, {
    valido: false,
    mensaje: expectedMessage,
    code: "PRICE_BELOW_COST",
  });
  assert.equal(
    JSON.stringify(validation).toLowerCase().includes("costo"),
    false,
  );
  assert.deepEqual(
    await validarPrecioPos(db, {
      ubicacionId,
      productoId,
      rolloId: rollo.id,
      precioUnitario: "60",
    }),
    { valido: true },
  );
  await assert.rejects(
    () =>
      sale({
        ubicacionId,
        productoId,
        rolloId: rollo.id,
        cantidad: "8",
        precio: "59",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PosError);
      assert.equal(error.code, "PRICE_BELOW_COST");
      assert.equal(error.message, expectedMessage);
      assert.equal(error.message.includes("60.00"), false);
      assert.equal(error.message.toLowerCase().includes("costo"), false);
      return true;
    },
  );
  const [updated] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(updated!.estado, "DISPONIBLE");
});

await test("POS-02B validación anticipada conserva alcance del rollo", async () => {
  const ubicacionId = await makeLocation();
  const otraUbicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);

  await assert.rejects(
    () =>
      validarPrecioPos(db, {
        ubicacionId: otraUbicacionId,
        productoId,
        rolloId: rollo.id,
        precioUnitario: "75",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PosError);
      assert.equal(error.code, "ROLLO_NOT_FOUND");
      assert.equal(error.message.includes(rollo.serie), false);
      return true;
    },
  );
  await assert.rejects(
    () =>
      sale({
        ubicacionId: otraUbicacionId,
        productoId,
        rolloId: rollo.id,
        cantidad: "10",
        precio: "75",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PosError);
      assert.equal(error.code, "ROLLO_NOT_FOUND");
      assert.equal(error.message.includes(rollo.serie), false);
      return true;
    },
  );
});

await test("POS-20 rollo legado sin costo falla anticipada y definitivamente con mensaje seguro", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);
  await db
    .update(rollosTable)
    .set({ costoUnitario: "0.00" })
    .where(eq(rollosTable.id, rollo.id));
  const expectedMessage = `El rollo serie ${rollo.serie} no tiene costo registrado. Contacte al administrador.`;

  assert.deepEqual(
    await validarPrecioPos(db, {
      ubicacionId,
      productoId,
      rolloId: rollo.id,
      precioUnitario: "75",
    }),
    {
      valido: false,
      code: "ROLLO_SIN_COSTO",
      mensaje: expectedMessage,
    },
  );

  const uuid = randomUUID();
  const [folioAntes] = await db
    .select()
    .from(ticketFolioTable)
    .where(eq(ticketFolioTable.id, 1))
    .limit(1);
  await assert.rejects(
    () =>
      sale({
        ubicacionId,
        productoId,
        rolloId: rollo.id,
        cantidad: "10",
        precio: "75",
        uuid,
      }),
    (error: unknown) => {
      assert.ok(error instanceof PosError);
      assert.equal(error.code, "ROLLO_SIN_COSTO");
      assert.equal(error.message, expectedMessage);
      assert.equal(error.message.includes("0.00"), false);
      return true;
    },
  );
  const [folioDespues] = await db
    .select()
    .from(ticketFolioTable)
    .where(eq(ticketFolioTable.id, 1))
    .limit(1);
  assert.equal(folioDespues?.ultimoFolio, folioAntes?.ultimoFolio);
  const rejectedTickets = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.uuidCliente, uuid));
  assert.equal(rejectedTickets.length, 0);
  const [unchanged] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(unchanged!.estado, "DISPONIBLE");
});

await test("POS-03 concurrencia permite vender el mismo rollo solo una vez", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);
  const attempts = await Promise.allSettled([
    sale({
      ubicacionId,
      productoId,
      rolloId: rollo.id,
      cantidad: "10",
      precio: "80",
    }),
    sale({
      ubicacionId,
      productoId,
      rolloId: rollo.id,
      cantidad: "10",
      precio: "80",
    }),
  ]);
  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    1,
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "rejected").length,
    1,
  );
  await assert.rejects(
    () =>
      sale({
        ubicacionId,
        productoId,
        rolloId: rollo.id,
        cantidad: "5",
        precio: "35",
      }),
    (error: unknown) =>
      error instanceof PosError && error.code === "ROLLO_NOT_AVAILABLE",
  );
});

await test("POS-04 metreado congela costo, no toca inventario, no factura y solo acepta efectivo", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);
  await assert.rejects(
    () =>
      sale({
        ubicacionId,
        productoId,
        rolloId: rollo.id,
        cantidad: "2.5",
        precio: "40",
        tipo: "METREADO",
      }),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "METREADO_ROLLO_NOT_ALLOWED",
  );
  const ticket = await sale({
    ubicacionId,
    productoId,
    cantidad: "2.5",
    precio: "40",
    tipo: "METREADO",
  });
  const movements = await db
    .select()
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.documentoTipo, "TICKET"),
        eq(movimientosTable.documentoId, String(ticket.id)),
      ),
    );
  assert.equal(movements.length, 0);
  assert.equal(ticket.lineas[0]?.tipo, "METREADO");
  assert.ok(ticket.lineas[0] && "costoUnitarioCongelado" in ticket.lineas[0]);
  assert.equal(ticket.lineas[0].costoUnitarioCongelado, "50.00");
  assert.ok(ticket.lineas[0] && "costoTotalCongelado" in ticket.lineas[0]);
  assert.equal(ticket.lineas[0].costoTotalCongelado, "125.00");
  assert.equal(ticket.lineas[0].costoFuente, "AVERAGE_12_MONTHS");
  assert.equal(ticket.lineas[0].margen, "-25.00");
  // A subsequent reception changes future reference costs, never issued lines.
  await makeRollo(productoId, ubicacionId, "10", "80.00");
  const frozen = await buildTicketDetail(db, ticket.id, true);
  const frozenLine = frozen?.lineas[0];
  assert.ok(frozenLine && "costoUnitarioCongelado" in frozenLine);
  assert.equal(frozenLine.costoUnitarioCongelado, "50.00");
  assert.equal(frozenLine.costoTotalCongelado, "125.00");
  assert.equal(frozenLine.margen, "-25.00");
  await assert.rejects(
    () =>
      sale({
        ubicacionId,
        productoId,
        cantidad: "1",
        precio: "40",
        tipo: "METREADO",
        facturado: true,
      }),
    (error: unknown) =>
      error instanceof PosError && error.code === "METREADO_FACTURADO",
  );
  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "100",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: ticket.id,
            sesionCajaId: session.id,
            usuarioId: USER_ID,
            pagos: [{ formaPago: "TRANSFERENCIA", importe: "100" }],
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "METREADO_CASH_ONLY",
  );
  await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        pagos: [{ formaPago: "EFECTIVO", importe: "100" }],
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  const corte = await buildCorteCaja(db, session.id);
  assert.equal(corte?.totalCobrado, "100.00");
  assert.equal(corte?.efectivoEsperado, "200.00");
});

await test("POS-04C metreado sin historial de costo conserva ambos costos nulos", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const ticket = await sale({
    ubicacionId,
    productoId,
    cantidad: "2.555",
    precio: "40",
    tipo: "METREADO",
  });
  const line = ticket.lineas[0];
  assert.ok(line && "costoUnitarioCongelado" in line);
  assert.equal(line.costoUnitarioCongelado, null);
  assert.equal(line.costoTotalCongelado, null);
  assert.equal(line.costoFuente, "NO_COST");
  assert.equal(line.margen, null);
});

await test("POS-04D metreado congela la proveniencia de último costo conocido vencido", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "10", "37.00");
  const staleReception = new Date();
  staleReception.setUTCFullYear(staleReception.getUTCFullYear() - 2);
  await db
    .update(entradasTable)
    .set({ fecha: staleReception })
    .where(eq(entradasTable.id, rollo.recepcionId!));

  const ticket = await sale({
    ubicacionId,
    productoId,
    cantidad: "1",
    precio: "40",
    tipo: "METREADO",
  });
  const line = ticket.lineas[0];
  assert.ok(line && "costoFuente" in line);
  assert.equal(line.costoUnitarioCongelado, "37.00");
  assert.equal(line.costoFuente, "STALE_LAST_KNOWN");

  const [persisted] = await db
    .select({ estado: ticketLineasTable.costoReferenciaEstado })
    .from(ticketLineasTable)
    .where(eq(ticketLineasTable.id, line.id));
  assert.equal(persisted?.estado, "STALE_LAST_KNOWN");
});

await test("POS-04B metreado se rechaza definitivamente cuando el producto está bloqueado", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "METRO", false);
  const uuid = randomUUID();
  await assert.rejects(
    () =>
      sale({
        ubicacionId,
        productoId,
        cantidad: "2.5",
        precio: "40",
        tipo: "METREADO",
        uuid,
      }),
    (error: unknown) => {
      assert.ok(error instanceof PosError);
      assert.equal(error.code, "METREADO_NO_HABILITADO");
      assert.match(error.message, /venta por metro no está habilitada/i);
      return true;
    },
  );
  const rejected = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.uuidCliente, uuid));
  assert.equal(rejected.length, 0);
});

await test("POS-04A ticket mixto con 2 rollos y 8 metros se crea, guarda y cobra", async () => {
  const ubicacionId = await makeLocation();
  const productoMetroId = await makeProduct();
  const productoKiloId = await makeProduct("100.00", "KILO");
  const primerRollo = await makeRollo(productoMetroId, ubicacionId, "3", "20");
  const segundoRollo = await makeRollo(productoMetroId, ubicacionId, "5", "20");
  const mixto = await db.transaction((tx) =>
    crearTicket(
      tx,
      {
        ubicacionId,
        usuarioTerminalId: USER_ID,
        clienteId: 1,
        facturado: false,
        uuidCliente: randomUUID(),
        lineas: [
          { rolloId: primerRollo.id, productoId: productoMetroId, tipo: "NORMAL", cantidad: "3", precioUnitario: "30" },
          { rolloId: segundoRollo.id, productoId: productoMetroId, tipo: "NORMAL", cantidad: "5", precioUnitario: "30" },
          { rolloId: null, productoId: productoMetroId, tipo: "METREADO", cantidad: "8", precioUnitario: "40" },
        ],
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  assert.ok(mixto);
  createdTicketIds.push(mixto!.id);
  assert.deepEqual(mixto!.lineas.map((linea) => linea.tipo), ["NORMAL", "NORMAL", "METREADO"]);
  assert.ok(
    mixto!.lineas[2] && "costoUnitarioCongelado" in mixto!.lineas[2],
  );
  assert.equal(mixto!.lineas[2].costoUnitarioCongelado, "20.00");
  assert.equal(mixto!.lineas[2].costoTotalCongelado, "160.00");
  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  const cobrado = await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: mixto!.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        pagos: [{ formaPago: "EFECTIVO", importe: "560" }],
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  assert.ok(cobrado);
  assert.equal(cobrado.estado, "VENDIDO");
  assert.equal(cobrado.total, "560.00");
  await assert.rejects(
    () => sale({
      ubicacionId,
      productoId: productoKiloId,
      cantidad: "1",
      precio: "40",
      tipo: "METREADO",
    }),
    (error: unknown) =>
      error instanceof PosError && error.code === "METREADO_UNIT_REQUIRED",
  );
});

await test("POS-05 pago mixto exacto y crédito actualizan turno y cliente", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "10", "40");
  const clientId = await makeClient("500");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "10",
    precio: "60",
    clienteId: clientId,
  });
  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "50",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        clienteId: clientId,
        pagos: [
          { formaPago: "EFECTIVO", importe: "100" },
          { formaPago: "TRANSFERENCIA", importe: "200" },
          { formaPago: "CREDITO", importe: "300" },
        ],
        diasPlazo: 30,
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  const [balance] = await db
    .select({
      saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
    })
    .from(movimientosCreditoTable)
    .where(eq(movimientosCreditoTable.clienteId, clientId));
  assert.equal(balance!.saldo, "300.00");
  const corte = await buildCorteCaja(db, session.id);
  assert.equal(corte?.totalCobrado, "600.00");
  assert.equal(corte?.formasPago[0]?.importe, "100.00");
  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: ticket.id,
            sesionCajaId: session.id,
            usuarioId: USER_ID,
            pagos: [{ formaPago: "EFECTIVO", importe: "600" }],
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "ALREADY_CHARGED",
  );
});

await test("POS-05B crédito concurrente serializa por cliente y respeta el límite", async () => {
  const firstLocationId = await makeLocation();
  const secondLocationId = await makeLocation();
  const firstProductId = await makeProduct();
  const secondProductId = await makeProduct();
  const firstRoll = await makeRollo(firstProductId, firstLocationId, "10", "20");
  const secondRoll = await makeRollo(secondProductId, secondLocationId, "10", "20");
  const clientId = await makeClient("500");
  const firstTicket = await sale({
    ubicacionId: firstLocationId,
    productoId: firstProductId,
    rolloId: firstRoll.id,
    cantidad: "10",
    precio: "40",
    clienteId: clientId,
  });
  const secondTicket = await sale({
    ubicacionId: secondLocationId,
    productoId: secondProductId,
    rolloId: secondRoll.id,
    cantidad: "10",
    precio: "40",
    clienteId: clientId,
  });
  const firstSession = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId: firstLocationId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  const secondSession = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId: secondLocationId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(firstSession.id, secondSession.id);

  const results = await Promise.allSettled([
    db.transaction((tx) =>
      cobrarTicket(
        tx,
        {
          ticketId: firstTicket.id,
          sesionCajaId: firstSession.id,
          usuarioId: USER_ID,
          clienteId: clientId,
          pagos: [{ formaPago: "CREDITO", importe: "400" }],
          diasPlazo: 30,
          ip: "127.0.0.1",
        },
        true,
      ),
    ),
    db.transaction((tx) =>
      cobrarTicket(
        tx,
        {
          ticketId: secondTicket.id,
          sesionCajaId: secondSession.id,
          usuarioId: USER_ID,
          clienteId: clientId,
          pagos: [{ formaPago: "CREDITO", importe: "400" }],
          diasPlazo: 30,
          ip: "127.0.0.1",
        },
        true,
      ),
    ),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.ok(rejected);
  assert.ok(
    rejected.reason instanceof PosError &&
      rejected.reason.code === "CREDIT_AUTH_REQUIRED",
  );
  const [balance] = await db
    .select({
      saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
    })
    .from(movimientosCreditoTable)
    .where(eq(movimientosCreditoTable.clienteId, clientId));
  assert.equal(balance!.saldo, "400.00");
});

await test("POS-05A ticket facturado persiste IVA, cobra 319 y conserva margen sin IVA", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "5", "40");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "5",
    precio: "55",
    facturado: true,
  });

  assert.equal(ticket.subtotal, "275.00");
  assert.equal(ticket.iva, "44.00");
  assert.equal(ticket.tasaIva, "0.1600");
  assert.equal(ticket.total, "319.00");
  const firstLine = ticket.lineas[0];
  assert.ok(firstLine && "margen" in firstLine);
  assert.equal(firstLine.margen, "75.00");

  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);

  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: ticket.id,
            sesionCajaId: session.id,
            usuarioId: USER_ID,
            pagos: [{ formaPago: "EFECTIVO", importe: "275" }],
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "PAYMENT_TOTAL_MISMATCH",
  );

  await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        pagos: [
          { formaPago: "EFECTIVO", importe: "100" },
          { formaPago: "TRANSFERENCIA", importe: "219" },
        ],
        ip: "127.0.0.1",
      },
      true,
    ),
  );

  const corte = await buildCorteCaja(db, session.id);
  assert.equal(corte?.totalCobrado, "319.00");
  assert.equal(corte?.ivaCobrado, "44.00");
  assert.deepEqual(corte?.facturacion[0], {
    facturado: true,
    ticketsCount: 1,
    subtotal: "275.00",
    iva: "44.00",
    importe: "319.00",
    efectivo: "100.00",
    transferencia: "219.00",
    credito: "0.00",
  });
  assert.deepEqual(corte?.facturacion[1], {
    facturado: false,
    ticketsCount: 0,
    subtotal: "0.00",
    iva: "0.00",
    importe: "0.00",
    efectivo: "0.00",
    transferencia: "0.00",
    credito: "0.00",
  });
});

await test("POS-05AA ticket no facturado mantiene IVA cero y total igual al subtotal", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "5", "40");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "5",
    precio: "55",
  });

  assert.equal(ticket.subtotal, "275.00");
  assert.equal(ticket.iva, "0.00");
  assert.equal(ticket.tasaIva, "0.1600");
  assert.equal(ticket.total, "275.00");
});

await test("POS-05B cobro exige sesión abierta y cliente para crédito", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "2", "20");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "2",
    precio: "50",
  });

  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: ticket.id,
            sesionCajaId: 0,
            usuarioId: USER_ID,
            pagos: [{ formaPago: "EFECTIVO", importe: "100" }],
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "OPEN_SESSION_REQUIRED",
  );

  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: ticket.id,
            sesionCajaId: session.id,
            usuarioId: USER_ID,
            pagos: [{ formaPago: "CREDITO", importe: "100" }],
            diasPlazo: 30,
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "SYSTEM_CLIENT_CREDIT_FORBIDDEN",
  );
});

await test("POS-05BB crear ticket exige cliente", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "1", "20");
  await assert.rejects(
    () =>
      db.transaction((tx) =>
        crearTicket(
          tx,
          {
            ubicacionId,
            usuarioTerminalId: USER_ID,
            clienteId: null,
            tipo: "NORMAL",
            facturado: false,
            uuidCliente: randomUUID(),
            lineas: [{
              rolloId: rollo.id,
              productoId,
              cantidad: "1",
              precioUnitario: "50",
            }],
            ip: "127.0.0.1",
          } as unknown as Parameters<typeof crearTicket>[1],
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "CLIENT_REQUIRED",
  );
});

await test("POS-05C lista y corte comparten todos los pendientes de la ubicación", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rolloAnterior = await makeRollo(productoId, ubicacionId, "2", "20");
  const anterior = await sale({
    ubicacionId,
    productoId,
    rolloId: rolloAnterior.id,
    cantidad: "2",
    precio: "50",
  });
  await db
    .update(ticketsTable)
    .set({ createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
    .where(eq(ticketsTable.id, anterior.id));

  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);

  const rolloActual = await makeRollo(productoId, ubicacionId, "3", "20");
  const actual = await sale({
    ubicacionId,
    productoId,
    rolloId: rolloActual.id,
    cantidad: "3",
    precio: "50",
  });
  const rolloCobrado = await makeRollo(productoId, ubicacionId, "1", "20");
  const cobrado = await sale({
    ubicacionId,
    productoId,
    rolloId: rolloCobrado.id,
    cantidad: "1",
    precio: "50",
  });
  await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: cobrado.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        pagos: [{ formaPago: "EFECTIVO", importe: "50" }],
        ip: "127.0.0.1",
      },
      true,
    ),
  );

  const lista = await listarTicketsPendientesCaja(db, ubicacionId);
  const ticketsCaja = await listarTicketsCajaOperativa(db, {
    ubicacionId,
    sesionCajaId: session.id,
  });
  const corte = await buildCorteCaja(db, session.id);
  const esperados = [anterior.id, actual.id];

  assert.deepEqual(
    lista.map((ticket) => ticket.id),
    esperados,
  );
  assert.deepEqual(
    corte?.pendientes.map((ticket) => ticket.ticketId),
    esperados,
  );
  assert.deepEqual(
    ticketsCaja.map((ticket) => ticket.id),
    [anterior.id, actual.id, cobrado.id],
  );
  assert.deepEqual(
    ticketsCaja.find((ticket) => ticket.id === cobrado.id)?.formasPago,
    ["EFECTIVO"],
  );
});

await test("POS-06 crédito sobre límite requiere autorización ADMIN", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "2", "20");
  const clientId = await makeClient("10");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "2",
    precio: "50",
    clienteId: clientId,
  });
  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: ticket.id,
            sesionCajaId: session.id,
            usuarioId: USER_ID,
            clienteId: clientId,
            pagos: [{ formaPago: "CREDITO", importe: "100" }],
            diasPlazo: 30,
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "CREDIT_AUTH_REQUIRED",
  );
  await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        clienteId: clientId,
        pagos: [{ formaPago: "CREDITO", importe: "100" }],
        autorizadoPor: USER_ID,
        diasPlazo: 30,
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  const [notification] = await db
    .select({
      urgente: notificacionesCreditoTable.urgente,
      fechaVencimiento: notificacionesCreditoTable.fechaVencimiento,
    })
    .from(notificacionesCreditoTable)
    .where(eq(notificacionesCreditoTable.ticketId, ticket.id));
  assert.equal(notification?.urgente, true, "zero-limit credit must be urgent");
  assert.match(notification?.fechaVencimiento ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

await test("POS-07 cancelación revierte inventario y crédito sin borrar pagos", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "3", "25");
  const clientId = await makeClient("500");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "3",
    precio: "50",
    clienteId: clientId,
  });
  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "0",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        clienteId: clientId,
        pagos: [{ formaPago: "CREDITO", importe: "150" }],
        diasPlazo: 30,
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  const cancelled = await db.transaction((tx) =>
    cancelarTicket(
      tx,
      {
        ticketId: ticket.id,
        usuarioId: USER_ID,
        autorizadoPor: USER_ID,
        motivo: "Prueba de devolución completa",
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  assert.equal(cancelled?.estado, "CANCELADO");
  const [updatedRollo] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(updatedRollo!.estado, "DISPONIBLE");
  const payments = await db
    .select()
    .from(ticketPagosTable)
    .where(eq(ticketPagosTable.ticketId, ticket.id));
  assert.equal(payments.length, 1);
  const ledger = await db
    .select()
    .from(movimientosCreditoTable)
    .where(eq(movimientosCreditoTable.ticketId, ticket.id));
  assert.deepEqual(ledger.map((movement) => movement.tipo).sort(), [
    "REVERSO",
    "VENTA_CREDITO",
  ]);
  assert.equal(
    ledger.reduce((sum, movement) => sum + Number(movement.importe), 0),
    0,
  );
  const corte = await buildCorteCaja(db, session.id);
  assert.equal(corte?.ticketsCancelados, 1);
  assert.equal(corte?.ticketsCobrados, 0);
  assert.equal(corte?.totalCobrado, "0.00");
  assert.equal(corte?.efectivoEsperado, "0.00");
});

await test("POS-08 costos se omiten por completo para TERMINAL", async () => {
  const firstId = createdTicketIds[0]!;
  const adminView = await buildTicketDetail(db, firstId, true);
  const terminalView = await buildTicketDetail(db, firstId, false);
  assert.ok(adminView && terminalView);
  assert.equal(
    Object.hasOwn(adminView.lineas[0]!, "costoUnitarioCongelado"),
    true,
  );
  assert.equal(
    Object.hasOwn(terminalView.lineas[0]!, "costoUnitarioCongelado"),
    false,
  );
  assert.equal(Object.hasOwn(terminalView.lineas[0]!, "margen"), false);
});

await test("POS-09 cierre es irreversible y calcula diferencia", async () => {
  const openSessionId = createdSessionIds[0]!;
  const corte = await db.transaction((tx) =>
    cerrarSesionCaja(tx, {
      sesionId: openSessionId,
      usuarioId: USER_ID,
      efectivoContado: "195",
      ip: "127.0.0.1",
    }),
  );
  assert.equal(corte?.diferencia, "-5.00");
  await assert.rejects(
    () =>
      db.transaction((tx) =>
        cerrarSesionCaja(tx, {
          sesionId: openSessionId,
          usuarioId: USER_ID,
          efectivoContado: "195",
          ip: "127.0.0.1",
        }),
      ),
    (error: unknown) =>
      error instanceof PosError && error.code === "SESSION_CLOSED",
  );
});

await test("POS-10 metreado persists per-line Menudeo/Mayoreo suggestions without blocking a price below reference cost", async () => {
  const ubicacionId = await makeLocation();
  const rojoId = await makeProduct();
  const negroId = await makeProduct();
  await db
    .update(productosTable)
    .set({ precioMayoreo: "80.00", precioMenudeo: "100.00" })
    .where(inArray(productosTable.id, [rojoId, negroId]));
  // Reception costs establish a metered reference, but METREADO still permits
  // a freely chosen price below it.
  await makeRollo(rojoId, ubicacionId, "10", "50");
  await makeRollo(negroId, ubicacionId, "10", "50");
  const ticket = await db.transaction((tx) =>
    crearTicket(
      tx,
      {
        ubicacionId,
        usuarioTerminalId: USER_ID,
        clienteId: 1,
        facturado: false,
        uuidCliente: randomUUID(),
        lineas: [
          { productoId: rojoId, tipo: "METREADO", cantidad: "9.999", precioUnitario: "40" },
          { productoId: rojoId, tipo: "METREADO", cantidad: "10.000", precioUnitario: "40" },
          // Same fabric represented by separate product-color lines must not aggregate.
          { productoId: rojoId, tipo: "METREADO", cantidad: "5.000", precioUnitario: "40" },
          { productoId: negroId, tipo: "METREADO", cantidad: "5.000", precioUnitario: "40" },
        ],
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  assert.ok(ticket);
  createdTicketIds.push(ticket!.id);
  assert.deepEqual(
    ticket!.lineas.map((linea) => linea.precioSugerido),
    ["100.00", "80.00", "100.00", "100.00"],
  );
  assert.equal(ticket!.lineas[0]?.precioUnitario, "40.00");
});

let financialTriggersDisabled = false;
try {
  await db.execute(
    sql`ALTER TABLE movimientos_credito DISABLE TRIGGER USER`,
  );
  await db.execute(
    sql`ALTER TABLE ticket_pagos DISABLE TRIGGER USER`,
  );
  financialTriggersDisabled = true;
  if (createdTicketIds.length > 0) {
    await db
      .delete(auditoriaTable)
      .where(
        and(
          eq(auditoriaTable.entidad, "tickets"),
          inArray(auditoriaTable.entidadId, createdTicketIds.map(String)),
        ),
      );
    await db
      .delete(notificacionesCreditoTable)
      .where(inArray(notificacionesCreditoTable.ticketId, createdTicketIds));
    await db
      .delete(movimientosCreditoTable)
      .where(inArray(movimientosCreditoTable.ticketId, createdTicketIds));
    await db
      .delete(ticketPagosTable)
      .where(inArray(ticketPagosTable.ticketId, createdTicketIds));
    await db
      .delete(ticketLineasTable)
      .where(inArray(ticketLineasTable.ticketId, createdTicketIds));
    await db
      .delete(ticketsTable)
      .where(inArray(ticketsTable.id, createdTicketIds));
  }
  if (createdSessionIds.length > 0) {
    await db
      .delete(auditoriaTable)
      .where(
        and(
          eq(auditoriaTable.entidad, "sesiones_caja"),
          inArray(auditoriaTable.entidadId, createdSessionIds.map(String)),
        ),
      );
    await db
      .delete(sesionesCajaTable)
      .where(inArray(sesionesCajaTable.id, createdSessionIds));
  }
  if (createdRolloIds.length > 0) {
    await db
      .delete(movimientosTable)
      .where(inArray(movimientosTable.rolloId, createdRolloIds));
    await db
      .delete(rollosTable)
      .where(inArray(rollosTable.id, createdRolloIds));
  }
  if (createdEntryIds.length > 0) {
    await db
      .delete(entradasTable)
      .where(inArray(entradasTable.id, createdEntryIds));
  }
  if (createdProductIds.length > 0 && createdLocationIds.length > 0) {
    await db
      .delete(existenciasTable)
      .where(
        and(
          inArray(existenciasTable.productoId, createdProductIds),
          inArray(existenciasTable.ubicacionId, createdLocationIds),
        ),
      );
  }
  if (createdClientIds.length > 0) {
    await db
      .delete(clientesTable)
      .where(inArray(clientesTable.id, createdClientIds));
  }
  if (createdProductIds.length > 0) {
    await db
      .delete(productosTable)
      .where(inArray(productosTable.id, createdProductIds));
  }
  if (createdLocationIds.length > 0) {
    await db
      .delete(ubicacionesTable)
      .where(inArray(ubicacionesTable.id, createdLocationIds));
  }
  if (folioBefore) {
    await db
      .update(ticketFolioTable)
      .set({ ultimoFolio: folioBefore.ultimoFolio })
      .where(eq(ticketFolioTable.id, 1));
  }
} catch (error) {
  process.stdout.write(`  ⚠ cleanup: ${(error as Error).message}\n`);
  failed += 1;
} finally {
  if (financialTriggersDisabled) {
    await db.execute(
      sql`ALTER TABLE movimientos_credito ENABLE TRIGGER USER`,
    );
    await db.execute(
      sql`ALTER TABLE ticket_pagos ENABLE TRIGGER USER`,
    );
  }
}

process.stdout.write(`\nPOS/caja: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
