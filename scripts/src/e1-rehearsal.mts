/**
 * Operator entrypoint. --review is file-only; --execute requires the exact
 * reviewed source digest and explicit acknowledgement. No API startup.
 */
import assert from "node:assert/strict";
import { readFile, readdir, realpath, stat, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";
import pg from "pg";
import {
  TARGET, BACKUP, BACKUP_SHA, APPROVED_SQL, APPROVED_SHA,
  assertClone, loadCloneSql, prepareE1, sha256,
} from "./e1-rehearsal-prepare.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT = resolve(ROOT, "reports/e1-ejecucion-2026-09-17/verificacion-aislada-resultados.json");
const ACK = "EXISTING_DISPOSABLE_CLONE_ONLY_API_PAUSED";
const MODULES = [
  ["pos", "scripts/src/e1-rehearsal-pos-cases.mts", "runPosCases"],
  ["customer", "scripts/src/e1-rehearsal-customer-cases.mts", "runCustomerCases"],
  ["evidence", "scripts/src/e1-rehearsal-evidence-cases.mts", "runEvidenceCases"],
] as const;
type RehearsalResult = Awaited<ReturnType<
  typeof import("./e1-rehearsal-pos-cases.mts").runPosCases |
  typeof import("./e1-rehearsal-customer-cases.mts").runCustomerCases |
  typeof import("./e1-rehearsal-evidence-cases.mts").runEvidenceCases
>>;
type RehearsalCase = RehearsalResult["cases"][number];
type Json = Record<string, any>;

async function sourceManifest() {
  const files: string[] = [];
  async function walk(path: string) {
    for (const entry of await readdir(resolve(ROOT, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error("Source symlink/special file refused");
    }
  }
  for (const directory of ["artifacts/api-server/src", "lib/db/src", "lib/api-zod/src"]) await walk(directory);
  files.push(
    ...MODULES.map(([, path]) => path),
    "scripts/src/e1-rehearsal.mts", "scripts/src/e1-rehearsal-prepare.mts", "scripts/src/e1-rehearsal-loader.mts",
    APPROVED_SQL, "pnpm-lock.yaml", "scripts/package.json", "artifacts/api-server/package.json",
    "lib/db/package.json", "lib/api-zod/package.json",
  );
  const rows = await Promise.all([...new Set(files)].sort().map(async (path) => ({
    path, sha256: sha256(await readFile(resolve(ROOT, path))),
  })));
  return { sha256: sha256(JSON.stringify(rows)), files: rows };
}

/** Reject all network sockets other than the one exact Unix PostgreSQL socket.
 * pg additionally validates DB/user before connecting, then live identity before
 * delivering that connection to a pool/client caller. */
function installGuards() {
  const socket = `${TARGET.host}/.s.PGSQL.${TARGET.port}`;
  const originalSocketConnect = net.Socket.prototype.connect;
  (net.Socket.prototype as any).connect = function (...args: any[]) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const path = typeof first === "string" ? first : first?.path;
    assert.equal(path, socket, "REFUSED: only the exact clone Unix socket is allowed");
    return originalSocketConnect.apply(this, args as any);
  };
  (net.Server.prototype as any).listen = function () { throw new Error("REFUSED: API/listener startup"); };
  globalThis.fetch = async () => { throw new Error("REFUSED: outbound fetch"); };
  const originalConnect: (this: pg.Client) => Promise<pg.Client> = pg.Client.prototype.connect;
  (pg.Client.prototype as any).connect = function (callback?: (error?: Error) => void) {
    const c = this as pg.Client;
    const p = (c as any).connectionParameters;
    const run = async () => {
      assert.equal(p.host, TARGET.host, "REFUSED: unexpected pg host");
      assert.equal(Number(p.port), TARGET.port);
      assert.equal(p.database, TARGET.database, "REFUSED: unexpected pg database");
      assert.equal(p.user, TARGET.user);
      assert.ok(!p.ssl, "REFUSED: Unix clone must not use SSL");
      await originalConnect.call(c);
      try { await assertClone(c); } catch (error) { await c.end(); throw error; }
    };
    if (callback) { void run().then(() => callback(), (error) => callback(error)); return; }
    return run();
  };
  syncBuiltinESMExports();
}

function safeFailure(error: any) {
  // Drizzle/pg error messages can include bound credentials. Never persist them.
  return {
    type: typeof error?.name === "string" ? error.name : "Error",
    code: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : undefined,
    detail: "Failure details suppressed to avoid SQL parameters or credential disclosure; inspect named stage/case.",
  };
}

async function atomicReport(report: Json) {
  await mkdir(dirname(REPORT), { recursive: true });
  const temporary = `${REPORT}.tmp`;
  await writeFile(temporary, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await rename(temporary, REPORT);
}

/** A multiset of complete original row hashes proves original records weren't
 * changed/deleted; only synthetic additions are permitted by this rehearsal. */
async function snapshotOriginalRows(client: any) {
  const { rows: tables } = await client.query(`SELECT c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`);
  const result: Record<string, Record<string, number>> = {};
  for (const { name } of tables) {
    const identifier = `"${String(name).replace(/"/g, '""')}"`;
    const { rows } = await client.query(`SELECT md5(to_jsonb(t)::text) AS digest,count(*)::int AS count
      FROM public.${identifier} t GROUP BY md5(to_jsonb(t)::text) ORDER BY digest`);
    result[name] = Object.fromEntries(rows.map((r: any) => [r.digest, r.count]));
  }
  return result;
}

function assertOriginalRows(before: Record<string, Record<string, number>>, after: Record<string, Record<string, number>>) {
  const changes: Json[] = [];
  for (const [table, hashes] of Object.entries(before)) {
    for (const [hash, count] of Object.entries(hashes))
      assert.ok((after[table]?.[hash] ?? 0) >= count, `Original row changed/deleted in ${table}`);
    const countBefore = Object.values(hashes).reduce((a, b) => a + b, 0);
    const countAfter = Object.values(after[table] ?? {}).reduce((a, b) => a + b, 0);
    if (countAfter !== countBefore) changes.push({ table, originalCount: countBefore, finalCount: countAfter, additions: countAfter - countBefore });
  }
  return changes;
}

function returnedFailure(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if (value.requiresNonzeroExit === true || value.status === "FAIL" || value.status === "ERROR" ||
      value.status === "PENDING" || value.status === "SKIP" || value.status === "SKIPPED") return true;
  return Object.values(value).some(returnedFailure);
}

async function main() {
  const mode = process.argv[2];
  assert.ok(mode === "--review" || mode === "--execute", "Use --review or --execute <source-sha256> <ack>");
  const manifest = await sourceManifest();
  const sql = await loadCloneSql(ROOT);
  const archive = await readFile(resolve(ROOT, BACKUP));
  assert.equal(archive.length, 464990);
  assert.equal(sha256(archive), BACKUP_SHA);
  if (mode === "--review") {
    // Pure file work: no socket guard, production import or DB connection.
    console.log(JSON.stringify({
      status: "PREPARED_NOT_EXECUTED", target: TARGET, source: manifest,
      approvedSqlSha256: APPROVED_SHA, cloneSqlSha256: sql.adaptedSha,
      command: `cd scripts && env -u NODE_OPTIONS node --import tsx src/e1-rehearsal.mts --execute ${manifest.sha256} ${ACK}`,
      report: relative(ROOT, REPORT),
    }, null, 2));
    return;
  }
  assert.equal(process.argv.length, 5, "Exact source digest and acknowledgement required");
  assert.equal(process.argv[3], manifest.sha256, "Source changed since review; execution refused");
  assert.equal(process.argv[4], ACK, "API-paused/disposable-clone acknowledgement required");
  assert.equal(await realpath(TARGET.host), TARGET.host, "Symlinked socket directory refused");
  assert.equal(await realpath(TARGET.directory), TARGET.directory, "Symlinked cluster directory refused");
  assert.ok((await stat(`${TARGET.host}/.s.PGSQL.${TARGET.port}`)).isSocket());
  installGuards();

  // Never invoke the generic test isolation guard: it queries the operational DB.
  // This process has a stronger fixed-target per-connection guard above.
  for (const key of ["TEST_DATABASE_URL", "APPLICATION_DATABASE_URL", "REQUIRE_ISOLATED_TEST_DATABASE",
    "TEST_DATABASE_PREPARATION_PHASE", "PGHOST", "PGHOSTADDR", "PGDATABASE", "PGUSER", "PGPASSWORD",
    "PGSERVICE", "PGSERVICEFILE", "PGSSLMODE", "PGOPTIONS"]) delete process.env[key];
  process.env.NODE_ENV = "e1-rehearsal";
  process.env.DATABASE_URL = `postgresql://${TARGET.user}@localhost/${TARGET.database}?host=${encodeURIComponent(TARGET.host)}&port=${TARGET.port}`;
  process.env.DB_POOL_MAX = "4";
  process.env.DB_STATEMENT_TIMEOUT_MS = "15000";
  process.env.DB_QUERY_TIMEOUT_MS = "20000";
  process.env.TZ = "UTC";

  const report: Json = {
    status: "RUNNING", startedAt: new Date().toISOString(), source: manifest,
    target: TARGET, approvedSqlSha256: APPROVED_SHA, cloneSqlSha256: sql.adaptedSha,
    stages: [], modules: {}, operationalConnections: 0,
  };
  let control: pg.Client | undefined;
  let pool: pg.Pool | undefined;
  let stage = "connect";
  let originals: Awaited<ReturnType<typeof snapshotOriginalRows>> | undefined;
  let failed = false;
  const watchdog = setTimeout(() => {
    report.status = "FAIL";
    report.watchdog = "300-second budget exhausted; process termination will close transactions. Confirm any sent COMMIT outcome before retry.";
    void atomicReport(report).finally(() => process.exit(124));
  }, 300_000);
  try {
    control = new pg.Client({
      host: TARGET.host, port: TARGET.port, database: TARGET.database, user: TARGET.user, ssl: false,
      password: async () => { throw new Error("REFUSED: clone requested a password"); },
      connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000,
      options: "-c timezone=UTC -c search_path=public,pg_catalog",
    });
    control.on("error", (error) => {
      failed = true;
      report.connectionError = safeFailure(error);
    });
    await control.connect();
    report.identity = await assertClone(control);
    await control.query("BEGIN READ ONLY");
    const { rows: [{ count: historyCount }] } = await control.query("SELECT count(*)::int AS count FROM public.movimientos_credito");
    assert.equal(historyCount, 3, "Expected pristine three-row original ledger");
    await control.query("COMMIT");
    report.stages.push({ name: stage, status: "PASS" });

    stage = "approved-e1-ddl";
    report.ddl = await prepareE1(control, ROOT);
    const { rows: [{ unclassified }] } = await control.query(`SELECT count(*)::int AS unclassified
      FROM public.movimientos_credito WHERE sitio_origen_id IS NULL AND sesion_caja_id IS NULL
      AND naturaleza IS NULL AND operacion_productor IS NULL AND operacion_clave IS NULL
      AND nota_origen_id IS NULL AND origen_justificacion IS NULL`);
    assert.equal(unclassified, 3, "All three historical rows must remain unclassified");
    report.stages.push({ name: stage, status: "PASS" });
    originals = await snapshotOriginalRows(control);
    report.originalRowsFingerprint = sha256(JSON.stringify(originals));

    stage = "source-bound-loader";
    pool = new pg.Pool({
      host: TARGET.host, port: TARGET.port, database: TARGET.database, user: TARGET.user, ssl: false,
      max: 4, connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000,
      options: "-c timezone=UTC -c search_path=public,pg_catalog",
      password: async () => { throw new Error("REFUSED: clone requested password authentication"); },
    });
    pool.on("error", (error: any) => {
      failed = true;
      report.productionPoolError = safeFailure(error);
    });
    await assertClone(pool);
    const { createRehearsalLoader } = await import("./e1-rehearsal-loader.mts");
    const loader = createRehearsalLoader({ pool, workspaceRoot: ROOT });
    const modules = await Promise.all(MODULES.map(async ([name, , entrypoint]) => {
      // Literal imports retain the actual module contracts; still loaded only
      // after the destination guards and clone identity checks above.
      switch (name) {
        case "pos": {
          const module = await import("./e1-rehearsal-pos-cases.mts");
          return { name, entrypoint, run: module.runPosCases, fixtureSql: module.POS_FIXTURE_SQL };
        }
        case "customer": {
          const module = await import("./e1-rehearsal-customer-cases.mts");
          return { name, entrypoint, run: module.runCustomerCases };
        }
        case "evidence": {
          const module = await import("./e1-rehearsal-evidence-cases.mts");
          return { name, entrypoint, run: module.runEvidenceCases };
        }
      }
    }));
    for (const { name, run, entrypoint } of modules)
      assert.equal(typeof run, "function", `Missing ${entrypoint}: ${name}`);
    report.stages.push({ name: stage, status: "PASS" });

    for (const module of modules) {
      const { name, run } = module;
      stage = `cases:${name}`;
      const recorded: RehearsalCase[] = [];
      try {
        if (name === "pos") {
          const fixtureClient = await pool.connect();
          try {
            assert.equal(typeof module.fixtureSql, "string", "Exact POS fixture SQL required");
            await fixtureClient.query("BEGIN");
            await fixtureClient.query(module.fixtureSql);
            await fixtureClient.query("COMMIT");
          } catch (error) {
            await fixtureClient.query("ROLLBACK");
            throw error;
          } finally { fixtureClient.release(); }
        }
        // Customer owns its fixture transaction; evidence owns rollback-only
        // fixtures per case. Never execute their exported fixtureSql here.
        const result: RehearsalResult = await run({
          pool, loadModule: loader.loadModule,
          record: (value: RehearsalCase) => { recorded.push(value); if (returnedFailure(value)) failed = true; },
        });
        assert.ok((result && typeof result === "object") || recorded.length, `${name} returned no case evidence`);
        const cases: RehearsalCase[] = Array.isArray(result?.cases) ? result.cases : recorded;
        assert.equal(cases.length, { pos: 20, customer: 59, evidence: 24 }[name],
          `Incomplete case coverage in ${name}`);
        assert.equal(new Set(cases.map((item) => item.name)).size, cases.length, "Duplicate case names");
        for (const callbackCase of recorded) {
          const returnedCase = cases.find((item) => item.name === callbackCase.name);
          assert.deepEqual(returnedCase, callbackCase, "Returned and callback case evidence disagree");
        }
        const { cases: _duplicatedCases, preservation, ...metadata } =
          "preservation" in result ? result : { ...result, preservation: undefined };
        report.modules[name] = {
          ...metadata, cases,
          ...(preservation ? { preservationSummary: { status: preservation.status, details: preservation.details } } : {}),
        };
        const moduleFailed = returnedFailure(result) || returnedFailure(recorded);
        if (moduleFailed) failed = true;
        report.stages.push({ name: stage, status: moduleFailed ? "FAIL" : "PASS" });
      } catch (error) {
        failed = true;
        report.modules[name] = { status: "FAIL", cases: recorded, error: safeFailure(error) };
        report.stages.push({ name: stage, status: "FAIL" });
      }
      await atomicReport(report);
    }
    report.loadedSources = loader.loadedSources;
    stage = "original-preservation";
    report.changes = assertOriginalRows(originals, await snapshotOriginalRows(control));
    report.stages.push({ name: stage, status: "PASS" });
    assert.equal((await sourceManifest()).sha256, manifest.sha256, "Source changed during run");
  } catch (error) {
    failed = true;
    report.stages.push({ name: stage, status: "FAIL", error: safeFailure(error) });
    // Still verify untouched original records after any case failure, if possible.
    if (control && originals) {
      try {
        await control.query("ROLLBACK");
        report.changes = assertOriginalRows(originals, await snapshotOriginalRows(control));
        report.preservationAfterFailure = "PASS";
      } catch (preservationError) { report.preservationAfterFailure = { status: "FAIL", error: safeFailure(preservationError) }; }
    }
  } finally {
    for (const [name, close] of [
      ["production-pool", async () => { if (pool) await pool.end(); }],
      ["control-client", async () => { if (control) await control.end(); }],
    ] as const) {
      try { await close(); } catch (error) { failed = true; report.stages.push({ name: `close:${name}`, status: "FAIL", error: safeFailure(error) }); }
    }
    clearTimeout(watchdog);
    report.status = failed ? "FAIL" : "PASS";
    report.finishedAt = new Date().toISOString();
    await atomicReport(report);
    console.log(JSON.stringify({ status: report.status, report: relative(ROOT, REPORT) }));
    process.exitCode = failed ? 1 : 0;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "REFUSED_BEFORE_RUN", error: safeFailure(error) }));
    process.exitCode = 1;
  });
}