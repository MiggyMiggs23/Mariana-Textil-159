import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  contenedorLineasTable,
  contenedoresTable,
  db,
  productosTable,
  proveedoresTable,
  ubicacionesTable,
} from "@workspace/db";
import type { Tx } from "./inventario";
import {
  calendarDayNumber,
  canEditContenedor,
  daysBetween,
  mexicoCalendarDate,
  periodBounds,
  redactEconomicData,
  weightedUnitCost,
} from "./contenedores-helpers";

export {
  calendarDayNumber,
  canEditContenedor,
  daysBetween,
  mexicoCalendarDate,
  periodBounds,
  redactEconomicData,
  weightedUnitCost,
} from "./contenedores-helpers";

export class ContenedorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ContenedorError";
  }
}

export type ContenedorInput = {
  proveedorId: number;
  referencia?: string | null;
  fechaPedido?: string | null;
  fechaEstimadaLlegada: string;
  sitioDestinoId: number;
  notas?: string | null;
  lineas: Array<{
    productoId: number;
    cantidadEsperada: string;
    rollosEsperados?: number | null;
    nota?: string | null;
  }>;
};


async function validateInput(tx: Tx, input: ContenedorInput): Promise<void> {
  calendarDayNumber(input.fechaEstimadaLlegada);
  if (input.fechaPedido) calendarDayNumber(input.fechaPedido);
  if (!input.lineas.length) {
    throw new ContenedorError(
      "El contenedor debe incluir al menos una línea.",
      "EMPTY_LINES",
    );
  }
  const ids = input.lineas.map((line) => line.productoId);
  if (new Set(ids).size !== ids.length) {
    throw new ContenedorError(
      "No se permiten productos duplicados.",
      "DUPLICATE_PRODUCT",
    );
  }
  if (
    input.lineas.some(
      (line) =>
        !(Number(line.cantidadEsperada) > 0) ||
        (line.rollosEsperados != null && line.rollosEsperados < 1),
    )
  ) {
    throw new ContenedorError(
      "Cantidades y rollos deben ser positivos.",
      "INVALID_QUANTITY",
    );
  }
  const [[provider], [site], products] = await Promise.all([
    tx
      .select({ activo: proveedoresTable.activo })
      .from(proveedoresTable)
      .where(eq(proveedoresTable.id, input.proveedorId))
      .limit(1),
    tx
      .select({ activa: ubicacionesTable.activa, tipo: ubicacionesTable.tipo })
      .from(ubicacionesTable)
      .where(eq(ubicacionesTable.id, input.sitioDestinoId))
      .limit(1),
    tx
      .select({ id: productosTable.id, activo: productosTable.activo })
      .from(productosTable)
      .where(inArray(productosTable.id, ids)),
  ]);
  if (!provider?.activo) {
    throw new ContenedorError(
      "Proveedor inválido o inactivo.",
      "INVALID_PROVIDER",
    );
  }
  if (!site?.activa || (site.tipo !== "TIENDA" && site.tipo !== "BODEGA")) {
    throw new ContenedorError("Sitio inválido o inactivo.", "INVALID_SITE");
  }
  if (
    products.length !== ids.length ||
    products.some((product) => !product.activo)
  ) {
    throw new ContenedorError(
      "Uno o más productos son inválidos o inactivos.",
      "INVALID_PRODUCT",
    );
  }
}

export async function createContenedor(
  tx: Tx,
  input: ContenedorInput,
  usuarioId: number,
) {
  await validateInput(tx, input);
  const [container] = await tx
    .insert(contenedoresTable)
    .values({
      proveedorId: input.proveedorId,
      referencia: input.referencia ?? null,
      fechaPedido: input.fechaPedido ?? null,
      fechaEstimadaLlegada: input.fechaEstimadaLlegada,
      sitioDestinoId: input.sitioDestinoId,
      notas: input.notas ?? null,
      usuarioId,
    })
    .returning();
  await tx.insert(contenedorLineasTable).values(
    input.lineas.map((line) => ({
      contenedorId: container!.id,
      productoId: line.productoId,
      cantidadEsperada: line.cantidadEsperada,
      rollosEsperados: line.rollosEsperados ?? null,
      nota: line.nota ?? null,
    })),
  );
  return container!;
}

export async function updateContenedor(
  tx: Tx,
  id: number,
  input: ContenedorInput,
  requiredSiteId?: number,
) {
  const [current] = await tx
    .select()
    .from(contenedoresTable)
    .where(eq(contenedoresTable.id, id))
    .for("update")
    .limit(1);
  if (!current) throw new ContenedorError("Contenedor no encontrado.", "NOT_FOUND");
  if (
    requiredSiteId != null &&
    current.sitioDestinoId !== requiredSiteId
  ) {
    throw new ContenedorError("Contenedor no encontrado.", "NOT_FOUND");
  }
  if (!canEditContenedor(current.estado, current.entradaId)) {
    throw new ContenedorError(
      "Solo se puede editar un contenedor en tránsito.",
      "NOT_EDITABLE",
    );
  }
  await validateInput(tx, input);
  await tx
    .update(contenedoresTable)
    .set({
      proveedorId: input.proveedorId,
      referencia: input.referencia ?? null,
      fechaPedido: input.fechaPedido ?? null,
      fechaEstimadaLlegada: input.fechaEstimadaLlegada,
      sitioDestinoId: input.sitioDestinoId,
      notas: input.notas ?? null,
      updatedAt: new Date(),
    })
    .where(eq(contenedoresTable.id, id));
  await tx
    .delete(contenedorLineasTable)
    .where(eq(contenedorLineasTable.contenedorId, id));
  await tx.insert(contenedorLineasTable).values(
    input.lineas.map((line) => ({
      contenedorId: id,
      productoId: line.productoId,
      cantidadEsperada: line.cantidadEsperada,
      rollosEsperados: line.rollosEsperados ?? null,
      nota: line.nota ?? null,
    })),
  );
}

export async function cancelContenedor(
  tx: Tx,
  id: number,
  motivo: string,
  requiredSiteId?: number,
) {
  if (motivo.trim().length < 10) {
    throw new ContenedorError(
      "El motivo debe tener al menos 10 caracteres.",
      "INVALID_REASON",
    );
  }
  const [updated] = await tx
    .update(contenedoresTable)
    .set({
      estado: "CANCELADO",
      motivoCancelacion: motivo.trim(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contenedoresTable.id, id),
        eq(contenedoresTable.estado, "EN_TRANSITO"),
        ...(requiredSiteId == null
          ? []
          : [eq(contenedoresTable.sitioDestinoId, requiredSiteId)]),
      ),
    )
    .returning();
  if (!updated) {
    throw new ContenedorError(
      "El contenedor no existe o ya no está en tránsito.",
      "NOT_EDITABLE",
    );
  }
}

type Scope = { sitioId?: number; admin: boolean };

export async function getContenedorDetail(id: number, scope: Scope) {
  const scopeSql = scope.sitioId == null ? sql`` : sql` AND c.sitio_destino_id = ${scope.sitioId}`;
  const headerResult = await db.execute(sql`
    SELECT c.*, p.nombre proveedor, u.nombre sitio_destino
    FROM contenedores c
    JOIN proveedores p ON p.id=c.proveedor_id
    JOIN ubicaciones u ON u.id=c.sitio_destino_id
    WHERE c.id=${id} ${scopeSql}
  `);
  const h = headerResult.rows[0] as Record<string, unknown> | undefined;
  if (!h) return null;
  const lineResult = await db.execute(sql`
    WITH expected AS (
      SELECT cl.id,cl.producto_id,cl.cantidad_esperada,cl.rollos_esperados,cl.nota,
        pr.sku,pr.tela,pr.color,pr.unidad
      FROM contenedor_lineas cl JOIN productos pr ON pr.id=cl.producto_id
      WHERE cl.contenedor_id=${id}
    ), received AS (
      SELECT r.producto_id,SUM(r.cantidad_inicial) cantidad_recibida,
        COUNT(r.id)::int rollos_recibidos,pr.sku,pr.tela,pr.color,pr.unidad
      FROM rollos r JOIN productos pr ON pr.id=r.producto_id
      WHERE r.recepcion_id=${h.entrada_id}
      GROUP BY r.producto_id,pr.sku,pr.tela,pr.color,pr.unidad
    )
    SELECT e.id,COALESCE(e.producto_id,r.producto_id) producto_id,
      COALESCE(e.sku,r.sku) sku,COALESCE(e.tela,r.tela) tela,
      COALESCE(e.color,r.color) color,COALESCE(e.unidad,r.unidad) unidad,
      COALESCE(e.cantidad_esperada,0)::text cantidad_esperada,
      e.rollos_esperados,e.nota,COALESCE(r.cantidad_recibida,0::numeric)::text cantidad_recibida,
      COALESCE(r.rollos_recibidos,0)::int rollos_recibidos
    FROM expected e FULL OUTER JOIN received r ON r.producto_id=e.producto_id
    ORDER BY COALESCE(e.id, 2147483647),COALESCE(e.producto_id,r.producto_id)
  `);
  let costMap = new Map<number, { total: string | null; unit: string | null }>();
  let totalCost: string | null = null;
  if (scope.admin && h.entrada_id != null) {
    const costs = await db.execute(sql`
      SELECT producto_id,
        CASE WHEN COUNT(*) FILTER (WHERE costo_total IS NULL)>0
          THEN NULL ELSE SUM(costo_total)::text END total,
        CASE WHEN SUM(cantidad_inicial)>0 AND COUNT(*) FILTER (WHERE costo_total IS NULL)=0
          THEN (SUM(costo_total)/SUM(cantidad_inicial))::text END unit
      FROM rollos WHERE recepcion_id=${h.entrada_id} GROUP BY producto_id
    `);
    costMap = new Map(
      (costs.rows as Array<Record<string, unknown>>).map((row) => [
        Number(row.producto_id),
        {
          total: row.total == null ? null : String(row.total),
          unit: row.unit == null ? null : Number(row.unit).toFixed(4),
        },
      ]),
    );
    totalCost = (costs.rows as Array<Record<string, unknown>>).some(
      (row) => row.total == null,
    )
      ? null
      : (costs.rows as Array<Record<string, unknown>>)
          .reduce((sum, row) => sum + Number(row.total), 0)
          .toFixed(2);
  }
  const lines = (lineResult.rows as Array<Record<string, unknown>>).map((row) => {
    const expected = Number(row.cantidad_esperada);
    const received = Number(row.cantidad_recibida);
    const base: Record<string, unknown> = {
      id: row.id == null ? null : Number(row.id),
      productoId: Number(row.producto_id),
      sku: String(row.sku),
      tela: String(row.tela),
      color: String(row.color),
      unidad: String(row.unidad),
      cantidadEsperada: expected.toFixed(3),
      rollosEsperados:
        row.rollos_esperados == null ? null : Number(row.rollos_esperados),
      nota: row.nota == null ? null : String(row.nota),
      cantidadRecibida: received.toFixed(3),
      rollosRecibidos: Number(row.rollos_recibidos),
      diferencia: (received - expected).toFixed(3),
    };
    if (scope.admin) {
      const cost = costMap.get(Number(row.producto_id));
      base.costoTotal = cost?.total ?? null;
      base.costoUnitarioReal = cost?.unit ?? null;
    }
    return base;
  });
  const totals = (received: boolean) => ({
    lineas: lines.filter((line) =>
      received ? Number(line.rollosRecibidos) > 0 : line.id != null,
    ).length,
    rollos: lines.reduce(
      (sum, line) =>
        sum +
        Number(received ? line.rollosRecibidos : (line.rollosEsperados ?? 0)),
      0,
    ),
    metros: lines
      .filter((line) => line.unidad === "METRO")
      .reduce(
        (sum, line) =>
          sum +
          Number(received ? line.cantidadRecibida : line.cantidadEsperada),
        0,
      )
      .toFixed(3),
    kilos: lines
      .filter((line) => line.unidad === "KILO")
      .reduce(
        (sum, line) =>
          sum +
          Number(received ? line.cantidadRecibida : line.cantidadEsperada),
        0,
      )
      .toFixed(3),
  });
  const realDate = h.fecha_real_llegada == null ? null : String(h.fecha_real_llegada);
  const orderDate = h.fecha_pedido == null ? null : String(h.fecha_pedido);
  const detail: Record<string, unknown> = {
    id: Number(h.id),
    folio: Number(h.folio),
    proveedorId: Number(h.proveedor_id),
    proveedor: String(h.proveedor),
    referencia: h.referencia == null ? null : String(h.referencia),
    fechaPedido: orderDate,
    fechaEstimadaLlegada: String(h.fecha_estimada_llegada),
    fechaRealLlegada: realDate,
    sitioDestinoId: Number(h.sitio_destino_id),
    sitioDestino: String(h.sitio_destino),
    entradaId: h.entrada_id == null ? null : Number(h.entrada_id),
    estado: String(h.estado),
    notas: h.notas == null ? null : String(h.notas),
    motivoCancelacion:
      h.motivo_cancelacion == null ? null : String(h.motivo_cancelacion),
    usuarioId: Number(h.usuario_id),
    createdAt: new Date(String(h.created_at)).toISOString(),
    updatedAt: new Date(String(h.updated_at)).toISOString(),
    diasTransito:
      realDate && orderDate ? daysBetween(orderDate, realDate) : null,
    diferenciaFechaEstimada: realDate
      ? daysBetween(String(h.fecha_estimada_llegada), realDate)
      : null,
    totalesEsperados: totals(false),
    totalesRecibidos: totals(true),
    lineas: lines,
  };
  if (scope.admin) detail.costoTotal = totalCost;
  return detail;
}

export async function listAvailableForEntry(siteId: number) {
  return db
    .select({
      id: contenedoresTable.id,
      folio: contenedoresTable.folio,
      proveedorId: contenedoresTable.proveedorId,
      proveedor: proveedoresTable.nombre,
      referencia: contenedoresTable.referencia,
      fechaEstimadaLlegada: contenedoresTable.fechaEstimadaLlegada,
    })
    .from(contenedoresTable)
    .innerJoin(
      proveedoresTable,
      eq(contenedoresTable.proveedorId, proveedoresTable.id),
    )
    .where(
      and(
        eq(contenedoresTable.sitioDestinoId, siteId),
        eq(contenedoresTable.estado, "EN_TRANSITO"),
      ),
    )
    .orderBy(asc(contenedoresTable.fechaEstimadaLlegada));
}

export type ContenedorListQuery = {
  estado?: string;
  proveedorId?: number;
  sitioDestinoId?: number;
  productoId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  page: number;
  pageSize: number;
};

export async function listContenedores(
  query: ContenedorListQuery,
  scope: Scope,
) {
  const conditions = [sql`TRUE`];
  if (scope.sitioId != null)
    conditions.push(sql`c.sitio_destino_id=${scope.sitioId}`);
  if (query.estado) conditions.push(sql`c.estado=${query.estado}`);
  if (query.proveedorId)
    conditions.push(sql`c.proveedor_id=${query.proveedorId}`);
  if (query.sitioDestinoId)
    conditions.push(sql`c.sitio_destino_id=${query.sitioDestinoId}`);
  if (query.productoId)
    conditions.push(sql`EXISTS (SELECT 1 FROM contenedor_lineas x WHERE x.contenedor_id=c.id AND x.producto_id=${query.productoId})`);
  if (query.fechaDesde)
    conditions.push(sql`c.fecha_estimada_llegada>=${query.fechaDesde}`);
  if (query.fechaHasta)
    conditions.push(sql`c.fecha_estimada_llegada<=${query.fechaHasta}`);
  if (query.search) {
    const search = `%${query.search}%`;
    conditions.push(
      sql`(c.referencia ILIKE ${search} OR c.folio::text ILIKE ${search})`,
    );
  }
  const where = sql.join(conditions, sql` AND `);
  const result = await db.execute(sql`
    SELECT c.id, c.folio, c.proveedor_id, p.nombre proveedor, c.referencia,
      c.fecha_estimada_llegada, c.sitio_destino_id, u.nombre sitio_destino,
      c.estado, COUNT(cl.id)::int lineas,
      COALESCE(SUM(cl.rollos_esperados),0)::int rollos,
      COALESCE(SUM(cl.cantidad_esperada) FILTER (WHERE pr.unidad='METRO'),0)::text metros,
      COALESCE(SUM(cl.cantidad_esperada) FILTER (WHERE pr.unidad='KILO'),0)::text kilos,
      ${scope.admin ? sql`(SELECT CASE
        WHEN e.total_costo IS NULL OR COUNT(*) FILTER (WHERE r.id IS NOT NULL AND r.costo_total IS NULL)>0 THEN NULL
        ELSE COALESCE(SUM(r.costo_total),0)::text END
        FROM entradas e LEFT JOIN rollos r ON r.recepcion_id=e.id
        WHERE e.id=c.entrada_id GROUP BY e.total_costo) costo_total,` : sql``}
      COUNT(*) OVER()::int total_rows
    FROM contenedores c
    JOIN proveedores p ON p.id=c.proveedor_id
    JOIN ubicaciones u ON u.id=c.sitio_destino_id
    JOIN contenedor_lineas cl ON cl.contenedor_id=c.id
    JOIN productos pr ON pr.id=cl.producto_id
    WHERE ${where}
    GROUP BY c.id,p.nombre,u.nombre
    ORDER BY c.fecha_estimada_llegada ASC,c.folio ASC
    LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
  `);
  const today = mexicoCalendarDate();
  const items = (result.rows as Array<Record<string, unknown>>).map((row) => {
    const item: Record<string, unknown> = {
      id: Number(row.id),
      folio: Number(row.folio),
      proveedorId: Number(row.proveedor_id),
      proveedor: String(row.proveedor),
      referencia: row.referencia == null ? null : String(row.referencia),
      fechaEstimadaLlegada: String(row.fecha_estimada_llegada),
      sitioDestinoId: Number(row.sitio_destino_id),
      sitioDestino: String(row.sitio_destino),
      estado: String(row.estado),
      diasParaLlegar: daysBetween(today, String(row.fecha_estimada_llegada)),
      lineas: Number(row.lineas),
      totales: {
        lineas: Number(row.lineas),
        rollos: Number(row.rollos),
        metros: Number(row.metros).toFixed(3),
        kilos: Number(row.kilos).toFixed(3),
      },
    };
    if (scope.admin)
      item.costoTotal =
        row.costo_total == null ? null : Number(row.costo_total).toFixed(2);
    return item;
  });
  return {
    items,
    total: Number(result.rows[0]?.total_rows ?? 0),
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getContenedoresSummary(
  year: number,
  quarter: number | undefined,
  semester: number | undefined,
  scope: Scope,
) {
  const bounds = periodBounds(year, quarter, semester);
  const priorFrom = `${year - 1}-${bounds.from.slice(5)}`;
  const priorTo = `${year - 1}-${bounds.to.slice(5)}`;
  const site = scope.sitioId == null ? sql`TRUE` : sql`c.sitio_destino_id=${scope.sitioId}`;
  const current = await db.execute(sql`
    SELECT COUNT(DISTINCT c.id)::int en_transito,
      COALESCE(SUM(cl.rollos_esperados),0)::int rollos,
      COALESCE(SUM(cl.cantidad_esperada) FILTER (WHERE pr.unidad='METRO'),0)::text metros,
      COALESCE(SUM(cl.cantidad_esperada) FILTER (WHERE pr.unidad='KILO'),0)::text kilos,
      COUNT(DISTINCT c.id) FILTER (WHERE c.fecha_estimada_llegada<CURRENT_DATE)::int retrasados
    FROM contenedores c JOIN contenedor_lineas cl ON cl.contenedor_id=c.id
    JOIN productos pr ON pr.id=cl.producto_id
    WHERE c.estado='EN_TRANSITO' AND ${site}
  `);
  const next = await db.execute(sql`
    SELECT c.folio,p.nombre proveedor,c.fecha_estimada_llegada,(c.fecha_estimada_llegada-CURRENT_DATE)::int dias
    FROM contenedores c JOIN proveedores p ON p.id=c.proveedor_id
    WHERE c.estado='EN_TRANSITO' AND ${site}
    ORDER BY c.fecha_estimada_llegada,c.folio LIMIT 1
  `);
  // Container facts and roll facts deliberately stay separate: joining them
  // before AVG would weight a container's transit time by its roll count.
  const period = await db.execute(sql`
    WITH received AS (
      SELECT c.id,c.proveedor_id,c.fecha_pedido,c.fecha_real_llegada,
        c.fecha_estimada_llegada,e.id entrada_id,e.total_costo
      FROM contenedores c JOIN entradas e ON e.id=c.entrada_id
      WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
    ), rolls AS (
      SELECT rc.id,r.id rollo_id,r.cantidad_inicial,r.costo_total,pr.unidad
      FROM received rc LEFT JOIN rollos r ON r.recepcion_id=rc.entrada_id
      LEFT JOIN productos pr ON pr.id=r.producto_id
    )
    SELECT (SELECT COUNT(*)::int FROM received) contenedores,
      COUNT(rollo_id)::int rollos,
      COALESCE(SUM(cantidad_inicial) FILTER (WHERE unidad='METRO'),0)::text metros,
      COALESCE(SUM(cantidad_inicial) FILTER (WHERE unidad='KILO'),0)::text kilos,
      (SELECT AVG(fecha_real_llegada-fecha_pedido)::numeric(12,2)::text FROM received WHERE fecha_pedido IS NOT NULL) dias_promedio,
      (SELECT COUNT(*) FILTER (WHERE fecha_real_llegada<fecha_estimada_llegada)::int FROM received) antes,
      (SELECT COUNT(*) FILTER (WHERE fecha_real_llegada=fecha_estimada_llegada)::int FROM received) a_tiempo,
      (SELECT COUNT(*) FILTER (WHERE fecha_real_llegada>fecha_estimada_llegada)::int FROM received) despues
      ${scope.admin ? sql`, CASE WHEN EXISTS (SELECT 1 FROM received WHERE total_costo IS NULL)
          OR COUNT(*) FILTER (WHERE rollo_id IS NOT NULL AND costo_total IS NULL)>0
        THEN NULL ELSE COALESCE(SUM(costo_total),0)::text END costo_total` : sql``}
    FROM rolls
  `);
  const [providers, products, fabrics, colors, months, differences] =
    await Promise.all([
      db.execute(sql`
        WITH received AS (
          SELECT c.id,c.proveedor_id,c.fecha_pedido,c.fecha_real_llegada,c.fecha_estimada_llegada,e.id entrada_id,e.total_costo
          FROM contenedores c JOIN entradas e ON e.id=c.entrada_id
          WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
        ), rolls AS (
          SELECT rc.id,rc.proveedor_id,r.id rollo_id,r.cantidad_inicial,r.costo_total,pr.unidad
          FROM received rc LEFT JOIN rollos r ON r.recepcion_id=rc.entrada_id LEFT JOIN productos pr ON pr.id=r.producto_id
        )
        SELECT pv.id "proveedorId",pv.nombre proveedor,
          COUNT(DISTINCT rc.id)::int contenedores,COUNT(rolls.rollo_id)::int rollos,
          COALESCE(SUM(rolls.cantidad_inicial) FILTER (WHERE rolls.unidad='METRO'),0)::text metros,
          COALESCE(SUM(rolls.cantidad_inicial) FILTER (WHERE rolls.unidad='KILO'),0)::text kilos,
          (SELECT AVG(avg_rc.fecha_real_llegada-avg_rc.fecha_pedido)::numeric(12,2)::text
            FROM received avg_rc WHERE avg_rc.proveedor_id=pv.id AND avg_rc.fecha_pedido IS NOT NULL) "diasPromedioTransito",
          COUNT(DISTINCT rc.id) FILTER (WHERE rc.fecha_real_llegada<rc.fecha_estimada_llegada)::int antes,
          COUNT(DISTINCT rc.id) FILTER (WHERE rc.fecha_real_llegada=rc.fecha_estimada_llegada)::int "aTiempo",
          COUNT(DISTINCT rc.id) FILTER (WHERE rc.fecha_real_llegada>rc.fecha_estimada_llegada)::int despues
          ${scope.admin ? sql`, CASE WHEN COUNT(*) FILTER (WHERE rc.total_costo IS NULL)>0
              OR COUNT(*) FILTER (WHERE rolls.rollo_id IS NOT NULL AND rolls.costo_total IS NULL)>0
            THEN NULL ELSE COALESCE(SUM(rolls.costo_total),0)::text END AS "costoTotal"` : sql``}
        FROM received rc JOIN proveedores pv ON pv.id=rc.proveedor_id
        LEFT JOIN rolls ON rolls.id=rc.id
        GROUP BY pv.id ORDER BY pv.nombre
      `),
      db.execute(sql`
        SELECT pr.id "productoId",pr.sku,pr.tela,pr.color,pr.unidad,
          COUNT(DISTINCT c.id)::int contenedores,COUNT(r.id)::int rollos,
          COALESCE(SUM(r.cantidad_inicial),0)::text cantidad
          ${scope.admin ? sql`, CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0 THEN NULL ELSE SUM(r.costo_total)::text END AS "costoTotal",
            CASE WHEN SUM(r.cantidad_inicial)>0 AND COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)=0 THEN (SUM(r.costo_total)/SUM(r.cantidad_inicial))::numeric(14,4)::text ELSE NULL END AS "costoUnitarioReal"` : sql``}
        FROM contenedores c JOIN entradas e ON e.id=c.entrada_id JOIN rollos r ON r.recepcion_id=e.id
        JOIN productos pr ON pr.id=r.producto_id
        WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
        GROUP BY pr.id ORDER BY pr.tela,pr.color
      `),
      db.execute(sql`
        SELECT pr.tela,pr.unidad,COUNT(DISTINCT c.id)::int contenedores,COUNT(r.id)::int rollos,
          COALESCE(SUM(r.cantidad_inicial) FILTER (WHERE pr.unidad='METRO'),0)::text metros,
          COALESCE(SUM(r.cantidad_inicial) FILTER (WHERE pr.unidad='KILO'),0)::text kilos
          ${scope.admin ? sql`, CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0 THEN NULL ELSE SUM(r.costo_total)::text END AS "costoTotal",
          CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0 OR SUM(r.cantidad_inicial)=0 THEN NULL ELSE (SUM(r.costo_total)/SUM(r.cantidad_inicial))::numeric(14,4)::text END AS "costoUnitarioReal"` : sql``}
        FROM contenedores c JOIN entradas e ON e.id=c.entrada_id JOIN rollos r ON r.recepcion_id=e.id JOIN productos pr ON pr.id=r.producto_id
        WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
        GROUP BY pr.tela,pr.unidad ORDER BY pr.tela,pr.unidad
      `),
      db.execute(sql`
        SELECT pr.color,pr.unidad,COUNT(DISTINCT c.id)::int contenedores,COUNT(r.id)::int rollos,
          COALESCE(SUM(r.cantidad_inicial) FILTER (WHERE pr.unidad='METRO'),0)::text metros,
          COALESCE(SUM(r.cantidad_inicial) FILTER (WHERE pr.unidad='KILO'),0)::text kilos
          ${scope.admin ? sql`, CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0 THEN NULL ELSE SUM(r.costo_total)::text END AS "costoTotal",
          CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0 OR SUM(r.cantidad_inicial)=0 THEN NULL ELSE (SUM(r.costo_total)/SUM(r.cantidad_inicial))::numeric(14,4)::text END AS "costoUnitarioReal"` : sql``}
        FROM contenedores c JOIN entradas e ON e.id=c.entrada_id JOIN rollos r ON r.recepcion_id=e.id JOIN productos pr ON pr.id=r.producto_id
        WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
        GROUP BY pr.color,pr.unidad ORDER BY pr.color,pr.unidad
      `),
      db.execute(sql`
        WITH current_months AS (
          SELECT EXTRACT(MONTH FROM c.fecha_real_llegada)::int mes
            ${scope.admin ? sql`, CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0
              THEN NULL ELSE COALESCE(SUM(r.costo_total),0)::text END costo` : sql``}
          FROM contenedores c JOIN entradas e ON e.id=c.entrada_id
          JOIN rollos r ON r.recepcion_id=e.id
          WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
          GROUP BY EXTRACT(MONTH FROM c.fecha_real_llegada)
        ), prior_months AS (
          SELECT EXTRACT(MONTH FROM c.fecha_real_llegada)::int mes
            ${scope.admin ? sql`, CASE WHEN COUNT(*) FILTER (WHERE e.total_costo IS NULL OR r.costo_total IS NULL)>0
              THEN NULL ELSE COALESCE(SUM(r.costo_total),0)::text END costo` : sql``}
          FROM contenedores c JOIN entradas e ON e.id=c.entrada_id
          JOIN rollos r ON r.recepcion_id=e.id
          WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${priorFrom} AND ${priorTo} AND ${site}
          GROUP BY EXTRACT(MONTH FROM c.fecha_real_llegada)
        )
        SELECT COALESCE(cm.mes,pm.mes)::int mes
          ${scope.admin ? sql`, cm.costo "costoActual",pm.costo "costoAnioAnterior"` : sql``}
        FROM current_months cm FULL OUTER JOIN prior_months pm ON pm.mes=cm.mes
        ORDER BY COALESCE(cm.mes,pm.mes)
      `),
      db.execute(sql`
        WITH expected AS (
          SELECT cl.producto_id,SUM(cl.cantidad_esperada) esperado
          FROM contenedores c JOIN contenedor_lineas cl ON cl.contenedor_id=c.id
          WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
          GROUP BY cl.producto_id
        ), received AS (
          SELECT r.producto_id,SUM(r.cantidad_inicial) recibido
          FROM contenedores c JOIN rollos r ON r.recepcion_id=c.entrada_id
          WHERE c.estado='RECIBIDO' AND c.fecha_real_llegada BETWEEN ${bounds.from} AND ${bounds.to} AND ${site}
          GROUP BY r.producto_id
        )
        SELECT pr.id producto_id,pr.sku,pr.tela,pr.color,pr.unidad,
          COALESCE(e.esperado,0)::text esperado,COALESCE(r.recibido,0)::text recibido
        FROM expected e FULL OUTER JOIN received r ON r.producto_id=e.producto_id
        JOIN productos pr ON pr.id=COALESCE(e.producto_id,r.producto_id)
        ORDER BY pr.tela,pr.color
      `),
    ]);
  const c = current.rows[0] as Record<string, unknown>;
  const p = period.rows[0] as Record<string, unknown>;
  const nextRow = next.rows[0] as Record<string, unknown> | undefined;
  const response: Record<string, unknown> = {
    actual: {
      enTransito: Number(c.en_transito),
      rollosPorLlegar: Number(c.rollos),
      metrosPorLlegar: Number(c.metros).toFixed(3),
      kilosPorLlegar: Number(c.kilos).toFixed(3),
      retrasados: Number(c.retrasados),
      proximo: nextRow
        ? {
            folio: Number(nextRow.folio),
            proveedor: String(nextRow.proveedor),
            fechaEstimadaLlegada: String(nextRow.fecha_estimada_llegada),
            dias: Number(nextRow.dias),
          }
        : null,
    },
    periodo: {
      contenedores: Number(p.contenedores),
      rollos: Number(p.rollos),
      metros: Number(p.metros).toFixed(3),
      kilos: Number(p.kilos).toFixed(3),
      diasPromedio: p.dias_promedio == null ? null : String(p.dias_promedio),
      antes: Number(p.antes),
      aTiempo: Number(p.a_tiempo),
      despues: Number(p.despues),
    },
    porProveedor: providers.rows,
    porProducto: products.rows,
    porTela: fabrics.rows,
    porColor: colors.rows,
    porMes: months.rows,
    diferencias: differences.rows,
  };
  if (scope.admin) {
    const totalCost = p.costo_total == null ? null : String(p.costo_total);
    (response.periodo as Record<string, unknown>).costoTotal = totalCost;
    (response.periodo as Record<string, unknown>).costoPromedio =
      totalCost == null || Number(p.contenedores) === 0
        ? null
        : (Number(totalCost) / Number(p.contenedores)).toFixed(2);
    const total = totalCost == null ? null : Number(totalCost);
    response.porProveedor = (providers.rows as Array<Record<string, unknown>>).map(
      (provider) => ({
        ...provider,
        participacion:
          provider.costoTotal == null || total == null || total === 0
            ? null
            : (Number(provider.costoTotal) / total).toFixed(4),
      }),
    );
  }
  return response;
}