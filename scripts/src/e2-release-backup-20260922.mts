/**
 * E2 CLOSED release prerequisite: full backup and local disposable restore.
 *
 * This operator-only command intentionally does not run a preflight, purge,
 * seed, API initializer, Drive operation, or source write.  The source
 * connection remains in one REPEATABLE READ READ ONLY transaction until
 * pg_dump has completed.  The disposable PostgreSQL cluster is intentionally
 * left running so a later Drive redownload restore and B0 comparison can use it.
 */
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promises as fs, chmodSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { Client as PgClient, QueryResultRow } from "../../lib/db/node_modules/@types/pg";
// pg has no declarations in this workspace's local runtime package.
// @ts-ignore Runtime import is deliberately local to the workspace.
import pgRuntime from "../../lib/db/node_modules/pg/lib/index.js";

type Row = QueryResultRow & Record<string, unknown>;
type Client = PgClient;
const pg = pgRuntime as unknown as { Client: typeof PgClient };
const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BACKUPS = `${ROOT}/.local/backups`;
const REPORTS = `${ROOT}/reports/e2-liberacion-20260922`;
const APPROVAL =
  `${ROOT}/reports/e2-paquete-liberacion-preparado-20260921/autorizacion-fase-b-20260922-recibida.txt`;
const APPROVAL_SHA256 = "ea0115d5b57cc3ca5a356271e65164f00bca5acd60f58ac83a4f605f572f788b";
const PG_BIN = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const TZ = "America/Mexico_City";
const LOCAL_SUPERUSER = "postgres";

interface SourceParts {
  host: string;
  port: string;
  user: string;
  database: string;
  password?: string;
  sslmode?: string;
}

interface TableEvidence {
  schema: string;
  table: string;
  relkind: string;
  count: string;
  orderedCanonicalRowHash: string;
}

interface Catalogue {
  tables: Row[];
  tableEvidence: TableEvidence[];
  columns: Row[];
  constraints: Row[];
  indexes: Row[];
  functions: Row[];
  triggers: Row[];
  sequences: Row[];
  database: Row;
}

interface SequenceState extends Row {
  schema: string;
  sequence_name: string;
  last_value: string | null;
}

export interface E1Baseline {
  catalogue: Catalogue;
  sequenceState: SequenceState[];
}

interface Snapshot {
  capturedAtUtc: string;
  capturedAtMexico: string;
  sourceProvenance: {
    operatorFile: string;
    operatorSha256: string;
    operatorDiffFromOriginalSha256: string;
    operatorDiffFromOriginal: string;
    invocation: string[];
    headCommit: string;
    headTree: string;
    headParent: string | null;
    workingTreeStatusPorcelainV1: string[];
    workingTreeClean: boolean;
  };
  source: {
    database: Row;
    roles: string[];
    catalogue: Catalogue;
    sequenceStateBeforeDump: SequenceState[];
    sequenceStateAfterDump?: SequenceState[];
    sequenceChangedDuringDump?: boolean;
    identity: Row;
    otherClientBackendsBeforeSnapshot: number;
  };
  archive?: {
    file: string;
    sizeBytes: number;
    sha256: string;
    format: "custom";
    includesAcl: true;
    includesOwnership: true;
  };
}

interface RestoreMetadata {
  clusterDirectory: string;
  socketDirectory: string;
  superuserRole: string;
  unixSocketOnlyVerified: true;
  database: string;
  adminDatabase: string;
  adminConnectionCommand: string;
  restoredConnectionCommand: string;
  postgresBinaryDirectory: string;
  sourceDatabase: string;
  sourceOwner: string | null;
  restoredOwner: string | null;
  restoreExitCode: number;
}

let backupDirectory = "";
let reportPath = `${REPORTS}/e2-backup-restore-20260922.md`;
let metadataPath = `${REPORTS}/e2-backup-restore-20260922-metadata.json`;
let statePath = "";
let stage = "initializing";
let clusterStarted = false;

function progress(message: string): void {
  stage = message;
  console.error(`[e2-release-backup-20260922] ${message}`);
}

function q(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function qq(schema: string, table: string): string {
  return `${q(schema)}.${q(table)}`;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writePrivate(path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, json(value), { encoding: "utf8", mode: 0o600 });
  await fs.chmod(path, 0o600);
}

async function writePrivateText(path: string, value: string): Promise<void> {
  await fs.writeFile(path, value, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(path, 0o600);
}

async function queryRows<T extends Row>(
  client: Client,
  text: string,
  values: unknown[] = [],
  label = "PostgreSQL query",
): Promise<T[]> {
  try {
    const result = await client.query<T>(text, values);
    return result.rows;
  } catch {
    throw new Error(`${label} failed.`);
  }
}

async function one<T extends Row>(
  client: Client,
  text: string,
  values: unknown[] = [],
  label = "PostgreSQL query",
): Promise<T> {
  const rows = await queryRows<T>(client, text, values, label);
  if (!rows[0]) throw new Error(`${label} returned no row.`);
  return rows[0];
}

function tableKey(row: { schema: unknown; table: unknown }): string {
  return `${String(row.schema)}.${String(row.table)}`;
}

function filteredEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "APPLICATION_DATABASE_URL",
    "TEST_DATABASE_URL",
    "DATABASE_TEST_URL",
    "PGPASSWORD",
    "PGPASSFILE",
  ]) delete env[key];
  return env;
}

async function command(
  label: string,
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv = filteredEnvironment(),
  timeout = 60 * 60 * 1000,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(file, args, {
      cwd: ROOT,
      env,
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch {
    // Never surface a command line or child stderr: either can contain a
    // connection detail or server-provided data.
    throw new Error(`${label} failed.`);
  }
}

function parseSource(url: string): SourceParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL is not a PostgreSQL URL.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const user = decodeURIComponent(parsed.username);
  if (!database || !user || !parsed.hostname) {
    throw new Error("DATABASE_URL is missing its database, user, or host.");
  }
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user,
    database,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    sslmode: parsed.searchParams.get("sslmode") ?? undefined,
  };
}

function sourceEnvironment(parts: SourceParts): NodeJS.ProcessEnv {
  const env = filteredEnvironment();
  env.PGHOST = parts.host;
  env.PGPORT = parts.port;
  env.PGUSER = parts.user;
  env.PGDATABASE = parts.database;
  if (parts.password !== undefined) env.PGPASSWORD = parts.password;
  if (parts.sslmode) env.PGSSLMODE = parts.sslmode;
  return env;
}

function localConnection(socket: string, database: string): string {
  // No password and no network host are ever placed in this connection
  // string.  The socket path is private and the cluster listens on no TCP
  // address.
  return `postgresql://${LOCAL_SUPERUSER}@${encodeURIComponent(socket)}/${encodeURIComponent(database)}`;
}

function localCommand(socket: string, database: string): string {
  return `PGHOST=${q(socket)} ${q(`${PG_BIN}/psql`)} --no-psqlrc --no-password --dbname=${q(database)}`;
}

function gitOutput(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    throw new Error("Could not record exact Git source provenance.");
  }
}

function gitText(args: string[]): string {
  return gitOutput(args).trim();
}

function operatorDiff(originalFile: string, operatorFile: string): string {
  try {
    return execFileSync(
      "git",
      ["diff", "--no-index", "--binary", "--", originalFile, operatorFile],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 32 * 1024 * 1024,
      },
    );
  } catch (error) {
    const result = error as { status?: number; stdout?: string };
    if (result.status === 1 && typeof result.stdout === "string") return result.stdout;
    throw new Error("Could not record exact operator diff.");
  }
}

async function sourceProvenance(): Promise<Snapshot["sourceProvenance"]> {
  const operatorFile = fileURLToPath(import.meta.url);
  const originalFile = `${ROOT}/scripts/src/prompt-h-block2-backup-restore.mts`;
  const operator = await sha256Size(operatorFile);
  const headCommit = gitText(["rev-parse", "HEAD"]);
  const headTree = gitText(["rev-parse", "HEAD^{tree}"]);
  const parentLine = gitText(["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/);
  const status = gitOutput(["status", "--porcelain=v1", "--untracked-files=all"]);
  const exactOperatorDiff = operatorDiff(originalFile, operatorFile);
  const workingTreeStatusPorcelainV1 = status
    ? status.replace(/\n$/, "").split("\n")
    : [];
  return {
    operatorFile,
    operatorSha256: operator.sha256,
    operatorDiffFromOriginalSha256: createHash("sha256").update(exactOperatorDiff).digest("hex"),
    operatorDiffFromOriginal: exactOperatorDiff,
    invocation: [process.execPath, ...process.argv.slice(1)],
    headCommit,
    headTree,
    headParent: parentLine[1] ?? null,
    workingTreeStatusPorcelainV1,
    workingTreeClean: workingTreeStatusPorcelainV1.length === 0,
  };
}

function mexico(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function stamp(date: Date): string {
  return mexico(date).replace(/[-: ]/g, "");
}

async function sha256Size(path: string): Promise<{ sha256: string; sizeBytes: number }> {
  const hash = createHash("sha256");
  const contents = await fs.readFile(path);
  hash.update(contents);
  return { sha256: hash.digest("hex"), sizeBytes: contents.byteLength };
}

function userObjectWhere(alias = "n"): string {
  return `${alias}.nspname NOT IN ('pg_catalog', 'information_schema')
    AND ${alias}.nspname NOT LIKE 'pg_toast%'
    AND ${alias}.nspname NOT LIKE 'pg_temp_%'`;
}

async function sequenceState(client: Client): Promise<SequenceState[]> {
  return await queryRows<SequenceState>(
    client,
    `SELECT schemaname AS schema, sequencename AS sequence_name,
            last_value::text AS last_value
       FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname NOT LIKE 'pg_toast%'
        AND schemaname NOT LIKE 'pg_temp_%'
      ORDER BY schemaname, sequencename`,
    [],
    "Reading non-MVCC sequence state",
  );
}

async function tableEvidence(client: Client, tables: Row[]): Promise<TableEvidence[]> {
  const evidence: TableEvidence[] = [];
  for (const table of tables) {
    const schema = String(table.schema);
    const relation = String(table.table);
    const row = await one<Row & { count: string; ordered_canonical_row_hash: string }>(
      client,
      `WITH canonical_rows AS (
         SELECT to_jsonb(t)::text AS canonical
           FROM ${qq(schema, relation)} AS t
       )
       SELECT count(*)::text AS count,
              md5(COALESCE(
                string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)),
                ''
              )) AS ordered_canonical_row_hash
         FROM canonical_rows`,
      [],
      `Reading count and canonical row hash for ${schema}.${relation}`,
    );
    evidence.push({
      schema,
      table: relation,
      relkind: String(table.relkind),
      count: String(row.count),
      orderedCanonicalRowHash: String(row.ordered_canonical_row_hash),
    });
  }
  return evidence;
}

async function readCatalogue(client: Client): Promise<Catalogue> {
  const tables = await queryRows(
    client,
    `SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind,
            pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'f') AND ${userObjectWhere("n")}
      ORDER BY n.nspname, c.relname`,
    [],
    "Reading dynamic non-system table set",
  );
  const evidence = await tableEvidence(client, tables);
  const columns = await queryRows(
    client,
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
        AND c.relkind IN ('r', 'p', 'f') AND ${userObjectWhere("n")}
      ORDER BY n.nspname, c.relname, a.attnum`,
    [],
    "Reading semantic columns and defaults",
  );
  const constraints = await queryRows(
    client,
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
      WHERE con.contype IN ('c', 'f', 'p', 'u', 'x') AND ${userObjectWhere("n")}
      ORDER BY n.nspname, c.relname, con.conname`,
    [],
    "Reading semantic constraints",
  );
  const indexes = await queryRows(
    client,
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
      WHERE tc.relkind IN ('r', 'p', 'f') AND ${userObjectWhere("tn")}
      ORDER BY tn.nspname, tc.relname, i.relname`,
    [],
    "Reading semantic indexes",
  );
  const functions = await queryRows(
    client,
    `SELECT n.nspname AS schema, p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS identity_arguments,
            pg_get_function_result(p.oid) AS result_type,
            pg_get_functiondef(p.oid) AS definition,
            p.prokind::text AS kind, p.provolatile::text AS volatility,
            p.prosecdef AS security_definer, p.proleakproof AS leakproof,
            p.proparallel::text AS parallel, p.proacl::text AS acl,
            pg_get_userbyid(p.proowner) AS owner,
            ext.extname AS extension_name
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       LEFT JOIN pg_depend dep
         ON dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
        AND dep.deptype = 'e'
       LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
      WHERE p.prokind IN ('f', 'p') AND ${userObjectWhere("n")}
      ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
    [],
    "Reading semantic functions",
  );
  const triggers = await queryRows(
    client,
    `SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger_name,
            pg_get_triggerdef(t.oid, true) AS definition, t.tgenabled::text AS enabled,
            pn.nspname AS function_schema, p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS function_arguments
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
      WHERE NOT t.tgisinternal AND ${userObjectWhere("n")}
      ORDER BY n.nspname, c.relname, t.tgname`,
    [],
    "Reading every noninternal trigger enabled state",
  );
  const sequences = await queryRows(
    client,
    `SELECT schemaname AS schema, sequencename AS sequence_name, data_type,
            start_value::text AS start_value, min_value::text AS min_value,
            max_value::text AS max_value, increment_by::text AS increment_by,
            cycle, cache_size::text AS cache_size
       FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname NOT LIKE 'pg_toast%'
        AND schemaname NOT LIKE 'pg_temp_%'
      ORDER BY schemaname, sequencename`,
    [],
    "Reading semantic sequence definitions",
  );
  const database = await one(
    client,
    `SELECT current_database() AS database_name, current_user AS current_user,
            pg_get_userbyid(d.datdba) AS owner, d.datacl::text AS acl,
            pg_database_size(d.datname)::text AS size_bytes,
            current_setting('server_version') AS server_version,
            current_setting('server_version_num') AS server_version_num
       FROM pg_database d WHERE d.datname = current_database()`,
    [],
    "Reading database ownership and ACL",
  );
  return {
    tables,
    tableEvidence: evidence,
    columns,
    constraints,
    indexes,
    functions,
    triggers,
    sequences,
    database,
  };
}

export async function collectE1Baseline(client: Client): Promise<E1Baseline> {
  return {
    catalogue: await readCatalogue(client),
    sequenceState: await sequenceState(client),
  };
}

function compareRows(source: Row[], restored: Row[], keyFields: string[]): string[] {
  const left = source.map(stable).sort();
  const right = restored.map(stable).sort();
  if (left.length === right.length && left.every((row, index) => row === right[index])) return [];
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const mismatches: string[] = [];
  for (const row of source) {
    if (!rightSet.has(stable(row))) {
      mismatches.push(keyFields.map((field) => String(row[field] ?? "")).join("."));
    }
  }
  for (const row of restored) {
    if (!leftSet.has(stable(row))) {
      mismatches.push(`restored:${keyFields.map((field) => String(row[field] ?? "")).join(".")}`);
    }
  }
  return [...new Set(mismatches)].sort();
}

function compareEvidence(source: TableEvidence[], restored: TableEvidence[]): string[] {
  const left = new Map(source.map((row) => [`${row.schema}.${row.table}`, row]));
  const right = new Map(restored.map((row) => [`${row.schema}.${row.table}`, row]));
  const mismatches: string[] = [];
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(key);
    const b = right.get(key);
    if (!a || !b || a.relkind !== b.relkind || a.count !== b.count ||
        a.orderedCanonicalRowHash !== b.orderedCanonicalRowHash) mismatches.push(key);
  }
  return mismatches.sort();
}

function compareSequenceState(source: SequenceState[], restored: SequenceState[]): string[] {
  return compareRows(
    source as unknown as Row[],
    restored as unknown as Row[],
    ["schema", "sequence_name"],
  );
}

function without(row: Row, keys: string[]): Row {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

async function createCluster(directory: string, socket: string): Promise<void> {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  mkdirSync(socket, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  chmodSync(socket, 0o700);
  await command(
    "initdb",
    `${PG_BIN}/initdb`,
    ["--pgdata", directory, "--username", LOCAL_SUPERUSER,
      "--auth-local", "trust", "--auth-host", "reject", "--no-locale", "--encoding", "UTF8"],
    filteredEnvironment(),
    10 * 60 * 1000,
  );
  // Explicitly keep all TCP listeners disabled and restrict HBA to the
  // private Unix socket.  The second host rules are defense in depth.
  await fs.writeFile(
    `${directory}/pg_hba.conf`,
    "local all all trust\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n",
    { encoding: "utf8", mode: 0o600 },
  );
  await command(
    "pg_ctl start",
    `${PG_BIN}/pg_ctl`,
    ["--pgdata", directory, "--wait", "--timeout=120", "--log", `${directory}/postgres.log`,
      "--options", `-k ${socket} -c listen_addresses=''`, "start"],
    filteredEnvironment(),
    5 * 60 * 1000,
  );
  clusterStarted = true;
  await fs.chmod(`${directory}/postgres.log`, 0o600).catch(() => undefined);
}

async function connectLocal(socket: string, database: string, readonly = false): Promise<Client> {
  const client = new pg.Client({ connectionString: localConnection(socket, database) });
  try {
    await client.connect();
    if (readonly) await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return client;
  } catch {
    await client.end().catch(() => undefined);
    throw new Error("Could not connect to the disposable local cluster.");
  }
}

async function createRestoreRoles(client: Client, roles: string[]): Promise<void> {
  const existing = new Set(
    (await queryRows<{ rolname: string }>(client, "SELECT rolname FROM pg_roles", [], "Reading local roles"))
      .map((row) => row.rolname),
  );
  for (const role of roles) {
    if (role === "public" || existing.has(role)) continue;
    await queryRows(
      client,
      `CREATE ROLE ${q(role)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
       NOLOGIN NOREPLICATION NOBYPASSRLS`,
      [],
      "Creating ownership-only restore role",
    );
    existing.add(role);
  }
}

async function renameDatabase(client: Client, from: string, to: string): Promise<void> {
  await queryRows(client, `ALTER DATABASE ${q(from)} RENAME TO ${q(to)}`, [], "Naming disposable database");
}

async function restoreAndVerify(
  snapshot: Snapshot,
  dumpPath: string,
  stampValue: string,
): Promise<{ metadata: RestoreMetadata; comparison: Record<string, unknown> }> {
  const cluster = `${backupDirectory}/restore-cluster`;
  const socket = `/tmp/e2-release-backup-20260922-${stampValue}-${process.pid}`;
  const admin = `e2_restore_admin_${stampValue}`;
  const restored = `e2_restore_disposable_${stampValue}`;
  if (existsSync(cluster)) throw new Error("A fresh restore cluster path already exists.");
  await createCluster(cluster, socket);
  // PostgreSQL cannot rename the database to which the session is connected.
  // template1 is untouched by the archive and is therefore the safe bootstrap
  // connection for renaming the default postgres database.
  const bootstrap = await connectLocal(socket, "template1");
  try {
    const listener = await one<{ listen_addresses: string; server_address: string | null }>(
      bootstrap,
      "SELECT current_setting('listen_addresses') AS listen_addresses, inet_server_addr()::text AS server_address",
      [],
      "Verifying Unix-socket-only disposable listener",
    );
    if (listener.listen_addresses !== "" || listener.server_address !== null) {
      throw new Error("Disposable cluster unexpectedly has a network listener.");
    }
    await renameDatabase(bootstrap, "postgres", admin);
  } finally {
    await bootstrap.end().catch(() => undefined);
  }
  const adminClient = await connectLocal(socket, admin);
  try {
    await createRestoreRoles(adminClient, snapshot.source.roles);
  } finally {
    await adminClient.end().catch(() => undefined);
  }
  const adminUrl = localConnection(socket, admin);
  const restoredUrlBeforeRename = adminUrl;
  progress("restoring full custom archive into isolated local PostgreSQL 16");
  const restoreResult = await command(
    "pg_restore",
    `${PG_BIN}/pg_restore`,
    ["--create", "--exit-on-error", "--dbname", restoredUrlBeforeRename, dumpPath],
    filteredEnvironment(),
    60 * 60 * 1000,
  );
  void restoreResult;
  const renameClient = await connectLocal(socket, admin);
  try {
    await renameDatabase(renameClient, snapshot.source.database.database_name as string, restored);
  } finally {
    await renameClient.end().catch(() => undefined);
  }
  const restoredClient = await connectLocal(socket, restored, true);
  let restoredCatalogue: Catalogue;
  let restoredSequenceState: SequenceState[];
  try {
    progress("capturing restored dynamic tables, hashes, and semantic catalogue");
    restoredCatalogue = await readCatalogue(restoredClient);
    restoredSequenceState = await sequenceState(restoredClient);
    await restoredClient.query("COMMIT");
  } finally {
    await restoredClient.end().catch(() => undefined);
  }
  const source = snapshot.source.catalogue;
  const sourceColumns = source.columns.map((row) => without(row, ["ordinal_position"]));
  const restoredColumns = restoredCatalogue.columns.map((row) =>
    without(row, ["ordinal_position"]),
  );
  const sourceFunctions = source.functions.map((row) =>
    row.extension_name
      ? without(row, ["definition", "acl", "owner"])
      : row,
  );
  const restoredFunctions = restoredCatalogue.functions.map((row) =>
    row.extension_name
      ? without(row, ["definition", "acl", "owner"])
      : row,
  );
  const categories: Record<string, string[]> = {
    tables: compareRows(source.tables, restoredCatalogue.tables, ["schema", "table"]),
    columns: compareRows(sourceColumns, restoredColumns, ["schema", "table", "column"]),
    constraints: compareRows(source.constraints, restoredCatalogue.constraints, ["schema", "table", "name"]),
    indexes: compareRows(source.indexes, restoredCatalogue.indexes, ["schema", "table", "index_name"]),
    functions: compareRows(sourceFunctions, restoredFunctions, ["schema", "name", "identity_arguments"]),
    triggers: compareRows(source.triggers, restoredCatalogue.triggers, ["schema", "table", "trigger_name"]),
    sequences: compareRows(source.sequences, restoredCatalogue.sequences, ["schema", "sequence_name"]),
    tableCountsAndCanonicalRowHashes: compareEvidence(source.tableEvidence, restoredCatalogue.tableEvidence),
    sequenceStateAfterDump: compareSequenceState(
      snapshot.source.sequenceStateAfterDump ?? [],
      restoredSequenceState,
    ),
  };
  const databaseSemantic = (database: Row): Row => ({
    owner: database.owner,
    acl: database.acl,
    server_version: database.server_version,
  });
  const databaseMismatch =
    stable(databaseSemantic(source.database)) !==
    stable(databaseSemantic(restoredCatalogue.database));
  const failed = databaseMismatch || Object.values(categories).some((items) => items.length > 0);
  const before = snapshot.source.sequenceStateBeforeDump;
  const after = snapshot.source.sequenceStateAfterDump ?? [];
  const sequenceChangedDuringDump = stable(before) !== stable(after);
  const sourceOwner = snapshot.source.database.owner === null
    ? null
    : String(snapshot.source.database.owner);
  const restoredOwner = restoredCatalogue.database.owner === null
    ? null
    : String(restoredCatalogue.database.owner);
  const metadata: RestoreMetadata = {
    clusterDirectory: cluster,
    socketDirectory: socket,
    superuserRole: LOCAL_SUPERUSER,
    unixSocketOnlyVerified: true,
    database: restored,
    adminDatabase: admin,
    adminConnectionCommand: localCommand(socket, admin),
    restoredConnectionCommand: localCommand(socket, restored),
    postgresBinaryDirectory: PG_BIN,
    sourceDatabase: String(snapshot.source.database.database_name),
    sourceOwner,
    restoredOwner,
    restoreExitCode: 0,
  };
  const comparison = {
    status: failed ? "FAIL" : "PASS",
    databaseMetadataMatched: !databaseMismatch,
    categories,
    dynamicTableCount: source.tableEvidence.length,
    restoredTableCount: restoredCatalogue.tableEvidence.length,
    sourceTriggerCount: source.triggers.length,
    restoredTriggerCount: restoredCatalogue.triggers.length,
    allNoninternalTriggerEnabledStatesCompared: true,
    sequenceChangedDuringDump,
    sourceSequenceStateBeforeDump: before,
    sourceSequenceStateAfterDump: after,
    restoredSequenceState,
  };
  return { metadata, comparison };
}

function markdown(
  snapshot: Snapshot,
  metadata: RestoreMetadata | null,
  comparison: Record<string, unknown> | null,
  error: string | null,
): string {
  const archive = snapshot.archive;
  const categories = (comparison?.categories ?? {}) as Record<string, string[]>;
  const status = error ? "FAIL" : String(comparison?.status ?? "FAIL");
  const mismatchLines = Object.entries(categories)
    .filter(([, values]) => values.length > 0)
    .flatMap(([category, values]) => [`- ${category}: ${values.join(", ")}`]);
  const sequenceChanged = Boolean(
    comparison?.sequenceChangedDuringDump ?? snapshot.source.sequenceChangedDuringDump,
  );
  const reconnect = metadata
    ? `- Administrador: \`${metadata.adminConnectionCommand}\`
- Base restaurada: \`${metadata.restoredConnectionCommand}\``
    : "- Comandos de reconexión: no disponibles porque la restauración no completó.";
  return `# E2 CLOSED — respaldo + restauración desechable local — 2026-09-22

## Veredicto

**${status}**${sequenceChanged ? " (se detectó cambio de estado de secuencias durante el dump; la comparación usa el estado capturado después del dump)" : ""}.

La autorización actual usada es \`${APPROVAL}\` (SHA-256
\`${APPROVAL_SHA256}\`). Esta ejecución se limitó a respaldo y
restauración local. No ejecutó Drive, preflight, purga, seed, identidad de
aplicación, ni reinicio de API/workflows. No se hicieron escrituras en la base
fuente. Drive sigue siendo un prerrequisito posterior independiente: este
reporte nunca afirma que fue ejecutado. Los demás client backends antes de
iniciar el snapshot fueron: **${snapshot.source.otherClientBackendsBeforeSnapshot}**.

## Fuente exacta del operador

- Archivo: \`${snapshot.sourceProvenance.operatorFile}\`
- SHA-256 del archivo ejecutado: \`${snapshot.sourceProvenance.operatorSha256}\`
- Commit HEAD: \`${snapshot.sourceProvenance.headCommit}\`
- Árbol del commit HEAD: \`${snapshot.sourceProvenance.headTree}\`
- Padre del commit HEAD: \`${snapshot.sourceProvenance.headParent ?? "sin padre"}\`
- SHA-256 del diff binario exacto contra el operador original:
  \`${snapshot.sourceProvenance.operatorDiffFromOriginalSha256}\`
- Invocación exacta (arreglo argv; DATABASE_URL no se registra):
  \`${JSON.stringify(snapshot.sourceProvenance.invocation)}\`
- Diff binario exacto contra \`scripts/src/prompt-h-block2-backup-restore.mts\`:

\`\`\`diff
${snapshot.sourceProvenance.operatorDiffFromOriginal}
\`\`\`
- Metadata sanitizada: \`${metadataPath}\`
- Árbol de trabajo limpio al capturar: **${snapshot.sourceProvenance.workingTreeClean ? "sí" : "no"}**
- Estado porcelain v1: ${snapshot.sourceProvenance.workingTreeStatusPorcelainV1.length
    ? snapshot.sourceProvenance.workingTreeStatusPorcelainV1.map((line) => `\`${line}\``).join(", ")
    : "sin cambios"}

## Fuente y captura

- Base efectiva: \`${snapshot.source.database.database_name}\`
- PostgreSQL: \`${snapshot.source.database.server_version}\`
- Identidad exigida/comprobada: \`heliumdb / OID 16384 / public / postgres / PG 160010\`
- Snapshot UTC: \`${snapshot.capturedAtUtc}\`
- Snapshot Mexico City: \`${snapshot.capturedAtMexico}\`
- Transacción: \`REPEATABLE READ READ ONLY\`; \`pg_export_snapshot()\` fue
  entregado a \`pg_dump\` y la transacción permaneció abierta hasta terminarlo.
- Tablas no sistémicas descubiertas dinámicamente: ${snapshot.source.catalogue.tableEvidence.length}
- Triggers no internos descubiertos dinámicamente: ${snapshot.source.catalogue.triggers.length};
  se compararon definición y estado habilitado de todos.
- La huella de filas es MD5 de una concatenación ordenada de MD5 de
  \`to_jsonb(row)::text\` canónico producido por PostgreSQL. No se guardaron
  filas crudas.

## Archivo

- Dump custom: \`${archive?.file ?? "no creado"}\`
- Tamaño: \`${archive?.sizeBytes ?? "n/a"}\` bytes
- SHA-256: \`${archive?.sha256 ?? "n/a"}\`
- Ownership/ACL: incluidos por las opciones predeterminadas de \`pg_dump\`
  (sin \`--no-owner\` ni \`--no-acl\`); los roles de ownership del archivo se
  crearon localmente como roles sin login únicamente para restaurar ACL/owners.
- Restauración ejecutada con el rol superusuario local existente \`postgres\`;
  no se crearon seeds de usuarios ni identidad de aplicación.
- El archivo permanece privado bajo \`.local/backups/\`; ningún dump se guardó
  en una carpeta servida públicamente.
- Todas las tablas y todas sus filas se incluyeron sin exclusiones, incluidas
  las sesiones existentes. No se ejecutaron fixtures ni se crearon usuarios o
  sesiones de aplicación. Dump, snapshots y cluster usan permisos privados
  locales.

## Comparación

- Conteos y huellas canónicas por tabla: ${categories.tableCountsAndCanonicalRowHashes?.length === 0 ? "PASS" : "FAIL"}
- Columnas/defaults: ${categories.columns?.length === 0 ? "PASS" : "FAIL"}
- Constraints: ${categories.constraints?.length === 0 ? "PASS" : "FAIL"}
- Índices: ${categories.indexes?.length === 0 ? "PASS" : "FAIL"}
- Funciones: ${categories.functions?.length === 0 ? "PASS" : "FAIL"}
- Triggers no internos y estados enabled: ${categories.triggers?.length === 0 ? "PASS" : "FAIL"}
- Definiciones de secuencias: ${categories.sequences?.length === 0 ? "PASS" : "FAIL"}
- Estado de secuencias posterior al dump: ${categories.sequenceStateAfterDump?.length === 0 ? "PASS" : "FAIL"}
- Metadatos de base/ownership/ACL: ${comparison?.databaseMetadataMatched ? "PASS" : "FAIL"}

${error ? `## Error detenido\n\n${error}\n` : ""}
${mismatchLines.length ? `## Discrepancias (procedimiento detenido)\n\n${mismatchLines.join("\n")}\n` : ""}
## Secuencias no-MVCC

El estado de secuencias se capturó antes y después del dump fuera de la
garantía MVCC. Cambio detectado: **${sequenceChanged ? "sí" : "no"}**.
En E2 cualquier desigualdad detiene el procedimiento con FAIL; nunca se acepta
silenciosamente. Un snapshot prueba el instante del respaldo, no frescura de un preflight
posterior; no se realizó ese preflight.

## Restauración local persistente

${metadata ? `- Cluster: \`${metadata.clusterDirectory}\`
- Socket Unix restringido: \`${metadata.socketDirectory}\`
- Base restaurada: \`${metadata.database}\`
- Exit code de \`pg_restore\`: \`${metadata.restoreExitCode}\`
${reconnect}` : "- El cluster no quedó disponible."}

El cluster, sus archivos y la base desechable **no se eliminan** después del
éxito; deben conservarse para la comparación posterior de la restauración de
la redescarga de Drive y para la comparación B0. No se purgan en este operador.
La restauración no sembró usuarios ni identidad de aplicación.
`;
}

async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) {
    throw new Error("E2 mode is fixed; command-line scopes and connection arguments are disabled.");
  }
  if (!existsSync(APPROVAL)) throw new Error("Owner approval file is missing.");
  const approvalBytes = await fs.readFile(APPROVAL);
  const approvalHash = createHash("sha256").update(approvalBytes).digest("hex");
  if (approvalHash !== APPROVAL_SHA256) throw new Error("Current E2 approval hash does not match.");
  const approval = approvalBytes.toString("utf8");
  for (const required of [
    "Autorizo la liberación E2 CLOSED",
    "Antes del SQL, exijo respaldo completo verificado en Google Drive",
    "descarga/restauración de ensayo",
    "El destino lógico es heliumdb, OID 16384, public, rol postgres, PostgreSQL 160010",
  ]) {
    if (!approval.includes(required)) {
      throw new Error(`Current E2 approval is missing required prerequisite text: ${required}`);
    }
  }
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) throw new Error("Parent-provided runtime DATABASE_URL is required.");
  for (const key of ["TEST_DATABASE_URL", "DATABASE_TEST_URL", "APPLICATION_DATABASE_URL"]) {
    if (process.env[key]) throw new Error(`Refusing test/application override: ${key}.`);
  }
  const parts = parseSource(sourceUrl);
  if (parts.database !== "heliumdb") throw new Error("Effective DATABASE_URL must target heliumdb.");
  for (const binary of ["pg_dump", "pg_restore", "initdb", "pg_ctl", "psql"]) {
    if (!existsSync(`${PG_BIN}/${binary}`)) {
      throw new Error(`Required retained PostgreSQL 16 binary is missing: ${binary}.`);
    }
  }
  const captured = new Date();
  const stampValue = `${stamp(captured)}-${process.pid}`;
  backupDirectory = `${BACKUPS}/e2-release-backup-20260922-${stampValue}`;
  if (existsSync(backupDirectory) && readdirSync(backupDirectory).length > 0) {
    throw new Error("Backup directory already exists; refusing to reuse stale inventory.");
  }
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  chmodSync(backupDirectory, 0o700);
  statePath = `${backupDirectory}/state.json`;
  const dumpPath = `${backupDirectory}/e2-release-backup-20260922-${stampValue}.dump`;
  const sourcePath = `${backupDirectory}/source-snapshot.json`;
  const restoreMetadataPath = `${backupDirectory}/restore-metadata.json`;
  await writePrivate(statePath, { status: "RUNNING", stage, updatedAtUtc: captured.toISOString() });
  let snapshot: Snapshot = {
    capturedAtUtc: captured.toISOString(),
    capturedAtMexico: mexico(captured),
    sourceProvenance: await sourceProvenance(),
    source: {
      database: {},
      roles: [],
      catalogue: {
        tables: [], tableEvidence: [], columns: [], constraints: [], indexes: [],
        functions: [], triggers: [], sequences: [], database: {},
      },
      sequenceStateBeforeDump: [],
      identity: {},
      otherClientBackendsBeforeSnapshot: -1,
    },
  };
  let metadata: RestoreMetadata | null = null;
  let comparison: Record<string, unknown> | null = null;
  let failure: string | null = null;
  let source: Client | null = null;
  let sourceTransactionOpen = false;
  try {
    const sourceClient = new pg.Client({
      connectionString: sourceUrl,
      application_name: "e2-release-backup-20260922-readonly",
      options: "-c default_transaction_read_only=on -c timezone=UTC",
    });
    source = sourceClient;
    await source.connect();
    await source.query("SET TIME ZONE 'UTC'");
    const clients = await one<{ count: number }>(
      source,
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'",
      [],
      "Verifying zero other source clients before starting snapshot",
    );
    snapshot.source.otherClientBackendsBeforeSnapshot = clients.count;
    if (clients.count !== 0) {
      throw new Error("Other source client backends are connected; E2 snapshot blocked.");
    }
    const identity = await one<{
      database_name: string;
      database_oid: string;
      database_role: string;
      schema_name: string;
      server_version: string;
      server_version_num: string;
    }>(
      source,
      `SELECT current_database()::text AS database_name,
              (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
              current_user::text AS database_role,
              current_schema()::text AS schema_name,
              current_setting('server_version')::text AS server_version,
              current_setting('server_version_num')::text AS server_version_num`,
      [],
      "Verifying effective source identity",
    );
    if (
      identity.database_name !== "heliumdb" ||
      identity.database_oid !== "16384" ||
      identity.database_role !== "postgres" ||
      identity.schema_name !== "public" ||
      identity.server_version_num !== "160010"
    ) {
      throw new Error("Source identity is not heliumdb/OID16384/public/postgres/PG160010.");
    }
    snapshot.source.identity = identity;
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransactionOpen = true;
    const txMode = await one<{ transaction_read_only: string }>(
      source, "SHOW transaction_read_only", [], "Verifying read-only source transaction",
    );
    if (txMode.transaction_read_only !== "on") throw new Error("Source transaction is not read-only.");
    const exported = await one<{ snapshot: string }>(
      source, "SELECT pg_export_snapshot() AS snapshot", [], "Exporting source snapshot",
    );
    if (!exported.snapshot) throw new Error("PostgreSQL did not export a snapshot.");
    snapshot.source.sequenceStateBeforeDump = await sequenceState(source);
    snapshot.source.catalogue = await readCatalogue(source);
    snapshot.source.database = snapshot.source.catalogue.database;
    snapshot.source.roles = (
      await queryRows<{ rolname: string }>(source, "SELECT rolname FROM pg_roles ORDER BY rolname", [], "Reading source roles")
    ).map((row) => String(row.rolname));
    await writePrivate(sourcePath, snapshot);
    progress("running full unrestricted custom pg_dump from the exported snapshot");
    const dumpEnv = sourceEnvironment(parts);
    await command(
      "pg_dump",
      `${PG_BIN}/pg_dump`,
      ["--format=custom", "--create", "--blobs", "--file", dumpPath, "--snapshot", exported.snapshot,
        "--host", parts.host, "--port", parts.port, "--username", parts.user, "--dbname", parts.database],
      dumpEnv,
    );
    await fs.chmod(dumpPath, 0o600);
    snapshot.source.sequenceStateAfterDump = await sequenceState(source);
    snapshot.source.sequenceChangedDuringDump =
      stable(snapshot.source.sequenceStateBeforeDump) !==
      stable(snapshot.source.sequenceStateAfterDump);
    const archive = await sha256Size(dumpPath);
    const toc = await command("pg_restore archive inspection", `${PG_BIN}/pg_restore`, ["--list", dumpPath]);
    const tocLines = toc.stdout.split("\n").filter(Boolean);
    if (tocLines.length < 2) throw new Error("Custom archive has no verifiable TOC entries.");
    snapshot.archive = {
      file: dumpPath,
      ...archive,
      format: "custom",
      includesAcl: true,
      includesOwnership: true,
    };
    await writePrivate(sourcePath, snapshot);
    if (snapshot.source.sequenceChangedDuringDump) {
      throw new Error("Sequence state changed during the source snapshot/backup window.");
    }
    if (sourceTransactionOpen) {
      await source.query("COMMIT");
      sourceTransactionOpen = false;
    }
    await source.end();
    source = null;
    progress("verifying disposable restore without source or API writes");
    const result = await restoreAndVerify(snapshot, dumpPath, stampValue);
    metadata = result.metadata;
    comparison = result.comparison;
    await writePrivate(restoreMetadataPath, metadata);
    if (comparison.status === "FAIL") throw new Error("Restore verification reported discrepancies.");
  } catch (error) {
    failure = error instanceof Error ? error.message : "Backup/restore failed.";
    if (sourceTransactionOpen && source) await source.query("ROLLBACK").catch(() => undefined);
    if (source) await source.end().catch(() => undefined);
  }
  // The report and metadata are intentionally sanitized.  A failure after
  // cluster startup does not stop or delete that cluster.
  await fs.mkdir(REPORTS, { recursive: true, mode: 0o700 });
  await fs.chmod(REPORTS, 0o700).catch(() => undefined);
  await writePrivateText(reportPath, markdown(snapshot, metadata, comparison, failure));
  const publicMetadata = {
    status: failure ? "FAIL" : comparison?.status ?? "FAIL",
    report: reportPath,
    backupDirectory,
    archive: snapshot.archive ?? null,
    capturedAtUtc: snapshot.capturedAtUtc,
    capturedAtMexico: snapshot.capturedAtMexico,
    sourceProvenance: snapshot.sourceProvenance,
    sourceDatabase: snapshot.source.database.database_name ?? "unknown",
    sourceServerVersion: snapshot.source.database.server_version ?? "unknown",
    sourceIdentity: snapshot.source.identity,
    otherClientBackendsBeforeSnapshot: snapshot.source.otherClientBackendsBeforeSnapshot,
    authorization: {
      file: APPROVAL,
      sha256: APPROVAL_SHA256,
      exactHashMatched: true,
      e2ClosedTextRequired: true,
      drivePrerequisiteTextRequired: true,
    },
    invocation: snapshot.sourceProvenance.invocation,
    operatorDiffFromOriginal: snapshot.sourceProvenance.operatorDiffFromOriginal,
    metadataPath,
    restore: metadata,
    comparison,
    sourceMutationPolicy: {
      sourceTransaction: "REPEATABLE READ READ ONLY",
      sourceWrites: false,
      preflightExecuted: false,
      purgeExecuted: false,
      driveExecuted: false,
      apiRestarted: false,
      otherClientBackendsRequiredBeforeSnapshot: 0,
      identitySeeded: false,
      restoreSuperuser: LOCAL_SUPERUSER,
      disposableClusterKeptAlive: clusterStarted,
      disposableClusterRetentionPurpose: [
        "later Drive redownload-restore comparison",
        "later B0 comparison",
      ],
      disposableClusterMustNotBePurged: true,
    },
    allTablesAndRowsIncluded: true,
    tableDataExclusions: [],
    applicationUsersCreated: 0,
    applicationSessionsCreated: 0,
    failure,
  };
  await writePrivate(metadataPath, publicMetadata);
  await writePrivate(statePath, {
    status: failure ? "FAIL" : "PASS",
    stage: failure ? "stopped after failure" : "completed verified local restore",
    exitCode: failure ? 1 : 0,
    updatedAtUtc: new Date().toISOString(),
    archive: snapshot.archive?.file ?? null,
    report: reportPath,
    restoreClusterKeptAlive: clusterStarted,
  });
  if (failure) throw new Error(failure);
  console.log(JSON.stringify({
    status: "PASS",
    dumpPath,
    dumpSha256: snapshot.archive?.sha256,
    dumpSizeBytes: snapshot.archive?.sizeBytes,
    reportPath,
    metadataPath,
    restore: metadata,
    sequenceChangedDuringDump: comparison?.sequenceChangedDuringDump,
  }, null, 2));
}

const mainModulePath = process.argv[1] ? resolve(process.argv[1]) : "";
if (mainModulePath === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    // The detailed sanitized report is written by main.  Keep process output
    // terse and never print DATABASE_URL or child process diagnostics.
    console.error(`E2 release backup failed: ${error instanceof Error ? error.message : "unknown failure"}`);
    process.exitCode = 1;
  });
}