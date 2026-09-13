import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const dbSourceDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const apiPackageFile = join(
  dbSourceDirectory,
  "artifacts",
  "api-server",
  "package.json",
);
const apiSourceDirectory = join(
  dbSourceDirectory,
  "artifacts",
  "api-server",
  "src",
);

const POLICY_VERSION = 1;
const PREPARE_SMOKE_SUITE = {
  id: "prepare-smoke",
  kind: "mode",
  databaseRequired: true,
  review: "approved",
  status: "allowed",
  reason:
    "The canonical schema, authorized seed, startup initializers, and read-only identity smoke check.",
  population: "canonical-schema-and-seed-only",
};
const REVIEWED_TICKET_IVA_SUITE = {
  id: "api-script:test:ticket-iva-schema",
  kind: "alias",
  databaseRequired: true,
  review: "approved-schema-only",
  status: "allowed",
  runner: "pnpm --filter @workspace/api-server run test:ticket-iva-schema",
  command: [
    "pnpm",
    "--filter",
    "@workspace/api-server",
    "run",
    "test:ticket-iva-schema",
  ],
  source: "artifacts/api-server/src/lib/ticket-iva-schema.test.ts",
  reason:
    "Audited schema-only DDL: drops and re-adds the two IVA columns, runs the canonical initializer twice, and reads information_schema metadata; it creates no users or data fixtures.",
  population: "schema-ddl-only",
};
const REVIEWED_REALTIME_RECONCILIATION_SUITE = {
  id: "api-script:test:admin-realtime-reconciliation",
  kind: "alias",
  databaseRequired: true,
  review: "approved-read-only-cte",
  status: "allowed",
  runner: "pnpm --filter @workspace/api-server run test:admin-realtime-reconciliation",
  command: [
    "pnpm",
    "--filter",
    "@workspace/api-server",
    "run",
    "test:admin-realtime-reconciliation",
  ],
  source: "artifacts/api-server/src/admin-realtime-reconciliation.integration.test.ts",
  reason:
    "Audited read-only PostgreSQL analytics regression: synthetic rows exist only in statement-scoped CTEs, every production query is executed unchanged, and the adapter rejects writes.",
  population: "canonical-schema-and-seed-only; statement-scoped-read-only-ctes",
};
const REVIEWED_SOURCES = [
  {
    id: "api-file:artifacts/api-server/src/lib/ticket-iva-schema.test.ts",
    kind: "file",
    databaseRequired: true,
    review: "approved-schema-only",
    status: "reviewed-source",
    executableBy: "api-script:test:ticket-iva-schema",
    source: "artifacts/api-server/src/lib/ticket-iva-schema.test.ts",
  },
  {
    id: "api-file:artifacts/api-server/src/admin-realtime-reconciliation.integration.test.ts",
    kind: "file",
    databaseRequired: true,
    review: "approved-read-only-cte",
    status: "reviewed-source",
    executableBy: "api-script:test:admin-realtime-reconciliation",
    source: "artifacts/api-server/src/admin-realtime-reconciliation.integration.test.ts",
  },
];

function readApiPackage() {
  if (!existsSync(apiPackageFile)) return { scripts: {} };
  return JSON.parse(readFileSync(apiPackageFile, "utf8"));
}

function walkTestFiles(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkTestFiles(path, output);
    } else if (/\.test\.[cm]?[jt]s$/.test(entry.name)) {
      output.push(relative(dbSourceDirectory, path).replaceAll("\\", "/"));
    }
  }
  return output;
}

function classifySourceFile(file) {
  const source = readFileSync(join(dbSourceDirectory, file), "utf8");
  const directDatabaseEvidence =
    /@workspace\/db|TEST_DATABASE_URL|REQUIRE_ISOLATED_TEST_DATABASE|\b(?:pool|db)\.query\s*\(/.test(
      source,
    );
  return {
    databaseRequired: directDatabaseEvidence ? true : "unknown",
    databaseEvidence: directDatabaseEvidence
      ? "direct-db-import-or-guard"
      : "no-direct-db-evidence; not audited",
    review: "unreviewed",
  };
}

/**
 * The inventory is deliberately fail-closed.  No API test is considered
 * safe merely because its filename says "contract" or "unit": suite review
 * is still pending and a number of contract files import the database.
 */
export function getIsolatedTestPolicy() {
  const packageJson = readApiPackage();
  const scriptNames = Object.keys(packageJson.scripts ?? {})
    .filter((name) => name.startsWith("test:"))
    .sort();
  const sourceFiles = walkTestFiles(apiSourceDirectory).sort();
  const reviewedAlias = REVIEWED_TICKET_IVA_SUITE.id;
  const reviewedAliases = new Set([
    reviewedAlias,
    REVIEWED_REALTIME_RECONCILIATION_SUITE.id,
  ]);
  const reviewedFiles = new Set(REVIEWED_SOURCES.map(({ id }) => id));

  const blockedSuites = [
    ...scriptNames.map((name) => ({
      id: `api-script:${name}`,
      kind: "alias",
      databaseRequired:
        name === "test:ticket-iva-schema"
          ? true
          : /\b(?:TEST_DATABASE_URL|REQUIRE_ISOLATED_TEST_DATABASE|@workspace\/db)\b/.test(
                packageJson.scripts[name],
              )
            ? true
            : "unknown",
      databaseEvidence:
        name === "test:ticket-iva-schema"
          ? "reviewed-source"
          : /\b(?:TEST_DATABASE_URL|REQUIRE_ISOLATED_TEST_DATABASE|@workspace\/db)\b/.test(
                packageJson.scripts[name],
              )
            ? "script-sets-db-guard-or-import"
            : "not evident from alias; source audit pending",
      review: "unreviewed",
      runner: `pnpm --filter @workspace/api-server run ${name}`,
      status: "blocked",
      reason:
        "Alias is not approved for disposable-runner execution; database reachability and fixture/actor behavior remain unreviewed.",
      source: "artifacts/api-server/package.json",
    })).filter(({ id }) => !reviewedAliases.has(id)),
    ...sourceFiles
      .map((file) => ({
        id: `api-file:${file}`,
        kind: "file",
        ...classifySourceFile(file),
        runner: `tsx ${file.replace(/^artifacts\/api-server\//, "")}`,
        status: "blocked",
        reason:
          "File is not approved for disposable-runner execution; its database reachability and fixture/actor behavior remain unreviewed.",
        source: file,
      }))
      .filter(({ id }) => !reviewedFiles.has(id)),
  ];

  return {
    policyVersion: POLICY_VERSION,
    default: "prepare-smoke",
    allowedSuites: [
      PREPARE_SMOKE_SUITE,
      REVIEWED_TICKET_IVA_SUITE,
      REVIEWED_REALTIME_RECONCILIATION_SUITE,
    ],
    reviewedSources: REVIEWED_SOURCES,
    blockedSuites,
    blockedCount: blockedSuites.length,
    notes: [
      "No suite is silently skipped. Blocked suites are reported in --list and in the default result.",
      "Only the canonical database schema/seed is allowed to populate this cluster.",
      "Additional persisted users/fixtures, application writes, and external TEST_DATABASE_URL targets are denied; the reviewed reconciliation suite may use statement-scoped virtual CTE rows only.",
      "Reviewed database suites run only through their fixed package scripts.",
    ],
  };
}

export function formatPolicyList(policy = getIsolatedTestPolicy()) {
  return `${JSON.stringify(policy, null, 2)}\n`;
}

export function assertAllowedIsolatedSuite(suite, policy = getIsolatedTestPolicy()) {
  if (!suite || suite === "prepare-smoke") return PREPARE_SMOKE_SUITE;
  const allowed = policy.allowedSuites.find(
    ({ id, runner }) => id === suite || runner === suite,
  );
  if (allowed) return allowed;
  const blocked = policy.blockedSuites.find(
    ({ id, runner }) => id === suite || runner === suite,
  );
  if (blocked) {
    throw new Error(
      `Suite "${suite}" is blocked by isolated-test policy: ${blocked.reason}`,
    );
  }
  throw new Error(
    `Suite "${suite}" is not in the isolated-test allowlist. Use --list to inspect blocked suites.`,
  );
}
