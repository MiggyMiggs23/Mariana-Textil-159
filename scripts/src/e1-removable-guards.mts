/**
 * Inert on import. File-only --review, explicit reviewed-digest --execute.
 * Add/remove/reinstall ONLY three independent guards in the existing clone.
 * Never imports application startup or connects to the operational database.
 */
import assert from "node:assert/strict";
import { readFile, readdir, realpath, stat, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import pg from "pg";
import { TARGET, assertClone, inspectE1, sha256, BACKUP, BACKUP_SHA, APPROVED_SQL, APPROVED_SHA } from "./e1-rehearsal-prepare.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = "reports/e1-guardas-temporales-2026-09-18";
const REPORT = resolve(ROOT, DIR, "resultado-medido.json");
const ACK = "REMOVABLE_GUARDS_EXISTING_CLONE_ONLY_API_PAUSED";
const PRIOR = "reports/e1-ejecucion-2026-09-17/verificacion-aislada-resultados.json";
type Gate = "cash" | "pending" | "attribution";
type Json = Record<string, any>;
const GATES = {
  cash: { table: "movimientos_credito", trigger: "zz_e1_cash_capture_closed", fn: "e1_guard_cash_capture_closed", install: "01-install-cash.sql", remove: "11-remove-cash.sql", type: 5 },
  pending: { table: "cobros_credito_pendientes_e1", trigger: "zz_e1_pending_receipts_closed", fn: "e1_guard_pending_receipts_closed", install: "02-install-pending.sql", remove: "12-remove-pending.sql", type: 4 },
  attribution: { table: "atribuciones_credito_e1", trigger: "zz_e1_historical_attribution_closed", fn: "e1_guard_historical_attribution_closed", install: "03-install-attribution.sql", remove: "13-remove-attribution.sql", type: 4 },
} as const;
const keys = Object.keys(GATES) as Gate[];
const functionNames = keys.map((key) => GATES[key].fn);
const triggerNames = keys.map((key) => GATES[key].trigger);
const sqlPath = (file: string) => `${DIR}/sql/${file}`;
const safeError = (error: any) => ({
  type: typeof error?.name === "string" ? error.name : "Error",
  code: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : undefined,
  detail: "SQL parameters/messages suppressed; inspect named stage and exact case assertions.",
});
function failed(value: any): boolean {
  if (value == null || typeof value !== "object") return false;
  if (value.requiresNonzeroExit === true || ["FAIL", "ERROR", "SKIP", "SKIPPED", "PENDING"].includes(value.status)) return true;
  return Object.values(value).some(failed);
}
async function manifest() {
  const files: string[] = [];
  async function walk(path: string) {
    for (const e of await readdir(resolve(ROOT, path), { withFileTypes: true })) {
      if (e.isDirectory()) await walk(`${path}/${e.name}`);
      else if (e.isFile()) files.push(`${path}/${e.name}`);
      else throw new Error("Source symlink/special file refused");
    }
  }
  for (const path of ["artifacts/api-server/src", "lib/db/src", "lib/api-zod/src"]) await walk(path);
  files.push("scripts/src/e1-removable-guards.mts", "scripts/src/e1-rehearsal-prepare.mts",
    "scripts/src/e1-rehearsal-loader.mts", "scripts/src/e1-rehearsal-evidence-cases.mts",
    APPROVED_SQL, PRIOR, "pnpm-lock.yaml", "scripts/package.json",
    ...keys.flatMap((key) => [sqlPath(GATES[key].install), sqlPath(GATES[key].remove)]));
  const rows = await Promise.all([...new Set(files)].sort().map(async (path) => ({
    path, sha256: sha256(await readFile(resolve(ROOT, path))),
  })));
  return { sha256: sha256(JSON.stringify(rows)), files: rows };
}
async function save(report: Json) {
  await mkdir(dirname(REPORT), { recursive: true });
  await writeFile(`${REPORT}.tmp`, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await rename(`${REPORT}.tmp`, REPORT);
}
function networkGuard() {
  const originalSocket = net.Socket.prototype.connect;
  (net.Socket.prototype as any).connect = function (...args: any[]) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    assert.equal(typeof first === "string" ? first : first?.path, `${TARGET.host}/.s.PGSQL.${TARGET.port}`);
    return originalSocket.apply(this, args as any);
  };
  (net.Server.prototype as any).listen = () => { throw new Error("Listener startup prohibited"); };
  globalThis.fetch = async () => { throw new Error("Outbound fetch prohibited"); };
  const originalConnect = pg.Client.prototype.connect;
  (pg.Client.prototype as any).connect = function (callback?: (error?: Error) => void) {
    const client = this as pg.Client;
    const p = (client as any).connectionParameters;
    const connect = async () => {
      assert.equal(p.host, TARGET.host); assert.equal(Number(p.port), TARGET.port);
      assert.equal(p.database, TARGET.database); assert.equal(p.user, TARGET.user); assert.ok(!p.ssl);
      await (originalConnect as (this: pg.Client) => Promise<pg.Client>).call(client);
      try { await assertClone(client); } catch (error) { await client.end(); throw error; }
    };
    if (callback) { void connect().then(() => callback(), (error) => callback(error)); return; }
    return connect();
  };
  syncBuiltinESMExports();
}
function connection(application_name: string) {
  return {
    host: TARGET.host, port: TARGET.port, database: TARGET.database, user: TARGET.user,
    ssl: false as const, connectionTimeoutMillis: 5000, application_name,
    options: "-c timezone=UTC -c search_path=public,pg_catalog",
    password: async (): Promise<string> => { throw new Error("Password authentication prohibited"); },
  };
}

async function rowsSnapshot(client: any) {
  const tables = (await client.query(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`)).rows;
  const result: Json = {};
  for (const { name } of tables) {
    const table = `"${String(name).replace(/"/g, '""')}"`;
    // Aggregate the complete row multiset in PostgreSQL; do not materialize
    // application rows or one JS object per row in the verifier.
    result[name] = (await client.query(`SELECT count(*)::text AS count,
      md5(COALESCE(string_agg(digest,'' ORDER BY digest),'')) AS digest
      FROM (SELECT md5(to_jsonb(t)::text) AS digest FROM public.${table} t) row_digests`)).rows[0];
  }
  return { hash: sha256(JSON.stringify(result)), counts: Object.fromEntries(Object.entries(result)
    .map(([table, row]: any) => [table, row.count])) };
}
async function permanentDefinitions(client: any) {
  const functions = (await client.query(`SELECT p.proname,p.prokind,pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT (p.proname=ANY($1::text[]))
    ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)`, [functionNames])).rows;
  const triggers = (await client.query(`SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND NOT(t.tgname=ANY($1::text[]))
    ORDER BY c.relname,t.tgname`, [triggerNames])).rows;
  return { hash: sha256(JSON.stringify({ functions, triggers })), functionCount: functions.length, triggerCount: triggers.length };
}
async function historical(client: any) {
  const result = await client.query(`SELECT id,md5(to_jsonb(m)::text) AS digest FROM public.movimientos_credito m
    WHERE sitio_origen_id IS NULL AND sesion_caja_id IS NULL AND naturaleza IS NULL
      AND operacion_productor IS NULL AND operacion_clave IS NULL AND nota_origen_id IS NULL
      AND origen_justificacion IS NULL ORDER BY id`);
  assert.equal(result.rowCount, 3, "Exactly three original unclassified histories required");
  return { count: result.rowCount, hash: sha256(JSON.stringify(result.rows)) };
}
async function guardState(client: any) {
  const functions = (await client.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) ORDER BY p.proname`, [functionNames])).rows;
  const triggers = (await client.query(`SELECT c.relname,t.tgname,t.tgenabled,t.tgtype,
      p.proname,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND t.tgname=ANY($1::text[]) ORDER BY t.tgname`, [triggerNames])).rows;
  return { functions, triggers };
}
function assertState(state: any, present: Gate[]) {
  assert.equal(state.functions.length, present.length); assert.equal(state.triggers.length, present.length);
  for (const key of present) {
    const g = GATES[key], f = state.functions.find((r: any) => r.proname === g.fn);
    const t = state.triggers.find((r: any) => r.tgname === g.trigger);
    assert.ok(f && t, `Missing removable guard ${key}`);
    assert.equal(t.relname, g.table); assert.equal(t.proname, g.fn);
    assert.equal(Number(t.tgtype), g.type); assert.equal(t.tgenabled, "O");
  }
}

/** Separate supervisor can terminate ONLY this identified clone DDL backend.
 * No retry. Any uncertain COMMIT halts subsequent DDL until manual inspection. */
async function measuredDDL(supervisor: pg.Client, report: Json, name: string, files: string[], tables: string[]) {
  const app = `e1-removable-ddl-${name}`;
  const client = new pg.Client(connection(app));
  const timing: Json = { name, status: "RUNNING", files, tables, commitSent: false, watchdogFired: false };
  report.transactions.push(timing);
  let timer: ReturnType<typeof setTimeout> | undefined, supervision: Promise<void> | undefined;
  let pid = 0, beginAt = 0, lockAt = 0;
  client.on("error", (error) => { timing.connectionError = safeError(error); });
  try {
    await client.connect();
    pid = Number((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    timing.backendPid = pid;
    beginAt = performance.now();
    timer = setTimeout(() => {
      timing.watchdogFired = true;
      timing.watchdogAfterBeginMs = performance.now() - beginAt;
      supervision = (async () => {
        const r = await supervisor.query(`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
          WHERE pid=$1 AND datname=$2 AND application_name=$3`, [pid, TARGET.database, app]);
        timing.terminationRequested = r.rows[0]?.terminated === true;
      })().catch((error) => {
        timing.supervisorError = safeError(error);
        void client.end().catch((closeError) => { timing.forcedCloseError = safeError(closeError); });
      });
    }, 30_000);
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='15s'; SET LOCAL idle_in_transaction_session_timeout='5s'");
    const waitAt = performance.now();
    await client.query(`LOCK TABLE ${[...tables].sort().map((t) => `public."${t}"`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    lockAt = performance.now();
    timing.lockWaitAndAcquireMs = lockAt - waitAt;
    for (const file of files) {
      const at = performance.now();
      await client.query(await readFile(resolve(ROOT, file), "utf8"));
      (timing.statements ??= []).push({ file, elapsedMs: performance.now() - at });
    }
    assert.equal(timing.watchdogFired, false, "DDL watchdog already fired");
    timing.commitSent = true;
    timing.commitSentAfterBeginMs = performance.now() - beginAt;
    await client.query("COMMIT");
    timing.commitAcknowledged = true;
    timing.terminalAfterBeginMs = performance.now() - beginAt;
    timing.lockHeldThroughCommitAckMs = performance.now() - lockAt;
    assert.equal(timing.watchdogFired, false, "Watchdog/COMMIT race; inspect outcome manually");
    timing.status = "PASS";
  } catch (error) {
    timing.status = "FAIL"; timing.error = safeError(error);
    timing.commitOutcome = timing.commitAcknowledged ? "COMMITTED" : timing.commitSent ? "AMBIGUOUS_STOP_NO_RETRY" : "NOT_SENT";
    if (!timing.commitSent && !timing.watchdogFired) {
      try { await client.query("ROLLBACK"); timing.rollbackAcknowledged = true; }
      catch (rollbackError) { timing.rollbackError = safeError(rollbackError); }
    }
    timing.terminalAfterBeginMs = beginAt ? performance.now() - beginAt : null;
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (supervision) await supervision;
    await client.end();
    if (pid) {
      for (let poll = 0; poll < 20; poll++) {
        timing.backendAbsent = (await supervisor.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0].n === 0;
        if (timing.backendAbsent) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      assert.equal(timing.backendAbsent, true, "DDL backend did not terminate; no further writes permitted");
    }
    await save(report);
  }
}

async function main() {
  const mode = process.argv[2];
  assert.ok(mode === "--review" || mode === "--execute", "Use --review or --execute <digest> <ack>");
  const sources = await manifest();
  assert.equal(sha256(await readFile(resolve(ROOT, APPROVED_SQL))), APPROVED_SHA);
  assert.equal(sha256(await readFile(resolve(ROOT, BACKUP))), BACKUP_SHA);
  if (mode === "--review") {
    console.log(JSON.stringify({ status: "PREPARED_NOT_EXECUTED", target: TARGET, source: sources,
      command: `cd scripts && env -u NODE_OPTIONS node --import tsx src/e1-removable-guards.mts --execute ${sources.sha256} ${ACK}`,
      report: relative(ROOT, REPORT) }, null, 2));
    return;
  }
  assert.equal(process.argv.length, 5); assert.equal(process.argv[3], sources.sha256);
  assert.equal(process.argv[4], ACK);
  assert.equal(await realpath(TARGET.host), TARGET.host); assert.equal(await realpath(TARGET.directory), TARGET.directory);
  assert.ok((await stat(`${TARGET.host}/.s.PGSQL.${TARGET.port}`)).isSocket());
  networkGuard();
  const report: Json = { status: "RUNNING", startedAt: new Date().toISOString(), source: sources, target: TARGET,
    transactions: [], phases: [], operationalConnections: 0, automaticRetries: 0 };
  const supervisor = new pg.Client({ ...connection("e1-removable-supervisor"), statement_timeout: 5000, query_timeout: 7000 });
  const pool = new pg.Pool({ ...connection("e1-removable-probes"), max: 4, statement_timeout: 15000, query_timeout: 20000 });
  let fail = false, connected = false, baseline: Json | undefined;
  const onError = (error: any) => { fail = true; (report.connectionErrors ??= []).push(safeError(error)); };
  supervisor.on("error", onError); pool.on("error", onError);
  const totalWatchdog = setTimeout(() => {
    report.status = "FAIL"; report.watchdog = "300-second total budget exhausted; no retry, inspect retained guard state";
    void (async () => {
      try {
        // Terminate only this rehearsal's named backends in the pinned clone,
        // before exiting. Do not guess a compensating DDL after an ambiguous
        // COMMIT; retain the failure and actual state for manual inspection.
        if (connected) {
          const ownedApps = ["e1-removable-probes", "e1-removable-ddl-install-all",
            ...keys.flatMap((key) => [`e1-removable-ddl-remove-${key}`, `e1-removable-ddl-reinstall-${key}`])];
          report.totalWatchdogTermination = (await supervisor.query(
            `SELECT pid,pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
             WHERE datname=$1 AND application_name=ANY($2::text[]) AND pid<>pg_backend_pid()`,
            [TARGET.database, ownedApps])).rows;
          report.totalWatchdogGuardState = await guardState(supervisor);
        }
      } catch (error) { report.totalWatchdogInspectionError = safeError(error); }
      finally { report.status = "FAIL"; await save(report); process.exit(124); }
    })();
  }, 300_000);
  async function preservation(phase: string) {
    const now = { rows: await rowsSnapshot(supervisor), permanent: await permanentDefinitions(supervisor), history: await historical(supervisor) };
    assert.deepEqual(now, baseline, `Existing clone state changed during ${phase}`);
    return { status: "PASS", ...now };
  }
  try {
    await supervisor.connect(); connected = true;
    report.identity = await assertClone(supervisor);
    const existing = await inspectE1(supervisor);
    assert.equal(existing.operations, "operaciones_credito_e1"); assert.equal(existing.columns, 7);
    assert.equal((await supervisor.query("SELECT count(*)::int AS n FROM movimientos_credito")).rows[0].n, 16);
    assert.equal((await supervisor.query("SELECT count(*)::int AS n FROM operaciones_credito_e1")).rows[0].n, 13);
    const ledger = (await supervisor.query("SELECT id,md5(to_jsonb(m)::text) AS digest FROM movimientos_credito m ORDER BY id")).rows;
    const previous = JSON.parse(await readFile(resolve(ROOT, PRIOR), "utf8")).modules.evidence.preservationSummary.details.after;
    assert.equal(sha256(JSON.stringify(ledger)), previous.ledgerHash, "Prior trial ledger changed");
    const previousGuards = (await supervisor.query(`SELECT t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS trigger,
      pg_get_functiondef(t.tgfoid) AS function FROM pg_trigger t WHERE NOT t.tgisinternal
      AND t.tgrelid=ANY(ARRAY['public.movimientos_credito'::regclass,'public.operaciones_credito_e1'::regclass,
        'public.cobros_credito_pendientes_e1'::regclass,'public.atribuciones_credito_e1'::regclass])
      ORDER BY t.tgrelid::text,t.tgname`)).rows;
    const previousContext = (await supervisor.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='validar_contexto_credito_e1' ORDER BY p.oid`)).rows;
    assert.equal(sha256(JSON.stringify({ triggers: previousGuards, contextFunctions: previousContext })),
      previous.guardDefinitionsHash, "Permanent E1 guards changed since the prior trial");
    assert.ok(previousGuards.every((row) => ["O", "A"].includes(row.tgenabled)));
    assert.equal((await supervisor.query(`SELECT
      (SELECT count(*)::int FROM cobros_credito_pendientes_e1)+(SELECT count(*)::int FROM atribuciones_credito_e1) AS n`)).rows[0].n, 0);
    assertState(await guardState(supervisor), []);
    baseline = { rows: await rowsSnapshot(supervisor), permanent: await permanentDefinitions(supervisor), history: await historical(supervisor) };
    report.baseline = baseline;

    await measuredDDL(supervisor, report, "install-all", keys.map((key) => sqlPath(GATES[key].install)), keys.map((key) => GATES[key].table));
    const installed = await guardState(supervisor); assertState(installed, keys);
    report.installedDefinitionsHash = sha256(JSON.stringify(installed));
    const evidence = await import("./e1-rehearsal-evidence-cases.mts");
    assert.equal(typeof evidence.runEvidenceGuardProbes, "function", "Probe interface missing");
    assert.equal(typeof evidence.runEvidenceGuardCompatibility, "function", "Compatibility interface missing");
    async function probes(phase: string, expectedOpenGate: Gate | null, kind: "full" | "probes" | "compatibility" = "probes") {
      const cases: any[] = [];
      const entry: Json = { phase, expectedOpenGate, status: "RUNNING" };
      report.phases.push(entry);
      try {
        const result = kind === "full"
          ? await evidence.runEvidenceCases({ pool, record: (r: any) => { cases.push(r); } })
          : kind === "compatibility"
          ? await evidence.runEvidenceGuardCompatibility({ pool, phase, record: (r: any) => { cases.push(r); } })
          : await evidence.runEvidenceGuardProbes({ pool, phase, expectedOpenGate, record: (r: any) => { cases.push(r); } });
        const returnedCases = result.cases ?? cases;
        assert.equal(returnedCases.length, kind === "full" ? 24 : kind === "compatibility" ? 9 : 6,
          `Incomplete case inventory for ${phase}`);
        assert.equal(new Set(returnedCases.map((item: any) => item.name)).size, returnedCases.length,
          `Duplicate case names in ${phase}`);
        for (const r of cases) assert.deepEqual(returnedCases.find((c: any) => c.name === r.name), r);
        const { cases: _duplicates, ...metadata } = result;
        entry.result = { ...metadata, cases: returnedCases };
        entry.status = failed(result) || failed(cases) ? "FAIL" : "PASS";
        if (entry.status === "FAIL") fail = true;
      } catch (error) {
        fail = true; entry.status = "FAIL"; entry.error = safeError(error); entry.cases = cases;
      }
      entry.preservation = await preservation(phase);
      const state = await guardState(supervisor);
      assertState(state, keys.filter((key) => key !== expectedOpenGate));
      if (expectedOpenGate === null) assert.deepEqual(state, installed, "Reinstalled definitions differ");
      await save(report);
    }
    await probes("full-existing-evidence-suite", null, "full");
    await probes("all-installed", null);
    await probes("all-installed-compatible-producers", null, "compatibility");
    for (const key of keys) {
      await measuredDDL(supervisor, report, `remove-${key}`, [sqlPath(GATES[key].remove)], [GATES[key].table]);
      // Probes record assertion failures and return; planned reinstall is not a
      // failed-DDL retry. A DDL exception exits the entire sequence immediately.
      try { await probes(`${key}-removed`, key); }
      finally {
        await measuredDDL(supervisor, report, `reinstall-${key}`, [sqlPath(GATES[key].install)], [GATES[key].table]);
      }
      await probes(`${key}-reinstalled`, null);
    }
    await probes("final-compatible-producers", null, "compatibility");
    report.finalPreservation = await preservation("final");
    report.finalGuardState = await guardState(supervisor);
    assert.deepEqual(report.finalGuardState, installed);
    assert.equal((await manifest()).sha256, sources.sha256, "Source changed during measured trial");
  } catch (error) {
    fail = true; report.terminalError = safeError(error);
    if (connected) {
      try {
        report.finalGuardState = await guardState(supervisor);
        if (baseline) report.finalPreservation = await preservation("failure-final");
      } catch (lastError) { report.finalInspectionError = safeError(lastError); }
    }
  } finally {
    try { await pool.end(); } catch (error) { fail = true; report.poolCloseError = safeError(error); }
    try { await supervisor.end(); } catch (error) { fail = true; report.supervisorCloseError = safeError(error); }
    clearTimeout(totalWatchdog);
    report.status = fail ? "FAIL" : "PASS"; report.finishedAt = new Date().toISOString();
    await save(report);
    console.log(JSON.stringify({ status: report.status, report: relative(ROOT, REPORT) }));
    process.exitCode = fail ? 1 : 0;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "REFUSED_BEFORE_RUN", error: safeError(error) }));
    process.exitCode = 1;
  });
}