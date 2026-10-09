import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { resolveAuditedCreditMovementOwner } from "./auditoria-owner";
import { resolveKardexDocument } from "./kardex-document";
import {
  AUDIT_EXPORT_LIMIT,
  exportAuditoriaQuery,
  getAuditoriaQuery,
  listAuditoriaQuery,
  type AuditoriaFilters,
} from "./auditoria-queries";
export {
  AUDIT_EXPORT_LIMIT,
  exportAuditoriaQuery,
  getAuditoriaQuery,
  listAuditoriaQuery,
  nonFondoAuditSql,
  type AuditoriaFilters,
} from "./auditoria-queries";

export const AUDIT_ACTION_COVERAGE = Object.freeze({
  loginFallido: { accion: "LOGIN_FALLIDO", entidad: "usuarios" },
  reimpresionEtiquetas: {
    accion: "REIMPRIMIR_ETIQUETA",
    entidad: "reimpresiones_etiqueta",
  },
  aperturaCaja: { accion: "ABRIR_CAJA", entidad: "sesiones_caja" },
  corteCaja: { accion: "CERRAR_CAJA", entidad: "sesiones_caja" },
});

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
  /** Present only for a verified MOVIMIENTO_CREDITO audit reference. */
  clienteId?: number | null;
  /** Shared document route; null means the verified reference is unresolved. */
  documentoRuta?: string | null;
};
type AuditoriaDetail = AuditoriaEntry & {
  datosAntes: Record<string, unknown> | null;
  datosDespues: Record<string, unknown> | null;
};

export function presentAuditoria(
  row: Row,
  detail?: false,
  ownerClienteId?: number | null,
): AuditoriaEntry;
export function presentAuditoria(
  row: Row,
  detail: true,
  ownerClienteId?: number | null,
): AuditoriaDetail;
export function presentAuditoria(
  row: Row,
  detail = false,
  ownerClienteId?: number | null,
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
  if (base.entidad === "movimientos_credito") {
    base.clienteId = ownerClienteId ?? null;
    base.documentoRuta =
      ownerClienteId == null
        ? null
        : resolveKardexDocument(
            { tipo: "MOVIMIENTO_CREDITO", id: base.entidadId },
            new Map(),
            new Map(),
            new Map(),
            new Map([[Number(base.entidadId), { clienteId: ownerClienteId }]]),
          ).route;
  }
  if (!detail) return base;
  return {
    ...base,
    datosAntes: (row.datos_antes as Record<string, unknown> | null) ?? null,
    datosDespues: (row.datos_despues as Record<string, unknown> | null) ?? null,
  };
}

type MovementOwnerRow = {
  id: number | string;
  clienteId: number | string;
  tipo: string;
  importe: number | string;
  createdAt: Date | string;
};

async function auditedMovementOwners(rows: readonly Row[]) {
  const movementIds = rows
    .filter((row) => String(row.entidad) === "movimientos_credito")
    .map((row) => {
      const parsed = Number(row.entidad_id);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    })
    .filter((id): id is number => id != null);
  const uniqueIds = [...new Set(movementIds)];
  const owners = new Map<string, number | null>();
  if (uniqueIds.length === 0) return owners;

  const movementsResult = await db.execute(sql`
    SELECT m.id, m.cliente_id AS "clienteId", m.tipo,
           m.importe::text AS importe, m.created_at AS "createdAt"
    FROM movimientos_credito m
    WHERE m.id IN (${sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)})
  `);
  const movements = new Map(
    (movementsResult.rows as MovementOwnerRow[]).map((movement) => [
      String(movement.id),
      movement,
    ]),
  );
  for (const row of rows) {
    if (String(row.entidad) !== "movimientos_credito") continue;
    const auditId = String(row.id);
    const parsedMovementId = Number(row.entidad_id);
    const movementId =
      Number.isSafeInteger(parsedMovementId) && parsedMovementId > 0
        ? parsedMovementId
        : null;
    const movement = movementId == null ? null : movements.get(String(movementId));
    owners.set(
      auditId,
      resolveAuditedCreditMovementOwner(
        {
          entidad: String(row.entidad),
          entidadId: row.entidad_id == null ? null : String(row.entidad_id),
          fecha: String(row.created_at),
          datosAntes: row.datos_antes,
          datosDespues: row.datos_despues,
        },
        movement ?? null,
      ),
    );
  }
  return owners;
}

export async function listAuditoria(
  filters: AuditoriaFilters,
  page: number,
  pageSize: number,
  includeConfidentialFondo = false,
) {
  const result = await db.execute(
    listAuditoriaQuery(filters, page, pageSize, includeConfidentialFondo),
  );
  const rows = result.rows as Row[];
  const owners = await auditedMovementOwners(rows);
  return {
    items: rows.map((row) => presentAuditoria(row, false, owners.get(String(row.id)))),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getAuditoria(id: string, includeConfidentialFondo = false) {
  const result = await db.execute(getAuditoriaQuery(id, includeConfidentialFondo));
  const row = result.rows[0] as Row | undefined;
  if (!row) return null;
  const owners = await auditedMovementOwners([row]);
  return presentAuditoria(row, true, owners.get(String(row.id)));
}

export async function exportAuditoriaRows(
  filters: AuditoriaFilters,
  includeConfidentialFondo = false,
) {
  const result = await db.execute(
    exportAuditoriaQuery(filters, includeConfidentialFondo),
  );
  const rows = result.rows as Row[];
  if (rows.length > AUDIT_EXPORT_LIMIT) {
    throw new Error("AUDIT_EXPORT_LIMIT");
  }
  const owners = await auditedMovementOwners(rows);
  return rows.map((row) => presentAuditoria(row, true, owners.get(String(row.id))));
}