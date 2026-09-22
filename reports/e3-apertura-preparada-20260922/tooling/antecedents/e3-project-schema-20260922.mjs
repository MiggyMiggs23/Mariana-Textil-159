// Recreate live schema-only B0 and derive projected B1 with E3 SQL 01 only.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const workspace = "/home/runner/workspace";
const packageDir = path.join(workspace, "reports/e3-paquete-liberacion-preparado-20260922");
const evidenceDir = path.join(packageDir, "evidencia/proyeccion");
const pgBin = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
    : JSON.stringify(value) ?? "null";
const hash = value => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.PGPASSWORD) {
  throw new Error("Inherited database selectors forbidden for disposable projection.");
}
fs.mkdirSync(evidenceDir, { recursive: true });
const base = fs.mkdtempSync("/tmp/e3-project-20260922-");
fs.chmodSync(base, 0o700);
const socket = path.join(base, "socket");
fs.mkdirSync(socket);
const clean = { PATH: `${pgBin}:${process.env.PATH || ""}`, HOME: base, LANG: "C.UTF-8" };
const pg = { ...clean, PGHOST: socket, PGPORT: "55443", PGUSER: "postgres", PGDATABASE: "heliumdb" };
const command = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { env: clean, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} exit ${result.status}: ${result.stderr}`);
  return result.stdout;
};
const sql = input => command(path.join(pgBin, "psql"), ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { env: pg, input });
const readCatalog = () => JSON.parse(sql(fs.readFileSync(path.join(packageDir, "release-catalog.sql"), "utf8")).trim());
const results = {
  status: "FAIL",
  sourceRevision: "95128fc8f2773907c6a34ef2cfeb1f631e84f301",
  localIdentityPurpose: "reproduce operational identity for final preflight validation; no bypass",
  cluster: base,
  postgresStarted: false,
  postgresStopExit: null,
  disposableDestroyed: false,
};
let started = false;
try {
  command(path.join(pgBin, "initdb"), ["-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "-D", path.join(base, "data")]);
  command(path.join(pgBin, "pg_ctl"), ["-D", path.join(base, "data"), "-l", path.join(base, "postgres.log"),
    "-o", `-k ${socket} -h "" -p 55443`, "-w", "start"]);
  started = true;
  results.postgresStarted = true;
  command(path.join(pgBin, "createdb"), ["heliumdb"], { env: pg });
  sql(fs.readFileSync(path.join(packageDir, "evidencia/live/schema-B0-real.sql"), "utf8"));
  const live = JSON.parse(fs.readFileSync(path.join(packageDir, "evidencia/live/catalog-B0-real.json"), "utf8"));
  // pg_dump emits enum labels in final order, but PostgreSQL renumbers fractional
  // enumsortorder values on restore. Restore those catalogue values from the
  // read-only capture before comparing; no operational catalogue is touched.
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  const enumRows = live.attributes.filter(row => row.kind === "enum");
  if (enumRows.length) {
    sql(`UPDATE pg_catalog.pg_enum e SET enumsortorder=e.enumsortorder+1000000
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE e.enumtypid=t.oid AND n.nspname='public';\n` + enumRows.map(row => `UPDATE pg_catalog.pg_enum e SET enumsortorder=${Number(row.definition)}
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE e.enumtypid=t.oid AND n.nspname='public' AND t.typname=${literal(row.parent)} AND e.enumlabel=${literal(row.name)};`).join("\n"));
  }
  const before = readCatalog();
  fs.writeFileSync(path.join(evidenceDir, "catalog-B0-local-diagnostic.json"), JSON.stringify(before, null, 2) + "\n");
  if (hash(before.schemaRows) !== hash(live.schemaRows) || hash(before.attributes) !== hash(live.attributes)) {
    const liveSchema = new Set(live.schemaRows.map(canonical));
    const localSchema = new Set(before.schemaRows.map(canonical));
    const liveAttributes = new Set(live.attributes.map(canonical));
    const localAttributes = new Set(before.attributes.map(canonical));
    fs.writeFileSync(path.join(evidenceDir, "reconstruction-differences.json"), JSON.stringify({
      liveOnlySchema: live.schemaRows.filter(row => !localSchema.has(canonical(row))),
      localOnlySchema: before.schemaRows.filter(row => !liveSchema.has(canonical(row))),
      liveOnlyAttributes: live.attributes.filter(row => !localAttributes.has(canonical(row))),
      localOnlyAttributes: before.attributes.filter(row => !liveAttributes.has(canonical(row))),
    }, null, 2) + "\n");
    throw new Error("Schema-only reconstruction differs from live semantic catalogue.");
  }
  const installPath = path.join(packageDir, "sql/01-install-prepared.sql");
  const install = fs.readFileSync(installPath, "utf8");
  sql(install);
  const after = readCatalog();
  const priorSchema = new Set(before.schemaRows.map(canonical));
  const priorAttributes = new Set(before.attributes.map(canonical));
  const removedSchema = before.schemaRows.filter(row => !new Set(after.schemaRows.map(canonical)).has(canonical(row)));
  const removedAttributes = before.attributes.filter(row => !new Set(after.attributes.map(canonical)).has(canonical(row)));
  if (removedSchema.length || removedAttributes.length) throw new Error("E3 SQL 01 altered or removed pre-existing semantic catalogue rows.");
  const addedSchema = after.schemaRows.filter(row => !priorSchema.has(canonical(row)));
  const addedAttributes = after.attributes.filter(row => !priorAttributes.has(canonical(row)));
  const identity = Object.fromEntries(["database", "databaseOid", "schema", "role", "serverVersionNum"].map(key => [key, after[key]]));
  const expected = {
    source: "95128fc8f2773907c6a34ef2cfeb1f631e84f301",
    basis: "Real E2 B1 catalog captured READ ONLY; faithful schema-only reconstruction plus exact E3 01-install-prepared.sql projects B1. SQL 03/04 not applied.",
    identity,
    baseSchemaSha256: hash(before.schemaRows),
    baseAttributesSha256: hash(before.attributes),
    schemaSha256: hash(after.schemaRows),
    attributesSha256: hash(after.attributes),
    installSha256: hash(install),
  };
  fs.writeFileSync(path.join(packageDir, "release-expected.json"), JSON.stringify(expected, null, 2) + "\n");
  fs.writeFileSync(path.join(evidenceDir, "catalog-B0-local.json"), JSON.stringify(before, null, 2) + "\n");
  fs.writeFileSync(path.join(evidenceDir, "catalog-B1-projected.json"), JSON.stringify(after, null, 2) + "\n");
  fs.writeFileSync(path.join(evidenceDir, "accepted-additions.json"), JSON.stringify({
    sql: "01-install-prepared.sql only",
    addedSchema, addedAttributes,
    preservedAllPreexistingSchemaRows: true,
    preservedAllPreexistingAttributes: true,
    sql03Applied: false,
    sql04Applied: false,
  }, null, 2) + "\n");
  results.status = "PASS";
  results.identity = identity;
  results.liveB0ReproducedExactly = true;
  results.pgDumpEnumSortOrderRestoredFromReadOnlyCatalog = enumRows.length;
  results.b0 = { rows: before.schemaRows.length, attributes: before.attributes.length,
    schemaSha256: expected.baseSchemaSha256, attributesSha256: expected.baseAttributesSha256 };
  results.projectedB1 = { rows: after.schemaRows.length, attributes: after.attributes.length,
    schemaSha256: expected.schemaSha256, attributesSha256: expected.attributesSha256 };
  results.installSha256 = expected.installSha256;
  results.addedSchemaRows = addedSchema.length;
  results.addedAttributeRows = addedAttributes.length;
} catch (error) {
  results.error = error.message;
  process.exitCode = 1;
} finally {
  if (started) {
    const stopped = spawnSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(base, "data"), "-m", "immediate", "-w", "stop"],
      { env: clean, encoding: "utf8", timeout: 30000 });
    results.postgresStopExit = stopped.status;
    results.postgresStopStdout = stopped.stdout.trim();
    results.postgresStopStderr = stopped.stderr.trim();
    if (stopped.status !== 0) process.exitCode = 1;
  }
  fs.rmSync(base, { recursive: true, force: true });
  results.disposableDestroyed = !fs.existsSync(base);
  fs.writeFileSync(path.join(evidenceDir, "projection-result.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}