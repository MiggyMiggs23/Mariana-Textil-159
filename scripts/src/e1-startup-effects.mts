/** Inert library: no connections, CLI, environment, files, app imports or approval. */
import { createHash } from "node:crypto";

export interface Queryable {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
}
export const STARTUP_EFFECTS_VERSION = 1;
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  throw new Error("Unsupported evidence value");
}
const digest = (value: unknown) => sha256(canonical(value));
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message); // Never interpolate database row values.
}
const isHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isId = (value: unknown): value is string => typeof value === "string" && /^\d+$/.test(value);

const definitions = {
  pagos_proveedor: { key: "id" },
  aplicaciones_pago_proveedor: { key: "id" },
  movimientos_credito: { key: "id" },
  operaciones_credito_e1: { key: "productor || ':' || clave::text" },
  permisos_rol: { key: "id" },
  permisos_usuario: { key: "id" },
  permisos_ubicacion: { key: "id" },
  stock_minimo_sitios: { key: "ubicacion_id" },
  stock_minimos: { key: "id" },
  stock_minimo_episodios: { key: "id" },
  notificaciones_sistema: { key: "id" },
  usuarios_roles: {
    key: "id",
    source: "SELECT id, rol, alcance_consulta, activo, ubicacion_id FROM public.usuarios",
  },
  backfill_candidates: {
    key: "id",
    source: `SELECT e.id,e.proveedor_id,e.total_costo,e.fecha,e.usuario_id
FROM public.entradas e
WHERE e.proveedor_id IS NOT NULL AND e.total_costo IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.entrada_id=e.id AND p.tipo='COMPRA')`,
  },
} as const;
export type EffectsTable = keyof typeof definitions;
export const STARTUP_EFFECTS_TABLES = Object.freeze(Object.keys(definitions) as EffectsTable[]);

// Hash the exact SQL bytes (no whitespace normalization), uniformly for every query.
export const STARTUP_EFFECTS_CONTEXT_SQL = `SELECT
 current_setting('transaction_read_only') AS read_only,
 current_setting('transaction_isolation') AS isolation,
 current_database() AS database_name,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
 current_user::text AS database_role,
 pg_backend_pid()::text AS backend_pid,
 pg_postmaster_start_time()::text AS server_started_at,
 inet_server_addr()::text AS server_address, inet_server_port()::text AS server_port,
 current_setting('server_version_num') AS server_version,
 current_setting('TimeZone') AS timezone, current_setting('DateStyle') AS datestyle,
 current_setting('IntervalStyle') AS intervalstyle,
 current_setting('extra_float_digits') AS extra_float_digits,
 txid_current_snapshot()::text AS transaction_snapshot,
 clock_timestamp()::text AS observed_at`;

function fingerprintSql(table: EffectsTable): string {
  const definition = definitions[table];
  const source = "source" in definition ? definition.source : `SELECT * FROM public.${table}`;
  let classification = "'{}'::jsonb";
  if (table === "pagos_proveedor") {
    classification = `jsonb_build_object('type', tipo::text, 'entryId', entrada_id::text,
      'knownBackfill', tipo='COMPRA' AND notas IS NOT DISTINCT FROM 'Backfill automático desde entradas')`;
  } else if (table === "notificaciones_sistema") {
    classification = `jsonb_build_object('stockNotification',
      tipo='STOCK_MINIMO' AND entidad='stock_minimo_episodios')`;
  }
  return `WITH source AS (${source})
SELECT (${definition.key})::text AS key,
 encode(sha256(convert_to(to_jsonb(source)::text,'UTF8')),'hex') AS row_sha256,
 (SELECT jsonb_object_agg(field.key,
   encode(sha256(convert_to(field.value::text,'UTF8')),'hex') ORDER BY field.key)
  FROM jsonb_each(to_jsonb(source)) AS field) AS field_sha256,
 ${classification} AS classification
FROM source ORDER BY (${definition.key})::text COLLATE "C"`;
}
export const STARTUP_EFFECTS_SQL = Object.freeze(Object.fromEntries(
  STARTUP_EFFECTS_TABLES.map(table => [table, fingerprintSql(table)]),
) as Record<EffectsTable, string>);
export const STARTUP_EFFECTS_SQL_SHA256 = Object.freeze({
  context: sha256(STARTUP_EFFECTS_CONTEXT_SQL),
  ...Object.fromEntries(STARTUP_EFFECTS_TABLES.map(table => [table, sha256(STARTUP_EFFECTS_SQL[table])])),
});

export interface RowFingerprint {
  key: string;
  rowSha256: string;
  fieldSha256: Record<string, string>;
  classification: {
    type?: string;
    entryId?: string | null;
    knownBackfill?: boolean;
    stockNotification?: boolean;
  };
}
export interface TableFingerprint {
  count: number;
  sha256: string;
  rows: RowFingerprint[];
}
export interface StartupEffectsSnapshot {
  version: number;
  sqlSha256: typeof STARTUP_EFFECTS_SQL_SHA256;
  context: Record<string, string | null>;
  tables: Record<EffectsTable, TableFingerprint>;
  sha256: string;
}
function validateRow(table: EffectsTable, row: RowFingerprint): void {
  requireThat(object(row) && typeof row.key === "string" && row.key.length > 0 &&
    isHash(row.rowSha256) && object(row.fieldSha256) && object(row.classification), "Invalid fingerprint structure");
  requireThat(Object.keys(row.fieldSha256).length > 0 &&
    Object.values(row.fieldSha256).every(isHash), "Invalid field fingerprints");
  if (table === "operaciones_credito_e1") {
    requireThat(/^(VENTA_CREDITO|CANCELACION_VENTA_CREDITO|ABONO_ORDINARIO|ABONO_DIRIGIDO|REVERSO_ABONO|AJUSTE_MANUAL|BAJA_INCOBRABLE|COBRO_PENDIENTE):[a-f0-9-]{36}$/i.test(row.key),
      "Invalid operation identity");
  } else requireThat(isId(row.key), "Invalid stable numeric identity");
  const c = row.classification;
  if (table === "pagos_proveedor") {
    requireThat(Object.keys(c).sort().join(",") === "entryId,knownBackfill,type" &&
      ["COMPRA", "PAGO", "AJUSTE", "REVERSO"].includes(c.type ?? "") &&
      (c.entryId === null || isId(c.entryId)) && typeof c.knownBackfill === "boolean" &&
      (!c.knownBackfill || c.type === "COMPRA"), "Invalid supplier classification");
  } else if (table === "notificaciones_sistema") {
    requireThat(Object.keys(c).join(",") === "stockNotification" &&
      typeof c.stockNotification === "boolean", "Invalid stock classification");
  } else requireThat(Object.keys(c).length === 0, "Unexpected classification fields");
}
const contextFields = ["read_only", "isolation", "database_name", "database_oid", "database_role",
  "backend_pid", "server_started_at", "server_address", "server_port", "server_version", "timezone",
  "datestyle", "intervalstyle", "extra_float_digits", "transaction_snapshot", "observed_at"] as const;
function validateContext(context: Record<string, unknown>): void {
  requireThat(contextFields.every(key => Object.hasOwn(context, key) &&
    (typeof context[key] === "string" || (context[key] === null && ["server_address", "server_port"].includes(key)))),
  "Invalid snapshot context");
  requireThat(context.read_only === "on" &&
    ["repeatable read", "serializable"].includes(String(context.isolation)),
  "Collector requires an existing READ ONLY REPEATABLE READ or SERIALIZABLE transaction on one pinned client");
}

/**
 * Caller owns a pinned, idle-for-this-operation client and its existing READ ONLY
 * REPEATABLE READ/SERIALIZABLE transaction. No BEGIN/COMMIT/ROLLBACK or release here.
 * Never pass a Pool: snapshot consistency requires the SAME backend throughout.
 */
export async function collectStartupEffects(client: Queryable): Promise<StartupEffectsSnapshot> {
  const readContext = async () => {
    const result = await client.query(STARTUP_EFFECTS_CONTEXT_SQL);
    requireThat(result.rows.length === 1 && object(result.rows[0]), "Missing snapshot context");
    validateContext(result.rows[0]);
    return Object.fromEntries(contextFields.map(key => [key, result.rows[0]![key]])) as Record<string, string | null>;
  };
  const context = await readContext();
  const tables = {} as Record<EffectsTable, TableFingerprint>;
  for (const table of STARTUP_EFFECTS_TABLES) {
    const result = await client.query(STARTUP_EFFECTS_SQL[table]);
    const rows = result.rows.map(raw => {
      const row = { key: raw.key, rowSha256: raw.row_sha256,
        fieldSha256: raw.field_sha256, classification: raw.classification } as RowFingerprint;
      validateRow(table, row);
      return row;
    });
    requireThat(new Set(rows.map(row => row.key)).size === rows.length, "Duplicate snapshot identity");
    rows.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    tables[table] = { count: rows.length, sha256: digest(rows), rows };
  }
  const finalContext = await readContext();
  requireThat(contextFields.filter(key => key !== "observed_at")
    .every(key => context[key] === finalContext[key]), "Snapshot backend, transaction or settings changed");
  const body = { version: STARTUP_EFFECTS_VERSION, sqlSha256: STARTUP_EFFECTS_SQL_SHA256, context, tables };
  return { ...body, sha256: digest(body) };
}

export interface FieldDelta { field: string; beforeSha256: string | null; afterSha256: string | null }
export interface TableDelta {
  beforeCount: number; afterCount: number;
  beforeSha256: string; afterSha256: string;
  counts: { added: number; deleted: number; updated: number; unchanged: number };
  added: RowFingerprint[];
  deleted: RowFingerprint[];
  updated: { key: string; beforeSha256: string; afterSha256: string;
    beforeClassification: RowFingerprint["classification"];
    afterClassification: RowFingerprint["classification"]; fields: FieldDelta[] }[];
}
export interface StartupOutcome {
  backfill: "completed" | "cancelled" | "failed" | "unknown";
  initializers: "completed" | "failed" | "unknown";
  stock: "stopped-without-observed-error" | "failed" | "unknown";
  shutdown: "confirmed" | "forced" | "unknown";
}
function validateSnapshot(snapshot: StartupEffectsSnapshot): void {
  requireThat(snapshot.version === STARTUP_EFFECTS_VERSION &&
    canonical(snapshot.sqlSha256) === canonical(STARTUP_EFFECTS_SQL_SHA256), "Snapshot protocol/SQL mismatch");
  validateContext(snapshot.context);
  const { sha256: recorded, ...body } = snapshot;
  requireThat(digest(body) === recorded, "Snapshot digest mismatch");
  requireThat(Object.keys(snapshot.tables).sort().join(",") === [...STARTUP_EFFECTS_TABLES].sort().join(","),
    "Snapshot table inventory mismatch");
  for (const table of STARTUP_EFFECTS_TABLES) {
    const data = snapshot.tables[table];
    requireThat(data.count === data.rows.length && data.sha256 === digest(data.rows) &&
      new Set(data.rows.map(row => row.key)).size === data.count, "Table fingerprint mismatch");
    data.rows.forEach(row => validateRow(table, row));
  }
}

/** Pure comparison; empty stopReasons is NOT approval or proof of writer exclusion. */
export function compareStartupEffects(
  before: StartupEffectsSnapshot, after: StartupEffectsSnapshot, outcome: StartupOutcome,
) {
  validateSnapshot(before);
  validateSnapshot(after);
  const sameContext = ["database_name", "database_oid", "database_role", "server_started_at",
    "server_address", "server_port", "server_version", "timezone", "datestyle", "intervalstyle", "extra_float_digits"];
  requireThat(sameContext.every(key => before.context[key] === after.context[key]),
    "Before/after target or serialization settings mismatch");
  const tables = {} as Record<EffectsTable, TableDelta>;
  for (const table of STARTUP_EFFECTS_TABLES) {
    const old = before.tables[table], current = after.tables[table];
    const oldById = new Map(old.rows.map(row => [row.key, row]));
    const newById = new Map(current.rows.map(row => [row.key, row]));
    const added = current.rows.filter(row => !oldById.has(row.key));
    const deleted = old.rows.filter(row => !newById.has(row.key));
    const updated: TableDelta["updated"] = [];
    for (const row of current.rows) {
      const previous = oldById.get(row.key);
      if (!previous || previous.rowSha256 === row.rowSha256) continue;
      const fields = [...new Set([...Object.keys(previous.fieldSha256), ...Object.keys(row.fieldSha256)])].sort()
        .filter(field => previous.fieldSha256[field] !== row.fieldSha256[field])
        .map(field => ({ field, beforeSha256: previous.fieldSha256[field] ?? null,
          afterSha256: row.fieldSha256[field] ?? null }));
      updated.push({ key: row.key, beforeSha256: previous.rowSha256, afterSha256: row.rowSha256,
        beforeClassification: previous.classification, afterClassification: row.classification, fields });
    }
    tables[table] = { beforeCount: old.count, afterCount: current.count,
      beforeSha256: old.sha256, afterSha256: current.sha256,
      counts: { added: added.length, deleted: deleted.length, updated: updated.length,
        unchanged: old.count - deleted.length - updated.length }, added, deleted, updated };
  }
  const supplier = tables.pagos_proveedor;
  const backfillInsertions = supplier.added.filter(row => row.classification.knownBackfill === true);
  const changed = (table: EffectsTable) => {
    const counts = tables[table].counts;
    return counts.added + counts.deleted + counts.updated > 0;
  };
  const stopReasons: string[] = [];
  if (backfillInsertions.length) stopReasons.push("BACKFILL_INSERTED_ROWS_STOP_BEFORE_DDL");
  for (const table of ["pagos_proveedor", "aplicaciones_pago_proveedor", "movimientos_credito", "operaciones_credito_e1"] as const) {
    if (changed(table)) stopReasons.push(`FINANCIAL_DELTA:${table}`);
  }
  if (outcome.backfill !== "completed") stopReasons.push("BACKFILL_NOT_CONFIRMED_COMPLETE");
  if (outcome.initializers !== "completed") stopReasons.push("INITIALIZERS_NOT_CONFIRMED_COMPLETE");
  if (outcome.stock !== "stopped-without-observed-error") stopReasons.push("STOCK_OUTCOME_NOT_CONFIRMED");
  if (outcome.shutdown !== "confirmed") stopReasons.push("SHUTDOWN_NOT_CONFIRMED_GRACEFUL");
  return {
    version: STARTUP_EFFECTS_VERSION, beforeSha256: before.sha256, afterSha256: after.sha256,
    sqlSha256: STARTUP_EFFECTS_SQL_SHA256, tables,
    backfill: { insertedCount: backfillInsertions.length, insertedRows: backfillInsertions,
      beforeCandidateCount: before.tables.backfill_candidates.count,
      afterCandidateCount: after.tables.backfill_candidates.count,
      completed: outcome.backfill === "completed",
      attribution: "Exact newly present known-marker COMPRA rows; exclusivity/provenance require parent review" },
    ledgerUnchanged: !changed("pagos_proveedor"),
    existingLedgerUnchanged: supplier.counts.deleted === 0 && supplier.counts.updated === 0,
    financialTablesUnchanged: !["pagos_proveedor", "aplicaciones_pago_proveedor", "movimientos_credito", "operaciones_credito_e1"]
      .some(table => changed(table as EffectsTable)),
    outcome, stopReasons, approval: "NOT_EVALUATED_PARENT_ONLY",
  };
}