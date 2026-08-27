/**
 * Compras-proveedor service for Mariana Textil.
 *
 * This module owns all reads and writes against pagos_proveedor. It exposes:
 *  - backfillCompras()      – idempotent sync of existing entradas → COMPRA rows
 *  - registrarPago()        – record a PAGO (negative importe)
 *  - registrarAjuste()      – record an AJUSTE (signed importe)
 *  - comprasPorProveedor()  – paginated list with Pagada/Parcial/Pendiente state
 *                             including nombreUbicacion, totalRollos, cantidadTotal
 *  - estadoCuenta()         – chronological ledger with running balance
 *  - resumenProveedores()   – aggregate dashboard across all suppliers
 *                             with comprasMes and totalComprado12Meses
 *  - estadisticasPeriodo()  – purchasing, cost, payment and margin analytics
 *  - analiticaGlobalProveedores() – Pareto, debt, monthly trend and rising costs
 *
 * Accounting rules:
 *   saldo = SUM(importe) per proveedor_id
 *   COMPRA  importe > 0   (generates debt)
 *   PAGO    importe < 0   (reduces debt, stored as negative)
 *   AJUSTE  signed        (±correction)
 *
 * All mutating functions accept a Drizzle transaction (`tx`) so callers can
 * compose them with other operations atomically.
 */

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import {
  aplicacionesPagoProveedorTable,
  auditoriaTable,
  db,
  pagosProveedorTable,
  type FormaPagoProveedor,
} from "@workspace/db";
import type { Tx } from "./inventario";
import { allocateCreditFifo, centsToMoney, moneyToCents } from "./credit-allocation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoCompra = "PAGADA" | "PARCIAL" | "PENDIENTE";

export type CompraConEstado = {
  entradaId: number;
  folio: number;
  fecha: string;
  totalCosto: string;
  abonado: string;
  saldoPendiente: string;
  estado: EstadoCompra;
  nombreUbicacion: string;
  totalRollos: number;
  cantidadTotal: string;
  cantidadMetros: string;
  cantidadKilos: string;
  costoMetros: string;
  costoKilos: string;
  costoPorMetro: string | null;
  costoPorKilo: string | null;
};

export type MovimientoLedger = {
  id: number;
  tipo: "COMPRA" | "PAGO" | "AJUSTE" | "REVERSO";
  importe: string;
  saldoAcumulado: string;
  fecha: string;
  entradaId: number | null;
  folio: number | null;
  formaPago: string | null;
  referencia: string | null;
  notas: string | null;
  usuarioId: number;
  createdAt: string;
};

export type ProveedorResumen = {
  proveedorId: number;
  nombre: string;
  tipo: string;
  activo: boolean;
  totalCompras: string;
  totalComprado12Meses: string;
  comprasMes: string;
  totalPagado: string;
  saldoPendiente: string;
  ultimaCompra: string | null;
  comprasCount: number;
};

export type ResumenGeneral = {
  totalProveedores: number;
  proveedoresConSaldo: number;
  totalDeuda: string;
  totalPagado: string;
  comprasMes: string;
  items: ProveedorResumen[];
};

export type EstadisticasPeriodo = {
  desde: string;
  hasta: string;
  totalCompras: string;
  comprasCount: number;
  totalRollos: number;
  costoPorMetro: string | null;
  costoPorKilo: string | null;
  ticketPromedio: string;
  diasDesdeUltimaCompra: number | null;
  ultimaCompra: string | null;
  frecuencia: { promedioDiasEntreCompras: string | null; ultimaCompra: string | null };
  estacionalidad: {
    mesMayor: { mes: string; total: string } | null;
    mesMenor: { mes: string; total: string } | null;
  };
  concentracion: { productoPrincipalPct: string; tresPrincipalesPct: string };
  productosExclusivos: Array<{ productoId: number; sku: string; tela: string; color: string }>;
  diasPromedioPago: string | null;
  antiguedadDeuda: { hasta30: string; de31a60: string; de61a90: string; mas90: string };
  margenGenerado: {
    ventas: string;
    costo: string;
    margen: string;
    margenPct: string | null;
    lineasIncluidas: number;
    lineasExcluidasSinRollo: number;
    lineasExcluidasSinCosto: number;
    nota: string;
  };
  porMes: Array<{
    mes: string; // YYYY-MM
    total: string;
    count: number;
  }>;
  porProducto: Array<{
    productoId: number;
    sku: string;
    tela: string;
    color: string;
    unidad: string;
    totalCosto: string;
    totalRollos: number;
    cantidadTotal: string;
    costoPorUnidad: string;
    historialCostos: Array<{ entradaId: number; fecha: string; cantidad: string; costoUnitario: string }>;
    comparacionProveedores: Array<{ proveedorId: number; proveedor: string; costoUnitario: string }>;
    proveedorMasBarato: string | null;
    ahorroPotencial: string;
  }>;
  porTela: Array<{ tela: string; totalCosto: string; rollosCount: number }>;
  porColor: Array<{ color: string; totalCosto: string; rollosCount: number }>;
};

export type AnaliticaGlobalProveedores = {
  pareto: Array<{ proveedorId: number; proveedor: string; total: string; porcentajeAcumulado: string }>;
  deuda: Array<{ proveedorId: number; proveedor: string; saldo: string }>;
  tendenciaMensual: Array<{ mes: string; total: string }>;
  costosAlAlza: Array<{
    productoId: number;
    sku: string;
    proveedor: string;
    costoAnterior: string;
    costoActual: string;
    variacionPct: string;
  }>;
  comparacionCostos: Array<{
    productoId: number;
    sku: string;
    unidad: string;
    proveedorMasBarato: string;
    costoMasBarato: string;
    costoMasCaro: string;
    ahorroPct: string;
    proveedores: Array<{ proveedorId: number; proveedor: string; costoUnitario: string }>;
  }>;
  antiguedadDeuda: {
    hasta30: string;
    de31a60: string;
    de61a90: string;
    mas90: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcEstadoCompra(
  totalCosto: number,
  abonado: number,
): EstadoCompra {
  if (abonado <= 0) return "PENDIENTE";
  if (abonado >= totalCosto - 0.005) return "PAGADA";
  return "PARCIAL";
}

/** Coerce a raw SQL date value (may be string or Date) to Date. */
function toDate(val: Date | string | null): Date | null {
  if (!val) return null;
  return val instanceof Date ? val : new Date(val as string);
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill / Sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Idempotent backfill: insert a COMPRA row for every entrada that has a
 * proveedor_id but does not yet have a COMPRA in pagos_proveedor.
 *
 * Safe to call repeatedly: the partial unique index on (entrada_id) WHERE
 * tipo='COMPRA' prevents duplicates; this function only inserts missing rows.
 *
 * Returns the number of rows inserted.
 */
export async function backfillCompras(): Promise<number> {
  // Find entradas with proveedor that have no COMPRA row yet
  const missing = await db.execute<{
    id: number;
    proveedor_id: number;
    total_costo: string;
    fecha: Date | string;
    usuario_id: number;
  }>(sql`
    SELECT e.id, e.proveedor_id, e.total_costo, e.fecha, e.usuario_id
    FROM entradas e
    WHERE e.proveedor_id IS NOT NULL
      AND e.total_costo IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pagos_proveedor pp
        WHERE pp.entrada_id = e.id AND pp.tipo = 'COMPRA'
      )
    ORDER BY e.fecha ASC
  `);

  const rows = missing.rows as Array<{
    id: number;
    proveedor_id: number;
    total_costo: string;
    fecha: Date | string;
    usuario_id: number;
  }>;

  if (rows.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const fecha = toDate(row.fecha)!;
      await tx
        .insert(pagosProveedorTable)
        .values({
          proveedorId: row.proveedor_id,
          entradaId: row.id,
          importe: row.total_costo,
          tipo: "COMPRA",
          fecha,
          usuarioId: row.usuario_id,
          notas: "Backfill automático desde entradas",
        })
        .onConflictDoNothing(); // partial unique index handles duplicates
    }
  });

  return rows.length;
}

/**
 * Sync a single entrada COMPRA in-transaction (called from crearEntrada).
 * Insert-only and idempotent via ON CONFLICT DO NOTHING on the partial index.
 */
export async function syncCompraEntrada(
  tx: Tx,
  opts: {
    proveedorId: number;
    entradaId: number;
    totalCosto: string;
    fecha: Date;
    usuarioId: number;
  },
): Promise<void> {
  const inserted = await tx
    .insert(pagosProveedorTable)
    .values({
      proveedorId: opts.proveedorId,
      entradaId: opts.entradaId,
      importe: opts.totalCosto,
      tipo: "COMPRA",
      fecha: opts.fecha,
      usuarioId: opts.usuarioId,
    })
    .onConflictDoNothing()
    .returning();
  const compra = inserted[0];
  if (compra) await aplicarCreditosProveedor(tx, opts.proveedorId, [compra.id]);
}

type AsignacionProveedor = {
  pagoProveedorId: number; compraProveedorId: number; importe: string;
  saldoAntes: string; saldoDespues: string;
};

async function aplicarCreditosProveedor(
  tx: Tx,
  proveedorId: number,
  compraIds?: number[],
): Promise<AsignacionProveedor[]> {
  const rows = await tx.execute<{
    id: number; tipo: "PAGO" | "COMPRA"; importe: string; fecha: Date | string;
    disponible: string; saldo: string;
  }>(sql`
    SELECT pp.id, pp.tipo, pp.importe, pp.fecha,
      CASE WHEN pp.tipo='PAGO' THEN -pp.importe-COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago_proveedor a JOIN pagos_proveedor source ON source.id=a.pago_proveedor_id WHERE a.pago_proveedor_id=pp.id AND NOT EXISTS (SELECT 1 FROM pagos_proveedor r WHERE r.movimiento_origen_id=source.id AND r.tipo='REVERSO')),0) ELSE 0 END::text disponible,
      CASE WHEN pp.tipo='COMPRA' THEN pp.importe-COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago_proveedor a JOIN pagos_proveedor source ON source.id=a.pago_proveedor_id WHERE a.compra_proveedor_id=pp.id AND NOT EXISTS (SELECT 1 FROM pagos_proveedor r WHERE r.movimiento_origen_id=source.id AND r.tipo='REVERSO')),0) ELSE 0 END::text saldo
    FROM pagos_proveedor pp WHERE pp.proveedor_id=${proveedorId}
      AND pp.tipo IN ('PAGO','COMPRA')
      ${compraIds ? sql`AND (pp.tipo='PAGO' OR pp.id = ANY(ARRAY[${sql.raw(compraIds.join(","))}]::int[]))` : sql``}
    ORDER BY pp.fecha, pp.id FOR UPDATE
  `);
  const sources = (rows.rows as any[]).filter((r) => r.tipo === "PAGO" && moneyToCents(r.disponible) > 0)
    .map((r) => ({ id: Number(r.id), availableCents: moneyToCents(r.disponible) }));
  const targets = (rows.rows as any[]).filter((r) => r.tipo === "COMPRA" && moneyToCents(r.saldo) > 0)
    .map((r) => ({ id: Number(r.id), balanceCents: moneyToCents(r.saldo), createdAt: toDate(r.fecha)! }));
  const result = allocateCreditFifo(sources, targets);
  const assignments: AsignacionProveedor[] = [];
  for (const a of result.allocations) {
    await tx.insert(aplicacionesPagoProveedorTable).values({
      pagoProveedorId: a.sourceId, compraProveedorId: a.targetId, importe: centsToMoney(a.appliedCents),
    });
    assignments.push({
      pagoProveedorId: a.sourceId, compraProveedorId: a.targetId, importe: centsToMoney(a.appliedCents),
      saldoAntes: centsToMoney(a.balanceBeforeCents), saldoDespues: centsToMoney(a.balanceAfterCents),
    });
  }
  return assignments;
}

export async function previewPagoProveedor(opts: {
  proveedorId: number; importe: number;
}): Promise<{ asignaciones: Array<AsignacionProveedor & { entradaId: number | null; folio: number | null; fecha: string; resultado: EstadoCompra }>; saldoAFavor: string }> {
  const rows = await db.execute<any>(sql`
    SELECT pp.id,pp.entrada_id,pp.fecha,pp.importe-COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago_proveedor a JOIN pagos_proveedor source ON source.id=a.pago_proveedor_id WHERE a.compra_proveedor_id=pp.id AND NOT EXISTS (SELECT 1 FROM pagos_proveedor r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=source.id)),0) saldo,e.folio
    FROM pagos_proveedor pp LEFT JOIN entradas e ON e.id=pp.entrada_id
    WHERE pp.proveedor_id=${opts.proveedorId} AND pp.tipo='COMPRA' ORDER BY pp.fecha,pp.id`);
  const targets = rows.rows.filter((r: any) => moneyToCents(r.saldo) > 0)
    .map((r: any) => ({ id: Number(r.id), balanceCents: moneyToCents(r.saldo), createdAt: toDate(r.fecha)! }));
  const allocated = allocateCreditFifo([{ id: 0, availableCents: moneyToCents(opts.importe) }], targets);
  return {
    asignaciones: allocated.allocations.map((a) => {
      const row = rows.rows.find((r: any) => Number(r.id) === a.targetId)!;
      return { ...a, pagoProveedorId: 0, compraProveedorId: a.targetId, importe: centsToMoney(a.appliedCents),
        saldoAntes: centsToMoney(a.balanceBeforeCents), saldoDespues: centsToMoney(a.balanceAfterCents),
        entradaId: row.entrada_id == null ? null : Number(row.entrada_id), folio: row.folio == null ? null : Number(row.folio),
        fecha: toDate(row.fecha)!.toISOString(), resultado: a.balanceAfterCents === 0 ? "PAGADA" : "PARCIAL" };
    }),
    saldoAFavor: centsToMoney(allocated.remainingCents),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a PAGO (payment) for a supplier.
 * importe must be positive (stored as negative internally).
 * fecha defaults to now if not provided.
 */
export async function registrarPago(
  tx: Tx,
  opts: {
    proveedorId: number;
    importe: number; // positive from caller
    formaPago: FormaPagoProveedor;
    fecha?: Date | null; // defaults to now
    referencia?: string | null;
    notas?: string | null;
    /** Deprecated compatibility input; deliberately ignored (FIFO is mandatory). */
    entradaId?: number | null;
    usuarioId: number;
    ip?: string | null;
  },
): Promise<{ pago: typeof pagosProveedorTable.$inferSelect; asignaciones: AsignacionProveedor[]; saldoAFavor: string }> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${opts.proveedorId})`);
  const fecha = opts.fecha ?? new Date();
  const [row] = await tx
    .insert(pagosProveedorTable)
    .values({
      proveedorId: opts.proveedorId,
      entradaId: null,
      importe: (-Math.abs(opts.importe)).toFixed(2),
      tipo: "PAGO",
      formaPago: opts.formaPago,
      referencia: opts.referencia ?? null,
      fecha,
      usuarioId: opts.usuarioId,
      notas: opts.notas ?? null,
    })
    .returning();

  const asignaciones = await aplicarCreditosProveedor(tx, opts.proveedorId);
  await tx.insert(auditoriaTable).values({
    usuarioId: opts.usuarioId,
    accion: "CREAR",
    entidad: "pagos_proveedor",
    entidadId: String(row!.id),
    datosDespues: { ...row!, asignaciones } as Record<string, unknown>,
    ip: opts.ip ?? "desconocida",
  });

  const disponible = await tx.execute<{ disponible: string }>(sql`
    SELECT (-importe-COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago_proveedor a
      WHERE a.pago_proveedor_id=${row!.id}
        AND NOT EXISTS (SELECT 1 FROM pagos_proveedor r
          WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=a.pago_proveedor_id)),0))::text disponible
    FROM pagos_proveedor WHERE id=${row!.id}`);
  return { pago: row!, asignaciones, saldoAFavor: parseFloat(disponible.rows[0]?.disponible ?? "0").toFixed(2) };
}

/**
 * Register an AJUSTE (signed correction) for a supplier.
 * notas must be at least 10 chars. importe can be positive or negative.
 */
export async function registrarAjuste(
  tx: Tx,
  opts: {
    proveedorId: number;
    importe: number; // signed
    notas: string; // min 10 chars validated by caller
    usuarioId: number;
    ip?: string | null;
  },
): Promise<typeof pagosProveedorTable.$inferSelect> {
  const [row] = await tx
    .insert(pagosProveedorTable)
    .values({
      proveedorId: opts.proveedorId,
      importe: opts.importe.toFixed(2),
      tipo: "AJUSTE",
      fecha: new Date(),
      usuarioId: opts.usuarioId,
      notas: opts.notas,
    })
    .returning();

  await tx.insert(auditoriaTable).values({
    usuarioId: opts.usuarioId,
    accion: "CREAR",
    entidad: "pagos_proveedor",
    entidadId: String(row!.id),
    datosDespues: { ...row! } as Record<string, unknown>,
    ip: opts.ip ?? "desconocida",
  });

  return row!;
}

/** Insert the exact positive inverse of a supplier PAGO; applications stay immutable. */
export async function reversarPago(
  tx: Tx,
  opts: { proveedorId: number; pagoId: number; motivo: string; usuarioId: number; ip?: string | null },
): Promise<typeof pagosProveedorTable.$inferSelect> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${opts.proveedorId})`);
  const original = await tx.execute<any>(sql`
    SELECT * FROM pagos_proveedor
    WHERE id=${opts.pagoId} AND proveedor_id=${opts.proveedorId} AND tipo='PAGO'
    FOR UPDATE`);
  const pago = original.rows[0];
  if (!pago) throw new Error("PAYMENT_NOT_FOUND");
  const existing = await tx.execute(sql`
    SELECT id FROM pagos_proveedor WHERE movimiento_origen_id=${opts.pagoId} AND tipo='REVERSO'`);
  if (existing.rows[0]) throw new Error("PAYMENT_ALREADY_REVERSED");
  const [reverso] = await tx.insert(pagosProveedorTable).values({
    proveedorId: opts.proveedorId,
    importe: Math.abs(Number(pago.importe)).toFixed(2),
    tipo: "REVERSO",
    movimientoOrigenId: opts.pagoId,
    fecha: new Date(),
    usuarioId: opts.usuarioId,
    notas: opts.motivo,
  }).returning();
  await tx.insert(auditoriaTable).values({
    usuarioId: opts.usuarioId, accion: "REVERSAR_PAGO_PROVEEDOR",
    entidad: "pagos_proveedor", entidadId: String(reverso!.id),
    datosAntes: { pagoId: opts.pagoId, importe: pago.importe },
    datosDespues: { reversoId: reverso!.id, importe: reverso!.importe, motivo: opts.motivo },
    ip: opts.ip ?? "desconocida",
  });
  return reverso!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List compras (COMPRA rows joined to entradas) for a proveedor with optional
 * date range and estado filter. Includes abonado (sum of linked PAGOs) and
 * computed estado. Also enriches with nombreUbicacion, totalRollos, cantidadTotal.
 */
export async function comprasPorProveedor(opts: {
  proveedorId: number;
  desde?: Date | null;
  hasta?: Date | null;
  estado?: EstadoCompra | null;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: CompraConEstado[];
  total: number;
  totalCostoPeriodo: string;
  page: number;
  pageSize: number;
}> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  // Fetch COMPRA rows with joined entrada info (folio, ubicacionId)
  // We use a raw query to get everything in one pass
  const whereClauses: string[] = [
    `pp.proveedor_id = ${opts.proveedorId}`,
    `pp.tipo = 'COMPRA'`,
  ];
  if (opts.desde) whereClauses.push(`pp.fecha >= '${opts.desde.toISOString()}'`);
  if (opts.hasta) whereClauses.push(`pp.fecha <= '${opts.hasta.toISOString()}'`);

  const comprasRaw = await db.execute<{
    pp_id: number;
    entrada_id: number | null;
    importe: string;
    fecha: Date | string;
    folio: number | null;
    ubicacion_id: number | null;
    nombre_ubicacion: string | null;
    total_rollos: string | null;
    cantidad_total: string | null;
    cantidad_metros: string | null;
    cantidad_kilos: string | null;
    costo_metros: string | null;
    costo_kilos: string | null;
  }>(sql`
    SELECT
      pp.id AS pp_id,
      pp.entrada_id,
      pp.importe,
      pp.fecha,
      e.folio,
      e.ubicacion_id,
      u.nombre AS nombre_ubicacion,
      COUNT(ro.id)::text AS total_rollos,
      COALESCE(SUM(ro.cantidad_inicial)::text, '0.00') AS cantidad_total,
      COALESCE(SUM(ro.cantidad_inicial) FILTER (WHERE pr.unidad = 'METRO'), 0)::text AS cantidad_metros,
      COALESCE(SUM(ro.cantidad_inicial) FILTER (WHERE pr.unidad = 'KILO'), 0)::text AS cantidad_kilos,
      COALESCE(SUM(ro.costo_total) FILTER (WHERE pr.unidad = 'METRO'), 0)::text AS costo_metros,
      COALESCE(SUM(ro.costo_total) FILTER (WHERE pr.unidad = 'KILO'), 0)::text AS costo_kilos
    FROM pagos_proveedor pp
    LEFT JOIN entradas e ON e.id = pp.entrada_id
    LEFT JOIN ubicaciones u ON u.id = e.ubicacion_id
    LEFT JOIN rollos ro ON ro.recepcion_id = e.id
    LEFT JOIN productos pr ON pr.id = ro.producto_id
    WHERE pp.proveedor_id = ${opts.proveedorId}
      AND pp.tipo = 'COMPRA'
      ${opts.desde ? sql`AND pp.fecha >= ${opts.desde}` : sql``}
      ${opts.hasta ? sql`AND pp.fecha <= ${opts.hasta}` : sql``}
    GROUP BY pp.id, pp.entrada_id, pp.importe, pp.fecha, e.folio, e.ubicacion_id, u.nombre
    ORDER BY pp.fecha DESC, pp.id DESC
  `);

  const compras = comprasRaw.rows as Array<{
    pp_id: number;
    entrada_id: number | null;
    importe: string;
    fecha: Date | string;
    folio: number | null;
    ubicacion_id: number | null;
    nombre_ubicacion: string | null;
    total_rollos: string | null;
    cantidad_total: string | null;
    cantidad_metros: string | null;
    cantidad_kilos: string | null;
    costo_metros: string | null;
    costo_kilos: string | null;
  }>;

  if (compras.length === 0) {
    return {
      items: [],
      total: 0,
      totalCostoPeriodo: "0.00",
      page,
      pageSize,
    };
  }

  // Active immutable applications are the sole allocation source.
  const entradaIds = compras
    .map((c) => c.entrada_id)
    .filter((id): id is number => id != null);

  const pagoSums = new Map<number, number>();
  if (entradaIds.length > 0) {
    const pagoRows = await db.execute<{
      entrada_id: number;
      abonado: string;
    }>(sql`
      SELECT c.entrada_id,
        COALESCE(SUM(a.importe),0)::text AS abonado
      FROM pagos_proveedor c
       LEFT JOIN aplicaciones_pago_proveedor a ON a.compra_proveedor_id=c.id
         AND NOT EXISTS (SELECT 1 FROM pagos_proveedor r WHERE r.movimiento_origen_id=a.pago_proveedor_id AND r.tipo='REVERSO')
      WHERE c.proveedor_id = ${opts.proveedorId} AND c.tipo='COMPRA'
        AND c.entrada_id = ANY(ARRAY[${sql.raw(entradaIds.join(","))}]::int[])
      GROUP BY c.id,c.entrada_id
    `);
    for (const r of pagoRows.rows as Array<{ entrada_id: number; abonado: string }>) {
      pagoSums.set(r.entrada_id, parseFloat(r.abonado));
    }
  }

  // Build enriched items
  const all: CompraConEstado[] = compras.map((c) => {
    const totalCosto = parseFloat(c.importe);
    const abonado = c.entrada_id ? (pagoSums.get(c.entrada_id) ?? 0) : 0;
    const saldo = Math.max(0, totalCosto - abonado);
    const estado = calcEstadoCompra(totalCosto, abonado);
    const fechaDate = toDate(c.fecha)!;
    const cantidadMetros = parseFloat(c.cantidad_metros ?? "0");
    const cantidadKilos = parseFloat(c.cantidad_kilos ?? "0");
    const costoMetros = parseFloat(c.costo_metros ?? "0");
    const costoKilos = parseFloat(c.costo_kilos ?? "0");
    const totalRollos = parseInt(c.total_rollos ?? "0", 10);
    return {
      entradaId: c.entrada_id ?? 0,
      folio: c.folio ?? 0,
      fecha: fechaDate.toISOString(),
      totalCosto: totalCosto.toFixed(2),
      abonado: abonado.toFixed(2),
      saldoPendiente: saldo.toFixed(2),
      estado,
      nombreUbicacion: c.nombre_ubicacion ?? "",
      totalRollos,
      cantidadTotal: parseFloat(c.cantidad_total ?? "0").toFixed(2),
      cantidadMetros: cantidadMetros.toFixed(3),
      cantidadKilos: cantidadKilos.toFixed(3),
      costoMetros: costoMetros.toFixed(2),
      costoKilos: costoKilos.toFixed(2),
      costoPorMetro:
        cantidadMetros > 0 ? (costoMetros / cantidadMetros).toFixed(2) : null,
      costoPorKilo:
        cantidadKilos > 0 ? (costoKilos / cantidadKilos).toFixed(2) : null,
    };
  });

  // Filter by estado if requested
  const filtered = opts.estado ? all.filter((c) => c.estado === opts.estado) : all;
  const total = filtered.length;
  const totalCostoPeriodo = filtered
    .reduce((sum, compra) => sum + parseFloat(compra.totalCosto), 0)
    .toFixed(2);
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return { items, total, totalCostoPeriodo, page, pageSize };
}

/**
 * Full chronological ledger with running balance for a supplier.
 * All rows (COMPRA, PAGO, AJUSTE) ordered by fecha ASC for account statement.
 */
export async function estadoCuenta(opts: {
  proveedorId: number;
  desde?: Date | null;
  hasta?: Date | null;
}): Promise<{ movimientos: MovimientoLedger[]; saldoActual: string }> {
  const [balances] = await db
    .select({
      saldoActual: sql<string>`
        COALESCE(SUM(${pagosProveedorTable.importe}), 0)::text
      `,
      saldoInicial: opts.desde
        ? sql<string>`
            COALESCE(
              SUM(
                CASE
                  WHEN ${pagosProveedorTable.fecha} < ${opts.desde}
                  THEN ${pagosProveedorTable.importe}
                  ELSE 0
                END
              ),
              0
            )::text
          `
        : sql<string>`'0'::text`,
    })
    .from(pagosProveedorTable)
    .where(eq(pagosProveedorTable.proveedorId, opts.proveedorId));

  const conditions = [
    eq(pagosProveedorTable.proveedorId, opts.proveedorId),
  ];
  if (opts.desde)
    conditions.push(gte(pagosProveedorTable.fecha, opts.desde));
  if (opts.hasta)
    conditions.push(lte(pagosProveedorTable.fecha, opts.hasta));

  const rows = await db
    .select()
    .from(pagosProveedorTable)
    .where(and(...conditions))
    .orderBy(asc(pagosProveedorTable.fecha), asc(pagosProveedorTable.id));

  // Fetch folio map for COMPRA entries
  const entradaIds = rows
    .filter((r) => r.entradaId != null)
    .map((r) => r.entradaId as number);

  const folioMap = new Map<number, number>();
  if (entradaIds.length > 0) {
    const fRows = await db.execute<{ id: number; folio: number }>(sql`
      SELECT id, folio FROM entradas
      WHERE id = ANY(ARRAY[${sql.raw(entradaIds.join(","))}]::int[])
    `);
    for (const r of fRows.rows as Array<{ id: number; folio: number }>) {
      folioMap.set(r.id, r.folio);
    }
  }

  // Build the visible ledger from its opening balance. saldoActual remains the
  // all-time supplier balance even when the statement rows are date-filtered.
  let saldo = parseFloat(balances?.saldoInicial ?? "0");
  const movimientos: MovimientoLedger[] = rows.map((r) => {
    saldo += parseFloat(r.importe);
    return {
      id: r.id,
       tipo: r.tipo as "COMPRA" | "PAGO" | "AJUSTE" | "REVERSO",
      importe: r.importe,
      saldoAcumulado: saldo.toFixed(2),
      fecha: r.fecha.toISOString(),
      entradaId: r.entradaId ?? null,
      folio: r.entradaId ? (folioMap.get(r.entradaId) ?? null) : null,
      formaPago: r.formaPago ?? null,
      referencia: r.referencia ?? null,
      notas: r.notas ?? null,
      usuarioId: r.usuarioId,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return {
    movimientos,
    saldoActual: parseFloat(balances?.saldoActual ?? "0").toFixed(2),
  };
}

/**
 * Aggregated dashboard across all suppliers.
 * Includes totalCompras (all-time), totalComprado12Meses, and comprasMes.
 */
export async function resumenProveedores(): Promise<ResumenGeneral> {
  const now = new Date();
  const startOf12Months = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await db.execute<{
    proveedor_id: number;
    nombre: string;
    tipo: string;
    activo: boolean;
    total_compras: string;
    total_12m: string;
    total_mes: string;
    total_pagado: string;
    saldo_total: string;
    compras_count: string;
    ultima_compra: Date | string | null;
  }>(sql`
    SELECT
      p.id AS proveedor_id,
      p.nombre,
      p.tipo,
      p.activo,
      COALESCE(SUM(CASE WHEN pp.tipo = 'COMPRA' THEN pp.importe ELSE 0 END), 0)::text AS total_compras,
      COALESCE(SUM(CASE WHEN pp.tipo = 'COMPRA' AND pp.fecha >= ${startOf12Months} THEN pp.importe ELSE 0 END), 0)::text AS total_12m,
      COALESCE(SUM(CASE WHEN pp.tipo = 'COMPRA' AND pp.fecha >= ${startOfMonth} THEN pp.importe ELSE 0 END), 0)::text AS total_mes,
      COALESCE(ABS(SUM(CASE WHEN pp.tipo = 'PAGO' THEN pp.importe ELSE 0 END)), 0)::text AS total_pagado,
      COALESCE(SUM(pp.importe), 0)::text AS saldo_total,
      COUNT(CASE WHEN pp.tipo = 'COMPRA' THEN 1 END)::text AS compras_count,
      MAX(CASE WHEN pp.tipo = 'COMPRA' THEN pp.fecha END) AS ultima_compra
    FROM proveedores p
    LEFT JOIN pagos_proveedor pp ON pp.proveedor_id = p.id
    GROUP BY p.id, p.nombre, p.tipo, p.activo
    ORDER BY p.nombre
  `);

  const rows = agg.rows as Array<{
    proveedor_id: number;
    nombre: string;
    tipo: string;
    activo: boolean;
    total_compras: string;
    total_12m: string;
    total_mes: string;
    total_pagado: string;
    saldo_total: string;
    compras_count: string;
    ultima_compra: Date | string | null;
  }>;

  const items: ProveedorResumen[] = rows.map((r) => {
    const totalCompras = parseFloat(r.total_compras);
    const totalPagado = parseFloat(r.total_pagado);
    const saldo = parseFloat(r.saldo_total);
    const uc = toDate(r.ultima_compra);
    return {
      proveedorId: r.proveedor_id,
      nombre: r.nombre,
      tipo: r.tipo,
      activo: r.activo,
      totalCompras: totalCompras.toFixed(2),
      totalComprado12Meses: parseFloat(r.total_12m).toFixed(2),
      comprasMes: parseFloat(r.total_mes).toFixed(2),
      totalPagado: totalPagado.toFixed(2),
      saldoPendiente: saldo.toFixed(2),
      ultimaCompra: uc ? uc.toISOString() : null,
      comprasCount: parseInt(r.compras_count, 10),
    };
  });

  const totalDeuda = items.reduce(
    (acc, i) => acc + Math.max(0, parseFloat(i.saldoPendiente)),
    0,
  );
  const totalPagado = items.reduce(
    (acc, i) => acc + parseFloat(i.totalPagado),
    0,
  );
  const comprasMes = items.reduce(
    (acc, i) => acc + parseFloat(i.comprasMes),
    0,
  );
  const proveedoresConSaldo = items.filter(
    (i) => parseFloat(i.saldoPendiente) > 0.005,
  ).length;

  return {
    totalProveedores: items.length,
    proveedoresConSaldo,
    totalDeuda: totalDeuda.toFixed(2),
    totalPagado: totalPagado.toFixed(2),
    comprasMes: comprasMes.toFixed(2),
    items,
  };
}

/**
 * Detailed statistics for a supplier within a date range.
 * Includes per-month, per-product (with cost comparison), per-tela, per-color
 * breakdowns and cost trend vs. the immediately preceding equal-length period.
 * New: totalRollos, ticketPromedio, diasDesdeUltimaCompra.
 */
export async function estadisticasPeriodo(opts: {
  proveedorId: number;
  desde: Date;
  hasta: Date;
}): Promise<EstadisticasPeriodo> {
  const { proveedorId, desde, hasta } = opts;

  // Current period aggregate
  const currentAgg = await db.execute<{
    total: string;
    count: string;
    total_rollos: string;
    cantidad_metros: string;
    cantidad_kilos: string;
    costo_metros: string;
    costo_kilos: string;
    ultima: Date | string | null;
  }>(sql`
    WITH compras_periodo AS (
      SELECT pp.entrada_id, pp.importe, pp.fecha
      FROM pagos_proveedor pp
      WHERE pp.proveedor_id = ${proveedorId}
        AND pp.tipo = 'COMPRA'
        AND pp.fecha BETWEEN ${desde} AND ${hasta}
    )
    SELECT
      COALESCE(SUM(cp.importe), 0)::text AS total,
      COUNT(cp.entrada_id)::text AS count,
      (
        SELECT COUNT(ro.id)::text
        FROM compras_periodo cp_rollos
        JOIN rollos ro ON ro.recepcion_id = cp_rollos.entrada_id
      ) AS total_rollos,
      (
        SELECT COALESCE(SUM(ro.cantidad_inicial) FILTER (WHERE pr.unidad = 'METRO'), 0)::text
        FROM compras_periodo cp_m
        JOIN rollos ro ON ro.recepcion_id = cp_m.entrada_id
        JOIN productos pr ON pr.id = ro.producto_id
      ) AS cantidad_metros,
      (
        SELECT COALESCE(SUM(ro.cantidad_inicial) FILTER (WHERE pr.unidad = 'KILO'), 0)::text
        FROM compras_periodo cp_k
        JOIN rollos ro ON ro.recepcion_id = cp_k.entrada_id
        JOIN productos pr ON pr.id = ro.producto_id
      ) AS cantidad_kilos,
      (
        SELECT COALESCE(SUM(ro.costo_total) FILTER (WHERE pr.unidad = 'METRO'), 0)::text
        FROM compras_periodo cp_m
        JOIN rollos ro ON ro.recepcion_id = cp_m.entrada_id
        JOIN productos pr ON pr.id = ro.producto_id
      ) AS costo_metros,
      (
        SELECT COALESCE(SUM(ro.costo_total) FILTER (WHERE pr.unidad = 'KILO'), 0)::text
        FROM compras_periodo cp_k
        JOIN rollos ro ON ro.recepcion_id = cp_k.entrada_id
        JOIN productos pr ON pr.id = ro.producto_id
      ) AS costo_kilos,
      MAX(cp.fecha) AS ultima
    FROM compras_periodo cp
  `);

  const cur = (
    currentAgg.rows as Array<{
      total: string;
      count: string;
      total_rollos: string;
      cantidad_metros: string;
      cantidad_kilos: string;
      costo_metros: string;
      costo_kilos: string;
      ultima: Date | string | null;
    }>
  )[0]!;
  const totalCompras = parseFloat(cur.total);
  const comprasCount = parseInt(cur.count, 10);
  const totalRollos = parseInt(cur.total_rollos, 10);
  const cantidadMetros = parseFloat(cur.cantidad_metros);
  const cantidadKilos = parseFloat(cur.cantidad_kilos);
  const costoMetros = parseFloat(cur.costo_metros);
  const costoKilos = parseFloat(cur.costo_kilos);
  const ticketPromedio = comprasCount > 0 ? totalCompras / comprasCount : 0;
  const ultimaDate = toDate(cur.ultima);
  const diasDesdeUltimaCompra = ultimaDate
    ? Math.floor((Date.now() - ultimaDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Por mes
  const mesRows = await db.execute<{ mes: string; total: string; count: string }>(sql`
    SELECT
      TO_CHAR(pp.fecha, 'YYYY-MM') AS mes,
      SUM(pp.importe)::text AS total,
      COUNT(*)::text AS count
    FROM pagos_proveedor pp
    WHERE pp.proveedor_id = ${proveedorId}
      AND pp.tipo = 'COMPRA'
      AND pp.fecha BETWEEN ${desde} AND ${hasta}
    GROUP BY mes
    ORDER BY mes
  `);

  const porMes = (mesRows.rows as Array<{ mes: string; total: string; count: string }>).map(
    (r) => ({
      mes: r.mes,
      total: parseFloat(r.total).toFixed(2),
      count: parseInt(r.count, 10),
    }),
  );

  // Por producto – current period
  const prodRows = await db.execute<{
    producto_id: number;
    sku: string;
    tela: string;
    color: string;
    unidad: string;
    total_costo: string;
    total_rollos: string;
    cantidad_total: string;
  }>(sql`
    SELECT
      pr.id AS producto_id,
      pr.sku,
      pr.tela,
      pr.color,
      pr.unidad,
      SUM(ro.costo_total)::text AS total_costo,
      COUNT(ro.id)::text AS total_rollos,
      COALESCE(SUM(ro.cantidad_inicial)::text, '0.00') AS cantidad_total
    FROM pagos_proveedor pp
    JOIN entradas e ON e.id = pp.entrada_id
    JOIN rollos ro ON ro.recepcion_id = e.id
    JOIN productos pr ON pr.id = ro.producto_id
    WHERE pp.proveedor_id = ${proveedorId}
      AND pp.tipo = 'COMPRA'
      AND pp.fecha BETWEEN ${desde} AND ${hasta}
    GROUP BY pr.id, pr.sku, pr.tela, pr.color, pr.unidad
    ORDER BY total_costo DESC
  `);

  const [historyResult, comparisonResult] = await Promise.all([
    db.execute(sql`
      SELECT ro.producto_id, e.id AS entrada_id, pp.fecha,
        SUM(ro.cantidad_inicial)::text AS cantidad,
        (SUM(ro.costo_total) / NULLIF(SUM(ro.cantidad_inicial), 0))::text AS costo_unitario
      FROM pagos_proveedor pp
      JOIN entradas e ON e.id = pp.entrada_id
      JOIN rollos ro ON ro.recepcion_id = e.id
      WHERE pp.proveedor_id = ${proveedorId} AND pp.tipo = 'COMPRA'
        AND pp.fecha BETWEEN ${desde} AND ${hasta}
      GROUP BY ro.producto_id, e.id, pp.fecha ORDER BY pp.fecha
    `),
    db.execute(sql`
      SELECT ro.producto_id, p.id AS proveedor_id, p.nombre AS proveedor,
        (SUM(ro.costo_total) / NULLIF(SUM(ro.cantidad_inicial), 0))::text AS costo_unitario
      FROM pagos_proveedor pp
      JOIN proveedores p ON p.id = pp.proveedor_id
      JOIN rollos ro ON ro.recepcion_id = pp.entrada_id
      WHERE pp.tipo = 'COMPRA' AND pp.fecha BETWEEN ${desde} AND ${hasta}
      GROUP BY ro.producto_id, p.id, p.nombre
      ORDER BY ro.producto_id, (SUM(ro.costo_total) / NULLIF(SUM(ro.cantidad_inicial), 0))
    `),
  ]);
  type HistoryRow = { producto_id: number; entrada_id: number; fecha: Date | string; cantidad: string; costo_unitario: string };
  type ComparisonRow = { producto_id: number; proveedor_id: number; proveedor: string; costo_unitario: string };
  const historyRows = historyResult.rows as HistoryRow[];
  const comparisonRows = comparisonResult.rows as ComparisonRow[];

  const porProducto = (
    prodRows.rows as Array<{
      producto_id: number;
      sku: string;
      tela: string;
      color: string;
      unidad: string;
      total_costo: string;
      total_rollos: string;
      cantidad_total: string;
    }>
  ).map((r) => {
    const totalC = parseFloat(r.total_costo);
    const rollos = parseInt(r.total_rollos, 10);
    const cantidad = parseFloat(r.cantidad_total);
    const costoPromedioActual = cantidad > 0 ? totalC / cantidad : 0;
    const historialCostos = historyRows.filter((h) => h.producto_id === r.producto_id).map((h) => ({
      entradaId: h.entrada_id,
      fecha: toDate(h.fecha)!.toISOString(),
      cantidad: parseFloat(h.cantidad).toFixed(3),
      costoUnitario: parseFloat(h.costo_unitario).toFixed(2),
    }));
    const comparacionProveedores = comparisonRows.filter((c) => c.producto_id === r.producto_id).map((c) => ({
      proveedorId: c.proveedor_id,
      proveedor: c.proveedor,
      costoUnitario: parseFloat(c.costo_unitario).toFixed(2),
    }));
    const cheapest = comparacionProveedores[0] ?? null;
    const ahorro = cheapest ? Math.max(0, costoPromedioActual - parseFloat(cheapest.costoUnitario)) * cantidad : 0;
    return {
      productoId: r.producto_id,
      sku: r.sku,
      tela: r.tela,
      color: r.color,
      unidad: r.unidad,
      totalCosto: totalC.toFixed(2),
      totalRollos: rollos,
      cantidadTotal: parseFloat(r.cantidad_total).toFixed(2),
      costoPorUnidad: costoPromedioActual.toFixed(2),
      historialCostos,
      comparacionProveedores,
      proveedorMasBarato: cheapest?.proveedor ?? null,
      ahorroPotencial: ahorro.toFixed(2),
    };
  });

  // Por tela
  const telaRows = await db.execute<{
    tela: string;
    total_costo: string;
    rollos_count: string;
  }>(sql`
    SELECT
      pr.tela,
      SUM(ro.costo_total)::text AS total_costo,
      COUNT(ro.id)::text AS rollos_count
    FROM pagos_proveedor pp
    JOIN entradas e ON e.id = pp.entrada_id
    JOIN rollos ro ON ro.recepcion_id = e.id
    JOIN productos pr ON pr.id = ro.producto_id
    WHERE pp.proveedor_id = ${proveedorId}
      AND pp.tipo = 'COMPRA'
      AND pp.fecha BETWEEN ${desde} AND ${hasta}
    GROUP BY pr.tela
    ORDER BY total_costo DESC
  `);

  const porTela = (
    telaRows.rows as Array<{
      tela: string;
      total_costo: string;
      rollos_count: string;
    }>
  ).map((r) => ({
    tela: r.tela,
    totalCosto: parseFloat(r.total_costo).toFixed(2),
    rollosCount: parseInt(r.rollos_count, 10),
  }));

  // Por color
  const colorRows = await db.execute<{
    color: string;
    total_costo: string;
    rollos_count: string;
  }>(sql`
    SELECT
      pr.color,
      SUM(ro.costo_total)::text AS total_costo,
      COUNT(ro.id)::text AS rollos_count
    FROM pagos_proveedor pp
    JOIN entradas e ON e.id = pp.entrada_id
    JOIN rollos ro ON ro.recepcion_id = e.id
    JOIN productos pr ON pr.id = ro.producto_id
    WHERE pp.proveedor_id = ${proveedorId}
      AND pp.tipo = 'COMPRA'
      AND pp.fecha BETWEEN ${desde} AND ${hasta}
    GROUP BY pr.color
    ORDER BY total_costo DESC
  `);

  const porColor = (
    colorRows.rows as Array<{
      color: string;
      total_costo: string;
      rollos_count: string;
    }>
  ).map((r) => ({
    color: r.color,
    totalCosto: parseFloat(r.total_costo).toFixed(2),
    rollosCount: parseInt(r.rollos_count, 10),
  }));

  const extras = await db.execute(sql`
    WITH compras AS (
      SELECT pp.id, pp.entrada_id, pp.fecha, pp.importe
      FROM pagos_proveedor pp WHERE pp.proveedor_id = ${proveedorId} AND pp.tipo = 'COMPRA'
    ), deudas AS (
      SELECT c.id, c.entrada_id, c.fecha,
        GREATEST(0, c.importe - COALESCE(SUM(a.importe) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM pagos_proveedor r
            WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=a.pago_proveedor_id)
        ), 0)) AS saldo
      FROM compras c LEFT JOIN aplicaciones_pago_proveedor a ON a.compra_proveedor_id=c.id
      GROUP BY c.id, c.entrada_id, c.fecha, c.importe
    ), pagadas AS (
      SELECT c.id, EXTRACT(EPOCH FROM (MAX(p.fecha)-c.fecha))/86400 AS dias
      FROM compras c
      JOIN aplicaciones_pago_proveedor a ON a.compra_proveedor_id=c.id
      JOIN pagos_proveedor p ON p.id=a.pago_proveedor_id
      WHERE NOT EXISTS (SELECT 1 FROM pagos_proveedor r
        WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=p.id)
      GROUP BY c.id,c.fecha HAVING SUM(a.importe) >= MAX(c.importe)
    )
    SELECT
      (SELECT AVG(dias)::text FROM pagadas) AS dias_pago,
      COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date <= 30),0)::text AS d30,
      COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date BETWEEN 31 AND 60),0)::text AS d60,
      COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date BETWEEN 61 AND 90),0)::text AS d90,
      COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date > 90),0)::text AS dmayor
    FROM deudas
  `);
  const extra = extras.rows[0] as { dias_pago: string | null; d30: string; d60: string; d90: string; dmayor: string };

  const exclusiveRows = await db.execute(sql`
    SELECT pr.id, pr.sku, pr.tela, pr.color
    FROM productos pr JOIN rollos ro ON ro.producto_id=pr.id
    GROUP BY pr.id,pr.sku,pr.tela,pr.color
    HAVING COUNT(DISTINCT ro.proveedor_id) FILTER (WHERE ro.proveedor_id IS NOT NULL)=1
      AND MAX(ro.proveedor_id) FILTER (WHERE ro.proveedor_id IS NOT NULL)=${proveedorId}
    ORDER BY pr.sku
  `);
  // A sale is attributed only to its physical roll. Never infer a supplier from
  // producto_id: a product can have rolls from several suppliers.
  const marginRows = await db.execute(sql`
    WITH lineas_periodo AS (
      SELECT tl.*, t.id AS ticket_id
      FROM ticket_lineas tl JOIN tickets t ON t.id=tl.ticket_id
      WHERE t.estado='VENDIDO' AND t.created_at BETWEEN ${desde} AND ${hasta}
    ), lineas_proveedor AS (
      SELECT lp.*
      FROM lineas_periodo lp
      JOIN rollos ro ON ro.id=lp.rollo_id
      JOIN entradas e ON e.id=ro.recepcion_id
      WHERE e.proveedor_id=${proveedorId}
    )
    SELECT
      COALESCE(SUM(importe) FILTER (WHERE costo_total_congelado > 0),0)::text AS ventas,
      COALESCE(SUM(costo_total_congelado) FILTER (WHERE costo_total_congelado > 0),0)::text AS costo,
      COUNT(*) FILTER (WHERE costo_total_congelado > 0)::text AS incluidas,
      (SELECT COUNT(*) FROM lineas_periodo WHERE rollo_id IS NULL)::text AS sin_rollo,
      COUNT(*) FILTER (WHERE costo_total_congelado IS NULL OR costo_total_congelado <= 0)::text AS sin_costo
    FROM lineas_proveedor
  `);
  const margin = marginRows.rows[0] as {
    ventas: string; costo: string; incluidas: string; sin_rollo: string; sin_costo: string;
  };
  const ventas = parseFloat(margin.ventas), costoVenta = parseFloat(margin.costo), margen = ventas-costoVenta;
  const monthSorted = [...porMes].sort((a,b) => parseFloat(b.total)-parseFloat(a.total));
  const topTotal = porProducto[0] ? parseFloat(porProducto[0].totalCosto) : 0;
  const top3Total = porProducto.slice(0,3).reduce((s,p) => s+parseFloat(p.totalCosto),0);
  const purchaseDates = (mesRows.rows.length ? await db.execute(sql`
    SELECT fecha FROM pagos_proveedor WHERE proveedor_id=${proveedorId} AND tipo='COMPRA'
      AND fecha BETWEEN ${desde} AND ${hasta} ORDER BY fecha
  `) : { rows: [] }).rows as Array<{fecha: Date|string}>;
  const intervals = purchaseDates.slice(1).map((r,i) => (toDate(r.fecha)!.getTime()-toDate(purchaseDates[i]!.fecha)!.getTime())/86400000);

  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    totalCompras: totalCompras.toFixed(2),
    comprasCount,
    totalRollos,
    costoPorMetro:
      cantidadMetros > 0 ? (costoMetros / cantidadMetros).toFixed(2) : null,
    costoPorKilo:
      cantidadKilos > 0 ? (costoKilos / cantidadKilos).toFixed(2) : null,
    ticketPromedio: ticketPromedio.toFixed(2),
    diasDesdeUltimaCompra,
    ultimaCompra: ultimaDate ? ultimaDate.toISOString() : null,
    frecuencia: {
      promedioDiasEntreCompras: intervals.length ? (intervals.reduce((a,b)=>a+b,0)/intervals.length).toFixed(1) : null,
      ultimaCompra: ultimaDate ? ultimaDate.toISOString() : null,
    },
    estacionalidad: {
      mesMayor: monthSorted[0] ? { mes: monthSorted[0].mes, total: monthSorted[0].total } : null,
      mesMenor: monthSorted.length ? { mes: monthSorted[monthSorted.length-1]!.mes, total: monthSorted[monthSorted.length-1]!.total } : null,
    },
    concentracion: {
      productoPrincipalPct: totalCompras > 0 ? (topTotal/totalCompras*100).toFixed(2) : "0.00",
      tresPrincipalesPct: totalCompras > 0 ? (top3Total/totalCompras*100).toFixed(2) : "0.00",
    },
    productosExclusivos: (exclusiveRows.rows as Array<{id:number;sku:string;tela:string;color:string}>).map(r => ({productoId:r.id,sku:r.sku,tela:r.tela,color:r.color})),
    diasPromedioPago: extra.dias_pago ? parseFloat(extra.dias_pago).toFixed(1) : null,
    antiguedadDeuda: { hasta30: parseFloat(extra.d30).toFixed(2), de31a60: parseFloat(extra.d60).toFixed(2), de61a90: parseFloat(extra.d90).toFixed(2), mas90: parseFloat(extra.dmayor).toFixed(2) },
    margenGenerado: {
      ventas: ventas.toFixed(2),
      costo: costoVenta.toFixed(2),
      margen: margen.toFixed(2),
      margenPct: ventas > 0 ? (margen/ventas*100).toFixed(2) : null,
      lineasIncluidas: parseInt(margin.incluidas, 10),
      lineasExcluidasSinRollo: parseInt(margin.sin_rollo, 10),
      lineasExcluidasSinCosto: parseInt(margin.sin_costo, 10),
      nota: "Solo se incluyen líneas VENDIDAS ligadas al rollo físico recibido de este proveedor; líneas sin rollo o sin costo se excluyen.",
    },
    porMes,
    porProducto,
    porTela,
    porColor,
  };
}

export async function analiticaGlobalProveedores(): Promise<AnaliticaGlobalProveedores> {
  const [paretoResult, deudaResult, trendResult, risingResult, comparisonResult, agingResult] = await Promise.all([
    db.execute(sql`SELECT p.id proveedor_id,p.nombre proveedor,SUM(pp.importe)::text total
      FROM pagos_proveedor pp JOIN proveedores p ON p.id=pp.proveedor_id WHERE pp.tipo='COMPRA'
      GROUP BY p.id,p.nombre ORDER BY SUM(pp.importe) DESC`),
    db.execute(sql`SELECT p.id proveedor_id,p.nombre proveedor,SUM(pp.importe)::text saldo
      FROM pagos_proveedor pp JOIN proveedores p ON p.id=pp.proveedor_id GROUP BY p.id,p.nombre
      HAVING SUM(pp.importe)>0 ORDER BY SUM(pp.importe) DESC`),
    db.execute(sql`SELECT TO_CHAR(fecha,'YYYY-MM') mes,SUM(importe)::text total FROM pagos_proveedor
      WHERE tipo='COMPRA' AND fecha>=CURRENT_DATE-INTERVAL '12 months' GROUP BY 1 ORDER BY 1`),
    db.execute(sql`WITH history AS (
      SELECT ro.producto_id,pp.proveedor_id,p.nombre proveedor,pr.sku,pp.fecha,
        SUM(ro.costo_total)/NULLIF(SUM(ro.cantidad_inicial),0) costo,
        ROW_NUMBER() OVER(PARTITION BY ro.producto_id,pp.proveedor_id ORDER BY pp.fecha DESC) rn
      FROM pagos_proveedor pp JOIN rollos ro ON ro.recepcion_id=pp.entrada_id
      JOIN proveedores p ON p.id=pp.proveedor_id JOIN productos pr ON pr.id=ro.producto_id
      WHERE pp.tipo='COMPRA' GROUP BY ro.producto_id,pp.proveedor_id,p.nombre,pr.sku,pp.fecha
    ) SELECT a.producto_id,a.sku,a.proveedor,b.costo::text costo_anterior,a.costo::text costo_actual,
      ((a.costo-b.costo)/NULLIF(b.costo,0)*100)::text variacion
      FROM history a JOIN history b ON b.producto_id=a.producto_id AND b.proveedor_id=a.proveedor_id AND b.rn=2
      WHERE a.rn=1 AND a.costo>b.costo ORDER BY ((a.costo-b.costo)/NULLIF(b.costo,0)) DESC LIMIT 20`),
    db.execute(sql`
      SELECT pr.id producto_id,pr.sku,pr.unidad,p.id proveedor_id,p.nombre proveedor,
        (SUM(ro.costo_total)/NULLIF(SUM(ro.cantidad_inicial),0))::text costo_unitario
      FROM rollos ro JOIN productos pr ON pr.id=ro.producto_id
      JOIN entradas e ON e.id=ro.recepcion_id
      JOIN proveedores p ON p.id=e.proveedor_id
      WHERE ro.costo_total IS NOT NULL AND ro.cantidad_inicial>0
      GROUP BY pr.id,pr.sku,pr.unidad,p.id,p.nombre
      HAVING SUM(ro.costo_total)>0
      ORDER BY pr.sku,(SUM(ro.costo_total)/NULLIF(SUM(ro.cantidad_inicial),0))
    `),
    db.execute(sql`
      WITH compras AS (
        SELECT pp.proveedor_id,pp.id,pp.fecha,pp.importe,
          COALESCE(SUM(pp.importe) OVER (
            PARTITION BY pp.proveedor_id ORDER BY pp.fecha,pp.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ),0) AS comprado_antes
        FROM pagos_proveedor pp WHERE pp.tipo='COMPRA'
      ), pagos AS (
        SELECT proveedor_id,COALESCE(ABS(SUM(importe)),0) pagado
        FROM pagos_proveedor WHERE tipo='PAGO' GROUP BY proveedor_id
      ), deudas AS (
        SELECT c.fecha,GREATEST(0,c.importe-LEAST(c.importe,GREATEST(0,COALESCE(p.pagado,0)-c.comprado_antes))) saldo
        FROM compras c LEFT JOIN pagos p ON p.proveedor_id=c.proveedor_id
      )
      SELECT
        COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date<=30),0)::text d30,
        COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date BETWEEN 31 AND 60),0)::text d60,
        COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date BETWEEN 61 AND 90),0)::text d90,
        COALESCE(SUM(saldo) FILTER (WHERE CURRENT_DATE-fecha::date>90),0)::text dmayor
      FROM deudas
    `),
  ]);
  type P={proveedor_id:number;proveedor:string;total:string}; const pRows=paretoResult.rows as P[];
  const grand=pRows.reduce((s,r)=>s+parseFloat(r.total),0); let accumulated=0;
  type Comparison = { producto_id:number;sku:string;unidad:string;proveedor_id:number;proveedor:string;costo_unitario:string };
  const comparisonRows = comparisonResult.rows as Comparison[];
  const comparisonProductIds = [...new Set(comparisonRows.map(r => r.producto_id))];
  const comparacionCostos = comparisonProductIds.map(productoId => {
    const rows = comparisonRows.filter(r => r.producto_id === productoId);
    const cheapest = rows[0]!;
    const expensive = rows[rows.length - 1]!;
    const low = parseFloat(cheapest.costo_unitario);
    const high = parseFloat(expensive.costo_unitario);
    return {
      productoId,
      sku: cheapest.sku,
      unidad: cheapest.unidad,
      proveedorMasBarato: cheapest.proveedor,
      costoMasBarato: low.toFixed(2),
      costoMasCaro: high.toFixed(2),
      ahorroPct: high > 0 ? ((high-low)/high*100).toFixed(2) : "0.00",
      proveedores: rows.map(r => ({ proveedorId:r.proveedor_id, proveedor:r.proveedor, costoUnitario:parseFloat(r.costo_unitario).toFixed(2) })),
    };
  }).filter(r => r.proveedores.length > 1).sort((a,b) => parseFloat(b.ahorroPct)-parseFloat(a.ahorroPct));
  const aging = agingResult.rows[0] as {d30:string;d60:string;d90:string;dmayor:string};
  return {
    pareto:pRows.map(r=>{accumulated+=parseFloat(r.total);return {proveedorId:r.proveedor_id,proveedor:r.proveedor,total:parseFloat(r.total).toFixed(2),porcentajeAcumulado:grand? (accumulated/grand*100).toFixed(2):"0.00"}}),
    deuda:(deudaResult.rows as Array<{proveedor_id:number;proveedor:string;saldo:string}>).map(r=>({proveedorId:r.proveedor_id,proveedor:r.proveedor,saldo:parseFloat(r.saldo).toFixed(2)})),
    tendenciaMensual:(trendResult.rows as Array<{mes:string;total:string}>).map(r=>({mes:r.mes,total:parseFloat(r.total).toFixed(2)})),
    costosAlAlza:(risingResult.rows as Array<{producto_id:number;sku:string;proveedor:string;costo_anterior:string;costo_actual:string;variacion:string}>).map(r=>({productoId:r.producto_id,sku:r.sku,proveedor:r.proveedor,costoAnterior:parseFloat(r.costo_anterior).toFixed(2),costoActual:parseFloat(r.costo_actual).toFixed(2),variacionPct:parseFloat(r.variacion).toFixed(2)})),
    comparacionCostos,
    antiguedadDeuda: { hasta30:parseFloat(aging.d30).toFixed(2), de31a60:parseFloat(aging.d60).toFixed(2), de61a90:parseFloat(aging.d90).toFixed(2), mas90:parseFloat(aging.dmayor).toFixed(2) },
  };
}
