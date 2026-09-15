import { pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  projectCreditLedger,
  type CreditFavorApplication,
  type CreditLedgerProjectionOptions,
  type CreditLedgerMovement,
} from "./credit-allocation";

export type CustomerCreditProjection = ReturnType<typeof projectCreditLedger>;
type CreditLedgerQuery = Pick<typeof pool, "query">;

type CreditLedgerRow = {
  cliente_id: number;
  id: number;
  ticket_id: number | null;
  directed_movimiento_id: number | null;
  movimiento_origen_id: number | null;
  tipo: CreditLedgerMovement["tipo"];
  importe: string;
  created_at: Date;
  fecha_vencimiento: string | Date | null;
  dias_plazo: number | null;
  notas: string | null;
  folio: number | null;
  metadata: string | null;
  /**
   * Read only from the historical note metadata.  New notes deliberately omit
   * this marker so the canonical projector can use available favor
   * automatically.
   */
  prevent_implicit_favor: boolean;
  immutable_applied_cents: string | number | null;
  explicit_favor_applications: Array<{
    sourceId: number;
    targetId: number;
    amountCents: number;
  }> | null;
};

function parseExplicitFavorApplications(
  value: CreditLedgerRow["explicit_favor_applications"],
): CreditFavorApplication[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item == null || typeof item !== "object") return [];
    const sourceId = Number(item.sourceId);
    const targetId = Number(item.targetId);
    const amountCents = Number(item.amountCents);
    return Number.isSafeInteger(sourceId) &&
      Number.isSafeInteger(targetId) &&
      Number.isSafeInteger(amountCents) &&
      amountCents > 0
      ? [{ sourceId, targetId, amountCents }]
      : [];
  });
}

function mapRows(rows: CreditLedgerRow[]): CreditLedgerMovement[] {
  return rows.map((row) => ({
    id: Number(row.id),
    ticketId: row.ticket_id == null ? null : Number(row.ticket_id),
    directedMovimientoId:
      row.directed_movimiento_id == null
        ? null
        : Number(row.directed_movimiento_id),
    movimientoOrigenId: row.movimiento_origen_id == null ? null : Number(row.movimiento_origen_id),
    tipo: row.tipo,
    importe: row.importe,
    createdAt: new Date(row.created_at),
    fechaVencimiento: row.fecha_vencimiento,
    diasPlazo: row.dias_plazo == null ? null : Number(row.dias_plazo),
    notas: row.notas,
    folio: row.folio == null ? null : Number(row.folio),
    preventImplicitFavor: row.prevent_implicit_favor === true,
    immutableAppliedCents:
      row.immutable_applied_cents == null
        ? 0
        : Number(row.immutable_applied_cents),
    explicitFavorApplications: parseExplicitFavorApplications(
      row.explicit_favor_applications,
    ),
  }));
}

function projectRows(
  rows: CreditLedgerRow[],
  options: CreditLedgerProjectionOptions = {},
): CustomerCreditProjection {
  // Always project the complete customer ledger.  Callers may filter the
  // returned rows for presentation, but never filter this query first: doing
  // so would reset FIFO's starting debt/favor balance.
  return projectCreditLedger(mapRows(rows), options);
}

/** Loads the complete immutable customer ledger, including paid charges. */
export async function loadCustomerCreditLedger(
  clienteId: number,
  database: CreditLedgerQuery = pool,
): Promise<CreditLedgerMovement[]> {
  const result = await database.query<CreditLedgerRow>(
    `SELECT m.cliente_id,m.id,m.ticket_id,
       directed_sale.id AS directed_movimiento_id,
       m.movimiento_origen_id,m.tipo,m.importe::text,
        m.created_at,m.fecha_vencimiento,m.dias_plazo,m.notas,t.folio,m.metadata,
        COALESCE(m.metadata LIKE '%"preventImplicitFavor":true%', false)
          AS prevent_implicit_favor,
         -- Only legacy marked notes may supply directed historical evidence.
         -- New automatic notes remain ordinary FIFO even if an application
         -- row exists for Ver Reparto.
         COALESCE((
          SELECT json_agg(json_build_object(
            'sourceId', a.abono_movimiento_id,
            'targetId', a.venta_movimiento_id,
            'amountCents', round(a.importe * 100)
          ))
          FROM aplicaciones_credito a
          JOIN movimientos_credito favor_sale
            ON favor_sale.id = a.venta_movimiento_id
          WHERE a.abono_movimiento_id = m.id
             AND favor_sale.metadata LIKE '%"preventImplicitFavor":true%'
        ), '[]'::json) AS explicit_favor_applications
         ,COALESCE((
           SELECT round(COALESCE(SUM(a.importe), 0) * 100)
           FROM aplicaciones_credito a
           WHERE a.abono_movimiento_id = m.id
         ), 0) AS immutable_applied_cents
     FROM movimientos_credito m
     LEFT JOIN solicitudes_pago_dirigido request
       ON request.tipo='CLIENTE' AND request.estado='APROBADA' AND request.movimiento_id=m.id
     LEFT JOIN movimientos_credito directed_sale
       ON directed_sale.id=request.documento_movimiento_id
      AND directed_sale.tipo='VENTA_CREDITO'
       AND directed_sale.cliente_id=m.cliente_id
     LEFT JOIN tickets t ON t.id=m.ticket_id
     WHERE m.cliente_id=$1 ORDER BY m.created_at,m.id`,
    [clienteId],
  );
  return mapRows(result.rows);
}

/** Shared DB adapter: load immutable ledger evidence, then project in TypeScript. */
export async function loadCustomerCreditProjection(
  clienteId: number,
  database: CreditLedgerQuery = pool,
  options: CreditLedgerProjectionOptions = {},
): Promise<CustomerCreditProjection> {
  return projectCreditLedger(
    await loadCustomerCreditLedger(clienteId, database),
    options,
  );
}

/** Transaction adapter used by posting paths that already hold the customer lock. */
export async function loadCustomerCreditLedgerInTransaction(
  clienteId: number,
  tx: { execute(query: any): Promise<unknown> },
): Promise<CreditLedgerMovement[]> {
  const result = await tx.execute(sql`
     SELECT m.cliente_id,m.id,m.ticket_id,
        directed_sale.id AS directed_movimiento_id,
        m.movimiento_origen_id,m.tipo,m.importe::text,
        m.created_at,m.fecha_vencimiento,m.dias_plazo,m.notas,t.folio,m.metadata,
        COALESCE(m.metadata LIKE '%"preventImplicitFavor":true%', false)
          AS prevent_implicit_favor,
        COALESCE((
          SELECT json_agg(json_build_object(
            'sourceId', a.abono_movimiento_id,
            'targetId', a.venta_movimiento_id,
            'amountCents', round(a.importe * 100)
          ))
          FROM aplicaciones_credito a
          JOIN movimientos_credito favor_sale
            ON favor_sale.id = a.venta_movimiento_id
          WHERE a.abono_movimiento_id = m.id
         AND favor_sale.metadata LIKE '%"preventImplicitFavor":true%'
        ), '[]'::json) AS explicit_favor_applications
         ,COALESCE((
           SELECT round(COALESCE(SUM(a.importe), 0) * 100)
           FROM aplicaciones_credito a
           WHERE a.abono_movimiento_id = m.id
         ), 0) AS immutable_applied_cents
    FROM movimientos_credito m
    LEFT JOIN solicitudes_pago_dirigido directed_request
      ON directed_request.tipo='CLIENTE'
     AND directed_request.estado='APROBADA'
     AND directed_request.movimiento_id=m.id
    LEFT JOIN movimientos_credito directed_sale
      ON directed_sale.id=directed_request.documento_movimiento_id
     AND directed_sale.tipo='VENTA_CREDITO'
     AND directed_sale.cliente_id=m.cliente_id
    LEFT JOIN tickets t ON t.id=m.ticket_id
    WHERE m.cliente_id=${clienteId}
    ORDER BY m.created_at,m.id
  `);
  return mapRows((result as { rows: CreditLedgerRow[] }).rows);
}

export async function loadCustomerCreditProjectionInTransaction(
  clienteId: number,
  tx: { execute(query: any): Promise<unknown> },
): Promise<CustomerCreditProjection> {
  return projectCreditLedger(
    await loadCustomerCreditLedgerInTransaction(clienteId, tx),
  );
}

/** Bulk adapter. It always performs at most one ledger query, including on a transaction. */
export async function loadCustomerCreditProjections(
  clienteIds: number[],
  database: CreditLedgerQuery = pool,
): Promise<Map<number, CustomerCreditProjection>> {
  const ids = [...new Set(clienteIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return new Map();
  const result = await database.query<CreditLedgerRow>(
    `SELECT m.cliente_id,m.id,m.ticket_id,
       directed_sale.id AS directed_movimiento_id,
       m.movimiento_origen_id,m.tipo,m.importe::text,
        m.created_at,m.fecha_vencimiento,m.dias_plazo,m.notas,t.folio,m.metadata,
        COALESCE(m.metadata LIKE '%"preventImplicitFavor":true%', false)
          AS prevent_implicit_favor,
        COALESCE((
          SELECT json_agg(json_build_object(
            'sourceId', a.abono_movimiento_id,
            'targetId', a.venta_movimiento_id,
            'amountCents', round(a.importe * 100)
          ))
          FROM aplicaciones_credito a
          JOIN movimientos_credito favor_sale
            ON favor_sale.id = a.venta_movimiento_id
          WHERE a.abono_movimiento_id = m.id
           AND favor_sale.metadata LIKE '%"preventImplicitFavor":true%'
        ), '[]'::json) AS explicit_favor_applications
         ,COALESCE((
           SELECT round(COALESCE(SUM(a.importe), 0) * 100)
           FROM aplicaciones_credito a
           WHERE a.abono_movimiento_id = m.id
         ), 0) AS immutable_applied_cents
     FROM movimientos_credito m
     LEFT JOIN solicitudes_pago_dirigido request
       ON request.tipo='CLIENTE' AND request.estado='APROBADA' AND request.movimiento_id=m.id
     LEFT JOIN movimientos_credito directed_sale
       ON directed_sale.id=request.documento_movimiento_id
      AND directed_sale.tipo='VENTA_CREDITO'
       AND directed_sale.cliente_id=m.cliente_id
     LEFT JOIN tickets t ON t.id=m.ticket_id
     WHERE m.cliente_id=ANY($1::int[]) ORDER BY m.cliente_id,m.created_at,m.id`,
    [ids],
  );
  const grouped = new Map<number, CreditLedgerRow[]>();
  for (const row of result.rows) {
    const id = Number(row.cliente_id);
    const rows = grouped.get(id) ?? [];
    rows.push(row);
    grouped.set(id, rows);
  }
  return new Map(ids.map((id) => [id, projectRows(grouped.get(id) ?? [])]));
}