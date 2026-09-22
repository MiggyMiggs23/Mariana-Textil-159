// Full E3 CLOSED candidate rehearsal. Every PostgreSQL process is created,
// used, stopped, and destroyed within this execution.
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { hash, readCatalog, verifyCatalog } from "../../reports/e3-paquete-liberacion-preparado-20260922/release-preflight.mjs";

const workspace = "/home/runner/workspace";
const packageRelative = "reports/e3-paquete-liberacion-preparado-20260922";
const packageDir = path.join(workspace, packageRelative);
const evidence = path.join(packageDir, "evidencia/arranque-candidato");
const pgBin = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const base = fs.mkdtempSync("/tmp/e3-candidate-20260922-");
fs.chmodSync(base, 0o700);
const socket = path.join(base, "socket");
const runRoot = path.join(base, "run");
fs.mkdirSync(socket);
fs.mkdirSync(path.join(runRoot, "reports"), { recursive: true });
fs.mkdirSync(path.join(runRoot, "artifacts/api-server"), { recursive: true });
fs.mkdirSync(path.join(runRoot, "artifacts/mariana-textil"), { recursive: true });
fs.symlinkSync(packageDir, path.join(runRoot, packageRelative));
fs.symlinkSync(path.join(workspace, "artifacts/api-server/dist-e3-20260922"),
  path.join(runRoot, "artifacts/api-server/dist-e3-20260922"));
fs.symlinkSync(path.join(workspace, "artifacts/mariana-textil/dist-e3-20260922"),
  path.join(runRoot, "artifacts/mariana-textil/dist-e3-20260922"));
fs.mkdirSync(evidence, { recursive: true });

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.PGPASSWORD) {
  throw new Error("Inherited database selectors forbidden for disposable startup.");
}
const clean = { PATH: `${pgBin}:${process.env.PATH || ""}`, HOME: base, LANG: "C.UTF-8" };
const pg = { ...clean, PGHOST: socket, PGPORT: "55444", PGUSER: "postgres", PGDATABASE: "heliumdb" };
const runtime = {
  ...clean, NODE_ENV: "development", API_INSPECTION_BOOT: "1", PORT: "18093",
  E3_ENABLED: "false", E3_DIRECTED_ENABLED: "false", REMATE_RELEASED: "false", REMATE_UI_RELEASED: "false",
  DATABASE_URL: `postgresql://postgres@localhost:55444/heliumdb?host=${encodeURIComponent(socket)}`,
};
const commandResult = (cmd, args, options = {}) => spawnSync(cmd, args, {
  env: clean, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024, ...options,
});
const command = (cmd, args, options = {}) => {
  const result = commandResult(cmd, args, options);
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} exit ${result.status}: ${result.stderr}`);
  return result.stdout;
};
const sql = input => command(path.join(pgBin, "psql"), ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { env: pg, input });
const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = value => `'${value.replaceAll("'", "''")}'`;
const snapshot = catalog => {
  const tables = catalog.schemaRows.filter(row => row.kind === "table" && row.schema_name === "public");
  const sequences = catalog.schemaRows.filter(row => row.kind === "sequence" && row.schema_name === "public");
  const sequenceSql = sequences.map(row =>
    `SELECT ${quoteLiteral(row.object_name)} AS name,last_value::text AS value,is_called::text AS called FROM public.${quoteIdentifier(row.object_name)}`).join(" UNION ALL ");
  const tableRows = Object.fromEntries(tables.map(row => {
    // Hex makes each canonical JSON row exactly one psql output line. Sorting
    // preserves duplicate multiplicity and removes heap/plan-order dependence.
    const canonicalRows = sql(`SELECT encode(convert_to(to_jsonb(t)::text,'UTF8'),'hex')
FROM public.${quoteIdentifier(row.object_name)} t ORDER BY to_jsonb(t)::text;`);
    const rows = canonicalRows === "" ? [] : canonicalRows.trimEnd().split("\n");
    return [row.object_name, {
      count: rows.length,
      rowsSha256: createHash("sha256").update(rows.map(value => `${value.length}:${value}`).join("|")).digest("hex"),
    }];
  }));
  return {
    tableRows,
    sequenceStates: sequenceSql ? sql(`${sequenceSql} ORDER BY name;`) : "",
    schemaSha256: hash(catalog.schemaRows),
    attributesSha256: hash(catalog.attributes),
  };
};
const results = {
  status: "FAIL", sourceRevision: "95128fc8f2773907c6a34ef2cfeb1f631e84f301",
  cluster: base, apiPort: 18093, pgPort: 55444, postgresStarted: false,
  candidateStopped: false, postgresStopExit: null, disposableDestroyed: false,
  databaseSource: "schema-only live catalogue; no operational rows/users",
};
let pgStarted = false;
let child;
let fd;
try {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(18093, "127.0.0.1", resolve); });
  await new Promise(resolve => reservation.close(resolve));
  command(path.join(pgBin, "initdb"), ["-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "-D", path.join(base, "data")]);
  command(path.join(pgBin, "pg_ctl"), ["-D", path.join(base, "data"), "-l", path.join(base, "postgres.log"),
    "-o", `-k ${socket} -h "" -p 55444`, "-w", "start"]);
  pgStarted = true;
  results.postgresStarted = true;
  command(path.join(pgBin, "createdb"), ["heliumdb"], { env: pg });
  sql(fs.readFileSync(path.join(packageDir, "evidencia/live/schema-B0-real.sql"), "utf8"));
  const live = JSON.parse(fs.readFileSync(path.join(packageDir, "evidencia/live/catalog-B0-real.json"), "utf8"));
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  const enums = live.attributes.filter(row => row.kind === "enum");
  sql(`UPDATE pg_catalog.pg_enum e SET enumsortorder=e.enumsortorder+1000000
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE e.enumtypid=t.oid AND n.nspname='public';\n` + enums.map(row => `UPDATE pg_catalog.pg_enum e SET enumsortorder=${Number(row.definition)}
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE e.enumtypid=t.oid AND n.nspname='public' AND t.typname=${literal(row.parent)} AND e.enumlabel=${literal(row.name)};`).join("\n"));
  sql(fs.readFileSync(path.join(packageDir, "sql/01-install-prepared.sql"), "utf8"));

  const expected = JSON.parse(fs.readFileSync(path.join(packageDir, "release-expected.json"), "utf8"));
  const beforeCatalog = readCatalog(runtime);
  results.preflight = verifyCatalog(beforeCatalog, expected);
  const before = snapshot(beforeCatalog);
  fs.writeFileSync(path.join(evidence, "before-startup.json"), JSON.stringify(before, null, 2) + "\n");

  // Negative gate, identity and catalogue-drift controls use the real preflight.
  const gate = commandResult(process.execPath, [path.join(packageDir, "release-preflight.mjs")],
    { env: { ...runtime, E3_ENABLED: "true" } });
  fs.writeFileSync(path.join(evidence, "negative-gate.log"), gate.stdout + gate.stderr);
  assert.notEqual(gate.status, 0);
  assert.match(gate.stderr, /Closed feature environment mismatch: E3_ENABLED/);
  assert.throws(() => verifyCatalog({ ...beforeCatalog, databaseOid: "1" }, expected), /identity mismatch/);
  fs.writeFileSync(path.join(evidence, "negative-identity.log"), "PASS: wrong databaseOid rejected by exact final preflight verifier.\n");
  sql("ALTER TABLE public.recibos_abono_e3 ADD COLUMN e3_drift_probe integer;");
  const drift = commandResult(process.execPath, [path.join(packageDir, "release-preflight.mjs")], { env: runtime });
  fs.writeFileSync(path.join(evidence, "negative-catalog-drift.log"), drift.stdout + drift.stderr);
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /catalog mismatch/);
  sql("ALTER TABLE public.recibos_abono_e3 DROP COLUMN e3_drift_probe;");
  verifyCatalog(readCatalog(runtime), expected);
  results.negativeControls = { gate: "PASS_REJECTED", identity: "PASS_REJECTED", catalogDrift: "PASS_REJECTED_AND_RESTORED" };

  // Hash-altered control is an isolated copy and cannot touch final outputs.
  const alteredRoot = path.join(base, "altered");
  fs.mkdirSync(path.join(alteredRoot, "reports"), { recursive: true });
  fs.mkdirSync(path.join(alteredRoot, "artifacts/api-server"), { recursive: true });
  fs.mkdirSync(path.join(alteredRoot, "artifacts/mariana-textil"), { recursive: true });
  fs.cpSync(packageDir, path.join(alteredRoot, packageRelative), { recursive: true });
  fs.cpSync(path.join(workspace, "artifacts/api-server/dist-e3-20260922"),
    path.join(alteredRoot, "artifacts/api-server/dist-e3-20260922"), { recursive: true });
  fs.cpSync(path.join(workspace, "artifacts/mariana-textil/dist-e3-20260922"),
    path.join(alteredRoot, "artifacts/mariana-textil/dist-e3-20260922"), { recursive: true });
  fs.appendFileSync(path.join(alteredRoot, "artifacts/api-server/dist-e3-20260922/index.mjs"), "\n// isolated hash control\n");
  const altered = commandResult("bash", [packageRelative + "/api-start-audit.sh"], { cwd: alteredRoot, env: runtime });
  fs.writeFileSync(path.join(evidence, "negative-hash-altered-copy.log"), altered.stdout + altered.stderr);
  assert.notEqual(altered.status, 0);
  results.negativeControls.hashAlteredIsolatedCopy = "PASS_REJECTED_BEFORE_PREFLIGHT_EXEC";

  const trace = path.join(evidence, "candidate-worker-open.trace");
  const log = path.join(evidence, "candidate-start.log");
  fd = fs.openSync(log, "w");
  child = spawn("strace", ["-f", "-e", "trace=openat", "-o", trace, "bash", `${packageRelative}/api-start-audit.sh`],
    { cwd: runRoot, env: runtime, stdio: ["ignore", fd, fd], detached: true });
  results.tracerPid = child.pid;
  let closed = false;
  const ended = new Promise(resolve => child.once("close", (code, signal) => { closed = true; resolve({ code, signal }); }));
  const deadline = Date.now() + 30000;
  let health;
  while (Date.now() < deadline) {
    if (closed) throw new Error("Candidate exited before health verification.");
    try {
      const response = await fetch("http://127.0.0.1:18093/api/healthz", { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { health = { status: response.status, body: await response.json() }; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const logged = fs.readFileSync(log, "utf8");
  assert.match(logged, /^E3_CLOSED_RELEASE_PREFLIGHT=PASS \{/m);
  assert.equal(health?.status, 200, "Candidate health deadline exceeded.");
  assert.match(logged, /Inspection boot: schema initializers, purchase backfill and stock-minimum monitor are paused/);
  results.health = health;
  results.mode = "INSPECTION";
  await new Promise(resolve => setTimeout(resolve, 500));
  const opened = fs.readFileSync(trace, "utf8");
  const bundle = path.join(workspace, "artifacts/api-server/dist-e3-20260922");
  const workers = ["thread-stream-worker.mjs", "pino-pretty.mjs"];
  for (const worker of workers) {
    assert.ok(opened.split("\n").some(line => line.includes(`${bundle}/${worker}`) && /= \d+/.test(line)), `Worker load not observed: ${worker}`);
  }
  results.workersLoadedAbsolute = workers.map(worker => `${bundle}/${worker}`);
  const afterCatalog = readCatalog(runtime);
  verifyCatalog(afterCatalog, expected);
  const after = snapshot(afterCatalog);
  fs.writeFileSync(path.join(evidence, "after-startup.json"), JSON.stringify(after, null, 2) + "\n");
  assert.deepEqual(after, before);
  results.semanticCatalogTableRowsAndSequenceIsCalledUnchanged = true;
  const audit = fs.readFileSync(path.join(runRoot, "reports/arranques-api.log"), "utf8").trim().split("\n").map(JSON.parse);
  fs.writeFileSync(path.join(evidence, "candidate-start-audit.jsonl"), audit.map(row => JSON.stringify(row)).join("\n") + "\n");
  const execEntry = audit.find(row => row.pid_role === "exec_target");
  assert.ok(execEntry);
  assert.equal(execEntry.pid, Number(execEntry.pid));
  assert.deepEqual(execEntry.mode, { NODE_ENV: "development", API_INSPECTION_BOOT: "1" });
  assert.deepEqual(execEntry.preflight, { result: "passed", exit_code: 0 });
  assert.equal(execEntry.bundle_sha256, createHash("sha256").update(fs.readFileSync(path.join(bundle, "index.mjs"))).digest("hex"));
  const execCommand = fs.readFileSync(`/proc/${execEntry.pid}/cmdline`, "utf8").split("\0").filter(Boolean);
  assert.ok(execCommand.some(value => value === `${bundle}/index.mjs`), "Audit PID is not the running candidate bundle.");
  results.execTargetPid = execEntry.pid;
  results.bundleSha256 = execEntry.bundle_sha256;
  results.auditRecordRequiredByHarness = {
    pidMatchesRunningBundle: true, bundleHashMatches: true, preflightPassed: true,
    appendFailurePolicy: "wrapper warning remains non-blocking; rehearsal cannot pass without the resulting valid exec record",
  };

  process.kill(-child.pid, "SIGTERM");
  const stopped = await Promise.race([ended, new Promise(resolve => setTimeout(() => resolve(null), 10000))]);
  if (!stopped) { process.kill(-child.pid, "SIGKILL"); await ended; }
  child = undefined;
  results.candidateStopped = true;
  // Sensitivity control, deliberately after the successful before/after
  // preservation assertion and after candidate shutdown. Count stays equal
  // while one real row value changes in this disposable database.
  const controlBefore = snapshot(readCatalog(runtime));
  const changed = sql(`UPDATE public.permisos_rol SET puede_ver=NOT puede_ver
WHERE ctid=(SELECT ctid FROM public.permisos_rol ORDER BY rol::text,modulo LIMIT 1)
RETURNING rol::text||':'||modulo;`).trim();
  assert.ok(changed, "Row-hash control requires an existing disposable permission row.");
  const controlAfter = snapshot(readCatalog(runtime));
  const beforePermission = controlBefore.tableRows.permisos_rol;
  const afterPermission = controlAfter.tableRows.permisos_rol;
  assert.equal(afterPermission.count, beforePermission.count);
  assert.notEqual(afterPermission.rowsSha256, beforePermission.rowsSha256);
  results.rowValueSensitivityControl = {
    table: "permisos_rol", sameCount: true, rowHashChanged: true,
    afterSuccessfulStartupPreservationComparison: true,
    database: "disposable only", restored: false, disposition: "cluster destroyed in finally",
  };
  fs.writeFileSync(path.join(evidence, "row-value-sensitivity-control.json"), JSON.stringify({
    ...results.rowValueSensitivityControl,
    before: beforePermission,
    after: afterPermission,
  }, null, 2) + "\n");
  results.status = "PASS_CLOSED_PREPARED_NOT_RELEASED";
} catch (error) {
  results.error = error.message;
  process.exitCode = 1;
} finally {
  if (child) {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
    await new Promise(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("close", resolve); });
    results.candidateStopped = true;
  }
  if (fd !== undefined) fs.closeSync(fd);
  if (pgStarted) {
    const stopped = commandResult(path.join(pgBin, "pg_ctl"), ["-D", path.join(base, "data"), "-m", "immediate", "-w", "stop"]);
    results.postgresStopExit = stopped.status;
    results.postgresStopStdout = stopped.stdout.trim();
    results.postgresStopStderr = stopped.stderr.trim();
    if (stopped.status !== 0) process.exitCode = 1;
  }
  fs.rmSync(base, { recursive: true, force: true });
  results.disposableDestroyed = !fs.existsSync(base);
  fs.writeFileSync(path.join(evidence, "candidate-start-results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}