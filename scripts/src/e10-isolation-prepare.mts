/**
 * E10 operator-only isolated backup/restore preparation.
 * Nothing executes on import. This module never imports application/database startup code.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const AUTHORIZATION = resolve(ROOT, "reports/e10-autorizacion-fase-aislada-2026-09-18.md");
const REPORT_DIRECTORY = resolve(ROOT, "reports/e10-aislado-2026-09-18");
const MANIFEST = resolve(REPORT_DIRECTORY, "aislamiento.json");
const BACKUP_DIRECTORY = resolve(ROOT, ".local/backups/e10-20260918-isolated");
const CLUSTER_DIRECTORY = resolve(BACKUP_DIRECTORY, "cluster");
const PRIVATE_METADATA = resolve(BACKUP_DIRECTORY, "metadata.json");
const SOURCE_SNAPSHOT = resolve(BACKUP_DIRECTORY, "source-snapshot.json");
const RESTORED_SNAPSHOT = resolve(BACKUP_DIRECTORY, "restored-snapshot.json");
const DUMP = resolve(BACKUP_DIRECTORY, "e10-20260918.dump");
const POSTGRES_LOG = resolve(BACKUP_DIRECTORY, "postgres.log");
const SOCKET_DIRECTORY = "/tmp/e10-0918-pg";
const PORT = 55432;
const DATABASE = "e10_ensayo_20260918";
const LOCAL_ROLE = "postgres";
const PG_BIN = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const SESSION_TABLE = "public.sesiones";
const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg") as typeof import("pg");
type Row = Record<string, unknown>;

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function elapsed(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}
function safeError(error: unknown): string {
  return String((error as { message?: unknown })?.message ?? "unknown failure")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_CONNECTION]")
    .replace(/\b(password|passfile|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 1000);
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
async function fileHash(path: string): Promise<{ sha256: string; sizeBytes: number }> {
  const digest = createHash("sha256");
  let sizeBytes = 0;
  for await (const chunk of createReadStream(path)) {
    digest.update(chunk);
    sizeBytes += (chunk as Buffer).length;
  }
  return { sha256: digest.digest("hex"), sizeBytes };
}
async function privateJson(path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(path, 0o600);
}
function cleanEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ["DATABASE_URL", "APPLICATION_DATABASE_URL", "TEST_DATABASE_URL",
    "DATABASE_TEST_URL", "PGPASSWORD", "PGPASSFILE", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) delete env[key];
  return env;
}
type SourceParts = { host: string; port: number; database: string; user: string; password?: string; sslmode?: string };
function sourceParts(raw: string): SourceParts {
  const url = new URL(raw);
  check(url.protocol === "postgres:" || url.protocol === "postgresql:", "DATABASE_URL is not PostgreSQL.");
  const parts = {
    host: url.hostname, port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    user: decodeURIComponent(url.username),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    sslmode: url.searchParams.get("sslmode") ?? undefined,
  };
  check(parts.host && parts.database === "heliumdb" && parts.user && Number.isInteger(parts.port),
    "Source must resolve explicitly to heliumdb.");
  return parts;
}
function dumpEnvironment(parts: SourceParts): NodeJS.ProcessEnv {
  const env = cleanEnvironment();
  Object.assign(env, {
    PGHOST: parts.host, PGPORT: String(parts.port), PGDATABASE: parts.database, PGUSER: parts.user,
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=0",
  });
  if (parts.password) env.PGPASSWORD = parts.password;
  if (parts.sslmode) env.PGSSLMODE = parts.sslmode;
  return env;
}
async function command(label: string, file: string, args: string[], env = cleanEnvironment(), timeout = 3_600_000) {
  try {
    return await execFileAsync(file, args, { cwd: ROOT, env, timeout, maxBuffer: 16 * 1024 * 1024 });
  } catch {
    throw new Error(`${label} failed (details intentionally suppressed).`);
  }
}
function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
async function catalogue(client: import("pg").Client): Promise<Row> {
  const tables = (await client.query(`SELECT n.nspname AS schema,c.relname AS table,c.relkind::text AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
    ORDER BY 1,2`)).rows as Row[];
  const tableEvidence: Row[] = [];
  for (const table of tables) {
    const key = `${table.schema}.${table.table}`;
    if (key === SESSION_TABLE) {
      tableEvidence.push({ ...table, count: "0", canonicalHash: hash("E10_AUTH_SESSION_ROWS_OMITTED") });
      continue;
    }
    const { rows: [row] } = await client.query(`WITH r AS (
      SELECT to_jsonb(t)::text canonical FROM ${quoteIdent(String(table.schema))}.${quoteIdent(String(table.table))} t)
      SELECT count(*)::text count,md5(COALESCE(string_agg(md5(canonical),'' ORDER BY canonical,md5(canonical)),'')) hash FROM r`);
    tableEvidence.push({ ...table, count: row.count, canonicalHash: row.hash });
  }
  const columns = (await client.query(`SELECT n.nspname schema,c.relname table,a.attname column,
      format_type(a.atttypid,a.atttypmod) data_type,a.attnotnull not_null,
      pg_get_expr(d.adbin,d.adrelid) default_expression,NULLIF(a.attidentity,'') identity_kind,
      NULLIF(a.attgenerated,'') generated_kind
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p')
      AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
    ORDER BY 1,2,a.attnum`)).rows;
  const constraints = (await client.query(`SELECT n.nspname schema,c.relname table,con.conname name,
      con.contype::text type,pg_get_constraintdef(con.oid,true) definition,con.convalidated validated,
      con.condeferrable deferrable,con.condeferred initially_deferred
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE con.contype IN ('c','f','p','u','x') AND n.nspname NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2,3`)).rows;
  const indexes = (await client.query(`SELECT n.nspname schema,t.relname table,i.relname name,
      pg_get_indexdef(i.oid) definition,x.indisunique is_unique,x.indisprimary is_primary,
      pg_get_expr(x.indpred,x.indrelid) predicate
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
    ORDER BY 1,2,3`)).rows;
  const functions = (await client.query(`SELECT n.nspname schema,p.proname name,
      pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) result,
      pg_get_functiondef(p.oid) definition,p.prokind::text kind,p.provolatile::text volatility,p.prosecdef security_definer
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    LEFT JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
    WHERE p.prokind IN ('f','p') AND d.objid IS NULL AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' ORDER BY 1,2,3`)).rows;
  const triggers = (await client.query(`SELECT n.nspname schema,c.relname table,t.tgname name,
      pg_get_triggerdef(t.oid,true) definition,t.tgenabled::text enabled
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2,3`)).rows;
  const sequences = (await client.query(`SELECT schemaname schema,sequencename name,data_type,
      start_value::text start_value,min_value::text min_value,max_value::text max_value,
      increment_by::text increment_by,cycle,cache_size::text cache_size,last_value::text last_value
    FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2`)).rows;
  return { tables, tableEvidence, columns, constraints, indexes, functions, triggers, sequences };
}
function summary(snapshot: Row): Row {
  const result: Row = {};
  for (const key of ["tables", "tableEvidence", "columns", "constraints", "indexes", "functions", "triggers", "sequences"]) {
    const rows = snapshot[key] as Row[];
    result[key] = { count: rows.length, sha256: hash(stable(rows)) };
  }
  return result;
}
async function actorInventory(client: import("pg").Client): Promise<Row> {
  const users = (await client.query(`SELECT to_regclass('public.usuarios')::text users,
    to_regclass('public.ubicaciones')::text locations`)).rows[0];
  if (!users.users) return { existingActorIds: [], roleCounts: [], locationRoleCounts: [] };
  const columns = (await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios'`)).rows.map((r) => r.column_name);
  check(columns.includes("id"), "usuarios has no id column.");
  const roleColumn = ["rol", "role", "tipo"].find((name) => columns.includes(name));
  const locationColumn = ["ubicacion_id", "sucursal_id"].find((name) => columns.includes(name));
  const existingActorIds = (await client.query("SELECT id::text id FROM public.usuarios ORDER BY id")).rows.map((r) => r.id);
  const roleCounts = roleColumn ? (await client.query(`SELECT ${quoteIdent(roleColumn)}::text role,count(*)::int count
    FROM public.usuarios GROUP BY 1 ORDER BY 1`)).rows : [];
  const locationRoleCounts = locationColumn && roleColumn ? (await client.query(`SELECT
    ${quoteIdent(locationColumn)}::text location_id,${quoteIdent(roleColumn)}::text role,count(*)::int count
    FROM public.usuarios GROUP BY 1,2 ORDER BY 1,2`)).rows : [];
  return { existingActorIds, roleCounts, locationRoleCounts };
}
async function prepare(): Promise<void> {
  const total = process.hrtime.bigint();
  check(process.argv.includes("--authorized-isolated-copy"), "Explicit --authorized-isolated-copy required.");
  const approval = await fs.readFile(AUTHORIZATION, "utf8");
  check(approval.includes("Autorizo sólo la fase aislada descrita") && approval.includes("No crees usuarios ni sesiones"),
    "Exact E10 isolated authorization is absent.");
  check(!(await fs.stat(BACKUP_DIRECTORY).then(() => true).catch(() => false)), "Dedicated E10 backup directory already exists; refusing reuse.");
  await fs.mkdir(BACKUP_DIRECTORY, { recursive: true, mode: 0o700 });
  await fs.mkdir(REPORT_DIRECTORY, { recursive: true });
  await fs.chmod(BACKUP_DIRECTORY, 0o700);
  const raw = process.env.DATABASE_URL;
  check(raw, "DATABASE_URL is unavailable.");
  const parts = sourceParts(raw);
  const source = new pg.Client({
    host: parts.host, port: parts.port, database: parts.database, user: parts.user, password: parts.password,
    ssl: parts.sslmode === "disable" ? false : undefined,
    options: "-c default_transaction_read_only=on -c search_path=pg_catalog,public -c timezone=UTC",
    application_name: "e10-isolated-readonly-snapshot", connectionTimeoutMillis: 10_000,
  });
  const timings: Row = {};
  let tx = false;
  let sourceSnapshot: Row;
  try {
    const snapshotStart = process.hrtime.bigint();
    await source.connect();
    const { rows: [identity] } = await source.query(`SELECT current_database() database,current_user role,
      current_setting('default_transaction_read_only') default_read_only,current_setting('transaction_read_only') transaction_read_only,
      current_setting('server_version') server_version,current_setting('server_version_num') server_version_num,
      inet_server_addr()::text server_address,inet_server_port() server_port`);
    check(identity.database === "heliumdb" && identity.default_read_only === "on" && identity.transaction_read_only === "on",
      "Source identity/read-only startup guard failed.");
    check(String(identity.server_version_num).startsWith("16"), "No installed source-compatible pg_dump binary; stop without installing.");
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    tx = true;
    const readonly = (await source.query("SHOW transaction_read_only")).rows[0].transaction_read_only;
    check(readonly === "on", "Source snapshot transaction is not read-only.");
    const exported = (await source.query("SELECT pg_export_snapshot() snapshot")).rows[0].snapshot;
    const catalog = await catalogue(source);
    const actors = await actorInventory(source);
    sourceSnapshot = { identity: { database: identity.database, role: identity.role,
      serverVersion: identity.server_version, serverAddressPresent: identity.server_address !== null,
      serverPortPresent: identity.server_port !== null }, catalog, actors,
      sessionRowsPolicy: "public.sesiones schema retained; all authentication-session rows omitted" };
    await privateJson(SOURCE_SNAPSHOT, sourceSnapshot);
    timings.snapshotMs = elapsed(snapshotStart);
    const dumpStart = process.hrtime.bigint();
    await command("read-only source pg_dump", `${PG_BIN}/pg_dump`,
      ["--format=custom", "--blobs", "--no-owner", "--no-acl", `--exclude-table-data=${SESSION_TABLE}`,
        "--snapshot", String(exported), "--file", DUMP],
      dumpEnvironment(parts));
    await fs.chmod(DUMP, 0o600);
    timings.dumpMs = elapsed(dumpStart);
    await source.query("COMMIT");
    tx = false;
  } finally {
    if (tx) await source.query("ROLLBACK").catch(() => undefined);
    await source.end().catch(() => undefined);
  }
  const initStart = process.hrtime.bigint();
  await fs.mkdir(SOCKET_DIRECTORY, { recursive: true, mode: 0o700 });
  await fs.chmod(SOCKET_DIRECTORY, 0o700);
  await command("initdb", `${PG_BIN}/initdb`, ["--pgdata", CLUSTER_DIRECTORY, "--username", LOCAL_ROLE,
    "--auth-local", "trust", "--auth-host", "reject", "--no-locale", "--encoding", "UTF8"]);
  await fs.writeFile(resolve(CLUSTER_DIRECTORY, "pg_hba.conf"),
    "local all all trust\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n", { mode: 0o600 });
  await fs.appendFile(resolve(CLUSTER_DIRECTORY, "postgresql.conf"),
    `\nlisten_addresses = ''\nunix_socket_directories = '${SOCKET_DIRECTORY}'\nport = ${PORT}\n`);
  timings.initMs = elapsed(initStart);
  const dump = await fileHash(DUMP);
  await privateJson(PRIVATE_METADATA, {
    status: "PREPARED_CLUSTER_NOT_STARTED", target: { socketDirectory: SOCKET_DIRECTORY, port: PORT,
      database: DATABASE, clusterDirectory: CLUSTER_DIRECTORY, role: LOCAL_ROLE },
    sourceSnapshot: SOURCE_SNAPSHOT, restoredSnapshot: RESTORED_SNAPSHOT, dump: { path: DUMP, ...dump },
    postgresLog: POSTGRES_LOG, postgresBinary: `${PG_BIN}/postgres`, timings,
  });
  console.log(JSON.stringify({ status: "PREPARED_CLUSTER_NOT_STARTED", socket: SOCKET_DIRECTORY, port: PORT,
    database: DATABASE, cluster: CLUSTER_DIRECTORY, postgres: `${PG_BIN}/postgres`, log: POSTGRES_LOG,
    metadata: PRIVATE_METADATA, elapsedMs: elapsed(total) }));
}
async function finalize(): Promise<void> {
  check(process.argv.includes("--finalize-running-copy"), "Explicit --finalize-running-copy required.");
  const total = process.hrtime.bigint();
  const metadata = JSON.parse(await fs.readFile(PRIVATE_METADATA, "utf8")) as Row;
  const expected = metadata.target as Row;
  check(expected.socketDirectory === SOCKET_DIRECTORY && expected.port === PORT && expected.database === DATABASE
    && expected.clusterDirectory === CLUSTER_DIRECTORY, "Private metadata target mismatch.");
  const admin = new pg.Client({ host: SOCKET_DIRECTORY, port: PORT, database: "postgres", user: LOCAL_ROLE,
    ssl: false, options: "-c search_path=pg_catalog,public -c timezone=UTC" });
  await admin.connect();
  const identity = (await admin.query(`SELECT current_database() database,current_setting('data_directory') data_directory,
    current_setting('unix_socket_directories') socket,current_setting('port') port,
    current_setting('listen_addresses') listen,inet_server_addr()::text address,
    (SELECT system_identifier::text FROM pg_control_system()) system_identifier`)).rows[0];
  check(identity.database === "postgres" && await fs.realpath(identity.data_directory) === CLUSTER_DIRECTORY
    && identity.socket === SOCKET_DIRECTORY && identity.port === String(PORT) && identity.listen === "" && identity.address === null,
    "Running cluster identity is not the exact isolated target.");
  const restoreStart = process.hrtime.bigint();
  const databaseExists = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=$1) present", [DATABASE])).rows[0].present;
  if (!databaseExists) await admin.query(`CREATE DATABASE ${quoteIdent(DATABASE)} TEMPLATE template0 ENCODING 'UTF8'`);
  await admin.end();
  if (!databaseExists) {
    await command("pg_restore", `${PG_BIN}/pg_restore`,
      ["--exit-on-error", "--no-owner", "--no-acl", "--host", SOCKET_DIRECTORY, "--port", String(PORT),
        "--username", LOCAL_ROLE, "--dbname", DATABASE, DUMP]);
  }
  const restoreMs = databaseExists ? null : elapsed(restoreStart);
  const clone = new pg.Client({ host: SOCKET_DIRECTORY, port: PORT, database: DATABASE, user: LOCAL_ROLE,
    ssl: false, options: "-c search_path=pg_catalog,public -c timezone=UTC" });
  await clone.connect();
  const actual = (await clone.query(`SELECT current_database() database,current_setting('data_directory') data_directory,
    current_setting('unix_socket_directories') socket,current_setting('port') port,
    current_setting('listen_addresses') listen,inet_server_addr()::text address,
    (SELECT system_identifier::text FROM pg_control_system()) system_identifier`)).rows[0];
  check(actual.database === DATABASE && await fs.realpath(actual.data_directory) === CLUSTER_DIRECTORY
    && actual.socket === SOCKET_DIRECTORY && actual.port === String(PORT) && actual.listen === "" && actual.address === null,
    "Restored connection is not the exact isolated target.");
  const verifyStart = process.hrtime.bigint();
  const restoredCatalog = await catalogue(clone);
  const sessionCount = (await clone.query("SELECT count(*)::int count FROM public.sesiones")).rows[0].count;
  check(sessionCount === 0, "Authentication session rows were restored unexpectedly.");
  const restoredActors = await actorInventory(clone);
  await clone.end();
  const source = JSON.parse(await fs.readFile(SOURCE_SNAPSHOT, "utf8")) as Row;
  const sourceCatalog = source.catalog as Row;
  // Older collector revision included physical pg_toast indexes. Logical restore
  // assigns new OIDs, so these are explicitly removed as non-semantic internals.
  sourceCatalog.indexes = (sourceCatalog.indexes as Row[]).filter((row) => !String(row.schema).startsWith("pg_toast"));
  const categories: Row = {};
  for (const key of ["tables", "tableEvidence", "columns", "constraints", "indexes", "functions", "triggers", "sequences"]) {
    categories[key] = stable(sourceCatalog[key]) === stable(restoredCatalog[key]);
  }
  const verificationMs = elapsed(verifyStart);
  const sourceSummary = summary(sourceCatalog);
  const restoredSummary = summary(restoredCatalog);
  const dump = await fileHash(DUMP);
  await privateJson(RESTORED_SNAPSHOT, { identity: actual, catalog: restoredCatalog, actors: restoredActors });
  if (!Object.values(categories).every(Boolean) || stable(source.actors) !== stable(restoredActors)) {
    await privateJson(MANIFEST, {
      status: "PREPARING", target: { socketDirectory: SOCKET_DIRECTORY, port: PORT, database: DATABASE,
        dataDirectory: CLUSTER_DIRECTORY, systemIdentifier: actual.system_identifier },
      verification: { status: "FAIL", categories, sourceSummary, restoredSummary,
        existingActorsMatched: stable(source.actors) === stable(restoredActors) },
      omission: { table: SESSION_TABLE, rowsRestored: sessionCount },
      refusal: "Harness must refuse until semantic verification passes.",
    });
    throw new Error(`Restored semantic snapshot differs from source: ${JSON.stringify(categories)}`);
  }
  const timings = { ...metadata.timings as Row, restoreMs,
    restoreTimingStatus: databaseExists
      ? "UNMEASURED: restore completed in an earlier failed verification attempt; 5 ms reentrant no-op discarded"
      : "MEASURED_AROUND_TERMINAL_PG_RESTORE",
    verificationMs, totalFinalizeMs: elapsed(total) };
  const manifest = {
    status: "READY", retained: true, createdAtUtc: new Date().toISOString(),
    authorization: "reports/e10-autorizacion-fase-aislada-2026-09-18.md",
    target: { socketDirectory: SOCKET_DIRECTORY, port: PORT, database: DATABASE,
      dataDirectory: CLUSTER_DIRECTORY, systemIdentifier: actual.system_identifier, role: LOCAL_ROLE,
      listenAddresses: "", backendNetworkAddress: null },
    postgres: { binaryDirectory: PG_BIN, serverVersion: "16.10" },
    backup: { privateDirectory: BACKUP_DIRECTORY, dumpSha256: dump.sha256, dumpSizeBytes: dump.sizeBytes },
    omission: { table: SESSION_TABLE, schemaRetained: true, rowsRestored: 0 },
    guards: { allowlistBeforeConnectRequired: true, actualIdentityVerified: true, unixSocketOnly: true },
    verification: { status: "PASS", categories, sourceSummary, restoredSummary,
      existingActorsMatched: true, usersCreated: 0, sessionsCreated: 0 },
    actorInventory: source.actors,
    timings,
    prohibitedActions: { sourceWrites: false, sourceLogin: false, apiRestart: false, initializer: false,
      seeds: false, driveModification: false, e10MigrationApplied: false },
  };
  await privateJson(MANIFEST, manifest);
  metadata.status = "PASS";
  metadata.systemIdentifier = actual.system_identifier;
  metadata.timings = timings;
  metadata.manifest = MANIFEST;
  await privateJson(PRIVATE_METADATA, metadata);
  console.log(JSON.stringify({ status: "PASS", manifest: MANIFEST, socket: SOCKET_DIRECTORY, port: PORT,
    database: DATABASE, systemIdentifier: actual.system_identifier, sourceSummary, restoredSummary,
    actors: source.actors, timings }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.slice(2);
  try {
    if (mode.length === 1 && mode[0] === "--authorized-isolated-copy") await prepare();
    else if (mode.length === 1 && mode[0] === "--finalize-running-copy") await finalize();
    else throw new Error("Exactly one recognized explicit execution flag is required.");
  } catch (error) {
    console.error(JSON.stringify({ status: "FAIL", error: safeError(error) }));
    process.exitCode = 1;
  }
}