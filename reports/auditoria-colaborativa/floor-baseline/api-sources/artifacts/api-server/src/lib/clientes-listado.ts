import { centsToMoney } from "./credit-allocation";
import { loadCustomerCreditProjections, type CreditLedgerQuery } from "./credit-aging-read-model";
import { accountedDocumentAt, accountedDocumentPredicate } from "./accounted-document";

export type ListadoQuery = {
  q?: string; sort?: string; direction?: string; period?: string;
  page?: number; pageSize?: number; active?: string;
};
type Customer = {
  id: number; nombre: string; rfc: string | null; telefono: string | null;
  limiteCredito?: string; saldoActual?: string; saldoAFavor?: string;
  movementCount: number | null; lastActivity: string | null;
  [key: string]: unknown;
};
const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
export function matchesCustomer(row: Pick<Customer, "nombre" | "rfc" | "telefono">, input: string) {
  const q = normalize(input.trim());
  if (!q) return true;
  const words = q.split(/\s+/);
  const name = normalize(row.nombre);
  const phone = input.replace(/\D/g, "");
  return words.every(word => name.includes(word)) ||
    normalize(row.rfc ?? "").includes(q.replace(/[\s-]/g, "")) ||
    (phone.length > 0 && /^[\d\s()+.-]+$/.test(input) && (row.telefono ?? "").replace(/\D/g, "").includes(phone));
}

/** One event per processed ticket/note, plus unreversed ABONOs. No line joins,
 * credit-sale ledger duplication, import dates or synthetic activity. Null
 * processing timestamps stay unknown instead of borrowing created_at. */
export function activityReadQuery(ids: number[], siteIds: number[] | null, period: string) {
  const interval = period === "1m" ? "1 month" : period === "3m" ? "3 months" : "1 year";
  return {
    text: `WITH events AS (
      SELECT t.cliente_id,${accountedDocumentAt("t")} AS happened_at
      FROM tickets t WHERE t.cliente_id=ANY($1::int[]) AND ${accountedDocumentPredicate("t")}
        AND ($2::int[] IS NULL OR t.ubicacion_id=ANY($2::int[]))
      UNION ALL
      SELECT m.cliente_id,m.created_at FROM movimientos_credito m
      LEFT JOIN tickets t ON t.id=m.ticket_id
      WHERE m.cliente_id=ANY($1::int[]) AND m.tipo='ABONO'
        AND ($2::int[] IS NULL OR COALESCE(m.sitio_origen_id,t.ubicacion_id)=ANY($2::int[]))
        AND NOT EXISTS (SELECT 1 FROM movimientos_credito r
          WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=m.id AND r.importe>0)
    ) SELECT cliente_id,count(*) FILTER(WHERE $3::boolean OR
      happened_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City'
        - interval '${interval}') AT TIME ZONE 'America/Mexico_City'))::int AS count,
      max(happened_at) AS last FROM events GROUP BY cliente_id`,
    values: [ids, siteIds, period === "all"],
  };
}

export async function readClientesListado(database: CreditLedgerQuery, input: ListadoQuery, financial: boolean, siteIds: number[] | null) {
  const page = input.page ?? 1, pageSize = input.pageSize ?? 50;
  // Small master catalog stays bounded on the wire; only one canonical bulk
  // ledger read, not one query/client. Search happens before expensive reads.
  const result = await database.query<Customer>(`SELECT id,nombre,telefono,correo,
    direccion_particular AS "direccionParticular",direccion_particular AS direccion,
    direccion_entrega AS "direccionEntrega",rfc,notas,activo,es_sistema AS "esSistema",
    contacto_nombre AS "contactoNombre",recibe_nota_sin_precios AS "recibeNotaSinPrecios",
    dias_credito AS "diasCredito",created_at AS "createdAt",updated_at AS "updatedAt"
    ${financial ? ',limite_credito::text AS "limiteCredito"' : ""}
    FROM clientes WHERE ($1::boolean IS NULL OR activo=$1::boolean)`,
    [input.active === undefined ? null : input.active === "true"]);
  const rows = result.rows.filter(row => matchesCustomer(row, input.q ?? ""));
  for (const row of rows) { row.movementCount = financial ? 0 : null; row.lastActivity = null; }
  if (financial && rows.length) {
    const ids = rows.map(row => row.id);
    const activityQuery = activityReadQuery(ids, siteIds, input.period ?? "all");
    const activity = await database.query<{ cliente_id: number; count: number; last: Date | null }>(activityQuery.text, activityQuery.values);
    const byId = new Map(activity.rows.map(row => [row.cliente_id, row]));
    // Debt is global canonical FIFO, exactly as the existing customer list;
    // activity alone is limited to the authorized sites.
    const balances = await loadCustomerCreditProjections(ids, database);
    for (const row of rows) {
      row.movementCount = byId.get(row.id)?.count ?? 0;
      const last = byId.get(row.id)?.last;
      row.lastActivity = last ? new Date(last).toISOString() : null;
      row.saldoActual = centsToMoney(balances.get(row.id)?.balanceCents ?? 0);
      row.saldoAFavor = centsToMoney(balances.get(row.id)?.overpaymentCents ?? 0);
    }
  }
  let sort = input.sort ?? "lastActivity", direction = input.direction ?? "desc";
  if (!financial && ["limiteCredito", "saldoActual", "movementCount", "lastActivity"].includes(sort)) {
    sort = "nombre"; direction = "asc";
  }
  const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
  rows.sort((a, b) => {
    const av = a[sort], bv = b[sort];
    // Unknown values always last in both directions.
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    const numeric = ["limiteCredito", "saldoActual", "movementCount"].includes(sort);
    const comparison = numeric ? Number(av ?? 0) - Number(bv ?? 0) : collator.compare(String(av ?? ""), String(bv ?? ""));
    return (direction === "asc" ? comparison : -comparison) || collator.compare(a.nombre, b.nombre) || a.id - b.id;
  });
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}