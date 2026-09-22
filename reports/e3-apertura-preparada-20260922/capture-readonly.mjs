// E3 preparation: capture the effective live catalogue without importing the app.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const workspace = "/home/runner/workspace";
const report = path.join(workspace, "reports/e3-apertura-preparada-20260922");
const catalogSql = path.join(report, "release-catalog.sql");
const outputCatalog = path.join(report, "evidencia/live/catalog-B0-real.json");
const outputDump = path.join(report, "evidencia/live/schema-B0-real.sql");
const outputEvidence = path.join(report, "evidencia/live/read-only-capture.json");
const pgBin = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const runtimePid = process.env.E3_RUNTIME_PID || "3800";
const procEnv = readFileSync(`/proc/${runtimePid}/environ`);
const runtimeEntry = procEnv.toString("utf8").split("\0").find(row => row.startsWith("DATABASE_URL="));
if (!runtimeEntry) throw new Error("The retained runtime does not expose DATABASE_URL.");
const runtimeUrl = runtimeEntry.slice("DATABASE_URL=".length);
if (createHash("sha256").update(runtimeUrl).digest("hex") !==
    createHash("sha256").update(process.env.DATABASE_URL).digest("hex")) {
  throw new Error("Shell and retained runtime database targets differ.");
}

const url = new URL(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL URL required.");
const pgEnv = {
  PATH: `${pgBin}:${process.env.PATH || ""}`,
  HOME: process.env.HOME || "/tmp",
  LANG: "C.UTF-8",
  PGHOST: url.searchParams.get("host") || url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
  PGCONNECT_TIMEOUT: "5",
  PGAPPNAME: "e3-preparation-readonly-20260922",
  PGOPTIONS: "-c default_transaction_read_only=on",
};
mkdirSync(path.dirname(outputCatalog), { recursive: true });
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    env: pgEnv, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024, ...options,
  });
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with exit ${result.status}; connection details withheld.`);
  return result;
};

const catalog = run(path.join(pgBin, "psql"),
  ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
  { input: readFileSync(catalogSql, "utf8") });
const parsed = JSON.parse(catalog.stdout.trim());
if (parsed.readOnly !== "on") throw new Error("Live catalogue transaction was not read-only.");
writeFileSync(outputCatalog, JSON.stringify(parsed, null, 2) + "\n");

const dump = run(path.join(pgBin, "pg_dump"), [
  "--schema-only", "--format=plain", "--no-security-labels", "--file", outputDump,
]);
const evidence = {
  status: "PASS_READ_ONLY",
  sourceRevision: JSON.parse(readFileSync(path.join(report, "preparation-status.json"), "utf8")).sourceRevision,
  retainedRuntimePid: Number(runtimePid),
  sameDatabaseUrlAsRetainedRuntime: true,
  transaction: "REPEATABLE READ READ ONLY; ROLLBACK",
  pgOptions: "default_transaction_read_only=on",
  schemaDump: "schema-only; owners and ACL retained; no table data or users copied",
  identity: {
    database: parsed.database,
    databaseOid: parsed.databaseOid,
    schema: parsed.schema,
    role: parsed.role,
    serverVersionNum: parsed.serverVersionNum,
  },
  catalogRows: parsed.schemaRows.length,
  attributesRows: parsed.attributes.length,
  catalogSha256: createHash("sha256").update(JSON.stringify(parsed)).digest("hex"),
  schemaDumpSha256: createHash("sha256").update(readFileSync(outputDump)).digest("hex"),
  stderrEmpty: catalog.stderr === "" && dump.stderr === "",
  credentialsRecorded: false,
};
writeFileSync(outputEvidence, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));