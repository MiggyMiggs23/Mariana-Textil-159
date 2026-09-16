/**
 * Prompt L — narrow series-counter operator.
 *
 * This file is deliberately independent of the API and of @workspace/db:
 * importing either one can run startup/schema code which is outside this
 * operation's scope.  The default invocation is a direct PostgreSQL
 * REPEATABLE READ READ ONLY preflight.  The only mutating statement in the
 * explicit --apply path is the guarded UPDATE shown in UPDATE_SQL.
 *
 * The API is not stopped or started here.  The owning agent must stop the
 * actual API writer before --apply and may restart it afterwards.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// pg has no declarations in this workspace's local runtime package.
// @ts-expect-error Runtime import is deliberately direct and source-only.
import pgRuntime from "../../lib/db/node_modules/pg/lib/index.js";

type Row = Record<string, any>;
type QueryResult = {
  rows: Row[];
  rowCount: number | null;
  command: string;
};
type Client = {
  query<T extends Row = Row>(text: string, values?: unknown[]): Promise<{
    rows: T[];
    rowCount: number | null;
    command: string;
  }>;
  release(): void;
};
type Pool = {
  connect(): Promise<Client>;
  end(): Promise<void>;
};
type PoolConstructor = new (options: Record<string, unknown>) => Pool;

const { Pool } = pgRuntime as unknown as { Pool: PoolConstructor };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/prompt-l");
const JSON_PATH = resolve(REPORT_DIR, "counter-update.json");
const MARKDOWN_PATH = resolve(REPORT_DIR, "counter-update.md");
const PREFLIGHT_PATH = resolve(ROOT, "reports/prompt-h/block3-preflight-metadata.json");
const BLOCK0_PATH = resolve(ROOT, "reports/prompt-l/block0-database-gate.json");
const LIVE_GATE_PATH = resolve(ROOT, "reports/prompt-l/live-catalog-readonly-gate.json");
const AUTHORIZATION_PATH = resolve(ROOT, "reports/prompt-l/autorizacion-arranque.md");
const SOURCE_DATABASE = "heliumdb";
const SOURCE_SCHEMA = "public";
const EXPECTED_TABLE_COUNT = 60;
const EXPECTED_SEQUENCE_COUNT = 45;
const EXPECTED_SERIES_BEFORE = "1000000";
const EXPECTED_SERIES_AFTER = "10000000";
const EXPECTED_PHYSICAL_DEFAULT = "1000000";
const MAIN_REVIEW_ENV = "PROMPT_L_MAIN_REVIEW";
const MAIN_REVIEW_VALUE = "APPROVED";
const UPDATE_SQL =
  "UPDATE public.series_consecutivo SET ultimo_numero = 10000000 " +
  "WHERE id = 1 AND ultimo_numero = 1000000 RETURNING *";
const TERMINAL_STATUSES = new Set([
  "COMMITTED",
  "COMMITTED_POSTCOMMIT_READ_PASS",
  "COMMITTED_POSTCOMMIT_READ_FAILED_NO_RETRY",
  "COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY",
  "COMMIT_ATTEMPTED_STATUS_UNKNOWN_NO_RETRY",
]);

type Mode = "dry-run" | "apply";
type TableEvidence = {
  schema: string;
  table: string;
  relkind: string;
  count: string;
  orderedCanonicalRowHash: string;
};
type SequenceState = {
  schema: string;
  sequence_name: string;
  last_value: string | null;
};
type Classes = { A: string[]; B: string[]; C: string[] };
type ApprovedEvidence = {
  snapshot: Row;
  preflight: Row;
  block0: Row;
  liveGate: Row;
  snapshotPath: string;
  classes: Classes;
  tables: string[];
  allApprovedTableEvidence: TableEvidence[];
  product: TableEvidence;
  prices: TableEvidence;
};
type State = {
  identity: Row;
  tables: Row[];
  tableEvidence: TableEvidence[];
  seriesRows: Row[];
  rollos: Row;
  sequences: SequenceState[];
  physicalDefault: string | null;
  otherCounterEvidence: TableEvidence[];
  products: TableEvidence;
  prices: TableEvidence;
};

const queryAudit: string[] = [];

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableRef(table: string): string {
  return `${quoteIdentifier(SOURCE_SCHEMA)}.${quoteIdentifier(table)}`;
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

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function redact(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replaceAll(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[database-url-redacted]")
    .replaceAll(/password[^\s,;]*/gi, "password-redacted")
    .replaceAll(ROOT, "[workspace]");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(path: string): Promise<Row> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as Row;
  } catch {
    throw new Error(`Could not read approved evidence: ${relative(ROOT, path)}.`);
  }
}

async function writeProof(report: Row): Promise<void> {
  await fs.mkdir(REPORT_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(JSON_PATH, json(report), { encoding: "utf8", mode: 0o600 });
  await fs.chmod(JSON_PATH, 0o600);
  await fs.writeFile(MARKDOWN_PATH, renderMarkdown(report), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(MARKDOWN_PATH, 0o600);
}

function pathFromEvidence(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/")) {
    throw new Error(`Approved evidence has no safe relative ${field}.`);
  }
  const path = resolve(ROOT, value);
  const outside = relative(ROOT, path).startsWith("..");
  if (outside) throw new Error(`Approved evidence ${field} escapes the workspace.`);
  return path;
}

function parseMode(): Mode {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--dry-run")) {
    return "dry-run";
  }
  if (args.length === 1 && args[0] === "--apply") return "apply";
  throw new Error("Use no argument/--dry-run or explicit --apply.");
}

function assertSourceEnvironment(): URL {
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
  if (present.length > 0) {
    throw new Error(`Refusing test/application database override: ${present.join(", ")}.`);
  }
  if (process.env.NODE_ENV === "test") {
    throw new Error("NODE_ENV=test is not permitted for the actual source operator.");
  }
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL is not a PostgreSQL URL.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (database !== SOURCE_DATABASE || !parsed.hostname) {
    throw new Error("DATABASE_URL must target heliumdb.");
  }
  return parsed;
}

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 120_000,
    query_timeout: 120_000,
    application_name: "prompt_l_counter_update",
  });
}

async function rows<T extends Row>(
  client: Client,
  name: string,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  queryAudit.push(name);
  try {
    const result = await client.query<T>(text, values);
    return result.rows;
  } catch {
    throw new Error(`PostgreSQL query failed: ${name}.`);
  }
}

async function one<T extends Row>(
  client: Client,
  name: string,
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await rows<T>(client, name, text, values);
  if (!result[0]) throw new Error(`PostgreSQL query returned no row: ${name}.`);
  return result[0];
}

async function command(client: Client, name: string, text: string): Promise<QueryResult> {
  queryAudit.push(name);
  try {
    return (await client.query(text)) as QueryResult;
  } catch {
    throw new Error(`PostgreSQL command failed: ${name}.`);
  }
}

function canonicalHashSql(table: string): string {
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

function same(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function sameTableHash(left: TableEvidence, right: TableEvidence): boolean {
  return (
    left.schema === right.schema &&
    left.table === right.table &&
    left.count === right.count &&
    left.orderedCanonicalRowHash === right.orderedCanonicalRowHash
  );
}

function evidenceMap(rowsValue: TableEvidence[]): Map<string, TableEvidence> {
  return new Map(rowsValue.map((row) => [row.table, row]));
}

function assertTableEvidenceEqual(
  actual: TableEvidence[],
  expected: TableEvidence[],
  label: string,
  excluded = new Set<string>(),
): void {
  const left = evidenceMap(actual);
  const right = evidenceMap(expected);
  if (left.size !== right.size) throw new Error(`${label} table coverage mismatch.`);
  for (const [table, expectedRow] of right) {
    if (excluded.has(table)) continue;
    const actualRow = left.get(table);
    if (
      !actualRow ||
      actualRow.count !== expectedRow.count ||
      actualRow.orderedCanonicalRowHash !== expectedRow.orderedCanonicalRowHash
    ) {
      throw new Error(`${label} changed table: ${table}.`);
    }
  }
}

function assertSequenceStateEqual(
  actual: SequenceState[],
  expected: SequenceState[],
  label: string,
): void {
  if (actual.length !== EXPECTED_SEQUENCE_COUNT || expected.length !== EXPECTED_SEQUENCE_COUNT) {
    throw new Error(`${label} must cover exactly 45 sequences.`);
  }
  const left = new Map(actual.map((row) => [`${row.schema}.${row.sequence_name}`, String(row.last_value)]));
  const right = new Map(expected.map((row) => [`${row.schema}.${row.sequence_name}`, String(row.last_value)]));
  if (left.size !== right.size) throw new Error(`${label} sequence coverage mismatch.`);
  for (const [key, value] of right) {
    if (left.get(key) !== value) throw new Error(`${label} changed sequence: ${key}.`);
  }
}

function validateClasses(value: unknown): Classes {
  if (!value || typeof value !== "object") throw new Error("Preflight class metadata is missing.");
  const source = value as Row;
  const classes: Classes = {
    A: Array.isArray(source.A) ? source.A.map(String) : [],
    B: Array.isArray(source.B) ? source.B.map(String) : [],
    C: Array.isArray(source.C) ? source.C.map(String) : [],
  };
  if (classes.A.length !== 35 || classes.B.length !== 7 || classes.C.length !== 18) {
    throw new Error("Approved preflight class counts are not 35/7/18.");
  }
  const all = [...classes.A, ...classes.B, ...classes.C];
  if (new Set(all).size !== EXPECTED_TABLE_COUNT) {
    throw new Error("Approved preflight classes do not cover 60 unique tables.");
  }
  if (!classes.B.includes("series_consecutivo") || !classes.A.includes("rollos")) {
    throw new Error("Approved preflight classes lack the trusted control tables.");
  }
  for (const table of all) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
      throw new Error("Approved table metadata contains an unsafe identifier.");
    }
  }
  return {
    A: [...classes.A].sort(),
    B: [...classes.B].sort(),
    C: [...classes.C].sort(),
  };
}

function tableEvidenceFrom(value: unknown, label: string): TableEvidence[] {
  if (!Array.isArray(value)) throw new Error(`${label} table evidence is missing.`);
  return value.map((row) => {
    if (!row || typeof row !== "object") throw new Error(`${label} has an invalid table row.`);
    const source = row as Row;
    if (
      typeof source.schema !== "string" ||
      typeof source.table !== "string" ||
      typeof source.count !== "string" ||
      typeof source.orderedCanonicalRowHash !== "string"
    ) {
      throw new Error(`${label} has an incomplete table row.`);
    }
    return {
      schema: source.schema,
      table: source.table,
      relkind: String(source.relkind ?? ""),
      count: source.count,
      orderedCanonicalRowHash: source.orderedCanonicalRowHash,
    };
  });
}

function sequenceStateFrom(value: unknown, label: string): SequenceState[] {
  if (!Array.isArray(value)) throw new Error(`${label} sequence state is missing.`);
  return value.map((row) => {
    if (!row || typeof row !== "object") throw new Error(`${label} has an invalid sequence row.`);
    const source = row as Row;
    return {
      schema: String(source.schema),
      sequence_name: String(source.sequence_name),
      last_value: source.last_value === null ? null : String(source.last_value),
    };
  });
}

function sequenceNamesFrom(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} sequence metadata is missing.`);
  const names = value.map((row) => {
    if (!row || typeof row !== "object") throw new Error(`${label} has an invalid sequence row.`);
    const source = row as Row;
    const schema = String(source.schema ?? source.schemaname);
    const name = String(source.sequence_name ?? source.sequencename);
    if (!schema || !name) throw new Error(`${label} has an incomplete sequence row.`);
    return `${schema}.${name}`;
  });
  if (
    names.length !== EXPECTED_SEQUENCE_COUNT ||
    new Set(names).size !== EXPECTED_SEQUENCE_COUNT ||
    names.some((name) => !name.startsWith(`${SOURCE_SCHEMA}.`))
  ) {
    throw new Error(`${label} must enumerate exactly 45 public sequences.`);
  }
  return names.sort();
}

function findEvidence(value: TableEvidence[], table: string): TableEvidence {
  const result = value.find((row) => row.table === table);
  if (!result) throw new Error(`Approved evidence lacks ${table}.`);
  return result;
}

function approvedCatalogEntry(block0: Row, table: string): TableEvidence {
  const row = Array.isArray(block0.catalogComparison)
    ? block0.catalogComparison.find((candidate: Row) => candidate.table === table)
    : undefined;
  const expected = row?.expected;
  if (!expected) throw new Error(`Read-only gate lacks approved ${table} hash.`);
  return {
    schema: String(expected.schema),
    table,
    relkind: "",
    count: String(expected.count),
    orderedCanonicalRowHash: String(expected.orderedCanonicalRowHash),
  };
}

export async function loadApprovedEvidence(): Promise<ApprovedEvidence> {
  const [preflight, block0, liveGate, authorization] = await Promise.all([
    readJson(PREFLIGHT_PATH),
    readJson(BLOCK0_PATH),
    readJson(LIVE_GATE_PATH),
    fs.readFile(AUTHORIZATION_PATH, "utf8"),
  ]);
  if (preflight.status !== "COMPLETE_READ_ONLY_PREFLIGHT") {
    throw new Error("Approved Prompt H preflight is not complete.");
  }
  if (preflight.connection?.database !== SOURCE_DATABASE || preflight.connection?.schema !== SOURCE_SCHEMA) {
    throw new Error("Approved preflight identity is not heliumdb/public.");
  }
  if (preflight.connection?.transactionReadOnly !== "on") {
    throw new Error("Approved preflight was not read-only.");
  }
  if (
    block0.status !== "PASS_READONLY_GATE" ||
    block0.gate?.zeroRollos !== true ||
    block0.gate?.zeroAssignedSeries !== true ||
    block0.gate?.protectedCatalogUnchanged !== true
  ) {
    throw new Error("Approved Prompt L database gate is not PASS_READONLY_GATE.");
  }
  if (liveGate.gate?.pass !== true) throw new Error("Approved live catalog gate is not PASS.");
  if (!/Sí,\s*autorizo ese reinicio/i.test(authorization)) {
    throw new Error("Prompt L owner authorization for the normal API restart is missing.");
  }
  const classes = validateClasses(preflight.classification?.listNames);
  const tables = [...classes.A, ...classes.B, ...classes.C].sort();
  const snapshotPath = pathFromEvidence(
    preflight.freshness?.sourceSnapshotPath,
    "freshness.sourceSnapshotPath",
  );
  const snapshot = await readJson(snapshotPath);
  if (snapshot.source?.database?.database_name !== SOURCE_DATABASE) {
    throw new Error("Approved source snapshot is not heliumdb.");
  }
  const allApprovedTableEvidence = tableEvidenceFrom(
    snapshot.source?.catalogue?.tableEvidence,
    "source snapshot",
  );
  const preflightEvidence = tableEvidenceFrom(preflight.tableEvidence, "Prompt H preflight");
  if (allApprovedTableEvidence.length !== EXPECTED_TABLE_COUNT ||
      preflightEvidence.length !== EXPECTED_TABLE_COUNT) {
    throw new Error("Approved source evidence does not cover exactly 60 tables.");
  }
  const snapshotTableNames = Array.isArray(snapshot.source?.catalogue?.tables)
    ? snapshot.source.catalogue.tables.map((row: Row) => `${row.schema}.${row.table}`).sort()
    : [];
  const preflightTableNames = preflightEvidence.map((row) => `${row.schema}.${row.table}`).sort();
  const expectedTableNames = tables.map((table) => `${SOURCE_SCHEMA}.${table}`).sort();
  if (
    snapshotTableNames.length !== EXPECTED_TABLE_COUNT ||
    stable(snapshotTableNames) !== stable(expectedTableNames) ||
    stable(preflightTableNames) !== stable(expectedTableNames)
  ) {
    throw new Error("Approved snapshot/preflight table name enumeration drifted.");
  }
  const snapshotSequenceNames = sequenceNamesFrom(
    snapshot.source?.catalogue?.sequences,
    "source snapshot",
  );
  const preflightSequenceNames = sequenceNamesFrom(
    preflight.sequencePreservation?.before,
    "Prompt H preflight",
  );
  if (stable(snapshotSequenceNames) !== stable(preflightSequenceNames)) {
    throw new Error("Approved snapshot/preflight sequence name enumeration drifted.");
  }
  const product = findEvidence(allApprovedTableEvidence, "productos");
  const prices = findEvidence(allApprovedTableEvidence, "precio_historial");
  const gateProduct = approvedCatalogEntry(block0, "productos");
  const gatePrices = approvedCatalogEntry(block0, "precio_historial");
  if (!sameTableHash(product, gateProduct) || !sameTableHash(prices, gatePrices)) {
    throw new Error("Approved backup and Prompt L read gate disagree for protected catalogs.");
  }
  if (
    String(liveGate.sourceHashes?.products) !== product.orderedCanonicalRowHash ||
    String(liveGate.sourceHashes?.priceHistory) !== prices.orderedCanonicalRowHash ||
    String(liveGate.sourceCounts?.products) !== product.count ||
    String(liveGate.sourceCounts?.priceHistory) !== prices.count
  ) {
    throw new Error("Approved live catalog gate does not match the backup catalog hashes.");
  }
  if (
    String(block0.seriesConsecutivo?.rowCount) !== "1" ||
    String(block0.seriesConsecutivo?.rows?.[0]?.id) !== "1" ||
    String(block0.seriesConsecutivo?.rows?.[0]?.ultimoNumero) !== EXPECTED_SERIES_BEFORE ||
    String(block0.rollos?.totalCount) !== "0" ||
    String(block0.rollos?.assignedSerieNonNullNonEmptyCount) !== "0"
  ) {
    throw new Error("Prompt L read-only gate does not prove the approved counter precondition.");
  }
  const seriesColumns = block0.seriesConsecutivo?.columns?.filter(
    (row: Row) => row.columnName === "ultimo_numero",
  );
  if (
    !Array.isArray(seriesColumns) ||
    seriesColumns.length !== 1 ||
    String(seriesColumns[0]?.columnDefault) !== EXPECTED_PHYSICAL_DEFAULT
  ) {
    throw new Error("Approved read-only gate does not record the expected physical default.");
  }
  return {
    snapshot,
    preflight,
    block0,
    liveGate,
    snapshotPath,
    classes,
    tables,
    allApprovedTableEvidence,
    product,
    prices,
  };
}

async function captureIdentity(client: Client): Promise<Row> {
  return one(
    client,
    "identity",
    `SELECT current_database() AS database_name,
            current_schema() AS schema_name,
            current_setting('server_version') AS server_version,
            current_setting('transaction_isolation') AS transaction_isolation,
            current_setting('transaction_read_only') AS transaction_read_only`,
  );
}

async function captureTables(client: Client): Promise<Row[]> {
  return rows(
    client,
    "dynamic_public_table_set",
    `SELECT n.nspname AS schema,
            c.relname AS table,
            c.relkind::text AS relkind
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp_%'
      ORDER BY n.nspname, c.relname`,
  );
}

function assertLiveTables(actual: Row[], expected: string[]): void {
  if (actual.length !== expected.length) throw new Error("Live source does not expose exactly 60 tables.");
  const keys = actual.map((row) => `${row.schema}.${row.table}`);
  if (new Set(keys).size !== expected.length ||
      !actual.every((row) => row.schema === SOURCE_SCHEMA && expected.includes(String(row.table)))) {
    throw new Error("Live public table set differs from approved metadata.");
  }
}

async function captureTableEvidence(client: Client, tables: string[]): Promise<TableEvidence[]> {
  const result: TableEvidence[] = [];
  for (const table of tables) {
    const row = await one<Row & { count: string; ordered_canonical_row_hash: string }>(
      client,
      `table_hash:${table}`,
      canonicalHashSql(table),
    );
    result.push({
      schema: SOURCE_SCHEMA,
      table,
      relkind: "",
      count: String(row.count),
      orderedCanonicalRowHash: String(row.ordered_canonical_row_hash),
    });
  }
  return result;
}

async function captureSequences(client: Client): Promise<SequenceState[]> {
  return rows<SequenceState>(
    client,
    "all_45_sequence_values",
    `SELECT schemaname AS schema,
            sequencename AS sequence_name,
            last_value::text AS last_value
       FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname NOT LIKE 'pg_toast%'
        AND schemaname NOT LIKE 'pg_temp_%'
      ORDER BY schemaname, sequencename`,
  );
}

async function captureSeriesRows(client: Client): Promise<Row[]> {
  return rows(
    client,
    "series_control_rows",
    `SELECT id::text AS id, ultimo_numero::text AS ultimo_numero
       FROM public.series_consecutivo
      ORDER BY id`,
  );
}

async function captureRollos(client: Client): Promise<Row> {
  return one(
    client,
    "rollos_zero_and_assigned_counts",
    `SELECT count(*)::text AS total_count,
            count(*) FILTER (WHERE serie IS NOT NULL AND btrim(serie) <> '')::text
              AS assigned_series,
            count(*) FILTER (WHERE serie IS NULL OR btrim(serie) = '')::text
              AS null_or_empty_series
       FROM public.rollos`,
  );
}

async function capturePhysicalDefault(client: Client): Promise<string | null> {
  const row = await one(
    client,
    "series_physical_default",
    `SELECT column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'series_consecutivo'
        AND column_name = 'ultimo_numero'`,
  );
  return row.column_default === null ? null : String(row.column_default);
}

async function captureOtherCounterEvidence(
  client: Client,
  classes: Classes,
): Promise<TableEvidence[]> {
  // B contains existencias plus six counter/control tables in the approved
  // metadata.  Keep every B table other than the one control table in this
  // full-row comparison; no counter update is allowed outside series.
  const other = classes.B.filter((table) => table !== "series_consecutivo");
  const result: TableEvidence[] = [];
  for (const table of other) {
    const row = await one<Row & { count: string; ordered_canonical_row_hash: string }>(
      client,
      `other_counter_full_hash:${table}`,
      canonicalHashSql(table),
    );
    result.push({
      schema: SOURCE_SCHEMA,
      table,
      relkind: "",
      count: String(row.count),
      orderedCanonicalRowHash: String(row.ordered_canonical_row_hash),
    });
  }
  return result;
}

function assertIdentity(identity: Row, readOnly: boolean): void {
  if (
    identity.database_name !== SOURCE_DATABASE ||
    identity.schema_name !== SOURCE_SCHEMA ||
    (readOnly && identity.transaction_read_only !== "on") ||
    (!readOnly && identity.transaction_read_only === "on")
  ) {
    throw new Error("Live source identity or transaction mode gate failed.");
  }
}

function assertRollosZero(rollos: Row, label: string): void {
  if (String(rollos.total_count) !== "0" || String(rollos.assigned_series) !== "0") {
    throw new Error(`${label} requires zero rollos and zero assigned series.`);
  }
}

function assertSeriesBefore(rowsValue: Row[], label: string): void {
  if (
    rowsValue.length !== 1 ||
    String(rowsValue[0]?.id) !== "1" ||
    String(rowsValue[0]?.ultimo_numero) !== EXPECTED_SERIES_BEFORE
  ) {
    throw new Error(`${label} requires exactly row id=1 at ultimo_numero=1000000.`);
  }
}

function assertSeriesAfter(rowsValue: Row[], label: string): void {
  if (
    rowsValue.length !== 1 ||
    String(rowsValue[0]?.id) !== "1" ||
    String(rowsValue[0]?.ultimo_numero) !== EXPECTED_SERIES_AFTER
  ) {
    throw new Error(`${label} requires exactly row id=1 at ultimo_numero=10000000.`);
  }
}

function assertPhysicalDefault(value: string | null, label: string): void {
  if (value !== EXPECTED_PHYSICAL_DEFAULT) {
    throw new Error(`${label} physical default changed or is not 1000000.`);
  }
}

function sourceSummary(evidence: ApprovedEvidence): Row {
  return {
    database: SOURCE_DATABASE,
    schema: SOURCE_SCHEMA,
    approvedSnapshotPath: relative(ROOT, evidence.snapshotPath),
    approvedSnapshotCapturedAtUtc: evidence.snapshot.capturedAtUtc ?? null,
    preflightPath: relative(ROOT, PREFLIGHT_PATH),
    readOnlyGatePath: relative(ROOT, BLOCK0_PATH),
    liveCatalogGatePath: relative(ROOT, LIVE_GATE_PATH),
    dynamicTableCount: EXPECTED_TABLE_COUNT,
    dynamicClassCounts: {
      A: evidence.classes.A.length,
      B: evidence.classes.B.length,
      C: evidence.classes.C.length,
    },
    sequenceCount: EXPECTED_SEQUENCE_COUNT,
    rawSnapshotRowsPersisted: false,
    usersPasswordsSessionsRead: false,
  };
}

function tableDiff(before: TableEvidence[], after: TableEvidence[]): string[] {
  const left = evidenceMap(before);
  const right = evidenceMap(after);
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort();
  return keys.filter((table) => {
    const a = left.get(table);
    const b = right.get(table);
    return !a || !b || a.count !== b.count || a.orderedCanonicalRowHash !== b.orderedCanonicalRowHash;
  });
}

function stateProof(state: State): Row {
  return {
    identity: {
      database_name: state.identity.database_name,
      schema_name: state.identity.schema_name,
      server_version: state.identity.server_version,
      transaction_isolation: state.identity.transaction_isolation,
      transaction_read_only: state.identity.transaction_read_only,
    },
    dynamicTableCount: state.tables.length,
    all60TableEvidence: state.tableEvidence,
    seriesControlRows: state.seriesRows,
    rollosCounts: state.rollos,
    all45SequenceValues: state.sequences,
    physicalDefault: state.physicalDefault,
    otherCounterFullRowEvidence: state.otherCounterEvidence,
    protectedCatalogs: {
      productos: state.products,
      precio_historial: state.prices,
    },
  };
}

async function captureState(
  client: Client,
  evidence: ApprovedEvidence,
): Promise<State> {
  const identity = await captureIdentity(client);
  const tables = await captureTables(client);
  assertLiveTables(tables, evidence.tables);
  const tableEvidence = await captureTableEvidence(client, evidence.tables);
  const seriesRows = await captureSeriesRows(client);
  const rollos = await captureRollos(client);
  const sequences = await captureSequences(client);
  const physicalDefault = await capturePhysicalDefault(client);
  const otherCounterEvidence = await captureOtherCounterEvidence(client, evidence.classes);
  const products = findEvidence(tableEvidence, "productos");
  const prices = findEvidence(tableEvidence, "precio_historial");
  return {
    identity,
    tables,
    tableEvidence,
    seriesRows,
    rollos,
    sequences,
    physicalDefault,
    otherCounterEvidence,
    products,
    prices,
  };
}

function assertApprovedReadOnlyState(
  state: State,
  evidence: ApprovedEvidence,
  label: string,
): void {
  assertIdentity(state.identity, true);
  assertRollosZero(state.rollos, label);
  assertSeriesBefore(state.seriesRows, label);
  assertPhysicalDefault(state.physicalDefault, label);
  if (!sameTableHash(state.products, evidence.product) || !sameTableHash(state.prices, evidence.prices)) {
    throw new Error(`${label} protected catalog full hash mismatch.`);
  }
}

async function executeDryRun(
  pool: Pool,
  evidence: ApprovedEvidence,
): Promise<Row> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await command(
      client,
      "begin_repeatable_read_read_only",
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    transactionOpen = true;
    await command(client, "set_local_statement_timeout", "SET LOCAL statement_timeout = '120s'");
    await command(client, "set_local_lock_timeout", "SET LOCAL lock_timeout = '5s'");
    const state = await captureState(client, evidence);
    assertApprovedReadOnlyState(state, evidence, "dry-run");
    await command(client, "rollback_read_only_transaction", "ROLLBACK");
    transactionOpen = false;
    return {
      status: "DRY_RUN_PASS_READONLY_PREP_READY",
      mode: "dry-run",
      source: sourceSummary(evidence),
      precondition: {
        zeroRollos: true,
        zeroAssignedSeries: true,
        controlRows: state.seriesRows,
        currentUltimoNumero: EXPECTED_SERIES_BEFORE,
      },
      baseline: stateProof(state),
      approvedComparison: {
        approvedTableSetAndMetadataLoaded: true,
        currentAll60HashesCapturedAsMutationBaseline: true,
        protectedCatalogsMatchBackupAndReadOnlyGate: true,
        physicalDefaultObserved: state.physicalDefault,
        physicalDefaultChanged: false,
      },
      mutation: {
        writesExecuted: false,
        updateExecuted: false,
        locksTaken: false,
        sequencesAdvanced: false,
        nextvalCalled: false,
        apiRestarted: false,
      },
      plan: {
        updateSql: UPDATE_SQL,
        lockOrder: [
          "LOCK TABLE public.series_consecutivo IN ACCESS EXCLUSIVE MODE",
          "LOCK TABLE public.rollos IN SHARE MODE",
        ],
        applyRequiresMainReview: `${MAIN_REVIEW_ENV}=${MAIN_REVIEW_VALUE}`,
        apiLifecycle: "managed by main agent; this CLI never stops or starts it",
      },
      queryAudit,
    };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function assertDryRunBaseline(previous: Row, evidence: ApprovedEvidence): void {
  if (previous.status !== "DRY_RUN_PASS_READONLY_PREP_READY") {
    throw new Error("A fresh passing read-only dry-run is required before --apply.");
  }
  if (previous.mode !== "dry-run" || previous.baseline?.all60TableEvidence === undefined) {
    throw new Error("The prior dry-run proof has no usable all-60 baseline.");
  }
  const prior = tableEvidenceFrom(previous.baseline.all60TableEvidence, "prior dry-run");
  if (prior.length !== EXPECTED_TABLE_COUNT) {
    throw new Error("The prior dry-run baseline must cover exactly 60 tables.");
  }
  const expectedTables = new Set(evidence.tables);
  const priorTables = new Set(prior.map((row) => row.table));
  if (
    priorTables.size !== EXPECTED_TABLE_COUNT ||
    prior.some((row) => row.schema !== SOURCE_SCHEMA || !expectedTables.has(row.table)) ||
    [...expectedTables].some((table) => !priorTables.has(table))
  ) {
    throw new Error("The prior dry-run baseline table set/schema is not the current approved metadata set.");
  }
  const priorSequences = sequenceStateFrom(
    previous.baseline?.all45SequenceValues,
    "prior dry-run",
  );
  if (
    priorSequences.length !== EXPECTED_SEQUENCE_COUNT ||
    new Set(priorSequences.map((row) => `${row.schema}.${row.sequence_name}`)).size !==
      EXPECTED_SEQUENCE_COUNT ||
    priorSequences.some((row) => row.schema !== SOURCE_SCHEMA)
  ) {
    throw new Error("The prior dry-run sequence baseline must cover exactly 45 public sequences.");
  }
  const identity = previous.baseline?.identity;
  if (
    identity?.database_name !== SOURCE_DATABASE ||
    identity?.schema_name !== SOURCE_SCHEMA ||
    identity?.transaction_read_only !== "on"
  ) {
    throw new Error("The prior dry-run identity metadata is not heliumdb/public READ ONLY.");
  }
  assertSeriesBefore(previous.baseline?.seriesControlRows ?? [], "prior dry-run");
  assertRollosZero(previous.baseline?.rollosCounts ?? {}, "prior dry-run");
  assertPhysicalDefault(
    previous.baseline?.physicalDefault === undefined
      ? null
      : String(previous.baseline.physicalDefault),
    "prior dry-run",
  );
  const priorProtected = previous.baseline?.protectedCatalogs;
  if (
    !priorProtected?.productos ||
    !priorProtected?.precio_historial ||
    !sameTableHash(
      tableEvidenceFrom([priorProtected.productos], "prior dry-run productos")[0]!,
      evidence.product,
    ) ||
    !sameTableHash(
      tableEvidenceFrom([priorProtected.precio_historial], "prior dry-run precio_historial")[0]!,
      evidence.prices,
    )
  ) {
    throw new Error("The prior dry-run protected catalog hashes do not match approved evidence.");
  }
  const priorOtherCounters = tableEvidenceFrom(
    previous.baseline?.otherCounterFullRowEvidence,
    "prior dry-run other counters",
  );
  const expectedOtherCounterTables = new Set(
    evidence.classes.B.filter((table) => table !== "series_consecutivo"),
  );
  if (
    priorOtherCounters.length !== expectedOtherCounterTables.size ||
    new Set(priorOtherCounters.map((row) => row.table)).size !== expectedOtherCounterTables.size ||
    priorOtherCounters.some(
      (row) => row.schema !== SOURCE_SCHEMA || !expectedOtherCounterTables.has(row.table),
    )
  ) {
    throw new Error("The prior dry-run other-counter baseline is not the six current B tables.");
  }
}

async function executeApplyTransaction(
  client: Client,
  evidence: ApprovedEvidence,
  previous: Row,
): Promise<Row> {
  await command(client, "begin_repeatable_read_read_write", "BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE");
  await command(client, "set_local_statement_timeout", "SET LOCAL statement_timeout = '120s'");
  await command(client, "set_local_lock_timeout", "SET LOCAL lock_timeout = '5s'");
  await command(client, "set_local_idle_timeout", "SET LOCAL idle_in_transaction_session_timeout = '300s'");
  const initialIdentity = await captureIdentity(client);
  assertIdentity(initialIdentity, false);
  const initialTables = await captureTables(client);
  assertLiveTables(initialTables, evidence.tables);

  // This order is intentional: reservation control first, then rollos.
  await command(
    client,
    "lock_series_consecutivo_access_exclusive",
    "LOCK TABLE public.series_consecutivo IN ACCESS EXCLUSIVE MODE",
  );
  await command(
    client,
    "lock_rollos_share",
    "LOCK TABLE public.rollos IN SHARE MODE",
  );

  const locked = await captureState(client, evidence);
  assertIdentity(locked.identity, false);
  assertRollosZero(locked.rollos, "locked precondition");
  assertSeriesBefore(locked.seriesRows, "locked precondition");
  assertPhysicalDefault(locked.physicalDefault, "locked precondition");
  const priorEvidence = tableEvidenceFrom(previous.baseline.all60TableEvidence, "prior dry-run");
  assertTableEvidenceEqual(locked.tableEvidence, priorEvidence, "locked versus prior dry-run", new Set(["series_consecutivo"]));
  const priorOtherCounters = tableEvidenceFrom(
    previous.baseline.otherCounterFullRowEvidence,
    "prior dry-run other counters",
  );
  assertTableEvidenceEqual(
    locked.otherCounterEvidence,
    priorOtherCounters,
    "locked other counters versus prior dry-run",
  );
  if (!sameTableHash(locked.products, evidence.product) || !sameTableHash(locked.prices, evidence.prices)) {
    throw new Error("Protected catalog changed before the guarded update.");
  }

  const updateResult = await command(client, "exact_series_update_returning", UPDATE_SQL);
  if (updateResult.rowCount !== 1 || updateResult.rows.length !== 1) {
    throw new Error("Guarded series UPDATE did not affect exactly one row.");
  }
  const returned = updateResult.rows[0]!;
  if (String(returned.id) !== "1" || String(returned.ultimo_numero) !== EXPECTED_SERIES_AFTER) {
    throw new Error("Guarded series UPDATE returned an unexpected control row.");
  }

  const after = await captureState(client, evidence);
  assertIdentity(after.identity, false);
  assertRollosZero(after.rollos, "post-update pre-commit");
  assertSeriesAfter(after.seriesRows, "post-update pre-commit");
  assertPhysicalDefault(after.physicalDefault, "post-update pre-commit");
  if (!same(locked.otherCounterEvidence, after.otherCounterEvidence)) {
    throw new Error("An other counter/control table changed; only series_consecutivo may change.");
  }
  assertTableEvidenceEqual(
    after.tableEvidence,
    locked.tableEvidence,
    "post-update all-60 comparison",
    new Set(["series_consecutivo"]),
  );
  const changedTables = tableDiff(locked.tableEvidence, after.tableEvidence);
  if (changedTables.length !== 1 || changedTables[0] !== "series_consecutivo") {
    throw new Error("Post-update full 60-table proof is not series_consecutivo only.");
  }
  assertSequenceStateEqual(after.sequences, locked.sequences, "post-update sequences");
  if (!sameTableHash(after.products, locked.products) || !sameTableHash(after.prices, locked.prices)) {
    throw new Error("Protected catalog changed during the guarded update.");
  }
  return {
    lockOrder: [
      "public.series_consecutivo ACCESS EXCLUSIVE",
      "public.rollos SHARE",
    ],
    before: stateProof(locked),
    update: {
      sql: UPDATE_SQL,
      rowCount: updateResult.rowCount,
      affectedRows: 1,
      returnedControlRow: {
        id: String(returned.id),
        ultimo_numero: String(returned.ultimo_numero),
      },
    },
    after: stateProof(after),
    proof: {
      changedTables: ["series_consecutivo"],
      otherCounterTablesUnchanged: true,
      protectedCatalogsUnchanged: true,
      all45SequencesUnchanged: true,
      rollosAndAssignedSeriesRemainZero: true,
      physicalDefaultUnchanged: true,
    },
  };
}

async function executePostCommitRead(pool: Pool, evidence: ApprovedEvidence, expected: Row): Promise<Row> {
  const client = await pool.connect();
  let open = false;
  try {
    await command(client, "post_commit_begin_read_only", "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    open = true;
    const state = await captureState(client, evidence);
    assertIdentity(state.identity, true);
    assertRollosZero(state.rollos, "post-commit");
    assertSeriesAfter(state.seriesRows, "post-commit");
    assertPhysicalDefault(state.physicalDefault, "post-commit");
    if (!same(state.otherCounterEvidence, expected.after.otherCounterFullRowEvidence)) {
      throw new Error("Post-commit other-counter full-row proof differs.");
    }
    assertTableEvidenceEqual(
      state.tableEvidence,
      expected.after.all60TableEvidence,
      "post-commit all-60 proof",
    );
    assertSequenceStateEqual(
      state.sequences,
      expected.after.all45SequenceValues,
      "post-commit sequences",
    );
    if (!sameTableHash(state.products, expected.after.protectedCatalogs.productos) ||
        !sameTableHash(state.prices, expected.after.protectedCatalogs.precio_historial)) {
      throw new Error("Post-commit protected catalog proof differs.");
    }
    await command(client, "post_commit_rollback_read_only", "ROLLBACK");
    open = false;
    return {
      status: "PASS",
      readOnly: true,
      all60TableHashesVerified: true,
      onlyChangedTable: "series_consecutivo",
      all45SequenceValuesUnchanged: true,
      physicalDefault: state.physicalDefault,
      apiRestarted: false,
    };
  } catch (error) {
    if (open) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function renderTableEvidence(evidence: TableEvidence[]): string {
  const lines = ["| Table | Count | Canonical full-row hash |", "| --- | ---: | --- |"];
  for (const row of evidence) {
    lines.push(`| ${row.table} | ${row.count} | \`${row.orderedCanonicalRowHash}\` |`);
  }
  return lines.join("\n");
}

function renderMarkdown(report: Row): string {
  const source = report.source ?? {};
  const baseline = report.baseline ?? report.transaction?.before ?? null;
  const transaction = report.transaction ?? null;
  const status = String(report.status ?? "UNKNOWN");
  const lines = [
    "# Prompt L — narrow series counter update",
    "",
    `## Status: **${status}**`,
    "",
    `- Mode: \`${report.mode ?? "unknown"}\``,
    `- Effective database: \`${source.database ?? SOURCE_DATABASE}\`; schema: \`${source.schema ?? SOURCE_SCHEMA}\`.`,
    "- Connection credentials, host, users, sessions, passwords, and raw snapshot rows are omitted.",
    "- This CLI never imports the API, creates users/sessions, reads passwords, seeds data, or restarts the API.",
    "",
    "## Approved source and preflight",
    "",
    `- Snapshot: \`${source.approvedSnapshotPath ?? "not loaded"}\``,
    `- Prompt H preflight: \`${source.preflightPath ?? relative(ROOT, PREFLIGHT_PATH)}\``,
    `- Prompt L read-only gate: \`${source.readOnlyGatePath ?? relative(ROOT, BLOCK0_PATH)}\``,
    `- Dynamic public tables: **${source.dynamicTableCount ?? "—"}** (A/B/C ${source.dynamicClassCounts ? `${source.dynamicClassCounts.A}/${source.dynamicClassCounts.B}/${source.dynamicClassCounts.C}` : "—"}).`,
    `- Non-MVCC sequence values checked: **${source.sequenceCount ?? "—"}**.`,
    "",
    "## Read-only precondition",
    "",
    `- Zero rollos: **${report.precondition?.zeroRollos === true ? "PASS" : "—"}**.`,
    `- Zero assigned series: **${report.precondition?.zeroAssignedSeries === true ? "PASS" : "—"}**.`,
    `- Control row: \`${JSON.stringify(report.precondition?.controlRows ?? "not captured")}\`.`,
    `- Physical PostgreSQL default: \`${report.approvedComparison?.physicalDefaultObserved ?? report.transaction?.before?.physicalDefault ?? "—"}\`; unchanged and intentionally not altered.`,
    "",
    "## Mutation plan and safety",
    "",
    "The apply path takes one transaction and locks `public.series_consecutivo` in ACCESS EXCLUSIVE mode first, then `public.rollos` in SHARE mode. It executes no DELETE, INSERT, DDL, sequence call, schema ALTER, or API lifecycle action.",
    "",
    "```sql",
    `${UPDATE_SQL}`,
    "```",
    "",
    `- Dry-run writes: **${report.mutation?.writesExecuted === false ? "none" : "—"}**.`,
    `- Apply main-review gate: \`${MAIN_REVIEW_ENV}=${MAIN_REVIEW_VALUE}\`.`,
    `- Physical default policy: **remains 1000000**; the code/Drizzle default is intentionally 10000000, and this operator does not issue ALTER TABLE.`,
    "",
  ];
  if (baseline?.all60TableEvidence) {
    lines.push(
      "## Full 60-table canonical evidence",
      "",
      "Hashes use the approved PostgreSQL method `to_jsonb(t)::text`, with ordered per-row MD5 values. Only the control table may differ across the guarded UPDATE.",
      "",
      renderTableEvidence(baseline.all60TableEvidence as TableEvidence[]),
      "",
    );
  }
  if (transaction) {
    lines.push(
      "## Transaction proof",
      "",
      `- Lock order: \`${(transaction.lockOrder ?? []).join("` → `")}\`.`,
      `- Exact UPDATE affected rows: **${transaction.update?.affectedRows ?? "—"}**.`,
      `- Changed tables after full before/after comparison: **${(transaction.proof?.changedTables ?? []).join(", ") || "—"}**.`,
      `- Other counters/control tables unchanged: **${transaction.proof?.otherCounterTablesUnchanged ? "PASS" : "—"}**.`,
      `- Protected productos/precio_historial unchanged: **${transaction.proof?.protectedCatalogsUnchanged ? "PASS" : "—"}**.`,
      `- All 45 sequence values unchanged: **${transaction.proof?.all45SequencesUnchanged ? "PASS" : "—"}**.`,
      "",
    );
  }
  if (report.postCommitRead) {
    lines.push(
      "## Post-commit read-only proof",
      "",
      `- Status: **${report.postCommitRead.status}**.`,
      `- Full 60-table verification: **${report.postCommitRead.all60TableHashesVerified ? "PASS" : "—"}**.`,
      `- 45 sequence values unchanged: **${report.postCommitRead.all45SequenceValuesUnchanged ? "PASS" : "—"}**.`,
      `- API restarted by this CLI: **${report.postCommitRead.apiRestarted ? "yes" : "no"}**.`,
      "",
    );
  }
  if (report.error) {
    lines.push("## Stopped error", "", `\`${String(report.error)}\``, "");
  }
  lines.push(
    "## Retry policy",
    "",
    "- There is no automatic retry. A commit acknowledgement failure is recorded separately as `COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY`; a second `--apply` is refused.",
    "- API stop/restart remains the main agent's responsibility.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const mode = parseMode();
  const sourceUrl = assertSourceEnvironment();
  const existing = await fs.readFile(JSON_PATH, "utf8").then(
    (text) => JSON.parse(text) as Row,
    () => null,
  );
  if (existing && TERMINAL_STATUSES.has(String(existing.status))) {
    throw new Error(`Existing terminal proof status ${String(existing.status)} refuses a second apply.`);
  }
  const evidence = await loadApprovedEvidence();
  const base: Row = {
    operation: "PROMPT_L_NARROW_SERIES_COUNTER_UPDATE",
    mode,
    status: "RUNNING",
    source: sourceSummary(evidence),
    apiRestarted: false,
    apiRestartPolicy: "main agent stops actual writer before apply and restarts normally afterwards",
    noApiImport: true,
    noUsersOrSessions: true,
    noPasswordReads: true,
    noRawSnapshotRows: true,
    noSchemaAlter: true,
  };
  const pool = createPool(sourceUrl.toString());
  if (mode === "dry-run") {
    try {
      const result = await executeDryRun(pool, evidence);
      await pool.end();
      await writeProof({ ...base, ...result });
      process.stdout.write(
        `${JSON.stringify({
          status: result.status,
          mode,
          proof: relative(ROOT, JSON_PATH),
          markdown: relative(ROOT, MARKDOWN_PATH),
          prepReady: true,
          writesExecuted: false,
        })}\n`,
      );
      return;
    } catch (error) {
      await pool.end().catch(() => undefined);
      const failed = {
        ...base,
        status: "BLOCKED_READONLY_PREFLIGHT",
        error: redact(error),
        mutation: { writesExecuted: false, updateExecuted: false, apiRestarted: false },
      };
      await writeProof(failed);
      throw error;
    }
  }

  if (process.env[MAIN_REVIEW_ENV] !== MAIN_REVIEW_VALUE) {
    throw new Error(`--apply requires ${MAIN_REVIEW_ENV}=${MAIN_REVIEW_VALUE}.`);
  }
  if (!existing) {
    throw new Error("A passing read-only dry-run proof is required before --apply.");
  }
  const previous = existing;
  assertDryRunBaseline(previous, evidence);
  let client: Client | null = null;
  let transactionOpen = false;
  let commitAttempted = false;
  let transaction: Row | null = null;
  const running: Row = {
    ...base,
    status: "APPLY_TRANSACTION_RUNNING",
    priorDryRunStatus: previous.status,
  };
  try {
    client = await pool.connect();
    transactionOpen = true;
    transaction = await executeApplyTransaction(client, evidence, previous);
    running.transaction = transaction;
    running.status = "COMMIT_ATTEMPTED_STATUS_UNKNOWN_NO_RETRY";
    // Persist this phase before COMMIT.  If the process disappears after the
    // server commits but before acknowledgement, the next invocation refuses
    // to apply again.
    await writeProof(running);
    commitAttempted = true;
    await command(client, "commit_single_transaction", "COMMIT");
    transactionOpen = false;
    running.status = "COMMITTED";
    running.commitAcknowledged = true;
    await writeProof(running);
  } catch (error) {
    if (transactionOpen && client && !commitAttempted) {
      await client.query("ROLLBACK").catch(() => undefined);
      transactionOpen = false;
    }
    const failed = {
      ...running,
      status: commitAttempted
        ? "COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY"
        : "ROLLED_BACK_EXPECTED_NO_COMMIT",
      error: redact(error),
      noDestructiveRetry: true,
    };
    await writeProof(failed);
    if (client) client.release();
    await pool.end().catch(() => undefined);
    throw error;
  }
  if (client) client.release();
  client = null;
  try {
    running.postCommitRead = await executePostCommitRead(pool, evidence, transaction!);
    running.status = "COMMITTED";
    await writeProof(running);
    process.stdout.write(
      `${JSON.stringify({
        status: running.status,
        mode,
        proof: relative(ROOT, JSON_PATH),
        markdown: relative(ROOT, MARKDOWN_PATH),
        writesExecuted: true,
        apiRestarted: false,
      })}\n`,
    );
  } catch (error) {
    running.status = "COMMITTED_POSTCOMMIT_READ_FAILED_NO_RETRY";
    running.error = redact(error);
    running.noDestructiveRetry = true;
    await writeProof(running);
    throw error;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  await main().catch((error: unknown) => {
    // Keep CLI output terse and never surface connection details or rows.
    console.error(`Prompt L counter update stopped: ${redact(error)}`);
    process.exitCode = 2;
  });
}