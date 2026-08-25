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
 *  - estadisticasPeriodo()  – breakdown by month/product/tela/color with
 *                             totalRollos, ticketPromedio, diasDesdeUltimaCompra,
 *                             and per-product cantidadTotal + cost variation
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
  auditoriaTable,
  db,
  pagosProveedorTable,
  type FormaPagoProveedor,
} from "@workspace/db";
import type { Tx } from "./inventario";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoCompra = "Pagada" | "Parcial" | "Pendiente";

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
  tipo: "COMPRA" | "PAGO" | "AJUSTE";
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
  variacionVsPeriodoAnterior: string | null;
  ultimaCompra: string | null;
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
    costoPorUnidadAnterior: string | null;
    variacionCostoUnidadPct: string | null;
  }>;
  porTela: Array<{ tela: string; totalCosto: string; rollosCount: number }>;
  porColor: Array<{ color: string; totalCosto: string; rollosCount: number }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcEstadoCompra(
  totalCosto: number,
  abonado: number,
): EstadoCompra {
  if (abonado <= 0) return "Pendiente";
  if (abonado >= totalCosto - 0.005) return "Pagada";
  return "Parcial";
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
  await tx
    .insert(pagosProveedorTable)
    .values({
      proveedorId: opts.proveedorId,
      entradaId: opts.entradaId,
      importe: opts.totalCosto,
      tipo: "COMPRA",
      fecha: opts.fecha,
      usuarioId: opts.usuarioId,
    })
    .onConflictDoNothing();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a PAGO (payment) for a supplier.
 * importe must be positive (stored as negative internally).
 * If entradaId is provided it must belong to the proveedor.
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
    entradaId?: number | null;
    usuarioId: number;
    ip?: string | null;
  },
): Promise<typeof pagosProveedorTable.$inferSelect> {
  const fecha = opts.fecha ?? new Date();
  const [row] = await tx
    .insert(pagosProveedorTable)
    .values({
      proveedorId: opts.proveedorId,
      entradaId: opts.entradaId ?? null,
      importe: (-Math.abs(opts.importe)).toFixed(2),
      tipo: "PAGO",
      formaPago: opts.formaPago,
      referencia: opts.referencia ?? null,
      fecha,
      usuarioId: opts.usuarioId,
      notas: opts.notas ?? null,
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

  // Sum PAGOs linked to each entrada
  const entradaIds = compras
    .map((c) => c.entrada_id)
    .filter((id): id is number => id != null);

  const pagoSums = new Map<number, number>();
  if (entradaIds.length > 0) {
    const pagoRows = await db.execute<{
      entrada_id: number;
      abonado: string;
    }>(sql`
      SELECT entrada_id, ABS(SUM(importe))::text AS abonado
      FROM pagos_proveedor
      WHERE proveedor_id = ${opts.proveedorId}
        AND tipo = 'PAGO'
        AND entrada_id = ANY(ARRAY[${sql.raw(entradaIds.join(","))}]::int[])
      GROUP BY entrada_id
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
      tipo: r.tipo as "COMPRA" | "PAGO" | "AJUSTE",
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

  // Previous period (same duration)
  const durMs = hasta.getTime() - desde.getTime();
  const prevHasta = new Date(desde.getTime() - 1);
  const prevDesde = new Date(desde.getTime() - durMs - 1);

  const prevAgg = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(pp.importe), 0)::text AS total
    FROM pagos_proveedor pp
    WHERE pp.proveedor_id = ${proveedorId}
      AND pp.tipo = 'COMPRA'
      AND pp.fecha BETWEEN ${prevDesde} AND ${prevHasta}
  `);

  const prevTotal = parseFloat(
    (prevAgg.rows as Array<{ total: string }>)[0]?.total ?? "0",
  );
  const variacion =
    prevTotal > 0
      ? (((totalCompras - prevTotal) / prevTotal) * 100).toFixed(2)
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

  // Por producto – previous period (for cost comparison)
  const prevProdRows = await db.execute<{
    producto_id: number;
    total_rollos: string;
    cantidad_total: string;
  }>(sql`
    SELECT
      pr.id AS producto_id,
      COUNT(ro.id)::text AS total_rollos,
      SUM(ro.cantidad_inicial)::text AS cantidad_total,
      SUM(ro.costo_total)::text AS total_costo
    FROM pagos_proveedor pp
    JOIN entradas e ON e.id = pp.entrada_id
    JOIN rollos ro ON ro.recepcion_id = e.id
    JOIN productos pr ON pr.id = ro.producto_id
    WHERE pp.proveedor_id = ${proveedorId}
      AND pp.tipo = 'COMPRA'
      AND pp.fecha BETWEEN ${prevDesde} AND ${prevHasta}
    GROUP BY pr.id
  `);

  const prevProdMap = new Map<number, { rollos: number; cantidad: number; costo: number }>();
  for (const r of prevProdRows.rows as Array<{
    producto_id: number;
    total_rollos: string;
    cantidad_total: string;
    total_costo: string;
  }>) {
    const rollos = parseInt(r.total_rollos, 10);
    prevProdMap.set(r.producto_id, {
      rollos,
      cantidad: parseFloat(r.cantidad_total),
      costo: parseFloat(r.total_costo),
    });
  }

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
    const prev = prevProdMap.get(r.producto_id);
    let costoPorUnidadAnterior: string | null = null;
    let variacionCostoUnidadPct: string | null = null;
    if (prev && prev.cantidad > 0) {
      const cpa = prev.costo / prev.cantidad;
      costoPorUnidadAnterior = cpa.toFixed(2);
      if (cpa > 0) {
        variacionCostoUnidadPct = (
          ((costoPromedioActual - cpa) / cpa) * 100
        ).toFixed(2);
      }
    }
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
      costoPorUnidadAnterior,
      variacionCostoUnidadPct,
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
    variacionVsPeriodoAnterior: variacion,
    ultimaCompra: ultimaDate ? ultimaDate.toISOString() : null,
    porMes,
    porProducto,
    porTela,
    porColor,
  };
}
