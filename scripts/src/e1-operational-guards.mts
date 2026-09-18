/**
 * Preparation stage only. Inert on import; --review is file-only.
 * --snapshot LABEL uses a new native-pg READ ONLY connection and never authorizes
 * DDL. --execute is deliberately disabled pending authoritative baseline and
 * an explicitly reconciled 27-object inventory. No clone/app imports.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

type Row = Record<string, any>;
type Queryable = { query: (...args: any[]) => Promise<any> };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "reports/e1-guardas-operativa-2026-09-18");
const AUTHORITATIVE = "reports/e1-ejecucion-2026-09-17/ejecucion-after-name-array.json";
const INSTALL_FILES = [
  "reports/e1-guardas-temporales-2026-09-18/sql/01-install-cash.sql",
  "reports/e1-guardas-temporales-2026-09-18/sql/02-install-pending.sql",
  "reports/e1-guardas-temporales-2026-09-18/sql/03-install-attribution.sql",
];
const GUARD_FUNCTIONS = [
  "e1_guard_cash_capture_closed", "e1_guard_pending_receipts_closed", "e1_guard_historical_attribution_closed",
];
const GUARD_TRIGGERS = [
  "zz_e1_cash_capture_closed", "zz_e1_pending_receipts_closed", "zz_e1_historical_attribution_closed",
];
const LEDGER_COLUMNS = [
  "sitio_origen_id", "sesion_caja_id", "naturaleza", "operacion_productor",
  "operacion_clave", "nota_origen_id", "origen_justificacion",
];
const IDENTITY_FIELDS = [
  "database_name", "database_oid", "database_role", "schema_name", "server_version",
  "server_address", "server_port", "server_started_at", "unix_socket_directories",
  "data_directory", "configured_port", "listen_addresses", "search_schemas",
] as const;
const userSchema = (alias: string) => `${alias}.nspname NOT IN ('pg_catalog','information_schema')
  AND ${alias}.nspname !~ '^pg_(toast|temp)'`;
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const digest = (v: unknown) => sha256(canonical(v));
const summary = (rows: Row[]) => ({ count: rows.length, sha256: digest(rows), rows });
function safeError(error: any) {
  // PostgreSQL messages/detail/context/parameters and connection strings never
  // enter reports. Stage and SQLSTATE are sufficient to identify the failure.
  return {
    code: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : null,
    message: "Snapshot/preparation failed; no DDL or application DML was executed.",
  };
}
async function jsonFile(path: string): Promise<Row> {
  return JSON.parse(await readFile(path, "utf8"));
}
async function optionalJson(path: string): Promise<Row | null> {
  try { return await jsonFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

/** Fields parent must capture from the ACTUAL API pool, not environment parsing. */
export const OPERATIONAL_IDENTITY_SQL = `SELECT current_database() AS database_name,
  (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
  current_user AS database_role, current_schema() AS schema_name,
  current_setting('server_version') AS server_version,
  inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
  pg_postmaster_start_time()::text AS server_started_at,
  current_setting('unix_socket_directories') AS unix_socket_directories,
  current_setting('data_directory') AS data_directory,
  current_setting('port') AS configured_port,
  current_setting('listen_addresses') AS listen_addresses,
  to_json(current_schemas(false)) AS search_schemas,
  current_setting('session_replication_role') AS replication_role,
  current_setting('transaction_read_only') AS transaction_read_only,
  pg_backend_pid() AS backend_pid`;

/** READ ONLY snapshot identity binding; this does not grant permission to write. */
export async function assertOperationalIdentity(client: Queryable, expected: Row) {
  const actual = (await client.query(OPERATIONAL_IDENTITY_SQL)).rows[0];
  assert.equal(expected.database_name, "heliumdb");
  assert.equal(expected.schema_name, "public");
  assert.equal(actual.replication_role, "origin");
  for (const key of IDENTITY_FIELDS) {
    assert.ok(Object.hasOwn(expected, key), `Missing API identity field: ${key}`);
    assert.deepEqual(actual[key], expected[key], `API identity mismatch: ${key}`);
  }
  return actual;
}

async function catalogue(client: Queryable) {
  const query = async (sql: string, params: unknown[] = []): Promise<Row[]> => (await client.query(sql, params)).rows;
  const tables = await query(`SELECT n.nspname AS schema,c.relname AS table,c.relkind::text AS relkind,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','f') AND ${userSchema("n")} ORDER BY n.nspname,c.relname`);
  // Foreign tables would make the read-only guarantee depend on an external FDW.
  assert.ok(tables.every((t) => t.relkind !== "f"), "Foreign tables require separate review");
  const tableEvidence: Row[] = [];
  for (const table of tables) {
    const aggregate = (await query(`WITH canonical_rows AS (
      SELECT to_jsonb(t)::text AS canonical FROM ${quote(table.schema)}.${quote(table.table)} t)
      SELECT count(*)::text AS count,
      md5(COALESCE(string_agg(md5(canonical),'' ORDER BY canonical,md5(canonical)),'')) AS "orderedCanonicalRowHash"
      FROM canonical_rows`))[0];
    tableEvidence.push({ schema: table.schema, table: table.table, relkind: table.relkind, ...aggregate });
  }
  const columns = await query(`SELECT n.nspname AS schema,c.relname AS table,a.attname AS column,
    a.attnum AS ordinal_position,format_type(a.atttypid,a.atttypmod) AS data_type,
    a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    NULLIF(a.attidentity,'') AS identity_kind,NULLIF(a.attgenerated,'') AS generated_kind
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','f') AND ${userSchema("n")}
    ORDER BY n.nspname,c.relname,a.attnum`);
  const constraints = await query(`SELECT n.nspname AS schema,c.relname AS table,k.conname AS name,
    k.contype::text AS kind,pg_get_constraintdef(k.oid,true) AS definition,k.convalidated AS validated,
    k.condeferrable AS deferrable,k.condeferred AS initially_deferred
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,k.conname`);
  const indexes = await query(`SELECT n.nspname AS schema,c.relname AS table,i.relname AS name,
    pg_get_indexdef(i.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready,x.indislive AS live
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,i.relname`);
  const functions = await query(`SELECT n.nspname AS schema,p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,pg_get_functiondef(p.oid) AS definition,
    p.prokind::text AS kind,p.proacl::text AS acl,pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prokind IN ('f','p') AND ${userSchema("n")}
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`);
  const triggers = await query(`SELECT n.nspname AS schema,c.relname AS table,t.tgname AS name,
    pg_get_triggerdef(t.oid,true) AS definition,t.tgenabled::text AS enabled,t.tgtype::int AS type,
    pn.nspname AS function_schema,p.proname AS function_name,t.tgisinternal AS internal
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,t.tgname`);
  const relations = await query(`SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl,
    CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END AS view_definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname`);
  const types = await query(`SELECT n.nspname AS schema,t.typname AS name,t.typtype::text AS kind,
    t.typacl::text AS acl,pg_get_userbyid(t.typowner) AS owner,
    CASE WHEN t.typelem<>0 THEN format_type(t.typelem,NULL) END AS element_type,
    CASE WHEN t.typbasetype<>0 THEN format_type(t.typbasetype,NULL) END AS base_type,
    t.typnotnull AS not_null,t.typdefault AS default_expression,
    (SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid) AS enum_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,t.typname`);
  const sequences = await query(`SELECT schemaname AS schema,sequencename AS name,data_type,
    start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text
    FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema')
    AND schemaname !~ '^pg_(toast|temp)' ORDER BY schemaname,sequencename`);
  const sequenceValues: Row[] = [];
  for (const sequence of sequences) {
    const [values] = await query(`SELECT last_value::text,log_cnt::text,is_called
      FROM ${quote(sequence.schema)}.${quote(sequence.name)}`);
    sequenceValues.push({ schema: sequence.schema, name: sequence.name, ...values });
  }
  const history = await query(`SELECT id::text AS id,md5(to_jsonb(m)::text) AS "fullRowMd5"
    FROM public.movimientos_credito m WHERE ${LEDGER_COLUMNS.map((c) => `${quote(c)} IS NULL`).join(" AND ")}
    ORDER BY id`);
  // Only IDs and hashes are returned. No application rows, names, amounts,
  // account identifiers or other row content is materialized in this process.
  const e1 = (rows: Row[]) => rows.filter((r) => r.schema === "public" && String(r.name).endsWith("_e1"));
  const e1Inventory = {
    relations: summary(e1(relations)), functions: summary(e1(functions)), types: summary(e1(types)),
    triggers: summary(e1(triggers)), constraints: summary(e1(constraints)),
    ledgerColumns: summary(columns.filter((r) => r.schema === "public" && r.table === "movimientos_credito" && LEDGER_COLUMNS.includes(r.column))),
  };
  const permanentFunctions = functions.filter((r) => !GUARD_FUNCTIONS.includes(r.name));
  const permanentTriggers = triggers.filter((r) => !r.internal && !GUARD_TRIGGERS.includes(r.name));
  const guardFunctions = functions.filter((r) => GUARD_FUNCTIONS.includes(r.name) || /^e1_guard_/.test(r.name));
  const guardTriggers = triggers.filter((r) => GUARD_TRIGGERS.includes(r.name) || /^zz_e1_/.test(r.name));
  return {
    tables: summary(tables), tableEvidence: summary(tableEvidence), columns: summary(columns),
    constraints: summary(constraints), indexes: summary(indexes), functions: summary(functions),
    triggers: summary(triggers), relations: summary(relations), types: summary(types),
    sequences: summary(sequences), sequenceValues: summary(sequenceValues),
    historical: summary(history), e1Inventory,
    permanentDefinitions: {
      functions: summary(permanentFunctions), triggers: summary(permanentTriggers),
      sha256: digest({ functions: permanentFunctions, triggers: permanentTriggers }),
    },
    temporaryGuards: { functions: summary(guardFunctions), triggers: summary(guardTriggers) },
  };
}

async function preparation() {
  const files = await Promise.all([
    "scripts/src/e1-operational-guards.mts", AUTHORITATIVE, ...INSTALL_FILES,
    "scripts/src/e1-approved-migration.mts", "scripts/src/e1-removable-guards.mts",
  ].map(async (path) => ({ path, sha256: sha256(await readFile(resolve(ROOT, path))) })));
  const prior = await jsonFile(resolve(ROOT, AUTHORITATIVE));
  const blockers = [
    "WRITE_PATH_NOT_IMPLEMENTED_PENDING_AUTHORITATIVE_INPUTS",
    "EXACT_27_CATALOG_OBJECT_IDENTITIES_REQUIRE_EXPLICIT_RECONCILIATION",
  ];
  if (prior.status !== "PASS" || prior.commitOutcome !== "COMMITTED_VERIFIED" || !prior.expectedAfterComparison) {
    blockers.push("SUCCESSFUL_MIGRATION_REPORT_IS_NOT_A_VERIFIED_POSTMIGRATION_BASELINE");
  }
  return {
    status: "PREPARED_NOT_AUTHORIZED", sourceDigest: digest(files), files, blockers,
    authoritativeBaseline: { path: AUTHORITATIVE, status: prior.status, commitOutcome: prior.commitOutcome },
    installPlan: { files: INSTALL_FILES, functions: 3, triggers: 3, oneTransaction: true,
      supervisorMs: 30_000, removalsAllowed: false, retryAllowed: false },
    identityContract: {
      path: relative(ROOT, resolve(OUT, "api-pool-identity.json")),
      envelope: { source: "API_POOL", capturedAtUtc: "ISO_TIMESTAMP", identity: "exact OPERATIONAL_IDENTITY_SQL result" },
      fields: IDENTITY_FIELDS,
    },
    snapshotCommand: "cd scripts && env -u NODE_OPTIONS node --import tsx src/e1-operational-guards.mts --snapshot LABEL",
    executeAvailable: false,
    note: "Snapshot observations never authorize DDL. Startup deltas must be reviewed separately from future guard installation.",
  };
}

export async function captureOperationalSnapshot(label: string) {
  assert.match(label, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, "Unsafe snapshot label");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL unavailable");
  const preparationEvidence = await preparation();
  const identityEvidence = await optionalJson(resolve(OUT, "api-pool-identity.json"));
  const report: Row = {
    formatVersion: 1, label, status: "RUNNING", stage: "connect",
    startedAtUtc: new Date().toISOString(), readOnly: true, ddlAuthorized: false,
    automaticRetries: 0, ddlStatementsSent: 0, applicationDmlStatementsSent: 0,
    authority: "NONAUTHORITATIVE_OBSERVATION_ONLY",
    preparation: preparationEvidence,
  };
  await mkdir(OUT, { recursive: true });
  // Never overwrite an earlier snapshot (including a failed one).
  const output = resolve(OUT, `snapshot-${label}.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL, application_name: "e1-operational-readonly-snapshot",
    connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000,
    options: "-c timezone=UTC -c default_transaction_read_only=on",
  });
  let connectionError = false;
  client.on("error", () => { connectionError = true; });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='20s'");
    report.stage = "identity";
    report.identity = (await client.query(OPERATIONAL_IDENTITY_SQL)).rows[0];
    assert.equal(report.identity.transaction_read_only, "on");
    assert.equal(report.identity.database_name, "heliumdb");
    assert.equal(report.identity.schema_name, "public");
    assert.equal(report.identity.replication_role, "origin");
    if (identityEvidence) {
      assert.equal(identityEvidence.source, "API_POOL");
      assert.ok(Number.isFinite(Date.parse(identityEvidence.capturedAtUtc)), "Missing API capture timestamp");
      await assertOperationalIdentity(client, identityEvidence.identity);
      report.apiIdentityBinding = { status: "MATCHED_NOT_DDL_AUTHORIZATION", evidenceSha256: digest(identityEvidence) };
    } else {
      report.apiIdentityBinding = { status: "UNAVAILABLE_NONAUTHORITATIVE", ddlAuthorized: false };
    }
    report.stage = "catalogue-and-full-row-aggregates";
    report.snapshot = await catalogue(client);
    report.snapshotSha256 = digest(report.snapshot);
    report.stage = "strict-inventory";
    report.checks = {
      tables66: report.snapshot.tables.count === 66,
      historical3: report.snapshot.historical.count === 3,
      sevenLedgerColumns: report.snapshot.e1Inventory.ledgerColumns.count === 7,
      noTemporaryGuardFunctions: report.snapshot.temporaryGuards.functions.count === 0,
      noTemporaryGuardTriggers: report.snapshot.temporaryGuards.triggers.count === 0,
      permanentFunctions55: report.snapshot.permanentDefinitions.functions.count === 55,
      permanentTriggers23: report.snapshot.permanentDefinitions.triggers.count === 23,
      sequences47: report.snapshot.sequences.count === 47,
      allTablesHashed: report.snapshot.tableEvidence.count === report.snapshot.tables.count,
      allSequencesCaptured: report.snapshot.sequenceValues.count === report.snapshot.sequences.count,
    };
    // No constructed total is labelled "27": relations, types, functions,
    // columns, constraints and triggers are separate catalog object families.
    const countLikeOriginalPreflight = Number((await client.query(`SELECT count(*)::int AS count FROM (
      SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      UNION ALL SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      UNION ALL SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      UNION ALL SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
      UNION ALL SELECT conname FROM pg_constraint) objects WHERE right(name,3)='_e1'`)).rows[0].count);
    report.e1ObjectCountGate = { status: "BLOCKED_REQUIRES_APPROVED_OBJECT_MANIFEST", expected: 27,
      originalMigrationCatalogueQueryCount: countLikeOriginalPreflight,
      countMatchesUserRequirement: countLikeOriginalPreflight === 27,
      componentCounts: Object.fromEntries(Object.entries(report.snapshot.e1Inventory).map(([k, v]) => [k, (v as Row).count])) };
    assert.ok(Object.values(report.checks).every((v) => v === true), "Snapshot invariant failed");
    assert.equal(connectionError, false, "Connection error during snapshot");
    await client.query("ROLLBACK"); // End the read-only snapshot without COMMIT.
    report.readOnlyRollbackAcknowledged = true;
    report.status = "CAPTURED_READ_ONLY_NOT_AUTHORIZATION";
    report.stage = "complete";
  } catch (error) {
    report.status = "FAIL";
    report.error = safeError(error);
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
    report.finishedAtUtc = new Date().toISOString();
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  }
  return { status: report.status, label, report: relative(ROOT, output), sha256: report.snapshotSha256,
    authority: report.authority, ddlAuthorized: false, e1ObjectCountGate: report.e1ObjectCountGate.status };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--review") {
    console.log(JSON.stringify(await preparation(), null, 2));
    return;
  }
  if (args.length === 2 && args[0] === "--snapshot") {
    console.log(JSON.stringify(await captureOperationalSnapshot(args[1]!), null, 2));
    return;
  }
  // This preparation release contains no write connection, COMMIT, DDL runner,
  // autonomous install/reinstall/removal, or probe invocation.
  if (args[0] === "--execute") {
    console.log(JSON.stringify({ status: "BLOCKED_NO_CONNECTION", ddlStatementsSent: 0,
      blockers: (await preparation()).blockers }));
    process.exitCode = 1;
    return;
  }
  throw new Error("Use --review or --snapshot LABEL; --execute is blocked in this preparation stage.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(JSON.stringify(safeError(error))); process.exitCode = 1; });
}