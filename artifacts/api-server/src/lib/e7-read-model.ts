import { z } from "zod";
import { projectCreditLedger, moneyToCents, type CreditLedgerMovement } from "./credit-allocation";
import {
  E7_ATTRIBUTION_ENABLED,
  E7_CLIENT_FINANCIAL_READS_ENABLED,
  E7_E5_READ_SOURCE_ENABLED,
} from "./e7-feature";
import { accountedDocumentAt, accountedDocumentPredicate } from "./accounted-document";
import { parseMexicoDateQuery } from "./mexico-date";
import { resolveReadScope } from "./read-scope";
import type { AuthContext } from "../middlewares/auth";
import type { CreditLedgerQuery } from "./credit-aging-read-model";
import type { ClienteFinancialReadScope } from "./clientes-financial-read-scope";
import type { resolvePermiso } from "./permisos";

export class E7Error extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}
export const E7_LEYENDAS = [
  "El resumen global de crédito considera todos los sitios.",
  "El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.",
  "Las aplicaciones a notas no son nuevos ingresos.",
  "El dinero retenido pendiente de aplicación no es saldo a favor ni reduce la deuda.",
  "Sin sitio determinado",
] as const;
export const E7ScopeQuery = z.object({
  ubicacionId: z.string().regex(/^[1-9]\d*$/).optional(),
  ubicacionIds: z.string().regex(/^[1-9]\d*(,[1-9]\d*)*$/).optional(),
}).strict();
export const E7AttributionQuery = E7ScopeQuery.extend({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
type Query = z.infer<typeof E7ScopeQuery>;
export type E7Session = { userId: number; sessionId: string };
export type E7Transaction = <T>(work: (database: CreditLedgerQuery) => Promise<T>) => Promise<T>;
export type E7Infrastructure = {
  enabled?: boolean; attributionEnabled?: boolean; e5Enabled?: boolean; now?: () => Date;
  database?: CreditLedgerQuery;
  permissionDatabase?: Parameters<typeof resolvePermiso>[3];
  transaction?: E7Transaction;
};
export type E7Movement = {
  id: string; fecha: string; tipo: string; importe: string;
  ubicacionId: number | null; cuentaDestino: string | null;
  folio: string | null; saldoPendiente: string | null;
  detailHref: string | null; documentHref: string | null;
};
type Metadata = { id: number; site: number | null; origin: number | null;
  account: string | null; nature: string | null; originalType: string | null;
  ticketId: number | null; folio: string | null };
const iso = (value: unknown) => new Date(value as string | Date).toISOString();
const validSite = (scope: ClienteFinancialReadScope, site: number | null) =>
  scope.tipo === "GLOBAL" || (site !== null && scope.ubicaciones.some(s => s.id === site));
const safeMoney = (cents: number) => {
  if (!Number.isSafeInteger(cents)) throw new E7Error("E7_FUENTE_INVALIDA", "Importe fuera de precisión segura.");
  const value = BigInt(cents), absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
};
const sum = (rows: { importe: string }[]) => safeMoney(rows.reduce((n, r) => n + moneyToCents(r.importe), 0));
function projectedPortions(clientId: number, ledger: CreditLedgerMovement[], metadata: Map<number, Metadata>,
  scope: ClienteFinancialReadScope, projection: ReturnType<typeof projectCreditLedger>): E7Movement[] {
  const rows: E7Movement[] = [];
  let previous = new Map<string, number>();
  const ledgerMap = new Map(ledger.map(m => [m.id, m]));
  for (const prefix of projection.movementProjections) {
    if (!prefix.allocations) throw new E7Error("E7_FUENTE_INVALIDA", "Falta traza canónica global.");
    const current = new Map<string, number>();
    for (const a of prefix.allocations) {
      const key = `${a.sourceId}:${a.targetId}`;
      current.set(key, (current.get(key) ?? 0) + a.appliedCents);
    }
    for (const key of new Set([...previous.keys(), ...current.keys()])) {
      const delta = (current.get(key) ?? 0) - (previous.get(key) ?? 0);
      if (!delta) continue;
      const [sourceId, targetId] = key.split(":").map(Number);
      const target = metadata.get(targetId!), source = metadata.get(sourceId!);
      const event = ledgerMap.get(prefix.movementId);
      if (!target || !source || !event) throw new E7Error("E7_FUENTE_INVALIDA", "Traza sin evidencia de origen/destino.");
      if (!validSite(scope, target.site)) continue;
      rows.push({ id: `proyeccion:${prefix.movementId}:${key}`, fecha: event.createdAt.toISOString(),
        tipo: delta > 0 ? "APLICACION" : "REVERSO_APLICACION", importe: safeMoney(delta),
        ubicacionId: target.site, cuentaDestino: source.account, folio: target.folio, saldoPendiente: null,
        detailHref: `/clientes/${clientId}/movimientos/${prefix.movementId}`,
        documentHref: target.ticketId === null ? null : `/tickets/${target.ticketId}` });
    }
    previous = current;
  }
  return rows;
}
async function loadClient(database: CreditLedgerQuery, id: number, scope: ClienteFinancialReadScope) {
  const { loadCustomerCreditLedger } = await import("./credit-aging-read-model");
  const ledger = await loadCustomerCreditLedger(id, database);
  const projection = projectCreditLedger(ledger, { includeMovementProjections: true, includeAllocationTraces: true });
  const raw = await database.query<Record<string, unknown>>(`SELECT m.id,
    t.id AS ticket_id,t.ubicacion_id, t.folio, COALESCE(m.cuenta_destino,original.cuenta_destino,receipt.cuenta_destino) AS cuenta_destino, m.naturaleza,
    CASE WHEN m.id IN (51,52,53) THEN NULL ELSE m.sitio_origen_id END AS sitio_origen_id,
    original.tipo AS original_tipo
    FROM movimientos_credito m LEFT JOIN movimientos_credito original ON original.id=m.movimiento_origen_id
    LEFT JOIN e5_vinculos_credito link ON link.movimiento_id=m.id
    LEFT JOIN e5_aplicaciones application ON application.id=link.aplicacion_id
    LEFT JOIN e5_recepciones receipt ON receipt.id=application.cobro_id AND receipt.cliente_id=m.cliente_id
    LEFT JOIN tickets t ON t.id=COALESCE(m.ticket_id,original.ticket_id) AND t.cliente_id=m.cliente_id
    WHERE m.cliente_id=$1`, [id]);
  const metadata = new Map(raw.rows.map(r => [Number(r.id), {
    id: Number(r.id), site: r.ubicacion_id == null ? null : Number(r.ubicacion_id),
    origin: r.sitio_origen_id == null ? null : Number(r.sitio_origen_id),
    account: r.cuenta_destino == null ? null : String(r.cuenta_destino),
    nature: r.naturaleza == null ? null : String(r.naturaleza),
    originalType: r.original_tipo == null ? null : String(r.original_tipo),
    ticketId: r.ticket_id == null ? null : Number(r.ticket_id),
    folio: r.folio == null ? null : String(r.folio),
  }]));
  if (ledger.some(m => !metadata.has(m.id))) throw new E7Error("E7_FUENTE_INVALIDA", "Ledger incompleto.");
  return { ledger, metadata, projection, portions: projectedPortions(id, ledger, metadata, scope, projection) };
}
async function retained(database: CreditLedgerQuery, scope: ClienteFinancialReadScope, now: Date, client?: number) {
  const result = await database.query<Record<string, unknown>>(`SELECT r.id,r.fecha_recepcion,r.ubicacion_id,
    (r.importe-COALESCE(a.importe,0)-COALESCE(d.importe,0))::text AS pendiente
    FROM e5_recepciones r
    LEFT JOIN LATERAL (SELECT SUM(importe) importe FROM e5_aplicaciones WHERE cobro_id=r.id) a ON true
    LEFT JOIN LATERAL (SELECT SUM(importe) importe FROM e5_devoluciones WHERE cobro_id=r.id) d ON true
    WHERE ($1::int IS NULL OR r.cliente_id=$1)
      AND ($2::int[] IS NULL OR r.ubicacion_id=ANY($2))
    ORDER BY r.fecha_recepcion,r.id`, [client ?? null, scope.tipo === "GLOBAL" ? null : scope.ubicaciones.map(s => s.id)]);
  return result.rows.flatMap(r => {
    const amount = moneyToCents(String(r.pendiente)), received = new Date(r.fecha_recepcion as string);
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isFinite(received.getTime()) || received > now)
      throw new E7Error("E7_FUENTE_INVALIDA", "Retenido/fecha incompatible con recepción y disposiciones.");
    if (!amount) return [];
    return [{ cobroId: String(r.id), fechaRecepcion: received.toISOString(), ubicacionId: Number(r.ubicacion_id),
      importePendiente: safeMoney(amount), antiguedadDias: Math.floor((now.getTime() - received.getTime()) / 86400000) }];
  });
}
export function createE7Reader(infrastructure: E7Infrastructure = {}) {
  const options = Object.freeze({
    enabled: E7_CLIENT_FINANCIAL_READS_ENABLED,
    attributionEnabled: E7_ATTRIBUTION_ENABLED,
    e5Enabled: E7_E5_READ_SOURCE_ENABLED,
    now: () => new Date(),
    ...infrastructure,
  });
  const database = async () => options.database ?? (await import("@workspace/db")).pool;
  async function authorize(session: E7Session, attribution: boolean) {
    const db = await database(), now = options.now();
    const user = (await db.query<Record<string, unknown>>(`SELECT u.id,u.rol,u.ubicacion_id,u.alcance_consulta
      FROM usuarios u JOIN sesiones s ON s.usuario_id=u.id
      WHERE u.id=$1 AND u.activo=true AND s.id=$2::uuid AND s.expira_at>$3::timestamptz
        AND s.created_at>$4::timestamptz`, [session.userId, session.sessionId, now.toISOString(),
      new Date(now.getTime() - 16 * 3600000).toISOString()])).rows[0];
    if (!user) throw new E7Error("NO_AUTENTICADO", "Sesión no vigente.", 401);
    if (user.rol === "CONTADOR") throw new E7Error("PERFIL_DENEGADO", "CONTADOR utiliza exclusivamente las proyecciones E11 autorizadas.", 403);
    if (attribution && !["ADMIN", "SISTEMAS"].includes(String(user.rol)))
      throw new E7Error("PERMISO_DENEGADO", "Sin permiso de lectura de Cuentas Destino.", 403);
    if (!attribution) {
      const { resolvePermiso } = await import("./permisos");
      const permission = await resolvePermiso(session.userId, user.rol as AuthContext["user"]["rol"], "clientes_finanzas", options.permissionDatabase);
      if (!permission?.puedeVer) throw new E7Error("PERMISO_DENEGADO", "Sin permiso financiero de lectura.", 403);
    }
    return { sessionId: session.sessionId, location: null, user: {
      id: Number(user.id), rol: user.rol, ubicacionId: user.ubicacion_id == null ? null : Number(user.ubicacion_id),
      alcanceConsulta: user.alcance_consulta,
    } } as AuthContext;
  }
  async function transaction<T>(work: (db: CreditLedgerQuery) => Promise<T>) {
    if (options.transaction) return options.transaction(work);
    if (options.database) return work(options.database); // Internal fake provides its own snapshot semantics.
    const client = await (await import("@workspace/db")).pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await work(client);
      await client.query("COMMIT"); return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async function read<T>(session: E7Session, query: Query, attribution: boolean,
    work: (db: CreditLedgerQuery, scope: ClienteFinancialReadScope, now: Date) => Promise<T>) {
    if (!options.enabled) throw new E7Error("E7_DISABLED", "E7 no está habilitado.", 403);
    if (attribution && !options.attributionEnabled)
      throw new E7Error("E7_ATRIBUCION_DISABLED", "La atribución E7 permanece cerrada.", 403);
    if (!options.e5Enabled) throw new E7Error("E7_DEPENDENCIA_NO_DISPONIBLE", "Falta habilitación de la fuente E5; no se fabrica cero.");
    const auth = await authorize(session, attribution);
    const result = await transaction(async db => {
      const { resolveClienteFinancialReadScope } = await import("./clientes-financial-read-scope");
      const now = options.now();
      const scope = await resolveClienteFinancialReadScope(auth, query, db, resolveReadScope, now);
      return work(db, scope, now);
    });
    const current = await authorize(session, attribution);
    if (JSON.stringify(current) !== JSON.stringify(auth)) throw new E7Error("PERFIL_CAMBIADO", "Cambió el alcance antes de entregar.", 403);
    return result;
  }
  return Object.freeze({
    async statement(session: E7Session, client: number, rawQuery: Query = {}) {
      const query = E7ScopeQuery.parse(rawQuery);
      if (!Number.isSafeInteger(client) || client < 1 || client > 2147483647) throw new E7Error("VALIDACION", "Cliente inválido.", 400);
      return read(session, query, false, async (db, scope, now) => {
        const customer = (await db.query<{ limite: string }>(
          "SELECT limite_credito::text AS limite FROM clientes WHERE id=$1 AND es_sistema=false", [client])).rows[0];
        if (!customer) throw new E7Error("NO_ENCONTRADO", "Cliente no encontrado.", 404);
        const data = await loadClient(db, client, scope);
        const movements: E7Movement[] = [];
        for (const m of data.ledger) {
          const meta = data.metadata.get(m.id)!;
          if (scope.tipo !== "GLOBAL" && (m.tipo === "ABONO" || (m.tipo === "REVERSO" && meta.originalType === "ABONO"))) continue;
          if (!validSite(scope, meta.site)) continue;
          const charge = data.projection.allCharges.find(c => c.movimientoId === m.id);
          movements.push({ id: String(m.id), fecha: m.createdAt.toISOString(),
            tipo: m.tipo === "ABONO" && meta.nature === "OPERACION_CREDITO_SIN_DINERO" ? "APLICACION_SIN_DINERO" : m.tipo,
            importe: safeMoney(moneyToCents(m.importe)), ubicacionId: meta.site, cuentaDestino: null,
            folio: meta.folio, saldoPendiente: charge ? safeMoney(charge.pendienteCents) : null,
            detailHref: `/clientes/${client}/movimientos/${m.id}`,
            documentHref: meta.ticketId === null ? null : `/tickets/${meta.ticketId}` });
        }
        if (scope.tipo === "SITIOS") movements.push(...data.portions.map(p => ({ ...p, importe: safeMoney(-moneyToCents(p.importe)), cuentaDestino: null })));
        if (scope.tipo === "GLOBAL") {
          const receipts = await db.query<Record<string, unknown>>(`SELECT r.id::text AS id,
            r.fecha_recepcion AS fecha,r.importe::text,r.ubicacion_id,'RECEPCION_RETENIDA' AS tipo
            FROM e5_recepciones r WHERE r.cliente_id=$1
            UNION ALL SELECT d.clave::text,(c.detail#>>'{devolucion,fecha}')::timestamptz,
            (-d.importe)::text,NULL::integer,'DEVOLUCION_RETENIDA'
            FROM e5_devoluciones d JOIN e5_recepciones r ON r.id=d.cobro_id
            JOIN e5_cobros c ON c.id=d.cobro_id WHERE r.cliente_id=$1`, [client]);
          for (const r of receipts.rows) {
            if (!r.fecha) throw new E7Error("E7_FUENTE_INVALIDA", "Recepción/disposición sin fecha documental.");
            movements.push({ id: `E5:${r.tipo}:${r.id}`, fecha: iso(r.fecha), tipo: String(r.tipo),
              importe: safeMoney(moneyToCents(String(r.importe))),
              ubicacionId: r.ubicacion_id == null ? null : Number(r.ubicacion_id), cuentaDestino: null,
              folio: null, saldoPendiente: null, detailHref: null, documentHref: null });
          }
        }
        const pending = await retained(db, scope, now, client);
        return { clienteId: client, alcance: scope, generadoEn: now.toISOString(), leyendas: [...E7_LEYENDAS],
          resumenGlobal: { deudaActual: safeMoney(data.projection.balanceCents), saldoAFavor: safeMoney(data.projection.overpaymentCents),
            limiteCredito: safeMoney(moneyToCents(customer.limite)),
            creditoDisponible: safeMoney(Math.max(0, moneyToCents(customer.limite) - data.projection.balanceCents)) },
          movimientos: movements.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)),
          retenidos: pending, totalRetenido: sum(pending.map(r => ({ importe: r.importePendiente }))) };
      });
    },
    async attribution(session: E7Session, rawQuery: z.infer<typeof E7AttributionQuery>) {
      const { desde, hasta, ...query } = E7AttributionQuery.parse(rawQuery);
      const start = parseMexicoDateQuery(desde, "start"), end = parseMexicoDateQuery(hasta, "end");
      if (!start || !end || start > end || end.getTime() - start.getTime() > 366 * 86400000)
        throw new E7Error("VALIDACION", "Periodo inválido o mayor de un año.", 400);
      return read(session, query, true, async (db, scope, now) => {
        const sites = scope.tipo === "GLOBAL" ? null : scope.ubicaciones.map(s => s.id);
        const movements: E7Movement[] = [];
        const physical = await db.query<Record<string, unknown>>(`SELECT 'POS:'||p.id AS id,
          ${accountedDocumentAt("t")} AS fecha,p.importe::text,t.id AS ticket_id,t.folio,t.ubicacion_id,
          CASE WHEN p.forma_pago='EFECTIVO' THEN 'CAJA_FISICA' WHEN t.facturado THEN 'CUENTA_FISCAL' ELSE 'CUENTA_NO_FISCAL' END AS cuenta
          FROM ticket_pagos p JOIN tickets t ON t.id=p.ticket_id
          WHERE p.forma_pago<>'CREDITO' AND ${accountedDocumentPredicate("t")}
            AND ${accountedDocumentAt("t")}>=$1 AND ${accountedDocumentAt("t")}<=$2
            AND ($3::int[] IS NULL OR t.ubicacion_id=ANY($3))`, [start, end, sites]);
        for (const row of physical.rows) movements.push({ id: String(row.id), fecha: iso(row.fecha), tipo: "VENTA_CONTADO",
          importe: safeMoney(moneyToCents(String(row.importe))), ubicacionId: Number(row.ubicacion_id),
          cuentaDestino: String(row.cuenta), folio: String(row.folio), saldoPendiente: null,
          detailHref: `/tickets/${Number(row.ticket_id)}`, documentHref: `/tickets/${Number(row.ticket_id)}` });
        const clients = await db.query<{ id: number }>(`SELECT DISTINCT m.cliente_id AS id FROM movimientos_credito m
          JOIN tickets t ON t.cliente_id=m.cliente_id WHERE ($1::int[] IS NULL OR t.ubicacion_id=ANY($1))
          UNION SELECT cliente_id AS id FROM movimientos_credito WHERE $1::int[] IS NULL`, [sites]);
        for (const { id } of clients.rows) {
          const data = await loadClient(db, Number(id), scope);
          movements.push(...data.portions);
          if (scope.tipo === "GLOBAL") for (const m of data.ledger) {
            const meta = data.metadata.get(m.id)!;
            if (m.tipo !== "ABONO" && !(m.tipo === "REVERSO" && meta.originalType === "ABONO")) continue;
            if (meta.nature === "OPERACION_CREDITO_SIN_DINERO") continue;
            if (meta.account === null)
              throw new E7Error("E7_FUENTE_INVALIDA", "Cobranza sin cuenta documentada; no se inventa destino.");
            const historical = meta.nature == null || [51, 52, 53].includes(m.id);
            const physicalReceipt = m.tipo === "ABONO" && meta.nature === "INGRESO_FISICO" && !historical;
            movements.push({ id: `ledger:${m.id}`, fecha: m.createdAt.toISOString(),
              tipo: historical ? "REGISTRO_HISTORICO" : physicalReceipt ? "RECEPCION"
                : meta.nature === "DEVOLUCION_FISICA" ? "DEVOLUCION" : "CORRECCION",
              importe: safeMoney(-moneyToCents(m.importe)),
              ubicacionId: meta.origin, cuentaDestino: meta.account, folio: meta.folio, saldoPendiente: null,
              detailHref: `/clientes/${id}/movimientos/${m.id}`,
              documentHref: meta.ticketId === null ? null : `/tickets/${meta.ticketId}` });
          }
        }
        // Immutable receipts, never e5_cobros detail nor E1 mirror nor E5 credit applications.
        if (scope.tipo === "GLOBAL") {
          const receipts = await db.query<Record<string, unknown>>(`SELECT id,fecha_recepcion,importe::text,ubicacion_id,cuenta_destino
            FROM e5_recepciones WHERE fecha_recepcion >=$1 AND fecha_recepcion <=$2`, [start, end]);
          for (const r of receipts.rows) movements.push({ id: `E5:${r.id}`, fecha: iso(r.fecha_recepcion), tipo: "RECEPCION",
            importe: safeMoney(moneyToCents(String(r.importe))), ubicacionId: Number(r.ubicacion_id),
            cuentaDestino: String(r.cuenta_destino), folio: null, saldoPendiente: null,
            detailHref: null, documentHref: null });
          const refunds = await db.query<Record<string, unknown>>(`SELECT d.clave,d.importe::text,d.fuente,
            c.detail#>>'{devolucion,fecha}' AS fecha FROM e5_devoluciones d
            JOIN e5_cobros c ON c.id=d.cobro_id`);
          for (const r of refunds.rows) {
            if (!r.fecha) throw new E7Error("E7_FUENTE_INVALIDA", "Devolución sin fecha documental.");
            const source = r.fuente as { tipo: string; cuentaOrigen?: string };
            movements.push({ id: `E5D:${r.clave}`, fecha: iso(r.fecha), tipo: "DEVOLUCION",
              importe: safeMoney(-moneyToCents(String(r.importe))), ubicacionId: null,
              cuentaDestino: source.tipo === "FONDO" ? null : source.cuentaOrigen ?? null, folio: null, saldoPendiente: null,
              detailHref: null, documentHref: null });
          }
        }
        const selected = movements.filter(m => new Date(m.fecha) >= start && new Date(m.fecha) <= end);
        const groups = new Map<string, E7Movement[]>();
        for (const m of selected) {
          const key = JSON.stringify([m.tipo, m.cuentaDestino, m.ubicacionId]);
          groups.set(key, [...groups.get(key) ?? [], m]);
        }
        const pending = await retained(db, scope, now);
        return { alcance: scope, generadoEn: now.toISOString(), leyendas: [...E7_LEYENDAS],
          cobranzaTotal: scope.tipo === "GLOBAL" ? sum(selected.filter(m =>
            !["APLICACION", "REVERSO_APLICACION"].includes(m.tipo))) : null,
          recepcionesFisicas: scope.tipo === "GLOBAL" ? sum(selected.filter(m =>
            ["RECEPCION", "VENTA_CONTADO"].includes(m.tipo))) : null,
          aplicacionesNotas: sum(selected.filter(m => ["APLICACION", "REVERSO_APLICACION"].includes(m.tipo))),
          movimientos: selected,
          puente: [...groups.values()].map(rows => ({ tipo: rows[0]!.tipo, cuentaDestino: rows[0]!.cuentaDestino,
            ubicacionId: rows[0]!.ubicacionId, total: sum(rows) })),
          retenidos: pending, totalRetenido: sum(pending.map(r => ({ importe: r.importePendiente }))) };
      });
    },
  });
}
export const e7Reader = createE7Reader();