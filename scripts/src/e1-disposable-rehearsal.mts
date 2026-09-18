/**
 * Operator-only E1 rehearsal. Nothing runs on import.
 * No source connections, backup/Drive operations, application initializers or DML.
 * Requires the newly restored clone and matching PASS Drive evidence first.
 */
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Client } from "pg";
import { collectE1Baseline } from "./prompt-h-block2-backup-restore.mts";

type Row = Record<string, unknown>;
type Baseline = Awaited<ReturnType<typeof collectE1Baseline>> & {
  supplemental: {
    internalTriggers: Row[];
    views: Row[];
    types: Row[];
    sequenceValues: Row[];
  };
};
type Statement = { id: string; sql: string };
type Timing = {
  id: string;
  synthetic: boolean;
  startedAfterBeginMs: number;
  elapsedMs: number;
  status: "PASS" | "FAIL";
  command?: string;
  error?: Row;
};
type Round = {
  name: string;
  syntheticCancellationTest: boolean;
  watchdogBudgetMs: number;
  backendPid: number;
  statements: Timing[];
  committed: boolean;
  totalMs: number;
  s08FinishToCommitMs: number | null;
  s08FinishToTerminationMs: number | null;
  watchdog: {
    fired: boolean;
    firedAfterBeginMs?: number;
    terminateReturned?: boolean;
    backendAbsent?: boolean;
    error?: Row;
  };
  error?: Row;
};
type Target = {
  database: string;
  socketDirectory: string;
  clusterDirectory: string;
  port: number;
  superuserRole: string;
};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORTS = resolve(ROOT, "reports/e1-ensayo-2026-09-17");
const PATCHES = resolve(REPORTS, "rehearsaldraftpatch");
const ORIGINALS = [
  { name: "01-propuesta.sql", copy: "01.sql", count: 27, sha256: "15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a" },
  { name: "02-reversion-condicionada.sql", copy: "02.sql", count: 28, sha256: "d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7" },
] as const;
const LEDGER = "movimientos_credito";
const COLUMNS = ["sitio_origen_id", "sesion_caja_id", "naturaleza", "operacion_productor",
  "operacion_clave", "nota_origen_id", "origen_justificacion"];
const NEW_TABLES = ["operaciones_credito_e1", "cobros_credito_pendientes_e1", "atribuciones_credito_e1"];
const NEW_FUNCTIONS = ["impedir_mutacion_credito_e1", "validar_contexto_credito_e1",
  "validar_movimiento_credito_e1", "validar_cobro_pendiente_e1", "validar_atribucion_credito_e1"];
const NEW_TRIGGERS = [
  `${LEDGER}.movimientos_validos_e1`, "cobros_credito_pendientes_e1.cobros_validos_e1",
  "atribuciones_credito_e1.atribuciones_validas_e1", "operaciones_credito_e1.operaciones_inmutables_e1",
  "cobros_credito_pendientes_e1.cobros_inmutables_e1", "atribuciones_credito_e1.atribuciones_inmutables_e1",
];
const LEDGER_FKS = ["movimientos_sitio_fk_e1", "movimientos_sesion_fk_e1",
  "movimientos_nota_fk_e1", "movimientos_operacion_fk_e1"];

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function sha(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
async function fileSha(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function omit(row: Row, keys: string[]): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
}
function q(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
function safeError(error: unknown): Row {
  // Deliberately exclude stack, detail, query, parameters, connection and server context.
  const candidate = error as { message?: unknown; code?: unknown };
  const message = String(candidate?.message ?? "Unknown rehearsal failure")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_CONNECTION]")
    .replace(/\b(password|passfile|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 1600);
  return { message, code: typeof candidate?.code === "string" ? candidate.code : null };
}
async function write(path: string, content: unknown): Promise<void> {
  await fs.writeFile(path, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 });
  await fs.chmod(path, 0o600);
}
async function readJson(path: string): Promise<Row> {
  return JSON.parse(await fs.readFile(path, "utf8")) as Row;
}

async function prerequisites(drivePath: string): Promise<{ target: Target; evidence: Row }> {
  check(dirname(drivePath) === REPORTS, "Drive verification JSON must be in the E1 rehearsal report folder.");
  const metadataPath = resolve(REPORTS, "block2-restore-metadata.json");
  const metadata = await readJson(metadataPath);
  const drive = await readJson(drivePath);
  check(metadata.status === "PASS", "Fresh restore metadata must have status PASS.");
  check(drive.status === "PASS", "Drive verification must have status PASS.");
  const archive = metadata.archive as Row | undefined;
  const restore = metadata.restore as Row | undefined;
  check(archive && restore, "Restore metadata must contain archive and restore objects.");
  check(typeof archive.sha256 === "string" && /^[a-f0-9]{64}$/.test(archive.sha256), "Invalid archive SHA-256.");
  check(drive.dumpSha256 === archive.sha256 && drive.downloadSha256 === archive.sha256,
    "Drive dumpSha256 and downloadSha256 must both equal the backup archive SHA-256.");
  check(typeof archive.file === "string" && typeof archive.sizeBytes === "number", "Missing archive path/size.");
  const archivePath = resolve(ROOT, archive.file);
  check(await fileSha(archivePath) === archive.sha256, "Local backup archive SHA-256 no longer matches metadata.");
  check((await fs.stat(archivePath)).size === archive.sizeBytes, "Local archive size differs from metadata.");
  check(typeof restore.database === "string" && /^restore_disposable_[A-Za-z0-9_-]+$/.test(restore.database),
    "Only restore_disposable_* database names are allowed.");
  check(typeof restore.socketDirectory === "string" && /^\/tmp\/prompt-h-block2[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(restore.socketDirectory),
    "Only an explicit Unix socket under /tmp/prompt-h-block2* is allowed.");
  check(typeof restore.clusterDirectory === "string" && isAbsolute(restore.clusterDirectory),
    "Explicit absolute clusterDirectory required.");
  check(typeof restore.superuserRole === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(restore.superuserRole),
    "Explicit metadata superuserRole required.");
  check(restore.unixSocketOnlyVerified === true && restore.restoreExitCode === 0,
    "Restore must have verified Unix-only isolation and successful pg_restore.");
  const socketDirectory = await fs.realpath(restore.socketDirectory);
  check(socketDirectory === restore.socketDirectory, "Socket path must not use symlinks.");
  const clusterDirectory = await fs.realpath(restore.clusterDirectory);
  const port = restore.port === undefined ? 5432 : Number(restore.port);
  check(Number.isInteger(port) && port > 0 && port <= 65535, "Invalid restore port.");
  check((await fs.stat(`${socketDirectory}/.s.PGSQL.${port}`)).isSocket(), "Expected Unix PostgreSQL socket missing.");
  return {
    target: { database: restore.database, socketDirectory, clusterDirectory, port, superuserRole: restore.superuserRole },
    evidence: { metadataPath, metadataSha256: await fileSha(metadataPath), drivePath,
      driveVerificationSha256: await fileSha(drivePath), archiveSha256: archive.sha256,
      archiveSizeBytes: archive.sizeBytes, capturedAtUtc: metadata.capturedAtUtc },
  };
}

async function connect(target: Target, name: string): Promise<Client> {
  // Every connection field is explicit; no connection URL, environment lookup or PG* fallback.
  const client = new pg.Client({
    host: target.socketDirectory, port: target.port, database: target.database,
    user: target.superuserRole,
    password: async () => { throw new Error("Disposable Unix connection requested password authentication; refusing credentials."); },
    ssl: false, application_name: `e1-disposable-${name}`, connectionTimeoutMillis: 5000,
    statement_timeout: 15000, query_timeout: 20000,
    options: "-c search_path=pg_catalog,public -c timezone=UTC",
  });
  // Terminating an idle backend emits an error outside a pending query; consume it.
  client.on("error", () => undefined);
  try {
    await client.connect();
    const { rows: [identity] } = await client.query(`SELECT current_database() AS database,
      current_user AS role, inet_server_addr()::text AS address,
      current_setting('server_version_num') AS version,
      current_setting('data_directory') AS data_directory,
      current_setting('listen_addresses') AS listen_addresses,
      (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`);
    check(identity.database === target.database && identity.role === target.superuserRole,
      "Connected database/role differs from disposable metadata.");
    check(identity.address === null && identity.listen_addresses === "", "Connection/cluster must be Unix-socket-only.");
    check(identity.version === "160010", "This rehearsal requires PostgreSQL 16.10 exactly.");
    check(await fs.realpath(identity.data_directory) === target.clusterDirectory,
      "Server data_directory does not match the restored clusterDirectory.");
    check(identity.superuser === true, "Metadata role is not a superuser on this clone.");
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

export function split(sql: string, expected: number): Statement[] {
  const markers = [...sql.matchAll(/^-- S(\d{2})(?=[:\s]|$)/gm)];
  check(markers.length === expected, `Expected exactly ${expected} numbered statements.`);
  const statements = markers.map((match, index) => {
    check(Number(match[1]) === index + 1, "Statement numbering is not contiguous.");
    const start = match.index!;
    return { id: `S${match[1]}`, sql: sql.slice(start, markers[index + 1]?.index ?? sql.length) };
  });
  const body = (statement: Statement) => statement.sql.replace(/^--.*$/gm, "").trim();
  check(body(statements[0]!) === "BEGIN;", "S01 must be BEGIN.");
  check(body(statements.at(-1)!) === "COMMIT;", "Last numbered statement must be COMMIT.");
  // No semicolon splitting: dollar-quoted DO/function bodies remain byte-for-byte whole.
  return statements;
}

async function drafts(database: string): Promise<{ statements: Statement[][]; evidence: Row[] }> {
  await fs.mkdir(PATCHES, { recursive: true, mode: 0o700 });
  const statements: Statement[][] = [];
  const evidence: Row[] = [];
  for (const original of ORIGINALS) {
    const path = resolve(ROOT, "reports/e1-sql", original.name);
    const bytes = await fs.readFile(path);
    check(sha(bytes) === original.sha256, `Original ${original.name} differs from the reviewed SQL; stop for review.`);
    const input = bytes.toString("utf8");
    const changes: { line: number; before: string; after: string | null }[] = [];
    let raises = 0;
    let guards = 0;
    let diagnostics = 0;
    let headers = 0;
    const output = input.split("\n").flatMap((line, index) => {
      let after: string | null = line;
      if (/^  RAISE EXCEPTION 'E1_NO_GO:.*';$/.test(line)) { after = null; raises++; }
      else if (line === "  IF current_database() <> 'heliumdb' THEN") {
        after = `  IF current_database() <> '${database}' THEN`; guards++;
      } else if (line === "    RAISE EXCEPTION 'Destino incorrecto: se requiere heliumdb; recibido %', current_database();") {
        after = `    RAISE EXCEPTION 'Destino incorrecto: se requiere ${database}; recibido %', current_database();`; diagnostics++;
      } else if (/^-- CANDIDATO[: ]/.test(line)) {
        after = line.replace("heliumdb/public", `${database}/public`); headers++;
      }
      if (after !== line) changes.push({ line: index + 1, before: line, after });
      return after === null ? [] : [after];
    }).join("\n");
    check(raises === 1 && guards === 1 && diagnostics === 1 && headers === 1 && changes.length === 4,
      "Draft transformation must contain only the four explicitly permitted line changes.");
    const copy = resolve(PATCHES, original.copy);
    await write(copy, output);
    const numbered = split(output, original.count);
    statements.push(numbered);
    evidence.push({ originalPath: path, originalSha256: sha(bytes), targetPath: copy,
      targetSha256: sha(output), numberedStatementCount: numbered.length, changes,
      numberedStatements: numbered.map((item) => ({ id: item.id, sha256: sha(item.sql) })) });
    let removedLines = 0;
    const hunks = changes.flatMap((change) => {
      const deleted = change.after === null;
      const outputLine = change.line - removedLines - (deleted ? 1 : 0);
      if (deleted) removedLines++;
      return [`@@ -${change.line},1 +${outputLine},${deleted ? 0 : 1} @@`,
        `-${change.before}`, ...(deleted ? [] : [`+${change.after}`])];
    });
    await write(`${copy}.diff`, [`--- ${path}`, `+++ ${copy}`, ...hunks, ""].join("\n"));
  }
  await write(resolve(PATCHES, "transform-evidence.json"), {
    status: "PREPARED_NOT_EXECUTED", permittedChangesOnly: true, files: evidence,
    headerNote: "All other source comments are retained verbatim, including historical NO-GO comments; see exact diff.",
    operatorScriptSha256: await fileSha(fileURLToPath(import.meta.url)),
    baselineCollectorModuleSha256: await fileSha(resolve(ROOT, "scripts/src/prompt-h-block2-backup-restore.mts")),
  });
  return { statements, evidence };
}

const USER_SCHEMA = "n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'";
export async function capture(client: Client, manageTransaction = true): Promise<Baseline> {
  if (manageTransaction) await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const baseline = await collectE1Baseline(client);
    // The shared comparator covers all noninternal triggers. Capture internal FK
    // triggers too, including their names and definitions; old triggers must survive exactly.
    const internalTriggers = (await client.query(`SELECT n.nspname AS schema, c.relname AS table,
      t.tgname AS trigger_name, pg_get_triggerdef(t.oid, true) AS definition,
      cn.nspname AS constraint_schema, con.conname AS constraint_name,
      rn.nspname AS constraint_table_schema, rc.relname AS constraint_table,
      pn.nspname AS function_schema, p.proname AS function_name,
      t.tgtype AS type_bits, t.tgenabled AS enabled, t.tgdeferrable AS deferrable,
      t.tginitdeferred AS initially_deferred
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
      JOIN pg_namespace pn ON pn.oid=p.pronamespace
      LEFT JOIN pg_constraint con ON con.oid=t.tgconstraint
      LEFT JOIN pg_namespace cn ON cn.oid=con.connamespace
      LEFT JOIN pg_class rc ON rc.oid=con.conrelid
      LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace
      WHERE t.tgisinternal AND ${USER_SCHEMA}`)).rows;
    const views = (await client.query(`SELECT n.nspname AS schema, c.relname AS name,
      c.relkind::text AS kind, pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl,
      pg_get_viewdef(c.oid, true) AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('v','m') AND ${USER_SCHEMA}`)).rows;
    const types = (await client.query(`SELECT n.nspname AS schema, t.typname AS name,
      t.typtype::text AS kind, pg_get_userbyid(t.typowner) AS owner, t.typacl::text AS acl,
      CASE WHEN t.typelem=0 THEN NULL ELSE format_type(t.typelem,NULL) END AS element_type,
      CASE WHEN t.typbasetype=0 THEN NULL ELSE format_type(t.typbasetype,t.typtypmod) END AS base_type,
      t.typnotnull AS not_null, t.typdefault AS default_expression,
      (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid) AS enum_labels
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${USER_SCHEMA}`)).rows;
    const sequenceValues: Row[] = [];
    for (const sequence of baseline.catalogue.sequences) {
      const values = (await client.query(`SELECT last_value::text AS last_value,
        log_cnt::text AS log_cnt, is_called FROM ${q(String(sequence.schema))}.${q(String(sequence.sequence_name))}`)).rows[0];
      sequenceValues.push({ schema: sequence.schema, sequence_name: sequence.sequence_name, ...values });
    }
    if (manageTransaction) await client.query("COMMIT");
    return { ...baseline, supplemental: { internalTriggers, views, types, sequenceValues } };
  } catch (error) {
    if (manageTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

function semantic(baseline: Baseline): Row {
  const { database, columns, ...catalogue } = baseline.catalogue;
  return {
    catalogue: { ...catalogue, columns: columns.map((row) => omit(row, ["ordinal_position"])),
      // Physical database size is telemetry, not semantic catalogue state; the
      // shared backup comparator likewise compares database ownership/ACL/version.
      database: omit(database, ["size_bytes"]) },
    sequenceState: baseline.sequenceState, supplemental: baseline.supplemental,
  };
}
function comparison(before: Baseline, after: Baseline): Row {
  const a = semantic(before);
  const b = semantic(after);
  const ac = a.catalogue as Row;
  const bc = b.catalogue as Row;
  const categories = Object.fromEntries(Object.keys(ac).map((key) => [key, stable(ac[key]) === stable(bc[key])]));
  categories.sequenceState = stable(a.sequenceState) === stable(b.sequenceState);
  for (const key of Object.keys(before.supplemental) as (keyof Baseline["supplemental"])[]) {
    categories[key] = stable(before.supplemental[key]) === stable(after.supplemental[key]);
  }
  return { status: Object.values(categories).every(Boolean) ? "PASS" : "FAIL", categories,
    beforeSemanticSha256: sha(stable(a)), afterSemanticSha256: sha(stable(b)),
    tableCount: after.catalogue.tables.length, noninternalTriggerCount: after.catalogue.triggers.length,
    columnComparisonOnlyExclusion: "ordinal_position (physical attnum)",
    physicalDatabaseSizeTelemetry: { before: before.catalogue.database.size_bytes, after: after.catalogue.database.size_bytes },
  };
}

async function migrationComparison(client: Client, before: Baseline, after: Baseline): Promise<Row> {
  const projected = structuredClone(after);
  const isNewTable = (row: { schema?: unknown; table?: unknown }) => row.schema === "public" && NEW_TABLES.includes(String(row.table));
  const ledger = (row: { schema?: unknown; table?: unknown }) => row.schema === "public" && row.table === LEDGER;
  const c = projected.catalogue;
  const newTables = after.catalogue.tableEvidence.filter(isNewTable);
  check(newTables.length === 3 && newTables.every((row) => row.count === "0"), "Exactly three new E1 tables must be empty.");
  check(after.catalogue.tables.length === before.catalogue.tables.length + 3, "Unexpected table delta.");
  const addedColumns = c.columns.filter((row) => ledger(row) && COLUMNS.includes(String(row.column)));
  check(addedColumns.length === 7 && addedColumns.every((row) => row.not_null === false && row.default_expression === null),
    "Ledger must gain exactly seven nullable columns without defaults.");
  const nullCheck = (await client.query(`SELECT count(*)::text AS populated FROM public.movimientos_credito
    WHERE ${COLUMNS.map((column) => `${q(column)} IS NOT NULL`).join(" OR ")}`)).rows[0];
  check(nullCheck.populated === "0", "Historical ledger rows acquired non-NULL E1 values.");
  const originalLedgerHash = (await client.query(`WITH canonical_rows AS (
      SELECT (to_jsonb(t) - $1::text[])::text AS canonical FROM public.movimientos_credito t
    ) SELECT count(*)::text AS count,
      md5(COALESCE(string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)), '')) AS hash
    FROM canonical_rows`, [COLUMNS])).rows[0];
  c.tables = c.tables.filter((row) => !isNewTable(row));
  c.tableEvidence = c.tableEvidence.filter((row) => !isNewTable(row)).map((row) => ledger(row)
    ? { ...row, count: originalLedgerHash.count, orderedCanonicalRowHash: originalLedgerHash.hash } : row);
  c.columns = c.columns.filter((row) => !isNewTable(row) && !(ledger(row) && COLUMNS.includes(String(row.column))));
  c.constraints = c.constraints.filter((row) => !isNewTable(row) && !(ledger(row) && LEDGER_FKS.includes(String(row.name))));
  c.indexes = c.indexes.filter((row) => !isNewTable(row) && !(ledger(row) && row.index_name === "movimientos_operacion_uq_e1"));
  c.functions = c.functions.filter((row) => !(row.schema === "public" && NEW_FUNCTIONS.includes(String(row.name))));
  c.triggers = c.triggers.filter((row) => !(row.schema === "public" && NEW_TRIGGERS.includes(`${row.table}.${row.trigger_name}`)));
  check(after.catalogue.triggers.length === before.catalogue.triggers.length + 6, "Unexpected noninternal trigger delta.");
  projected.supplemental.internalTriggers = projected.supplemental.internalTriggers.filter((row) =>
    !(row.constraint_table_schema === "public" && (NEW_TABLES.includes(String(row.constraint_table))
      || (row.constraint_table === LEDGER && LEDGER_FKS.includes(String(row.constraint_name))))));
  projected.supplemental.views = projected.supplemental.views.filter((row) =>
    !(row.schema === "public" && row.name === "saldos_cobros_credito_e1"));
  const newTypes = [...NEW_TABLES, "saldos_cobros_credito_e1", "naturaleza_credito_e1"];
  projected.supplemental.types = projected.supplemental.types.filter((row) =>
    !(row.schema === "public" && [...newTypes, ...newTypes.map((name) => `_${name}`)].includes(String(row.name))));
  const result = comparison(before, projected);
  return { ...result, actualMigratedTableCount: after.catalogue.tables.length,
    actualMigratedNoninternalTriggerCount: after.catalogue.triggers.length,
    newTables, newColumnsAllNull: true, ledgerExcludedColumns: COLUMNS,
    projectedLedgerHash: originalLedgerHash, allowedChanges: {
      newTables: NEW_TABLES, newFunctions: NEW_FUNCTIONS, newTriggers: NEW_TRIGGERS,
      ledgerForeignKeys: LEDGER_FKS, ledgerIndex: "movimientos_operacion_uq_e1",
      internalTriggers: "Only FK triggers belonging to the three new tables or four added ledger FKs",
      view: "saldos_cobros_credito_e1", enum: "naturaleza_credito_e1",
    } };
}

async function runRound(target: Target, control: Client, statements: Statement[], name: string, synthetic = false): Promise<Round> {
  const client = await connect(target, name);
  const pid = Number((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  const start = process.hrtime.bigint();
  const elapsed = () => Number(process.hrtime.bigint() - start) / 1e6;
  const result: Round = { name, syntheticCancellationTest: synthetic, watchdogBudgetMs: synthetic ? 1000 : 30000,
    backendPid: pid, statements: [], committed: false, totalMs: 0,
    s08FinishToCommitMs: null, s08FinishToTerminationMs: null, watchdog: { fired: false } };
  let s08Finished: number | undefined;
  let termination: Promise<void> | undefined;
  const terminate = (): Promise<void> => {
    if (termination) return termination;
    result.watchdog.fired = true;
    result.watchdog.firedAfterBeginMs = elapsed();
    termination = (async () => {
      try {
        // Already-connected independent control client: termination rolls back the
        // whole transaction even when the target is idle between numbered S blocks.
        const terminateQuery = {
          text: "SELECT pg_terminate_backend($1, 5000) AS terminated",
          values: [pid], query_timeout: 7000,
        };
        const response = await control.query(terminateQuery);
        result.watchdog.terminateReturned = response.rows[0].terminated === true;
        result.watchdog.backendAbsent = (await control.query(
          "SELECT NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS absent", [pid])).rows[0].absent === true;
        if (s08Finished !== undefined) result.s08FinishToTerminationMs = elapsed() - s08Finished;
      } catch (error) { result.watchdog.error = safeError(error); }
    })();
    return termination;
  };
  const timer = setTimeout(() => { void terminate(); }, result.watchdogBudgetMs);
  const execute = async (statement: Statement, injected = false): Promise<void> => {
    if (elapsed() >= result.watchdogBudgetMs || result.watchdog.fired) {
      await terminate();
      throw new Error("Global transaction watchdog expired; no further statement or COMMIT permitted.");
    }
    const began = elapsed();
    const timing: Timing = { id: statement.id, synthetic: injected, startedAfterBeginMs: began, elapsedMs: 0, status: "FAIL" };
    result.statements.push(timing);
    try {
      const response = await client.query(statement.sql);
      check(!Array.isArray(response), `${statement.id} unexpectedly contained multiple top-level SQL statements.`);
      timing.command = response.command;
      timing.status = "PASS";
      if (statement.id === "S08") s08Finished = elapsed();
      if (response.command === "COMMIT") {
        result.committed = true;
        if (s08Finished !== undefined) result.s08FinishToCommitMs = elapsed() - s08Finished;
      }
    } catch (error) { timing.error = safeError(error); throw error; }
    finally { timing.elapsedMs = elapsed() - began; }
  };
  try {
    for (const [index, statement] of statements.entries()) {
      if (synthetic && index === statements.length - 1) {
        await execute({ id: "SYNTHETIC_BEFORE_COMMIT", sql: "SELECT pg_sleep(10)" }, true);
        // If the cancellation mechanism failed, never commit the synthetic round.
        throw new Error("Synthetic sleep completed unexpectedly; refusing COMMIT.");
      }
      await execute(statement);
    }
  } catch (error) {
    result.error = safeError(error);
    // Terminate any failed transaction too; never continue through a failed S.
    if (!result.committed && !result.watchdog.fired) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
  } finally {
    clearTimeout(timer);
    if (termination) await termination;
    await client.end().catch(() => undefined);
    result.totalMs = elapsed();
  }
  return result;
}

function markdown(report: Row): string {
  const rounds = (report.rounds ?? []) as Round[];
  return [
    "# E1 — ensayo exclusivo en clon desechable", "",
    `Estado: **${report.status}**`, "",
    "No se conectó al origen, no se ejecutaron inicializadores/DML/seeds ni se crearon usuarios o sesiones de aplicación.",
    "Los SQL originales permanecen sin cambios; las únicas transformaciones están documentadas en rehearsaldraftpatch.",
    "Las duraciones son mediciones hrtime del cliente (incluyen ida/vuelta), no estimaciones ni garantías de producción.",
    "S08→COMMIT comienza al finalizar la adquisición del bloqueo; no incluye su espera previa. Total incluye cierre del cliente.",
    "Comparación semántica: sólo se omite ordinal_position/attnum de columnas; tamaño físico de base se registra como telemetría.",
    "No se normalizan cuerpos de funciones, índices, restricciones, hashes, estados de triggers o secuencias.",
    "La prueba adicional de cancelación usa pg_sleep(10) antes de COMMIT y watchdog global de 1000 ms; NO mide DDL normal.",
    "", `Tablas/triggers no internos al baseline: ${report.baselineTableCount ?? "no medido"}/${report.baselineTriggerCount ?? "no medido"} (esperados 63/17).`,
    ...rounds.flatMap((round) => [
      "", `## ${round.name}`, "",
      `COMMIT confirmado: ${round.committed}. Total: ${round.totalMs.toFixed(3)} ms.`,
      `S08 final → COMMIT: ${round.s08FinishToCommitMs === null ? "no hubo COMMIT confirmado" : `${round.s08FinishToCommitMs.toFixed(3)} ms`}.`,
      `Watchdog: ${JSON.stringify(round.watchdog)}.`,
      "", "| Sentencia | Sintética | Estado | ms |", "|---|---|---|---:|",
      ...round.statements.map((s) => `| ${s.id} | ${s.synthetic} | ${s.status} | ${s.elapsedMs.toFixed(3)} |`),
    ]),
    "", "## Verificaciones", "",
    ...["migrationVerification", "rollbackVerification", "cancellationVerification", "ledgerUnblocked", "originalsUnchanged"]
      .map((key) => `- ${key}: ${JSON.stringify(report[key] ?? "NOT_RUN")}`),
    ...(report.error ? ["", `Error saneado: ${JSON.stringify(report.error)}`] : []),
    "", "Evidencia completa y resultados reales: ensayo.json y snapshots privados baseline/migrated/restored/cancelled.",
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  check(args.includes("--execute-disposable-rehearsal"),
    "No action taken. Explicit --execute-disposable-rehearsal is required after fresh backup/restore and Drive PASS.");
  const driveIndex = args.indexOf("--drive-verification");
  check(args.every((arg, index) => arg === "--execute-disposable-rehearsal"
    || arg === "--drive-verification" || index === driveIndex + 1 && driveIndex >= 0), "Unknown argument.");
  check(driveIndex < 0 || Boolean(args[driveIndex + 1]), "--drive-verification requires a JSON path.");
  const drivePath = resolve(ROOT, driveIndex < 0
    ? "reports/e1-ensayo-2026-09-17/drive-verification.json" : args[driveIndex + 1]!);
  await fs.mkdir(REPORTS, { recursive: true, mode: 0o700 });
  // Refuse reusing this rehearsal evidence or rerunning against a previously used clone.
  const claim = await fs.open(resolve(REPORTS, "rehearsal-run-claim.json"), "wx", 0o600);
  await claim.writeFile(`${JSON.stringify({ startedAtUtc: new Date().toISOString(), pid: process.pid })}\n`);
  await claim.close();
  const report: Row = { status: "RUNNING", startedAtUtc: new Date().toISOString(), rounds: [],
    scope: "Disposable clone only; no source/backup/Drive execution", timingClaimsBeforeExecution: "none" };
  let control: Client | undefined;
  try {
    const { target, evidence } = await prerequisites(drivePath);
    report.target = target;
    report.prerequisites = evidence;
    const generated = await drafts(target.database);
    report.transforms = generated.evidence;
    control = await connect(target, "control");
    const baseline = await capture(control);
    await write(resolve(REPORTS, "baseline.json"), baseline);
    report.baselineTableCount = baseline.catalogue.tables.length;
    report.baselineTriggerCount = baseline.catalogue.triggers.length;
    check(baseline.catalogue.tables.length === 63 && baseline.catalogue.triggers.length === 17,
      "Fresh baseline must contain the expected 63 tables and 17 noninternal triggers; stop for review.");
    const rounds = report.rounds as Round[];
    const migration = await runRound(target, control, generated.statements[0]!, "normal-migration-27");
    rounds.push(migration);
    if (!migration.committed) {
      const failedBaseline = await capture(control);
      report.failedMigrationBaselineVerification = comparison(baseline, failedBaseline);
      throw new Error("Normal migration did not complete cleanly; no synthetic cancellation round will run.");
    }
    // Once normal migration commits, attempt its exact conditional reversal even
    // if catalogue verification fails. Do not leave the clone migrated silently.
    let verificationError: unknown = migration.error || migration.watchdog.fired
      ? new Error("Normal migration committed but did not complete cleanly within its watchdog.") : undefined;
    try {
      const migrated = await capture(control);
      await write(resolve(REPORTS, "migrated.json"), migrated);
      report.migrationVerification = await migrationComparison(control, baseline, migrated);
      check((report.migrationVerification as Row).status === "PASS", "Migrated pre-existing schema/data differs beyond the E1 allowlist.");
    } catch (error) { verificationError = error; report.migrationVerificationError = safeError(error); }
    const rollback = await runRound(target, control, generated.statements[1]!, "normal-conditional-reversal-28");
    rounds.push(rollback);
    const restored = await capture(control);
    await write(resolve(REPORTS, "restored.json"), restored);
    report.rollbackVerification = comparison(baseline, restored);
    check(rollback.committed && !rollback.error && !rollback.watchdog.fired,
      "Conditional reversal did not complete cleanly; clone requires review, not automatic destructive cleanup.");
    check((report.rollbackVerification as Row).status === "PASS", "Full baseline was not restored after conditional reversal.");
    if (verificationError) throw verificationError;
    const cancellation = await runRound(target, control, generated.statements[0]!, "extra-synthetic-cancellation", true);
    rounds.push(cancellation);
    const cancelled = await capture(control);
    await write(resolve(REPORTS, "cancelled.json"), cancelled);
    const baselineResult = comparison(baseline, cancelled);
    const started = process.hrtime.bigint();
    const ledgerQuery = { text: "SELECT count(*)::text AS count FROM public.movimientos_credito", query_timeout: 2500 };
    const ledgerRead = await control.query(ledgerQuery);
    report.ledgerUnblocked = { status: "PASS", elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      count: ledgerRead.rows[0].count, queryTimeoutMs: 2500 };
    const injected = cancellation.statements.find((statement) => statement.synthetic);
    const terminated = cancellation.watchdog.fired && cancellation.watchdog.terminateReturned === true
      && cancellation.watchdog.backendAbsent === true && !cancellation.watchdog.error;
    report.cancellationVerification = { status: terminated && !cancellation.committed
      && injected?.status === "FAIL" && baselineResult.status === "PASS" ? "PASS" : "FAIL",
      actualTermination: cancellation.watchdog, syntheticSleepReached: Boolean(injected),
      syntheticSleepError: injected?.error, commitAttempted: cancellation.statements.some((s) => s.id === "S27"),
      baselineComparison: baselineResult, normalDdlTiming: false };
    check((report.cancellationVerification as Row).status === "PASS", "Synthetic cancellation did not prove termination and complete transaction rollback.");
    report.status = "PASS";
  } catch (error) {
    report.status = "FAIL";
    report.error = safeError(error);
    process.exitCode = 1;
  } finally {
    await control?.end().catch(() => undefined);
    try {
      const unchanged = await Promise.all(ORIGINALS.map(async (original) => ({
        file: original.name, sha256: await fileSha(resolve(ROOT, "reports/e1-sql", original.name)),
        expectedSha256: original.sha256,
      })));
      report.originalsUnchanged = { status: unchanged.every((file) => file.sha256 === file.expectedSha256) ? "PASS" : "FAIL", files: unchanged };
      if ((report.originalsUnchanged as Row).status !== "PASS") { report.status = "FAIL"; process.exitCode = 1; }
    } catch (error) { report.status = "FAIL"; report.originalIntegrityError = safeError(error); process.exitCode = 1; }
    report.finishedAtUtc = new Date().toISOString();
    await write(resolve(REPORTS, "ensayo.json"), report);
    await write(resolve(REPORTS, "ensayo.md"), markdown(report));
  }
  console.log(JSON.stringify({ status: report.status, report: "reports/e1-ensayo-2026-09-17/ensayo.json" }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "FAIL", error: safeError(error) }));
    process.exitCode = 1;
  });
}