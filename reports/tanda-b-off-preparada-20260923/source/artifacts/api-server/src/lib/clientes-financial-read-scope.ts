import type { AuthContext } from "../middlewares/auth";
import {
  CarteraScopeError,
  normalizeCarteraScope,
  type CarteraQuery,
  type CarteraReadDatabase,
  type CarteraScope,
  type ReadScopeResolver,
} from "./clientes-cartera-read-model";

/**
 * Shared scope model for client financial exports.  It deliberately delegates
 * parsing and authorization to the same normalizer used by Cartera; callers
 * must only use `ticketScopeClause` to apply the resulting site predicate.
 */
export type ClienteFinancialReadScope = CarteraScope;

export async function resolveClienteFinancialReadScope(
  auth: AuthContext,
  query: CarteraQuery,
  database: CarteraReadDatabase,
  resolveScope: ReadScopeResolver,
  generatedAt = new Date(),
): Promise<ClienteFinancialReadScope> {
  const normalized = normalizeCarteraScope(auth, query, resolveScope);
  if (normalized.type === "GLOBAL") {
    return {
      tipo: "GLOBAL",
      ubicaciones: [],
      generadoEn: generatedAt.toISOString(),
      saldoAFavorDisponible: true,
    };
  }

  const locationRows = await database.query<{ id: number; nombre: string }>(
    "SELECT id,nombre FROM ubicaciones WHERE id=ANY($1::int[]) ORDER BY id",
    [normalized.locationIds],
  );
  if (locationRows.rows.length !== normalized.locationIds.length) {
    throw new CarteraScopeError(400, "Una o más ubicaciones no existen.");
  }
  return {
    tipo: "SITIOS",
    ubicaciones: locationRows.rows.map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
    })),
    generadoEn: generatedAt.toISOString(),
    saldoAFavorDisponible: true,
  };
}

/**
 * SQL fragment for a tickets alias already joined by the caller.  A global
 * read emits no predicate, preserving its legacy rows and numeric values.
 * Scoped reads only admit operations whose document belongs to an authorized
 * site; unlocated movements deliberately remain outside the export detail.
 */
export function ticketScopeClause(
  scope: ClienteFinancialReadScope,
  ticketAlias: string,
  parameterIndex: number,
): { text: string; values: readonly unknown[] } {
  if (scope.tipo === "GLOBAL") return { text: "", values: [] };
  return {
    text: ` AND ${ticketAlias}.ubicacion_id=ANY($${parameterIndex}::int[])`,
    values: [scope.ubicaciones.map((location) => location.id)],
  };
}

/**
 * Canonical detail query shared by the three estado-cuenta export formats.
 * The running history is calculated on the complete ledger CTE before the
 * authorized-document predicate is applied, matching the global FIFO
 * projection and avoiding a misleading per-store reconstruction.
 */
export function buildEstadoCuentaExportReadQuery(
  clienteId: number,
  scope: ClienteFinancialReadScope,
): { text: string; values: readonly unknown[] } {
  const siteClause = ticketScopeClause(scope, "ledger", 2);
  return {
    text: `WITH ledger AS (
      SELECT m.id,m.created_at AS fecha,m.tipo,m.importe::text AS importe,m.notas,
        m.fecha_vencimiento AS "fechaVencimiento",m.forma_pago AS "formaPago",
        m.referencia,t.folio AS folio,u.nombre AS usuario,t.ubicacion_id,
        SUM(m.importe) OVER (ORDER BY m.created_at,m.id)::text AS "saldoCorridoHistorico"
      FROM movimientos_credito m
      LEFT JOIN tickets t ON t.id=m.ticket_id
      JOIN usuarios u ON u.id=m.usuario_id
      WHERE m.cliente_id=$1
    )
    SELECT id,fecha,tipo,importe,notas,"fechaVencimiento","formaPago",referencia,folio,usuario,"saldoCorridoHistorico"
    FROM ledger WHERE true ${siteClause.text}
    ORDER BY fecha,id`,
    values: [clienteId, ...siteClause.values],
  };
}

export function scopeDescription(scope: ClienteFinancialReadScope): string {
  return scope.tipo === "GLOBAL"
    ? "Global"
    : scope.ubicaciones.map((location) => `${location.id} - ${location.nombre}`).join(", ");
}

export const GLOBAL_CREDIT_SCOPE_LABEL =
  "El resumen global de crédito considera todos los sitios.";
export const SCOPED_DETAIL_LABEL =
  "El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.";