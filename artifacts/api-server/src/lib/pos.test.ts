import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  autorizacionesNotaTable,
  clientesTable,
  db,
  entradasTable,
  ensureProductMeterSchema,
  movimientosCreditoTable,
  notificacionesCreditoTable,
  movimientosTable,
  productosTable,
  pool,
  rollosTable,
  salidaLineasTable,
  salidaRollosTable,
  salidasTable,
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
  autorizarNota,
  buildCorteCaja,
  buildTicketDetail,
  cancelarTicket,
  cerrarSesionCaja,
  cobrarTicket,
  crearTicket,
  listarTicketsCajaOperativa,
  listarTicketsPendientesCaja,
  PosError,
  projectTicketPrintDocument,
  quantityTimesMoneyCents,
  validarPrecioPos,
} from "./pos";
import { formatErrorWithCauses } from "./postgres-errors";

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

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed += 1;
  } catch (error) {
    process.stdout.write(
      `  ✗ ${name}\n${formatErrorWithCauses(error)}\n`,
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
  const initials = await pool.query<{ iniciales: string }>(
    `SELECT candidate AS iniciales
     FROM (
       SELECT chr(first_code) || chr(second_code)
         || CASE WHEN third_code = 0 THEN '' ELSE chr(third_code) END AS candidate
       FROM generate_series(65,90) AS first_code
       CROSS JOIN generate_series(65,90) AS second_code
       CROSS JOIN generate_series(0,90) AS third_code
       WHERE third_code = 0 OR third_code >= 65
     ) AS candidates
     WHERE NOT EXISTS (
       SELECT 1 FROM ubicaciones WHERE iniciales = candidates.candidate
     )
     ORDER BY length(candidate), candidate
     LIMIT 1`,
  );
  assert.ok(initials.rows[0], "No hay iniciales válidas disponibles para la prueba.");
  const [row] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `${RUN} Tienda ${++seq}`,
      iniciales: initials.rows[0].iniciales,
      tipo: "TIENDA",
    })
    .returning();
  createdLocationIds.push(row!.id);
  return row!.id;
}

async function makeProduct(
  precioSugerido: string | null = "100.00",
  unidad: "METRO" | "KILO" | "BOLSA" = "METRO",
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
  documentoTipo?: "TICKET" | "NOTA";
  notaSinPrecios?: boolean;
  nombreDestinatario?: string | null;
  direccionEntregaSnapshot?: string | null;
  facturado?: boolean;
  credito?: boolean;
  diasPlazo?: 7 | 15 | 30 | 60;
  uuid?: string;
}) {
  const result = await db.transaction((tx) =>
    crearTicket(
      tx,
      {
        ubicacionId: input.ubicacionId,
        usuarioTerminalId: USER_ID,
        clienteId: input.clienteId ?? 1,
        documentoTipo: input.documentoTipo ?? (input.credito ? "NOTA" : undefined),
        notaSinPrecios: input.notaSinPrecios,
        nombreDestinatario: input.nombreDestinatario,
        direccionEntregaSnapshot: input.direccionEntregaSnapshot,
        tipo: input.tipo ?? "NORMAL",
        facturado: input.facturado ?? false,
        credito: input.credito,
        diasPlazo: input.credito ? (input.diasPlazo ?? 30) : null,
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
  assert.equal(first.documentoTipo, "TICKET");
  assert.equal(first.convertidoANotaPorCobro, false);
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

await test("POS bloquea un producto sin precio antes de crear la venta", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct(null);
  const rollo = await makeRollo(productoId, ubicacionId);

  await assert.rejects(
    () => sale({
        ubicacionId,
        productoId,
        rolloId: rollo.id,
        cantidad: "10",
        precio: "75",
      }),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "SUGGESTED_PRICE_NOT_CONFIGURED" &&
      /módulo de Precios/.test(error.message),
  );

  const [unchanged] = await db
    .select({ estado: rollosTable.estado })
    .from(rollosTable)
    .where(eq(rollosTable.id, rollo.id));
  assert.equal(unchanged?.estado, "DISPONIBLE");
});

await test("POS-LOCK: tickets inversos no se interbloquean por el orden de captura", async () => {
  const ubicacionId = await makeLocation();
  const productoA = await makeProduct();
  const productoB = await makeProduct();
  const [rolloA1, rolloA2, rolloB1, rolloB2] = await Promise.all([
    makeRollo(productoA, ubicacionId),
    makeRollo(productoA, ubicacionId),
    makeRollo(productoB, ubicacionId),
    makeRollo(productoB, ubicacionId),
  ]);

  const createTicket = async (
    lines: Array<{ productoId: number; rolloId: number }>,
  ) =>
    db.transaction((tx) =>
      crearTicket(
        tx,
        {
          ubicacionId,
          usuarioTerminalId: USER_ID,
          clienteId: 1,
          tipo: "NORMAL",
          facturado: false,
          uuidCliente: randomUUID(),
          ip: "127.0.0.1",
          lineas: lines.map((line) => ({
            ...line,
            tipo: "NORMAL" as const,
            cantidad: "10.000",
            precioUnitario: "75.00",
          })),
        },
        true,
      ),
    );

  const results = await Promise.allSettled([
    createTicket([
      { productoId: productoA, rolloId: rolloA1.id },
      { productoId: productoB, rolloId: rolloB1.id },
    ]),
    createTicket([
      { productoId: productoB, rolloId: rolloB2.id },
      { productoId: productoA, rolloId: rolloA2.id },
    ]),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      const code =
        typeof result.reason === "object" &&
        result.reason !== null &&
        "code" in result.reason
          ? String(result.reason.code)
          : "UNKNOWN";
      assert.fail(
        `Ambos tickets deben concluir; una transacción abortó con ${code}: ${String(result.reason)}`,
      );
    }
    assert.ok(result.value);
    createdTicketIds.push(result.value.id);
  }
});

await test("POS documento NOTA de Venta a Público exige instantáneas de entrega", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);
  await assert.rejects(
    () => sale({
      ubicacionId,
      productoId,
      rolloId: rollo.id,
      cantidad: "10",
      precio: "75",
      documentoTipo: "NOTA",
    }),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "SYSTEM_CLIENT_CREDIT_FORBIDDEN",
  );
  const clientId = await makeClient();
  const nota = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "10",
    precio: "75",
    documentoTipo: "NOTA",
    clienteId: clientId,
    credito: true,
    nombreDestinatario: "  Ana Pérez ",
    direccionEntregaSnapshot: "  Calle Uno 1 ",
  });
  assert.equal(nota.documentoTipo, "NOTA");
  assert.equal(nota.nombreDestinatario, "Ana Pérez");
  assert.equal(nota.direccionEntregaSnapshot, "Calle Uno 1");
  assert.equal(nota.direccionEntregaEfectiva, "Calle Uno 1");
});

await test("POS impresión de nota sin precios omite toda economía y la interna la conserva", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId);
  const clientId = await makeClient();
  const nota = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "10",
    precio: "75",
    documentoTipo: "NOTA",
    clienteId: clientId,
    credito: true,
    notaSinPrecios: true,
    nombreDestinatario: "Ana Pérez",
    direccionEntregaSnapshot: "Calle Uno 1",
  });
  assert.equal(nota.notaSinPrecios, true);
  const cliente = projectTicketPrintDocument(nota, "CLIENTE")!;
  const interna = projectTicketPrintDocument(nota, "INTERNA")!;
  const economicKeys = new Set([
    "precioUnitario", "precioSugerido", "importe", "subtotal", "iva",
    "tasaIva", "total", "costoUnitarioCongelado", "costoTotalCongelado",
    "costoFuente", "margen", "saldoPendiente",
  ]);
  const assertNoEconomicKeys = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(assertNoEconomicKeys);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        assert.equal(economicKeys.has(key), false, `Unexpected economic key ${key}`);
        assertNoEconomicKeys(child);
      }
    }
  };
  assertNoEconomicKeys(cliente);
  const assertNoPrivateCostKeys = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(assertNoPrivateCostKeys);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        assert.equal(
          ["costoUnitarioCongelado", "costoTotalCongelado", "costoFuente", "margen"].includes(key),
          false,
          `Unexpected private cost key ${key}`,
        );
        assertNoPrivateCostKeys(child);
      }
    }
  };
  assertNoPrivateCostKeys(interna);
  assert.equal("serieRollo" in cliente.lineas[0]!, false);
  assert.equal("subtotal" in interna, true);
  assert.equal("saldoPendiente" in interna, true);
  assert.equal("precioUnitario" in interna.lineas[0]!, true);
  assert.equal("importe" in interna.lineas[0]!, true);
  assert.equal("costoUnitarioCongelado" in interna.lineas[0]!, false);
  assert.equal("serieRollo" in interna.lineas[0]!, false);
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
    () => sale({
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

  const clienteId = await makeClient();
  const [salida] = await db
    .insert(salidasTable)
    .values({
      folio: 980_000 + ++seq,
      origenId: ubicacionId,
      clienteId,
      modalidad: "VENTA_CLIENTE",
      estado: "EN_TRANSITO",
      usuarioSolicitaId: USER_ID,
      enviadaAt: new Date(),
      uuidCliente: randomUUID(),
    })
    .returning({ id: salidasTable.id });
  const [salidaLinea] = await db
    .insert(salidaLineasTable)
    .values({
      salidaId: salida!.id,
      productoId,
      cantidadSolicitada: rollo.cantidadActual,
      cantidadEnviada: rollo.cantidadActual,
    })
    .returning({ id: salidaLineasTable.id });
  await db.insert(salidaRollosTable).values({
    salidaId: salida!.id,
    lineaId: salidaLinea!.id,
    rolloId: rollo.id,
    cantidadEnviada: rollo.cantidadActual,
  });
  try {
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
        assert.equal("details" in error, false);
        return true;
      },
    );
  } finally {
    await db
      .delete(salidaRollosTable)
      .where(eq(salidaRollosTable.salidaId, salida!.id));
    await db
      .delete(salidaLineasTable)
      .where(eq(salidaLineasTable.salidaId, salida!.id));
    await db.delete(salidasTable).where(eq(salidasTable.id, salida!.id));
  }
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

await test("POS-BOLSA venta NORMAL exige y descuenta la caja completa", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", false);
  const caja = await makeRollo(productoId, ubicacionId, "24", "10");

  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: caja.id,
    cantidad: "24",
    precio: "15",
  });
  assert.equal(ticket.lineas[0]?.tipo, "NORMAL");
  assert.equal(ticket.lineas[0]?.cantidad, "24.000");
  assert.equal(ticket.lineas[0]?.serieRollo, caja.serie);
  const [vendida] = await db
    .select({
      estado: rollosTable.estado,
      cantidadActual: rollosTable.cantidadActual,
    })
    .from(rollosTable)
    .where(eq(rollosTable.id, caja.id));
  assert.equal(vendida?.estado, "VENDIDO");
  assert.equal(vendida?.cantidadActual, "0.000");
});

await test("POS-BOLSA METREADO descuenta saldo parcial y rechaza fracciones", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", true);
  const caja = await makeRollo(productoId, ubicacionId, "24", "10");
  const ticket = await sale({
    ubicacionId,
    productoId,
    cantidad: "3",
    precio: "15",
    tipo: "METREADO",
  });
  assert.equal(ticket.lineas[0]?.tipo, "METREADO");
  assert.equal(ticket.lineas[0]?.cantidad, "3.000");
  assert.equal(ticket.lineas[0]?.unidadProducto, "BOLSA");
  const movements = await db
    .select({
      cantidad: movimientosTable.cantidad,
      documentoTipo: movimientosTable.documentoTipo,
    })
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.documentoTipo, "TICKET_BOLSA_METREADO"),
        eq(movimientosTable.documentoId, String(ticket.id)),
      ),
    );
  assert.deepEqual(movements, [{
    cantidad: "-3.000",
    documentoTipo: "TICKET_BOLSA_METREADO",
  }]);
  const [parcial] = await db.select({
    estado: rollosTable.estado,
    cantidadActual: rollosTable.cantidadActual,
  }).from(rollosTable).where(eq(rollosTable.id, caja.id));
  assert.equal(parcial?.estado, "DISPONIBLE");
  assert.equal(parcial?.cantidadActual, "21.000");
  await assert.rejects(
    () => sale({
      ubicacionId,
      productoId,
      cantidad: "1.5",
      precio: "15",
      tipo: "METREADO",
    }),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "BOLSA_INTEGER_QUANTITY_REQUIRED",
  );
});

await test("POS-BOLSA METREADO cruza cajas FIFO y deja la línea sin rollo", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", true);
  const primera = await makeRollo(productoId, ubicacionId, "2", "10");
  const segunda = await makeRollo(productoId, ubicacionId, "5", "10");
  const ticket = await sale({
    ubicacionId,
    productoId,
    cantidad: "4",
    precio: "15",
    tipo: "METREADO",
  });
  assert.equal(ticket.lineas[0]?.rolloId, null);
  const cajas = await db.select({
    id: rollosTable.id,
    estado: rollosTable.estado,
    cantidadActual: rollosTable.cantidadActual,
  }).from(rollosTable)
    .where(inArray(rollosTable.id, [primera.id, segunda.id]))
    .orderBy(rollosTable.id);
  assert.deepEqual(cajas, [
    { id: primera.id, estado: "VENDIDO", cantidadActual: "0.000" },
    { id: segunda.id, estado: "DISPONIBLE", cantidadActual: "3.000" },
  ]);
  const movements = await db.select({
    rolloId: movimientosTable.rolloId,
    cantidad: movimientosTable.cantidad,
  }).from(movimientosTable).where(and(
    eq(movimientosTable.documentoTipo, "TICKET_BOLSA_METREADO"),
    eq(movimientosTable.documentoId, String(ticket.id)),
  )).orderBy(movimientosTable.id);
  assert.deepEqual(movements, [
    { rolloId: primera.id, cantidad: "-2.000" },
    { rolloId: segunda.id, cantidad: "-2.000" },
  ]);
});

await test("POS-BOLSA ticket mixto reserva la caja NORMAL antes del FIFO", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", true);
  const cajaNormal = await makeRollo(productoId, ubicacionId, "5", "10");
  const cajaFraccionada = await makeRollo(productoId, ubicacionId, "5", "10");

  const ticket = await db.transaction((tx) =>
    crearTicket(
      tx,
      {
        ubicacionId,
        usuarioTerminalId: USER_ID,
        clienteId: 1,
        facturado: false,
        uuidCliente: randomUUID(),
        ip: "127.0.0.1",
        lineas: [
          {
            productoId,
            tipo: "METREADO",
            cantidad: "3",
            precioUnitario: "15",
          },
          {
            rolloId: cajaNormal.id,
            productoId,
            tipo: "NORMAL",
            cantidad: "5",
            precioUnitario: "15",
          },
        ],
      },
      true,
    ),
  );

  assert.ok(ticket);
  assert.equal(ticket.lineas.length, 2);
  const cajas = await db
    .select({
      id: rollosTable.id,
      estado: rollosTable.estado,
      cantidadActual: rollosTable.cantidadActual,
    })
    .from(rollosTable)
    .where(inArray(rollosTable.id, [cajaNormal.id, cajaFraccionada.id]));
  const byId = new Map(cajas.map((caja) => [caja.id, caja]));
  assert.deepEqual(byId.get(cajaNormal.id), {
    id: cajaNormal.id,
    estado: "VENDIDO",
    cantidadActual: "0.000",
  });
  assert.deepEqual(byId.get(cajaFraccionada.id), {
    id: cajaFraccionada.id,
    estado: "DISPONIBLE",
    cantidadActual: "2.000",
  });
});

await test("POS-BOLSA METREADO saldo insuficiente revierte atómicamente", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", true);
  const caja = await makeRollo(productoId, ubicacionId, "2", "10");
  const uuid = randomUUID();
  await assert.rejects(
    () => sale({
      ubicacionId,
      productoId,
      cantidad: "3",
      precio: "15",
      tipo: "METREADO",
      uuid,
    }),
    (error: unknown) =>
      error instanceof PosError && error.code === "BOLSA_INSUFFICIENT_STOCK",
  );
  const [intacta] = await db.select({
    estado: rollosTable.estado,
    cantidadActual: rollosTable.cantidadActual,
  }).from(rollosTable).where(eq(rollosTable.id, caja.id));
  assert.deepEqual(intacta, { estado: "DISPONIBLE", cantidadActual: "2.000" });
  const tickets = await db.select({ id: ticketsTable.id })
    .from(ticketsTable).where(eq(ticketsTable.uuidCliente, uuid));
  assert.equal(tickets.length, 0);
});

await test("POS-BOLSA METREADO concurrencia no sobrevende", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", true);
  const caja = await makeRollo(productoId, ubicacionId, "5", "10");
  const attempts = await Promise.allSettled([
    sale({ ubicacionId, productoId, cantidad: "4", precio: "15", tipo: "METREADO" }),
    sale({ ubicacionId, productoId, cantidad: "4", precio: "15", tipo: "METREADO" }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  const [restante] = await db.select({
    estado: rollosTable.estado,
    cantidadActual: rollosTable.cantidadActual,
  }).from(rollosTable).where(eq(rollosTable.id, caja.id));
  assert.deepEqual(restante, { estado: "DISPONIBLE", cantidadActual: "1.000" });
});

await test("POS-BOLSA concurrencia entre NORMAL y METREADO conserva una sola venta", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "BOLSA", true);
  const caja = await makeRollo(productoId, ubicacionId, "5", "10");

  const attempts = await Promise.allSettled([
    sale({
      ubicacionId,
      productoId,
      rolloId: caja.id,
      cantidad: "5",
      precio: "15",
      tipo: "NORMAL",
    }),
    sale({
      ubicacionId,
      productoId,
      cantidad: "3",
      precio: "15",
      tipo: "METREADO",
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

  const [restante] = await db
    .select({
      estado: rollosTable.estado,
      cantidadActual: rollosTable.cantidadActual,
    })
    .from(rollosTable)
    .where(eq(rollosTable.id, caja.id));
  assert.ok(
    (restante?.estado === "VENDIDO" &&
      restante.cantidadActual === "0.000") ||
      (restante?.estado === "DISPONIBLE" &&
        restante.cantidadActual === "2.000"),
  );
});

await test("POS-BOLSA cancelación restaura NORMAL y parciales METREADO acumulados", async () => {
  const ubicacionId = await makeLocation();
  const normalProductoId = await makeProduct("100.00", "BOLSA", false);
  const normalCaja = await makeRollo(normalProductoId, ubicacionId, "6", "10");
  const normalTicket = await sale({
    ubicacionId,
    productoId: normalProductoId,
    rolloId: normalCaja.id,
    cantidad: "6",
    precio: "15",
    tipo: "NORMAL",
  });
  await db.transaction((tx) => cancelarTicket(tx, {
    ticketId: normalTicket.id,
    usuarioId: USER_ID,
    autorizadoPor: USER_ID,
    motivo: "Cancelación completa de caja",
    ip: "127.0.0.1",
  }, true));
  const [normalRestaurada] = await db.select({
    estado: rollosTable.estado,
    cantidadActual: rollosTable.cantidadActual,
  }).from(rollosTable).where(eq(rollosTable.id, normalCaja.id));
  assert.deepEqual(normalRestaurada, {
    estado: "DISPONIBLE",
    cantidadActual: "6.000",
  });

  const meteredProductoId = await makeProduct("100.00", "BOLSA", true);
  const meteredCaja = await makeRollo(meteredProductoId, ubicacionId, "7", "10");
  const primera = await sale({
    ubicacionId,
    productoId: meteredProductoId,
    cantidad: "3",
    precio: "15",
    tipo: "METREADO",
  });
  await sale({
    ubicacionId,
    productoId: meteredProductoId,
    cantidad: "4",
    precio: "15",
    tipo: "METREADO",
  });
  await db.transaction((tx) => cancelarTicket(tx, {
    ticketId: primera.id,
    usuarioId: USER_ID,
    autorizadoPor: USER_ID,
    motivo: "Cancelación de venta parcial",
    ip: "127.0.0.1",
  }, true));
  const [parcialRestaurada] = await db.select({
    estado: rollosTable.estado,
    cantidadActual: rollosTable.cantidadActual,
  }).from(rollosTable).where(eq(rollosTable.id, meteredCaja.id));
  assert.deepEqual(parcialRestaurada, {
    estado: "DISPONIBLE",
    cantidadActual: "3.000",
  });
});

await test("POS-BOLSA KILO sigue sin admitir venta METREADO", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct("100.00", "KILO", false);
  await assert.rejects(
    () => sale({
      ubicacionId,
      productoId,
      cantidad: "1",
      precio: "15",
      tipo: "METREADO",
    }),
    (error: unknown) =>
      error instanceof PosError && error.code === "METREADO_UNIT_REQUIRED",
  );
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
  const clientId = await makeClient("1000");
  const ticket = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "10",
    precio: "60",
    clienteId: clientId,
    documentoTipo: "TICKET",
  });
  assert.equal(ticket.esCredito, false);
  const session = await db.transaction((tx) =>
    abrirSesionCaja(tx, {
      ubicacionId,
      usuarioId: USER_ID,
      fondoInicial: "50",
      ip: "127.0.0.1",
    }),
  );
  createdSessionIds.push(session.id);
  const cobrado = await db.transaction((tx) =>
    cobrarTicket(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
        clienteId: clientId,
        pagos: [
          { formaPago: "EFECTIVO", importe: "100" },
          { formaPago: "TRANSFERENCIA", importe: "500" },
        ],
        ip: "127.0.0.1",
      },
      true,
    ),
  );
  assert.equal(cobrado?.documentoTipo, "TICKET");
  // Crédito se emite como NOTA desde el POS; nunca convierte un TICKET al
  // cobrar porque TICKET + CREDITO se rechaza explícitamente.
  assert.equal(cobrado?.convertidoANotaPorCobro, false);
  const persisted = await buildTicketDetail(db, ticket.id, true);
  assert.equal(persisted?.documentoTipo, "TICKET");
  assert.equal(persisted?.convertidoANotaPorCobro, false);
  const creditRoll = await makeRollo(productoId, ubicacionId, "5", "40");
  const note = await sale({ ubicacionId, productoId, rolloId: creditRoll.id, cantidad: "5", precio: "60", clienteId: clientId, credito: true });
  await db.transaction((tx) => autorizarNota(tx, { ticketId: note.id, sesionCajaId: session.id, usuarioId: USER_ID, ip: "127.0.0.1" }, true));
  const [balance] = await db
    .select({
      saldo: sql<string>`COALESCE(SUM(${movimientosCreditoTable.importe}), 0)::text`,
    })
    .from(movimientosCreditoTable)
    .where(eq(movimientosCreditoTable.clienteId, clientId));
  assert.equal(balance!.saldo, "300.00");
  const notifications = await db
    .select()
    .from(notificacionesCreditoTable)
    .where(eq(notificacionesCreditoTable.ticketId, note.id));
  assert.equal(notifications.length, 1, "la autorización de la Nota crea una notificación");
  const [notification] = notifications;
  assert.equal(notification?.clienteId, clientId);
  assert.equal(notification?.folio, note.folio);
  assert.equal(notification?.importe, "300.00");
  assert.equal(notification?.diasPlazo, 30);
  assert.match(notification?.fechaVencimiento ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(notification?.tiendaId, ubicacionId);
  assert.equal(notification?.leidaAt, null);
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

await test("POS-05B crédito concurrente reserva el límite al autorizar", async () => {
  const firstLocationId = await makeLocation();
  const secondLocationId = await makeLocation();
  const firstProductId = await makeProduct();
  const secondProductId = await makeProduct();
  const firstRoll = await makeRollo(firstProductId, firstLocationId, "10", "20");
  const secondRoll = await makeRollo(secondProductId, secondLocationId, "10", "20");
  const clientId = await makeClient("500");
  const notes = await Promise.all([
    sale({ ubicacionId: firstLocationId, productoId: firstProductId, rolloId: firstRoll.id, cantidad: "10", precio: "40", clienteId: clientId, credito: true }),
    sale({ ubicacionId: secondLocationId, productoId: secondProductId, rolloId: secondRoll.id, cantidad: "10", precio: "40", clienteId: clientId, credito: true }),
  ]);

  assert.equal(notes.length, 2, "dos notas pendientes pueden crearse");
  const sessions = await Promise.all([firstLocationId, secondLocationId].map((ubicacionId) =>
    db.transaction((tx) => abrirSesionCaja(tx, { ubicacionId, usuarioId: USER_ID, fondoInicial: "0", ip: "127.0.0.1" }))));
  createdSessionIds.push(...sessions.map((session) => session.id));
  const results = await Promise.allSettled(notes.map((note, index) =>
    db.transaction((tx) => autorizarNota(tx, { ticketId: note.id, sesionCajaId: sessions[index]!.id, usuarioId: USER_ID, ip: "127.0.0.1" }, true))));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.ok(rejected);
  assert.ok(
    rejected.reason instanceof PosError &&
      rejected.reason.code === "CREDIT_LIMIT_EXCEEDED",
  );
  const [reservation] = await db
    .select({
      reservado: sql<string>`COALESCE(SUM(${ticketsTable.total}), 0)::text`,
    })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.clienteId, clientId), eq(ticketsTable.autorizacionEstado, "AUTORIZADA")));
  assert.equal(reservation!.reservado, "400.00");
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
            ip: "127.0.0.1",
          },
          true,
        ),
      ),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "TICKET_CREDIT_PAYMENT_FORBIDDEN",
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
  const clientId = await makeClient("500");
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
  const rolloNota = await makeRollo(productoId, ubicacionId, "1", "20");
  const notaAutorizada = await sale({
    ubicacionId, productoId, rolloId: rolloNota.id, cantidad: "1", precio: "50",
    clienteId: clientId, credito: true,
  });
  await db.transaction((tx) =>
    autorizarNota(tx, {
      ticketId: notaAutorizada.id, sesionCajaId: session.id,
      usuarioId: USER_ID, ip: "127.0.0.1",
    }, true),
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
  assert.equal(
    lista.some((ticket) => ticket.id === notaAutorizada.id),
    false,
    "la Nota autorizada no vuelve a la cola pendiente aunque cobrado siga en falso",
  );
  assert.deepEqual(
    corte?.pendientes.map((ticket) => ticket.ticketId),
    esperados,
  );
  assert.deepEqual(
    ticketsCaja.map((ticket) => ticket.id),
    [anterior.id, actual.id, notaAutorizada.id, cobrado.id],
  );
  assert.deepEqual(
    ticketsCaja.find((ticket) => ticket.id === cobrado.id)?.formasPago,
    ["EFECTIVO"],
  );
});

await test("POS-06 crédito sobre límite se rechaza sin override", async () => {
  const ubicacionId = await makeLocation();
  const productoId = await makeProduct();
  const rollo = await makeRollo(productoId, ubicacionId, "2", "20");
  const clientId = await makeClient("10");
  const note = await sale({
    ubicacionId,
    productoId,
    rolloId: rollo.id,
    cantidad: "2",
    precio: "50",
    clienteId: clientId,
    credito: true,
  });
  assert.equal(note.autorizacionEstado, "PENDIENTE");
  const session = await db.transaction((tx) => abrirSesionCaja(tx, { ubicacionId, usuarioId: USER_ID, fondoInicial: "0", ip: "127.0.0.1" }));
  createdSessionIds.push(session.id);
  await assert.rejects(
    () => db.transaction((tx) => autorizarNota(tx, { ticketId: note.id, sesionCajaId: session.id, usuarioId: USER_ID, ip: "127.0.0.1" }, true)),
    (error: unknown) =>
      error instanceof PosError &&
      error.code === "CREDIT_LIMIT_EXCEEDED" &&
      error.message.includes("El límite se rebasa por $90.00.") &&
      error.message.includes("Un ADMIN debe subir el límite del cliente."),
  );
});

await test("POS-07 cancelación conserva evidencia de autorización y revierte crédito", async () => {
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
    credito: true,
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
    autorizarNota(
      tx,
      {
        ticketId: ticket.id,
        sesionCajaId: session.id,
        usuarioId: USER_ID,
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
  assert.equal(payments.length, 0, "una Nota autorizada nunca crea ticket_pagos");
  const autorizaciones = await db
    .select()
    .from(autorizacionesNotaTable)
    .where(eq(autorizacionesNotaTable.ticketId, ticket.id));
  assert.equal(autorizaciones.length, 1, "la evidencia de autorización permanece");
  const ledger = await db
    .select()
    .from(movimientosCreditoTable)
    .where(eq(movimientosCreditoTable.ticketId, ticket.id));
  assert.deepEqual(ledger.map((movement) => movement.tipo).sort(), [
    "REVERSO",
    "VENTA_CREDITO",
  ]);
  const directCharges = ledger.filter((movement) => movement.tipo === "VENTA_CREDITO");
  const reversals = ledger.filter((movement) => movement.tipo === "REVERSO");
  assert.equal(directCharges.length, 1, "la Nota conserva un único cargo directo");
  assert.equal(reversals.length, 1, "la cancelación agrega un único reverso");
  assert.equal(reversals[0]?.importe, "-150.00");
  assert.equal(
    reversals[0]?.movimientoOrigenId,
    directCharges[0]?.id,
    "el reverso queda ligado al cargo autorizado exacto",
  );
  assert.equal(
    ledger.reduce((sum, movement) => sum + Number(movement.importe), 0),
    0,
  );
  const [resolvedCreditNotification] = await db
    .select({ leidaAt: notificacionesCreditoTable.leidaAt })
    .from(notificacionesCreditoTable)
    .where(eq(notificacionesCreditoTable.ticketId, ticket.id))
    .limit(1);
  assert.ok(
    resolvedCreditNotification?.leidaAt,
    "la cancelación conserva pero resuelve la notificación de crédito",
  );
  const corte = await buildCorteCaja(db, session.id);
  assert.ok(corte);
  assert.equal(corte.ticketsCancelados, 0);
  assert.equal(corte.ticketsCobrados, 0);
  assert.equal(corte.totalCobrado, "0.00");
  assert.equal(corte.efectivoEsperado, "0.00");
  assert.equal(corte.cancelaciones.length, 1);
  const [cancellationAuthor] = await db
    .select({ nombre: usuariosTable.nombre })
    .from(usuariosTable)
    .where(eq(usuariosTable.id, USER_ID))
    .limit(1);
  assert.deepEqual(
    {
      ticketId: corte.cancelaciones[0]?.ticketId,
      folio: corte.cancelaciones[0]?.folio,
      importe: corte.cancelaciones[0]?.importe,
      motivo: corte.cancelaciones[0]?.motivo,
      autor: corte.cancelaciones[0]?.autor,
    },
    {
      ticketId: ticket.id,
      folio: ticket.folio,
      importe: "150.00",
      motivo: "Prueba de devolución completa",
      autor: cancellationAuthor?.nombre,
    },
  );
  assert.match(corte.cancelaciones[0]?.canceladoAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
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

process.stdout.write(`\nPOS/caja: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
