import { sql } from "drizzle-orm";

export const AUDIT_EXPORT_LIMIT = 10_000;

export type AuditoriaFilters = {
  desde?: string;
  hasta?: string;
  usuarioId?: number;
  rol?: string;
  modulo?: string;
  accion?: string;
  sitioId?: number;
  search?: string;
};

const selection = sql`
  a.id, a.created_at, a.usuario_id, a.usuario_snapshot AS usuario, a.rol_snapshot,
  a.accion, a.modulo, a.entidad, a.entidad_id, a.sitio_id,
  a.sitio_snapshot, a.ip, a.datos_antes, a.datos_despues
`;

export function nonFondoAuditSql() {
  return sql`NOT (
    lower(a.entidad) IN (
      'fondo_mariana',
      'fondo_movimiento',
      'fondo_movimientos',
      'fondo_arqueo',
      'fondo_arqueos'
    )
    OR LEFT(upper(a.accion), 6) = 'FONDO_'
    OR lower(COALESCE(a.modulo, '')) IN ('fondo', 'fondo_mariana')
    OR COALESCE(a.datos_antes::text, '') ~* '(fondo_mariana|fondo_movimientos?|fondo_arqueos?|"accion"[[:space:]]*:[[:space:]]*"FONDO_)'
    OR COALESCE(a.datos_despues::text, '') ~* '(fondo_mariana|fondo_movimientos?|fondo_arqueos?|"accion"[[:space:]]*:[[:space:]]*"FONDO_)'
  )`;
}

function whereSql(filters: AuditoriaFilters, includeConfidentialFondo: boolean) {
  const conditions = [];
  if (!includeConfidentialFondo) conditions.push(nonFondoAuditSql());
  if (filters.desde) {
    conditions.push(
      sql`a.created_at >= (${filters.desde}::date::timestamp AT TIME ZONE 'America/Mexico_City')`,
    );
  }
  if (filters.hasta) {
    conditions.push(
      sql`a.created_at < ((${filters.hasta}::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City')`,
    );
  }
  if (filters.usuarioId) conditions.push(sql`a.usuario_id = ${filters.usuarioId}`);
  if (filters.rol) conditions.push(sql`a.rol_snapshot = ${filters.rol}`);
  if (filters.modulo) conditions.push(sql`a.modulo = ${filters.modulo}`);
  if (filters.accion) conditions.push(sql`a.accion = ${filters.accion}`);
  if (filters.sitioId) conditions.push(sql`a.sitio_id = ${filters.sitioId}`);
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(sql`(a.entidad ILIKE ${term} OR COALESCE(a.entidad_id, '') ILIKE ${term})`);
  }
  return conditions.length
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;
}

export function listAuditoriaQuery(
  filters: AuditoriaFilters,
  page: number,
  pageSize: number,
  includeConfidentialFondo = false,
) {
  return sql`
    SELECT ${selection}, COUNT(*) OVER()::int AS total
    FROM auditoria a
    ${whereSql(filters, includeConfidentialFondo)}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;
}

export function getAuditoriaQuery(id: string, includeConfidentialFondo = false) {
  return sql`
    SELECT ${selection}
    FROM auditoria a
    WHERE a.id = ${id}::bigint
      AND (${includeConfidentialFondo ? sql`true` : nonFondoAuditSql()})
    LIMIT 1
  `;
}

export function exportAuditoriaQuery(
  filters: AuditoriaFilters,
  includeConfidentialFondo = false,
) {
  return sql`
    SELECT ${selection}
    FROM auditoria a
    ${whereSql(filters, includeConfidentialFondo)}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${AUDIT_EXPORT_LIMIT + 1}
  `;
}