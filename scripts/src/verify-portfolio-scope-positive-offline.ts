/**
 * Positive global-scope parity using an in-memory SQL adapter.
 *
 * This is deliberately separate from the live verifier.  It does not obtain a
 * database client: the adapter only recognizes the two production client
 * SELECTs, while every financial projection is produced by projectCreditLedger
 * and the new service receives its normal injected projection loader.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

import {
  loadClientesCartera,
  type CarteraCliente,
  type CarteraReadDatabase,
  type CarteraReadModel,
} from "../../artifacts/api-server/src/lib/clientes-cartera-read-model.ts";
import {
  renderClientesCarteraPdf,
  renderClientesCarteraXlsx,
} from "../../artifacts/api-server/src/lib/clientes-cartera-export.ts";
import {
  projectCreditLedger,
  type CreditLedgerMovement,
} from "../../artifacts/api-server/src/lib/credit-allocation.ts";
import {
  LEGACY_BASELINE_COMMIT,
  LEGACY_CARTERA_READ_MODEL_SOURCE,
  LEGACY_RESUMEN_HANDLER_CORE_SOURCE,
} from "./verify-portfolio-scope-readonly.baseline.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(
  scriptDirectory,
  "../../reports/portfolio-scope/positive-global-parity-offline.json",
);
const fixedNow = new Date("2026-01-20T12:00:00.000Z");

type QueryResult<T> = { rows: T[] };
type Projection = ReturnType<typeof projectCreditLedger>;
type ProjectionLoader = (
  clientIds: number[],
  database: CarteraReadDatabase,
) => Promise<Map<number, Projection>>;

type FixtureClient = {
  id: number;
  nombre: string;
  activo: boolean;
  es_sistema: boolean;
};

const clients: FixtureClient[] = [
  { id: 1, nombre: "Cliente positivo 1", activo: true, es_sistema: false },
  { id: 2, nombre: "Cliente positivo 2", activo: true, es_sistema: false },
  { id: 3, nombre: "Sistema activo", activo: true, es_sistema: true },
  { id: 4, nombre: "Inactivo excluido", activo: false, es_sistema: false },
];

const movementsByClient = new Map<number, CreditLedgerMovement[]>([
  [
    1,
    [
      {
        id: 101,
        ticketId: 1001,
        tipo: "VENTA_CREDITO",
        importe: "100.00",
        fechaVencimiento: "2026-01-01",
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
      },
      {
        id: 102,
        ticketId: 1002,
        tipo: "VENTA_CREDITO",
        importe: "50.00",
        fechaVencimiento: "2026-01-25",
        createdAt: new Date("2026-01-02T12:00:00.000Z"),
      },
      {
        id: 103,
        ticketId: null,
        tipo: "ABONO",
        importe: "-60.00",
        directedMovimientoId: 102,
        createdAt: new Date("2026-01-10T12:00:00.000Z"),
      },
      {
        id: 104,
        ticketId: null,
        tipo: "REVERSO",
        importe: "60.00",
        movimientoOrigenId: 103,
        createdAt: new Date("2026-01-11T12:00:00.000Z"),
      },
      {
        id: 105,
        ticketId: null,
        tipo: "ABONO",
        importe: "-20.00",
        directedMovimientoId: 101,
        createdAt: new Date("2026-01-19T12:00:00.000Z"),
      },
    ],
  ],
  [
    2,
    [
      {
        id: 201,
        ticketId: 2001,
        tipo: "VENTA_CREDITO",
        importe: "40.00",
        fechaVencimiento: "2026-02-01",
        createdAt: new Date("2026-01-03T12:00:00.000Z"),
      },
      {
        id: 202,
        ticketId: null,
        tipo: "ABONO",
        importe: "-10.00",
        createdAt: new Date("2026-01-04T12:00:00.000Z"),
      },
      {
        id: 203,
        ticketId: null,
        tipo: "AJUSTE",
        importe: "20.00",
        createdAt: new Date("2026-01-05T12:00:00.000Z"),
      },
    ],
  ],
  [
    3,
    [
      {
        id: 301,
        ticketId: 3001,
        tipo: "VENTA_CREDITO",
        importe: "7.00",
        fechaVencimiento: "2026-01-01",
        createdAt: new Date("2026-01-06T12:00:00.000Z"),
      },
    ],
  ],
  [
    4,
    [
      {
        id: 401,
        ticketId: 4001,
        tipo: "VENTA_CREDITO",
        importe: "999.99",
        fechaVencimiento: "2026-01-01",
        createdAt: new Date("2026-01-07T12:00:00.000Z"),
      },
    ],
  ],
]);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function compileBaseline(source: string): string {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.length ?? 0, 0, "Frozen baseline TS must compile.");
  return result.outputText;
}

const executableBaseline = Object.freeze({
  cartera: compileBaseline(LEGACY_CARTERA_READ_MODEL_SOURCE),
  resumen: compileBaseline(LEGACY_RESUMEN_HANDLER_CORE_SOURCE),
});

function fixedDateConstructor(): typeof Date {
  const NativeDate = Date;
  return class FixedDate extends NativeDate {
    constructor(value?: string | number | Date) {
      super(
        value === undefined
          ? fixedNow.getTime()
          : value instanceof NativeDate
            ? value.getTime()
            : value,
      );
    }
  } as typeof Date;
}

function fixtureProjection(clientId: number): Projection {
  return projectCreditLedger(movementsByClient.get(clientId) ?? []);
}

const projectionByClient = new Map(
  clients.map((client) => [client.id, fixtureProjection(client.id)]),
);

const fixtureDatabase: CarteraReadDatabase = {
  async query<T = Record<string, unknown>>(
    text: string,
  ): Promise<QueryResult<T>> {
    const normalized = text.replace(/\s+/g, " ").trim();
    assert.match(normalized, /^SELECT\b/i, "Offline fixture permits SELECT only.");
    if (normalized.includes("id,nombre FROM clientes WHERE activo AND NOT es_sistema")) {
      return {
        rows: clients
          .filter((client) => client.activo && !client.es_sistema)
          .map((client) => ({ id: client.id, nombre: client.nombre })) as T[],
      };
    }
    if (normalized.includes("SELECT id FROM clientes WHERE activo")) {
      return {
        rows: clients
          .filter((client) => client.activo)
          .map((client) => ({ id: client.id })) as T[],
      };
    }
    if (normalized.includes("SELECT id,nombre,es_sistema FROM clientes")) {
      return {
        rows: clients
          .filter((client) => client.activo)
          .map((client) => ({
            id: client.id,
            nombre: client.nombre,
            es_sistema: client.es_sistema,
          })) as T[],
      };
    }
    throw new Error(`Unexpected offline adapter SQL: ${normalized}`);
  },
};

const fixtureLoader: ProjectionLoader = async (clientIds) =>
  new Map(
    clientIds.map((clientId) => [
      clientId,
      projectionByClient.get(clientId) ?? fixtureProjection(clientId),
    ]),
  );

function fixtureAuth(): Parameters<typeof loadClientesCartera>[0] {
  return {
    sessionId: "offline-verifier-no-session",
    user: { rol: "ADMIN", alcanceConsulta: "TODAS", ubicacionId: null },
    location: null,
  } as unknown as Parameters<typeof loadClientesCartera>[0];
}

function globalScopeResolver(): (
  auth: Parameters<typeof loadClientesCartera>[0],
  requestedUbicacionId?: number,
) => { ubicacionId: number | null | undefined; scopeError: string | null } {
  return () => ({ ubicacionId: undefined, scopeError: null });
}

async function runLegacy(
  loader: ProjectionLoader,
): Promise<{ rows: CarteraCliente[]; summary: CarteraReadModel["resumen"] }> {
  const DateConstructor = fixedDateConstructor();
  const carteraFactory = new Function(
    "pool",
    "loadCustomerCreditProjections",
    "centsToMoney",
    "Date",
    `"use strict"; return (${executableBaseline.cartera});`,
  ) as (
    pool: CarteraReadDatabase,
    loader: ProjectionLoader,
    money: (cents: number) => string,
    dateConstructor: typeof Date,
  ) => () => Promise<CarteraCliente[]>;
  const cartera = await carteraFactory(
    fixtureDatabase,
    loader,
    (cents) => (cents / 100).toFixed(2),
    DateConstructor,
  )();

  const summaryFactory = new Function(
    "pool",
    "loadCustomerCreditProjections",
    "centsToMoney",
    "Date",
    `"use strict"; return async function legacySummary(res) {
      ${executableBaseline.resumen}
    };`,
  ) as (
    pool: CarteraReadDatabase,
    loader: ProjectionLoader,
    money: (cents: number) => string,
    dateConstructor: typeof Date,
  ) => (response: { json(value: CarteraReadModel["resumen"]): void }) => Promise<void>;
  let summary: CarteraReadModel["resumen"] | undefined;
  await summaryFactory(
    fixtureDatabase,
    loader,
    (cents) => (cents / 100).toFixed(2),
    DateConstructor,
  )({
    json(value) {
      summary = value;
    },
  });
  assert.ok(summary);
  return { rows: cartera, summary };
}

function sortedRows(rows: CarteraCliente[]): CarteraCliente[] {
  return [...rows].sort((left, right) => Number(left.id) - Number(right.id));
}

async function main(): Promise<void> {
  const pinned = execFileSync("git", ["rev-parse", LEGACY_BASELINE_COMMIT], {
    encoding: "utf8",
  }).trim();
  assert.equal(pinned, LEGACY_BASELINE_COMMIT);

  const legacy = await runLegacy(fixtureLoader);
  const canonical = await loadClientesCartera(fixtureAuth(), {}, {
    database: fixtureDatabase,
    resolveReadScope: globalScopeResolver(),
    loadProjections: fixtureLoader,
    now: () => new Date(fixedNow),
  });
  assert.deepEqual(sortedRows(canonical.clientes), sortedRows(legacy.rows));
  assert.deepEqual(canonical.resumen, legacy.summary);
  assert.deepEqual(
    canonical.clientes.map((row) => row.id),
    [1, 2],
    "System and inactive clients must not appear in cartera rows.",
  );
  assert.equal(canonical.resumen.totalClientes, 3);
  assert.equal(canonical.resumen.totalCartera, "187.00");
  assert.equal(canonical.resumen.totalVencido, "87.00");
  assert.equal(canonical.clientes[0]?.id, 1, "Global rows must be sorted by saldo descending.");

  const legacyExport: CarteraReadModel = {
    resumen: legacy.summary,
    clientes: legacy.rows,
    alcance: canonical.alcance,
  };
  const [legacyXlsx, canonicalXlsx] = await Promise.all([
    renderClientesCarteraXlsx(legacyExport),
    renderClientesCarteraXlsx(canonical),
  ]);
  const legacyPdf = renderClientesCarteraPdf(legacyExport);
  const canonicalPdf = renderClientesCarteraPdf(canonical);
  assert.deepEqual(legacyXlsx, canonicalXlsx);
  assert.deepEqual(legacyPdf, canonicalPdf);

  const report = {
    status: "PASS",
    mode: "OFFLINE_INJECTED_POSITIVE_GLOBAL_PARITY",
    restrictions: {
      noLiveDbClient: true,
      noInserts: true,
      noUsers: true,
      noSessions: true,
      noAuthenticatedHttp: true,
    },
    adapter: {
      sqlMocked: true,
      allowedStatements: "production client SELECTs only",
      financialProjection: "projectCreditLedger",
      newReadModel: "loadClientesCartera with injected loadProjections",
      legacyBody: "exact pinned source after TypeScript transpilation",
    },
    baseline: {
      commit: pinned,
      carteraSourceSha256: hash(LEGACY_CARTERA_READ_MODEL_SOURCE),
      resumenSourceSha256: hash(LEGACY_RESUMEN_HANDLER_CORE_SOURCE),
    },
    fixtureCoverage: {
      activeNonSystemClients: 2,
      activeSystemClients: 1,
      inactiveNonSystemClients: 1,
      mixedDueDates: true,
      directedAbono: true,
      reversedDirectedAbono: true,
      positiveAjuste: true,
      fixedNow: fixedNow.toISOString(),
    },
    parity: {
      status: "PASS",
      summary: canonical.resumen,
      rowCount: canonical.clientes.length,
      legacyRowSha256: hash(sortedRows(legacy.rows)),
      canonicalRowSha256: hash(sortedRows(canonical.clientes)),
      sortedRowIds: canonical.clientes.map((row) => row.id),
      allSummaryFieldsCompared: true,
      allRowFieldsCompared: true,
      systemAndInactiveExcludedFromRows: true,
    },
    globalExportSourceParity: {
      status: "PASS",
      xlsxBytes: canonicalXlsx.byteLength,
      xlsxSha256: hash(canonicalXlsx.toString("base64")),
      pdfBytes: canonicalPdf.byteLength,
      pdfSha256: hash(canonicalPdf.toString("base64")),
      legacyAndCanonicalBytesEqual: true,
      sourceRowsStored: false,
    },
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

main().catch((error: unknown) => {
  const failure = {
    status: "ERROR",
    error: error instanceof Error ? error.message : String(error),
    sourceRowsStored: false,
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  process.exitCode = 1;
});