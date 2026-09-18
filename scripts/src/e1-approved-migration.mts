/**
 * Preparation only on import. One-shot operator for the exact approved 27 blocks.
 * No API lifecycle operations, DML, retries, reversal, restore or clone connections.
 */
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { capture, split } from "./e1-disposable-rehearsal.mts";

type Row = Record<string, any>;
type Baseline = Awaited<ReturnType<typeof capture>>;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REHEARSAL = resolve(ROOT, "reports/e1-ensayo-2026-09-17");
const OUT = resolve(ROOT, "reports/e1-ejecucion-2026-09-17");
const BACKUP = resolve(ROOT, ".local/backups/prompt-h-block2-20260917165108-3655");
const SQL_PATH = "reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql";
const SQL_SHA = "680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f";
const APPROVAL_SHA = "f7d60db4cb9d163c97294eecb71714c242ea75b8f0926c599c9772c9448d60db";
const CATEGORIES = ["tables", "tableEvidence", "columns", "constraints", "indexes", "functions", "triggers", "sequences"] as const;
const ADDED_COLUMNS = ["sitio_origen_id", "sesion_caja_id", "naturaleza", "operacion_productor", "operacion_clave", "nota_origen_id", "origen_justificacion"];
const NEW_TABLES = ["operaciones_credito_e1", "cobros_credito_pendientes_e1", "atribuciones_credito_e1"];
const ID_FIELDS = ["database_name", "database_oid", "database_role", "server_version", "server_address", "server_port", "server_started_at"];
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).sort().join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
const sha = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const digest = (v: unknown) => sha(stable(v));
const omit = (v: Row, keys: string[]) => Object.fromEntries(Object.entries(v).filter(([k]) => !keys.includes(k)));
const json = async (path: string): Promise<Row> => JSON.parse(await fs.readFile(path, "utf8"));
async function fileSha(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function safeError(error: unknown): Row {
  // Do not publish server detail/context, query text, stack, or connection values.
  const code = (error as { code?: unknown })?.code;
  return { message: error instanceof Error && !code ? error.message.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED]")
    .replace(/\b(password|passfile|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]").slice(0, 600) : "Database/network operation failed; inspect status and SQLSTATE.",
    code: typeof code === "string" ? code : null };
}
async function apiStopped(): Promise<Row> {
  // /proc catches wildcard, IPv4, IPv6 and non-loopback listeners without touching the API.
  let ipv6TableAbsent = false;
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let contents: string;
    try { contents = await fs.readFile(path, "utf8"); }
    catch (error) {
      if (path === "/proc/net/tcp6" && (error as NodeJS.ErrnoException).code === "ENOENT") {
        ipv6TableAbsent = true; continue;
      }
      throw error; // IPv4 proc evidence remains mandatory; all other errors fail closed.
    }
    const lines = contents.trim().split("\n").slice(1);
    check(!lines.some((line) => { const f = line.trim().split(/\s+/); return f[3] === "0A" && f[1]?.split(":")[1] === "1F90"; }),
      "API port 8080 has a listening socket; refuse migration.");
  }
  const probe = (host: string): Promise<string> => new Promise((accept, reject) => {
    const socket = createConnection({ host, port: 8080 });
    socket.setTimeout(1000);
    socket.once("connect", () => { socket.destroy(); reject(new Error("API port 8080 accepts connections.")); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error("Cannot prove API port 8080 closed: probe timed out.")); });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") accept(error.code);
      else if (host === "::1" && ipv6TableAbsent && ["EAFNOSUPPORT", "EPROTONOSUPPORT", "EADDRNOTAVAIL", "ENETUNREACH"].includes(error.code ?? "")) accept(error.code!);
      else reject(new Error("Cannot prove API port 8080 closed."));
    });
  });
  const ipv4Probe = await probe("127.0.0.1");
  const ipv6Probe = await probe("::1");
  return { status: "PASS", port: 8080, allLocalListenersAbsent: true, loopbackConnectionRefused: true,
    ipv6TableAbsent, ipv4Probe, ipv6Probe, observedAtUtc: new Date().toISOString() };
}
async function identity(client: pg.Client, expected: Row, configured = false): Promise<Row> {
  const actual = (await client.query(`SELECT current_database() AS database_name,
    (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS database_oid,
    current_schema() AS schema_name, current_user AS database_role,
    current_setting('server_version') AS server_version, inet_server_addr()::text AS server_address,
    inet_server_port()::int AS server_port, pg_postmaster_start_time()::text AS server_started_at,
    pg_backend_pid() AS backend_pid, current_setting('transaction_read_only') AS transaction_read_only,
    to_json(current_schemas(false)) AS search_schemas`)).rows[0];
  check(expected.database_name === "heliumdb" && expected.schema_name === "public", "Identity evidence must target heliumdb/public.");
  check(ID_FIELDS.every((k) => actual[k] === expected[k]) && actual.server_address === null && actual.server_port === null,
    "Runtime DATABASE_URL does not exactly match the API database identity.");
  check(configured ? actual.schema_name === "pg_catalog" && stable(actual.search_schemas) === stable(["pg_catalog", "public"])
    : actual.schema_name === expected.schema_name, "Unexpected default schema/search_path.");
  return { status: "PASS", expectedSha256: digest(ID_FIELDS.map((k) => [k, expected[k]])),
    observedSha256: digest(ID_FIELDS.map((k) => [k, actual[k]])), defaultSchema: actual.schema_name, backendPid: actual.backend_pid, readOnly: actual.transaction_read_only };
}
async function connect(name: string, expected: Row, readOnly: boolean): Promise<pg.Client> {
  check(Boolean(process.env.DATABASE_URL), "Runtime DATABASE_URL is unavailable.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
    application_name: `e1-approved-${name}`, connectionTimeoutMillis: 5000,
    statement_timeout: 15000, query_timeout: 20000,
    options: `-c timezone=UTC -c default_transaction_read_only=${readOnly ? "on" : "off"}` });
  client.on("error", () => undefined);
  try { await client.connect(); await identity(client, expected); return client; }
  catch (error) { await client.end().catch(() => undefined); throw error; }
}
async function exclusive(client: pg.Client, allowed: number[]): Promise<Row> {
  // Control is autocommit: statistics are fresh, not the transaction's cached snapshot.
  const count = Number((await client.query(`SELECT count(*)::int AS count FROM pg_stat_activity
    WHERE backend_type='client backend' AND NOT (pid=ANY($1::int[]))`, [allowed])).rows[0].count);
  check(count === 0, "Other client backends exist; migration requires exclusive maintenance.");
  check(Number((await client.query("SELECT count(*)::int AS count FROM pg_prepared_xacts")).rows[0].count) === 0,
    "Prepared transactions exist; cannot establish exclusive maintenance.");
  return { status: "PASS", otherClientBackends: count, preparedTransactions: 0 };
}
function comparison(expected: Row, observed: Baseline, migrated: boolean): Row {
  const checks: Row = {};
  const compare = (name: string, a: unknown, b: unknown) => {
    checks[name] = { status: stable(a) === stable(b) ? "PASS" : "FAIL", expectedSha256: digest(a), observedSha256: digest(b),
      ...(Array.isArray(a) && Array.isArray(b) ? { expectedCount: a.length, observedCount: b.length } : {}) };
  };
  for (const category of CATEGORIES) {
    const normalize = (rows: Row[]) => migrated && category === "columns" ? rows.map((r) => omit(r, ["ordinal_position"])) : rows;
    compare(category, normalize(expected.catalogue[category]), normalize(observed.catalogue[category]));
  }
  // Rehearsal database identity is deliberately excluded, but source identity is gated separately.
  if (!migrated) compare("databaseIgnoringPhysicalSizeOnly", omit(expected.catalogue.database, ["size_bytes"]), omit(observed.catalogue.database, ["size_bytes"]));
  compare("sequenceState", expected.sequenceState, observed.sequenceState);
  if (expected.supplemental) {
    for (const category of ["views", "types"]) compare(category, expected.supplemental[category], observed.supplemental[category as keyof Baseline["supplemental"]]);
    // pg_dump/setval does not preserve the source sequence WAL preallocation counter.
    // Compare logical state across databases; separately preserve the complete
    // operational sequence state against this run's own preflight below.
    compare("sequenceValues", expected.supplemental.sequenceValues.map((r: Row) => omit(r, ["log_cnt"])),
      observed.supplemental.sequenceValues.map((r) => omit(r, ["log_cnt"])));
    // FK-generated trigger names embed backend-assigned OIDs, unlike user triggers.
    // Compare all their semantic fields and definition with only that generated name normalized.
    const internal = (rows: Row[]) => rows.map((r) => ({ ...omit(r, ["trigger_name"]),
      definition: String(r.definition).replace(/^CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_[ac]_\d+"/, 'CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger"') }));
    compare("internalTriggerSemantics", internal(expected.supplemental.internalTriggers), internal(observed.supplemental.internalTriggers));
  }
  return { status: Object.values(checks).every((v: any) => v.status === "PASS") ? "PASS" : "FAIL", categories: checks,
    tables: observed.catalogue.tables.length, triggers: observed.catalogue.triggers.length };
}
async function conservation(client: pg.Client, before: Row, after: Baseline): Promise<Row> {
  const added = after.catalogue.columns.filter((r) => r.schema === "public" && r.table === "movimientos_credito" && ADDED_COLUMNS.includes(String(r.column)));
  check(added.length === 7 && added.every((r) => r.not_null === false && r.default_expression === null), "Seven nullable ledger columns without defaults required.");
  check((await client.query(`SELECT count(*)::text AS count FROM public.movimientos_credito WHERE
    ${ADDED_COLUMNS.map((c) => `"${c}" IS NOT NULL`).join(" OR ")}`)).rows[0].count === "0", "Historical E1 ledger columns are not all NULL.");
  const ledger = (await client.query(`WITH canonical_rows AS (
    SELECT (to_jsonb(t)-$1::text[])::text AS canonical FROM public.movimientos_credito t)
    SELECT count(*)::text AS count, md5(COALESCE(string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)), '')) AS hash FROM canonical_rows`, [ADDED_COLUMNS])).rows[0];
  const projected = after.catalogue.tableEvidence.filter((r) => !NEW_TABLES.includes(r.table)).map((r) =>
    r.schema === "public" && r.table === "movimientos_credito" ? { ...r, count: ledger.count, orderedCanonicalRowHash: ledger.hash } : r);
  const empty = after.catalogue.tableEvidence.filter((r) => r.schema === "public" && NEW_TABLES.includes(r.table));
  check(after.catalogue.tables.length === 66 && after.catalogue.triggers.length === 23 && empty.length === 3 && empty.every((r) => r.count === "0"), "Postflight must contain 66 tables, 23 triggers and three empty new tables.");
  check(stable(projected) === stable(before.catalogue.tableEvidence), "Original 63 tables changed: full-row projected hashes/counts differ.");
  return { status: "PASS", sourceBefore: { tables: 63, triggers: 17 }, sourceAfter: { tables: 66, triggers: 23 },
    all63FullRowHashesIncludeDatesAmountsAndEveryOriginalField: true, projectedExpectedSha256: digest(before.catalogue.tableEvidence),
    projectedObservedSha256: digest(projected), newTables: empty, sevenNewColumnsAllNull: true, projectedLedger: ledger };
}
async function prerequisites(): Promise<{ expected: Row; before: Row; migrated: Row; statements: ReturnType<typeof split>; evidence: Row }> {
  const approval = await fs.readFile(resolve(OUT, "autorizacion.md"), "utf8");
  check(sha(approval) === APPROVAL_SHA && approval.includes(SQL_PATH) && approval.includes(SQL_SHA) && approval.includes("heliumdb") && /\b27\b/.test(approval),
    "Authorization must contain the literal approved SQL path, exact SHA-256, heliumdb and 27 statements.");
  const bytes = await fs.readFile(resolve(ROOT, SQL_PATH));
  check(sha(bytes) === SQL_SHA, "Approved SQL SHA-256 mismatch.");
  const statements = split(bytes.toString("utf8"), 27);
  const rehearsed = split(await fs.readFile(resolve(REHEARSAL, "rehearsaldraftpatch/01.sql"), "utf8"), 27);
  check(statements.slice(7).every((s, i) => s.sql === rehearsed[i + 7]!.sql), "S08-S27 differ from the successful rehearsal.");
  const metadata = await json(resolve(REHEARSAL, "block2-restore-metadata.json"));
  const drive = await json(resolve(REHEARSAL, "drive-verification.json"));
  const rehearsal = await json(resolve(REHEARSAL, "ensayo.json"));
  const state = await json(resolve(BACKUP, "state.json"));
  check(metadata.status === "PASS" && drive.status === "PASS" && rehearsal.status === "PASS" && state.restoreClusterKeptAlive === true, "Backup, Drive, rehearsal and retained clone evidence must be PASS.");
  const archive = metadata.archive;
  check(drive.dumpSha256 === archive.sha256 && drive.downloadSha256 === archive.sha256, "Backup and Drive hashes differ.");
  for (const path of [resolve(ROOT, archive.file), resolve(BACKUP, "drive-downloaded.dump")]) {
    check(await fileSha(path) === archive.sha256 && (await fs.stat(path)).size === archive.sizeBytes, "Local backup/download bytes differ from verified Drive backup.");
  }
  check((await fs.stat(metadata.restore.clusterDirectory)).isDirectory()
    && (await fs.stat(resolve(metadata.restore.clusterDirectory, "PG_VERSION"))).isFile()
    && (await fs.stat(`${metadata.restore.socketDirectory}/.s.PGSQL.${metadata.restore.port ?? 5432}`)).isSocket(), "Retained disposable clone files/socket absent.");
  const source = (await json(resolve(BACKUP, "source-snapshot.json"))).source;
  const before = { catalogue: source.catalogue, sequenceState: source.sequenceStateAfterDump };
  const migrated = await json(resolve(REHEARSAL, "migrated.json"));
  check(before.catalogue.tables.length === 63 && before.catalogue.triggers.length === 17 && before.sequenceState.length === 47 && migrated.catalogue.tables.length === 66 && migrated.catalogue.triggers.length === 23, "Unexpected reference snapshot counts.");
  const paths = [resolve(OUT, "autorizacion.md"), resolve(ROOT, SQL_PATH), resolve(BACKUP, "source-snapshot.json"),
    resolve(REHEARSAL, "migrated.json"), resolve(REHEARSAL, "api-pool-identity.json"), fileURLToPath(import.meta.url),
    resolve(ROOT, "scripts/src/prompt-h-block2-backup-restore.mts"), resolve(ROOT, "scripts/src/e1-disposable-rehearsal.mts")];
  const hashes = await Promise.all(paths.map(async (path) => ({ path: path.slice(ROOT.length + 1), sha256: await fileSha(path) })));
  return { expected: (await json(resolve(REHEARSAL, "api-pool-identity.json"))).identity, before, migrated, statements,
    evidence: { hashes, archiveSha256: archive.sha256, cloneKeptFilesystemOnly: true, remoteDriveNotRecontacted: true } };
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const infrastructureRetry = args.includes("--retry-infrastructure-only");
  const nameArrayRetry = args.includes("--retry-name-array-only");
  check(!(infrastructureRetry && nameArrayRetry) && args.includes("--execute-approved-migration")
    && args.length === (infrastructureRetry || nameArrayRetry ? 2 : 1)
    && args.every((arg) => ["--execute-approved-migration", "--retry-infrastructure-only", "--retry-name-array-only"].includes(arg)),
    "No action taken: --execute-approved-migration required; at most one explicit narrowly gated retry flag may accompany it.");
  const input = await prerequisites();
  if (infrastructureRetry) {
    const previous = await json(resolve(OUT, "ejecucion.json"));
    const previousClaim = await json(resolve(OUT, "migration-run-claim.json"));
    check(previous.status === "FAIL" && previous.error?.code === "ENOENT" && previous.resolutionError?.code === "ENOENT"
      && !Object.hasOwn(previous, "apiBefore") && !Object.hasOwn(previous, "apiAfter")
      && Array.isArray(previous.statements) && previous.statements.length === 0
      && previous.noDDL === true && previous.ddlStatementsSent === 0 && previous.commitSent === false
      && previous.commitResponse === false && previous.watchdog?.fired === false && previous.transactionTotalMs === 0
      && previous.preflightStatus === "FAIL" && previous.sqlSha256 === SQL_SHA && previousClaim.sqlSha256 === SQL_SHA
      && previous.prerequisites?.hashes?.some((r: Row) => r.path === "reports/e1-ejecucion-2026-09-17/autorizacion.md" && r.sha256 === APPROVAL_SHA),
      "Infrastructure retry denied: original evidence must prove ENOENT before any API gate/connection/statement, with exact authorization.");
  }
  if (nameArrayRetry) {
    const previous = await json(resolve(OUT, "ejecucion-after-ipv6-probe.json"));
    const previousClaim = await json(resolve(OUT, "migration-run-claim-after-ipv6-probe.json"));
    const before = previous.expectedBeforeComparison;
    check(previous.status === "FAIL" && previous.error?.message === "Unexpected default schema/search_path."
      && previous.error?.code === null && previous.rollbackUncommittedResponse === true
      && previous.noDDL === true && previous.ddlStatementsSent === 0
      && previous.commitSent === false && previous.commitResponse === false && previous.watchdog?.fired === false
      && previous.preflightStatus === "FAIL" && previous.commitOutcome === "NOT_COMMITTED_VERIFIED"
      && Array.isArray(previous.statements) && previous.statements.length === 6
      && previous.statements.every((s: Row, i: number) => s.id === `S${String(i + 1).padStart(2, "0")}`
        && s.command === (i === 0 ? "BEGIN" : "SET") && s.status === "PASS")
      && before?.status === "PASS" && before.tables === 63 && before.triggers === 17
      && [...CATEGORIES, "databaseIgnoringPhysicalSizeOnly", "sequenceState"].every((k) => {
        const c = before.categories?.[k];
        return c?.status === "PASS" && typeof c.expectedSha256 === "string" && c.expectedSha256 === c.observedSha256;
      })
      && before.categories.sequenceState.expectedCount === 47 && before.categories.sequenceState.observedCount === 47
      && previous.sqlSha256 === SQL_SHA && previousClaim.sqlSha256 === SQL_SHA
      && previous.prerequisites?.hashes?.some((r: Row) => r.path === "reports/e1-ejecucion-2026-09-17/autorizacion.md" && r.sha256 === APPROVAL_SHA),
      "Name-array retry denied: requires exact representation failure after six successful BEGIN/SET blocks, confirmed rollback and full pristine preservation.");
  }
  const claimName = nameArrayRetry ? "migration-run-claim-after-name-array.json"
    : infrastructureRetry ? "migration-run-claim-after-ipv6-probe.json" : "migration-run-claim.json";
  const reportName = nameArrayRetry ? "ejecucion-after-name-array.json"
    : infrastructureRetry ? "ejecucion-after-ipv6-probe.json" : "ejecucion.json";
  const claim = await fs.open(resolve(OUT, claimName), "wx", 0o600);
  await claim.writeFile(JSON.stringify({ startedAtUtc: new Date().toISOString(), sqlSha256: SQL_SHA, pid: process.pid }));
  await claim.close(); // Never remove this claim, even after a failure.
  const report: Row = { status: "FAIL", startedAtUtc: new Date().toISOString(), prerequisites: input.evidence,
    sqlSha256: SQL_SHA, statements: [], commitSent: false, commitResponse: false,
    preflightStatus: "NOT_RUN", ddlStatementsSent: 0, noDDL: true, automaticRetries: 0,
    s08FinishToCommitMs: null, s08FinishToCommitSentMs: null,
    infrastructureRetry, nameArrayRetry, previousEvidencePreserved: infrastructureRetry || nameArrayRetry,
    comparisonExclusions: { source: ["physical database size only"], migrated: ["database metadata (identity checked separately)", "column ordinal_position", "sequence log_cnt only for clone/source semantics; operational preflight/postflight sequence values preserved exactly", "OID-derived internal FK trigger name (all other semantics checked)"] },
    watchdog: { fired: false, budgetMs: 30000 } };
  let control: pg.Client | undefined, client: pg.Client | undefined;
  let preflightInternalTriggers: Row[] | undefined, preflightSequenceValues: Row[] | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, termination: Promise<void> | undefined;
  let started: bigint | undefined, s08: number | undefined;
  const elapsed = () => started === undefined ? 0 : Number(process.hrtime.bigint() - started) / 1e6;
  try {
    report.apiBefore = await apiStopped();
    control = await connect("control", input.expected, true); // Established before BEGIN, as in tested rehearsal.
    client = await connect("migration", input.expected, false);
    const controlPid = (await identity(control, input.expected)).backendPid as number;
    const pid = (await identity(client, input.expected)).backendPid as number;
    report.initialExclusive = await exclusive(control, [pid, controlPid]);
    const terminate = (): Promise<void> => {
      if (termination) return termination;
      report.watchdog.fired = true; report.watchdog.firedAfterBeginMs = elapsed();
      termination = (async () => {
        try {
          const terminateQuery = { text: "SELECT pg_terminate_backend($1, 5000) AS terminated", values: [pid], query_timeout: 7000 };
          const response = await control!.query(terminateQuery);
          report.watchdog.terminateReturned = response.rows[0].terminated === true;
          report.watchdog.backendAbsent = (await control!.query("SELECT NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS absent", [pid])).rows[0].absent === true;
        } catch (error) { report.watchdog.error = safeError(error); }
      })();
      return termination;
    };
    started = process.hrtime.bigint();
    timer = setTimeout(() => { void terminate(); }, 30000);
    for (const statement of input.statements) {
      if (statement.id === "S07") {
        report.preflightIdentity = await identity(client, input.expected, true);
        report.preflightExclusive = await exclusive(control, [pid, controlPid]);
        const baseline = await capture(client, false);
        preflightInternalTriggers = baseline.supplemental.internalTriggers;
        preflightSequenceValues = baseline.supplemental.sequenceValues;
        report.preflight = comparison(input.before, baseline, false);
        check(report.preflight.status === "PASS", "Full pristine source snapshot mismatch before DDL.");
        const e1 = (await client.query(`SELECT count(*)::int AS count FROM (
          SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')
          UNION ALL SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')
          UNION ALL SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')
          UNION ALL SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
          UNION ALL SELECT conname FROM pg_constraint) objects WHERE right(name,3)='_e1'`)).rows[0].count;
        check(e1 === 0, "Existing E1 objects found; no partial/repeated migration allowed.");
        report.preflight.e1Objects = e1;
        report.preflightStatus = "PASS";
      }
      if (["S08", "S09", "S27"].includes(statement.id)) {
        report[`apiBefore${statement.id}`] = await apiStopped();
        report[`exclusiveBefore${statement.id}`] = await exclusive(control, [pid, controlPid]);
      }
      // No awaited work between the budget/flag gate and sending COMMIT.
      if (elapsed() >= 30000 || report.watchdog.fired) { await terminate(); throw new Error("Global watchdog expired; no further statement or COMMIT permitted."); }
      const timing: Row = { id: statement.id, startedAfterBeginMs: elapsed(), status: "FAIL" };
      report.statements.push(timing);
      try {
        if (Number(statement.id.slice(1)) >= 9 && statement.id !== "S27") {
          report.ddlStatementsSent++; report.noDDL = false;
        }
        if (statement.id === "S27") {
          report.commitSent = true; report.commitSentAfterBeginMs = elapsed();
          report.s08FinishToCommitSentMs = s08 === undefined ? null : elapsed() - s08;
        }
        const response = await client.query(statement.sql);
        check(!Array.isArray(response), "Numbered block returned multiple SQL results.");
        timing.command = response.command; timing.status = "PASS";
        if (statement.id === "S08") s08 = elapsed();
        if (statement.id === "S27") {
          check(response.command === "COMMIT", "S27 did not return COMMIT.");
          report.commitResponse = true; report.commitResponseAfterBeginMs = elapsed();
          report.s08FinishToCommitMs = s08 === undefined ? null : elapsed() - s08;
        }
      } catch (error) { timing.error = safeError(error); throw error; }
      finally { timing.elapsedMs = elapsed() - timing.startedAfterBeginMs; }
    }
  } catch (error) {
    report.error = safeError(error);
    if (report.noDDL) report.preflightStatus = "FAIL";
    if (client && !report.commitSent && !report.watchdog.fired) {
      try { await client.query("ROLLBACK"); report.rollbackUncommittedResponse = true; }
      catch (rollbackError) { report.rollbackError = safeError(rollbackError); }
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (termination) await termination;
    await client?.end().catch(() => undefined);
    await control?.end().catch(() => undefined);
    report.transactionTotalMs = elapsed();
    // Fresh read-only connection resolves BOTH commit outcomes, including a lost response.
    let verification: pg.Client | undefined;
    try {
      report.apiAfter = await apiStopped();
      verification = await connect("resolution-readonly", input.expected, true);
      const id = await identity(verification, input.expected);
      check(id.readOnly === "on", "Resolution connection must be read-only.");
      report.resolutionIdentity = id;
      report.resolutionExclusive = await exclusive(verification, [id.backendPid as number]);
      await verification.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const current = await capture(verification, false);
      report.expectedBeforeComparison = comparison(input.before, current, false);
      report.expectedAfterComparison = comparison(input.migrated, current, true);
      if (report.expectedAfterComparison.status === "PASS" && report.expectedBeforeComparison.status !== "PASS") {
        check(report.expectedBeforeComparison.categories.databaseIgnoringPhysicalSizeOnly.status === "PASS",
          "Operational database metadata changed beyond physical size.");
        report.conservation = await conservation(verification, input.before, current);
        check(preflightInternalTriggers !== undefined && preflightInternalTriggers.every((old) =>
          current.supplemental.internalTriggers.some((now) => stable(old) === stable(now))),
          "Pre-existing internal triggers were not preserved exactly, including names.");
        report.conservation.oldInternalTriggersIncludingNamesPreserved = true;
        check(preflightSequenceValues !== undefined &&
          stable(preflightSequenceValues) === stable(current.supplemental.sequenceValues),
          "Operational sequence state changed, including WAL preallocation counters.");
        report.conservation.fullOperationalSequenceStatePreserved = true;
        report.commitOutcome = "COMMITTED_VERIFIED";
        report.status = report.commitSent && !report.watchdog.fired && (!report.commitResponse || report.commitResponseAfterBeginMs < 30000)
          ? "PASS" : "COMMITTED_REQUIRES_REVIEW";
      } else if (report.expectedBeforeComparison.status === "PASS" && report.expectedAfterComparison.status !== "PASS") {
        report.commitOutcome = "NOT_COMMITTED_VERIFIED";
      } else report.commitOutcome = "UNRESOLVED_REQUIRES_MANUAL_REVIEW";
      await verification.query("COMMIT");
      report.apiRemainsStopped = await apiStopped();
    } catch (error) {
      report.status = "FAIL"; report.resolutionError = safeError(error);
      report.commitOutcome ??= "UNRESOLVED_REQUIRES_MANUAL_REVIEW";
    } finally { await verification?.end().catch(() => undefined); }
    report.finishedAtUtc = new Date().toISOString();
    await fs.writeFile(resolve(OUT, reportName), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify({ status: report.status, commitOutcome: report.commitOutcome, report: `reports/e1-ejecucion-2026-09-17/${reportName}` }));
  if (report.status !== "PASS") process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "FAIL", stage: "operator/setup-or-reporting", error: safeError(error), automaticRetries: 0 }));
    process.exitCode = 1;
  });
}