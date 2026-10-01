import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  DisposablePostgresRunner, assertPostgres16Binaries, installSignalHandlers,
  redactSensitiveText,
} from "../../lib/db/src/run-isolated-tests.mjs";
import { prepareTestDatabase } from "../../lib/db/src/prepare-test-database.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const reportDirectory = import.meta.dirname;
const suite = "artifacts/api-server/src/routes/choferes.integration.test.ts";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sourceHash = sha(readFileSync(path.join(root, suite)));
// Never inherit application URLs, PG overrides or secrets.
const cleanEnvironment = Object.fromEntries(
  ["PATH", "HOME", "USER", "LANG", "TMPDIR"].filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);
assertPostgres16Binaries();
const runner = new DisposablePostgresRunner({ parentEnvironment: cleanEnvironment, actorMode: true });
const signalState = {};
const removeSignalHandlers = installSignalHandlers(async () => {
  runner.abort();
  await runner.cleanup();
}, signalState);
const evidence = { suite, sourceSha256: sourceHash, liveDatabaseAccess: false, passed: false, cleanupPassed: false };
const writeEvidence = () => writeFileSync(path.join(reportDirectory, "integration-result.json"),
  JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
try {
  await runner.start();
  await runner.verifyIdentity();
  const before = JSON.stringify([runner.verifiedIdentity, runner.verifiedControlIdentity]);
  await prepareTestDatabase({
    environment: runner.childEnvironment(),
    signal: runner.signal,
    onChild: (child, control) => runner.trackChild(child, control),
  });
  await runner.verifyIdentity();
  assert.equal(JSON.stringify([runner.verifiedIdentity, runner.verifiedControlIdentity]), before,
    "Canonical preparation must preserve the verified local target/control identity");
  evidence.targetControlIdentitySha256 = sha(before);
  evidence.localUnixSocketOnly = runner.verifiedIdentity.listen_addresses === "";
  // The released E11 auth reader is ON, but the canonical disposable initializer
  // does not install its sidecar. Supply the exact published table definition,
  // empty, in this verified disposable target only. Do not bypass auth/flags.
  const { Pool } = createRequire(path.join(root, "lib/db/package.json"))("pg");
  const authSource = readFileSync(path.join(root, "reports/e11/01-preparado.sql"), "utf8");
  const authTable = authSource.match(/CREATE TABLE public\.e11_perfiles \([\s\S]*?\n\);/)?.[0];
  assert.ok(authTable, "Published E11 profile table definition must be present");
  const authPool = new Pool({ connectionString: runner.testDatabaseUrl, max: 1 });
  try {
    const present = await authPool.query("SELECT to_regclass('public.e11_perfiles') AS table_name");
    if (!present.rows[0].table_name) await authPool.query(authTable);
    evidence.emptyAuthSidecarSource = "reports/e11/01-preparado.sql:e11_perfiles";
    evidence.emptyAuthSidecarDefinitionSha256 = sha(authTable);
  } finally { await authPool.end(); }
  const tsxLoader = path.join(root, "artifacts/api-server/node_modules/tsx/dist/loader.mjs");
  const environment = runner.childEnvironment({
    ACTOR_SUITE_RUN_ID: `choferes-${randomUUID()}`,
    ACTOR_SUITE_EXPECTED_TEST_DATABASE: runner.database,
    ACTOR_SUITE_EXPECTED_CONTROL_DATABASE: runner.controlDatabase,
    ACTOR_SUITE_EXPECTED_DATABASE_OID: String(runner.verifiedIdentity.database_oid),
    ACTOR_SUITE_EXPECTED_CONTROL_DATABASE_OID: String(runner.verifiedControlIdentity.database_oid),
    ACTOR_SUITE_EXPECTED_USER: runner.username,
    ACTOR_SUITE_EXPECTED_DATA_DIRECTORY: runner.dataDirectory,
    ACTOR_SUITE_EXPECTED_PORT: String(runner.port),
    ACTOR_SUITE_EXPECTED_SOCKET_DIRECTORY: runner.socketDirectory,
    ACTOR_SUITE_SELECTION_SHA256: sha(suite),
    ACTOR_SUITE_TSX_LOADER: tsxLoader,
  });
  environment.TSX_TSCONFIG_PATH = path.join(root, "artifacts/api-server/tsconfig.json");
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [
      "--import", path.join(root, "lib/db/src/actor-suite-bootstrap.mjs"),
      "--test", "--test-isolation=none", "--test-reporter=tap", path.join(root, suite),
    ], { cwd: root, env: environment, signal: runner.signal, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const closed = new Promise((done) => child.once("close", done));
    runner.trackChild(child, { wait: () => closed });
    child.once("error", (error) => { output += error.message; });
    child.once("close", (code) => resolve({ code, output }));
  });
  const safeOutput = redactSensitiveText(result.output, [
    runner.password, runner.seedPassword, runner.testDatabaseUrl, runner.controlDatabaseUrl,
  ]);
  writeFileSync(path.join(reportDirectory, "integration.tap"), safeOutput, { mode: 0o600 });
  process.stdout.write(safeOutput);
  evidence.exitCode = result.code;
  assert.equal(sha(readFileSync(path.join(root, suite))), sourceHash, "Suite source changed during execution");
  const pool = new Pool({ connectionString: runner.testDatabaseUrl, max: 1 });
  try {
    const persisted = await pool.query(`SELECT id,nombre_completo,telefono,telefonos,activo
      FROM choferes ORDER BY id`);
    const audits = await pool.query(`SELECT accion,entidad_id,datos_antes,datos_despues
      FROM auditoria WHERE entidad='choferes' ORDER BY id`);
    const columns = await pool.query(`SELECT column_name,data_type,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema='public' AND table_name='choferes'
      AND column_name IN ('telefono','telefonos') ORDER BY column_name`);
    writeFileSync(path.join(reportDirectory, "integration-persistence.json"),
      JSON.stringify({ disposableOnly: true, columns: columns.rows, rows: persisted.rows, audits: audits.rows }, null, 2) + "\n",
      { mode: 0o600 });
    evidence.persistedChoferCount = persisted.rowCount;
    evidence.persistedAuditCount = audits.rowCount;
  } finally { await pool.end(); }
  assert.equal(result.code, 0, "Choferes real PostgreSQL integration failed");
  evidence.passed = true;
} catch (error) {
  evidence.error = redactSensitiveText(error instanceof Error ? error.message : String(error), [
    runner.password, runner.seedPassword, runner.testDatabaseUrl, runner.controlDatabaseUrl,
  ]);
  process.stderr.write(`${evidence.error}\n`);
  process.exitCode = 1;
} finally {
  try {
    await runner.cleanup();
    evidence.cleanupPassed = !runner.rootDirectory || !existsSync(runner.rootDirectory);
  } finally {
    removeSignalHandlers();
    writeEvidence();
  }
}