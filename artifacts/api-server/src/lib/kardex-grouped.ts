import {
  enrichKardexMovements,
  filteredMovementQuery,
  type KardexFiltersInput,
  type JoinedMovement,
} from "./kardex";
import { count, desc, max, sql } from "drizzle-orm";
import { db } from "@workspace/db";

const UNIT_ORDER = ["METRO", "KILO", "BOLSA", "PIEZA"] as const;

type KardexRow = Awaited<ReturnType<typeof enrichKardexMovements>>[number];

export type KardexGroupedUnitTotal = {
  unidad: string;
  cantidad: string;
};

export type KardexGroupedRoll = {
  movementId: number;
  rolloId: number;
  serie: string;
  cantidad: string;
  unidad: string;
  createdAt: string;
  saldoPosterior: string;
  referenciaRolloRuta: string;
};

export type KardexGroupedRow = {
  groupId: string;
  createdAt: string;
  fechaMin: string;
  fechaMax: string;
  latestDate: string;
  latestMovementId: number;
  tipo: KardexRow["tipo"];
  ubicacionId: number;
  nombreUbicacion: string;
  ubicacionActiva: boolean;
  distinctRolloCount: number;
  partialitiesMerged: number;
  totalesPorUnidad: KardexGroupedUnitTotal[];
  productos: Array<{
    productoId: number;
    skuProducto: string;
    telaProducto: string;
    colorProducto: string;
    unidadProducto: string;
  }>;
  usuarios: Array<{
    usuarioId: number;
    nombreUsuario: string;
    username: string;
  }>;
  documentoTipo: string | null;
  documentoId: string | null;
  documentoEtiqueta: string | null;
  documentoRuta: string | null;
  ticketId: number | null;
  destinoEtiqueta: string | null;
  justificacion: string | null;
  rollos: KardexGroupedRoll[];
};

type DecimalParts = {
  sign: bigint;
  digits: bigint;
  scale: number;
};

/**
 * Adds PostgreSQL numeric values without converting them to a JS number.
 * Kardex quantities are exact decimals and must remain exact during the
 * presentation-only aggregation.
 */
export function addExactDecimal(left: string, right: string): string {
  const parse = (value: string): DecimalParts => {
    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
    if (!match) {
      throw new Error(`Cantidad decimal inválida: ${value}`);
    }
    const fraction = match[3] ?? "";
    return {
      sign: match[1] === "-" ? -1n : 1n,
      digits: BigInt(`${match[2]}${fraction}`),
      scale: fraction.length,
    };
  };

  const a = parse(left);
  const b = parse(right);
  const scale = Math.max(a.scale, b.scale);
  const aScale = 10n ** BigInt(scale - a.scale);
  const bScale = 10n ** BigInt(scale - b.scale);
  const sum = a.sign * a.digits * aScale + b.sign * b.digits * bScale;
  const negative = sum < 0n;
  const absolute = negative ? -sum : sum;
  const raw = absolute.toString().padStart(scale + 1, "0");
  const integer = scale > 0 ? raw.slice(0, -scale) : raw;
  const fraction = scale > 0 ? raw.slice(-scale).replace(/0+$/, "") : "";
  const normalized = fraction ? `${integer}.${fraction}` : integer;
  return negative && normalized !== "0" ? `-${normalized}` : normalized;
}

function compareDate(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function groupKey(row: KardexRow): { key: string; verifiedDocument: boolean } {
  const verifiedDocument =
    row.documentoRuta != null &&
    row.documentoTipo != null &&
    row.documentoId != null;
  if (!verifiedDocument) {
    // A missing/unverified document is deliberately not grouped. This keeps
    // the movement ID and its justification as the traceable fallback.
    return { key: `movement:${row.id}`, verifiedDocument: false };
  }
  return {
    key: JSON.stringify([
      row.documentoTipo,
      row.documentoId,
      row.tipo,
      row.ubicacionId,
    ]),
    verifiedDocument: true,
  };
}

/**
 * Groups only presentation rows. The kardex remains rollo-by-rollo; this
 * helper never writes to or changes the movement ledger.
 */
export function groupKardexRows(rows: readonly KardexRow[]): KardexGroupedRow[] {
  const groups = new Map<
    string,
    { verifiedDocument: boolean; rows: KardexRow[] }
  >();

  for (const row of rows) {
    const { key, verifiedDocument } = groupKey(row);
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(key, { verifiedDocument, rows: [row] });
    }
  }

  const output = [...groups.entries()].map(([groupId, group]) => {
    const orderedRows = [...group.rows].sort((a, b) => {
      const dateOrder = compareDate(b.createdAt, a.createdAt);
      return dateOrder || b.id - a.id;
    });
    const earliest = orderedRows.reduce((current, row) =>
      compareDate(row.createdAt, current.createdAt) < 0 ? row : current,
    );
    const latest = orderedRows[0]!;
    const rolloIds = new Set(orderedRows.map((row) => row.rolloId));
    const totals = new Map<string, string>();
    for (const row of orderedRows) {
      totals.set(
        row.unidadProducto,
        addExactDecimal(totals.get(row.unidadProducto) ?? "0", row.cantidad),
      );
    }
    const totalesPorUnidad = [...totals.entries()]
      .sort(([left], [right]) => {
        const leftIndex = UNIT_ORDER.indexOf(left as (typeof UNIT_ORDER)[number]);
        const rightIndex = UNIT_ORDER.indexOf(right as (typeof UNIT_ORDER)[number]);
        if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      })
      .map(([unidad, cantidad]) => ({ unidad, cantidad }));
    const products = new Map<number, KardexGroupedRow["productos"][number]>();
    const users = new Map<number, KardexGroupedRow["usuarios"][number]>();
    for (const row of orderedRows) {
      products.set(row.productoId, {
        productoId: row.productoId,
        skuProducto: row.skuProducto,
        telaProducto: row.telaProducto,
        colorProducto: row.colorProducto,
        unidadProducto: row.unidadProducto,
      });
      users.set(row.usuarioId, {
        usuarioId: row.usuarioId,
        nombreUsuario: row.nombreUsuario,
        username: row.username,
      });
    }
    const firstJustification =
      orderedRows.find((row) => row.justificacion)?.justificacion ?? null;
    const documentRow = orderedRows.find(
      (row) => row.documentoTipo != null || row.documentoId != null,
    ) ?? latest;

    return {
      groupId,
      createdAt: latest.createdAt,
      fechaMin: earliest.createdAt,
      fechaMax: latest.createdAt,
      latestDate: latest.createdAt,
      latestMovementId: latest.id,
      tipo: latest.tipo,
      ubicacionId: latest.ubicacionId,
      nombreUbicacion: latest.nombreUbicacion,
      ubicacionActiva: latest.ubicacionActiva,
      distinctRolloCount: rolloIds.size,
      partialitiesMerged: orderedRows.length,
      totalesPorUnidad,
      productos: [...products.values()],
      usuarios: [...users.values()],
      documentoTipo: group.verifiedDocument ? documentRow.documentoTipo : null,
      documentoId: group.verifiedDocument ? documentRow.documentoId : null,
      documentoEtiqueta: group.verifiedDocument
        ? documentRow.documentoEtiqueta
        : null,
      documentoRuta: group.verifiedDocument ? documentRow.documentoRuta : null,
      ticketId: group.verifiedDocument ? documentRow.ticketId : null,
      destinoEtiqueta: latest.destinoEtiqueta,
      justificacion: firstJustification,
      rollos: orderedRows.map((row) => ({
        movementId: row.id,
        rolloId: row.rolloId,
        serie: row.serie,
        cantidad: row.cantidad,
        unidad: row.unidadProducto,
        createdAt: row.createdAt,
        saldoPosterior: row.saldoPosterior,
        referenciaRolloRuta: row.referenciaRolloRuta,
      })),
    } satisfies KardexGroupedRow;
  });

  return output.sort((left, right) => {
    const dateOrder = compareDate(right.latestDate, left.latestDate);
    return dateOrder || right.latestMovementId - left.latestMovementId;
  });
}

const NAVIGABLE_TICKET_TYPES = [
  "TICKET",
  "NOTA",
  "TICKET_BOLSA_NORMAL",
  "TICKET_PIEZA_NORMAL",
  "TICKET_BOLSA_METREADO",
  "TICKET_METRO_METREADO",
] as const;

function canonicalMovementQuery(filters: KardexFiltersInput) {
  const filtered = filteredMovementQuery(filters).as("kardex_filtered");
  const inheritedReference = sql<boolean>`
    ${filtered.tipo} = 'CANCELACION'
    AND ${filtered.originRolloId} IS NOT NULL
    AND ${filtered.originRolloId} = ${filtered.rolloId}
    AND ${filtered.originDocumentoTipo} IS NOT NULL
    AND ${filtered.originDocumentoId} IS NOT NULL
  `;
  const canonicalType = sql<string | null>`
    CASE
      WHEN ${filtered.tipo} = 'CANCELACION'
        THEN CASE WHEN ${inheritedReference}
          THEN ${filtered.originDocumentoTipo}
          ELSE NULL
        END
      ELSE ${filtered.documentoTipo}
    END
  `.as("canonical_document_type");
  const canonicalId = sql<string | null>`
    CASE
      WHEN ${filtered.tipo} = 'CANCELACION'
        THEN CASE WHEN ${inheritedReference}
          THEN CASE WHEN ${filtered.originDocumentoTipo} = 'ENTRADA'
            THEN ${filtered.recepcionId}::text
            ELSE ${filtered.originDocumentoId}
          END
          ELSE NULL
        END
      ELSE CASE WHEN ${filtered.documentoTipo} = 'ENTRADA'
        THEN ${filtered.recepcionId}::text
        ELSE ${filtered.documentoId}
      END
    END
  `.as("canonical_document_id");
  return db
    .select({
      id: filtered.id,
      createdAt: filtered.createdAt,
      tipo: filtered.tipo,
      cantidad: filtered.cantidad,
      saldoPosterior: filtered.saldoPosterior,
      productoId: filtered.productoId,
      skuProducto: filtered.skuProducto,
      telaProducto: filtered.telaProducto,
      colorProducto: filtered.colorProducto,
      unidadProducto: filtered.unidadProducto,
      rolloId: filtered.rolloId,
      serie: filtered.serie,
      recepcionId: filtered.recepcionId,
      ubicacionId: filtered.ubicacionId,
      nombreUbicacion: filtered.nombreUbicacion,
      ubicacionActiva: filtered.ubicacionActiva,
      usuarioId: filtered.usuarioId,
      nombreUsuario: filtered.nombreUsuario,
      username: filtered.username,
      documentoTipo: filtered.documentoTipo,
      documentoId: filtered.documentoId,
      movimientoOrigenId: filtered.movimientoOrigenId,
      justificacion: filtered.justificacion,
      revisado: filtered.revisado,
      revisadoPor: filtered.revisadoPor,
      revisadoAt: filtered.revisadoAt,
      originRolloId: filtered.originRolloId,
      originDocumentoTipo: filtered.originDocumentoTipo,
      originDocumentoId: filtered.originDocumentoId,
      canonicalDocumentType: canonicalType,
      canonicalDocumentId: canonicalId,
    })
    .from(filtered)
    .as("kardex_canonical");
}

function safeDocumentId(documentId: unknown) {
  return sql`CASE
    WHEN ${documentId}::text ~ '^[0-9]+$'
    THEN ${documentId}::text::numeric
    ELSE NULL
  END`;
}

function verifiedDocumentExpression(
  source: ReturnType<typeof canonicalMovementQuery>,
) {
  const ticketTypes = sql.join(
    NAVIGABLE_TICKET_TYPES.map((type) => sql`${type}`),
    sql`, `,
  );
  const documentId = safeDocumentId(source.canonicalDocumentId);
  return sql<boolean>`CASE
    WHEN ${source.canonicalDocumentType} = 'ENTRADA' THEN EXISTS (
      SELECT 1
      FROM entradas grouped_entradas
      JOIN ubicaciones grouped_entrada_locations
        ON grouped_entrada_locations.id = grouped_entradas.ubicacion_id
      WHERE grouped_entradas.id = ${documentId}
    )
    WHEN ${source.canonicalDocumentType} IN (${ticketTypes}) THEN EXISTS (
      SELECT 1
      FROM tickets grouped_tickets
      JOIN clientes grouped_ticket_clients
        ON grouped_ticket_clients.id = grouped_tickets.cliente_id
      WHERE grouped_tickets.id = ${documentId}
    )
    WHEN ${source.canonicalDocumentType} IN ('SALIDA', 'RECEPCION_SALIDA') THEN EXISTS (
      SELECT 1
      FROM salidas grouped_salidas
      JOIN ubicaciones grouped_salida_locations
        ON grouped_salida_locations.id = grouped_salidas.origen_id
      WHERE grouped_salidas.id = ${documentId}
    )
    WHEN ${source.canonicalDocumentType} = 'MOVIMIENTO_CREDITO' THEN EXISTS (
      SELECT 1
      FROM movimientos_credito grouped_credit_movements
      WHERE grouped_credit_movements.id = ${documentId}
        AND grouped_credit_movements.cliente_id > 0
    )
    ELSE FALSE
  END`;
}

export function buildKardexGroupedQueries(
  filters: KardexFiltersInput,
  pagination: { page: number; pageSize: number },
) {
  const canonical = canonicalMovementQuery(filters);
  const verifiedDocument = verifiedDocumentExpression(canonical);
  const resolved = db
    .select({
      ...canonical._.selectedFields,
      verifiedDocument: verifiedDocument.as("verified_document"),
    })
    .from(canonical)
    .as("kardex_resolved");
  const identity = db
    .select({
      ...resolved._.selectedFields,
      groupingDocumentType: sql<string | null>`
        CASE WHEN ${resolved.verifiedDocument}
          THEN ${resolved.canonicalDocumentType}
          ELSE NULL
        END
      `.as("grouping_document_type"),
      groupingDocumentId: sql<string>`
        CASE WHEN ${resolved.verifiedDocument}
          THEN ${resolved.canonicalDocumentId}
          ELSE ${resolved.id}::text
        END
      `.as("grouping_document_id"),
    })
    .from(resolved)
    .as("kardex_identity");
  const groupingKey = sql<string>`CASE WHEN ${identity.verifiedDocument}
    THEN concat(
      ${identity.groupingDocumentType}, ':',
      ${identity.groupingDocumentId}, ':',
      ${identity.tipo}, ':',
      ${identity.ubicacionId}
    )
    ELSE concat('movement:', ${identity.groupingDocumentId})
  END`;
  const groups = db
    .select({
      groupKey: groupingKey.as("group_key"),
      latestDate: max(identity.createdAt).as("latest_date"),
      latestMovementId: sql<number>`(
        array_agg(
          ${identity.id}
          ORDER BY ${identity.createdAt} DESC, ${identity.id} DESC
        )
      )[1]`.as("latest_movement_id"),
    })
    .from(identity)
    .groupBy(
      identity.verifiedDocument,
      identity.groupingDocumentType,
      identity.groupingDocumentId,
      identity.tipo,
      identity.ubicacionId,
    )
    .as("kardex_groups");
  const selectedGroups = db
    .select({
      groupKey: groups.groupKey,
      latestDate: groups.latestDate,
      latestMovementId: groups.latestMovementId,
    })
    .from(groups)
    .orderBy(desc(groups.latestDate), desc(groups.latestMovementId))
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize)
    .as("kardex_selected_groups");
  const selectedCanonical = db
    .select(identity._.selectedFields)
    .from(identity)
    .innerJoin(
      selectedGroups,
      sql`${groupingKey} = ${selectedGroups.groupKey}`,
    )
    .orderBy(desc(identity.createdAt), desc(identity.id));
  const countGroups = db
    .select({ total: count() })
    .from(groups);
  const summary = db
    .select({
      totalMetros: sql<string>`coalesce(sum(abs(${identity.cantidad}))
        filter (where ${identity.unidadProducto} = 'METRO'), 0)::text`.as("total_metros"),
      totalKilos: sql<string>`coalesce(sum(abs(${identity.cantidad}))
        filter (where ${identity.unidadProducto} = 'KILO'), 0)::text`.as("total_kilos"),
      totalBolsas: sql<string>`coalesce(sum(abs(${identity.cantidad}))
        filter (where ${identity.unidadProducto} = 'BOLSA'), 0)::text`.as("total_bolsas"),
      totalPiezas: sql<string>`coalesce(sum(abs(${identity.cantidad}))
        filter (where ${identity.unidadProducto} = 'PIEZA'), 0)::text`.as("total_piezas"),
    })
    .from(identity);
  return { groupCount: countGroups, totals: summary, selectedRows: selectedCanonical };
}

export async function getKardexGrouped(
  filters: KardexFiltersInput,
  pagination: { page: number; pageSize: number },
) {
  const { groupCount, totals, selectedRows } = buildKardexGroupedQueries(
    filters,
    pagination,
  );
  const [groupCountResult, totalsResult, selectedRowsResult] = await Promise.all([
    groupCount,
    totals,
    selectedRows,
  ]);
  const enrichedRows = await enrichKardexMovements(
    selectedRowsResult as unknown as JoinedMovement[],
  );
  const grupos = groupKardexRows(enrichedRows);
  const total = Number(groupCountResult[0]?.total ?? 0);
  return {
    grupos,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
    resumen: {
      totalMetros: totalsResult[0]?.totalMetros ?? "0",
      totalKilos: totalsResult[0]?.totalKilos ?? "0",
      totalBolsas: totalsResult[0]?.totalBolsas ?? "0",
      totalPiezas: totalsResult[0]?.totalPiezas ?? "0",
    },
  };
}