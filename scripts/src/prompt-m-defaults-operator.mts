/**
 * Prompt M — guarded physical-default operator.
 *
 * The default invocation is a READ ONLY live preflight.  Only an explicit
 * --apply, after a passing dry-run and the owner authorization file gate,
 * can execute the three authorized ALTER statements.  This file deliberately
 * does not import the API or the application database module.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

type JsonValue = string | number | boolean | null | Row | JsonValue[] | undefined;
type Row = {
  [key: string]: JsonValue;
  source?: Row;
  identity?: Row;
  transaction?: Row;
  before?: Row;
  after?: Row;
  scope?: Row;
  authorization?: Row;
  dryRun?: Row;
  postCommitRead?: Row;
  proof?: Row;
  gates?: Row;
  retryPolicy?: Row;
  catalogue?: Row[];
  controlRows?: Row[];
  protectedCatalog?: Row[];
  sequences?: Row[];
  all45Sequences?: Row[];
  codeDeclarations?: Row[];
  comparison?: Row[];
  lockOrder?: string[];
};
type State = Row & {
  identity: Row;
  catalogue: Row[];
  controlRows: Row[];
  protectedCatalog: Row[];
  sequences: Row[];
};
type TransactionResult = Row & {
  before: State;
  after: State;
  proof: Row;
};
type Result = {
  rows: Row[];
  rowCount: number | null;
  command: string;
};
type Client = {
  query<T extends Row = Row>(text: string, values?: unknown[]): Promise<Result & { rows: T[] }>;
  release(): void;
};
type Pool = {
  connect(): Promise<Client>;
  end(): Promise<void>;
};
type PoolConstructor = new (options: Record<string, unknown>) => Pool;
const { Pool } = pg as unknown as { Pool: PoolConstructor };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/prompt-m");
const RESULT_JSON = resolve(REPORT_DIR, "resultado.json");
const RESULT_MD = resolve(REPORT_DIR, "resultado.md");
const BLOCK0_PATH = resolve(REPORT_DIR, "block0-defaults.json");
const AUTH_PATH = resolve(REPORT_DIR, "autorizacion-propietario.md");
const H_CLOSURE_PATH = resolve(ROOT, "reports/prompt-h/cierre-propietario.md");
const BACKUP_PATH = resolve(
  ROOT,
  ".local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump",
);
const SOURCE_DATABASE = "heliumdb";
const SOURCE_SCHEMA = "public";
const TZ = "America/Mexico_City";
const AUTH_SHA256 = "sha256";
const APPLY_CONFIRM_ENV = "PROMPT_M_APPLY_CONFIRM";
const APPLY_CONFIRM_VALUE = "APPROVED";
const EXPECTED_BACKUP_SHA256 =
  "da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22";
const EXPECTED_SEQUENCE_COUNT = 45;

type Counter = {
  table: string;
  column: string;
  codeDefault: string;
  block0Default: string;
  keyColumn: string;
  valueColumn: string;
  sourceFile: string;
  sourceLine: number;
  lockMode: "ACCESS EXCLUSIVE" | "SHARE";
};

const COUNTERS: Counter[] = [
  {
    table: "entrada_folio",
    column: "ultimo_folio",
    codeDefault: "0",
    block0Default: "99",
    keyColumn: "ubicacion_id",
    valueColumn: "ultimo_folio",
    sourceFile: "lib/db/src/schema/entradas.ts",
    sourceLine: 71,
    lockMode: "ACCESS EXCLUSIVE",
  },
  {
    table: "salida_folio",
    column: "ultimo_folio",
    codeDefault: "0",
    block0Default: "499",
    keyColumn: "ubicacion_id",
    valueColumn: "ultimo_folio",
    sourceFile: "lib/db/src/schema/salidas.ts",
    sourceLine: 182,
    lockMode: "ACCESS EXCLUSIVE",
  },
  {
    table: "viaje_folio",
    column: "ultimo_folio",
    codeDefault: "0",
    block0Default: "0",
    keyColumn: "ubicacion_id",
    valueColumn: "ultimo_folio",
    sourceFile: "lib/db/src/schema/viajes.ts",
    sourceLine: 47,
    lockMode: "SHARE",
  },
  {
    table: "auditoria_inventario_folio",
    column: "ultimo_folio",
    codeDefault: "0",
    block0Default: "0",
    keyColumn: "ubicacion_id",
    valueColumn: "ultimo_folio",
    sourceFile: "lib/db/src/schema/auditorias-inventario.ts",
    sourceLine: 25,
    lockMode: "SHARE",
  },
  {
    table: "ticket_folio",
    column: "ultimo_folio",
    codeDefault: "999",
    block0Default: "999",
    keyColumn: "id",
    valueColumn: "ultimo_folio",
    sourceFile: "lib/db/src/schema/pos.ts",
    sourceLine: 403,
    lockMode: "SHARE",
  },
  {
    table: "series_consecutivo",
    column: "ultimo_numero",
    codeDefault: "10000000",
    block0Default: "1000000",
    keyColumn: "id",
    valueColumn: "ultimo_numero",
    sourceFile: "lib/db/src/schema/series.ts",
    sourceLine: 20,
    lockMode: "ACCESS EXCLUSIVE",
  },
];

const LOCK_ORDER = [...COUNTERS].sort((a, b) => a.table.localeCompare(b.table));
const DDL = [
  "ALTER TABLE public.entrada_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;",
  "ALTER TABLE public.salida_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;",
  "ALTER TABLE public.series_consecutivo ALTER COLUMN ultimo_numero SET DEFAULT 10000000;",
] as const;
const TERMINAL_STATUSES = new Set([
  "COMMITTED",
  "COMMITTED_POSTCOMMIT_READ_FAILED_NO_RETRY",
  "COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY",
  "ROLLED_BACK_EXPECTED_NO_COMMIT",
]);

const audit: string[] = [];

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Row)
      .sort(([a], [b]) => a.localeCompare(b))
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

function asJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableRef(table: string): string {
  return `${quoteIdentifier(SOURCE_SCHEMA)}.${quoteIdentifier(table)}`;
}

async function readJson(path: string): Promise<Row> {
  return JSON.parse(await fs.readFile(path, "utf8")) as Row;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await fs.readFile(path)).digest("hex");
}

function parseMode(): "dry-run" | "apply" {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--dry-run")) return "dry-run";
  if (args.length === 1 && args[0] === "--apply") return "apply";
  throw new Error("Use no argument/--dry-run or explicit --apply.");
}

function sourceUrl(): URL {
  const forbidden = [
    "TEST_DATABASE_URL",
    "DATABASE_TEST_URL",
    "APPLICATION_DATABASE_URL",
    "DATABASE_URL_OVERRIDE",
    "DB_URL_OVERRIDE",
    "REQUIRE_ISOLATED_TEST_DATABASE",
    "TEST_DATABASE_PREPARATION_PHASE",
  ];
  const present = forbidden.filter((name) => process.env[name]);
  if (present.length) throw new Error(`Refusing database override: ${present.join(", ")}.`);
  if (process.env.NODE_ENV === "test") throw new Error("NODE_ENV=test is not permitted.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL is not a PostgreSQL URL.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!parsed.hostname || database !== SOURCE_DATABASE) {
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
    application_name: "prompt_m_defaults_operator",
  });
}

async function command(client: Client, name: string, text: string): Promise<Result> {
  audit.push(name);
  try {
    return await client.query(text);
  } catch {
    throw new Error(`PostgreSQL command failed: ${name}.`);
  }
}

async function rows(client: Client, name: string, text: string): Promise<Row[]> {
  audit.push(name);
  try {
    return (await client.query(text)).rows;
  } catch {
    throw new Error(`PostgreSQL query failed: ${name}.`);
  }
}

async function one(client: Client, name: string, text: string): Promise<Row> {
  const result = await rows(client, name, text);
  if (!result[0]) throw new Error(`PostgreSQL query returned no row: ${name}.`);
  return result[0];
}

function expectedCodeMap(): Record<string, string> {
  return Object.fromEntries(COUNTERS.map((counter) => [counter.table, counter.codeDefault]));
}

function expectedBlock0Map(): Record<string, string> {
  return Object.fromEntries(COUNTERS.map((counter) => [counter.table, counter.block0Default]));
}

function normalizeCatalogue(value: Row[]): Row[] {
  return value.map((row) => ({
    schema_name: String(row.schema_name ?? row.schema),
    table_name: String(row.table_name ?? row.table),
    column_name: String(row.column_name ?? row.column),
    data_type: String(row.data_type ?? row.dataType),
    not_null: Boolean(row.not_null ?? row.notNull),
    live_default_expression:
      row.live_default_expression !== undefined
        ? row.live_default_expression === null
          ? null
          : String(row.live_default_expression)
        : row.liveDefaultExpression !== undefined
          ? row.liveDefaultExpression === null
            ? null
            : String(row.liveDefaultExpression)
          : row.default_expression === null || row.default_expression === undefined
            ? null
            : String(row.default_expression),
  }));
}

function normalizeControlRows(value: Row[]): Row[] {
  return value.map((row) => ({
    table_name: String(row.table_name ?? row.table),
    control_key: String(row.control_key ?? row.key),
    control_value: String(row.control_value ?? row.value),
  }));
}

function assertSame(left: unknown, right: unknown, label: string): void {
  if (stable(left) !== stable(right)) throw new Error(`${label} drifted.`);
}

function assertCatalogueAgainst(
  catalogue: Row[],
  expectedDefaults: Record<string, string>,
  label: string,
): void {
  if (catalogue.length !== COUNTERS.length) throw new Error(`${label} must cover all six counters.`);
  for (const counter of COUNTERS) {
    const row = catalogue.find((candidate) => candidate.table_name === counter.table);
    if (
      !row ||
      row.schema_name !== SOURCE_SCHEMA ||
      row.column_name !== counter.column ||
      row.data_type !== "integer" ||
      row.not_null !== true ||
      row.live_default_expression !== expectedDefaults[counter.table]
    ) {
      throw new Error(`${label} mismatch at ${counter.table}.${counter.column}.`);
    }
  }
}

function assertCodeDeclarations(block0: Row): void {
  const declarations = Array.isArray(block0.codeDeclarations) ? block0.codeDeclarations : [];
  if (declarations.length !== COUNTERS.length) throw new Error("Block 0 code declarations do not cover all six counters.");
  for (const counter of COUNTERS) {
    const row = declarations.find(
      (candidate: Row) => candidate.table === counter.table && candidate.column === counter.column,
    );
    if (
      !row ||
      String(row.declaredDefault) !== counter.codeDefault ||
      String(row.sourceFile) !== counter.sourceFile ||
      Number(row.sourceLine) !== counter.sourceLine
    ) {
      throw new Error(`Block 0 code declaration mismatch at ${counter.table}.${counter.column}.`);
    }
  }
}

function block0Rows(block0: Row): Row[] {
  if (!Array.isArray(block0.controlRows) || block0.controlRows.length !== 46) {
    throw new Error("Block 0 must contain exactly 46 counter rows.");
  }
  return normalizeControlRows(block0.controlRows);
}

function assertBlock0(block0: Row): Row[] {
  assertCodeDeclarations(block0);
  const expectedRows = block0Rows(block0);
  if (stable(block0.scope?.databaseTarget) !== JSON.stringify(SOURCE_DATABASE)) {
    throw new Error("Block 0 database target is not heliumdb.");
  }
  const defaults = Array.isArray(block0.catalogueDefaults)
    ? block0.catalogueDefaults.map((row: Row, index: number) => ({
        schema_name: SOURCE_SCHEMA,
        table_name: String(row.table ?? COUNTERS[index]?.table),
        column_name: String(row.column ?? COUNTERS[index]?.column),
        data_type: String(row.data_type ?? row.dataType ?? "integer"),
        not_null: Boolean(row.not_null ?? row.notNull),
        live_default_expression: String(
          row.live_default_expression ?? row.liveDefaultExpression,
        ),
      }))
    : [];
  assertCatalogueAgainst(defaults, expectedBlock0Map(), "Block 0 defaults");
  const comparisons = Array.isArray(block0.comparison) ? block0.comparison : [];
  if (comparisons.length !== COUNTERS.length) throw new Error("Block 0 comparison does not cover all six counters.");
  for (const counter of COUNTERS) {
    const row = comparisons.find((candidate: Row) => candidate.table === counter.table);
    if (
      !row ||
      String(row.codeDefault) !== counter.codeDefault ||
      String(row.liveDefault) !== counter.block0Default ||
      Boolean(row.difference) !== (counter.codeDefault !== counter.block0Default)
    ) {
      throw new Error(`Block 0 comparison mismatch at ${counter.table}.`);
    }
  }
  return expectedRows;
}

async function identity(client: Client): Promise<Row> {
  return one(
    client,
    "identity",
    `SELECT current_database() AS database_name,
            current_user AS current_user_name,
            session_user AS session_user_name,
            current_setting('server_version') AS server_version,
            current_setting('TimeZone') AS timezone_setting,
            current_setting('transaction_read_only') AS transaction_read_only,
            current_setting('transaction_isolation') AS transaction_isolation,
            to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') || ' UTC'
              AS clock_timestamp_utc,
            to_char(clock_timestamp() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS.MS')
              || ' America/Mexico_City' AS clock_timestamp_mexico`,
  );
}

async function catalogue(client: Client): Promise<Row[]> {
  return rows(
    client,
    "all_six_pg_attrdef",
    `SELECT n.nspname AS schema_name,
            c.relname AS table_name,
            a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            a.attnotnull AS not_null,
            pg_get_expr(d.adbin, d.adrelid) AS live_default_expression
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND c.relname IN ('entrada_folio','salida_folio','viaje_folio',
                          'auditoria_inventario_folio','ticket_folio','series_consecutivo')
        AND a.attname IN ('ultimo_folio','ultimo_numero')
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY array_position(
        ARRAY['entrada_folio','salida_folio','viaje_folio',
              'auditoria_inventario_folio','ticket_folio','series_consecutivo'],
        c.relname
      )`,
  );
}

async function controlRows(client: Client): Promise<Row[]> {
  return rows(
    client,
    "all_46_control_rows",
    `SELECT * FROM (
       SELECT 'entrada_folio' AS table_name, ubicacion_id::text AS control_key,
              ultimo_folio::text AS control_value FROM public.entrada_folio
       UNION ALL SELECT 'salida_folio', ubicacion_id::text, ultimo_folio::text
         FROM public.salida_folio
       UNION ALL SELECT 'viaje_folio', ubicacion_id::text, ultimo_folio::text
         FROM public.viaje_folio
       UNION ALL SELECT 'auditoria_inventario_folio', ubicacion_id::text, ultimo_folio::text
         FROM public.auditoria_inventario_folio
       UNION ALL SELECT 'ticket_folio', id::text, ultimo_folio::text FROM public.ticket_folio
       UNION ALL SELECT 'series_consecutivo', id::text, ultimo_numero::text
         FROM public.series_consecutivo
     ) AS counter_rows
     ORDER BY array_position(
       ARRAY['entrada_folio','salida_folio','viaje_folio',
             'auditoria_inventario_folio','ticket_folio','series_consecutivo'],
       table_name
     ), control_key::bigint`,
  );
}

async function tableHash(client: Client, table: string): Promise<Row> {
  return one(
    client,
    `protected_catalog:${table}`,
    `WITH canonical_rows AS (
       SELECT to_jsonb(t)::text AS canonical
         FROM ${tableRef(table)} AS t
     )
     SELECT '${table}' AS table_name,
            count(*)::text AS row_count,
            md5(COALESCE(
              string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)), ''
            )) AS ordered_canonical_row_hash
       FROM canonical_rows`,
  );
}

async function protectedCatalog(client: Client): Promise<Row[]> {
  return [
    await tableHash(client, "productos"),
    await tableHash(client, "precio_historial"),
  ];
}

async function sequences(client: Client): Promise<Row[]> {
  return rows(
    client,
    "all_45_sequence_values",
    `SELECT schemaname AS schema_name,
            sequencename AS sequence_name,
            last_value::text AS last_value
       FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname NOT LIKE 'pg_toast%'
        AND schemaname NOT LIKE 'pg_temp_%'
      ORDER BY schemaname, sequencename`,
  );
}

async function state(client: Client): Promise<State> {
  const currentIdentity = await identity(client);
  return {
    identity: currentIdentity,
    catalogue: normalizeCatalogue(await catalogue(client)),
    controlRows: normalizeControlRows(await controlRows(client)),
    protectedCatalog: await protectedCatalog(client),
    sequences: await sequences(client),
  };
}

function assertIdentity(value: Row, readOnly: boolean): void {
  if (
    value.database_name !== SOURCE_DATABASE ||
    value.timezone_setting !== TZ ||
    (readOnly && value.transaction_read_only !== "on") ||
    (!readOnly && value.transaction_read_only === "on")
  ) {
    throw new Error("Live source identity or transaction mode gate failed.");
  }
}

function assertSequenceCount(value: Row[], label: string): void {
  if (value.length !== EXPECTED_SEQUENCE_COUNT) {
    throw new Error(`${label} must cover exactly ${EXPECTED_SEQUENCE_COUNT} sequences.`);
  }
}

function assertStateAgainstBlock0(value: State, expectedRows: Row[], label: string): void {
  assertIdentity(value.identity, true);
  assertCatalogueAgainst(value.catalogue, expectedBlock0Map(), `${label} old defaults`);
  assertSame(value.controlRows, expectedRows, `${label} counter rows`);
  assertSequenceCount(value.sequences, `${label} sequences`);
}

function assertApplyBefore(value: State, expectedRows: Row[], label: string): void {
  assertIdentity(value.identity, false);
  assertCatalogueAgainst(value.catalogue, expectedBlock0Map(), `${label} old defaults`);
  assertSame(value.controlRows, expectedRows, `${label} counter rows`);
  assertSequenceCount(value.sequences, `${label} sequences`);
}

function assertApplyAfter(before: State, after: State): void {
  assertIdentity(after.identity, false);
  assertCatalogueAgainst(after.catalogue, expectedCodeMap(), "post-DDL defaults");
  assertSame(after.controlRows, before.controlRows, "counter rows");
  assertSame(after.protectedCatalog, before.protectedCatalog, "protected catalog");
  assertSame(after.sequences, before.sequences, "sequence values");
  assertSequenceCount(after.sequences, "post-DDL sequences");
}

function verifyBackupAndAuthorization(): {
  authorizationSha256: string;
  backupSha256: string;
  ownerClosureStatus: string;
} {
  const authText = readFileSync(AUTH_PATH, "utf8");
  const closureText = readFileSync(H_CLOSURE_PATH, "utf8");
  const authHash = createHash(AUTH_SHA256).update(authText).digest("hex");
  const backupHash = createHash(AUTH_SHA256).update(readFileSync(BACKUP_PATH)).digest("hex");
  if (!authText.includes("Autorizo los tres: entradas a 0, salidas a 0 y series a 10000000")) {
    throw new Error("Owner authorization text does not authorize the three exact defaults.");
  }
  if (!closureText.includes("currentUIStatus: APPROVED_BY_OWNER")) {
    throw new Error("Prompt H owner closure is not APPROVED_BY_OWNER.");
  }
  if (backupHash !== EXPECTED_BACKUP_SHA256) {
    throw new Error("Verified Prompt H backup SHA-256 drifted.");
  }
  return {
    authorizationSha256: authHash,
    backupSha256: backupHash,
    ownerClosureStatus: "APPROVED_BY_OWNER",
  };
}

async function writeResult(value: Row): Promise<void> {
  await fs.mkdir(REPORT_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(RESULT_JSON, asJson(value), { encoding: "utf8", mode: 0o600 });
  await fs.chmod(RESULT_JSON, 0o600);
  await fs.writeFile(RESULT_MD, renderMarkdown(value), { encoding: "utf8", mode: 0o600 });
  await fs.chmod(RESULT_MD, 0o600);
}

function renderRows(value: Row[]): string {
  return value.map((row) => `${row.table_name}:${row.control_key}=${row.control_value}`).join(", ");
}

function renderMarkdown(report: Row): string {
  const lines = [
    "# Prompt M — resultado del operador de defaults",
    "",
    `## Estado: **${String(report.status ?? "UNKNOWN")}**`,
    "",
    `- Modo: \`${String(report.mode ?? "unknown")}\`.`,
    `- Base efectiva: \`heliumdb.public\`; conexión directa mediante \`DATABASE_URL\` (URL y secretos omitidos).`,
    `- Identidad registrada: \`${report.source?.identity?.current_user_name ?? report.transaction?.before?.identity?.current_user_name ?? "—"}\`; PostgreSQL \`${report.source?.identity?.server_version ?? report.transaction?.before?.identity?.server_version ?? "—"}\`.`,
    `- Reloj de origen UTC/México: \`${report.source?.identity?.clock_timestamp_utc ?? report.transaction?.before?.identity?.clock_timestamp_utc ?? "—"}\` / \`${report.source?.identity?.clock_timestamp_mexico ?? report.transaction?.before?.identity?.clock_timestamp_mexico ?? "—"}\`.`,
    `- Autorización: SHA-256 \`${report.authorization?.authorizationSha256 ?? "—"}\`; autorización textual preexistente verificada.`,
    `- Cierre H: \`${report.authorization?.ownerClosureStatus ?? "—"}\`; respaldo SHA-256 verificado \`${report.authorization?.backupSha256 ?? "—"}\`.`,
    "",
    "## Bloque 0 y puertas",
    "",
    `- Filas del Bloque 0 comparadas: **${report.gates?.block0RowCount ?? "—"}**; actuales: **${report.gates?.liveRowCount ?? "—"}**.`,
    `- Dry-run READ ONLY: **${report.gates?.dryRunReadOnlyPass ? "PASS" : "—"}**.`,
    `- Defaults vivos pre-ALTER coinciden con Bloque 0: **${report.gates?.oldDefaultsMatch ? "PASS" : "—"}**.`,
    `- Todas las filas de contador intactas: **${report.proof?.counterRowsUnchanged ? "PASS" : "—"}**.`,
    "",
    "## SQL autorizado ejecutado",
    "",
    "Solo estas tres sentencias DDL, en una transacción; no se ejecutó `drizzle-kit push`, no se importó la API y no se crearon usuarios o sesiones:",
    "",
    "```sql",
    DDL.join("\n"),
    "```",
    "",
    `- Orden de locks: ${(report.transaction?.lockOrder ?? []).join(" → ") || "—"}.`,
    `- DDL exacto ejecutado: **${report.transaction?.ddlExecuted ? "sí" : "no"}**.`,
    `- Estado de COMMIT reconocido: **${report.transaction?.commitAcknowledged ? "COMMITTED" : report.status ?? "—"}**.`,
    `- No hubo reintento automático: **${report.retryPolicy?.automaticRetry === false ? "PASS" : "—"}**.`,
    "",
    "## Verificación después",
    "",
    `- Los seis ` + "`pg_attrdef`" + ` coinciden con el esquema: **${report.proof?.allSixDefaultsMatchCode ? "PASS" : "—"}**.`,
    `- Las 46 filas antes/después son idénticas: **${report.proof?.counterRowsUnchanged ? "PASS" : "—"}**.`,
    `- Catálogos protegidos (` + "`productos`" + `, ` + "`precio_historial`" + `) sin cambio: **${report.proof?.protectedCatalogUnchanged ? "PASS" : "—"}**.`,
    `- Las 45 secuencias sin cambio y sin ` + "`nextval`" + `: **${report.proof?.all45SequencesUnchanged ? "PASS" : "—"}**.`,
    `- Lectura READ ONLY post-COMMIT: **${report.postCommitRead?.pass ? "PASS" : report.postCommitRead ? "FAIL_NO_RETRY" : "—"}**.`,
    "",
    "## Límites",
    "",
    "- Este operador no detiene ni reinicia servicios; el API y sus escrituras concurrentes quedan fuera de su ciclo de vida.",
    "- No se ejecutaron typecheck completo, pruebas de servicios ni CLI de push desde este operador.",
    `- Filas previas: \`${renderRows(report.transaction?.before?.controlRows ?? [])}\`.`,
    "",
  ];
  if (report.error) lines.push("## Error registrado", "", `\`${String(report.error)}\``, "");
  return `${lines.join("\n")}\n`;
}

async function dryRun(pool: Pool, expectedRows: Row[], authorization: Row): Promise<Row> {
  const client = await pool.connect();
  let open = false;
  try {
    await command(client, "begin_repeatable_read_read_only", "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    open = true;
    await command(client, "set_local_timezone", `SET LOCAL TIME ZONE '${TZ}'`);
    await command(client, "set_local_statement_timeout", "SET LOCAL statement_timeout = '120s'");
    const current = await state(client);
    assertStateAgainstBlock0(current, expectedRows, "dry-run");
    await command(client, "rollback_read_only", "ROLLBACK");
    open = false;
    return {
      status: "DRY_RUN_PASS_READONLY",
      mode: "dry-run",
      source: { identity: current.identity, database: SOURCE_DATABASE, schema: SOURCE_SCHEMA },
      authorization,
      gates: {
        block0RowCount: expectedRows.length,
        liveRowCount: current.controlRows.length,
        dryRunReadOnlyPass: current.identity.transaction_read_only === "on",
        oldDefaultsMatch: true,
      },
      dryRun: {
        catalogue: current.catalogue,
        controlRows: current.controlRows,
        protectedCatalog: current.protectedCatalog,
        all45Sequences: current.sequences,
      },
      mutation: { writesExecuted: false, ddlExecuted: false, locksTaken: false, nextvalCalled: false },
      retryPolicy: { automaticRetry: false, commitUnknownNoRetry: true },
      queryAudit: [...audit],
    };
  } catch (error) {
    if (open) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function applyTransaction(
  client: Client,
  expectedRows: Row[],
  authorization: Row,
  priorDryRun: Row,
): Promise<TransactionResult> {
  await command(client, "begin_repeatable_read_read_write", "BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE");
  await command(client, "set_local_timezone", `SET LOCAL TIME ZONE '${TZ}'`);
  await command(client, "set_local_statement_timeout", "SET LOCAL statement_timeout = '120s'");
  await command(client, "set_local_lock_timeout", "SET LOCAL lock_timeout = '5s'");
  await command(client, "set_local_idle_transaction_timeout", "SET LOCAL idle_in_transaction_session_timeout = '300s'");
  const initial = await identity(client);
  assertIdentity(initial, false);
  if (priorDryRun.source?.database !== SOURCE_DATABASE) throw new Error("Dry-run source identity is not heliumdb.");
  for (const counter of LOCK_ORDER) {
    await command(
      client,
      `lock_${counter.table}_${counter.lockMode.toLowerCase().replaceAll(" ", "_")}`,
      `LOCK TABLE ${tableRef(counter.table)} IN ${counter.lockMode} MODE`,
    );
  }
  const before = await state(client);
  assertApplyBefore(before, expectedRows, "locked precondition");
  assertSame(
    before.protectedCatalog,
    priorDryRun.dryRun?.protectedCatalog,
    "protected catalog since dry-run",
  );
  assertSame(
    before.sequences,
    priorDryRun.dryRun?.all45Sequences,
    "sequence values since dry-run",
  );
  const beforeAuthHash = String(priorDryRun.authorization?.authorizationSha256 ?? "");
  if (beforeAuthHash !== String(authorization.authorizationSha256)) {
    throw new Error("Owner authorization file changed after dry-run.");
  }
  for (const sql of DDL) await command(client, `ddl_${DDL.indexOf(sql) + 1}`, sql);
  const after = await state(client);
  assertApplyAfter(before, after);
  return {
    lockOrder: LOCK_ORDER.map((counter) => `${SOURCE_SCHEMA}.${counter.table} ${counter.lockMode}`),
    before,
    after,
    ddl: [...DDL],
    ddlExecuted: true,
    proof: {
      allSixDefaultsMatchCode: true,
      counterRowsUnchanged: true,
      protectedCatalogUnchanged: true,
      protectedCatalogMatchesDryRun: true,
      all45SequencesUnchanged: true,
      all45SequencesMatchDryRun: true,
      nextvalCalled: false,
    },
  };
}

async function postCommitRead(pool: Pool, expectedRows: Row[], transaction: TransactionResult): Promise<Row> {
  const client = await pool.connect();
  let open = false;
  try {
    await command(client, "post_commit_begin_read_only", "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    open = true;
    await command(client, "post_commit_set_local_timezone", `SET LOCAL TIME ZONE '${TZ}'`);
    await command(client, "post_commit_set_local_statement_timeout", "SET LOCAL statement_timeout = '120s'");
    const current = await state(client);
    assertIdentity(current.identity, true);
    assertCatalogueAgainst(current.catalogue, expectedCodeMap(), "post-commit defaults");
    assertSame(current.controlRows, transaction.before.controlRows, "post-commit counter rows");
    assertSame(current.protectedCatalog, transaction.before.protectedCatalog, "post-commit protected catalog");
    assertSame(current.sequences, transaction.before.sequences, "post-commit sequence values");
    assertSame(current.controlRows, expectedRows, "post-commit Block 0 rows");
    assertSequenceCount(current.sequences, "post-commit sequences");
    await command(client, "post_commit_rollback_read_only", "ROLLBACK");
    open = false;
    return {
      pass: true,
      identity: current.identity,
      catalogue: current.catalogue,
      controlRows: current.controlRows,
      protectedCatalog: current.protectedCatalog,
      all45Sequences: current.sequences,
    };
  } catch (error) {
    if (open) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const mode = parseMode();
  const source = sourceUrl();
  const block0 = await readJson(BLOCK0_PATH);
  const expectedRows = assertBlock0(block0);
  const authorization = verifyBackupAndAuthorization();
  const existing = await fs.readFile(RESULT_JSON, "utf8").then((text) => JSON.parse(text) as Row).catch(() => null);
  if (mode === "apply") {
    if (process.env[APPLY_CONFIRM_ENV] !== APPLY_CONFIRM_VALUE) {
      throw new Error(`--apply requires ${APPLY_CONFIRM_ENV}=${APPLY_CONFIRM_VALUE}.`);
    }
    if (!existing || existing.status !== "DRY_RUN_PASS_READONLY") {
      throw new Error("A passing READ ONLY dry-run proof is required before --apply.");
    }
    if (TERMINAL_STATUSES.has(String(existing.status))) {
      throw new Error(`Existing terminal proof ${String(existing.status)} refuses another apply.`);
    }
  } else if (existing && TERMINAL_STATUSES.has(String(existing.status))) {
    throw new Error(`Existing terminal proof ${String(existing.status)} refuses another run.`);
  }
  const pool = createPool(source.toString());
  if (mode === "dry-run") {
    try {
      const report = await dryRun(pool, expectedRows, authorization);
      await writeResult(report);
      process.stdout.write(`${JSON.stringify({ status: report.status, proof: relative(ROOT, RESULT_JSON) })}\n`);
    } catch (error) {
      const failed = {
        status: "BLOCKED_READONLY_PREFLIGHT",
        mode,
        authorization,
        mutation: { writesExecuted: false },
        retryPolicy: { automaticRetry: false },
        error: redact(error),
      };
      await writeResult(failed);
      throw error;
    } finally {
      await pool.end().catch(() => undefined);
    }
    return;
  }

  let client: Client | null = null;
  let commitAttempted = false;
  if (!existing) throw new Error("A passing READ ONLY dry-run proof is required before --apply.");
  const running: Row = {
    status: "COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY",
    mode,
    source: { database: SOURCE_DATABASE, schema: SOURCE_SCHEMA },
    authorization,
    mutation: { writesExecuted: true },
    retryPolicy: { automaticRetry: false, commitUnknownNoRetry: true },
  };
  try {
    client = await pool.connect();
    const capturedTransaction = await applyTransaction(client, expectedRows, authorization, existing);
    const runningSource = running.source;
    if (!runningSource) throw new Error("Running proof source identity is missing.");
    runningSource.identity = capturedTransaction.before.identity;
    running.transaction = capturedTransaction;
    await writeResult(running);
    commitAttempted = true;
    await command(client, "commit_single_transaction", "COMMIT");
    running.status = "COMMITTED";
    const runningTransaction = running.transaction;
    if (!runningTransaction) throw new Error("Running transaction proof is missing.");
    runningTransaction.commitAcknowledged = true;
    if (client) client.release();
    client = null;
    try {
      running.postCommitRead = await postCommitRead(pool, expectedRows, capturedTransaction);
    } catch (error) {
      running.status = "COMMITTED_POSTCOMMIT_READ_FAILED_NO_RETRY";
      running.error = redact(error);
    }
    running.proof = capturedTransaction.proof;
    running.gates = {
      block0RowCount: expectedRows.length,
      liveRowCount: capturedTransaction.after.controlRows.length,
      dryRunReadOnlyPass: true,
      oldDefaultsMatch: true,
    };
    await writeResult(running);
    process.stdout.write(`${JSON.stringify({ status: running.status, proof: relative(ROOT, RESULT_JSON) })}\n`);
  } catch (error) {
    if (client && !commitAttempted) await client.query("ROLLBACK").catch(() => undefined);
    running.status = commitAttempted
      ? "COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY"
      : "ROLLED_BACK_EXPECTED_NO_COMMIT";
    running.error = redact(error);
    await writeResult(running);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end().catch(() => undefined);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  await main().catch((error: unknown) => {
    console.error(`Prompt M operator stopped: ${redact(error)}`);
    process.exitCode = 2;
  });
}