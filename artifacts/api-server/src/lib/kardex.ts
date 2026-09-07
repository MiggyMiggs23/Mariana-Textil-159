import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  clientesTable,
  entradasTable,
  movimientosTable,
  productosTable,
  rollosTable,
  salidasTable,
  ticketsTable,
  tipoMovimientoEnum,
  ubicacionesTable,
  usuariosTable,
  type TipoMovimiento,
} from "@workspace/db";

const destinoUbicacion = alias(ubicacionesTable, "destino");

export type KardexFiltersInput = {
  tipos?: TipoMovimiento[];
  modo?: "TODO_LO_QUE_SALIO";
  desde?: Date;
  hasta?: Date;
  ubicacionId?: number;
  productoId?: number;
  usuarioId?: number;
  buscar?: string;
  incluirUbicacionesInactivas: boolean;
};

export const TODO_LO_QUE_SALIO_TIPOS = [
  "VENTA",
  "TRANSFERENCIA_SALIDA",
  "SALIDA_MOSTRADOR",
] as const satisfies readonly TipoMovimiento[];

type JoinedMovement = Awaited<ReturnType<typeof selectMovements>>[number];

export function resolveKardexTipos(filters: KardexFiltersInput) {
  return filters.modo === "TODO_LO_QUE_SALIO"
    ? [...TODO_LO_QUE_SALIO_TIPOS]
    : filters.tipos;
}

function whereConditions(filters: KardexFiltersInput): SQL[] {
  const conditions: SQL[] = [];
  if (!filters.incluirUbicacionesInactivas) {
    conditions.push(eq(ubicacionesTable.activa, true));
  }
  if (filters.ubicacionId != null) {
    conditions.push(eq(movimientosTable.ubicacionId, filters.ubicacionId));
  }
  if (filters.productoId != null) {
    conditions.push(eq(movimientosTable.productoId, filters.productoId));
  }
  if (filters.usuarioId != null) {
    conditions.push(eq(movimientosTable.usuarioId, filters.usuarioId));
  }
  const tipos = resolveKardexTipos(filters);
  if (tipos?.length) {
    conditions.push(inArray(movimientosTable.tipo, tipos));
  }
  if (filters.desde) {
    conditions.push(gte(movimientosTable.createdAt, filters.desde));
  }
  if (filters.hasta) {
    conditions.push(lte(movimientosTable.createdAt, filters.hasta));
  }
  const term = filters.buscar?.trim();
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(
      or(
        ilike(rollosTable.serie, pattern),
        ilike(productosTable.sku, pattern),
        ilike(productosTable.tela, pattern),
        ilike(productosTable.color, pattern),
        ilike(ubicacionesTable.nombre, pattern),
        ilike(usuariosTable.nombre, pattern),
        ilike(usuariosTable.usuario, pattern),
        ilike(movimientosTable.documentoTipo, pattern),
        ilike(movimientosTable.documentoId, pattern),
        ilike(movimientosTable.justificacion, pattern),
        sql`exists (
          select 1
          from tickets kardex_ticket
          where ${movimientosTable.documentoTipo} = 'TICKET'
            and kardex_ticket.id = case
              when ${movimientosTable.documentoId} ~ '^[0-9]+$'
              then ${movimientosTable.documentoId}::integer
            end
            and kardex_ticket.folio::text ilike ${pattern}
        )`,
        sql`exists (
          select 1
          from salidas kardex_salida
          where ${movimientosTable.documentoTipo} in ('SALIDA', 'RECEPCION_SALIDA')
            and kardex_salida.id = case
              when ${movimientosTable.documentoId} ~ '^[0-9]+$'
              then ${movimientosTable.documentoId}::integer
            end
            and kardex_salida.folio::text ilike ${pattern}
        )`,
        sql`exists (
          select 1
          from movimientos kardex_origen
          join tickets kardex_ticket
            on kardex_ticket.id = case
              when kardex_origen.documento_id ~ '^[0-9]+$'
              then kardex_origen.documento_id::integer
            end
          where ${movimientosTable.tipo} = 'CANCELACION'
            and kardex_origen.id = ${movimientosTable.movimientoOrigenId}
            and kardex_origen.documento_tipo = 'TICKET'
            and kardex_ticket.folio::text ilike ${pattern}
        )`,
        sql`exists (
          select 1
          from movimientos kardex_origen
          join salidas kardex_salida
            on kardex_salida.id = case
              when kardex_origen.documento_id ~ '^[0-9]+$'
              then kardex_origen.documento_id::integer
            end
          where ${movimientosTable.tipo} = 'CANCELACION'
            and kardex_origen.id = ${movimientosTable.movimientoOrigenId}
            and kardex_origen.documento_tipo in ('SALIDA', 'RECEPCION_SALIDA')
            and kardex_salida.folio::text ilike ${pattern}
        )`,
      )!,
    );
  }
  return conditions;
}

function joinedBase() {
  return db
    .select({
      id: movimientosTable.id,
      createdAt: movimientosTable.createdAt,
      tipo: movimientosTable.tipo,
      cantidad: movimientosTable.cantidad,
      saldoPosterior: movimientosTable.saldoPosterior,
      productoId: movimientosTable.productoId,
      skuProducto: productosTable.sku,
      telaProducto: productosTable.tela,
      colorProducto: productosTable.color,
      unidadProducto: productosTable.unidad,
      rolloId: movimientosTable.rolloId,
      serie: rollosTable.serie,
      ubicacionId: movimientosTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      ubicacionActiva: ubicacionesTable.activa,
      usuarioId: movimientosTable.usuarioId,
      nombreUsuario: usuariosTable.nombre,
      username: usuariosTable.usuario,
      documentoTipo: movimientosTable.documentoTipo,
      documentoId: movimientosTable.documentoId,
      movimientoOrigenId: movimientosTable.movimientoOrigenId,
      justificacion: movimientosTable.justificacion,
      revisado: movimientosTable.revisado,
      revisadoPor: movimientosTable.revisadoPor,
      revisadoAt: movimientosTable.revisadoAt,
    })
    .from(movimientosTable)
    .innerJoin(productosTable, eq(movimientosTable.productoId, productosTable.id))
    .innerJoin(rollosTable, eq(movimientosTable.rolloId, rollosTable.id))
    .innerJoin(
      ubicacionesTable,
      eq(movimientosTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(usuariosTable, eq(movimientosTable.usuarioId, usuariosTable.id));
}

async function selectMovements(
  filters: KardexFiltersInput,
  pagination?: { limit: number; offset: number },
) {
  const conditions = whereConditions(filters);
  const query = joinedBase()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(movimientosTable.createdAt), desc(movimientosTable.id));
  return pagination
    ? query.limit(pagination.limit).offset(pagination.offset)
    : query;
}

type DocumentReference = {
  tipo: string | null;
  id: string | null;
};

async function enrichDocuments(rows: JoinedMovement[]) {
  const originIds = rows
    .map((row) => row.movimientoOrigenId)
    .filter((id): id is number => id != null);
  const origins = originIds.length
    ? await db
        .select({
          id: movimientosTable.id,
          documentoTipo: movimientosTable.documentoTipo,
          documentoId: movimientosTable.documentoId,
        })
        .from(movimientosTable)
        .where(inArray(movimientosTable.id, originIds))
    : [];
  const originMap = new Map(
    origins.map((origin) => [
      origin.id,
      { tipo: origin.documentoTipo, id: origin.documentoId },
    ]),
  );

  const references = rows.map((row): DocumentReference => {
    if (row.tipo === "CANCELACION" && row.movimientoOrigenId != null) {
      const inherited = originMap.get(row.movimientoOrigenId);
      if (inherited?.tipo && inherited.id) return inherited;
    }
    return { tipo: row.documentoTipo, id: row.documentoId };
  });
  const entradaIds = references
    .filter((reference) => reference.tipo === "ENTRADA" && reference.id)
    .map((reference) => Number(reference.id))
    .filter(Number.isSafeInteger);
  const entradas = entradaIds.length
    ? await db
        .select({
          id: entradasTable.id,
          folio: entradasTable.folio,
          iniciales: ubicacionesTable.iniciales,
        })
        .from(entradasTable)
        .innerJoin(
          ubicacionesTable,
          eq(entradasTable.ubicacionId, ubicacionesTable.id),
        )
        .where(
          or(
            inArray(entradasTable.id, entradaIds),
            inArray(entradasTable.folio, entradaIds),
          ),
        )
    : [];
  const entradaMap = new Map(
    entradas.flatMap((entrada) => {
      const document = {
        id: entrada.id,
        label: `${entrada.iniciales}-${String(entrada.folio).padStart(6, "0")}`,
      };
      // Historical RECEPCION movements may reference the entry folio rather
      // than its primary key; both must retain the same navigable document.
      return [[entrada.id, document], [entrada.folio, document]] as const;
    }),
  );
  const ticketIds = references
    .filter((reference) => reference.tipo === "TICKET" && reference.id)
    .map((reference) => Number(reference.id))
    .filter(Number.isSafeInteger);
  const salidaIds = references
    .filter(
      (reference) =>
        (reference.tipo === "SALIDA" ||
          reference.tipo === "RECEPCION_SALIDA") &&
        reference.id,
    )
    .map((reference) => Number(reference.id))
    .filter(Number.isSafeInteger);
  const [tickets, salidas] = await Promise.all([
    ticketIds.length
      ? db
          .select({
            id: ticketsTable.id,
            folio: ticketsTable.folio,
            clienteNombre: clientesTable.nombre,
          })
          .from(ticketsTable)
          .innerJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id))
          .where(inArray(ticketsTable.id, ticketIds))
      : [],
    salidaIds.length
      ? db
          .select({
            id: salidasTable.id,
            folio: salidasTable.folio,
            iniciales: ubicacionesTable.iniciales,
            destinoNombre: destinoUbicacion.nombre,
          })
          .from(salidasTable)
          .innerJoin(
            ubicacionesTable,
            eq(salidasTable.origenId, ubicacionesTable.id),
          )
          .leftJoin(destinoUbicacion, eq(salidasTable.destinoId, destinoUbicacion.id))
          .where(inArray(salidasTable.id, salidaIds))
      : [],
  ]);
  const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket.folio]));
  const ticketClientMap = new Map(
    tickets.map((ticket) => [ticket.id, ticket.clienteNombre]),
  );
  const salidaMap = new Map(
    salidas.map((salida) => [
      salida.id,
      `${salida.iniciales}-${String(salida.folio).padStart(6, "0")}`,
    ]),
  );
  const salidaDestinationMap = new Map(
    salidas.map((salida) => [salida.id, salida.destinoNombre]),
  );

  return rows.map((row, index) => {
    const reference = references[index]!;
    const document = resolveDocument(
      reference,
      entradaMap,
      ticketMap,
      salidaMap,
    );
    const salidaInmediata =
      (reference.tipo === "SALIDA" || reference.tipo === "RECEPCION_SALIDA") &&
      (row.tipo === "TRANSFERENCIA_SALIDA" || row.tipo === "TRANSFERENCIA_ENTRADA");
    const referencedTicketId =
      reference.tipo === "TICKET" &&
      reference.id &&
      ticketMap.has(Number(reference.id))
        ? Number(reference.id)
        : null;
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      revisadoAt: row.revisadoAt?.toISOString() ?? null,
      documentoTipo: reference.tipo ?? null,
      documentoId: reference.id ?? null,
      ticketId: referencedTicketId,
      movimientoOrigenId: row.movimientoOrigenId ?? null,
      justificacion: row.justificacion ?? null,
      revisadoPor: row.revisadoPor ?? null,
      documentoEtiqueta: salidaInmediata
        ? (row.tipo === "TRANSFERENCIA_SALIDA" ? "Salida a sitio" : "Entrada por salida")
        : document.label,
      documentoRuta: salidaInmediata && reference.id ? `/salidas/${reference.id}` : document.route,
      destinoEtiqueta:
        row.tipo === "VENTA" && reference.tipo === "TICKET" && reference.id
          ? (ticketClientMap.get(Number(reference.id)) ?? null)
          : row.tipo === "TRANSFERENCIA_SALIDA" &&
              reference.tipo === "SALIDA" &&
              reference.id
            ? (salidaDestinationMap.get(Number(reference.id)) ?? null)
            : row.tipo === "SALIDA_MOSTRADOR"
              ? "Mostrador"
              : null,
      referenciaRolloRuta: `/inventario/rollos/${row.rolloId}`,
    };
  });
}

function resolveDocument(
  reference: DocumentReference,
  entradaMap: Map<number, { id: number; label: string }>,
  ticketMap: Map<number, number>,
  salidaMap: Map<number, string>,
): { label: string | null; route: string | null } {
  if (!reference.tipo || !reference.id) return { label: null, route: null };
  if (reference.tipo === "ENTRADA") {
    const entry = entradaMap.get(Number(reference.id));
    return entry == null
      ? { label: null, route: null }
      : {
          label: `Entrada ${entry.label}`,
          route: `/entradas/${entry.id}/documento`,
        };
  }
  if (reference.tipo === "TICKET") {
    const ticketId = Number(reference.id);
    const folio = ticketMap.get(ticketId);
    if (folio == null) return { label: null, route: null };
    return {
      label: `Ticket ${folio}`,
      route: `/tickets/${ticketId}`,
    };
  }
  if (reference.tipo === "SALIDA") {
    const salidaId = Number(reference.id);
    const folio = salidaMap.get(salidaId);
    if (folio == null) return { label: null, route: null };
    return {
      label: `Salida ${folio}`,
      route: `/salidas/${salidaId}`,
    };
  }
  if (reference.tipo === "RECEPCION_SALIDA") {
    const salidaId = Number(reference.id);
    const folio = salidaMap.get(salidaId);
    if (folio == null) return { label: null, route: null };
    return {
      label: `Recepción de salida ${folio}`,
      route: `/salidas/${salidaId}/documento/recepcion`,
    };
  }
  return { label: null, route: null };
}

export async function getKardex(
  filters: KardexFiltersInput,
  pagination?: { page: number; pageSize: number },
) {
  const conditions = whereConditions(filters);
  const [{ total, totalMetros, totalKilos, totalBolsas, totalPiezas }] = await db
    .select({
      total: count(),
      totalMetros: sql<string>`coalesce(sum(abs(${movimientosTable.cantidad})) filter (where ${productosTable.unidad} = 'METRO'), 0)::text`,
      totalKilos: sql<string>`coalesce(sum(abs(${movimientosTable.cantidad})) filter (where ${productosTable.unidad} = 'KILO'), 0)::text`,
      totalBolsas: sql<string>`coalesce(sum(abs(${movimientosTable.cantidad})) filter (where ${productosTable.unidad} = 'BOLSA'), 0)::text`,
      totalPiezas: sql<string>`coalesce(sum(abs(${movimientosTable.cantidad})) filter (where ${productosTable.unidad} = 'PIEZA'), 0)::text`,
    })
    .from(movimientosTable)
    .innerJoin(productosTable, eq(movimientosTable.productoId, productosTable.id))
    .innerJoin(rollosTable, eq(movimientosTable.rolloId, rollosTable.id))
    .innerJoin(
      ubicacionesTable,
      eq(movimientosTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(usuariosTable, eq(movimientosTable.usuarioId, usuariosTable.id))
    .where(conditions.length ? and(...conditions) : undefined);
  const rows = await selectMovements(
    filters,
    pagination
      ? {
          limit: pagination.pageSize,
          offset: (pagination.page - 1) * pagination.pageSize,
        }
      : undefined,
  );
  return {
    movimientos: await enrichDocuments(rows),
    total: total ?? 0,
    resumen: {
      totalMetros: totalMetros ?? "0",
      totalKilos: totalKilos ?? "0",
      totalBolsas: totalBolsas ?? "0",
      totalPiezas: totalPiezas ?? "0",
    },
  };
}

export async function listKardexFilters(filters: {
  ubicacionId?: number;
  incluirUbicacionesInactivas: boolean;
}) {
  const conditions = whereConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;

  const [productos, usuarios, ubicaciones] = await Promise.all([
    db
      .selectDistinct({
        id: productosTable.id,
        sku: productosTable.sku,
        tela: productosTable.tela,
        color: productosTable.color,
        unidad: productosTable.unidad,
      })
      .from(movimientosTable)
      .innerJoin(
        productosTable,
        eq(movimientosTable.productoId, productosTable.id),
      )
      .innerJoin(
        ubicacionesTable,
        eq(movimientosTable.ubicacionId, ubicacionesTable.id),
      )
      .where(where)
      .orderBy(asc(productosTable.sku)),
    db
      .selectDistinct({
        id: usuariosTable.id,
        nombre: usuariosTable.nombre,
        username: usuariosTable.usuario,
      })
      .from(movimientosTable)
      .innerJoin(
        usuariosTable,
        eq(movimientosTable.usuarioId, usuariosTable.id),
      )
      .innerJoin(
        ubicacionesTable,
        eq(movimientosTable.ubicacionId, ubicacionesTable.id),
      )
      .where(where)
      .orderBy(asc(usuariosTable.nombre)),
    db
      .selectDistinct({
        id: ubicacionesTable.id,
        nombre: ubicacionesTable.nombre,
        activa: ubicacionesTable.activa,
      })
      .from(movimientosTable)
      .innerJoin(
        ubicacionesTable,
        eq(movimientosTable.ubicacionId, ubicacionesTable.id),
      )
      .where(where)
      .orderBy(asc(ubicacionesTable.nombre)),
  ]);

  return {
    productos,
    usuarios,
    ubicaciones,
    tipos: [...tipoMovimientoEnum.enumValues],
  };
}