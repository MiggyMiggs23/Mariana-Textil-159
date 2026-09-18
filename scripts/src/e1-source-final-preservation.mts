/**
 * Final, strictly read-only preservation check for the source database.
 * Imports the same catalogue collector used by the approved Block 2 backup.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { collectE1Baseline } from "./prompt-h-block2-backup-restore.mts";

type Row = Record<string, unknown>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/e1-ensayo-2026-09-17");
const IDENTITY_PATH = resolve(REPORT_DIR, "api-pool-identity.json");
const SNAPSHOT_PATH = resolve(
  ROOT,
  ".local/backups/prompt-h-block2-20260917165108-3655/source-snapshot.json",
);
const REPORT_PATH = resolve(REPORT_DIR, "source-final-preservation.json");
const CATEGORIES = [
  "tables",
  "tableEvidence",
  "columns",
  "constraints",
  "indexes",
  "functions",
  "triggers",
  "sequences",
] as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function safeError(error: unknown): Row {
  const candidate = error as { message?: unknown; code?: unknown };
  return {
    message: String(candidate?.message ?? "Unknown preservation-check failure")
      .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_CONNECTION]")
      .replace(/\b(password|passfile|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
      .slice(0, 800),
    code: typeof candidate?.code === "string" ? candidate.code : null,
  };
}

async function writeReport(report: Row): Promise<void> {
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(REPORT_PATH, 0o600);
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function same(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function withoutPhysicalDatabaseSize(value: unknown): Row {
  const row = { ...(value as Row) };
  delete row.size_bytes;
  return row;
}

async function main(): Promise<void> {
  const startedAtUtc = new Date().toISOString();
  let client: pg.Client | undefined;
  let transactionOpen = false;
  const report: Row = {
    status: "FAIL",
    startedAtUtc,
    mode: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone=UTC",
    sourceWrites: 0,
    expectedSnapshot: ".local/backups/prompt-h-block2-20260917165108-3655/source-snapshot.json",
    checks: {},
  };

  try {
    check(typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0,
      "DATABASE_URL is unavailable.");
    const identityDocument = JSON.parse(await fs.readFile(IDENTITY_PATH, "utf8")) as Row;
    const snapshot = JSON.parse(await fs.readFile(SNAPSHOT_PATH, "utf8")) as Row;
    const expectedIdentity = identityDocument.identity as Row;
    const source = snapshot.source as Row;
    const expectedCatalogue = source.catalogue as Row;
    const expectedSequenceState = source.sequenceStateAfterDump as unknown[];
    check(expectedIdentity && expectedCatalogue && Array.isArray(expectedSequenceState),
      "Required identity or snapshot evidence is incomplete.");

    client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      application_name: "e1-source-final-preservation-readonly",
      statement_timeout: 120000,
      query_timeout: 130000,
      options: "-c default_transaction_read_only=on",
    });
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL timezone TO 'UTC'");

    // Identity and exclusivity are gates: collectE1Baseline is not called until
    // both match the API-pool evidence exactly.
    const identity = (await client.query(`SELECT
      current_database() AS database_name,
      (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS database_oid,
      current_user AS database_role,
      current_setting('server_version') AS server_version,
      inet_server_addr()::text AS server_address,
      inet_server_port()::int AS server_port,
      pg_postmaster_start_time()::text AS server_started_at,
      current_setting('transaction_read_only') AS transaction_read_only`)).rows[0] as Row;
    const identityFields = [
      "database_name", "database_oid", "database_role", "server_version",
      "server_address", "server_port", "server_started_at",
    ];
    const identityMatch = identityFields.every((field) => identity[field] === expectedIdentity[field])
      && identity.server_address === null
      && identity.server_port === null
      && identity.transaction_read_only === "on";
    (report.checks as Row).identity = {
      status: identityMatch ? "PASS" : "FAIL",
      fieldsChecked: identityFields,
      expectedEvidenceSha256: sha(Object.fromEntries(identityFields.map((field) =>
        [field, expectedIdentity[field]]))),
      observedEvidenceSha256: sha(Object.fromEntries(identityFields.map((field) =>
        [field, identity[field]]))),
      unixSocketAddressAndPortNull: identity.server_address === null && identity.server_port === null,
      transactionReadOnly: identity.transaction_read_only,
    };
    check(identityMatch, "Source identity does not exactly match api-pool-identity.json.");

    const otherBackends = Number((await client.query(`SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()`)).rows[0]?.count);
    (report.checks as Row).clientBackends = {
      status: otherBackends === 0 ? "PASS" : "FAIL",
      otherClientBackends: otherBackends,
    };
    check(otherBackends === 0, `Expected zero other client backends; observed ${otherBackends}.`);

    const current = await collectE1Baseline(client);
    const categoryChecks: Row = {};
    for (const category of CATEGORIES) {
      const expected = expectedCatalogue[category] as unknown[];
      const observed = current.catalogue[category];
      const matches = same(expected, observed);
      categoryChecks[category] = {
        status: matches ? "PASS" : "FAIL",
        expectedCount: expected.length,
        observedCount: observed.length,
        expectedSha256: sha(expected),
        observedSha256: sha(observed),
      };
    }

    const expectedDatabase = withoutPhysicalDatabaseSize(expectedCatalogue.database);
    const observedDatabase = withoutPhysicalDatabaseSize(current.catalogue.database);
    categoryChecks.databaseIgnoringPhysicalSizeOnly = {
      status: same(expectedDatabase, observedDatabase) ? "PASS" : "FAIL",
      expectedFieldCount: Object.keys(expectedDatabase).length,
      observedFieldCount: Object.keys(observedDatabase).length,
      expectedSha256: sha(expectedDatabase),
      observedSha256: sha(observedDatabase),
    };
    const sequenceMatches = same(expectedSequenceState, current.sequenceState);
    categoryChecks.sequenceStateAfterDump = {
      status: sequenceMatches ? "PASS" : "FAIL",
      expectedCount: expectedSequenceState.length,
      observedCount: current.sequenceState.length,
      expectedSha256: sha(expectedSequenceState),
      observedSha256: sha(current.sequenceState),
    };
    (report.checks as Row).sourceSnapshot = categoryChecks;

    const e1ObjectCount = Number((await client.query(`SELECT count(*)::int AS count FROM (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND c.relname LIKE '%\\_e1' ESCAPE '\\'
      UNION ALL
      SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.proname LIKE '%\\_e1' ESCAPE '\\'
      UNION ALL
      SELECT t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
       WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND t.typname LIKE '%\\_e1' ESCAPE '\\'
      UNION ALL
      SELECT t.oid FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgname LIKE '%\\_e1' ESCAPE '\\'
      UNION ALL
      SELECT c.oid FROM pg_constraint c WHERE c.conname LIKE '%\\_e1' ESCAPE '\\'
    ) e1_objects`)).rows[0]?.count);
    (report.checks as Row).e1Objects = {
      status: e1ObjectCount === 0 ? "PASS" : "FAIL",
      count: e1ObjectCount,
    };

    const failedCategories = Object.entries(categoryChecks)
      .filter(([, value]) => (value as Row).status !== "PASS")
      .map(([name]) => name);
    check(current.catalogue.tables.length === 63,
      `Expected 63 tables; observed ${current.catalogue.tables.length}.`);
    check(current.catalogue.tableEvidence.length === 63,
      `Expected evidence for 63 tables; observed ${current.catalogue.tableEvidence.length}.`);
    check(current.catalogue.triggers.length === 17,
      `Expected 17 triggers; observed ${current.catalogue.triggers.length}.`);
    check(e1ObjectCount === 0, `Expected no E1 objects; observed ${e1ObjectCount}.`);
    check(failedCategories.length === 0,
      `Source snapshot mismatch in: ${failedCategories.join(", ")}.`);

    await client.query("COMMIT");
    transactionOpen = false;
    report.status = "PASS";
    report.finishedAtUtc = new Date().toISOString();
    report.summary = {
      tablesVerified: 63,
      tableCountsAndHashesVerified: 63,
      columnsVerified: current.catalogue.columns.length,
      constraintsVerified: current.catalogue.constraints.length,
      indexesVerified: current.catalogue.indexes.length,
      functionsVerified: current.catalogue.functions.length,
      triggersVerified: 17,
      sequencesVerified: current.catalogue.sequences.length,
      sequenceStatesVerified: current.sequenceState.length,
      e1Objects: 0,
      otherClientBackends: 0,
    };
  } catch (error) {
    report.failure = safeError(error);
    report.finishedAtUtc = new Date().toISOString();
    if (transactionOpen && client) await client.query("ROLLBACK").catch(() => undefined);
  } finally {
    await client?.end().catch(() => undefined);
    await writeReport(report);
  }

  console.log(JSON.stringify({
    status: report.status,
    report: "reports/e1-ensayo-2026-09-17/source-final-preservation.json",
    failure: report.status === "FAIL" ? report.failure : undefined,
  }));
  if (report.status !== "PASS") process.exitCode = 1;
}

await main();