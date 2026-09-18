/**
 * E10 one-shot operational operator.
 *
 * Import and --review are offline/file-only. The API may remain running. The
 * migration path is deliberately unreachable without fresh, hash-pinned
 * identity/evidence gates and a one-shot claim reviewed by the parent operator.
 */
import assert from "node:assert/strict";
import { execFile, fork } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SELF = fileURLToPath(import.meta.url);
const OUT = resolve(ROOT, "reports/e10-operativo-2026-09-18");
const SQL_PATH = "reports/e10-aislado-2026-09-18/sql/operativo.sql";
const IDENTITY_PATH = "reports/e10-operativo-2026-09-18/api-pool-identity.json";
const GATES_PATH = "reports/e10-operativo-2026-09-18/execution-gates.json";
const BACKUP_PATH = "reports/e10-operativo-2026-09-18/backup-restore-metadata.json";
const DRIVE_PATH = "reports/e10-operativo-2026-09-18/drive-verification.json";
const E1_ACCEPTED_PATH = "reports/e1-guardas-operativa-2026-09-18/operational-run-1789747937364-3434.json";
const E1_ACCEPTED_SHA256 = "1db49bc3252749d9ec11b74aceb1131695b2709e25f78d085e32fb48fd024a1d";
const CLAIM_PATH = resolve(OUT, "operational-run-claim.json");
const SQL_SHA256 = "a7eb52a85b3b3b6072d1b88941b9998bcafe15b253e52b0520b8bfc8cc43cdb4";
const ACK = "E10_OPERATIONAL_ONE_SHOT_MAIN_REVIEWED";
const DEADLINE_MS = 30_000;
const execFileAsync = promisify(execFile);
const IDENTITY_FIELDS = [
  "database_name", "database_oid", "database_role", "schema_name", "server_version",
  "server_address", "server_port", "server_started_at", "unix_socket_directories",
  "data_directory", "configured_port", "listen_addresses", "search_schemas",
  "replication_role", "transaction_read_only", "system_identifier",
];
const E1_FUNCTIONS = [
  "e1_guard_cash_capture_closed", "e1_guard_pending_receipts_closed",
  "e1_guard_historical_attribution_closed",
];
const E1_TRIGGERS = [
  "zz_e1_cash_capture_closed", "zz_e1_pending_receipts_closed",
  "zz_e1_historical_attribution_closed",
];
const E10_TABLES = ["fondo_arqueos", "fondo_mariana", "fondo_movimientos"];
const E10_SEQUENCE = ["fondo_movimientos_ordinal_seq"];
const E10_INDEXES = [
  "fondo_arqueos_fondo_fecha_idx", "fondo_arqueos_productor_idempotencia_uidx",
  "fondo_mariana_singleton_uidx", "fondo_mariana_ubicacion_uidx",
  "fondo_movimientos_fondo_ordinal_idx", "fondo_movimientos_ordinal_uidx",
  "fondo_movimientos_original_uidx", "fondo_movimientos_productor_idempotencia_uidx",
];
const E10_FUNCTIONS = [
  "fondo_assert_fixed_mariana", "fondo_reject_mutation",
  "fondo_validate_audit", "fondo_validate_movement",
];
const E10_TRIGGERS = [
  "fondo_arqueos_immutable_before_mutation", "fondo_arqueos_immutable_before_truncate",
  "fondo_arqueos_validate_before_insert", "fondo_mariana_fixed_before_mutation",
  "fondo_mariana_immutable_before_truncate", "fondo_movimientos_immutable_before_mutation",
  "fondo_movimientos_immutable_before_truncate", "fondo_movimientos_validate_before_insert",
];
const E10_CHECKS = [
  "fondo_arqueos_diferencia_check", "fondo_arqueos_efectivo_check",
  "fondo_arqueos_hash_check", "fondo_arqueos_motivo_check", "fondo_arqueos_productor_check",
  "fondo_mariana_nombre_check", "fondo_movimientos_categoria_check",
  "fondo_movimientos_hash_check", "fondo_movimientos_importe_check",
  "fondo_movimientos_motivo_check", "fondo_movimientos_naturaleza_check",
  "fondo_movimientos_productor_check",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const digest = (value) => sha256(canonical(value));
const safeError = (error) => ({
  code: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : null,
  message: "Operation failed; database text and parameters are intentionally suppressed.",
});
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const fileHash = async (path) => sha256(await readFile(path));
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;

/**
 * PostgreSQL lexical splitter. Returned strings are byte-for-byte slices of the
 * source (including comments and delimiters); dollar bodies, quoted strings,
 * quoted identifiers, nested block comments, and line comments are protected.
 */
export function splitExactSql(source) {
  const statements = [];
  let start = 0;
  let state = "normal";
  let dollar = "";
  let blockDepth = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === "line") {
      if (ch === "\n") state = "normal";
      continue;
    }
    if (state === "block") {
      if (ch === "/" && next === "*") { blockDepth++; i++; }
      else if (ch === "*" && next === "/") {
        blockDepth--; i++;
        if (blockDepth === 0) state = "normal";
      }
      continue;
    }
    if (state === "single") {
      if (ch === "'" && next === "'") i++;
      else if (ch === "'") state = "normal";
      continue;
    }
    if (state === "double") {
      if (ch === '"' && next === '"') i++;
      else if (ch === '"') state = "normal";
      continue;
    }
    if (state === "dollar") {
      if (source.startsWith(dollar, i)) { i += dollar.length - 1; state = "normal"; }
      continue;
    }
    if (ch === "-" && next === "-") { state = "line"; i++; continue; }
    if (ch === "/" && next === "*") { state = "block"; blockDepth = 1; i++; continue; }
    if (ch === "'") { state = "single"; continue; }
    if (ch === '"') { state = "double"; continue; }
    if (ch === "$") {
      const match = source.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollar = match[0]; state = "dollar"; i += dollar.length - 1; continue; }
    }
    if (ch === ";") {
      const exact = source.slice(start, i + 1);
      if (stripSqlComments(exact).trim()) statements.push(exact);
      start = i + 1;
    }
  }
  assert.equal(state, "normal", `Unterminated SQL lexical state: ${state}`);
  assert.equal(source.slice(start).trim(), "", "Non-whitespace SQL remains without semicolon");
  return statements;
}

function stripSqlComments(value) {
  return value.replace(/--[^\n]*(?:\n|$)/g, "\n").replace(/\/\*[\s\S]*?\*\//g, " ");
}
const commandOf = (statement) => stripSqlComments(statement).trim().match(/^([A-Za-z]+)/)?.[1]?.toUpperCase();

export function validateExactSql(source) {
  assert.equal(sha256(source), SQL_SHA256, "Immutable operativo.sql SHA-256 mismatch");
  const statements = splitExactSql(source);
  assert.equal(statements.length, 30, "Expected exactly 30 top-level statements");
  assert.equal(commandOf(statements[0]), "BEGIN");
  assert.equal(commandOf(statements.at(-1)), "COMMIT");
  assert.deepEqual(statements.map(commandOf), [
    "BEGIN", "SET", "DO", "CREATE", "CREATE", "CREATE", "INSERT", "CREATE", "CREATE",
    "ALTER", "CREATE", "CREATE", "CREATE", "CREATE", "CREATE", "CREATE", "CREATE",
    "CREATE", "CREATE", "CREATE", "CREATE", "CREATE", "CREATE", "CREATE", "CREATE",
    "CREATE", "CREATE", "CREATE", "CREATE", "COMMIT",
  ]);
  const created = {
    tables: [...source.matchAll(/^CREATE TABLE ([a-z0-9_]+) \(/gm)].map((match) => match[1]).sort(),
    sequences: [...source.matchAll(/^CREATE SEQUENCE ([a-z0-9_]+)\b/gm)].map((match) => match[1]).sort(),
    indexes: [...source.matchAll(/^CREATE (?:UNIQUE )?INDEX ([a-z0-9_]+)\b/gm)].map((match) => match[1]).sort(),
    functions: [...source.matchAll(/^CREATE (?:OR REPLACE )?FUNCTION ([a-z0-9_]+)\(/gm)].map((match) => match[1]).sort(),
    triggers: [...source.matchAll(/^CREATE TRIGGER ([a-z0-9_]+)\b/gm)].map((match) => match[1]).sort(),
    checks: [...source.matchAll(/\bCONSTRAINT ([a-z0-9_]+) CHECK\b/g)].map((match) => match[1]).sort(),
  };
  assert.deepEqual(created, {
    tables: E10_TABLES, sequences: E10_SEQUENCE, indexes: E10_INDEXES,
    functions: E10_FUNCTIONS, triggers: E10_TRIGGERS, checks: E10_CHECKS,
  }, "Generated expected catalogue differs from immutable SQL");
  assert.equal(Object.values(created).flat().length, 36);
  return statements;
}

async function sourceProvenance() {
  const runner = relative(ROOT, SELF);
  const runnerSha256 = await fileHash(SELF);
  try {
    const [{ stdout: commit }, { stdout: status }] = await Promise.all([
      execFileAsync("git", ["rev-parse", "HEAD"], { cwd: ROOT }),
      execFileAsync("git", ["status", "--porcelain=v1", "--", runner], { cwd: ROOT }),
    ]);
    const dirty = status.trim().length > 0;
    return {
      runner, runnerSha256, gitCommit: commit.trim(), workingTreeDirty: dirty,
      claim: dirty
        ? "Exact runner bytes are hash-pinned; HEAD is recorded only and is not claimed as the tested source."
        : "Exact runner bytes match the recorded clean HEAD path.",
    };
  } catch {
    return {
      runner, runnerSha256, gitCommit: null, workingTreeDirty: null,
      claim: "Git provenance unavailable; exact runner bytes remain hash-pinned.",
    };
  }
}

export function exactBackendMatches(actual, target) {
  return Number(actual.pid) === Number(target.pid)
    && String(actual.backend_start) === String(target.backend_start)
    && String(actual.database_oid) === String(target.database_oid)
    && actual.database_role === target.database_role
    && actual.application_name === target.application_name;
}

export function assertPermitBoundary({ armedAt, now, fired, target, observed }) {
  assert.equal(fired, false, "Supervisor already fired");
  assert.ok(armedAt > 0 && now - armedAt < DEADLINE_MS, "Supervisor deadline reached");
  assert.equal(exactBackendMatches(observed, target), true, "Exact supervised backend changed");
}

export function supervisorExitIsFailure(normalStopAcknowledged) {
  return !normalStopAcknowledged;
}

function connectionOptions(applicationName, readOnly) {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL unavailable");
  return {
    connectionString: process.env.DATABASE_URL,
    application_name: applicationName,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    lock_timeout: 2000,
    idle_in_transaction_session_timeout: 20000,
    query_timeout: 17000,
    options: `-c timezone=UTC -c default_transaction_read_only=${readOnly ? "on" : "off"}`,
  };
}

const OPERATIONAL_IDENTITY_SQL = `SELECT current_database() AS database_name,
  (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
  current_user AS database_role,current_schema() AS schema_name,
  current_setting('server_version') AS server_version,
  inet_server_addr()::text AS server_address,inet_server_port() AS server_port,
  pg_postmaster_start_time()::text AS server_started_at,
  current_setting('unix_socket_directories') AS unix_socket_directories,
  current_setting('data_directory') AS data_directory,current_setting('port') AS configured_port,
  current_setting('listen_addresses') AS listen_addresses,to_json(current_schemas(false)) AS search_schemas,
  current_setting('session_replication_role') AS replication_role,
  current_setting('transaction_read_only') AS transaction_read_only,pg_backend_pid() AS backend_pid,
  (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`;

async function assertIdentity(client, evidence, requireReadOnly) {
  const actual = (await client.query(OPERATIONAL_IDENTITY_SQL)).rows[0];
  assert.equal(evidence.database_name, "heliumdb");
  assert.equal(evidence.schema_name, "public");
  assert.equal(evidence.replication_role, "origin");
  for (const field of IDENTITY_FIELDS) {
    assert.ok(Object.hasOwn(evidence, field), `Missing API identity field ${field}`);
    if (field !== "transaction_read_only") assert.deepEqual(actual[field], evidence[field], `Identity mismatch ${field}`);
  }
  assert.equal(actual.transaction_read_only, requireReadOnly ? "on" : "off");
  return actual;
}

async function schemaRows(client) {
  const { rows } = await client.query(`SELECT kind,schema_name,object_name,parent_name,definition FROM (
    SELECT 'table' kind,n.nspname schema_name,c.relname object_name,'' parent_name,
      concat(c.relkind,':',pg_get_userbyid(c.relowner),':',coalesce(c.relacl::text,'')) definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p')
    UNION ALL SELECT 'column',n.nspname,c.relname,a.attname,
      concat(format_type(a.atttypid,a.atttypmod),':',a.attnotnull,':',coalesce(pg_get_expr(d.adbin,d.adrelid),''))
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p')
    UNION ALL SELECT 'constraint',n.nspname,con.conname,c.relname,pg_get_constraintdef(con.oid,true)
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    UNION ALL SELECT 'index',n.nspname,i.relname,t.relname,pg_get_indexdef(i.oid)
      FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
    UNION ALL SELECT 'function',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    UNION ALL SELECT 'trigger',n.nspname,t.tgname,c.relname,pg_get_triggerdef(t.oid,true)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE NOT t.tgisinternal
    UNION ALL SELECT 'sequence',schemaname,sequencename,'',
      concat(data_type,':',start_value,':',min_value,':',max_value,':',increment_by,':',cycle,':',cache_size)
      FROM pg_sequences
  ) q WHERE schema_name NOT IN ('pg_catalog','information_schema') AND schema_name !~ '^pg_(toast|temp)'
  ORDER BY kind,schema_name,object_name,parent_name,definition`);
  return rows;
}

function isE10SchemaRow(row) {
  return [row.object_name, row.parent_name].some((name) => String(name).startsWith("fondo_"));
}

async function rowEvidence(client) {
  const tables = (await client.query(`SELECT n.nspname schema_name,c.relname table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname !~ '^pg_(toast|temp)' AND c.relname !~ '^fondo_'
    ORDER BY 1,2`)).rows;
  const result = [];
  for (const table of tables) {
    const name = `${quote(table.schema_name)}.${quote(table.table_name)}`;
    const row = (await client.query(`WITH x AS (SELECT to_jsonb(t)::text value FROM ${name} t)
      SELECT count(*)::text count,md5(coalesce(string_agg(md5(value),'' ORDER BY value,md5(value)),'')) hash FROM x`)).rows[0];
    result.push({ ...table, ...row });
  }
  return result;
}

async function legacySequenceState(client) {
  const sequences = (await client.query(`SELECT n.nspname schema_name,c.relname sequence_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname !~ '^pg_(toast|temp)' AND c.relname !~ '^fondo_'
    ORDER BY 1,2`)).rows;
  const state = [];
  for (const sequence of sequences) {
    const name = `${quote(sequence.schema_name)}.${quote(sequence.sequence_name)}`;
    const value = (await client.query(`SELECT last_value::text last_value,is_called FROM ${name}`)).rows[0];
    state.push({ ...sequence, ...value });
  }
  return state;
}

async function snapshot(client) {
  const schema = await schemaRows(client);
  const legacySchema = schema.filter((row) => !isE10SchemaRow(row));
  const evidence = await rowEvidence(client);
  const sequenceState = await legacySequenceState(client);
  const e1Functions = (await client.query(`SELECT n.nspname schema,p.proname name,
    pg_get_function_identity_arguments(p.oid) identity_arguments,pg_get_functiondef(p.oid) definition,
    p.prokind::text kind,p.proacl::text acl,pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY($1::text[])
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`, [E1_FUNCTIONS])).rows;
  const e1Triggers = (await client.query(`SELECT n.nspname schema,c.relname table,t.tgname name,
    pg_get_triggerdef(t.oid) definition,t.tgenabled::text enabled,t.tgtype::int type,
    pn.nspname function_schema,p.proname function_name,t.tgisinternal internal
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname=ANY($1::text[])
    ORDER BY n.nspname,c.relname,t.tgname`, [E1_TRIGGERS])).rows;
  assert.equal(await fileHash(resolve(ROOT, E1_ACCEPTED_PATH)), E1_ACCEPTED_SHA256,
    "Accepted E1 operational report SHA mismatch");
  const accepted = await json(resolve(ROOT, E1_ACCEPTED_PATH));
  const expectedGuards = accepted.finalSnapshot?.temporaryGuards;
  assert.equal(expectedGuards?.functions?.count, 3);
  assert.equal(expectedGuards?.triggers?.count, 3);
  assert.deepEqual(e1Functions, expectedGuards.functions.rows, "E1 guard function definitions changed");
  assert.deepEqual(e1Triggers, expectedGuards.triggers.rows, "E1 guard trigger definitions/states changed");
  assert.ok(e1Triggers.every((row) => row.enabled === "O"), "Every E1 guard trigger must be origin-enabled");
  const enabledEventTriggers = (await client.query(
    "SELECT evtname name,evtenabled::text enabled FROM pg_event_trigger WHERE evtenabled<>'D' ORDER BY evtname",
  )).rows;
  assert.deepEqual(enabledEventTriggers, [], "Enabled event triggers are prohibited");
  const accounts = (await client.query(`SELECT
    (SELECT count(*)::text FROM public.usuarios) users,
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(u)::text),'' ORDER BY to_jsonb(u)::text),'')) FROM public.usuarios u) users_hash,
    (SELECT count(*)::text FROM public.sesiones) sessions,
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' ORDER BY to_jsonb(s)::text),'')) FROM public.sesiones s) sessions_hash`)).rows[0];
  return {
    schema, legacySchema, evidence, sequenceState, accounts,
    e1Guards: { functions: e1Functions, triggers: e1Triggers },
    enabledEventTriggers,
    schemaSha256: digest(schema), legacySchemaSha256: digest(legacySchema),
    evidenceSha256: digest(evidence), sequenceStateSha256: digest(sequenceState),
  };
}

async function assertNoFondoNamespaceObjects(client) {
  const rows = (await client.query(`SELECT kind,schema_name,object_name FROM (
    SELECT 'relation' kind,n.nspname schema_name,c.relname object_name
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    UNION ALL SELECT 'function',n.nspname,p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    UNION ALL SELECT 'type',n.nspname,t.typname
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    UNION ALL SELECT 'constraint',n.nspname,c.conname
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    UNION ALL SELECT 'trigger',n.nspname,t.tgname
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE NOT t.tgisinternal
    UNION ALL SELECT 'operator',n.nspname,o.oprname
      FROM pg_operator o JOIN pg_namespace n ON n.oid=o.oprnamespace
  ) objects WHERE schema_name NOT IN ('pg_catalog','information_schema')
    AND schema_name !~ '^pg_(toast|temp)' AND object_name ~ '^fondo_' ORDER BY 1,2,3`)).rows;
  assert.deepEqual(rows, [], "Fondo namespace objects already exist");
}

async function e10Inventory(client) {
  const inventory = {
    tables: (await client.query(`SELECT c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[]) ORDER BY 1`, [E10_TABLES])).rows.map((r) => r.name),
    sequences: (await client.query(`SELECT c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='S' AND c.relname=ANY($1::text[]) ORDER BY 1`, [E10_SEQUENCE])).rows.map((r) => r.name),
    indexes: (await client.query(`SELECT c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='i' AND c.relname=ANY($1::text[]) ORDER BY 1`, [E10_INDEXES])).rows.map((r) => r.name),
    functions: (await client.query(`SELECT p.proname name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=ANY($1::text[]) ORDER BY 1`, [E10_FUNCTIONS])).rows.map((r) => r.name),
    triggers: (await client.query(`SELECT t.tgname name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
      AND t.tgname=ANY($1::text[]) ORDER BY 1`, [E10_TRIGGERS])).rows.map((r) => r.name),
    checks: (await client.query(`SELECT con.conname name FROM pg_constraint con JOIN pg_namespace n ON n.oid=con.connamespace
      WHERE n.nspname='public' AND con.contype='c' AND con.conname=ANY($1::text[]) ORDER BY 1`, [E10_CHECKS])).rows.map((r) => r.name),
  };
  assert.deepEqual(inventory, {
    tables: E10_TABLES, sequences: E10_SEQUENCE, indexes: E10_INDEXES,
    functions: E10_FUNCTIONS, triggers: E10_TRIGGERS, checks: E10_CHECKS,
  });
  assert.equal(Object.values(inventory).flat().length, 36, "SQL inventory must contain exactly 36 named objects");
  return inventory;
}

async function verifyEvidencePointer(pointer, label) {
  assert.ok(pointer && typeof pointer.path === "string" && /^[a-f0-9]{64}$/.test(pointer.sha256), `${label} pointer invalid`);
  assert.ok(pointer.path.startsWith("reports/") && !pointer.path.includes(".."), `${label} path invalid`);
  const path = resolve(ROOT, pointer.path);
  assert.equal(await fileHash(path), pointer.sha256, `${label} artifact SHA mismatch`);
  const artifact = await json(path);
  assert.equal(artifact.status, "PASS", `${label} status is not PASS`);
  return artifact;
}

export async function reviewFiles() {
  const source = await readFile(resolve(ROOT, SQL_PATH), "utf8");
  const statements = validateExactSql(source);
  const identityExists = await access(resolve(ROOT, IDENTITY_PATH)).then(() => true).catch(() => false);
  const gatesExists = await access(resolve(ROOT, GATES_PATH)).then(() => true).catch(() => false);
  return {
    status: identityExists && gatesExists ? "READY_FOR_MAIN_GATE_REVIEW_NOT_EXECUTION" : "WAITING_FOR_GATES",
    networkOrDatabaseUsed: false,
    sql: { path: SQL_PATH, sha256: sha256(source), exactStatements: statements.length },
    sourceProvenance: await sourceProvenance(),
    required: {
      identity: IDENTITY_PATH, gates: GATES_PATH,
      readOnlyPreflightInterface:
        "--preflight --ack E10_READONLY_LIVE_RESTORE_COMPARE --identity-sha SHA256 --backup-sha SHA256 --drive-sha SHA256",
      executionInterface: `--execute --ack ${ACK} --sql-sha ${SQL_SHA256} --gates-sha SHA256 --identity-sha SHA256`,
      oneShotClaim: relative(ROOT, CLAIM_PATH),
    },
  };
}

async function loadGates(args) {
  const value = (name) => {
    const index = args.indexOf(name);
    assert.ok(index >= 0 && args[index + 1], `Missing ${name}`);
    return args[index + 1];
  };
  assert.equal(value("--ack"), ACK);
  assert.equal(value("--sql-sha"), SQL_SHA256);
  const gatesHash = value("--gates-sha");
  const identityHash = value("--identity-sha");
  assert.match(gatesHash, /^[a-f0-9]{64}$/);
  assert.match(identityHash, /^[a-f0-9]{64}$/);
  assert.equal(args.length, 8, "Exact execution arguments required");
  const gatesPath = resolve(ROOT, GATES_PATH);
  const identityPath = resolve(ROOT, IDENTITY_PATH);
  assert.equal(await fileHash(gatesPath), gatesHash);
  assert.equal(await fileHash(identityPath), identityHash);
  const gates = await json(gatesPath);
  const api = await json(identityPath);
  assert.equal(gates.status, "APPROVED_FOR_MAIN_REVIEW");
  assert.equal(gates.sql?.path, SQL_PATH);
  assert.equal(gates.sql?.sha256, SQL_SHA256);
  assert.equal(gates.apiIdentity?.path, IDENTITY_PATH);
  assert.equal(gates.apiIdentity?.sha256, identityHash);
  assert.ok(typeof gates.reviewedBy === "string" && gates.reviewedBy.length > 0);
  assert.ok(Number.isFinite(Date.parse(gates.reviewedAtUtc)));
  assert.equal(api.actualProcessPool, true);
  assert.equal(api.readOnly, true);
  assert.ok(Number.isInteger(api.apiPid) && api.apiPid > 1);
  assert.ok(api.identity && typeof api.identity === "object");
  assert.equal(api.identity.backend_pid > 0, true);
  assert.equal(api.identity.system_identifier?.length > 0, true);
  assert.ok(Date.now() - Date.parse(api.capturedAtUtc) >= 0 && Date.now() - Date.parse(api.capturedAtUtc) <= 5 * 60_000,
    "API pool identity is not fresh (five-minute maximum)");
  await access(`/proc/${api.apiPid}`);
  const backup = await verifyEvidencePointer(gates.backup, "backup");
  const restore = await verifyEvidencePointer(gates.restore, "restore");
  const drive = await verifyEvidencePointer(gates.drive, "Drive");
  const preflight = await verifyEvidencePointer(gates.preflight, "read-only preflight");
  for (const artifact of [backup, restore, drive]) {
    if (artifact !== drive) {
      assert.equal(artifact.dumpSha256 ?? artifact.archive?.sha256, gates.dumpSha256, "Backup chain dump SHA mismatch");
    }
  }
  assert.equal(restore.comparison?.status ?? restore.restoreStatus, "PASS");
  assert.equal(drive.hashesMatch, true);
  assert.equal(drive.privatePermissionsVerified, true);
  assert.equal(drive.sourceSha256, gates.dumpSha256);
  assert.equal(drive.downloadedSha256, gates.dumpSha256);
  assert.equal(preflight.mode, "READ_ONLY_LIVE_RESTORE_PREFLIGHT");
  assert.equal(preflight.noWrites, true);
  assert.equal(preflight.liveRestoreExactMatch, true);
  assert.equal(preflight.identity?.sha256, identityHash);
  assert.equal(preflight.backup?.sha256, gates.backup.sha256);
  assert.equal(preflight.drive?.sha256, gates.drive.sha256);
  assert.deepEqual(preflight.before, gates.before);
  assert.ok(Date.now() - Date.parse(preflight.capturedAtUtc) >= 0
    && Date.now() - Date.parse(preflight.capturedAtUtc) <= 5 * 60_000,
  "Read-only live/restore preflight is not fresh");
  assert.match(gates.before?.legacySchemaSha256, /^[a-f0-9]{64}$/);
  assert.match(gates.before?.evidenceSha256, /^[a-f0-9]{64}$/);
  return { gates, api, gatesHash, identityHash };
}

async function readOnlySnapshot(identity, applicationName, requireFondoAbsent = true) {
  const client = new pg.Client(connectionOptions(applicationName, true));
  try {
    await client.connect();
    await assertIdentity(client, identity, true);
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    if (requireFondoAbsent) await assertNoFondoNamespaceObjects(client);
    const result = await snapshot(client);
    await client.query("ROLLBACK");
    return result;
  } finally {
    await client.end().catch(() => undefined);
  }
}

function exactPreflightValue(args, name) {
  const index = args.indexOf(name);
  assert.ok(index >= 0 && args[index + 1], `Missing ${name}`);
  return args[index + 1];
}

async function readonlyPreflight(args) {
  assert.equal(args.length, 8, "Exact read-only preflight arguments required");
  assert.equal(exactPreflightValue(args, "--ack"), "E10_READONLY_LIVE_RESTORE_COMPARE");
  const identitySha256 = exactPreflightValue(args, "--identity-sha");
  const backupSha256 = exactPreflightValue(args, "--backup-sha");
  const driveSha256 = exactPreflightValue(args, "--drive-sha");
  for (const value of [identitySha256, backupSha256, driveSha256]) assert.match(value, /^[a-f0-9]{64}$/);
  const identityFile = resolve(ROOT, IDENTITY_PATH);
  const backupFile = resolve(ROOT, BACKUP_PATH);
  const driveFile = resolve(ROOT, DRIVE_PATH);
  assert.equal(await fileHash(identityFile), identitySha256);
  assert.equal(await fileHash(backupFile), backupSha256);
  assert.equal(await fileHash(driveFile), driveSha256);
  const api = await json(identityFile);
  const backup = await json(backupFile);
  const drive = await json(driveFile);
  assert.equal(api.actualProcessPool, true);
  assert.equal(api.readOnly, true);
  assert.ok(Date.now() - Date.parse(api.capturedAtUtc) >= 0
    && Date.now() - Date.parse(api.capturedAtUtc) <= 5 * 60_000, "API pool identity is not fresh");
  await access(`/proc/${api.apiPid}`);
  assert.equal(backup.status, "PASS");
  assert.equal(backup.comparison?.status, "PASS");
  assert.equal(backup.restore?.unixSocketOnlyVerified, true);
  assert.equal(backup.restore?.restoreExitCode, 0);
  assert.equal(backup.archive?.sha256, drive.sourceSha256);
  assert.equal(drive.status, "PASS");
  assert.equal(drive.hashesMatch, true);
  assert.equal(drive.privatePermissionsVerified, true);
  assert.equal(drive.sourceSha256, drive.downloadedSha256);
  assert.equal(await fileHash(backup.archive.file), backup.archive.sha256);

  const restore = backup.restore;
  assert.equal(restore.superuserRole, "postgres");
  assert.match(restore.database, /^restore_disposable_[a-zA-Z0-9-]+$/);
  assert.match(restore.socketDirectory, /^\/tmp\/prompt-h-block2-[a-zA-Z0-9-]+$/);
  assert.equal(resolve(restore.clusterDirectory), resolve(backup.backupDirectory, "restore-cluster"));
  assert.equal(await import("node:fs/promises").then((module) => module.realpath(restore.clusterDirectory)),
    restore.clusterDirectory);
  const control = await execFileAsync(
    resolve(restore.postgresBinaryDirectory, "pg_controldata"),
    [restore.clusterDirectory],
    { cwd: ROOT, timeout: 5000, maxBuffer: 1024 * 1024 },
  );
  const localSystemIdentifier = control.stdout.match(/^Database system identifier:\s*(\d+)\s*$/m)?.[1];
  assert.match(localSystemIdentifier ?? "", /^\d+$/, "pg_controldata did not report a system identifier");
  assert.notEqual(localSystemIdentifier, api.identity.system_identifier,
    "Disposable restore must not share the operative cluster system identifier");
  const live = await readOnlySnapshot(api.identity, `e10-readonly-preflight-live-${process.pid}`);
  const restoredClient = new pg.Client({
    host: restore.socketDirectory,
    port: 5432,
    database: restore.database,
    user: restore.superuserRole,
    ssl: false,
    password: async () => { throw new Error("Restore Unix socket unexpectedly requested credentials"); },
    application_name: `e10-readonly-preflight-restore-${process.pid}`,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    query_timeout: 17000,
    options: "-c timezone=UTC -c default_transaction_read_only=on",
  });
  let restored;
  try {
    await restoredClient.connect();
    const restoreIdentity = (await restoredClient.query(`SELECT current_database() database,current_user role,
      current_setting('data_directory') data_directory,current_setting('unix_socket_directories') socket,
      current_setting('port') port,current_setting('listen_addresses') listen,
      inet_server_addr()::text address,current_setting('transaction_read_only') transaction_read_only,
      (SELECT system_identifier::text FROM pg_control_system()) system_identifier`)).rows[0];
    assert.equal(restoreIdentity.database, restore.database);
    assert.equal(restoreIdentity.role, restore.superuserRole);
    assert.equal(await import("node:fs/promises").then((module) => module.realpath(restoreIdentity.data_directory)),
      restore.clusterDirectory);
    assert.equal(restoreIdentity.socket, restore.socketDirectory);
    assert.equal(restoreIdentity.port, "5432");
    assert.equal(restoreIdentity.listen, "");
    assert.equal(restoreIdentity.address, null);
    assert.equal(restoreIdentity.transaction_read_only, "on");
    assert.equal(restoreIdentity.system_identifier, localSystemIdentifier);
    assert.notEqual(restoreIdentity.system_identifier, api.identity.system_identifier);
    await restoredClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await assertNoFondoNamespaceObjects(restoredClient);
    restored = await snapshot(restoredClient);
    await restoredClient.query("ROLLBACK");
  } finally {
    await restoredClient.end().catch(() => undefined);
  }
  assert.deepEqual(live.legacySchema, restored.legacySchema, "Live/restore legacy schema drift");
  assert.deepEqual(live.evidence, restored.evidence, "Live/restore legacy row drift");
  assert.deepEqual(live.sequenceState, restored.sequenceState, "Live/restore legacy sequence-state drift");
  assert.deepEqual(live.accounts, restored.accounts, "Live/restore account/session drift");
  const output = {
    status: "PASS", mode: "READ_ONLY_LIVE_RESTORE_PREFLIGHT", noWrites: true,
    capturedAtUtc: new Date().toISOString(),
    identity: { path: IDENTITY_PATH, sha256: identitySha256 },
    backup: { path: BACKUP_PATH, sha256: backupSha256, dumpSha256: backup.archive.sha256 },
    drive: { path: DRIVE_PATH, sha256: driveSha256 },
    restoreTarget: {
      socketDirectory: restore.socketDirectory, database: restore.database, role: restore.superuserRole,
      port: 5432, dataDirectory: restore.clusterDirectory, systemIdentifier: localSystemIdentifier,
      differsFromOperativeSystemIdentifier: true,
    },
    before: {
      legacySchemaSha256: live.legacySchemaSha256,
      evidenceSha256: live.evidenceSha256,
      sequenceStateSha256: live.sequenceStateSha256,
      accounts: live.accounts,
      e1GuardsSha256: digest(live.e1Guards),
      enabledEventTriggers: live.enabledEventTriggers,
    },
    liveRestoreExactMatch: true,
  };
  const path = resolve(OUT, `readonly-preflight-${Date.now()}-${process.pid}.json`);
  await mkdir(OUT, { recursive: true });
  await writeFile(path, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: "PASS", report: relative(ROOT, path), before: output.before }));
}

async function supervisorChild() {
  assert.ok(process.send && process.connected);
  let control;
  let target;
  let timer;
  let fired = false;
  let armedAt = 0;
  let normalStop = false;
  const send = (message) => { if (process.connected) process.send(message); };
  const exactWhere = `a.pid=$1 AND a.backend_start::text=$2 AND d.oid::text=$3
    AND a.usename=$4 AND a.application_name=$5`;
  async function expire() {
    if (fired) return;
    fired = true;
    send({ event: "deadline" });
    try {
      const values = [target.pid, target.backend_start, target.database_oid, target.database_role, target.application_name];
      const cancelled = await control.query(`SELECT pg_cancel_backend(a.pid) cancelled FROM pg_stat_activity a
        JOIN pg_database d ON d.datname=a.datname WHERE ${exactWhere}`, values);
      send({ event: "cancel", matched: cancelled.rowCount });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      const terminated = await control.query(`SELECT pg_terminate_backend(a.pid,1000) terminated FROM pg_stat_activity a
        JOIN pg_database d ON d.datname=a.datname WHERE ${exactWhere}`, values);
      send({ event: "terminate", matched: terminated.rowCount });
    } catch (error) {
      send({ event: "supervisorError", error: safeError(error) });
    }
  }
  let chain = Promise.resolve();
  process.on("message", (message) => {
    chain = chain.then(async () => {
      if (message.action === "init") {
        assert.ok(!control);
        control = new pg.Client({ ...connectionOptions(message.applicationName, true), statement_timeout: 3000, query_timeout: 4000 });
        control.on("error", () => { void expire(); });
        await control.connect();
        await assertIdentity(control, message.identity, true);
      } else if (message.action === "arm") {
        assert.ok(control && !target);
        target = message.target;
        const match = await control.query(`SELECT 1 FROM pg_stat_activity a JOIN pg_database d ON d.datname=a.datname
          WHERE ${exactWhere}`, [target.pid, target.backend_start, target.database_oid, target.database_role, target.application_name]);
        assert.equal(match.rowCount, 1);
        armedAt = performance.now();
        timer = setTimeout(() => { void expire(); }, DEADLINE_MS);
      } else if (message.action === "permit") {
        assert.ok(control && target && !fired);
        const match = await control.query(`SELECT a.pid,a.backend_start::text backend_start,d.oid::text database_oid,
          a.usename database_role,a.application_name FROM pg_stat_activity a JOIN pg_database d ON d.datname=a.datname
          WHERE ${exactWhere}`, [target.pid, target.backend_start, target.database_oid, target.database_role, target.application_name]);
        assert.equal(match.rowCount, 1);
        assertPermitBoundary({ armedAt, now: performance.now(), fired, target, observed: match.rows[0] });
      } else if (message.action === "stop") {
        assert.ok(control && target);
        const match = await control.query(`SELECT 1 FROM pg_stat_activity a JOIN pg_database d ON d.datname=a.datname
          WHERE ${exactWhere}`, [target.pid, target.backend_start, target.database_oid, target.database_role, target.application_name]);
        assert.equal(match.rowCount, 0, "Cannot disarm while exact DDL backend exists");
        if (timer) clearTimeout(timer);
        await control.end();
        control = undefined;
        normalStop = true;
        send({ id: message.id, ok: true });
        process.disconnect();
        return;
      } else throw new Error("Unknown supervisor action");
      send({ id: message.id, ok: true });
    }).catch((error) => send({ id: message.id, ok: false, error: safeError(error) }));
  });
  process.on("disconnect", () => { void (async () => {
    if (target && control) await expire();
    if (timer) clearTimeout(timer);
    await control?.end().catch(() => undefined);
    process.exitCode = normalStop ? 0 : 1;
  })(); });
  send({ event: "ready" });
}

export function createSupervisor(report, failDDL) {
  const child = fork(SELF, ["--internal-supervisor"], { execArgv: process.execArgv, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  let sequence = 0;
  let normalStopAcknowledged = false;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolvePromise, rejectPromise) => { readyResolve = resolvePromise; readyReject = rejectPromise; });
  const pending = new Map();
  const readyTimer = setTimeout(() => readyReject(new Error("Supervisor startup timeout")), 7000);
  child.on("message", (message) => {
    if (message.event) {
      report.supervisor.events.push({ ...message, atUtc: new Date().toISOString() });
      if (message.event === "ready") { clearTimeout(readyTimer); readyResolve(); }
      else if (message.event !== "cancel" && message.event !== "terminate") {
        report.supervisor.failed = true;
        failDDL();
      }
      return;
    }
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.ok) {
      if (item.action === "stop") normalStopAcknowledged = true;
      item.resolve(message);
    }
    else item.reject(new Error("Supervisor boundary rejected"));
  });
  const fail = () => {
    report.supervisor.failed = true;
    failDDL();
    for (const item of pending.values()) item.reject(new Error("Supervisor unavailable"));
    pending.clear();
  };
  child.on("error", fail);
  child.on("exit", () => {
    if (supervisorExitIsFailure(normalStopAcknowledged)) fail();
  });
  async function request(action, payload = {}) {
    if (action === "init") await ready;
    assert.ok(child.connected);
    return new Promise((resolvePromise, rejectPromise) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectPromise(new Error("Supervisor response timeout"));
        fail();
      }, 6000);
      pending.set(id, { action, resolve: resolvePromise, reject: rejectPromise, timer });
      child.send({ id, action, ...payload });
    });
  }
  return { request, disconnect: () => { if (child.connected) child.disconnect(); } };
}

async function execute(args) {
  const source = await readFile(resolve(ROOT, SQL_PATH), "utf8");
  const statements = validateExactSql(source);
  const gate = await loadGates(args);
  await mkdir(OUT, { recursive: true });
  const run = `${Date.now()}-${process.pid}`;
  const reportPath = resolve(OUT, `operational-run-${run}.json`);
  const report = {
    status: "RUNNING", stage: "claim", startedAtUtc: new Date().toISOString(),
    sqlSha256: SQL_SHA256, gateSha256: gate.gatesHash, identitySha256: gate.identityHash,
    exactStatements: 30, statementsSent: 0, statementsAcknowledged: 0,
    commitSent: false, commitAcknowledged: false, automaticRetries: 0,
    fixturesOrExtraDomainDdl: 0,
    serverLimits: { statementTimeoutMs: 15000, lockTimeoutMs: 2000, idleInTransactionTimeoutMs: 20000 },
    supervisor: { independentProcess: true, deadlineMs: DEADLINE_MS, failed: false, events: [] },
    sourceProvenance: await sourceProvenance(),
  };
  const save = () => writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await writeFile(CLAIM_PATH, `${JSON.stringify({
    run, report: relative(ROOT, reportPath), sqlSha256: SQL_SHA256,
    gateSha256: gate.gatesHash, identitySha256: gate.identityHash, neverRetry: true,
  }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });

  let before;
  let ddl;
  let target;
  let supervisor;
  let started = 0;
  const budget = () => {
    assert.ok(started > 0 && performance.now() - started < DEADLINE_MS, "Transaction deadline expired");
    assert.equal(report.supervisor.failed, false, "Supervisor expired or failed");
  };
  try {
    report.stage = "fresh-readonly-preflight";
    before = await readOnlySnapshot(gate.api.identity, `e10-operational-preflight-${run}`);
    assert.equal(before.legacySchemaSha256, gate.gates.before.legacySchemaSha256);
    assert.equal(before.evidenceSha256, gate.gates.before.evidenceSha256);
    assert.deepEqual(before.accounts, gate.gates.before.accounts);
    report.before = before;
    await save();

    const applicationName = `e10-operational-ddl-${run}`;
    ddl = new pg.Client(connectionOptions(applicationName, false));
    ddl.on("error", () => { report.ddlConnectionError = true; });
    await ddl.connect();
    const identity = await assertIdentity(ddl, gate.api.identity, false);
    await assertNoFondoNamespaceObjects(ddl);
    const activity = (await ddl.query(`SELECT backend_start::text backend_start FROM pg_stat_activity
      WHERE pid=pg_backend_pid()`)).rows[0];
    target = {
      pid: identity.backend_pid, backend_start: activity.backend_start,
      database_oid: identity.database_oid, database_role: identity.database_role,
      application_name: applicationName,
    };
    report.ddlBackend = { pid: target.pid, backendStart: target.backend_start, applicationName };
    supervisor = createSupervisor(report, () => { void ddl?.end().catch(() => undefined); });
    await supervisor.request("init", {
      identity: gate.api.identity, applicationName: `e10-operational-supervisor-${run}`,
    });
    // Supervisor is fully connected before the transaction begins.
    started = performance.now();
    await supervisor.request("arm", { target });
    report.stage = "exact-sql-transaction";
    for (let index = 0; index < statements.length; index++) {
      await supervisor.request("permit");
      budget();
      const statement = statements[index];
      const isCommit = index === statements.length - 1;
      if (isCommit) {
        assert.equal(commandOf(statement), "COMMIT");
        // There is intentionally no await between the local deadline check and
        // sending the exact source COMMIT statement.
        budget();
        report.commitSent = true;
      }
      report.statementsSent++;
      await ddl.query(statement);
      report.statementsAcknowledged++;
      if (isCommit) report.commitAcknowledged = true;
    }
    budget();
    report.transactionPath = "ACKNOWLEDGED_PENDING_FRESH_READONLY";
  } catch (error) {
    report.status = "FAIL";
    report.failure = safeError(error);
    report.transactionPath = report.commitSent ? "UNCERTAIN_COMMIT" : "NOT_COMMITTED_OR_UNCERTAIN";
    if (ddl && !report.commitSent && !report.supervisor.failed && started && performance.now() - started < DEADLINE_MS) {
      try { await ddl.query("ROLLBACK"); report.rollbackAcknowledged = true; } catch { report.rollbackAcknowledged = false; }
    }
  } finally {
    await ddl?.end().catch(() => undefined);
    report.transactionElapsedMs = started ? performance.now() - started : 0;
    // Persist uncertainty before trying to classify outcome. Never retry.
    await save();
    if (supervisor && target) {
      try {
        await supervisor.request("stop");
        report.supervisor.exactBackendAbsentBeforeDisarm = true;
      } catch (error) {
        report.supervisor.failed = true;
        report.supervisor.stopError = safeError(error);
      } finally {
        supervisor.disconnect();
      }
    }
  }

  try {
    report.stage = "fresh-readonly-outcome";
    const after = await readOnlySnapshot(gate.api.identity, `e10-operational-outcome-${run}`, false);
    report.after = after;
    assert.ok(before);
    assert.deepEqual(after.legacySchema, before.legacySchema, "Old schema changed");
    assert.deepEqual(after.evidence, before.evidence, "Old table rows changed");
    assert.deepEqual(after.sequenceState, before.sequenceState, "Old sequence state changed");
    assert.deepEqual(after.accounts, before.accounts, "Users or sessions changed");
    const outcomeClient = new pg.Client(connectionOptions(`e10-operational-inventory-${run}`, true));
    try {
      await outcomeClient.connect();
      await assertIdentity(outcomeClient, gate.api.identity, true);
      const fundoRows = after.schema.filter(isE10SchemaRow);
      if (fundoRows.length === 0) {
        report.commitOutcome = "NOT_COMMITTED_VERIFIED";
        report.status = "FAIL";
      } else {
        report.inventory = await e10Inventory(outcomeClient);
        const counts = (await outcomeClient.query(`SELECT
          (SELECT count(*)::int FROM public.fondo_mariana) metadata,
          (SELECT count(*)::int FROM public.fondo_movimientos) movements,
          (SELECT count(*)::int FROM public.fondo_arqueos) audits`)).rows[0];
        assert.deepEqual(counts, { metadata: 1, movements: 0, audits: 0 });
        report.tableCounts = counts;
        report.commitOutcome = "COMMITTED_VERIFIED";
        assert.equal(report.commitAcknowledged, true, "Commit persisted without acknowledgement; manual review required");
        assert.equal(report.transactionPath, "ACKNOWLEDGED_PENDING_FRESH_READONLY",
          "Persisted outcome followed an unclean transaction path; manual review required");
        assert.equal(report.status, "RUNNING", "Earlier failure cannot be converted to PASS");
        assert.equal(report.supervisor.failed, false);
        report.status = "PASS";
      }
    } finally {
      await outcomeClient.end().catch(() => undefined);
    }
  } catch (error) {
    report.status = "FAIL";
    report.commitOutcome ??= "UNRESOLVED_REQUIRES_MANUAL_REVIEW";
    report.outcomeError = safeError(error);
  }
  report.stage = "complete";
  report.finishedAtUtc = new Date().toISOString();
  await save();
  if (report.status !== "PASS") process.exitCode = 1;
  console.log(JSON.stringify({
    status: report.status, commitOutcome: report.commitOutcome,
    report: relative(ROOT, reportPath), automaticRetries: 0,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--review") {
    console.log(JSON.stringify(await reviewFiles(), null, 2));
    return;
  }
  if (args.length === 1 && args[0] === "--internal-supervisor" && process.send) {
    await supervisorChild();
    return;
  }
  if (args[0] === "--preflight") {
    await readonlyPreflight(args.slice(1));
    return;
  }
  if (args[0] === "--execute") {
    await execute(args.slice(1));
    return;
  }
  throw new Error("Use --review, or the exact hash-pinned --execute interface emitted by --review.");
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main().catch((error) => {
    console.error(JSON.stringify(safeError(error)));
    process.exitCode = 1;
  });
}