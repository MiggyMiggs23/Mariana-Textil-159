import { randomUUID } from "node:crypto";

// Deliberately not configurable by environment or request. Owner activation is
// a separate delivery. No database/runtime imports: this module is offline-testable.
export const CREDIT_HISTORICAL_ATTRIBUTION_ENABLED = false;

export class CreditAttributionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "CreditAttributionError";
  }
}

export type EvidenceDatabase = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export type EvidenceActor = {
  id: number;
  rol: string;
  activo: boolean;
  ubicacionId: number | null;
};

// Exact S20 jsonb_build_object contract, including numeric importe and nulls.
export type CreditIdentitySnapshot = {
  cliente_id: number;
  tipo: string;
  importe: number;
  ticket_id: number | null;
  movimiento_origen_id: number | null;
};

export type AttributionInput = {
  id: string;
  movimientoId: number;
  movimientoCreatedAt: string;
  identidadSnapshot: CreditIdentitySnapshot;
  sitioOrigenId: number;
  evidencia: string;
  motivo: string;
  anteriorId: string | null;
};

export type CreditAttribution = AttributionInput & {
  usuarioId: number;
  createdAt: string;
};

export type CreditEvidenceRow = {
  movimientoId: number;
  movimientoCreatedAt: string;
  identidadSnapshot: CreditIdentitySnapshot;
  sitioOrigenOriginalId: number | null;
  naturalezaOriginal: string | null;
  ultimaAtribucion: CreditAttribution | null;
  sitioNombre: string | null;
};

export type EvidenceReadScope = {
  // null means existing authorized global scope, never an implicit default.
  sitioIds: readonly number[] | null;
  incluirHistoricosSinSitio: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SNAPSHOT_KEYS = ["cliente_id", "importe", "movimiento_origen_id", "ticket_id", "tipo"];

function fail(status: number, message: string): never {
  throw new CreditAttributionError(status, message);
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(400, `${name} debe ser un objeto.`);
  }
  return value as Record<string, unknown>;
}

function positiveId(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    fail(400, `${name} debe ser un entero positivo.`);
  }
  return value;
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) fail(400, `${name} debe ser UUID.`);
  return value.toLowerCase();
}

function nonblank(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 10000) {
    fail(400, `${name} es obligatorio (máximo 10000 caracteres).`);
  }
  return value;
}

export function readIdentitySnapshot(value: unknown): CreditIdentitySnapshot {
  const snapshot = record(value, "identidadSnapshot");
  if (Object.keys(snapshot).sort().join(",") !== SNAPSHOT_KEYS.join(",")) {
    fail(400, "identidadSnapshot debe conservar exactamente los cinco campos de identidad E1.");
  }
  if (typeof snapshot.importe !== "number" || !Number.isFinite(snapshot.importe)) {
    fail(400, "identidadSnapshot.importe debe ser numérico y finito.");
  }
  if (typeof snapshot.tipo !== "string" || !snapshot.tipo.trim()) {
    fail(400, "identidadSnapshot.tipo es obligatorio.");
  }
  return {
    cliente_id: positiveId(snapshot.cliente_id, "identidadSnapshot.cliente_id"),
    tipo: snapshot.tipo,
    importe: snapshot.importe,
    ticket_id: snapshot.ticket_id === null ? null : positiveId(snapshot.ticket_id, "ticket_id"),
    movimiento_origen_id: snapshot.movimiento_origen_id === null
      ? null : positiveId(snapshot.movimiento_origen_id, "movimiento_origen_id"),
  };
}

export function readAttributionInput(body: unknown): AttributionInput {
  const input = record(body, "atribución");
  // Explicit whitelist: no credentials, request auth, or arbitrary JSON is stored.
  const allowed = new Set([
    "id", "movimientoId", "movimientoCreatedAt", "identidadSnapshot",
    "sitioOrigenId", "evidencia", "motivo", "anteriorId",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    fail(400, "La atribución contiene campos no admitidos.");
  }
  const timestamp = input.movimientoCreatedAt;
  // Validate syntax only, never round-trip through JS Date (microsecond loss).
  if (typeof timestamp !== "string" ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::\d{2})?$/.test(timestamp)) {
    fail(400, "movimientoCreatedAt debe conservar la cadena SQL exacta recibida.");
  }
  return {
    id: input.id === undefined ? randomUUID() : uuid(input.id, "id"),
    movimientoId: positiveId(input.movimientoId, "movimientoId"),
    movimientoCreatedAt: timestamp,
    identidadSnapshot: readIdentitySnapshot(input.identidadSnapshot),
    sitioOrigenId: positiveId(input.sitioOrigenId, "sitioOrigenId"),
    evidencia: nonblank(input.evidencia, "evidencia"),
    motivo: nonblank(input.motivo, "motivo"),
    anteriorId: input.anteriorId === null ? null : uuid(input.anteriorId, "anteriorId"),
  };
}

export function assertAttributionRole(actor: EvidenceActor): void {
  if (!actor.activo || !["ADMIN", "SUPERVISOR"].includes(actor.rol)) {
    fail(403, "Sólo ADMIN o SUPERVISOR activo puede atribuir evidencia histórica.");
  }
}

export function assertHistoricalAttributionGate(actor: EvidenceActor): void {
  assertAttributionRole(actor);
  if (!CREDIT_HISTORICAL_ATTRIBUTION_ENABLED) {
    fail(403, "La atribución histórica está deshabilitada; requiere activación expresa del propietario.");
  }
}

export function assertAttributionSiteScope(actor: EvidenceActor, sitioId: number): void {
  assertAttributionRole(actor);
  // S20 is stricter than the existing shared operational supervisor helper.
  if (actor.rol !== "ADMIN" && actor.ubicacionId !== sitioId) {
    fail(403, "El supervisor sólo puede atribuir a su sitio asignado.");
  }
}

export function assertHistoricalPreparationAccess(
  actor: EvidenceActor,
  hasCreditReadAccess: boolean,
): void {
  assertAttributionRole(actor);
  if (!hasCreditReadAccess) fail(403, "Se requiere acceso de lectura a clientes_finanzas.");
}

export function sameIdentity(a: CreditIdentitySnapshot, b: CreditIdentitySnapshot): boolean {
  return a.cliente_id === b.cliente_id && a.tipo === b.tipo && a.importe === b.importe &&
    a.ticket_id === b.ticket_id && a.movimiento_origen_id === b.movimiento_origen_id;
}

export function assertMovementIdentity(
  row: CreditEvidenceRow,
  input: AttributionInput,
  clienteId: number,
): void {
  if (row.movimientoId !== input.movimientoId ||
    row.movimientoCreatedAt !== input.movimientoCreatedAt ||
    row.identidadSnapshot.cliente_id !== clienteId ||
    !sameIdentity(row.identidadSnapshot, input.identidadSnapshot)) {
    fail(409, "La identidad o fecha exacta del movimiento cambió; vuelve a consultar la evidencia.");
  }
}

function attributionMatches(row: CreditEvidenceRow, attribution: CreditAttribution): boolean {
  return row.movimientoId === attribution.movimientoId &&
    row.movimientoCreatedAt === attribution.movimientoCreatedAt &&
    sameIdentity(row.identidadSnapshot, attribution.identidadSnapshot);
}

export function presentCreditEvidence(row: CreditEvidenceRow, scope: EvidenceReadScope) {
  const latest = row.ultimaAtribucion;
  if (latest && !attributionMatches(row, latest)) {
    fail(409, "La atribución no coincide con la identidad completa del movimiento.");
  }
  const site = row.sitioOrigenOriginalId ?? latest?.sitioOrigenId ?? null;
  if (site === null ? !scope.incluirHistoricosSinSitio :
    scope.sitioIds !== null && !scope.sitioIds.includes(site)) return null;
  return {
    movimientoId: row.movimientoId,
    movimientoCreatedAt: row.movimientoCreatedAt,
    identidadSnapshot: row.identidadSnapshot,
    sitioOrigenOriginalId: row.sitioOrigenOriginalId,
    naturalezaOriginal: row.naturalezaOriginal,
    ultimaAtribucion: latest,
    sitioDeterminadoId: site,
    sitioEtiqueta: site === null ? "Sin sitio determinado" : row.sitioNombre ?? `Sitio ${site}`,
  };
}

// SQL jsonb snapshot exactly mirrors approved S20; no ticket/user/bank joins infer origin.
const identitySql = (alias: string) => `jsonb_build_object(
  'cliente_id', ${alias}.cliente_id, 'tipo', ${alias}.tipo::text,
  'importe', ${alias}.importe, 'ticket_id', ${alias}.ticket_id,
  'movimiento_origen_id', ${alias}.movimiento_origen_id)`;

// SQL text, not JS Date: canonical UTC independent of pooled session timezone,
// with all stored microseconds retained (no millisecond conversion).
const exactTimestampSql = (column: string) => `((${column} AT TIME ZONE 'UTC')::text || '+00')`;

const attributionSelect = `a.id::text AS id, a.movimiento_id AS "movimientoId",
  ${exactTimestampSql("a.movimiento_created_at")} AS "movimientoCreatedAt",
  a.identidad_snapshot AS "identidadSnapshot", a.sitio_origen_id AS "sitioOrigenId",
  a.evidencia, a.motivo, a.usuario_id AS "usuarioId", a.anterior_id::text AS "anteriorId",
  ${exactTimestampSql("a.created_at")} AS "createdAt"`;

export function buildCreditEvidenceReadQuery(clienteId: number, scope: EvidenceReadScope) {
  positiveId(clienteId, "clienteId");
  if (scope.sitioIds !== null) scope.sitioIds.forEach((id) => positiveId(id, "sitioId"));
  return {
    text: `SELECT m.id AS "movimientoId", ${exactTimestampSql("m.created_at")} AS "movimientoCreatedAt",
      ${identitySql("m")} AS "identidadSnapshot",
      m.sitio_origen_id AS "sitioOrigenOriginalId", m.naturaleza::text AS "naturalezaOriginal",
      CASE WHEN latest.id IS NULL THEN NULL ELSE to_jsonb(latest) END AS "ultimaAtribucion",
      u.nombre AS "sitioNombre"
      FROM movimientos_credito m
      LEFT JOIN LATERAL (
        SELECT ${attributionSelect} FROM atribuciones_credito_e1 a
        WHERE a.movimiento_id=m.id AND a.movimiento_created_at=m.created_at
          AND a.identidad_snapshot=${identitySql("m")}
          AND NOT EXISTS (SELECT 1 FROM atribuciones_credito_e1 successor WHERE successor.anterior_id=a.id)
        ORDER BY a.created_at DESC,a.id DESC LIMIT 1
      ) latest ON true
      LEFT JOIN ubicaciones u ON u.id=COALESCE(m.sitio_origen_id,latest."sitioOrigenId")
      WHERE m.cliente_id=$1 AND (
        (COALESCE(m.sitio_origen_id,latest."sitioOrigenId") IS NOT NULL
          AND ($2::int[] IS NULL OR COALESCE(m.sitio_origen_id,latest."sitioOrigenId")=ANY($2::int[])))
        OR ($3::boolean AND m.sitio_origen_id IS NULL AND latest.id IS NULL))
      ORDER BY m.created_at,m.id`,
    values: [clienteId, scope.sitioIds, scope.incluirHistoricosSinSitio],
  };
}

export async function loadCreditEvidence(
  database: EvidenceDatabase,
  clienteId: number,
  scope: EvidenceReadScope,
) {
  const query = buildCreditEvidenceReadQuery(clienteId, scope);
  const { rows } = await database.query<CreditEvidenceRow>(query.text, query.values);
  return {
    clienteId,
    atribucionHabilitada: CREDIT_HISTORICAL_ATTRIBUTION_ENABLED,
    movimientos: rows.map((row) => presentCreditEvidence(row, scope)).filter((row) => row !== null),
  };
}

export function sameAttributionContent(
  saved: CreditAttribution,
  input: AttributionInput,
  actorId: number,
): boolean {
  return saved.id === input.id && saved.usuarioId === actorId &&
    saved.movimientoId === input.movimientoId &&
    saved.movimientoCreatedAt === input.movimientoCreatedAt &&
    sameIdentity(saved.identidadSnapshot, input.identidadSnapshot) &&
    saved.sitioOrigenId === input.sitioOrigenId && saved.evidencia === input.evidencia &&
    saved.motivo === input.motivo && saved.anteriorId === input.anteriorId;
}

/**
 * Prepared future persistence, never called by the production route while gate
 * is closed. Caller supplies one transaction. No ledger/operation/session writes.
 */
export async function appendCreditAttribution(
  tx: EvidenceDatabase,
  actor: EvidenceActor,
  clienteId: number,
  input: AttributionInput,
): Promise<{ replay: boolean; atribucion: CreditAttribution }> {
  assertAttributionSiteScope(actor, input.sitioOrigenId);
  if (input.identidadSnapshot.cliente_id !== clienteId) {
    fail(409, "La identidad no pertenece al cliente solicitado.");
  }
  // UUID namespace is dedicated to attribution, not shared with monetary producers.
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`E1:ATRIBUCION:${input.id}`]);
  const saved = (await tx.query<CreditAttribution>(
    `SELECT ${attributionSelect} FROM atribuciones_credito_e1 a WHERE a.id=$1::uuid`,
    [input.id],
  )).rows[0];
  // Replay comes BEFORE active-site, original, and latest-chain checks.
  if (saved) {
    if (!sameAttributionContent(saved, input, actor.id)) {
      fail(409, "El UUID de atribución ya identifica contenido distinto.");
    }
    return { replay: true, atribucion: saved };
  }
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`E1:ATRIBUCION:MOVIMIENTO:${input.movimientoId}`]);
  const original = (await tx.query<CreditEvidenceRow>(
    `SELECT m.id AS "movimientoId",${exactTimestampSql("m.created_at")} AS "movimientoCreatedAt",
      ${identitySql("m")} AS "identidadSnapshot",m.sitio_origen_id AS "sitioOrigenOriginalId",
      m.naturaleza::text AS "naturalezaOriginal"
      FROM movimientos_credito m WHERE m.id=$1 FOR SHARE`, [input.movimientoId],
  )).rows[0];
  if (!original) fail(404, "Movimiento original inexistente.");
  assertMovementIdentity(original, input, clienteId);
  if (original.sitioOrigenOriginalId !== null) {
    fail(409, "Sólo se atribuyen históricos sin sitio original E1.");
  }
  const site = (await tx.query(
    "SELECT id FROM ubicaciones WHERE id=$1 AND activa AND tipo='TIENDA' FOR SHARE",
    [input.sitioOrigenId],
  )).rows[0];
  if (!site) fail(400, "Se requiere un sitio TIENDA activo.");
  // Inspect the entire movement chain: a reused id with stale evidence is a
  // conflict, not permission to append a second historical identity.
  const chain = (await tx.query<CreditAttribution>(
    `SELECT ${attributionSelect} FROM atribuciones_credito_e1 a
      WHERE a.movimiento_id=$1 ORDER BY a.created_at,a.id`, [input.movimientoId],
  )).rows;
  if (chain.some((item) => !attributionMatches(original, item))) {
    fail(409, "Existe evidencia de una identidad distinta para este ID.");
  }
  const predecessors = new Set(chain.map((item) => item.anteriorId).filter(Boolean));
  const heads = chain.filter((item) => !predecessors.has(item.id));
  if (input.anteriorId === input.id || heads.length > 1 ||
    (chain.length === 0 ? input.anteriorId !== null :
      heads.length !== 1 || heads[0].id !== input.anteriorId)) {
    fail(409, "anteriorId debe identificar la última atribución; vuelve a consultar la cadena.");
  }
  const inserted = (await tx.query<CreditAttribution>(
    `INSERT INTO atribuciones_credito_e1 AS a
      (id,movimiento_id,movimiento_created_at,identidad_snapshot,sitio_origen_id,
       evidencia,motivo,usuario_id,anterior_id)
      VALUES ($1::uuid,$2,$3::timestamptz,$4::jsonb,$5,$6,$7,$8,$9::uuid)
      RETURNING ${attributionSelect}`,
    [input.id, input.movimientoId, input.movimientoCreatedAt, JSON.stringify(input.identidadSnapshot),
      input.sitioOrigenId, input.evidencia, input.motivo, actor.id, input.anteriorId],
  )).rows[0];
  if (!inserted) fail(500, "No se obtuvo la atribución insertada.");
  return { replay: false, atribucion: inserted };
}