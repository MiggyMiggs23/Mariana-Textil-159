/**
 * Phase 1 / block 1 only: create and verify a full PostgreSQL custom dump.
 *
 * This is deliberately an operator-run tool.  It never invokes application
 * code, seed, cleanup, truncate, delete, or purge logic.  The source session
 * is read-only and the only writable PostgreSQL instance used here is the
 * disposable local cluster created below for restoring the archive.
 *
 * The source transaction exports one PostgreSQL snapshot.  pg_dump imports
 * that snapshot while the source transaction remains open, and every source
 * count/catalog query is executed in that same REPEATABLE READ transaction.
 */
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  promises as fs,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import net from "node:net";
import { promisify } from "node:util";
import type { Client as PgClient, QueryResultRow } from "../../lib/db/node_modules/@types/pg";
// pg ships its runtime separately from @types/pg in this workspace.
// @ts-expect-error The runtime package intentionally has no bundled declarations.
import pgRuntime from "../../lib/db/node_modules/pg/lib/index.js";

type Row = QueryResultRow & Record<string, unknown>;
type Queryable = PgClient;
const pg = pgRuntime as unknown as { Client: typeof PgClient };

const execFileAsync = promisify(execFile);
const mexicoTimeZone = "America/Mexico_City";
const repositoryRoot = process.cwd();
const backupRoot = `${repositoryRoot}/.local/backups`;
const reportsRoot = `${repositoryRoot}/reports`;

interface TableCount {
  schema: string;
  table: string;
  relkind: string;
  count: string;
}

interface Catalogue {
  tables: Row[];
  tableCounts: TableCount[];
  columns: Row[];
  constraints: Row[];
  indexes: Row[];
  triggers: Row[];
  sequences: Row[];
  serialSequence: Row | null;
  triggerForeignKeys: Row[];
  foreignKeyCycles: string[][];
  database: Row;
}

interface Snapshot {
  capturedAtUtc: string;
  capturedAtMexico: string;
  commit: string;
  database: Row;
  roles: string[];
  catalogue: Catalogue;
  archive?: {
    file: string;
    sha256: string;
    sizeBytes: number;
    format: "custom";
    includesAcl: true;
    includesOwnership: true;
  };
}

interface MinimumEvidence {
  stock_minimos: Row[];
  stock_minimo_sitios: Row[];
  counts: {
    stock_minimos: number;
    stock_minimo_sitios: number;
    active_sites: number;
  };
}

interface ComparisonCategory {
  sourceCount: number;
  restoredCount: number;
  mismatches: string[];
}

interface Comparison {
  status: "PASS" | "FAIL";
  tableCounts: {
    source: TableCount[];
    restored: TableCount[];
    mismatches: string[];
  };
  categories: Record<string, ComparisonCategory>;
  database: {
    source: Row;
    restored: Row;
    mismatch: boolean;
  };
  sourceCatalogue: Catalogue;
  restoredCatalogue: Catalogue;
}

let activeBackupDirectory: string | undefined;
let reportPath: string | undefined;
let localClusterDirectory: string | undefined;
let localSocketDirectory: string | undefined;
let localPort: number | undefined;
let localClusterStarted = false;
let stateFilePath: string | undefined;
let currentStage = "initializing";

function progress(stage: string): void {
  currentStage = stage;
  console.error(`[respaldo-verification] ${stage}`);
}

async function writeState(extra: Record<string, unknown> = {}): Promise<void> {
  if (!stateFilePath) return;
  await writePrivateJson(stateFilePath, {
    status: "RUNNING",
    phase: 1,
    block: 1,
    stage: currentStage,
    exitCode: null,
    updatedAtUtc: new Date().toISOString(),
    ...extra,
  });
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteQualified(schema: string, relation: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(relation)}`;
}

function jsonWrite(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, jsonWrite(value), { encoding: "utf8", mode: 0o600 });
  await fs.chmod(path, 0o600);
}

function localTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: mexicoTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function localDateAndTime(date: Date): { date: string; time: string } {
  const value = localTimestamp(date);
  const [datePart, timePart] = value.split(" ");
  return { date: datePart, time: timePart.replaceAll(":", "") };
}

function safeCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Could not record the current git commit.");
  }
}

function pgBinary(name: string): string {
  try {
    return execFileSync("sh", ["-c", `command -v ${name}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(`Required PostgreSQL binary is unavailable: ${name}.`);
  }
}

function sourceConnectionString(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

function sourceConnectionParts(connectionString: string): {
  host: string;
  port: string;
  user: string;
  database: string;
  password?: string;
  sslMode?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres", "postgresql"].includes(parsed.protocol.replace(":", ""))) {
    throw new Error("DATABASE_URL is not a PostgreSQL URL.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const user = decodeURIComponent(parsed.username);
  const host = parsed.hostname;
  if (!database || !user || !host) {
    throw new Error("DATABASE_URL does not contain a complete PostgreSQL target.");
  }
  return {
    host,
    port: parsed.port || "5432",
    user,
    database,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    sslMode: parsed.searchParams.get("sslmode") ?? undefined,
  };
}

function escapePgPass(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
}

function commandEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "APPLICATION_DATABASE_URL",
    "TEST_DATABASE_URL",
    "PGPASSWORD",
    "PGPASSFILE",
  ]) {
    delete environment[key];
  }
  return environment;
}

async function runCommand(
  label: string,
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    timeout?: number;
  } = {},
): Promise<void> {
  try {
    await execFileAsync(command, args, {
      cwd: repositoryRoot,
      env: options.env ?? commandEnvironment(),
      maxBuffer: 16 * 1024 * 1024,
      timeout: options.timeout ?? 30 * 60 * 1000,
      windowsHide: true,
    });
  } catch {
    // Do not surface command lines or stderr: pg_dump/restore diagnostics can
    // contain connection details, object names, or other sensitive material.
    throw new Error(`${label} failed.`);
  }
}

async function runCommandCapture(
  label: string,
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    timeout?: number;
  } = {},
): Promise<string> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: repositoryRoot,
      env: options.env ?? commandEnvironment(),
      maxBuffer: 16 * 1024 * 1024,
      timeout: options.timeout ?? 30 * 60 * 1000,
      windowsHide: true,
    });
    return result.stdout;
  } catch {
    throw new Error(`${label} failed.`);
  }
}

async function queryRows<T extends Row>(
  client: Queryable,
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

async function queryOne<T extends Row>(
  client: Queryable,
  text: string,
  values: unknown[] = [],
  label = "PostgreSQL query",
): Promise<T> {
  const result = await queryRows<T>(client, text, values, label);
  if (!result[0]) throw new Error(`${label} returned no row.`);
  return result[0];
}

function tableKey(row: { schema: unknown; table: unknown }): string {
  return `${String(row.schema)}.${String(row.table)}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sortedRows(rows: Row[], omittedKeys: string[] = []): Row[] {
  return rows
    .map((row) => {
      const copy = { ...row };
      for (const key of omittedKeys) delete copy[key];
      return copy;
    })
    .sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
}

function rowMismatchKeys(
  sourceRows: Row[],
  restoredRows: Row[],
  omittedKeys: string[] = [],
  keyFields: string[] = [],
): string[] {
  const source = sortedRows(sourceRows, omittedKeys).map(stableJson);
  const restored = sortedRows(restoredRows, omittedKeys).map(stableJson);
  if (source.length === restored.length && source.every((row, i) => row === restored[i])) {
    return [];
  }
  const sourceSet = new Set(source);
  const restoredSet = new Set(restored);
  const keys: string[] = [];
  for (const row of sourceRows) {
    const normalized = stableJson(
      Object.fromEntries(
        Object.entries(row).filter(([key]) => !omittedKeys.includes(key)),
      ),
    );
    if (!restoredSet.has(normalized)) {
      keys.push(
        keyFields.length
          ? keyFields.map((field) => String(row[field] ?? "")).join(".")
          : normalized.slice(0, 200),
      );
    }
  }
  for (const row of restoredRows) {
    const normalized = stableJson(
      Object.fromEntries(
        Object.entries(row).filter(([key]) => !omittedKeys.includes(key)),
      ),
    );
    if (!sourceSet.has(normalized)) {
      keys.push(
        `restored:${keyFields.length ? keyFields.map((field) => String(row[field] ?? "")).join(".") : normalized.slice(0, 200)}`,
      );
    }
  }
  return [...new Set(keys)].sort();
}

function foreignKeyCycles(constraints: Row[]): string[][] {
  const foreignKeys = constraints.filter((row) => row.constraint_type === "FOREIGN KEY");
  const graph = new Map<string, Set<string>>();
  for (const row of foreignKeys) {
    const from = tableKey(row as { schema: string; table: string });
    const to = `${String(row.referenced_schema)}.${String(row.referenced_table)}`;
    if (!graph.has(from)) graph.set(from, new Set());
    if (!graph.has(to)) graph.set(to, new Set());
    graph.get(from)?.add(to);
  }

  const indexByNode = new Map<string, number>();
  const lowByNode = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let nextIndex = 0;

  const visit = (node: string): void => {
    indexByNode.set(node, nextIndex);
    lowByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const target of graph.get(node) ?? []) {
      if (!indexByNode.has(target)) {
        visit(target);
        lowByNode.set(
          node,
          Math.min(lowByNode.get(node) ?? Number.MAX_SAFE_INTEGER, lowByNode.get(target) ?? 0),
        );
      } else if (onStack.has(target)) {
        lowByNode.set(
          node,
          Math.min(lowByNode.get(node) ?? Number.MAX_SAFE_INTEGER, indexByNode.get(target) ?? 0),
        );
      }
    }
    if (lowByNode.get(node) === indexByNode.get(node)) {
      const component: string[] = [];
      let current: string | undefined;
      do {
        current = stack.pop();
        if (!current) break;
        onStack.delete(current);
        component.push(current);
      } while (current !== node);
      const hasSelfLoop = component.length === 1 && (graph.get(component[0])?.has(component[0]) ?? false);
      if (component.length > 1 || hasSelfLoop) components.push(component.sort());
    }
  };

  for (const node of graph.keys()) {
    if (!indexByNode.has(node)) visit(node);
  }
  return components.sort((a, b) => a.join("|").localeCompare(b.join("|")));
}

async function readCatalogue(client: Queryable): Promise<Catalogue> {
  const tables = await queryRows(
    client,
    `
      SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind,
             pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname
    `,
    [],
    "Reading user tables",
  );

  const tableCounts: TableCount[] = [];
  for (const table of tables) {
    const schema = String(table.schema);
    const relation = String(table.table);
    const count = await queryOne(
      client,
      `SELECT count(*)::text AS count FROM ${quoteQualified(schema, relation)}`,
      [],
      `Counting ${schema}.${relation}`,
    );
    tableCounts.push({
      schema,
      table: relation,
      relkind: String(table.relkind),
      count: String(count.count),
    });
  }

  const columns = await queryRows(
    client,
    `
      SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
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
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname, a.attnum
    `,
    [],
    "Reading table columns",
  );

  const constraints = await queryRows(
    client,
    `
      SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
             CASE con.contype
               WHEN 'c' THEN 'CHECK'
               WHEN 'f' THEN 'FOREIGN KEY'
               WHEN 'p' THEN 'PRIMARY KEY'
               WHEN 'u' THEN 'UNIQUE'
               WHEN 'x' THEN 'EXCLUSION'
               ELSE con.contype::text
             END AS constraint_type,
             pg_get_constraintdef(con.oid, true) AS definition,
             con.convalidated AS validated, con.condeferrable AS deferrable,
             con.condeferred AS initially_deferred,
             rn.nspname AS referenced_schema, rc.relname AS referenced_table,
             CASE con.confupdtype
               WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
               WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
               WHEN 'd' THEN 'SET DEFAULT' ELSE NULL
             END AS update_action,
             CASE con.confdeltype
               WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
               WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
               WHEN 'd' THEN 'SET DEFAULT' ELSE NULL
             END AS delete_action,
             CASE con.confmatchtype
               WHEN 'f' THEN 'FULL' WHEN 'p' THEN 'PARTIAL'
               WHEN 's' THEN 'SIMPLE' ELSE NULL
             END AS match_type
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_class rc ON rc.oid = con.confrelid
      LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE con.contype IN ('c', 'f', 'p', 'u', 'x')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname, con.conname
    `,
    [],
    "Reading constraints",
  );

  const indexes = await queryRows(
    client,
    `
      SELECT tn.nspname AS schema, tc.relname AS table, i.relname AS index_name,
             pg_get_indexdef(i.oid) AS definition,
             x.indisunique AS is_unique, x.indisprimary AS is_primary,
             x.indisexclusion AS is_exclusion, x.indisvalid AS is_valid,
             x.indisready AS is_ready, x.indislive AS is_live,
             pg_get_expr(x.indpred, x.indrelid) AS predicate,
             pg_get_expr(x.indexprs, x.indrelid) AS expressions
      FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_class tc ON tc.oid = x.indrelid
      JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE tc.relkind IN ('r', 'p', 'f')
        AND tn.nspname NOT IN ('pg_catalog', 'information_schema')
        AND tn.nspname NOT LIKE 'pg_%'
      ORDER BY tn.nspname, tc.relname, i.relname
    `,
    [],
    "Reading indexes",
  );

  const triggers = await queryRows(
    client,
    `
      SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger_name,
             pg_get_triggerdef(t.oid, true) AS definition, t.tgenabled AS enabled,
             pn.nspname AS function_schema, p.proname AS function_name,
             pg_get_function_identity_arguments(p.oid) AS function_arguments,
             pg_get_functiondef(p.oid) AS function_definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace pn ON pn.oid = p.pronamespace
      WHERE NOT t.tgisinternal
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname, t.tgname
    `,
    [],
    "Reading triggers and trigger functions",
  );

  const sequences = await queryRows(
    client,
    `
      SELECT schemaname AS schema, sequencename AS sequence_name, data_type,
             start_value, min_value, max_value, increment_by, cycle,
             cache_size, last_value
      FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname NOT LIKE 'pg_%'
      ORDER BY schemaname, sequencename
    `,
    [],
    "Reading sequences",
  );

  const serialSequence = await queryOne(
    client,
    `SELECT pg_get_serial_sequence('public.contenedores', 'folio') AS sequence_name`,
    [],
    "Resolving public.contenedores.folio sequence",
  );
  const resolvedSequence = serialSequence.sequence_name
    ? sequences.find(
        (sequence) =>
          `${String(sequence.schema)}.${String(sequence.sequence_name)}` ===
          String(serialSequence.sequence_name),
      ) ?? null
    : null;

  const database = await queryOne(
    client,
    `
      SELECT current_database() AS database_name,
             current_user AS current_user,
             pg_get_userbyid(d.datdba) AS owner,
             d.datacl::text AS acl,
             pg_size_pretty(pg_database_size(d.datname)) AS size_pretty,
             pg_database_size(d.datname)::text AS size_bytes,
             current_setting('server_version') AS server_version,
             current_setting('server_version_num') AS server_version_num
      FROM pg_database d
      WHERE d.datname = current_database()
    `,
    [],
    "Reading source database metadata",
  );

  const triggerForeignKeys = constraints.filter(
    (constraint) => constraint.constraint_type === "FOREIGN KEY",
  );
  return {
    tables,
    tableCounts,
    columns,
    constraints,
    indexes,
    triggers,
    sequences,
    serialSequence: resolvedSequence
      ? { ...serialSequence, metadata: resolvedSequence }
      : serialSequence,
    triggerForeignKeys,
    foreignKeyCycles: foreignKeyCycles(constraints),
    database,
  };
}

function makePgDumpEnvironment(
  parts: ReturnType<typeof sourceConnectionParts>,
  passFile?: string,
): NodeJS.ProcessEnv {
  const environment = commandEnvironment();
  environment.PGHOST = parts.host;
  environment.PGPORT = parts.port;
  environment.PGUSER = parts.user;
  environment.PGDATABASE = parts.database;
  if (parts.sslMode) environment.PGSSLMODE = parts.sslMode;
  if (passFile) environment.PGPASSFILE = passFile;
  return environment;
}

async function createPassFile(
  directory: string,
  parts: ReturnType<typeof sourceConnectionParts>,
): Promise<string | undefined> {
  if (parts.password === undefined) return undefined;
  const path = `${directory}/.pgpass`;
  const line = `*:*:*:${escapePgPass(parts.user)}:${escapePgPass(parts.password)}\n`;
  await fs.writeFile(path, line, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(path, 0o600);
  return path;
}

async function freeTcpPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local PostgreSQL port."));
        return;
      }
      server.close((error) => {
        if (error) reject(new Error("Could not release the local PostgreSQL port."));
        else resolve(address.port);
      });
    });
  });
}

async function createDisposableCluster(
  directory: string,
  socketDirectory: string,
  port: number,
  superuser: string,
): Promise<void> {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  mkdirSync(socketDirectory, { recursive: true, mode: 0o700 });
  chmodSync(socketDirectory, 0o700);
  const logFile = `${directory}/postgres.log`;
  await runCommand(
    "initdb",
    pgBinary("initdb"),
    [
      "--pgdata",
      directory,
      "--username",
      superuser,
      "--auth-local",
      "trust",
      "--auth-host",
      "trust",
      "--no-locale",
      "--encoding",
      "UTF8",
    ],
    { timeout: 10 * 60 * 1000 },
  );
  await runCommand(
    "pg_ctl start",
    pgBinary("pg_ctl"),
    [
      "--pgdata",
      directory,
      "--wait",
      "--timeout=120",
      "--log",
      logFile,
      "--options",
      `-p ${port} -k ${socketDirectory} -h 127.0.0.1`,
      "start",
    ],
    { timeout: 5 * 60 * 1000 },
  );
  await fs.chmod(logFile, 0o600).catch(() => undefined);
  localClusterStarted = true;
}

function localConnectionString(
  host: string,
  port: number,
  database: string,
  user = "runner",
): string {
  return `postgresql://${encodeURIComponent(user)}@${host}:${port}/${encodeURIComponent(database)}`;
}

async function connectLocal(
  connectionString: string,
  label: string,
  readOnly = false,
): Promise<PgClient> {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    if (readOnly) {
      await client.query("SET default_transaction_read_only = on");
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const status = await client.query<{ transaction_read_only: string }>(
        "SHOW transaction_read_only",
      );
      if (status.rows[0]?.transaction_read_only !== "on") {
        throw new Error("Local comparison transaction is not read-only.");
      }
    }
    return client;
  } catch {
    await client.end().catch(() => undefined);
    throw new Error(`${label} connection failed.`);
  }
}

async function createRestoreRoles(
  adminClient: PgClient,
  sourceRoles: string[],
  superuser: string,
): Promise<void> {
  const existingRows = await queryRows<{ rolname: string }>(
    adminClient,
    "SELECT rolname FROM pg_roles",
    [],
    "Reading disposable roles",
  );
  const existing = new Set(existingRows.map((row) => row.rolname));
  for (const role of sourceRoles) {
    if (role === "public" || existing.has(role)) continue;
    await queryRows(
      adminClient,
      `CREATE ROLE ${quoteIdentifier(role)}
         NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOLOGIN
         NOREPLICATION NOBYPASSRLS`,
      [],
      `Creating disposable role ${role}`,
    );
    existing.add(role);
  }
  if (!existing.has(superuser)) {
    throw new Error("The disposable PostgreSQL superuser was not created.");
  }
}

async function renameDatabase(
  adminClient: PgClient,
  from: string,
  to: string,
): Promise<void> {
  await queryRows(
    adminClient,
    `ALTER DATABASE ${quoteIdentifier(from)} RENAME TO ${quoteIdentifier(to)}`,
    [],
    "Renaming restored disposable database",
  );
}

async function sha256AndSize(path: string): Promise<{ sha256: string; sizeBytes: number }> {
  const hash = createHash("sha256");
  const content = await fs.readFile(path);
  hash.update(content);
  return { sha256: hash.digest("hex"), sizeBytes: content.byteLength };
}

function privateMinimumRow(row: Row): Row {
  const author =
    row.updated_by === null || row.updated_by === undefined
      ? null
      : Number(row.updated_by);
  return {
    id: Number(row.id),
    producto_id: Number(row.producto_id),
    ubicacion_id: Number(row.ubicacion_id),
    cantidad: String(row.cantidad),
    updated_by: Number.isInteger(author) ? author : null,
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at === null || row.updated_at === undefined
          ? null
          : String(row.updated_at),
  };
}

function privateSiteRow(row: Row): Row {
  const author =
    row.updated_by === null || row.updated_by === undefined
      ? null
      : Number(row.updated_by);
  return {
    ubicacion_id: Number(row.ubicacion_id),
    habilitado: Boolean(row.habilitado),
    updated_by: Number.isInteger(author) ? author : null,
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at === null || row.updated_at === undefined
          ? null
          : String(row.updated_at),
  };
}

async function readMinimumEvidence(client: Queryable): Promise<MinimumEvidence> {
  const stockMinimos = (
    await queryRows(
      client,
      `
        SELECT id, producto_id, ubicacion_id, cantidad::text AS cantidad,
               updated_by, updated_at
        FROM public.stock_minimos
        ORDER BY producto_id, ubicacion_id, id
      `,
      [],
      "Reading source minimum values",
    )
  ).map(privateMinimumRow);
  const stockMinimoSitios = (
    await queryRows(
      client,
      `
        SELECT ubicacion_id, habilitado, updated_by, updated_at
        FROM public.stock_minimo_sitios
        ORDER BY ubicacion_id
      `,
      [],
      "Reading source minimum-site switches",
    )
  ).map(privateSiteRow);
  const activeSites = stockMinimoSitios.filter((row) => row.habilitado === true).length;
  if (stockMinimos.length === 0 || stockMinimoSitios.length === 0) {
    throw new Error(
      "Source minimum evidence is empty: populated stock_minimos and site switches are required (switches may be on or off).",
    );
  }
  return {
    stock_minimos: stockMinimos,
    stock_minimo_sitios: stockMinimoSitios,
    counts: {
      stock_minimos: stockMinimos.length,
      stock_minimo_sitios: stockMinimoSitios.length,
      active_sites: activeSites,
    },
  };
}

async function restoreAndCompare(
  sourceSnapshot: Snapshot,
  dumpPath: string,
  backupDirectory: string,
  stamp: string,
): Promise<{
  comparison: Comparison;
  restoreMetadata: Row;
}> {
  const sourceDatabase = String(sourceSnapshot.database.database_name);
  const restoreDatabase = `restore_disposable_${stamp}`;
  let adminDatabase = `restore_admin_${stamp}`;
  if (adminDatabase === sourceDatabase) adminDatabase = `${adminDatabase}_ctl`;
  const socketDirectory = `/tmp/respaldo-purge-${stamp}-${process.pid}`;
  const clusterDirectory = `${backupDirectory}/restore-cluster-verified`;
  if (existsSync(clusterDirectory)) {
    throw new Error("A verified disposable cluster directory already exists for this backup.");
  }
  const superuser = process.env.USER || "runner";
  localClusterDirectory = clusterDirectory;
  localSocketDirectory = socketDirectory;
  localPort = await freeTcpPort();
  progress("creating disposable PostgreSQL 16 cluster");
  await writeState({ stage: currentStage });
  await createDisposableCluster(clusterDirectory, socketDirectory, localPort, superuser);

  // Connect through template1: PostgreSQL refuses ALTER DATABASE postgres while
  // the session itself is connected to postgres.
  const initialAdminUrl = localConnectionString("127.0.0.1", localPort, "template1", superuser);
  const initialAdmin = await connectLocal(
    initialAdminUrl,
    "Disposable initial admin",
    false,
  );
  try {
    await renameDatabase(initialAdmin, "postgres", adminDatabase);
  } finally {
    await initialAdmin.end().catch(() => undefined);
  }

  const adminUrl = localConnectionString("127.0.0.1", localPort, adminDatabase, superuser);
  const adminClient = await connectLocal(adminUrl, "Disposable admin", false);
  try {
    progress("creating disposable NOLOGIN roles required by archive");
    await writeState({ stage: currentStage });
    await createRestoreRoles(adminClient, sourceSnapshot.roles, superuser);
  } finally {
    await adminClient.end().catch(() => undefined);
  }

  const restoreAdminUrl = localConnectionString(
    "127.0.0.1",
    localPort,
    adminDatabase,
    superuser,
  );
  await runCommand(
    "pg_restore",
    pgBinary("pg_restore"),
    [
      "--create",
      "--exit-on-error",
      "--dbname",
      restoreAdminUrl,
      dumpPath,
    ],
    { timeout: 60 * 60 * 1000 },
  );
  progress("custom archive restore completed");
  await writeState({ stage: currentStage });

  const renameClient = await connectLocal(restoreAdminUrl, "Disposable rename admin", false);
  try {
    await renameDatabase(renameClient, sourceDatabase, restoreDatabase);
  } finally {
    await renameClient.end().catch(() => undefined);
  }

  const restoredUrl = localConnectionString(
    "127.0.0.1",
    localPort,
    restoreDatabase,
    superuser,
  );
  const restoredClient = await connectLocal(restoredUrl, "Restored disposable database", true);
  let restoredCatalogue: Catalogue;
  try {
    progress("capturing restored counts and catalogs");
    await writeState({ stage: currentStage });
    restoredCatalogue = await readCatalogue(restoredClient);
    await restoredClient.query("COMMIT");
  } finally {
    await restoredClient.end().catch(() => undefined);
  }

  const sourceCatalogue = sourceSnapshot.catalogue;
  const restoredCounts = restoredCatalogue.tableCounts;
  const sourceCounts = sourceCatalogue.tableCounts;
  const sourceCountMap = new Map(sourceCounts.map((row) => [tableKey(row), row]));
  const restoredCountMap = new Map(restoredCounts.map((row) => [tableKey(row), row]));
  const countMismatches: string[] = [];
  for (const key of new Set([...sourceCountMap.keys(), ...restoredCountMap.keys()])) {
    const source = sourceCountMap.get(key);
    const restored = restoredCountMap.get(key);
    if (!source || !restored || source.count !== restored.count || source.relkind !== restored.relkind) {
      countMismatches.push(key);
    }
  }
  countMismatches.sort();

  const categories: Record<string, ComparisonCategory> = {};
  const compareCategory = (
    name: string,
    source: Row[],
    restored: Row[],
    omittedKeys: string[] = [],
    keyFields: string[] = [],
  ): void => {
    categories[name] = {
      sourceCount: source.length,
      restoredCount: restored.length,
      mismatches: rowMismatchKeys(source, restored, omittedKeys, keyFields),
    };
  };
  compareCategory("tables", sourceCatalogue.tables, restoredCatalogue.tables, [], ["schema", "table"]);
  compareCategory(
    "columns",
    sourceCatalogue.columns,
    restoredCatalogue.columns,
    ["ordinal_position"],
    ["schema", "table", "column"],
  );
  compareCategory(
    "constraints",
    sourceCatalogue.constraints,
    restoredCatalogue.constraints,
    [],
    ["schema", "table", "name"],
  );
  compareCategory(
    "indexes",
    sourceCatalogue.indexes,
    restoredCatalogue.indexes,
    [],
    ["schema", "table", "index_name"],
  );
  compareCategory(
    "triggers",
    sourceCatalogue.triggers,
    restoredCatalogue.triggers,
    [],
    ["schema", "table", "trigger_name"],
  );
  compareCategory(
    "sequences",
    sourceCatalogue.sequences,
    restoredCatalogue.sequences,
    [],
    ["schema", "sequence_name"],
  );
  compareCategory(
    "foreign_key_edges",
    sourceCatalogue.triggerForeignKeys,
    restoredCatalogue.triggerForeignKeys,
    [],
    ["schema", "table", "name"],
  );
  const sourceSerial = sourceCatalogue.serialSequence;
  const restoredSerial = restoredCatalogue.serialSequence;
  const serialMismatch =
    stableJson(sourceSerial) !== stableJson(restoredSerial) ? ["public.contenedores.folio"] : [];
  categories.serial_sequence = {
    sourceCount: sourceSerial ? 1 : 0,
    restoredCount: restoredSerial ? 1 : 0,
    mismatches: serialMismatch,
  };
  const sourceCycles = sourceCatalogue.foreignKeyCycles.map((cycle) => cycle.join("|")).sort();
  const restoredCycles = restoredCatalogue.foreignKeyCycles.map((cycle) => cycle.join("|")).sort();
  categories.foreign_key_cycles = {
    sourceCount: sourceCycles.length,
    restoredCount: restoredCycles.length,
    mismatches:
      sourceCycles.length === restoredCycles.length &&
      sourceCycles.every((cycle, index) => cycle === restoredCycles[index])
        ? []
        : [...new Set([...sourceCycles, ...restoredCycles])],
  };

  const databaseSemantic = (database: Row): Row => ({
    owner: database.owner,
    acl: database.acl,
  });
  const databaseMismatch =
    stableJson(databaseSemantic(sourceCatalogue.database)) !==
    stableJson(databaseSemantic(restoredCatalogue.database));
  const failed =
    countMismatches.length > 0 ||
    databaseMismatch ||
    Object.values(categories).some((category) => category.mismatches.length > 0);
  const comparison: Comparison = {
    status: failed ? "FAIL" : "PASS",
    tableCounts: {
      source: sourceCounts,
      restored: restoredCounts,
      mismatches: countMismatches,
    },
    categories,
    database: {
      source: sourceCatalogue.database,
      restored: restoredCatalogue.database,
      mismatch: databaseMismatch,
    },
    sourceCatalogue,
    restoredCatalogue,
  };
  progress(`semantic comparison completed: ${comparison.status}`);
  await writeState({ stage: currentStage });

  const restoreMetadata: Row = {
    cluster_directory: clusterDirectory,
    socket_directory: socketDirectory,
    port: localPort,
    database: restoreDatabase,
    admin_database: adminDatabase,
    admin_url: adminUrl,
    restored_database_url: restoredUrl,
    postgres_binary_directory: pgBinary("pg_ctl").replace(/\/bin\/pg_ctl$/, ""),
    source_database_name: sourceDatabase,
    source_database_owner: sourceCatalogue.database.owner,
    restored_database_owner: restoredCatalogue.database.owner,
  };
  await writePrivateJson(`${backupDirectory}/restore-metadata.json`, restoreMetadata);
  return { comparison, restoreMetadata };
}

function sanitizedReport(
  snapshot: Snapshot,
  comparison: Comparison,
  restoreMetadata: Row,
  paths: {
    backupDirectory: string;
    dumpPath: string;
    sourceSnapshotPath: string;
    sourceMinimumPath: string;
    comparisonPath: string;
    manifestPath: string;
  },
): Row {
  const summary = Object.fromEntries(
    Object.entries(comparison.categories).map(([name, category]) => [
      name,
      {
        sourceCount: category.sourceCount,
        restoredCount: category.restoredCount,
        mismatchCount: category.mismatches.length,
        mismatchKeys: category.mismatches,
      },
    ]),
  );
  return {
    status: comparison.status,
    phase: 1,
    block: 1,
    operation: "full custom pg_dump, disposable restore, semantic verification",
    warning: "Sanitized report: no live row data, dump content, URI, or credentials.",
    backup: {
      directory: paths.backupDirectory,
      archive: paths.dumpPath,
      sha256: snapshot.archive?.sha256,
      sizeBytes: snapshot.archive?.sizeBytes,
      format: "custom",
      includesAcl: true,
      includesOwnership: true,
    },
    commit: snapshot.commit,
    capturedAtUtc: snapshot.capturedAtUtc,
    capturedAtMexico: snapshot.capturedAtMexico,
    sourceDatabase: {
      name: snapshot.database.database_name,
      serverVersion: snapshot.database.server_version,
      sourceDatabaseSizeBytes: snapshot.database.size_bytes,
    },
    tableCountsCompared: comparison.tableCounts.source.length,
    tableCountMismatches: comparison.tableCounts.mismatches,
    tableCounts: comparison.tableCounts.source.map((source) => ({
      schema: source.schema,
      table: source.table,
      source: source.count,
      restored:
        comparison.tableCounts.restored.find((row) => tableKey(row) === tableKey(source))?.count ??
        null,
    })),
    catalogueSummary: {
      source: {
        tables: snapshot.catalogue.tables.length,
        columns: snapshot.catalogue.columns.length,
        constraints: snapshot.catalogue.constraints.length,
        foreignKeys: snapshot.catalogue.triggerForeignKeys.length,
        foreignKeyCycles: snapshot.catalogue.foreignKeyCycles.length,
        indexes: snapshot.catalogue.indexes.length,
        triggers: snapshot.catalogue.triggers.length,
        triggerFunctionsWithDefinitions: new Set(
          snapshot.catalogue.triggers.map(
            (trigger) =>
              `${trigger.function_schema}.${trigger.function_name}(${trigger.function_arguments})`,
          ),
        ).size,
        sequences: snapshot.catalogue.sequences.length,
      },
      restored: {
        tables: comparison.restoredCatalogue.tables.length,
        columns: comparison.restoredCatalogue.columns.length,
        constraints: comparison.restoredCatalogue.constraints.length,
        foreignKeys: comparison.restoredCatalogue.triggerForeignKeys.length,
        foreignKeyCycles: comparison.restoredCatalogue.foreignKeyCycles.length,
        indexes: comparison.restoredCatalogue.indexes.length,
        triggers: comparison.restoredCatalogue.triggers.length,
        triggerFunctionsWithDefinitions: new Set(
          comparison.restoredCatalogue.triggers.map(
            (trigger) =>
              `${trigger.function_schema}.${trigger.function_name}(${trigger.function_arguments})`,
          ),
        ).size,
        sequences: comparison.restoredCatalogue.sequences.length,
      },
    },
    categoryComparisons: summary,
    databaseMetadataMatch: !comparison.database.mismatch,
    restored: {
      clusterDirectory: restoreMetadata.cluster_directory,
      socketDirectory: restoreMetadata.socket_directory,
      port: restoreMetadata.port,
      database: restoreMetadata.database,
      adminDatabase: restoreMetadata.admin_database,
      adminUrl: restoreMetadata.admin_url,
      restoredDatabaseUrl: restoreMetadata.restored_database_url,
    },
    machineReadableFiles: {
      sourceSnapshot: paths.sourceSnapshotPath,
      sourceMinimumEvidence: paths.sourceMinimumPath,
      restoreComparison: paths.comparisonPath,
      manifest: paths.manifestPath,
    },
  };
}

async function main(): Promise<void> {
  const captured = new Date();
  const { date: localDate, time: localTime } = localDateAndTime(captured);
  const resumeDirectory = process.env.RESUME_BACKUP_DIRECTORY?.trim() || undefined;
  const resumeBase = resumeDirectory?.split("/").pop();
  if (
    resumeDirectory &&
    (!resumeBase?.startsWith("respaldo-antes-de-purga-") ||
      !resumeDirectory.startsWith(`${backupRoot}/`))
  ) {
    throw new Error("RESUME_BACKUP_DIRECTORY must identify an existing private backup directory.");
  }
  const stamp = resumeBase
    ? resumeBase.replace(/^respaldo-antes-de-purga-/, "")
    : `${localDate}-${localTime}`;
  const backupDirectory =
    resumeDirectory ?? `${backupRoot}/respaldo-antes-de-purga-${stamp}`;
  activeBackupDirectory = backupDirectory;
  reportPath =
    process.env.BACKUP_REPORT_PATH?.trim() ||
    `${reportsRoot}/respaldo-preflight-${stamp}.json`;
  const dumpPath = resumeDirectory
    ? `${backupDirectory}/${readdirSync(backupDirectory).find((file) => file.endsWith(".dump")) ?? ""}`
    : `${backupDirectory}/respaldo-antes-de-purga-${stamp}.dump`;
  const sourceSnapshotPath = `${backupDirectory}/source-snapshot.json`;
  const sourceMinimumPath = `${backupDirectory}/source-minimums.json`;
  const comparisonPath = `${backupDirectory}/restore-comparison.json`;
  const manifestPath = `${backupDirectory}/manifest.json`;
  stateFilePath = `${backupDirectory}/state.json`;
  mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  if (!resumeDirectory && existsSync(backupDirectory) && readdirSync(backupDirectory).length > 0) {
    throw new Error("A backup directory already exists for this capture timestamp.");
  }
  if (!resumeDirectory) mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  if (!existsSync(backupDirectory)) {
    throw new Error("The requested backup directory does not exist.");
  }
  chmodSync(backupDirectory, 0o700);
  if (resumeDirectory && (!dumpPath.endsWith(".dump") || !existsSync(dumpPath))) {
    throw new Error("The requested backup directory does not contain a custom dump.");
  }
  await writeState({
    stage: resumeDirectory ? "resuming existing dump restore" : currentStage,
    resumed: Boolean(resumeDirectory),
  });

  let commit = safeCommit();
  let sourceTransactionOpen = false;
  let sourceSnapshot: Snapshot | undefined;
  let passFile: string | undefined;
  try {
    if (resumeDirectory) {
      try {
        sourceSnapshot = JSON.parse(readFileSync(sourceSnapshotPath, "utf8")) as Snapshot;
      } catch {
        throw new Error("The existing source snapshot file could not be read.");
      }
      if (!sourceSnapshot.archive) {
        throw new Error("The existing source snapshot has no archive metadata.");
      }
      commit = sourceSnapshot.commit;
      const archive = await sha256AndSize(dumpPath);
      if (
        archive.sha256 !== sourceSnapshot.archive.sha256 ||
        archive.sizeBytes !== sourceSnapshot.archive.sizeBytes
      ) {
        throw new Error("The existing custom dump checksum or size does not match its snapshot.");
      }
      const archiveList = await runCommandCapture(
        "pg_restore archive verification",
        pgBinary("pg_restore"),
        ["--list", dumpPath],
      );
      if (!archiveList.trim() || archiveList.split("\n").filter(Boolean).length < 2) {
        throw new Error("The existing custom archive has no verifiable TOC entries.");
      }
      progress("resuming restore from existing verified custom dump");
      await writeState({ stage: currentStage, resumed: true });
    } else {
      const sourceUrl = sourceConnectionString();
      const parts = sourceConnectionParts(sourceUrl);
      const source = new pg.Client({ connectionString: sourceUrl });
      try {
        await source.connect();
      await source.query("SET default_transaction_read_only = on");
      const defaultReadOnly = await source.query<{ default_transaction_read_only: string }>(
        "SHOW default_transaction_read_only",
      );
      if (defaultReadOnly.rows[0]?.default_transaction_read_only !== "on") {
        throw new Error("Source default_transaction_read_only was not enabled.");
      }
      await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      sourceTransactionOpen = true;
      const transactionReadOnly = await source.query<{ transaction_read_only: string }>(
        "SHOW transaction_read_only",
      );
      if (transactionReadOnly.rows[0]?.transaction_read_only !== "on") {
        throw new Error("Source transaction is not read-only.");
      }
      const exported = await source.query<{ snapshot: string }>("SELECT pg_export_snapshot() AS snapshot");
      const snapshotId = exported.rows[0]?.snapshot;
      if (!snapshotId) throw new Error("PostgreSQL did not export a snapshot.");
      const catalogue = await readCatalogue(source);
      progress(`captured source snapshot catalogs (${catalogue.tableCounts.length} tables)`);
       const minimumEvidence = await readMinimumEvidence(source);
       await writePrivateJson(sourceMinimumPath, {
         capturedAtUtc: captured.toISOString(),
         capturedAtMexico: localTimestamp(captured),
         counts: minimumEvidence.counts,
         stock_minimos: minimumEvidence.stock_minimos,
         stock_minimo_sitios: minimumEvidence.stock_minimo_sitios,
       });
      const roles = (
        await queryRows<{ rolname: string }>(
          source,
          "SELECT rolname FROM pg_roles ORDER BY rolname",
          [],
          "Reading source role names",
        )
      ).map((row) => row.rolname);
      sourceSnapshot = {
        capturedAtUtc: captured.toISOString(),
        capturedAtMexico: localTimestamp(captured),
        commit,
        database: catalogue.database,
        roles,
        catalogue,
      };

      passFile = await createPassFile(backupDirectory, parts);
      const dumpEnvironment = makePgDumpEnvironment(parts, passFile);
      await runCommand(
        "pg_dump",
        pgBinary("pg_dump"),
        [
          "--format=custom",
          "--blobs",
          "--file",
          dumpPath,
          "--snapshot",
          snapshotId,
        ],
        { env: dumpEnvironment, timeout: 60 * 60 * 1000 },
      );
      progress("custom pg_dump completed");
      await fs.chmod(dumpPath, 0o600);
      const archive = await sha256AndSize(dumpPath);
      const archiveList = await runCommandCapture(
        "pg_restore archive verification",
        pgBinary("pg_restore"),
        ["--list", dumpPath],
      );
      if (!archiveList.trim() || archiveList.split("\n").filter(Boolean).length < 2) {
        throw new Error("The custom archive has no verifiable TOC entries.");
      }
      sourceSnapshot.archive = {
        file: dumpPath,
        sha256: archive.sha256,
        sizeBytes: archive.sizeBytes,
        format: "custom",
        includesAcl: true,
        includesOwnership: true,
      };
      await writePrivateJson(sourceSnapshotPath, sourceSnapshot);
      progress("source snapshot files written");

      await source.query("COMMIT");
      sourceTransactionOpen = false;
      } catch (error) {
        if (sourceTransactionOpen) await source.query("ROLLBACK").catch(() => undefined);
        sourceTransactionOpen = false;
        if (
          error instanceof Error &&
          (error.message.includes("not enabled") ||
            error.message.includes("Source minimum evidence"))
        ) {
          throw error;
        }
        throw new Error("Source snapshot or custom dump failed.");
      } finally {
        await source.end().catch(() => undefined);
      }
    }

    if (!sourceSnapshot?.archive) throw new Error("The source snapshot archive metadata is missing.");
    const restoreResult = await restoreAndCompare(
      sourceSnapshot,
      dumpPath,
      backupDirectory,
      stamp,
    );
    await writePrivateJson(comparisonPath, restoreResult.comparison);
    if (restoreResult.comparison.status !== "PASS") {
      const failedReport = sanitizedReport(
        sourceSnapshot,
        restoreResult.comparison,
        restoreResult.restoreMetadata,
        {
          backupDirectory,
          dumpPath,
          sourceSnapshotPath,
          sourceMinimumPath,
          comparisonPath,
          manifestPath,
        },
      );
      await fs.mkdir(reportsRoot, { recursive: true });
      await writePrivateJson(reportPath, failedReport);
      throw new Error("Restored archive verification did not match the source.");
    }

    const manifest = {
      status: "PASS",
      phase: 1,
      block: 1,
      operation: "full custom pg_dump and disposable restore verification",
      commit,
      capturedAtUtc: sourceSnapshot.capturedAtUtc,
      capturedAtMexico: sourceSnapshot.capturedAtMexico,
      sourceDatabase: {
        name: sourceSnapshot.database.database_name,
        serverVersion: sourceSnapshot.database.server_version,
        sizeBytes: sourceSnapshot.database.size_bytes,
      },
      archive: sourceSnapshot.archive,
      sourceSnapshot: sourceSnapshotPath,
      sourceMinimumEvidence: sourceMinimumPath,
      restoreComparison: comparisonPath,
      restoreMetadata: `${backupDirectory}/restore-metadata.json`,
      verification: {
        tableCountsCompared: restoreResult.comparison.tableCounts.source.length,
        allTableCountsMatched: restoreResult.comparison.tableCounts.mismatches.length === 0,
        catalogueCategories: Object.fromEntries(
          Object.entries(restoreResult.comparison.categories).map(([key, value]) => [
            key,
            {
              sourceCount: value.sourceCount,
              restoredCount: value.restoredCount,
              mismatchCount: value.mismatches.length,
            },
          ]),
        ),
        databaseMetadataMatched: !restoreResult.comparison.database.mismatch,
      },
      restored: restoreResult.restoreMetadata,
      sourceMutationPolicy: {
        sourceTransaction: "REPEATABLE READ READ ONLY",
        defaultTransactionReadOnly: true,
        phase2Executed: false,
        sourceMutated: false,
      },
    };
    await writePrivateJson(manifestPath, manifest);
    await fs.mkdir(reportsRoot, { recursive: true });
    await writePrivateJson(
      reportPath,
      sanitizedReport(
        sourceSnapshot,
        restoreResult.comparison,
        restoreResult.restoreMetadata,
        {
          backupDirectory,
          dumpPath,
          sourceSnapshotPath,
          sourceMinimumPath,
          comparisonPath,
          manifestPath,
        },
      ),
    );
    currentStage = "completed verified restore";
    await writeState({
      status: "PASS",
      stage: currentStage,
      exitCode: 0,
      resumed: Boolean(resumeDirectory),
      archive: dumpPath,
      report: reportPath,
    });

    console.log(
      JSON.stringify(
        {
          status: "PASS",
          backupDirectory,
          archive: dumpPath,
          manifest: manifestPath,
          sourceSnapshot: sourceSnapshotPath,
          restoreComparison: comparisonPath,
          report: reportPath,
          commit,
          capturedAtUtc: sourceSnapshot.capturedAtUtc,
          capturedAtMexico: sourceSnapshot.capturedAtMexico,
          sourceDatabaseName: sourceSnapshot.database.database_name,
          sourceDatabaseSizeBytes: sourceSnapshot.database.size_bytes,
          tableCountsCompared: restoreResult.comparison.tableCounts.source.length,
          tableCountsMatched: true,
          catalogueSummary: {
            tables: sourceSnapshot.catalogue.tables.length,
            columns: sourceSnapshot.catalogue.columns.length,
            constraints: sourceSnapshot.catalogue.constraints.length,
            foreignKeys: sourceSnapshot.catalogue.triggerForeignKeys.length,
            foreignKeyCycles: sourceSnapshot.catalogue.foreignKeyCycles.length,
            indexes: sourceSnapshot.catalogue.indexes.length,
            triggers: sourceSnapshot.catalogue.triggers.length,
            sequences: sourceSnapshot.catalogue.sequences.length,
          },
          restore: restoreResult.restoreMetadata,
        },
        null,
        2,
      ),
    );
  } finally {
    if (passFile) await fs.rm(passFile, { force: true }).catch(() => undefined);
  }
}

await main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error.message : "Unknown backup verification failure.";
  if (reportPath) {
    await fs.mkdir(reportsRoot, { recursive: true }).catch(() => undefined);
    await writePrivateJson(reportPath, {
      status: "FAIL",
      phase: 1,
      block: 1,
      operation: "full custom pg_dump and disposable restore verification",
      backupDirectory: activeBackupDirectory ?? null,
      reason,
      sourceMutationPolicy: {
        sourceMutated: false,
        phase2Executed: false,
      },
    }).catch(() => undefined);
  }
  if (stateFilePath) {
    await writePrivateJson(stateFilePath, {
      status: "FAIL",
      phase: 1,
      block: 1,
      stage: currentStage,
      exitCode: 1,
      backupDirectory: activeBackupDirectory ?? null,
      reason,
      sourceMutated: false,
      phase2Executed: false,
      updatedAtUtc: new Date().toISOString(),
    }).catch(() => undefined);
  }
  console.error(`Backup verification failed: ${reason}`);
  if (localClusterStarted) {
    console.error("The disposable cluster was left running for inspection; no source cleanup was attempted.");
  }
  process.exitCode = 1;
});