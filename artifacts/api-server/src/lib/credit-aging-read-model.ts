import { pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { projectCreditLedger, type CreditLedgerMovement } from "./credit-allocation";

export type CustomerCreditProjection = ReturnType<typeof projectCreditLedger>;
type CreditLedgerQuery = Pick<typeof pool, "query">;

type CreditReservationQuery = Pick<typeof pool, "query">;

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
};

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
  }));
}

function projectRows(rows: CreditLedgerRow[]): CustomerCreditProjection {
  return projectCreditLedger(mapRows(rows));
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
       m.created_at,m.fecha_vencimiento,m.dias_plazo,m.notas,t.folio
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
): Promise<CustomerCreditProjection> {
  return projectCreditLedger(await loadCustomerCreditLedger(clienteId, database));
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
      m.created_at,m.fecha_vencimiento,m.dias_plazo,m.notas,t.folio
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

/**
 * POS credit intent is a committed reservation until the ticket is collected
 * or cancelled. It is intentionally separate from the immutable ledger: no
 * receivable has been issued yet.
 */
export async function loadCustomerCreditReservationCents(
  clienteId: number,
  database: CreditReservationQuery = pool,
  excludeTicketId?: number,
): Promise<number> {
  const result = await database.query<{ cents: string }>(
    `SELECT COALESCE(ROUND(SUM(total) * 100), 0)::bigint::text AS cents
       FROM tickets
      WHERE cliente_id=$1 AND credito=true AND cobrado=false AND estado='VENDIDO'
        AND ($2::integer IS NULL OR id <> $2)`,
    [clienteId, excludeTicketId ?? null],
  );
  return Number(result.rows[0]?.cents ?? "0");
}

export async function loadCustomerCreditReservationCentsInTransaction(
  clienteId: number,
  tx: { execute(query: any): Promise<unknown> },
  excludeTicketId?: number,
): Promise<number> {
  const result = await tx.execute(sql`
    SELECT COALESCE(ROUND(SUM(total) * 100), 0)::bigint::text AS cents
      FROM tickets
     WHERE cliente_id=${clienteId} AND credito=true AND cobrado=false AND estado='VENDIDO'
       AND (${excludeTicketId ?? null}::integer IS NULL OR id <> ${excludeTicketId ?? null})
  `);
  return Number((result as { rows: Array<{ cents: string }> }).rows[0]?.cents ?? "0");
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
       m.created_at,m.fecha_vencimiento,m.dias_plazo,m.notas,t.folio
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