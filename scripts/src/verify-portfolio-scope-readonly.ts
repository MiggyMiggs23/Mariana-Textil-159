/**
 * Read-only verification for the customer portfolio scope migration.
 *
 * This intentionally does not import the API entry point, start a server, use
 * a session, or create fixture rows.  The only live connection is the pool
 * exported by the workspace DB package, and every verification query runs in
 * one REPEATABLE READ READ ONLY transaction.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

import {
  loadClientesCartera,
  type CarteraReadModel,
  type CarteraReadDatabase,
} from "../../artifacts/api-server/src/lib/clientes-cartera-read-model.ts";
import type { AuthContext } from "../../artifacts/api-server/src/middlewares/auth.ts";
import {
  loadCustomerCreditProjections,
} from "../../artifacts/api-server/src/lib/credit-aging-read-model.ts";
import { centsToMoney } from "../../artifacts/api-server/src/lib/credit-allocation.ts";
import {
  renderClientesCarteraPdf,
  renderClientesCarteraXlsx,
} from "../../artifacts/api-server/src/lib/clientes-cartera-export.ts";
import {
  LEGACY_BASELINE_FIXTURE,
  LEGACY_CARTERA_READ_MODEL_SOURCE,
  LEGACY_RESUMEN_HANDLER_CORE_SOURCE,
} from "./verify-portfolio-scope-readonly.baseline.ts";

type QueryResult<T> = { rows: T[] };
type QueryExecutor = {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
};

type Identity = {
  database: string;
  schema: string;
  transactionReadOnly: string;
  isolation: string;
};

type SafeCounts = Record<string, number>;
type ReadScopeResult = {
  ubicacionId: number | null | undefined;
  scopeError: string | null;
};

const sourcePath = LEGACY_BASELINE_FIXTURE.sourcePath;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(
  scriptDirectory,
  "../../reports/portfolio-scope/readonly-verification.json",
);

/**
 * Frozen copy of the read-scope helper used by routes/inventario.ts.
 *
 * The verifier deliberately does not import that router: its import graph
 * includes the full mutation router and is unnecessary for a read-only
 * script.  Keeping this small helper byte-for-byte equivalent avoids starting
 * any server/router graph while preserving the production authorization rule.
 */
function resolveReadScope(
  auth: AuthContext,
  requestedUbicacionId?: number,
): ReadScopeResult {
  const alcance = auth.user.alcanceConsulta;
  const assigned = auth.user.ubicacionId;
  if (auth.user.rol === "ADMIN" || auth.user.rol === "SUPERVISOR") {
    return { ubicacionId: requestedUbicacionId, scopeError: null };
  }
  if (auth.user.rol === "CAJA") {
    return assigned == null
      ? { ubicacionId: null, scopeError: "No tienes una ubicación asignada." }
      : { ubicacionId: assigned, scopeError: null };
  }
  if (alcance === "TODAS") {
    return { ubicacionId: requestedUbicacionId, scopeError: null };
  }
  if (assigned == null) {
    return {
      ubicacionId: null,
      scopeError: "No tienes una ubicación asignada.",
    };
  }
  return { ubicacionId: assigned, scopeError: null };
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(?:postgres(?:ql)?):\/\/\S+/gi, "[connection-redacted]")
    .replace(/\b(?:password|secret|token|authorization)\s*=\s*\S+/gi, "$1=[redacted]");
}

function assertReadOnlySql(text: string): void {
  const normalized = text
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .toUpperCase();
  if (!/^(SELECT|WITH|SHOW)\b/.test(normalized)) {
    throw new Error(`Readonly verifier rejected non-read statement: ${normalized.slice(0, 32)}`);
  }
  if (/\b(FOR\s+UPDATE|FOR\s+NO\s+KEY\s+UPDATE|INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE)\b/.test(normalized)) {
    throw new Error("Readonly verifier rejected a mutating or locking SQL statement.");
  }
}

function readOnlyExecutor(client: QueryExecutor): QueryExecutor {
  return {
    async query<T = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<T>> {
      assertReadOnlySql(text);
      return client.query<T>(text, values);
    },
  };
}

function sourceFromHead(): {
  cartera: string;
  resumen: string;
  commit: string;
} {
  const pinnedCommit = LEGACY_BASELINE_FIXTURE.commit;
  const resolvedCommit = execFileSync("git", ["rev-parse", pinnedCommit], {
    encoding: "utf8",
  }).trim();
  assert.equal(
    resolvedCommit,
    pinnedCommit,
    "Pinned legacy baseline commit did not resolve to its immutable SHA.",
  );
  const source = execFileSync("git", ["show", `${pinnedCommit}:${sourcePath}`], {
    encoding: "utf8",
  });
  const carteraStart = source.indexOf("async function carteraReadModel() {");
  const carteraEnd = source.indexOf(
    "\n\n// ── GET /clientes/resumen",
    carteraStart,
  );
  const resumenStart = source.indexOf(
    '       const result = await pool.query<{ id: number }>("SELECT id FROM clientes WHERE activo");',
  );
  const resumenEnd = source.indexOf("\n    } catch", resumenStart);
  if (carteraStart < 0 || carteraEnd < 0 || resumenStart < 0 || resumenEnd < 0) {
    throw new Error("Could not locate the exact legacy portfolio source markers in the pinned commit.");
  }
  return {
    cartera: source.slice(carteraStart, carteraEnd),
    resumen: source.slice(resumenStart, resumenEnd),
    commit: resolvedCommit,
  };
}

function verifyFrozenBaseline(): {
  commit: string;
  carteraSha256: string;
  resumenSha256: string;
} {
  const head = sourceFromHead();
  assert.equal(
    LEGACY_CARTERA_READ_MODEL_SOURCE,
    head.cartera,
    "The frozen cartera baseline no longer matches the pinned historical source.",
  );
  assert.equal(
    LEGACY_RESUMEN_HANDLER_CORE_SOURCE,
    head.resumen,
    "The frozen resumen baseline no longer matches the pinned historical source.",
  );
  return {
    commit: head.commit,
    carteraSha256: hashText(head.cartera),
    resumenSha256: hashText(head.resumen),
  };
}

function compileBaselineSource(source: string): string {
  // Compile the exact captured TypeScript once.  The compiler erases only
  // TypeScript syntax; it does not rewrite the legacy financial body.
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
    reportDiagnostics: true,
  });
  const diagnostics = result.diagnostics ?? [];
  if (diagnostics.length > 0) {
    throw new Error(
      `Pinned legacy baseline TypeScript did not compile: ${diagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
        .join("; ")}`,
    );
  }
  return result.outputText;
}

const EXECUTABLE_BASELINE = Object.freeze({
  cartera: compileBaselineSource(LEGACY_CARTERA_READ_MODEL_SOURCE),
  resumen: compileBaselineSource(LEGACY_RESUMEN_HANDLER_CORE_SOURCE),
});

function buildGlobalAuth(): Parameters<typeof loadClientesCartera>[0] {
  // This is an in-memory authorization context, not a session or test user.
  return {
    sessionId: "readonly-verifier-no-session",
    user: {
      rol: "ADMIN",
      alcanceConsulta: "TODAS",
      ubicacionId: null,
    },
    location: null,
  } as unknown as Parameters<typeof loadClientesCartera>[0];
}

function buildRestrictedAuth(
  ubicacionId: number | null,
): Parameters<typeof loadClientesCartera>[0] {
  return {
    sessionId: "readonly-verifier-no-session",
    user: {
      rol: "BODEGA",
      alcanceConsulta: "PROPIA",
      ubicacionId,
    },
    location: null,
  } as unknown as Parameters<typeof loadClientesCartera>[0];
}

async function legacyCartera(
  database: CarteraReadDatabase,
): Promise<unknown[]> {
  const factory = new Function(
    "pool",
    "loadCustomerCreditProjections",
    "centsToMoney",
    `"use strict"; return (${EXECUTABLE_BASELINE.cartera});`,
  ) as (
    pool: CarteraReadDatabase,
    load: typeof loadCustomerCreditProjections,
    money: typeof centsToMoney,
  ) => () => Promise<unknown[]>;
  const readModel = factory(
    database,
    (ids, injectedDatabase = database) =>
      loadCustomerCreditProjections(ids, injectedDatabase),
    centsToMoney,
  );
  return readModel();
}

async function legacyResumen(
  database: CarteraReadDatabase,
): Promise<Record<string, unknown>> {
  const factory = new Function(
    "pool",
    "loadCustomerCreditProjections",
    "centsToMoney",
    `"use strict"; return async function legacyResumen(res) {
      ${EXECUTABLE_BASELINE.resumen}
    };`,
  ) as (
    pool: CarteraReadDatabase,
    load: typeof loadCustomerCreditProjections,
    money: typeof centsToMoney,
  ) => (res: { json(value: Record<string, unknown>): void }) => Promise<void>;
  let response: Record<string, unknown> | undefined;
  const handler = factory(
    database,
    (ids, injectedDatabase = database) =>
      loadCustomerCreditProjections(ids, injectedDatabase),
    centsToMoney,
  );
  await handler({
    json(value) {
      response = value;
    },
  });
  if (!response) throw new Error("Frozen legacy resumen did not produce JSON.");
  return response;
}

function canonicalRows(rows: unknown[]): unknown[] {
  return [...rows].sort((left, right) => {
    const leftId = Number((left as { id?: unknown }).id);
    const rightId = Number((right as { id?: unknown }).id);
    return leftId - rightId;
  });
}

function digestRows(rows: unknown[]): string {
  return hashText(JSON.stringify(canonicalRows(rows)));
}

async function databaseIdentity(database: QueryExecutor): Promise<Identity> {
  const result = await database.query<{
    database_name: string;
    schema_name: string;
    transaction_read_only: string;
    transaction_isolation: string;
  }>(
    `SELECT current_database() AS database_name,
            current_schema() AS schema_name,
            current_setting('transaction_read_only') AS transaction_read_only,
            current_setting('transaction_isolation') AS transaction_isolation`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("Database identity query returned no row.");
  assert.equal(row.transaction_read_only, "on", "Verification transaction is not READ ONLY.");
  assert.equal(
    row.transaction_isolation,
    "repeatable read",
    "Verification transaction is not REPEATABLE READ.",
  );
  return {
    database: String(row.database_name),
    schema: String(row.schema_name),
    transactionReadOnly: String(row.transaction_read_only),
    isolation: String(row.transaction_isolation),
  };
}

async function aggregateCounts(database: QueryExecutor): Promise<SafeCounts> {
  const result = await database.query<SafeCounts>(`
    SELECT
      (SELECT count(*)::int FROM clientes) AS clientes,
      (SELECT count(*)::int FROM ubicaciones) AS ubicaciones,
      (SELECT count(*)::int FROM movimientos_credito) AS movimientos_credito,
      (SELECT count(*)::int FROM aplicaciones_credito) AS aplicaciones_credito,
      (SELECT count(*)::int FROM solicitudes_pago_dirigido) AS solicitudes_pago_dirigido,
      (SELECT count(*)::int FROM tickets) AS tickets
  `);
  const row = result.rows[0];
  if (!row) throw new Error("Aggregate count query returned no row.");
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)]),
  );
}

async function positiveAuthorizedChargeCte(
  database: QueryExecutor,
): Promise<Record<string, unknown>> {
  const cases = [
    { label: "single-site-10", ids: [10], expected: [101, 103, 104, 107] },
    { label: "single-site-20", ids: [20], expected: [102] },
    { label: "multi-site-deduplicated", ids: [10, 20, 10], expected: [101, 102, 103, 104, 107] },
  ];
  const fixturePrefix = `
    WITH movimientos_credito(id,cliente_id,ticket_id,tipo,importe) AS (
      VALUES
        (101,1,1001,'VENTA_CREDITO'::text,100.00::numeric),
        (102,1,1002,'VENTA_CREDITO'::text,50.00::numeric),
        (103,1,1003,'AJUSTE'::text,7.00::numeric),
        (104,2,1004,'VENTA_CREDITO'::text,20.00::numeric),
        (105,1,NULL,'AJUSTE'::text,9.00::numeric),
        (106,1,1005,'AJUSTE'::text,-9.00::numeric),
        (107,1,1006,'VENTA_CREDITO'::text,13.00::numeric)
    ),
    tickets(id,cliente_id,ubicacion_id) AS (
      VALUES
        (1001,1,10),
        (1002,1,20),
        (1003,1,10),
        (1004,2,10),
        (1005,1,10),
        (1006,1,10)
    )
  `;
  const results: Record<string, unknown> = {};
  for (const testCase of cases) {
    const productionQuery = (await import(
      "../../artifacts/api-server/src/lib/clientes-cartera-read-model.ts"
    )).buildAuthorizedChargeReadQuery(testCase.ids);
    const result = await database.query<{ id: number; cliente_id: number }>(
      `${fixturePrefix}\n${productionQuery.text}`,
      productionQuery.values,
    );
    const ids = result.rows.map((row) => Number(row.id)).sort((a, b) => a - b);
    assert.deepEqual(ids, testCase.expected, `${testCase.label} authorized IDs differ.`);
    results[testCase.label] = {
      requestedLocationCount: testCase.ids.length,
      returnedChargeCount: ids.length,
      returnedChargeIdsSha256: hashText(JSON.stringify(ids)),
      expectedPositiveFixture: true,
    };
  }
  return results;
}

async function binaryExportContentFixtures(
  result: CarteraReadModel,
): Promise<Record<string, unknown>> {
  const requireFromArtifact = createRequire(
    resolve(scriptDirectory, "../../artifacts/api-server/package.json"),
  );
  const ExcelJS = requireFromArtifact("exceljs") as {
    Workbook: new () => {
      addWorksheet(name: string): {
        columns: Array<{ header: string; key: string; width: number }>;
        addRows(rows: unknown[]): void;
      };
      xlsx: {
        writeBuffer(): Promise<Buffer>;
        load(buffer: Buffer): Promise<void>;
      };
      getWorksheet(index: number | string): {
        getRow(row: number): { values: unknown[] };
      };
    };
  };
  const xlsxBytes = await renderClientesCarteraXlsx(result);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(xlsxBytes);
  const carteraSheet = loaded
    .getWorksheet("Cartera")
    .getRow(1)
    .values
    .slice(1)
    .map(String);
  const headers = ["Cliente", "Saldo", "Saldo a favor", "Vencido", "Primer vencimiento", "Sin plazo definido"];
  assert.deepEqual(
    carteraSheet,
    headers,
    "XLSX fixture headers differ from the cartera export contract.",
  );
  const pdfBytes = renderClientesCarteraPdf(result);
  assert.equal(pdfBytes.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  return {
    xlsx: {
      bytes: xlsxBytes.byteLength,
      sha256: hashText(Buffer.from(xlsxBytes).toString("base64")),
      rowCount: result.clientes.length,
      headers,
    },
    pdf: {
      bytes: pdfBytes.byteLength,
      sha256: hashText(pdfBytes.toString("base64")),
      rowCount: result.clientes.length,
      startsWithPdfHeader: true,
    },
    sourceRowsStored: false,
  };
}

async function main(): Promise<void> {
  const frozenBaseline = verifyFrozenBaseline();
  const dbModule = await import("../../artifacts/api-server/node_modules/@workspace/db/src/index.ts");
  const pool = dbModule.pool as {
    connect(): Promise<QueryExecutor & { query: QueryExecutor["query"]; release(): void }>;
    end(): Promise<void>;
  };
  let client:
    | (QueryExecutor & { query: QueryExecutor["query"]; release(): void })
    | undefined;
  let transactionOpen = false;
  const evidence: Record<string, unknown> = {
    status: "ERROR",
    restrictions: {
      noInserts: true,
      noUsers: true,
      noSessions: true,
      noAuthenticatedHttp: true,
      noServerEntryPointImport: true,
    },
    baseline: frozenBaseline,
  };
  try {
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    const database = readOnlyExecutor(client);
    evidence.identityBefore = await databaseIdentity(database);
    evidence.aggregateCountsBefore = await aggregateCounts(database);

    const globalAuth = buildGlobalAuth();
    const legacyRows = await legacyCartera(database);
    const legacySummary = await legacyResumen(database);
    const canonicalGlobal = await loadClientesCartera(globalAuth, {}, {
      database,
      resolveReadScope,
    });
    assert.deepEqual(
      canonicalRows(canonicalGlobal.clientes),
      canonicalRows(legacyRows),
      "Global cartera rows differ from the exact frozen legacy read model.",
    );
    assert.deepEqual(
      canonicalGlobal.resumen,
      legacySummary,
      "Global cartera summary differs from the exact frozen legacy resumen core.",
    );
    evidence.globalParity = {
      status: "PASS",
      rowCount: canonicalGlobal.clientes.length,
      comparison: "same read-only canonical projection query; legacy source executed from frozen pinned capture",
      legacyRowSha256: digestRows(legacyRows),
      canonicalRowSha256: digestRows(canonicalGlobal.clientes),
      summary: canonicalGlobal.resumen,
      alcance: {
        tipo: canonicalGlobal.alcance.tipo,
        ubicacionCount: canonicalGlobal.alcance.ubicaciones.length,
        saldoAFavorDisponible: canonicalGlobal.alcance.saldoAFavorDisponible,
      },
    };
    evidence.actualDataLimitations = {
      portfolioRowsAvailable: canonicalGlobal.clientes.length > 0,
      creditMovementsAvailable:
        Number((evidence.aggregateCountsBefore as SafeCounts).movimientos_credito) > 0,
      positiveActualPortfolioCasesClaimed: false,
      note:
        canonicalGlobal.clientes.length === 0
          ? "Current DB returned no non-system client portfolio rows; positive evidence below is CTE-only."
          : "Current DB has portfolio rows; CTE evidence remains separately labeled.",
    };

    const sites = await database.query<{ id: number }>(
      "SELECT id FROM ubicaciones ORDER BY id LIMIT 2",
    );
    const siteIds = sites.rows.map((row) => Number(row.id));
    const actualScopeChecks: Record<string, unknown> = {
      availableLocationCount: Number((evidence.aggregateCountsBefore as SafeCounts).ubicaciones),
      selectedLocationCount: siteIds.length,
      singleAndMultiScope: "NOT_RUN",
      restricted403: "NOT_RUN",
      noAssignedScope403: "NOT_RUN",
    };
    evidence.actualScopeChecks = actualScopeChecks;
    if (siteIds.length >= 2) {
      const single = await loadClientesCartera(globalAuth, {
        ubicacionId: String(siteIds[0]),
      }, { database, resolveReadScope });
      const multi = await loadClientesCartera(globalAuth, {
        ubicacionIds: `${siteIds[0]},${siteIds[1]},${siteIds[0]}`,
      }, { database, resolveReadScope });
      assert.equal(single.alcance.tipo, "SITIOS");
      assert.deepEqual(single.alcance.ubicaciones.map((item) => item.id), [siteIds[0]]);
      assert.equal(multi.alcance.tipo, "SITIOS");
      assert.deepEqual(multi.alcance.ubicaciones.map((item) => item.id), siteIds);
      Object.assign(actualScopeChecks, {
        singleAndMultiScope: "PASS",
        single: {
          rowCount: single.clientes.length,
          locationIds: single.alcance.ubicaciones.map((item) => item.id),
        },
        multi: {
          rowCount: multi.clientes.length,
          locationIds: multi.alcance.ubicaciones.map((item) => item.id),
        },
      });
    }

    if (siteIds.length >= 2) {
      await assert.rejects(
        () =>
          loadClientesCartera(
            buildRestrictedAuth(siteIds[0]),
            { ubicacionId: String(siteIds[1]) },
            { database, resolveReadScope },
          ),
        (error: unknown) =>
          Boolean(
            error &&
              typeof error === "object" &&
              "status" in error &&
              (error as { status?: number }).status === 403,
          ),
      );
      Object.assign(actualScopeChecks, {
        restricted403: "PASS",
      });
    }
    await assert.rejects(
      () =>
        loadClientesCartera(
          buildRestrictedAuth(null),
          {},
          { database, resolveReadScope },
        ),
      (error: unknown) =>
        Boolean(
          error &&
            typeof error === "object" &&
            "status" in error &&
            (error as { status?: number }).status === 403,
        ),
    );
    Object.assign(actualScopeChecks, {
      noAssignedScope403: "PASS",
    });

    evidence.positiveAuthorizedChargeCte = await positiveAuthorizedChargeCte(database);
    evidence.binaryExportContentFixtures = await binaryExportContentFixtures(canonicalGlobal);
    evidence.identityAfter = await databaseIdentity(database);
    evidence.aggregateCountsAfter = await aggregateCounts(database);
    evidence.status = "PASS";
  } catch (error) {
    evidence.error = safeError(error);
    evidence.status = "ERROR";
    throw error;
  } finally {
    if (client) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          evidence.rollbackError = safeError(rollbackError);
        }
      }
      client.release();
    }
    try {
      await pool.end();
    } catch (poolError) {
      evidence.poolEndError = safeError(poolError);
    }
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
}

main().catch(() => {
  process.exitCode = 1;
});