// Disposable PostgreSQL only. No app execution and no live connection inherited.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { hash, readCatalog, verifyCatalog, connectionEnvironment } from "./release-preflight.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixture = process.argv[2];
if (!fixture?.startsWith("/tmp/e2-release-preparation-")) throw new Error("Isolated fixture required.");
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.PGPASSWORD) throw new Error("Inherited DB settings forbidden.");
const base = fs.mkdtempSync("/tmp/e2-release-pg-");
fs.chmodSync(base, 0o700);
fs.mkdirSync(path.join(base, "socket"));
const output = path.join(directory, "verificacion-final");
fs.mkdirSync(output, { recursive: true });
const clean = { PATH: process.env.PATH, HOME: base, LANG: "C.UTF-8" };
const pg = { ...clean, PGHOST: path.join(base, "socket"), PGPORT: "55438", PGUSER: "postgres", PGDATABASE: "heliumdb" };
const env = { ...clean, NODE_ENV: "development", API_INSPECTION_BOOT: "1",
  DATABASE_URL: `postgresql://postgres@localhost:55438/heliumdb?host=${encodeURIComponent(pg.PGHOST)}` };
const results = [];
let started = false;
const command = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { env: clean, encoding: "utf8", timeout: 60000, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${cmd} exit ${result.status}: ${result.stderr}`);
  return result.stdout;
};
const sql = input => command("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { env: pg, input });
const record = (name, action) => { action(); results.push({ name, result: "PASS" }); };
try {
  command("initdb", ["-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "-D", path.join(base, "data")]);
  command("pg_ctl", ["-D", path.join(base, "data"), "-l", path.join(base, "postgres.txt"),
    "-o", `-k ${pg.PGHOST} -h "" -p 55438`, "-w", "start"]);
  started = true;
  command("createdb", ["heliumdb"], { env: pg });
  sql(fs.readFileSync(fixture, "utf8"));
  const before = readCatalog(env);
  record("archived B0 complete catalog reproduced", () =>
    assert.equal(hash(before.schemaRows), "37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8"));
  const install = fs.readFileSync(path.join(directory, "sql/01-install-evidence-prepared.sql"), "utf8");
  record("exact approved install SQL", () => assert.equal(hash(install), "3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c"));
  sql(install);
  const after = readCatalog(env);
  const expected = {
    source: "31804125a1e752bde128d72e9fd44d23972ffff1",
    basis: "Archived exact B0 schema plus exact approved A+C SQL, reconstructed empty in fresh PostgreSQL; NOT observed live state.",
    identity: Object.fromEntries(["database", "databaseOid", "schema", "role", "serverVersionNum"].map(k => [k, after[k]])),
    baseSchemaSha256: hash(before.schemaRows), baseAttributesSha256: hash(before.attributes), schemaSha256: hash(after.schemaRows),
    attributesSha256: hash(after.attributes), installSha256: hash(install),
  };
  assert.deepEqual(expected.identity, { database: "heliumdb", databaseOid: "16384", schema: "public", role: "postgres", serverVersionNum: "160010" });
  record("full B1 positive", () => verifyCatalog(after, expected));
  record("full B0 positive before SQL", () => verifyCatalog(before, expected, "before"));
  record("A+C missing rejected", () => assert.throws(() => verifyCatalog(before, expected), /catalog mismatch/));
  record("wrong identity rejected", () => assert.throws(() => verifyCatalog({ ...after, databaseOid: "1" }, expected), /identity mismatch/));
  record("non-readonly rejected", () => assert.throws(() => verifyCatalog({ ...after, readOnly: "off" }, expected), /Read-only/));
  record("missing inspection rejected before connection", () => assert.throws(() => connectionEnvironment({ ...env, API_INSPECTION_BOOT: "0" }), /before database access/));
  record("alternate PG settings cannot redirect runtime connection", () =>
    assert.equal(connectionEnvironment({ ...env, PGHOST: "/forbidden" }).PGHOST, pg.PGHOST));
  // Each defect is applied and restored ONLY in this new disposable database.
  for (const [name, defect, restore, error] of [
    ["E1 guard disabled", "ALTER TABLE movimientos_credito DISABLE TRIGGER zz_e1_cash_capture_closed", "ALTER TABLE movimientos_credito ENABLE TRIGGER zz_e1_cash_capture_closed", /attributes/],
    ["A+C stamp disabled", "ALTER TABLE movimientos_credito DISABLE TRIGGER e2_source_insert_transaction", "ALTER TABLE movimientos_credito ENABLE TRIGGER e2_source_insert_transaction", /attributes/],
    ["unrelated table column drift", "ALTER TABLE auditoria ADD COLUMN release_probe integer", "ALTER TABLE auditoria DROP COLUMN release_probe", /catalog mismatch/],
    ["function execution privilege drift", "REVOKE EXECUTE ON FUNCTION e2_stamp_insert_transaction() FROM PUBLIC", "GRANT EXECUTE ON FUNCTION e2_stamp_insert_transaction() TO PUBLIC", /attributes/],
  ]) {
    sql(defect);
    record(`${name} rejected`, () => assert.throws(() => verifyCatalog(readCatalog(env), expected), error));
    sql(restore);
    // A GRANT restores effective privilege but not a NULL ACL; reset catalog test
    // by exact function recreation below rather than weakening the expectation.
    if (name === "function execution privilege drift") {
      const functionSource = after.schemaRows.find(row => row.kind === "function" && row.object_name === "e2_stamp_insert_transaction").definition;
      sql("DROP TRIGGER e2_source_insert_transaction ON movimientos_credito; DROP TRIGGER e2_retained_insert_transaction ON cobros_credito_pendientes_e1; DROP FUNCTION e2_stamp_insert_transaction();");
      sql(functionSource + ";");
      for (const row of after.schemaRows.filter(row => row.kind === "trigger" && ["e2_source_insert_transaction", "e2_retained_insert_transaction"].includes(row.object_name))) sql(row.definition + ";");
    }
    record(`${name} restored`, () => verifyCatalog(readCatalog(env), expected));
  }
  record("prepared psql postflight", () => {
    const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(directory, "sql/03-preflight-schema-prepared.sql")],
      { env: { ...pg, PGOPTIONS: "-c default_transaction_read_only=on" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  });
  fs.writeFileSync(path.join(directory, "release-expected.json"), JSON.stringify(expected, null, 2) + "\n");
  record("external preflight CLI on fresh B1", () => {
    const result = spawnSync(process.execPath, [path.join(directory, "release-preflight.mjs")],
      { env, encoding: "utf8", timeout: 30000 });
    fs.writeFileSync(path.join(output, "preflight-cli.log"), result.stdout + result.stderr);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /E2_COMPLETE_RELEASE_PREFLIGHT=PASS/);
  });
  fs.writeFileSync(path.join(output, "catalog-B0.json"), JSON.stringify(before, null, 2));
  fs.writeFileSync(path.join(output, "catalog-B1.json"), JSON.stringify(after, null, 2));
  fs.writeFileSync(path.join(output, "fresh-database-identity.json"), JSON.stringify({
    path: base, socket: pg.PGHOST, port: pg.PGPORT, data: path.join(base, "data"),
    identity: expected.identity, containsBusinessRows: false, source: "empty metadata fixture, not clone",
  }, null, 2));
} catch (error) {
  results.push({ result: "FAIL", error: error.message });
  process.exitCode = 1;
} finally {
  if (started) {
    const stopped = spawnSync("pg_ctl", ["-D", path.join(base, "data"), "-m", "immediate", "-w", "stop"], { env: clean, encoding: "utf8" });
    results.push({ name: "disposable PostgreSQL stopped", exit: stopped.status });
    if (stopped.status !== 0) process.exitCode = 1;
  }
  fs.rmSync(base, { recursive: true, force: true });
  results.push({ name: "disposable PostgreSQL directory destroyed", absent: !fs.existsSync(base) });
  fs.writeFileSync(path.join(output, "preflight-results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}