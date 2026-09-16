/**
 * Prompt H — narrow, owner-authorized purge operator.
 *
 * This is a new operator for the 2026-09-15/16 source snapshot.  It does not
 * use the historical purge operator, its historical lists, or its historical
 * backup.  With no argument it performs a read-only dry run.  `--apply` is
 * deliberately fail-closed and additionally requires the main-review gate:
 *
 *   PROMPT_H_MAIN_REVIEW=APPROVED \
 *   pnpm --filter @workspace/scripts exec tsx \
 *     src/prompt-h-authorized-purge.mts --apply
 *
 * The owner authorization is an evidence file, not an environment secret:
 * reports/prompt-h/autorizacion-purga.md.  The operator never starts/stops the
 * API, creates users, runs seeds, imports API startup initializers, disables a
 * trigger, changes a sequence, or retries a destructive transaction.
 *
 * The source mutation path has exactly one appDrizzle.transaction callback.
 * Every source query in that path is issued through its caller-owned `tx`.
 * The separate direct-read capture is opened only after the commit boundary.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Row = Record<string, any>;
type QueryRows = { rows: Row[]; rowCount?: number | null; command?: string };
export type Tx = { execute(query: unknown): Promise<QueryRows> };
type DrizzleRuntime = { raw(text: string): unknown };
type PgClient = {
  query(text: string, values?: unknown[]): Promise<QueryRows>;
  release(): void;
};
type PgPool = {
  connect(): Promise<PgClient>;
  end(): Promise<void>;
};
type AppDrizzle = {
  transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T>;
};

export type PurgeClasses = {
  A: string[];
  B: string[];
  C: string[];
};

type Evidence = {
  classes: PurgeClasses;
  snapshot: Row;
  preflight: Row;
  drive: Row;
  restore: Row;
  freshness: Row;
  authorizationSha256: string;
  backupSha256: string;
  backupDirectory: string;
  snapshotPath: string;
  preflightMetadataPath: string;
  preflightMarkdownPath: string;
  authorizationPath: string;
  drivePath: string;
  restoreMetadataPath: string;
};

type Catalogue = {
  tables: Row[];
  tableEvidence: Row[];
  columns: Row[];
  constraints: Row[];
  indexes: Row[];
  functions: Row[];
  triggers: Row[];
  sequences: Row[];
  database: Row;
};

type Identity = {
  database_name: string;
  schema_name: string;
  server_version: string;
  server_version_num: string;
  server_port: number | null;
  server_address: string | null;
  backend_pid: number;
};

type TransactionEvidence = {
  lockedBefore: Row;
  afterPurge: Row;
  sqlAudit: string[];
  commitAssertions: string[];
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/prompt-h");
const BACKUP_DIR = resolve(
  ROOT,
  ".local/backups/prompt-h-block2-20260915214248-7517",
);
const SNAPSHOT_PATH = resolve(BACKUP_DIR, "source-snapshot.json");
const DUMP_PATH = resolve(
  BACKUP_DIR,
  "prompt-h-block2-20260915214248-7517.dump",
);
const DRIVE_DUMP_PATH = resolve(
  BACKUP_DIR,
  "prompt-h-block2-20260915214248-7517.dump.drive-verified",
);
const FRESHNESS_PATH = resolve(BACKUP_DIR, "freshness-postbackup.json");
const RESTORE_METADATA_PATH = resolve(BACKUP_DIR, "restore-metadata.json");
const RESTORE_REPORT_PATH = resolve(REPORT_DIR, "block2-restore.md");
const RESTORE_EVIDENCE_PATH = resolve(
  REPORT_DIR,
  "block2-restore-metadata.json",
);
const DRIVE_PATH = resolve(REPORT_DIR, "block2-drive-verification.json");
const PREFLIGHT_METADATA_PATH = resolve(
  REPORT_DIR,
  "block3-preflight-metadata.json",
);
const PREFLIGHT_MARKDOWN_PATH = resolve(REPORT_DIR, "block3-preflight.md");
const AUTHORIZATION_PATH = resolve(REPORT_DIR, "autorizacion-purga.md");
const API_PAUSED_PATH = resolve(REPORT_DIR, "renovacion-api-pausado.md");
const API_IDENTITY_PATH = resolve(
  REPORT_DIR,
  "api-pool-identity-2026-09-15.md",
);
const DURABLE_STATUS_PATH = resolve(
  ROOT,
  ".local/prompt-h-authorized-purge-status.json",
);
const PLAN_PATH = resolve(REPORT_DIR, "authorized-purge-plan.md");
const EXPECTED_DUMP_SHA256 =
  "da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22";
const AUTHORIZATION_QUOTE = "Autorizo la purga";
const MAIN_REVIEW_GATE = "APPROVED";
const SOURCE_DATABASE = "heliumdb";
const SOURCE_SCHEMA = "public";
const EXPECTED_SERVER_VERSION = "16.10";
const EXPECTED_TABLE_COUNT = 60;
const EXPECTED_TRIGGER_COUNT = 14;
const EXPECTED_SEQUENCE_COUNT = 45;
const COUNTER_TARGETS = {
  auditoria_inventario_folio: { column: "ultimo_folio", value: "0", key: "ubicacion_id" },
  entrada_folio: { column: "ultimo_folio", value: "0", key: "ubicacion_id" },
  salida_folio: { column: "ultimo_folio", value: "0", key: "ubicacion_id" },
  viaje_folio: { column: "ultimo_folio", value: "0", key: "ubicacion_id" },
  ticket_folio: { column: "ultimo_folio", value: "999", key: "id" },
  series_consecutivo: { column: "ultimo_numero", value: "1000000", key: "id" },
} as const;

const schemaCategoryNames = [
  "tables",
  "columns",
  "constraints",
  "indexes",
  "functions",
  "triggers",
  "sequences",
] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableRef(table: string): string {
  return `${quoteIdentifier(SOURCE_SCHEMA)}.${quoteIdentifier(table)}`;
}

function sequenceRef(sequence: string): string {
  return `${quoteIdentifier(SOURCE_SCHEMA)}.${quoteIdentifier(sequence)}`;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(path: string): Promise<string> {
  return sha256Bytes(await fs.readFile(path));
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

function sameSet(left: Iterable<unknown>, right: Iterable<unknown>): boolean {
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function redact(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value);
  return text
    .replaceAll(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url-redacted]")
    .replaceAll(/password[^\s,;]*/gi, "password-redacted")
    .replaceAll(ROOT, "[workspace]");
}

/**
 * The current classes are read from the approved live preflight metadata.  No
 * historical/static table inventory is embedded in this operator.
 */
export function deriveApprovedClasses(preflight: Row): PurgeClasses {
  const lists = preflight.classification?.listNames;
  if (!lists || !Array.isArray(lists.A) || !Array.isArray(lists.B) || !Array.isArray(lists.C)) {
    throw new Error("approved preflight has no live A/B/C class metadata");
  }
  const classes = {
    A: lists.A.map(String),
    B: lists.B.map(String),
    C: lists.C.map(String),
  };
  assert.equal(classes.A.length, 35, "approved live class A must have 35 tables");
  assert.equal(classes.B.length, 7, "approved live class B must have 7 tables");
  assert.equal(classes.C.length, 18, "approved live class C must have 18 tables");
  const all = [...classes.A, ...classes.B, ...classes.C];
  assert.equal(new Set(all).size, 60, "approved live classes must cover 60 unique tables");
  assert(
    classes.B.includes("existencias"),
    "approved B class must include existencias",
  );
  for (const counter of Object.keys(COUNTER_TARGETS)) {
    assert(classes.B.includes(counter), `approved B class must include ${counter}`);
  }
  return {
    A: [...classes.A].sort((left, right) => left.localeCompare(right)),
    B: [...classes.B].sort((left, right) => left.localeCompare(right)),
    C: [...classes.C].sort((left, right) => left.localeCompare(right)),
  };
}

export function canonicalRowHashSql(table: string): string {
  return `WITH canonical_rows AS (
  SELECT to_jsonb(t)::text AS canonical
    FROM ${tableRef(table)} AS t
)
SELECT count(*)::text AS count,
       md5(COALESCE(
         string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)),
         ''
       )) AS ordered_canonical_row_hash
  FROM canonical_rows`;
}

export function buildPurgeSql(classes: PurgeClasses): string[] {
  const a = classes.A.map(tableRef).join(", ");
  const locks = [
    `LOCK TABLE ${classes.A.map(tableRef).join(", ")} IN ACCESS EXCLUSIVE MODE;`,
    `LOCK TABLE ${classes.B.map(tableRef).join(", ")} IN ACCESS EXCLUSIVE MODE;`,
    `LOCK TABLE ${classes.C.map(tableRef).join(", ")} IN SHARE MODE;`,
  ];
  const counters = Object.entries(COUNTER_TARGETS).map(
    ([table, target]) =>
      `UPDATE ${tableRef(table)} SET ${quoteIdentifier(target.column)} = ${target.value};`,
  );
  return [
    ...locks,
    `TRUNCATE TABLE ONLY ${a} CONTINUE IDENTITY RESTRICT;`,
    ...counters,
    "await reconstruirCacheExistencias(tx);",
  ];
}

export function assertStaticOperatorPlan(classes: PurgeClasses): void {
  assert.equal(classes.A.length, 35);
  assert.equal(classes.B.length, 7);
  assert.equal(classes.C.length, 18);
  const sql = buildPurgeSql(classes).join("\n");
  assert.match(sql, /TRUNCATE TABLE[\s\S]*CONTINUE IDENTITY RESTRICT/);
  assert.match(sql, /TRUNCATE TABLE ONLY/);
  assert.doesNotMatch(sql, /\bCASCADE\b|\bDELETE\b|\bRESTART IDENTITY\b|\bsetval\b|\bALTER SEQUENCE\b/i);
  assert.equal(
    buildPurgeSql(classes).filter((statement) => /^TRUNCATE TABLE/.test(statement)).length,
    1,
  );
  assert.equal(
    buildPurgeSql(classes).filter((statement) => /^UPDATE /.test(statement)).length,
    6,
  );
}

async function txRows(tx: Tx, sql: DrizzleRuntime, text: string): Promise<Row[]> {
  return (await tx.execute(sql.raw(text))).rows;
}

async function txOne(tx: Tx, sql: DrizzleRuntime, text: string): Promise<Row> {
  const rows = await txRows(tx, sql, text);
  if (!rows[0]) throw new Error(`query returned no row: ${text.slice(0, 80)}`);
  return rows[0];
}

async function captureTableEvidence(
  tx: Tx,
  sql: DrizzleRuntime,
  tables: string[],
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const table of tables) {
    const evidence = await txOne(tx, sql, canonicalRowHashSql(table));
    rows.push({
      schema: SOURCE_SCHEMA,
      table,
      count: String(evidence.count),
      orderedCanonicalRowHash: String(evidence.ordered_canonical_row_hash),
    });
  }
  return rows;
}

async function captureIdentity(tx: Tx, sql: DrizzleRuntime): Promise<Identity> {
  const row = await txOne(
    tx,
    sql,
    `SELECT current_database() AS database_name,
            current_schema() AS schema_name,
            current_setting('server_version') AS server_version,
            current_setting('server_version_num') AS server_version_num,
            inet_server_port()::int AS server_port,
            inet_server_addr()::text AS server_address,
            pg_backend_pid()::int AS backend_pid`,
  );
  return {
    database_name: String(row.database_name),
    schema_name: String(row.schema_name),
    server_version: String(row.server_version),
    server_version_num: String(row.server_version_num),
    server_port: row.server_port === null ? null : Number(row.server_port),
    server_address: row.server_address === null ? null : String(row.server_address),
    backend_pid: Number(row.backend_pid),
  };
}

async function captureTables(tx: Tx, sql: DrizzleRuntime): Promise<Row[]> {
  return txRows(
    tx,
    sql,
    `SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind,
            pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp_%'
      ORDER BY n.nspname, c.relname`,
  );
}

async function captureCatalogue(
  tx: Tx,
  sql: DrizzleRuntime,
  tables: Row[],
): Promise<Catalogue> {
  const tableEvidence = await captureTableEvidence(
    tx,
    sql,
    tables.map((row) => String(row.table)),
  );
  const columns = await txRows(
    tx,
    sql,
    `SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
            a.attnum AS ordinal_position, format_type(a.atttypid, a.atttypmod) AS data_type,
            a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expression,
            NULLIF(a.attidentity, '') AS identity_kind,
            NULLIF(a.attgenerated, '') AS generated_kind
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attnum > 0 AND NOT a.attisdropped
        AND c.relkind IN ('r', 'p', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp_%'
      ORDER BY n.nspname, c.relname, a.attnum`,
  );
  const constraints = await txRows(
    tx,
    sql,
    `SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
            CASE con.contype WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY'
              WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
              WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END AS constraint_type,
            pg_get_constraintdef(con.oid, true) AS definition,
            con.convalidated AS validated, con.condeferrable AS deferrable,
            con.condeferred AS initially_deferred,
            rn.nspname AS referenced_schema, rc.relname AS referenced_table,
            con.confupdtype::text AS update_action, con.confdeltype::text AS delete_action,
            con.confmatchtype::text AS match_type
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_class rc ON rc.oid = con.confrelid
       LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE con.contype IN ('c', 'f', 'p', 'u', 'x')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp_%'
      ORDER BY n.nspname, c.relname, con.conname`,
  );
  const indexes = await txRows(
    tx,
    sql,
    `SELECT tn.nspname AS schema, tc.relname AS table, i.relname AS index_name,
            pg_get_indexdef(i.oid) AS definition, x.indisunique AS is_unique,
            x.indisprimary AS is_primary, x.indisexclusion AS is_exclusion,
            x.indisvalid AS is_valid, x.indisready AS is_ready, x.indislive AS is_live,
            pg_get_expr(x.indpred, x.indrelid) AS predicate,
            pg_get_expr(x.indexprs, x.indrelid) AS expressions
       FROM pg_index x
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_class tc ON tc.oid = x.indrelid
       JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE tc.relkind IN ('r', 'p', 'f')
        AND tn.nspname NOT IN ('pg_catalog', 'information_schema')
        AND tn.nspname NOT LIKE 'pg_toast%'
        AND tn.nspname NOT LIKE 'pg_temp_%'
      ORDER BY tn.nspname, tc.relname, i.relname`,
  );
  const functions = await txRows(
    tx,
    sql,
    `SELECT n.nspname AS schema, p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS identity_arguments,
            pg_get_function_result(p.oid) AS result_type,
            pg_get_functiondef(p.oid) AS definition,
            p.prokind::text AS kind, p.provolatile::text AS volatility,
            p.prosecdef AS security_definer, p.proleakproof AS leakproof,
            p.proparallel::text AS parallel, p.proacl::text AS acl,
            pg_get_userbyid(p.proowner) AS owner, ext.extname AS extension_name
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       LEFT JOIN pg_depend dep
         ON dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
        AND dep.deptype = 'e'
       LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
      WHERE p.prokind IN ('f', 'p')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp_%'
      ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
  );
  const triggers = await txRows(
    tx,
    sql,
    `SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger_name,
            t.tgenabled::text AS enabled,
            pg_get_triggerdef(t.oid, true) AS definition,
            pn.nspname AS function_schema, p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS function_arguments
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
      WHERE NOT t.tgisinternal
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp_%'
      ORDER BY n.nspname, c.relname, t.tgname`,
  );
  const sequences = await txRows(
    tx,
    sql,
    `SELECT schemaname AS schema, sequencename AS sequence_name, data_type,
            start_value::text AS start_value, min_value::text AS min_value,
            max_value::text AS max_value, increment_by::text AS increment_by,
            cycle, cache_size::text AS cache_size
       FROM pg_sequences ps
      WHERE ps.schemaname NOT IN ('pg_catalog', 'information_schema')
        AND ps.schemaname NOT LIKE 'pg_toast%'
        AND ps.schemaname NOT LIKE 'pg_temp_%'
      ORDER BY ps.schemaname, ps.sequencename`,
  );
  const database = await txOne(
    tx,
    sql,
    `SELECT current_database() AS database_name,
            current_setting('server_version') AS server_version,
            current_setting('server_version_num') AS server_version_num`,
  );
  return {
    tables,
    tableEvidence,
    columns,
    constraints,
    indexes,
    functions,
    triggers,
    sequences,
    database,
  };
}

async function captureSequenceValues(
  tx: Tx,
  sql: DrizzleRuntime,
): Promise<Row[]> {
  return txRows(
    tx,
    sql,
    `SELECT schemaname AS schema, sequencename AS sequence_name,
            last_value::text AS last_value
       FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname NOT LIKE 'pg_toast%'
        AND schemaname NOT LIKE 'pg_temp_%'
      ORDER BY schemaname, sequencename`,
  );
}

async function captureCounters(
  tx: Tx,
  sql: DrizzleRuntime,
  classes: PurgeClasses,
): Promise<Record<string, Row[]>> {
  const result: Record<string, Row[]> = {};
  for (const table of classes.B.filter((candidate) => candidate !== "existencias")) {
    const target = COUNTER_TARGETS[table as keyof typeof COUNTER_TARGETS];
    result[table] = await txRows(
      tx,
      sql,
      `SELECT ${quoteIdentifier(target.key)}::text AS row_key,
              ${quoteIdentifier(target.column)}::text AS counter_value
         FROM ${tableRef(table)}
        ORDER BY ${quoteIdentifier(target.key)}`,
    );
  }
  return result;
}

async function captureCacheInvariant(
  tx: Tx,
  sql: DrizzleRuntime,
): Promise<Row> {
  const mismatch = await txRows(
    tx,
    sql,
    `WITH pairs AS (
       SELECT producto_id, ubicacion_id FROM existencias
       UNION
       SELECT producto_id, ubicacion_id FROM movimientos
       UNION
       SELECT producto_id, ubicacion_id FROM rollos
     ),
     movement_totals AS (
       SELECT producto_id, ubicacion_id, COALESCE(SUM(cantidad), 0) AS cantidad_total
         FROM movimientos
        GROUP BY producto_id, ubicacion_id
     ),
     available_rolls AS (
       SELECT producto_id, ubicacion_id, COUNT(*)::int AS rollos_count
         FROM rollos
        WHERE estado = 'DISPONIBLE'
        GROUP BY producto_id, ubicacion_id
     )
     SELECT pairs.producto_id, pairs.ubicacion_id
       FROM pairs
       LEFT JOIN existencias e USING (producto_id, ubicacion_id)
       LEFT JOIN movement_totals m USING (producto_id, ubicacion_id)
       LEFT JOIN available_rolls r USING (producto_id, ubicacion_id)
      WHERE e.producto_id IS NULL
         OR e.cantidad_total <> COALESCE(m.cantidad_total, 0)
         OR e.rollos_count <> COALESCE(r.rollos_count, 0)`,
  );
  const counts = await txRows(
    tx,
    sql,
    `SELECT
       (SELECT count(*)::int FROM existencias) AS existencias_rows,
       (SELECT count(*)::int FROM movimientos) AS movimientos_rows,
       (SELECT count(*)::int FROM rollos) AS rollos_rows`,
  );
  return {
    badPairs: mismatch.length,
    ...(counts[0] ?? {}),
  };
}

function normalizeCatalogue(value: Catalogue): Catalogue {
  const noVolatile = (row: Row): Row => {
    const copy = { ...row };
    delete copy.size_bytes;
    delete copy.last_value;
    return copy;
  };
  return {
    tables: value.tables.map(noVolatile),
    tableEvidence: value.tableEvidence.map(noVolatile),
    columns: value.columns.map(noVolatile),
    constraints: value.constraints.map(noVolatile),
    indexes: value.indexes.map(noVolatile),
    functions: value.functions.map((row) => {
      const copy = noVolatile(row);
      delete copy.owner;
      delete copy.acl;
      return copy;
    }),
    triggers: value.triggers.map(noVolatile),
    sequences: value.sequences.map(noVolatile),
    database: noVolatile(value.database),
  };
}

function assertCatalogueEqual(
  actual: Catalogue,
  expected: Catalogue,
  label: string,
): void {
  const left = normalizeCatalogue(actual);
  const right = normalizeCatalogue(expected);
  for (const category of schemaCategoryNames) {
    assert.equal(
      stable(left[category]),
      stable(right[category]),
      `${label} schema category drift: ${category}`,
    );
  }
}

function tableEvidenceMap(rows: Row[]): Map<string, Row> {
  return new Map(rows.map((row) => [String(row.table), row]));
}

function assertEvidenceEqual(
  actual: Row[],
  expected: Row[],
  label: string,
  tables: string[],
): void {
  const actualMap = tableEvidenceMap(actual);
  const expectedMap = tableEvidenceMap(expected);
  assert.equal(actualMap.size, tables.length, `${label} table evidence coverage`);
  assert.equal(expectedMap.size, tables.length, `${label} expected evidence coverage`);
  for (const table of tables) {
    assert.equal(
      String(actualMap.get(table)?.count),
      String(expectedMap.get(table)?.count),
      `${label} ${table} count`,
    );
    assert.equal(
      String(actualMap.get(table)?.orderedCanonicalRowHash),
      String(expectedMap.get(table)?.orderedCanonicalRowHash),
      `${label} ${table} full-column canonical hash`,
    );
  }
}

function assertIdentity(
  identity: Identity,
  parsedUrl: URL,
  label: string,
): void {
  assert.equal(identity.database_name, SOURCE_DATABASE, `${label} database identity`);
  assert.equal(identity.schema_name, SOURCE_SCHEMA, `${label} schema identity`);
  assert.equal(identity.server_version, EXPECTED_SERVER_VERSION, `${label} PostgreSQL`);
  const expectedPort = Number(parsedUrl.port || "5432");
  assert(
    identity.server_port === null || identity.server_port === expectedPort,
    `${label} same-host server port`,
  );
}

function assertSequenceValues(
  actual: Row[],
  approvedBackup: Row[],
  approvedPreflight: Row[],
  label: string,
): void {
  assert.equal(actual.length, EXPECTED_SEQUENCE_COUNT, `${label} must expose all 45 sequences`);
  const expectedMap = new Map(
    approvedBackup.map((row) => [`${row.schema}.${row.sequence_name}`, String(row.last_value)]),
  );
  const preflightMap = new Map(
    approvedPreflight.map((row) => [`${row.schema}.${row.sequence_name}`, String(row.last_value)]),
  );
  assert.equal(expectedMap.size, EXPECTED_SEQUENCE_COUNT, "backup sequence coverage");
  assert.equal(preflightMap.size, EXPECTED_SEQUENCE_COUNT, "preflight sequence coverage");
  assert(
    expectedMap.has("public.contenedores_folio_seq"),
    "business contenedores sequence is missing",
  );
  for (const [key, expected] of expectedMap) {
    assert.equal(preflightMap.get(key), expected, `approved sequence mismatch ${key}`);
  }
  for (const row of actual) {
    const key = `${row.schema}.${row.sequence_name}`;
    assert.equal(String(row.last_value), expectedMap.get(key), `${label} sequence ${key}`);
  }
}

export function assertTriggersUnchanged(actual: Row[], expected: Row[], label: string): void {
  assert.equal(actual.length, EXPECTED_TRIGGER_COUNT, `${label} trigger count`);
  assert.equal(stable(actual), stable(expected), `${label} trigger definitions/state`);
  assert(
    actual.every((row) => ["O", "A"].includes(String(row.enabled))),
    `${label} all triggers must remain enabled (origin or always), with exact original states`,
  );
}

function assertCounterTargets(
  actual: Record<string, Row[]>,
  approved: Row[],
  label: string,
): void {
  for (const [table, target] of Object.entries(COUNTER_TARGETS)) {
    const expectedRows = approved.find((entry) => entry.table === table)?.rows;
    assert(Array.isArray(expectedRows), `${label} missing approved rows for ${table}`);
    const rows = actual[table] ?? [];
    assert.equal(rows.length, expectedRows.length, `${label} ${table} row count`);
    const expectedKeys = expectedRows.map((row: Row) => String(row.row_key)).sort();
    const actualKeys = rows.map((row) => String(row.row_key)).sort();
    assert.deepEqual(actualKeys, expectedKeys, `${label} ${table} row keys`);
    assert(
      rows.every((row) => String(row.counter_value) === target.value),
      `${label} ${table} target ${target.value}`,
    );
  }
}

function assertCounterShape(
  actual: Record<string, Row[]>,
  approved: Row[],
  label: string,
): void {
  for (const table of Object.keys(COUNTER_TARGETS)) {
    const expectedRows = approved.find((entry) => entry.table === table)?.rows;
    assert(Array.isArray(expectedRows), `${label} missing approved rows for ${table}`);
    const rows = actual[table] ?? [];
    assert.equal(rows.length, expectedRows.length, `${label} ${table} row count`);
    assert.deepEqual(
      rows.map((row) => String(row.row_key)).sort(),
      expectedRows.map((row: Row) => String(row.row_key)).sort(),
      `${label} ${table} row keys`,
    );
  }
}

export function assertApiPauseEvidence(
  renewal: string,
  identity: string,
): void {
  assert.match(renewal, /\*\*PASS[^]*API detenida/i);
  assert.match(renewal, /no\s+se\s+reinició\s+la\s+API/i);
  assert.match(renewal, /Escritores inesperados:\s*\*\*0/i);
  assert.match(identity, /CONFIRMED_FROM_RUNNING_API_POOL_READ_ONLY/);
  assert.match(identity, /current_database\(\).*heliumdb|heliumdb.*current_schema\(\).*public/s);
}

async function assertLocalPortClosed(port: number): Promise<void> {
  const open = await new Promise<boolean>((resolvePort) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (value: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePort(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(600, () => finish(false));
  });
  assert.equal(open, false, `source API port ${port} is open; API must remain stopped`);
}

async function loadEvidence(): Promise<Evidence> {
  const [
    snapshot,
    preflight,
    drive,
    restoreMetadata,
    restore,
    freshness,
    renewal,
    identity,
    authorization,
    restoreReport,
    preflightMarkdown,
  ] = await Promise.all([
    readJson(SNAPSHOT_PATH),
    readJson(PREFLIGHT_METADATA_PATH),
    readJson(DRIVE_PATH),
    readJson(RESTORE_METADATA_PATH),
    readJson(RESTORE_EVIDENCE_PATH),
    readJson(FRESHNESS_PATH),
    fs.readFile(API_PAUSED_PATH, "utf8"),
    fs.readFile(API_IDENTITY_PATH, "utf8"),
    fs.readFile(AUTHORIZATION_PATH, "utf8"),
    fs.readFile(RESTORE_REPORT_PATH, "utf8"),
    fs.readFile(PREFLIGHT_MARKDOWN_PATH, "utf8"),
  ]);
  assert.match(
    authorization,
    new RegExp(`^>\\s*${AUTHORIZATION_QUOTE.replaceAll(" ", "\\s+")}\\s*$`, "m"),
    "owner authorization quote is absent",
  );
  assertApiPauseEvidence(renewal, identity);
  assert.match(restoreReport, /\*\*PASS\*\*/);
  assert.match(preflightMarkdown, /COMPLETE_READ_ONLY_PREFLIGHT/);
  assert.equal(resolve(ROOT, restore.report), RESTORE_REPORT_PATH);
  assert.equal(restoreMetadata.restoreExitCode, 0);
  assert.equal(restoreMetadata.sourceDatabase, SOURCE_DATABASE);
  assert.equal(restoreMetadata.sourceOwner, "postgres");
  assert.equal(restoreMetadata.restoredOwner, "postgres");
  assert.equal(restoreMetadata.unixSocketOnlyVerified, true);
  assert.equal(restoreMetadata.database, "restore_disposable_20260915214248-7517");
  assert.equal(preflight.status, "COMPLETE_READ_ONLY_PREFLIGHT");
  assert.equal(preflight.freshness?.status, "MATCHES_VERIFIED_BACKUP_AT_CAPTURE");
  assert.equal(preflight.classification?.liveTableCount, EXPECTED_TABLE_COUNT);
  assert.equal(preflight.preflightGates?.triggerCount, EXPECTED_TRIGGER_COUNT);
  assert.equal(preflight.preflightGates?.enabledTriggerCount, EXPECTED_TRIGGER_COUNT);
  assert.equal(preflight.sequencePreservation?.count, EXPECTED_SEQUENCE_COUNT);
  assert.equal(
    preflight.freshness?.sourceSnapshotPath,
    relative(ROOT, SNAPSHOT_PATH),
  );
  assert.equal(
    preflight.freshness?.backupDirectory,
    relative(ROOT, BACKUP_DIR),
  );
  assert.equal(preflight.freshness?.dumpSha256, EXPECTED_DUMP_SHA256);
  assert.equal(preflight.freshness?.tableEvidence?.status, "MATCH");
  assert.equal(preflight.freshness?.catalogue?.status, "MATCH");
  assert.equal(preflight.freshness?.sequenceState?.status, "MATCH");
  assert.equal(preflight.freshness?.catalogue?.differingKeys?.length, 0);
  assert.equal(preflight.freshness?.tableEvidence?.differingKeys?.length, 0);
  assert.equal(preflight.freshness?.sequenceState?.differingKeys?.length, 0);
  assert.equal(preflight.freshness?.database?.status, "MATCH");
  assert.equal(preflight.connection?.database, SOURCE_DATABASE);
  assert.equal(preflight.connection?.schema, SOURCE_SCHEMA);
  assert.equal(preflight.connection?.serverVersion, EXPECTED_SERVER_VERSION);
  assert.equal(preflight.connection?.transactionIsolation, "repeatable read");
  assert.equal(preflight.connection?.transactionReadOnly, "on");
  assert.equal(preflight.connection?.testOverridesPresent, false);
  assert.equal(preflight.classification?.listsMatchDynamicLiveSet, true);
  assert.deepEqual(preflight.classification?.counts, { A: 35, B: 7, C: 18 });
  assert.deepEqual(preflight.metadata?.catalogueCounts, {
    tables: EXPECTED_TABLE_COUNT,
    tableEvidence: EXPECTED_TABLE_COUNT,
    columns: 604,
    constraints: 286,
    indexes: 218,
    functions: 49,
    triggers: EXPECTED_TRIGGER_COUNT,
    sequences: EXPECTED_SEQUENCE_COUNT,
  });
  assert.equal(preflight.preflightGates?.triggerState, "PASS");
  assert.equal(preflight.triggers?.count, EXPECTED_TRIGGER_COUNT);
  assert.equal(preflight.triggers?.enabledCount, EXPECTED_TRIGGER_COUNT);
  assert.equal(preflight.triggers?.allEnabled, true);
  assert.equal(preflight.sequencePreservation?.unchangedDuringPreflight, true);
  assert.equal(preflight.sequencePreservation?.valuesChangedByThisScript, false);
  assert.equal(preflight.sequencePreservation?.sequenceResetExecuted, false);
  assert.equal(preflight.sequencePreservation?.before?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(preflight.sequencePreservation?.after?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(preflight.cacheRebuildInspection?.execution_status, "NOT_EXECUTED_BY_BLOCK3");
  assert.equal(preflight.cacheRebuildInspection?.accepts_caller_transaction, true);
  assert.equal(preflight.cacheRebuildInspection?.uses_caller_transaction_when_supplied, true);
  assert.equal(preflight.cacheRebuildInspection?.contains_delete_or_truncate, false);
  assert.equal(preflight.conceptualPlan?.executed, false);
  for (const [key, value] of Object.entries(preflight.sourceMutationPolicy ?? {})) {
    if (key === "transaction") continue;
    assert.equal(value, false, `preflight mutation policy ${key}`);
  }
  const classes = deriveApprovedClasses(preflight);
  const sourceTables = snapshot.source?.catalogue?.tables ?? [];
  const sourceTableNames = sourceTables.map((row: Row) => String(row.table));
  assert.equal(sourceTableNames.length, EXPECTED_TABLE_COUNT, "backup table coverage");
  assert(sameSet(sourceTableNames, [...classes.A, ...classes.B, ...classes.C]), "backup table set drift");
  assert.equal(snapshot.source?.database?.database_name, SOURCE_DATABASE);
  assert.equal(snapshot.source?.catalogue?.triggers?.length, EXPECTED_TRIGGER_COUNT);
  assert.equal(snapshot.source?.catalogue?.sequences?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(snapshot.source?.sequenceStateBeforeDump?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(freshness.status, "PASS");
  assert.equal(freshness.freshnessStatus, "SOURCE_UNCHANGED_SINCE_BACKUP");
  assert.equal(freshness.tableEvidence?.snapshotCount, EXPECTED_TABLE_COUNT);
  assert.equal(freshness.tableEvidence?.currentCount, EXPECTED_TABLE_COUNT);
  assert.equal(freshness.sequenceState?.snapshotCount, EXPECTED_SEQUENCE_COUNT);
  assert.equal(freshness.sequenceState?.currentCount, EXPECTED_SEQUENCE_COUNT);
  assert.equal(freshness.tableEvidence?.differingKeys?.length, 0);
  assert.equal(freshness.sequenceState?.differingKeys?.length, 0);
  assert.equal(freshness.rawRowsPersisted, false);
  assert.equal(drive.status, "PASS");
  assert.equal(drive.apiPaused, true);
  assert.equal(drive.hashesMatch, true);
  assert.equal(drive.privatePermissionsVerified, true);
  assert.equal(drive.sourceSha256, EXPECTED_DUMP_SHA256);
  assert.equal(drive.downloadedSha256, EXPECTED_DUMP_SHA256);
  assert.equal(drive.sourceBytes, drive.downloadedBytes);
  assert.equal(drive.localPath, relative(ROOT, DUMP_PATH));
  assert.equal(drive.downloadedPath, relative(ROOT, DRIVE_DUMP_PATH));
  assert.equal(restore.status, "PASS");
  assert.equal(restore.sourceDatabase, SOURCE_DATABASE);
  assert.equal(restore.sourceServerVersion, EXPECTED_SERVER_VERSION);
  assert.equal(restore.comparison?.status, "PASS");
  const comparisonCategories = [
    "tables",
    "columns",
    "constraints",
    "indexes",
    "functions",
    "triggers",
    "sequences",
    "tableCountsAndCanonicalRowHashes",
    "sequenceStateAfterDump",
  ];
  assert.deepEqual(Object.keys(restore.comparison?.categories ?? {}).sort(), comparisonCategories.sort());
  for (const category of comparisonCategories) {
    assert.deepEqual(
      restore.comparison.categories[category],
      [],
      `restore comparison ${category} must have no differences`,
    );
  }
  assert.equal(restore.comparison?.databaseMetadataMatched, true);
  assert.equal(restore.comparison?.dynamicTableCount, EXPECTED_TABLE_COUNT);
  assert.equal(restore.comparison?.restoredTableCount, EXPECTED_TABLE_COUNT);
  assert.equal(restore.comparison?.sourceTriggerCount, EXPECTED_TRIGGER_COUNT);
  assert.equal(restore.comparison?.restoredTriggerCount, EXPECTED_TRIGGER_COUNT);
  assert.equal(restore.comparison?.allNoninternalTriggerEnabledStatesCompared, true);
  assert.equal(restore.comparison?.sourceSequenceStateBeforeDump?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(restore.comparison?.sourceSequenceStateAfterDump?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(restore.comparison?.restoredSequenceState?.length, EXPECTED_SEQUENCE_COUNT);
  assert.equal(restore.comparison?.sequenceChangedDuringDump, false);
  const dumpSha = await sha256File(DUMP_PATH);
  const downloadedSha = await sha256File(DRIVE_DUMP_PATH);
  assert.equal(dumpSha, EXPECTED_DUMP_SHA256, "local dump hash");
  assert.equal(downloadedSha, EXPECTED_DUMP_SHA256, "Drive-verified local file hash");
  assert.equal(snapshot.archive?.sha256, EXPECTED_DUMP_SHA256, "snapshot archive hash");
  assert.equal(restore.archive?.sha256, EXPECTED_DUMP_SHA256, "restore archive hash");
  const authorizationSha256 = await sha256File(AUTHORIZATION_PATH);
  return {
    classes,
    snapshot,
    preflight,
    drive,
    restore,
    freshness,
    authorizationSha256,
    backupSha256: dumpSha,
    backupDirectory: relative(ROOT, BACKUP_DIR),
    snapshotPath: relative(ROOT, SNAPSHOT_PATH),
    preflightMetadataPath: relative(ROOT, PREFLIGHT_METADATA_PATH),
    preflightMarkdownPath: relative(ROOT, PREFLIGHT_MARKDOWN_PATH),
    authorizationPath: relative(ROOT, AUTHORIZATION_PATH),
    drivePath: relative(ROOT, DRIVE_PATH),
    restoreMetadataPath: relative(ROOT, RESTORE_METADATA_PATH),
  };
}

function assertSourceOverridesAbsent(): void {
  const forbidden = [
    "TEST_DATABASE_URL",
    "DATABASE_TEST_URL",
    "APPLICATION_DATABASE_URL",
    "DATABASE_URL_OVERRIDE",
    "DB_URL_OVERRIDE",
    "REQUIRE_ISOLATED_TEST_DATABASE",
    "TEST_DATABASE_PREPARATION_PHASE",
  ];
  const present = forbidden.filter(
    (key) => process.env[key] !== undefined && process.env[key] !== "",
  );
  assert.equal(present.length, 0, `test/application URL override present: ${present.join(", ")}`);
  assert.notEqual(
    process.env.NODE_ENV,
    "test",
    "NODE_ENV=test would redirect @workspace/db to the disabled unit-test endpoint",
  );
  assert(process.env.DATABASE_URL, "DATABASE_URL is required");
  const parsed = new URL(process.env.DATABASE_URL);
  assert(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.equal(decodeURIComponent(parsed.pathname.replace(/^\/+/, "")), SOURCE_DATABASE);
  assert(parsed.hostname, "DATABASE_URL host is required for same-host identity");
}

async function executeReadOnly(
  appDrizzle: AppDrizzle,
  sql: DrizzleRuntime,
  evidence: Evidence,
): Promise<Row> {
  return appDrizzle.transaction(async (tx) => {
    await tx.execute(
      sql.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"),
    );
    const identity = await captureIdentity(tx, sql);
    assertIdentity(identity, new URL(process.env.DATABASE_URL!), "dry-run");
    const tables = await captureTables(tx, sql);
    assert.equal(tables.length, EXPECTED_TABLE_COUNT, "dry-run live table count");
    assert(sameSet(tables.map((row) => String(row.table)), [
      ...evidence.classes.A,
      ...evidence.classes.B,
      ...evidence.classes.C,
    ]), "dry-run live table set");
    const catalogue = await captureCatalogue(tx, sql, tables);
    const expectedCatalogue = evidence.snapshot.source.catalogue as Catalogue;
    assertCatalogueEqual(catalogue, expectedCatalogue, "dry-run");
    const allTables = [...evidence.classes.A, ...evidence.classes.B, ...evidence.classes.C];
    assertEvidenceEqual(
      catalogue.tableEvidence,
      evidence.snapshot.source.catalogue.tableEvidence,
      "dry-run backup",
      allTables,
    );
    assertEvidenceEqual(
      catalogue.tableEvidence,
      evidence.preflight.tableEvidence,
      "dry-run preflight",
      allTables,
    );
    assertSequenceValues(
      await captureSequenceValues(tx, sql),
      evidence.snapshot.source.sequenceStateBeforeDump,
      evidence.preflight.sequencePreservation.before,
      "dry-run",
    );
    return {
      mode: "dry-run",
      identity,
      tables: tables.length,
      classes: evidence.classes,
      schemaCategories: schemaCategoryNames,
      all60FullColumnHashes: true,
      all45SequenceValues: true,
      writesExecuted: false,
      sqlAudit: ["BEGIN", "SET TRANSACTION ... READ ONLY", ...buildPurgeSql(evidence.classes)],
    };
  });
}

async function executeApply(
  appDrizzle: AppDrizzle,
  sql: DrizzleRuntime,
  rebuild: (tx: Tx) => Promise<void>,
  evidence: Evidence,
): Promise<{ transaction: TransactionEvidence; callbackCompleted: boolean }> {
  let callbackCompleted = false;
  try {
    const transaction = await appDrizzle.transaction(async (tx) => {
    await tx.execute(
      sql.raw("SET LOCAL statement_timeout = '180s'"),
    );
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '5s'"));
    await tx.execute(sql.raw("SET LOCAL idle_in_transaction_session_timeout = '300s'"));
    const parsedUrl = new URL(process.env.DATABASE_URL!);
    const identity = await captureIdentity(tx, sql);
    assertIdentity(identity, parsedUrl, "locked source");
    const tables = await captureTables(tx, sql);
    const allTables = [...evidence.classes.A, ...evidence.classes.B, ...evidence.classes.C];
    assert.equal(tables.length, EXPECTED_TABLE_COUNT, "unexpected new/missing table");
    assert(
      sameSet(tables.map((row) => String(row.table)), allTables),
      "unexpected table drift before locking",
    );

    // Locks are deterministic by class and then table name.  A/B are fully
    // exclusive because they are mutated/rebuilt; C is SHARE because it is
    // preserved but must not change while the C hashes are revalidated.
    for (const statement of [
      `LOCK TABLE ${evidence.classes.A.map(tableRef).join(", ")} IN ACCESS EXCLUSIVE MODE`,
      `LOCK TABLE ${evidence.classes.B.map(tableRef).join(", ")} IN ACCESS EXCLUSIVE MODE`,
      `LOCK TABLE ${evidence.classes.C.map(tableRef).join(", ")} IN SHARE MODE`,
    ]) {
      await tx.execute(sql.raw(statement));
    }

    // Re-read all evidence only after the complete lock set is held.
    const lockedIdentity = await captureIdentity(tx, sql);
    assertIdentity(lockedIdentity, parsedUrl, "locked source");
    const lockedTables = await captureTables(tx, sql);
    assert.equal(lockedTables.length, EXPECTED_TABLE_COUNT, "locked table coverage");
    const lockedCatalogue = await captureCatalogue(tx, sql, lockedTables);
    assertCatalogueEqual(
      lockedCatalogue,
      evidence.snapshot.source.catalogue as Catalogue,
      "locked source",
    );
    assertEvidenceEqual(
      lockedCatalogue.tableEvidence,
      evidence.snapshot.source.catalogue.tableEvidence,
      "locked source backup",
      allTables,
    );
    assertEvidenceEqual(
      lockedCatalogue.tableEvidence,
      evidence.preflight.tableEvidence,
      "locked source preflight",
      allTables,
    );
    assertSequenceValues(
      await captureSequenceValues(tx, sql),
      evidence.snapshot.source.sequenceStateBeforeDump,
      evidence.preflight.sequencePreservation.before,
      "locked source",
    );
    assertTriggersUnchanged(
      lockedCatalogue.triggers,
      evidence.snapshot.source.catalogue.triggers,
      "locked source",
    );
    const authBeforeWrite = await fs.readFile(AUTHORIZATION_PATH, "utf8");
    assert.match(
      authBeforeWrite,
      new RegExp(`^>\\s*${AUTHORIZATION_QUOTE.replaceAll(" ", "\\s+")}\\s*$`, "m"),
      "authorization quote absent under lock",
    );
    assert.equal(
      sha256Bytes(Buffer.from(authBeforeWrite)),
      evidence.authorizationSha256,
      "authorization file changed after evidence load",
    );

    const preflightRows = evidence.preflight.bBeforeTarget as Row[];
    const beforeCounters = await captureCounters(tx, sql, evidence.classes);
    assertCounterShape(beforeCounters, preflightRows, "locked source counter shape");
    // A final catalogue pass immediately before the first mutation catches a
    // relation created outside the known 60-table lock set as well as any
    // metadata drift that appeared while the lock set was acquired.
    const preWriteTables = await captureTables(tx, sql);
    assert.equal(preWriteTables.length, EXPECTED_TABLE_COUNT, "new table before write");
    assert(
      sameSet(preWriteTables.map((row) => String(row.table)), allTables),
      "unexpected table drift immediately before write",
    );
    const preWriteCatalogue = await captureCatalogue(tx, sql, preWriteTables);
    assertCatalogueEqual(preWriteCatalogue, lockedCatalogue, "pre-write schema");
    assertEvidenceEqual(
      preWriteCatalogue.tableEvidence,
      evidence.snapshot.source.catalogue.tableEvidence,
      "pre-write source",
      allTables,
    );
    assertSequenceValues(
      await captureSequenceValues(tx, sql),
      evidence.snapshot.source.sequenceStateBeforeDump,
      evidence.preflight.sequencePreservation.before,
      "pre-write",
    );
    assertTriggersUnchanged(
      preWriteCatalogue.triggers,
      lockedCatalogue.triggers,
      "pre-write",
    );
    await assertLocalPortClosed(8080);

    const sqlAudit = buildPurgeSql(evidence.classes);
    const truncateStatements = sqlAudit.filter((statement) => statement.startsWith("TRUNCATE TABLE"));
    assert.equal(truncateStatements.length, 1, "exactly one A-only TRUNCATE required");
    // This is the sole destructive statement.  There is no DELETE fallback,
    // no CASCADE, and no trigger/sequence alteration in this operator.
    await tx.execute(sql.raw(truncateStatements[0]!));
    for (const statement of sqlAudit.filter((entry) => entry.startsWith("UPDATE "))) {
      await tx.execute(sql.raw(statement));
    }
    await rebuild(tx);

    const afterCatalogue = await captureCatalogue(tx, sql, await captureTables(tx, sql));
    const afterEvidence = afterCatalogue.tableEvidence;
    const afterA = afterEvidence.filter((row) => evidence.classes.A.includes(String(row.table)));
    assert(afterA.every((row) => Number(row.count) === 0), "all 35 A tables must be empty");
    assert.equal(afterA.length, 35, "all A tables must have inside-transaction evidence");
    assertEvidenceEqual(
      afterEvidence.filter((row) => evidence.classes.C.includes(String(row.table))),
      evidence.snapshot.source.catalogue.tableEvidence.filter((row: Row) =>
        evidence.classes.C.includes(String(row.table))),
      "post-purge C",
      evidence.classes.C,
    );
    const afterCounters = await captureCounters(tx, sql, evidence.classes);
    assertCounterTargets(afterCounters, preflightRows, "post-purge counter");
    const beforeExistencias = evidence.snapshot.source.catalogue.tableEvidence.find(
      (row: Row) => row.table === "existencias",
    );
    const afterExistencias = afterEvidence.find((row) => row.table === "existencias");
    assert.equal(
      String(afterExistencias?.count),
      String(beforeExistencias?.count),
      "existencias row count must be preserved by rebuild",
    );
    const invariant = await captureCacheInvariant(tx, sql);
    assert.equal(Number(invariant.badPairs), 0, "all cache/movement/roll pairs must agree");
    assert.equal(Number(invariant.movimientos_rows), 0, "movimientos must be empty");
    assert.equal(Number(invariant.rollos_rows), 0, "rollos must be empty");
    const afterSequences = await captureSequenceValues(tx, sql);
    assertSequenceValues(
      afterSequences,
      evidence.snapshot.source.sequenceStateBeforeDump,
      evidence.preflight.sequencePreservation.before,
      "post-purge",
    );
    assertTriggersUnchanged(
      afterCatalogue.triggers,
      lockedCatalogue.triggers,
      "post-purge",
    );
    const afterIdentity = await captureIdentity(tx, sql);
    assertIdentity(afterIdentity, parsedUrl, "post-purge");
    const afterSchemaTables = await captureTables(tx, sql);
    assertCatalogueEqual(
      { ...afterCatalogue, tables: afterSchemaTables },
      lockedCatalogue,
      "post-purge schema",
    );
    const afterC = afterEvidence.filter((row) => evidence.classes.C.includes(String(row.table)));
    const afterB = afterEvidence.filter((row) => evidence.classes.B.includes(String(row.table)));
    callbackCompleted = true;
    return {
      lockedBefore: {
        identity: lockedIdentity,
        catalogueCounts: schemaCategoryNames.reduce(
          (result, category) => ({ ...result, [category]: lockedCatalogue[category].length }),
          {} as Row,
        ),
        all60CountsAndFullColumnHashes: lockedCatalogue.tableEvidence,
        all45SequenceValues: await captureSequenceValues(tx, sql),
        triggerStates: lockedCatalogue.triggers,
      },
      afterPurge: {
        identity: afterIdentity,
        perTableA: afterA,
        perTableB: afterB,
        perTableC: afterC,
        invariant,
        all45SequenceValues: afterSequences,
        triggerStates: afterCatalogue.triggers,
        movementsRows: invariant.movimientos_rows,
        rollosRows: invariant.rollos_rows,
      },
      sqlAudit,
      commitAssertions: [
        "A=35 all count 0",
        "B six counter targets exact; existencias rebuilt and row count preserved",
        "C=18 exact count + full-column canonical hash",
        "movimientos=0 and rollos=0",
        "all inventory pairs consistent",
        "all 45 sequence values unchanged",
        "all 14 trigger definitions/states unchanged and enabled O",
      ],
    } satisfies TransactionEvidence;
    });
    return { transaction, callbackCompleted };
  } catch (error) {
    // Drizzle can reject after the callback returned if the COMMIT itself
    // failed or its acknowledgement was lost.  Preserve that distinction for
    // the durable status and never let the caller retry the destructive SQL.
    (error as Row).callbackCompleted = callbackCompleted;
    throw error;
  }
}

async function postCommitDirectRead(
  appDrizzle: AppDrizzle,
  sql: DrizzleRuntime,
  evidence: Evidence,
): Promise<Row> {
  return appDrizzle.transaction(async (tx) => {
    await tx.execute(
      sql.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"),
    );
    const identity = await captureIdentity(tx, sql);
    assertIdentity(identity, new URL(process.env.DATABASE_URL!), "post-commit direct read");
    const tables = await captureTables(tx, sql);
    const catalogue = await captureCatalogue(tx, sql, tables);
    const allTables = [...evidence.classes.A, ...evidence.classes.B, ...evidence.classes.C];
    assert.equal(tables.length, EXPECTED_TABLE_COUNT);
    assert(sameSet(tables.map((row) => String(row.table)), allTables));
    assert(
      catalogue.tableEvidence
        .filter((row) => evidence.classes.A.includes(String(row.table)))
        .every((row) => Number(row.count) === 0),
      "post-commit direct read A coverage",
    );
    assertEvidenceEqual(
      catalogue.tableEvidence.filter((row) => evidence.classes.C.includes(String(row.table))),
      evidence.snapshot.source.catalogue.tableEvidence.filter((row: Row) =>
        evidence.classes.C.includes(String(row.table))),
      "post-commit direct read C",
      evidence.classes.C,
    );
    assertTriggersUnchanged(
      catalogue.triggers,
      evidence.snapshot.source.catalogue.triggers,
      "post-commit direct read",
    );
    const sequences = await captureSequenceValues(tx, sql);
    assertSequenceValues(
      sequences,
      evidence.snapshot.source.sequenceStateBeforeDump,
      evidence.preflight.sequencePreservation.before,
      "post-commit direct read",
    );
    return {
      captured: true,
      identity,
      all60Tables: tables.length,
      perTable: catalogue.tableEvidence,
      triggers: catalogue.triggers,
      sequences,
      sourceApiRestarted: false,
      readOnly: true,
    };
  });
}

async function writeDurable(value: Row): Promise<void> {
  await fs.mkdir(dirname(DURABLE_STATUS_PATH), { recursive: true, mode: 0o700 });
  await fs.writeFile(
    DURABLE_STATUS_PATH,
    `${JSON.stringify(value, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await fs.chmod(DURABLE_STATUS_PATH, 0o600);
}

function parseMode(): "dry-run" | "apply" {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--dry-run")) {
    return "dry-run";
  }
  if (args.length === 1 && args[0] === "--apply") return "apply";
  throw new Error("use no argument/--dry-run or explicit --apply");
}

async function main(): Promise<void> {
  const mode = parseMode();
  assertSourceOverridesAbsent();
  const evidence = await loadEvidence();
  assertStaticOperatorPlan(evidence.classes);
  await assertLocalPortClosed(8080);
  if (mode === "apply") {
    assert.equal(
      process.env.PROMPT_H_MAIN_REVIEW,
      MAIN_REVIEW_GATE,
      `--apply requires PROMPT_H_MAIN_REVIEW=${MAIN_REVIEW_GATE}; owner authorization alone is not main review`,
    );
  }
  const { db: appDrizzle, pool: appPool } = (await import(
    "../../lib/db/src/index.ts"
  )) as unknown as { db: AppDrizzle; pool: PgPool };
  const drizzle = (await import(
    "../../artifacts/api-server/node_modules/drizzle-orm/index.js"
  )) as unknown as { sql: { raw(text: string): unknown } };
  const sql: DrizzleRuntime = {
    raw: drizzle.sql.raw.bind(drizzle.sql),
  };
  const result: Row = {
    operation: "PROMPT_H_NARROW_AUTHORIZED_PURGE",
    mode,
    status: "RUNNING",
    sourceDatabase: SOURCE_DATABASE,
    sourceSchema: SOURCE_SCHEMA,
    sourceIdentity: "same appDrizzle pool; source host/credentials omitted",
    planPath: relative(ROOT, PLAN_PATH),
    apiRestarted: false,
    apiMustRemainStoppedUntilPostCommit: true,
    authorization: {
      quote: AUTHORIZATION_QUOTE,
      path: evidence.authorizationPath,
      sha256: evidence.authorizationSha256,
    },
    backup: {
      directory: evidence.backupDirectory,
      snapshot: evidence.snapshotPath,
      dumpSha256: evidence.backupSha256,
      driveVerification: evidence.drivePath,
      restoreMetadata: evidence.restoreMetadataPath,
    },
    classes: evidence.classes,
    rowHashMethod:
      "md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY to_jsonb(t)::text, md5(to_jsonb(t)::text)), ''))",
    noStartupInitializers: true,
    noUsersOrSeeds: true,
    noTriggerDisable: true,
    noSequenceReset: true,
    noDelete: true,
  };
  let callbackCompleted = false;
  try {
    if (mode === "dry-run") {
      result.readOnly = await executeReadOnly(appDrizzle, sql, evidence);
      result.status = "DRY_RUN_PASS_NO_WRITES";
      await writeDurable(result);
      console.log(`PASS dry-run; durable status: ${relative(ROOT, DURABLE_STATUS_PATH)}`);
      return;
    }
    let rebuild: ((tx: Tx) => Promise<void>) | undefined;
    // The real function is imported only after all file, identity, API-pause,
    // and main-review gates have passed.  It is never called outside the one
    // caller-owned transaction below.
    const imported = await import(
      "../../artifacts/api-server/src/lib/inventario.ts"
    );
    rebuild = async (tx: Tx) => {
      await imported.reconstruirCacheExistencias(tx as never);
    };
    const applyResult = await executeApply(appDrizzle, sql, rebuild, evidence);
    callbackCompleted = applyResult.callbackCompleted;
    result.transaction = applyResult.transaction;
    result.status = "COMMITTED";
    await writeDurable(result);
    try {
      await assertLocalPortClosed(8080);
      result.postCommitDirectRead = await postCommitDirectRead(appDrizzle, sql, evidence);
      result.status = "COMMITTED_POSTCOMMIT_READ_PASS";
    } catch (error) {
      result.status = "COMMITTED_POSTCOMMIT_READ_FAILED_NO_RETRY";
      result.postCommitDirectReadError = redact(error);
      await writeDurable(result);
      throw error;
    }
    await writeDurable(result);
    console.log(`PASS apply commit; durable status: ${relative(ROOT, DURABLE_STATUS_PATH)}`);
  } catch (error) {
    if (mode === "apply") {
      const callbackReturned =
        callbackCompleted || (error as Row)?.callbackCompleted === true;
      if (!String(result.status).startsWith("COMMITTED")) {
        result.status = callbackReturned
          ? "COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY"
          : "ROLLED_BACK_EXPECTED_NO_COMMIT";
      }
      result.error = redact(error);
      result.destructiveRetry = "FORBIDDEN";
      await writeDurable(result);
    }
    throw error;
  } finally {
    await appPool.end().catch(() => undefined);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  await main().catch((error: unknown) => {
    console.error(`Prompt H authorized purge blocked: ${redact(error)}`);
    process.exitCode = 2;
  });
}