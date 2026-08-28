import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export const AUDIT_EXPORT_LIMIT = 10_000;

export const AUDIT_ACTION_COVERAGE = Object.freeze({
  loginFallido: { accion: "LOGIN_FALLIDO", entidad: "usuarios" },
  reimpresionEtiquetas: {
    accion: "REIMPRIMIR_ETIQUETA",
    entidad: "reimpresiones_etiqueta",
  },
  aperturaCaja: { accion: "ABRIR_CAJA", entidad: "sesiones_caja" },
  corteCaja: { accion: "CERRAR_CAJA", entidad: "sesiones_caja" },
});

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

type Row = Record<string, unknown>;
type AuditoriaEntry = {
  id: string;
  fecha: string;
  usuarioId: number | null;
  usuario: string | null;
  rolSnapshot: string | null;
  accion: string;
  modulo: string | null;
  entidad: string;
  entidadId: string | null;
  sitioId: number | null;
  sitio: string | null;
  ip: string;
};
type AuditoriaDetail = AuditoriaEntry & {
  datosAntes: Record<string, unknown> | null;
  datosDespues: Record<string, unknown> | null;
};

function whereSql(filters: AuditoriaFilters) {
  const conditions = [];
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

export function presentAuditoria(row: Row): AuditoriaEntry;
export function presentAuditoria(
  row: Row,
  detail: true,
): AuditoriaDetail;
export function presentAuditoria(
  row: Row,
  detail = false,
): AuditoriaEntry | AuditoriaDetail {
  const base: AuditoriaEntry = {
    id: String(row.id),
    fecha: new Date(String(row.created_at)).toISOString(),
    usuarioId: row.usuario_id == null ? null : Number(row.usuario_id),
    usuario: row.usuario == null ? null : String(row.usuario),
    rolSnapshot: row.rol_snapshot == null ? null : String(row.rol_snapshot),
    accion: String(row.accion),
    modulo: row.modulo == null ? null : String(row.modulo),
    entidad: String(row.entidad),
    entidadId: row.entidad_id == null ? null : String(row.entidad_id),
    sitioId: row.sitio_id == null ? null : Number(row.sitio_id),
    sitio: row.sitio_snapshot == null ? null : String(row.sitio_snapshot),
    ip: String(row.ip),
  };
  if (!detail) return base;
  return {
    ...base,
    datosAntes: (row.datos_antes as Record<string, unknown> | null) ?? null,
    datosDespues: (row.datos_despues as Record<string, unknown> | null) ?? null,
  };
}

const selection = sql`
  a.id, a.created_at, a.usuario_id, a.usuario_snapshot AS usuario, a.rol_snapshot,
  a.accion, a.modulo, a.entidad, a.entidad_id, a.sitio_id,
  a.sitio_snapshot, a.ip, a.datos_antes, a.datos_despues
`;

export async function listAuditoria(
  filters: AuditoriaFilters,
  page: number,
  pageSize: number,
) {
  const result = await db.execute(sql`
    SELECT ${selection}, COUNT(*) OVER()::int AS total
    FROM auditoria a
    ${whereSql(filters)}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);
  const rows = result.rows as Row[];
  return {
    items: rows.map((row) => presentAuditoria(row)),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getAuditoria(id: string) {
  const result = await db.execute(sql`
    SELECT ${selection}
    FROM auditoria a
    WHERE a.id = ${id}::bigint LIMIT 1
  `);
  const row = result.rows[0] as Row | undefined;
  return row ? presentAuditoria(row, true) : null;
}

export async function exportAuditoriaRows(filters: AuditoriaFilters) {
  const result = await db.execute(sql`
    SELECT ${selection}
    FROM auditoria a
    ${whereSql(filters)}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${AUDIT_EXPORT_LIMIT + 1}
  `);
  const rows = result.rows as Row[];
  if (rows.length > AUDIT_EXPORT_LIMIT) {
    throw new Error("AUDIT_EXPORT_LIMIT");
  }
  return rows.map((row) => presentAuditoria(row, true));
}