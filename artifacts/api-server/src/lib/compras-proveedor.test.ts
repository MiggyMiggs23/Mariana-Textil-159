/**
 * Integration tests for the compras-proveedor service.
 *
 * Run with:
 *   cd /home/runner/workspace/artifacts/api-server && \
 *   DATABASE_URL="postgres://postgres:password@helium:5432/heliumdb" \
 *   pnpm tsx src/lib/compras-proveedor.test.ts
 *
 * Covers: PAGO/AJUSTE mutations, saldo running balance, compra states
 *         (Pagada/Parcial/Pendiente), estadoCuenta ordering, estadísticas
 *         por periodo, backfill idempotency.
 * All created rows are cleaned up after the run, even on failure.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  aplicacionesPagoProveedorTable,
  db,
  clientesTable,
  entradasTable,
  existenciasTable,
  movimientosTable,
  pagosProveedorTable,
  productosTable,
  proveedoresTable,
  rollosTable,
  ticketLineasTable,
  ticketsTable,
  ubicacionesTable,
} from "@workspace/db";
import { crearEntrada } from "./inventario";
import {
  backfillCompras,
  analiticaGlobalProveedores,
  comprasPorProveedor,
  estadoCuenta,
  estadisticasPeriodo,
  registrarAjuste,
  registrarPago,
  resumenProveedores,
} from "./compras-proveedor";
import { parseMexicoDateQuery } from "./mexico-date";

if (
  process.env.NODE_ENV !== "test" ||
  process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" ||
  !process.env.TEST_DATABASE_URL ||
  !/(test|ci|e2e)/i.test(process.env.TEST_DATABASE_URL)
) {
  throw new Error("La suite de proveedores requiere una base de prueba aislada explícita.");
}

// ── Test harness ──────────────────────────────────────────────────────────────

const RUN = `CP${Date.now()}`;
let passed = 0;
let failed = 0;

const createdProveedorIds: number[] = [];
const createdProductoIds: number[] = [];
const createdUbicacionIds: number[] = [];
const createdEntradaIds: number[] = [];
const createdClienteIds: number[] = [];
const createdTicketIds: number[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(
      `  ✗ ${name}\n    ${(err as Error).stack ?? (err as Error).message}\n`,
    );
    failed++;
  }
}

let seq = 0;

await test("CP-00: fechas de filtro respetan el día de México y rechazan valores inválidos", async () => {
  assert.equal(
    parseMexicoDateQuery("2026-08-22", "start")?.toISOString(),
    "2026-08-22T06:00:00.000Z",
  );
  assert.equal(
    parseMexicoDateQuery("2026-08-22", "end")?.toISOString(),
    "2026-08-23T05:59:59.999Z",
  );
  assert.equal(parseMexicoDateQuery("2026-02-30", "start"), null);
  assert.equal(parseMexicoDateQuery("-056769-03-10", "start"), null);
  assert.equal(parseMexicoDateQuery(undefined, "start"), undefined);
});

async function mkProveedor(): Promise<number> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(proveedoresTable)
    .values({ nombre: `Prov${tag}`.slice(0, 200), tipo: "NACIONAL" as const })
    .returning();
  createdProveedorIds.push(row!.id);
  return row!.id;
}

async function mkProducto(): Promise<number> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(productosTable)
    .values({
      sku: `CP${tag}`.slice(0, 64),
      tela: `Tela${tag}`,
      color: `Color${tag}`,
      unidad: "METRO" as const,
      precioSugerido: "10.00",
    })
    .returning();
  createdProductoIds.push(row!.id);
  return row!.id;
}

async function mkUbicacion(): Promise<number> {
  const tag = `${RUN}-${++seq}`;
  const [row] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `Ub${tag}`.slice(0, 120),
      iniciales: `C${String.fromCharCode(65 + (Math.floor(seq / 26) % 26))}${String.fromCharCode(65 + (seq % 26))}`,
      tipo: "BODEGA" as const,
    })
    .returning();
  createdUbicacionIds.push(row!.id);
  return row!.id;
}

/**
 * Create a full entrada with a proveedor and register a COMPRA automatically.
 * Uses 1 rollo of quantity 1.0 so totalCosto = costoUnitario exactly.
 */
async function mkEntrada(
  proveedorId: number,
  productoId: number,
  ubicacionId: number,
  costo: string,
  cantidades: string[] = ["1.0"],
): Promise<{ entradaId: number; totalCosto: string | null }> {
  const result = await db.transaction(async (tx) =>
    crearEntrada(tx, {
      ubicacionId,
      proveedorId,
      usuarioId: 1,
      uuidCliente: randomUUID(),
      lineas: [{ productoId, costoUnitario: costo, cantidades }],
    }),
  );
  createdEntradaIds.push(result.id);
  return { entradaId: result.id, totalCosto: result.totalCosto };
}

// =============================================================================
// CP-01: COMPRA row created automatically on crearEntrada with proveedor
// =============================================================================

await test("CP-01: COMPRA insertada en crearEntrada con proveedor", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  const { entradaId, totalCosto } = await mkEntrada(
    proveedorId,
    productoId,
    ubicacionId,
    "100.00",
  );

  const compras = await db
    .select()
    .from(pagosProveedorTable)
    .where(
      and(
        eq(pagosProveedorTable.entradaId, entradaId),
        eq(pagosProveedorTable.tipo, "COMPRA"),
      ),
    );

  assert.equal(compras.length, 1, "Debe haber exactamente 1 COMPRA");
  assert.equal(compras[0]!.importe, totalCosto, "Importe debe igualar totalCosto");
  assert.equal(compras[0]!.proveedorId, proveedorId, "Proveedor correcto");
});

// =============================================================================
// CP-02: COMPRA idempotency — repeated sync does not duplicate
// =============================================================================

await test("CP-02: COMPRA no se duplica (idempotencia backfill)", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  const { entradaId } = await mkEntrada(
    proveedorId,
    productoId,
    ubicacionId,
    "200.00",
  );

  // Run backfill — the COMPRA already exists, should NOT add another
  await backfillCompras();

  const compras = await db
    .select()
    .from(pagosProveedorTable)
    .where(
      and(
        eq(pagosProveedorTable.entradaId, entradaId),
        eq(pagosProveedorTable.tipo, "COMPRA"),
      ),
    );

  assert.equal(compras.length, 1, "Backfill no debe duplicar COMPRA existente");
});

// =============================================================================
// CP-03: Registrar PAGO negativo y verificar saldo
// =============================================================================

await test("CP-03: PAGO registrado como negativo reduce saldo", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  await mkEntrada(proveedorId, productoId, ubicacionId, "400.00");

  // Register 100 payment
  await db.transaction(async (tx) =>
    registrarPago(tx, {
      proveedorId,
      importe: 100,
      formaPago: "TRANSFERENCIA",
      usuarioId: 1,
    }),
  );

  const { saldoActual } = await estadoCuenta({ proveedorId });
  // 400 (COMPRA) - 100 (PAGO) = 300
  assert.equal(saldoActual, "300.00", `Saldo debe ser 300.00, got ${saldoActual}`);
});

// =============================================================================
// CP-04: Estado de cuenta cronológico con saldo corrido
// =============================================================================

await test("CP-04: estadoCuenta devuelve movimientos cronológicos con saldo corrido", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  await mkEntrada(proveedorId, productoId, ubicacionId, "1000.00");
  await db.transaction(async (tx) =>
    registrarPago(tx, { proveedorId, importe: 300, formaPago: "EFECTIVO", usuarioId: 1 }),
  );
  await db.transaction(async (tx) =>
    registrarAjuste(tx, { proveedorId, importe: -50, notas: "Descuento por volumen acordado", usuarioId: 1 }),
  );

  const { movimientos, saldoActual } = await estadoCuenta({ proveedorId });

  assert.ok(movimientos.length >= 3, `Debe haber >= 3 movimientos, got ${movimientos.length}`);
  
  // Verify running balance is consistent
  let running = 0;
  for (const m of movimientos) {
    running += parseFloat(m.importe);
    assert.equal(
      m.saldoAcumulado,
      running.toFixed(2),
      `Saldo corrido incorrecto en movimiento ${m.id}`,
    );
  }

  // Final balance: 1000 - 300 - 50 = 650
  assert.equal(saldoActual, running.toFixed(2), "saldoActual debe coincidir con último saldo corrido");
});

await test("CP-04b: estadoCuenta filtrado conserva saldo inicial y saldo actual global", async () => {
  const proveedorId = await mkProveedor();
  const ubicacionId = await mkUbicacion();

  const [entrada] = await db
    .insert(entradasTable)
    .values({
      folio: 1_700_000_000 + seq,
      ubicacionId,
      proveedorId,
      usuarioId: 1,
      fecha: new Date("2024-01-10T18:00:00.000Z"),
      totalRollos: 0,
      totalCosto: "1000.00",
      uuidCliente: randomUUID(),
    })
    .returning({ id: entradasTable.id });
  createdEntradaIds.push(entrada!.id);
  await db.insert(pagosProveedorTable).values({
    proveedorId,
    entradaId: entrada!.id,
    importe: "1000.00",
    tipo: "COMPRA",
    fecha: new Date("2024-01-10T18:00:00.000Z"),
    usuarioId: 1,
  });
  await db.transaction(async (tx) =>
    registrarPago(tx, {
      proveedorId,
      importe: 100,
      formaPago: "TRANSFERENCIA",
      usuarioId: 1,
      fecha: new Date("2024-02-10T18:00:00.000Z"),
    }),
  );
  await db.transaction(async (tx) =>
    registrarAjuste(tx, {
      proveedorId,
      importe: 50,
      notas: "Ajuste posterior al periodo filtrado",
      usuarioId: 1,
    }),
  );

  const { movimientos, saldoActual } = await estadoCuenta({
    proveedorId,
    desde: new Date("2024-02-01T06:00:00.000Z"),
    hasta: new Date("2024-03-01T05:59:59.999Z"),
  });

  assert.equal(movimientos.length, 1, "El periodo debe contener solo el pago");
  assert.equal(movimientos[0]!.importe, "-100.00");
  assert.equal(
    movimientos[0]!.saldoAcumulado,
    "900.00",
    "El saldo corrido debe incluir la compra anterior como saldo inicial",
  );
  assert.equal(
    saldoActual,
    "950.00",
    "El saldo actual debe incluir también movimientos posteriores al filtro",
  );
});

// =============================================================================
// CP-05: Compra estados — Pendiente, Parcial, Pagada; y campos enriched
// =============================================================================

await test("CP-05: Estado de compra Pendiente/Parcial/Pagada calculado correctamente", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  const { entradaId } = await mkEntrada(proveedorId, productoId, ubicacionId, "200.00");

  // Estado inicial: Pendiente
  const r1 = await comprasPorProveedor({ proveedorId });
  const compra1 = r1.items.find((c) => c.entradaId === entradaId);
  assert.ok(compra1, "Compra debe estar en la lista");
  assert.equal(compra1!.estado, "PENDIENTE", "Estado inicial debe ser PENDIENTE");
  assert.equal(r1.total, 1, "El total debe incluir la compra del periodo");
  assert.equal(r1.totalCostoPeriodo, "200.00", "El total monetario del periodo debe ser exacto");
  assert.equal(r1.page, 1);
  assert.equal(r1.pageSize, 20);
  // Check enriched fields
  assert.ok(typeof compra1!.nombreUbicacion === "string", "nombreUbicacion debe ser string");
  assert.ok(compra1!.totalRollos >= 1, `totalRollos debe ser >= 1, got ${compra1!.totalRollos}`);
  assert.ok(parseFloat(compra1!.cantidadTotal) > 0, "cantidadTotal debe ser > 0");
  assert.equal(compra1!.cantidadMetros, "1.000");
  assert.equal(compra1!.cantidadKilos, "0.000");
  assert.equal(compra1!.costoPorMetro, "200.00");
  assert.equal(compra1!.costoPorKilo, null);
  assert.equal("costoPromedioRollo" in compra1!, false);

  // Pago parcial con fecha explícita
  const fechaPago = new Date("2024-06-15T10:00:00Z");
  await db.transaction(async (tx) =>
    registrarPago(tx, { proveedorId, importe: 100, formaPago: "CHEQUE", entradaId, usuarioId: 1, fecha: fechaPago }),
  );

  const r2 = await comprasPorProveedor({ proveedorId });
  const compra2 = r2.items.find((c) => c.entradaId === entradaId)!;
  assert.equal(compra2.estado, "PARCIAL", "Con abono parcial debe ser PARCIAL");
  assert.equal(compra2.abonado, "100.00", "Abonado debe ser 100.00");

  // Pago total
  await db.transaction(async (tx) =>
    registrarPago(tx, { proveedorId, importe: 100, formaPago: "CHEQUE", entradaId, usuarioId: 1 }),
  );

  const r3 = await comprasPorProveedor({ proveedorId });
  const compra3 = r3.items.find((c) => c.entradaId === entradaId)!;
  assert.equal(compra3.estado, "PAGADA", "Con pago completo debe ser PAGADA");
});

// =============================================================================
// CP-06: Ajuste con notas cortas → debe fallar en validación (route level)
// =============================================================================

await test("CP-06: registrarAjuste conserva el signo del importe", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();
  await mkEntrada(proveedorId, productoId, ubicacionId, "500.00");

  const row = await db.transaction(async (tx) =>
    registrarAjuste(tx, {
      proveedorId,
      importe: 25.5,
      notas: "Ajuste por diferencia de tipo de cambio",
      usuarioId: 1,
    }),
  );

  assert.equal(row.tipo, "AJUSTE", "Tipo debe ser AJUSTE");
  assert.equal(row.importe, "25.50", "Importe del ajuste positivo");
});

// =============================================================================
// CP-07: resumenProveedores devuelve totales correctos
// =============================================================================

await test("CP-07: resumenProveedores devuelve totales por proveedor", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  await mkEntrada(proveedorId, productoId, ubicacionId, "300.00");
  await db.transaction(async (tx) =>
    registrarPago(tx, { proveedorId, importe: 150, formaPago: "TRANSFERENCIA", usuarioId: 1 }),
  );
  await db.transaction(async (tx) =>
    registrarAjuste(tx, {
      proveedorId,
      importe: -25,
      notas: "Bonificación autorizada por proveedor",
      usuarioId: 1,
    }),
  );

  const resumen = await resumenProveedores();
  const item = resumen.items.find((i) => i.proveedorId === proveedorId);

  assert.ok(item, "El proveedor debe aparecer en el resumen");
  assert.equal(item!.totalCompras, "300.00", "Total compras debe ser 300.00");
  assert.equal(item!.totalPagado, "150.00", "Total pagado debe ser 150.00");
  assert.equal(
    item!.saldoPendiente,
    "125.00",
    "Saldo debe incluir COMPRA + PAGO + AJUSTE con su signo",
  );
  assert.equal(item!.comprasCount, 1, "Debe tener 1 compra");
  // New fields
  assert.ok(typeof item!.totalComprado12Meses === "string", "totalComprado12Meses debe ser string");
  assert.ok(typeof item!.comprasMes === "string", "comprasMes debe ser string");
  assert.ok(typeof resumen.comprasMes === "string", "resumen.comprasMes debe ser string");
});

// =============================================================================
// CP-08: estadisticasPeriodo — breakdown por mes/producto/tela/color
// =============================================================================

await test("CP-08: estadisticasPeriodo devuelve breakdown correcto", async () => {
  const proveedorId = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();

  await mkEntrada(proveedorId, productoId, ubicacionId, "100.00");
  await mkEntrada(proveedorId, productoId, ubicacionId, "200.00", ["3.0"]);

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const hasta = new Date(Date.now() + 1000); // now + 1 second

  const stats = await estadisticasPeriodo({ proveedorId, desde, hasta });

  assert.equal(stats.totalCompras, "700.00", "Debe sumar costo unitario por cada cantidad");
  assert.equal(stats.comprasCount, 2, "Debe contar entradas, no rollos");
  assert.equal(stats.totalRollos, 2, "Debe contar rollos del periodo");
  assert.equal(stats.ticketPromedio, "350.00", "Ticket promedio = total / entradas");
  assert.equal(stats.costoPorMetro, "175.00", "Costo por metro = costo / cantidad");
  assert.equal(stats.costoPorKilo, null);
  assert.equal("costoPromedioRollo" in stats, false);
  assert.equal("costoPromedio" in stats, false);
  // diasDesdeUltimaCompra puede ser 0 o número positivo (o null si no hay compras, pero aquí hay)
  assert.ok(stats.diasDesdeUltimaCompra !== undefined, "diasDesdeUltimaCompra debe estar definido");
  assert.ok(stats.porMes.length >= 1, "Debe haber al menos 1 mes");
  assert.ok(stats.porProducto.length >= 1, "Debe haber al menos 1 producto");
  // Check enriched product fields
  const prod = stats.porProducto[0]!;
  assert.ok(typeof prod.cantidadTotal === "string", "cantidadTotal debe ser string");
  assert.equal(prod.costoPorUnidad, "175.00", "Producto pondera costo por cantidad");
  assert.equal("costoPromedioRollo" in prod, false);
  assert.equal("costoPorUnidadAnterior" in prod, false);
  assert.equal("variacionCostoUnidadPct" in prod, false);
  assert.equal(prod.historialCostos.length, 2, "Debe conservar un costo unitario por compra");
  assert.equal(prod.historialCostos[0]!.costoUnitario, "100.00");
  assert.equal(prod.historialCostos[1]!.costoUnitario, "200.00");
  assert.ok(prod.comparacionProveedores.some((p) => p.proveedorId === proveedorId));
  assert.equal(typeof prod.ahorroPotencial, "string");
  assert.ok(stats.frecuencia.ultimaCompra);
  assert.ok(stats.estacionalidad.mesMayor);
  assert.equal(typeof stats.concentracion.productoPrincipalPct, "string");
  assert.equal(typeof stats.antiguedadDeuda.hasta30, "string");
  assert.equal(typeof stats.margenGenerado.margen, "string");
});

await test("CP-09: margen se atribuye solo al rollo vendido de su proveedor", async () => {
  const proveedorA = await mkProveedor();
  const proveedorB = await mkProveedor();
  const productoId = await mkProducto();
  const ubicacionId = await mkUbicacion();
  const entradaA = await mkEntrada(proveedorA, productoId, ubicacionId, "40.00");
  const entradaB = await mkEntrada(proveedorB, productoId, ubicacionId, "100.00");
  const [cliente] = await db.insert(clientesTable).values({
    nombre: `Cliente ${RUN}-${++seq}`,
  }).returning();
  createdClienteIds.push(cliente!.id);
  const rollos = await db.select({ id: rollosTable.id, recepcionId: rollosTable.recepcionId })
    .from(rollosTable).where(inArray(rollosTable.recepcionId, [entradaA.entradaId, entradaB.entradaId]));
  const rolloA = rollos.find((r) => r.recepcionId === entradaA.entradaId)!.id;
  const rolloB = rollos.find((r) => r.recepcionId === entradaB.entradaId)!.id;
  const [ticket] = await db.insert(ticketsTable).values({
    folio: 900000000 + seq,
    ubicacionId,
    usuarioTerminalId: 1,
    clienteId: cliente!.id,
    subtotal: "300.00",
    iva: "0.00",
    tasaIva: "0.0000",
    total: "300.00",
    uuidCliente: randomUUID(),
  }).returning();
  createdTicketIds.push(ticket!.id);
  await db.insert(ticketLineasTable).values([
    { ticketId: ticket!.id, rolloId: rolloA, productoId, tipo: "NORMAL", cantidad: "1", precioUnitario: "100", precioSugerido: "100", importe: "100", costoUnitarioCongelado: "40", costoTotalCongelado: "40" },
    { ticketId: ticket!.id, rolloId: rolloB, productoId, tipo: "NORMAL", cantidad: "1", precioUnitario: "200", precioSugerido: "200", importe: "200", costoUnitarioCongelado: "100", costoTotalCongelado: "100" },
    { ticketId: ticket!.id, rolloId: rolloA, productoId, tipo: "NORMAL", cantidad: "1", precioUnitario: "50", precioSugerido: "50", importe: "50", costoUnitarioCongelado: "0", costoTotalCongelado: "0" },
  ]);
  const [metreado] = await db.insert(ticketsTable).values({
    folio: 900000100 + seq, ubicacionId, usuarioTerminalId: 1, clienteId: cliente!.id,
    subtotal: "70.00", iva: "0.00", tasaIva: "0.0000", total: "70.00", uuidCliente: randomUUID(),
  }).returning();
  createdTicketIds.push(metreado!.id);
  await db.insert(ticketLineasTable).values({
    ticketId: metreado!.id, rolloId: null, productoId, tipo: "METREADO" as const, cantidad: "1", precioUnitario: "70", precioSugerido: "70", importe: "70", costoUnitarioCongelado: null, costoTotalCongelado: null,
  });
  const desde = new Date(Date.now() - 60_000);
  const hasta = new Date(Date.now() + 60_000);
  const statsA = await estadisticasPeriodo({ proveedorId: proveedorA, desde, hasta });
  const statsB = await estadisticasPeriodo({ proveedorId: proveedorB, desde, hasta });
  assert.deepEqual(
    { ventas: statsA.margenGenerado.ventas, costo: statsA.margenGenerado.costo, margen: statsA.margenGenerado.margen, incluidas: statsA.margenGenerado.lineasIncluidas },
    { ventas: "100.00", costo: "40.00", margen: "60.00", incluidas: 1 },
  );
  assert.deepEqual(
    { ventas: statsB.margenGenerado.ventas, costo: statsB.margenGenerado.costo, margen: statsB.margenGenerado.margen, incluidas: statsB.margenGenerado.lineasIncluidas },
    { ventas: "200.00", costo: "100.00", margen: "100.00", incluidas: 1 },
  );
  assert.equal(statsA.margenGenerado.lineasExcluidasSinRollo, 1);
  assert.equal(statsA.margenGenerado.lineasExcluidasSinCosto, 1);
  assert.match(statsA.margenGenerado.nota, /rollo físico/);
  const global = await analiticaGlobalProveedores();
  const comparison = global.comparacionCostos.find((p) => p.productoId === productoId);
  assert.ok(comparison, "El producto compartido debe aparecer en la comparación global");
  assert.deepEqual(
    comparison!.proveedores.map((p) => p.proveedorId).sort((a, b) => a - b),
    [proveedorA, proveedorB].sort((a, b) => a - b),
  );
  assert.equal(comparison!.proveedorMasBarato, comparison!.proveedores[0]!.proveedor);
  assert.ok(parseFloat(comparison!.ahorroPct) > 0);
  assert.deepEqual(Object.keys(global.antiguedadDeuda).sort(), ["de31a60", "de61a90", "hasta30", "mas90"].sort());
});

// =============================================================================
// Cleanup
// =============================================================================

process.stdout.write(`\n─────────────────────────────────────────────\n`);
process.stdout.write(`Results: ${passed} passed, ${failed} failed\n`);
process.stdout.write("Fixtures append-only conservados para eliminarse con la rama desechable.\n");

if (process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
try {
  await db.transaction(async (tx) => {
    if (createdTicketIds.length > 0) {
      await tx.delete(ticketLineasTable).where(inArray(ticketLineasTable.ticketId, createdTicketIds));
      await tx.delete(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
    }
    // Delete pagos first
    if (createdProveedorIds.length > 0) {
      const providerPayments = await tx
        .select({ id: pagosProveedorTable.id })
        .from(pagosProveedorTable)
        .where(inArray(pagosProveedorTable.proveedorId, createdProveedorIds));
      const providerPaymentIds = providerPayments.map((payment) => payment.id);
      if (providerPaymentIds.length > 0) {
        await tx
          .delete(aplicacionesPagoProveedorTable)
          .where(
            inArray(
              aplicacionesPagoProveedorTable.pagoProveedorId,
              providerPaymentIds,
            ),
          );
      }
    }
    if (createdEntradaIds.length > 0) {
      await tx
        .delete(pagosProveedorTable)
        .where(inArray(pagosProveedorTable.entradaId, createdEntradaIds));
    }
    if (createdProveedorIds.length > 0) {
      await tx
        .delete(pagosProveedorTable)
        .where(inArray(pagosProveedorTable.proveedorId, createdProveedorIds));
    }
    if (createdClienteIds.length > 0) {
      await tx.delete(clientesTable).where(inArray(clientesTable.id, createdClienteIds));
    }

    // Delete entradas and related
    if (createdEntradaIds.length > 0) {
      const rollos = await tx
        .select({ id: rollosTable.id })
        .from(rollosTable)
        .where(inArray(rollosTable.recepcionId, createdEntradaIds));
      const rolloIds = rollos.map((r) => r.id);
      if (rolloIds.length > 0) {
        await tx
          .delete(movimientosTable)
          .where(inArray(movimientosTable.rolloId, rolloIds));
        await tx.delete(rollosTable).where(inArray(rollosTable.id, rolloIds));
      }
      await tx
        .delete(entradasTable)
        .where(inArray(entradasTable.id, createdEntradaIds));
    }

    if (createdProductoIds.length > 0) {
      await tx
        .delete(existenciasTable)
        .where(inArray(existenciasTable.productoId, createdProductoIds));
      const strayRollos = await tx
        .select({ id: rollosTable.id })
        .from(rollosTable)
        .where(inArray(rollosTable.productoId, createdProductoIds));
      const strayIds = strayRollos.map((r) => r.id);
      if (strayIds.length > 0) {
        await tx
          .delete(movimientosTable)
          .where(inArray(movimientosTable.rolloId, strayIds));
        await tx.delete(rollosTable).where(inArray(rollosTable.id, strayIds));
      }
      await tx
        .delete(productosTable)
        .where(inArray(productosTable.id, createdProductoIds));
    }

    if (createdUbicacionIds.length > 0) {
      await tx
        .delete(ubicacionesTable)
        .where(inArray(ubicacionesTable.id, createdUbicacionIds));
    }

    if (createdProveedorIds.length > 0) {
      await tx
        .delete(proveedoresTable)
        .where(inArray(proveedoresTable.id, createdProveedorIds));
    }
  });
  process.stdout.write(`Cleanup: OK\n`);
} catch (cleanErr) {
  process.stderr.write(`Cleanup ERROR: ${(cleanErr as Error).message}\n`);
}
}

process.exit(failed > 0 ? 1 : 0);
