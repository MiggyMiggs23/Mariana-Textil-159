import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditoriaTable,
  clientesTable,
  db,
  existenciasTable,
  movimientosCreditoTable,
  movimientosTable,
  productosTable,
  rollosTable,
  sesionesCajaTable,
  ticketFolioTable,
  ticketLineasTable,
  ticketPagosTable,
  ticketsTable,
  ubicacionesTable,
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
  PosError,
} from "./pos";

const RUN = `POS${Date.now()}`;
const USER_ID = 1;
let passed = 0;
let failed = 0;
let seq = 0;

const createdProductIds: number[] = [];
const createdLocationIds: number[] = [];
const createdClientIds: number[] = [];
const createdRolloIds: number[] = [];
const createdTicketIds: number[] = [];
const createdSessionIds: number[] = [];

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

async function makeLocation() {
  const [row] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `${RUN} Tienda ${++seq}`,
      tipo: "TIENDA",
    })
    .returning();
  createdLocationIds.push(row!.id);
  return row!.id;
}

async function makeProduct(precioSugerido = "100.00") {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(productosTable)
    .values({
      sku: tag,
      tela: `Tela ${tag}`,
      color: `Color ${tag}`,
      unidad: "METRO",
      precioSugerido,
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
  const { rollo } = await db.transaction((tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: cantidad,
      costoUnitario: costo,
      usuarioId: USER_ID,
      estado: "DISPONIBLE",
    }),
  );
  createdRolloIds.push(rollo.id);
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
        clienteId: input.clienteId ?? null,
        tipo: input.tipo ?? "NORMAL",
        facturado: input.facturado ?? false,
        uuidCliente: input.uuid ?? randomUUID(),
        lineas: [
          {
            rolloId: input.rolloId ?? null,
            productoId: input.productoId,
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
});

await test("POS-04 metreado no toca inventario, no factura y solo acepta efectivo", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
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
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  const [client] = await db
    .select()
    .from(clientesTable)
    .where(eq(clientesTable.id, clientId));
  assert.equal(client!.saldoCredito, "300.00");
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
        ip: "127.0.0.1",
      },
      true,
    ),
  );
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
  const [client] = await db
    .select()
    .from(clientesTable)
    .where(eq(clientesTable.id, clientId));
  assert.equal(client!.saldoCredito, "0.00");
  const ledger = await db
    .select()
    .from(movimientosCreditoTable)
    .where(eq(movimientosCreditoTable.ticketId, ticket.id));
  assert.deepEqual(
    ledger.map((movement) => movement.tipo).sort(),
    ["REVERSO", "VENTA_CREDITO"],
  );
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

try {
  if (createdTicketIds.length > 0) {
    await db
      .delete(auditoriaTable)
      .where(
        and(
          eq(auditoriaTable.entidad, "tickets"),
          inArray(
            auditoriaTable.entidadId,
            createdTicketIds.map(String),
          ),
        ),
      );
    await db
      .delete(movimientosCreditoTable)
      .where(inArray(movimientosCreditoTable.ticketId, createdTicketIds));
    await db
      .delete(ticketPagosTable)
      .where(inArray(ticketPagosTable.ticketId, createdTicketIds));
    await db
      .delete(ticketLineasTable)
      .where(inArray(ticketLineasTable.ticketId, createdTicketIds));
    await db.delete(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
  }
  if (createdSessionIds.length > 0) {
    await db
      .delete(auditoriaTable)
      .where(
        and(
          eq(auditoriaTable.entidad, "sesiones_caja"),
          inArray(
            auditoriaTable.entidadId,
            createdSessionIds.map(String),
          ),
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
    await db.delete(rollosTable).where(inArray(rollosTable.id, createdRolloIds));
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
}

process.stdout.write(
  `\nPOS/caja: ${passed} passed, ${failed} failed\n`,
);
if (failed > 0) process.exit(1);