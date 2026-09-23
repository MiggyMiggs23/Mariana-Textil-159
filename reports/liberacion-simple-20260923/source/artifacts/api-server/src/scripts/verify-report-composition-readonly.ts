/**
 * Read-only before/after verifier for the report composition refactor.
 *
 * This intentionally is a script rather than a `.test` module.  Importing the
 * application database from a test process activates the database guard.  The
 * script checks out one PostgreSQL client, starts one READ ONLY REPEATABLE READ
 * transaction, and temporarily routes the application pool through that
 * client.  It never runs schema initializers and it rejects write statements.
 *
 * The legacy side is loaded from a temporary git archive of BASELINE_REF
 * (HEAD^ by default).  No watched application file is replaced.  The current
 * side is loaded from the working tree.  Both sides therefore read the same
 * database snapshot, while the query recorder still checks that dates, sites,
 * pagination, and source options were forwarded identically.
 *
 * Capture the current baseline (permitted before the refactor is complete):
 *
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/verify-report-composition-readonly.ts --capture-before
 *
 * The final comparison is deliberately guarded.  The owner must send the
 * scope-complete contract before this command is allowed:
 *
 *   REPORT_SCOPE_COMPLETE=1 pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/verify-report-composition-readonly.ts \
 *     --final --scope-complete
 *
 * The output contains only metrics, IDs, booleans, and hashes.  It does not
 * print DATABASE_URL, credentials, cashier names, customer names, or rows.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type UnknownRecord = Record<string, unknown>;
type QueryRecord = {
  phase: string;
  kind: "cash" | "cancellation" | "destination" | "other";
  params: unknown;
};
type SnapshotQuery = (text: string, values?: unknown[]) => Promise<any>;

type Scope = {
  key: "global" | "site-1" | "site-2";
  siteId: number | null;
  desde: string;
  hasta: string;
  selection: "2026" | "most-recent-year";
  candidateSiteTickets: number;
  candidateSiteSales: number;
};

const PRESERVED_GENERIC_SECTIONS = [
  "ventas",
  "utilidad",
  "inventario",
  "mapas-calor",
  "color",
  "compras",
  "clientes",
  "pagos-dirigidos",
  "que-comprar",
] as const;

type NumberPair = {
  old: number;
  new: number;
  equal: boolean;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, "../../../..");
const BASELINE_REF = process.env.REPORT_BASELINE_REF ?? "HEAD^";
const DEFAULT_BEFORE_PATH = "/tmp/reportes-composition-before.json";
const DEFAULT_FINAL_PATH = "/tmp/reportes-composition-final.json";
const DEFAULT_X04_PATH = "/tmp/reportes-composition-x04-final.json";
const WRITE_SQL = /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COMMENT|VACUUM|REFRESH|CALL|DO)\b/i;
const CASH_COMPOSED_TABLE_IDS = [
  "diferencias-por-cajero",
  "diferencias-por-tienda",
] as const;
const CASH_COMPOSED_CHART_IDS = [
  "diferencias-caja-tendencia",
  "diferencias-caja-exactitud",
] as const;
const X04_TABLE_IDS = ["x04-comparativo-tiendas"] as const;
const X04_CHART_IDS = [
  "x04-comparativo-ventas-tiendas",
  "x04-comparativo-participacion-global",
  "x04-comparativo-mezcla-pago",
] as const;

const asRecord = (value: unknown): UnknownRecord => (
  value !== null && typeof value === "object" ? value as UnknownRecord : {}
);

function numeric(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`No numérico en ${label}.`);
  return result;
}

function money(value: unknown, label: string): number {
  return Number(numeric(value, label).toFixed(2));
}

function count(value: unknown, label: string): number {
  const result = numeric(value, label);
  if (!Number.isInteger(result)) throw new Error(`Conteo no entero en ${label}.`);
  return result;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value !== null && typeof value === "object") {
    const object = value as UnknownRecord;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function equalValues(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function pair(oldValue: unknown, newValue: unknown, label: string): NumberPair {
  const oldNumber = money(oldValue, `${label} anterior`);
  const newNumber = money(newValue, `${label} nuevo`);
  return { old: oldNumber, new: newNumber, equal: oldNumber === newNumber };
}

function pairCount(oldValue: unknown, newValue: unknown, label: string): NumberPair {
  const oldCount = count(oldValue, `${label} anterior`);
  const newCount = count(newValue, `${label} nuevo`);
  return { old: oldCount, new: newCount, equal: oldCount === newCount };
}

function reportKpi(report: unknown, id: string): unknown {
  const kpis = asRecord(report).kpis;
  if (!Array.isArray(kpis)) throw new Error(`El reporte no tiene kpis (${id}).`);
  const item = kpis.find((candidate) => asRecord(candidate).id === id);
  if (item === undefined) throw new Error(`Falta KPI ${id}.`);
  return asRecord(item).value;
}

function reportTable(report: unknown, ...ids: string[]): UnknownRecord {
  const tables = asRecord(report).tables;
  if (!Array.isArray(tables)) throw new Error(`El reporte no tiene tablas (${ids.join("/")}).`);
  const table = tables.find((candidate) => ids.includes(String(asRecord(candidate).id)));
  if (table === undefined) throw new Error(`Falta tabla ${ids.join("/")}.`);
  return asRecord(table);
}

function tableRows(table: UnknownRecord): UnknownRecord[] {
  return Array.isArray(table.rows) ? table.rows.map(asRecord) : [];
}

function normalizeCancellationRows(report: unknown, ...tableIds: string[]): UnknownRecord[] {
  const rows = tableRows(reportTable(report, ...tableIds)).map((row) => {
    const normalized: UnknownRecord = {};
    for (const [key, value] of Object.entries(row)) {
      // Link construction is presentation-only.  All persisted/document
      // identity and every financial value remain in the comparison.
      if (key === "documentoHref" || key.endsWith("Href")) continue;
      normalized[key] = value;
    }
    return normalized;
  });
  return rows.sort((left, right) => stable(left).localeCompare(stable(right)));
}

function semanticCancellationRows(rows: UnknownRecord[]): UnknownRecord[] {
  return rows.map((row) => ({
    folio: row.folio ?? null,
    modalidad: row.modalidad ?? null,
    motivo: row.motivo ?? null,
    sitio: row.sitio ?? null,
    lineas: row.lineas ?? null,
    importe: row.importe ?? null,
  })).sort((left, right) => stable(left).localeCompare(stable(right)));
}

function normalizedRowsHash(rows: UnknownRecord[]): string {
  return createHash("sha256").update(stable(rows)).digest("hex");
}

function cancellationNumbers(rows: UnknownRecord[], label: string) {
  const ids = new Set(rows.map((row) => String(row.ticketId ?? "")));
  const amount = rows.reduce((sum, row) => sum + money(row.importe ?? 0, `${label}.importe`), 0);
  return {
    count: ids.size,
    amount: Number(amount.toFixed(2)),
    rows: rows.length,
  };
}

function tableMoneyTotal(table: UnknownRecord, key: string, label: string): number {
  const totals = asRecord(table.totals);
  if (totals[key] !== undefined) return money(totals[key], `${label}.totals.${key}`);
  return Number(tableRows(table).reduce(
    (sum, row) => sum + money(row[key] ?? 0, `${label}.${key}`),
    0,
  ).toFixed(2));
}

function classifyQuery(sql: string): QueryRecord["kind"] {
  const normalized = sql.replace(/\s+/g, " ");
  if (/WITH cuts AS/i.test(normalized) || /s\.efectivo_contado-s\.fondo_inicial/i.test(normalized)) {
    return "cash";
  }
  if (/t\.estado\s*=\s*'CANCELADO'/i.test(normalized) || /scenario_cancelled/i.test(normalized)) {
    return "cancellation";
  }
  if (/destination_movements/i.test(normalized)) return "destination";
  return "other";
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error as { cause?: { code?: string } };
  const causeCode = cause.cause?.code ? ` [causeCode=${cause.cause.code}]` : "";
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/password\s*=\s*\S+/gi, "password=[redacted]")
    .slice(0, 500) + causeCode;
}

async function makeLegacyArchive(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "report-composition-baseline-"));
  const baselineCommit = execFileSync(
    "git",
    ["rev-parse", `${BASELINE_REF}^{commit}`],
    { cwd: WORKSPACE_ROOT, encoding: "utf8" },
  ).trim();
  const archive = execFileSync(
    "git",
    ["archive", baselineCommit, "artifacts/api-server/src/lib"],
    { cwd: WORKSPACE_ROOT, maxBuffer: 100_000_000 },
  );
  execFileSync("tar", ["-x", "-f", "-", "-C", directory], {
    input: archive,
    maxBuffer: 10_000_000,
  });
  const currentNodeModules = resolve(WORKSPACE_ROOT, "artifacts/api-server/node_modules");
  const temporaryNodeModules = join(directory, "artifacts/api-server/node_modules");
  await symlink(currentNodeModules, temporaryNodeModules, "dir");
  // The archive contains only lib sources, so restore the nearest package
  // boundary.  Without this, tsx treats the legacy graph as CommonJS and
  // cannot load the database package's top-level await.
  await writeFile(
    join(directory, "artifacts/api-server/package.json"),
    JSON.stringify({ type: "module" }),
  );
  return directory;
}

async function loadModules() {
  const db = await import("@workspace/db");
  const currentReportes = await import("../lib/reportes");
  const currentSales = await import("../lib/reportes-sales");
  const currentAnalytics = await import("../lib/admin-analytics");
  const currentComposed = await import("../lib/reportes-composed-export");
  const currentAccounted = await import("../lib/accounted-document");
  const currentFrontendScope = await import(
    `${pathToFileURL(join(
      WORKSPACE_ROOT,
      "artifacts/mariana-textil/src/components/reportes/report-scope.ts",
    )).href}?scope=1`,
  );
  const legacyDirectory = await makeLegacyArchive();
  const legacyReportes = await import(
    `${pathToFileURL(join(legacyDirectory, "artifacts/api-server/src/lib/reportes.ts")).href}?baseline=1`,
  );
  const legacyAnalytics = await import(
    `${pathToFileURL(join(legacyDirectory, "artifacts/api-server/src/lib/admin-analytics.ts")).href}?baseline=1`,
  );
  return {
    db,
    currentReportes,
    currentSales,
    currentAnalytics,
    currentComposed,
    currentAccounted,
    currentFrontendScope,
    legacyReportes,
    legacyAnalytics,
    legacyDirectory,
    baselineCommit: execFileSync(
      "git",
      ["rev-parse", `${BASELINE_REF}^{commit}`],
      { cwd: WORKSPACE_ROOT, encoding: "utf8" },
    ).trim(),
  };
}

async function withReadOnlySnapshot<T>(
  db: { pool: any },
  callback: (query: SnapshotQuery) => Promise<T>,
): Promise<{ value: T; queries: QueryRecord[] }> {
  const pool = db.pool as any;
  const client = await pool.connect();
  const queries: QueryRecord[] = [];
  let phase = "snapshot";
  let pendingQueries: Promise<unknown> = Promise.resolve();
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const query = async (
    rawText: string | { text: string; values?: unknown[] },
    rawValues: unknown[] = [],
  ) => {
    const text = typeof rawText === "string" ? rawText : rawText.text;
    const values = typeof rawText === "string"
      ? rawValues
      : rawValues.length > 0
        ? rawValues
        : rawText.values ?? [];
    phase = currentPhase;
    if (WRITE_SQL.test(text)) {
      throw new Error("La verificación rechazó una sentencia que no es de lectura.");
    }
    queries.push({ phase, kind: classifyQuery(text), params: values });
    queryLogForSnapshot = queries;
    const result = pendingQueries.then(() => client.query(text, values));
    pendingQueries = result.then(() => undefined, () => undefined);
    return result;
  };

  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    // A pool query is the only database seam used by the report and analytics
    // modules.  Replacing it makes an accidental second connection fail closed.
    pool.query = query;
    pool.connect = async () => ({
      query: (text: string | { text: string; values?: unknown[] }, values?: unknown[]) =>
        query(text, values ?? []),
      release: () => undefined,
    });
    const value = await callback(async (text, values) => {
      phase = currentPhase;
      return query(text, values);
    });
    return { value, queries };
  } finally {
    await pendingQueries;
    await client.query("ROLLBACK").catch(() => undefined);
    pool.query = originalQuery;
    pool.connect = originalConnect;
    client.release();
    await pool.end();
  }
}

let currentPhase = "snapshot";

async function discoverScope(
  query: (text: string, values?: unknown[]) => Promise<any>,
  accounted: { accountedDocumentAt(alias?: string): string; accountedDocumentPredicate(alias?: string): string },
): Promise<{ year: number; sites: Array<{ id: number; tickets: number; sales: number }> }> {
  const eventAt = accounted.accountedDocumentAt("t");
  const predicate = accounted.accountedDocumentPredicate("t");
  const yearsResult = await query(
    `SELECT EXTRACT(YEAR FROM (${eventAt} AT TIME ZONE 'America/Mexico_City'))::int AS "year",
            COUNT(DISTINCT t.id)::int tickets
       FROM tickets t
      WHERE ${predicate} AND ${eventAt} IS NOT NULL
      GROUP BY 1
      ORDER BY tickets DESC,"year" DESC`,
  );
  const observedYears = yearsResult.rows
    .map((row: UnknownRecord) => Number(row.year))
    .filter((year: number) => Number.isInteger(year));
  const years = [...new Set([2026, ...observedYears])];

  for (const year of years) {
    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year + 1}-01-01T00:00:00.000Z`;
    const result = await query(
      `SELECT t.ubicacion_id::int site_id,COUNT(DISTINCT t.id)::int tickets,
              COALESCE(SUM(l.importe),0)::numeric sales
         FROM tickets t
         JOIN ticket_lineas l ON l.ticket_id=t.id
        WHERE ${predicate}
          AND ${eventAt} >= $1::timestamptz
          AND ${eventAt} < $2::timestamptz
        GROUP BY t.ubicacion_id
        HAVING COUNT(DISTINCT t.id)>0
        ORDER BY sales DESC,tickets DESC,site_id`,
      [start, end],
    );
    const sites = result.rows
      .map((row: UnknownRecord) => ({
        id: Number(row.site_id),
        tickets: Number(row.tickets),
        sales: Number(row.sales),
      }))
      .filter((row: { id: number; tickets: number; sales: number }) =>
        Number.isInteger(row.id) && row.tickets > 0 && row.sales > 0,
      );
    if (sites.length >= 2) return { year, sites };
  }

  throw new Error(
    "No se encontraron dos sitios con ventas cobradas/autorizadas en un periodo estable; no se inventará población.",
  );
}

async function discoverScenarioProducts(
  query: SnapshotQuery,
): Promise<{ productIds: [number, number]; units: [string, string] }> {
  const result = await query(
    `SELECT DISTINCT ON (p.unidad) p.id::int product_id,p.unidad
       FROM productos p
      WHERE p.unidad IS NOT NULL
      ORDER BY p.unidad,p.id
      LIMIT 2`,
  );
  const products = result.rows
    .map((row: UnknownRecord) => ({
      id: Number(row.product_id),
      unit: String(row.unidad),
    }))
    .filter((row: { id: number; unit: string }) =>
      Number.isInteger(row.id) && row.unit.length > 0,
    );
  if (products.length < 2 || products[0]!.unit === products[1]!.unit) {
    throw new Error(
      "El escenario de cancelación requiere dos unidades reales distintas en productos.",
    );
  }
  return {
    productIds: [products[0]!.id, products[1]!.id],
    units: [products[0]!.unit, products[1]!.unit],
  };
}

const X04_VISIBLE_COLUMN_KEYS = [
  "nombreUbicacion",
  "participacion",
  "ventas",
  "tendenciaPorcentaje",
  "margen",
  "tickets",
  "ticketPromedio",
  "rollosMetraje",
  "mediosPago",
  "mejorPeorDia",
  "porcentajeFacturado",
  "diferenciaCaja",
] as const;
const X04_DIRECT_TOTAL_KEYS = [
  "participacion",
  "ventas",
  "margen",
  "tickets",
  "ticketPromedio",
  "porcentajeFacturado",
  "diferenciaCaja",
] as const;

function x04Quantities(source: UnknownRecord): string {
  return [
    `Rollos · metros: ${source.rollosMetros}`,
    `Rollos · kilos: ${source.rollosKilos}`,
    `Rollos · bolsas: ${source.rollosBolsas}`,
    `Metraje · metros: ${source.metrajeMetros}`,
    `Metraje · bolsas: ${source.metrajeBolsas}`,
  ].join(" · ");
}

function x04Payments(source: UnknownRecord): string {
  return [
    `Efectivo: ${source.efectivo}`,
    `Transferencia: ${source.transferencia}`,
    `Crédito: ${source.credito}`,
  ].join(" · ");
}

function x04SourceSummary(source: unknown): UnknownRecord {
  const value = asRecord(source);
  const stores = Array.isArray(value.tiendas) ? value.tiendas : [];
  const daily = Array.isArray(value.ventasPorFecha) ? value.ventasPorFecha : [];
  return {
    hash: createHash("sha256").update(stable(source)).digest("hex"),
    totals: value.totales ?? null,
    storeCount: stores.length,
    dailyPointCount: daily.length,
    storesHash: createHash("sha256").update(stable(stores)).digest("hex"),
    dailyHash: createHash("sha256").update(stable(daily)).digest("hex"),
  };
}

function x04ExportSummary(
  table: unknown,
  source: unknown,
): UnknownRecord {
  const exported = asRecord(table);
  const sourceValue = asRecord(source);
  const columns = Array.isArray(exported.columns) ? exported.columns.map(asRecord) : [];
  const rows = tableRows(exported);
  const sourceTotals = asRecord(sourceValue.totales);
  const exportTotals = asRecord(exported.totals);
  const sourceTotalKeys = [...X04_DIRECT_TOTAL_KEYS];
  const mismatchedTotalKeys = sourceTotalKeys.filter((key) =>
    !equalValues(sourceTotals[key] ?? null, exportTotals[key] ?? null),
  );
  const formattedTotalKeys = ["rollosMetraje", "mediosPago", "mejorPeorDia", "tendenciaPorcentaje"];
  const formattedTotals: UnknownRecord = {
    rollosMetraje: x04Quantities(sourceTotals),
    mediosPago: x04Payments(sourceTotals),
    mejorPeorDia: null,
    tendenciaPorcentaje: null,
  };
  const mismatchedFormattedKeys = formattedTotalKeys.filter((key) =>
    !equalValues(formattedTotals[key] ?? null, exportTotals[key] ?? null),
  );
  const sourceOwnedTotals = mismatchedTotalKeys.length === 0 && mismatchedFormattedKeys.length === 0;
  return {
    id: exported.id ?? null,
    title: exported.title ?? null,
    columnKeys: columns.map((column) => String(column.key)),
    columnCount: columns.length,
    expectedVisibleColumns: [...X04_VISIBLE_COLUMN_KEYS],
    visibleColumnsExact: equalValues(
      columns.map((column) => String(column.key)),
      X04_VISIBLE_COLUMN_KEYS,
    ),
    rowCount: rows.length,
    rowsHash: createHash("sha256").update(stable(rows)).digest("hex"),
    sourceOwnedTotals,
    mismatchedTotalKeys: [...mismatchedTotalKeys, ...mismatchedFormattedKeys],
    sourceTotalKeys: [...X04_DIRECT_TOTAL_KEYS, ...formattedTotalKeys],
    unrepresentedSourceTotalKeys: Object.keys(sourceTotals).filter(
      (key) => !sourceTotalKeys.includes(key as (typeof X04_DIRECT_TOTAL_KEYS)[number]),
    ),
    sourceTotals,
    exportTotals,
    totalsHash: createHash("sha256").update(stable(exportTotals)).digest("hex"),
  };
}

async function verifyX04(
  modules: Awaited<ReturnType<typeof loadModules>>,
  payloadSnapshot: UnknownRecord,
): Promise<UnknownRecord> {
  const range = modules.currentReportes.reportRange({
    periodo: "personalizado",
    desde: "2026-01-01",
    hasta: "2026-12-31",
  });
  const filters = { desde: range.desde, hasta: range.hasta };
  const oldSource = await runPhase(
    "x04-old-compareStores",
    () => modules.legacyAnalytics.compareStores(filters),
  );
  const newSource = await runPhase(
    "x04-new-compareStores",
    () => modules.currentAnalytics.compareStores(filters),
  );
  const oldExport = modules.currentComposed.comparisonTable(oldSource.value as any);
  const newExport = modules.currentComposed.comparisonTable(newSource.value);
  const oldSourceSummary = x04SourceSummary(oldSource.value);
  const newSourceSummary = x04SourceSummary(newSource.value);
  const oldExportSummary = x04ExportSummary(oldExport, oldSource.value);
  const newExportSummary = x04ExportSummary(newExport, newSource.value);
  const sourceRawEqual = equalValues(oldSource.value, newSource.value);
  const sourceTotalsEqual = equalValues(
    asRecord(oldSource.value).totales,
    asRecord(newSource.value).totales,
  );
  const exportColumnsEqual = equalValues(
    asRecord(oldExportSummary).columnKeys,
    asRecord(newExportSummary).columnKeys,
  );
  const exportTotalsEqual = equalValues(
    asRecord(oldExport).totals,
    asRecord(newExport).totals,
  );
  const sourceOwnedTotals = oldExportSummary.sourceOwnedTotals === true
    && newExportSummary.sourceOwnedTotals === true;
  if (!sourceOwnedTotals || !newExportSummary.visibleColumnsExact) {
    throw new Error(
      `X04 export no conserva columnas o totales propiedad de compareStores (totals=${sourceOwnedTotals}, columns=${String(newExportSummary.visibleColumnsExact)}, mismatchedKeys=${JSON.stringify(newExportSummary.mismatchedTotalKeys)}).`,
    );
  }
  payloadSnapshot.x04 = {
    range,
    filters,
    oldSource: oldSource.value,
    newSource: newSource.value,
    oldExport,
    newExport,
  };
  return {
    scope: "global",
    period: { desde: "2026-01-01", hasta: "2026-12-31" },
    range: {
      desde: range.desde.toISOString(),
      hasta: range.hasta.toISOString(),
    },
    oldSource: oldSourceSummary,
    newSource: newSourceSummary,
    sourceRawEqual,
    sourceTotalsEqual,
    sourceTotals: asRecord(newSource.value).totales ?? null,
    oldExport: oldExportSummary,
    newExport: newExportSummary,
    exportColumnsEqual,
    exportTotalsEqual,
    sourceOwnedTotals,
    visibleColumnsExact: newExportSummary.visibleColumnsExact,
    actualNumbersComparedBySourceIdentity: true,
  };
}

function makeScopes(
  selected: { year: number; sites: Array<{ id: number; tickets: number; sales: number }> },
): Scope[] {
  const desde = `${selected.year}-01-01`;
  const hasta = `${selected.year}-12-31`;
  const selectedSites = selected.sites.slice(0, 2);
  return [
    {
      key: "global",
      siteId: null,
      desde,
      hasta,
      selection: selected.year === 2026 ? "2026" : "most-recent-year",
      candidateSiteTickets: selectedSites.reduce((sum, site) => sum + site.tickets, 0),
      candidateSiteSales: Number(selectedSites.reduce((sum, site) => sum + site.sales, 0).toFixed(2)),
    },
    ...selectedSites.map((site, index) => ({
      key: `site-${index + 1}` as "site-1" | "site-2",
      siteId: site.id,
      desde,
      hasta,
      selection: selected.year === 2026 ? "2026" as const : "most-recent-year" as const,
      candidateSiteTickets: site.tickets,
      candidateSiteSales: Number(site.sales.toFixed(2)),
    })),
  ];
}

function reportInput(scope: Scope, custom = false): UnknownRecord {
  return {
    periodo: "personalizado",
    desde: scope.desde,
    hasta: scope.hasta,
    ...(scope.siteId === null ? {} : { ubicacionIds: String(scope.siteId) }),
    ...(custom ? { umbralCorte: 0, umbralTienda: 0, agrupacion: "mes" } : {}),
  };
}

function analyticsFilters(scope: Scope, range: UnknownRecord): UnknownRecord {
  return {
    desde: range.desde,
    hasta: range.hasta,
    ...(scope.siteId === null ? {} : { ubicacionId: scope.siteId }),
  };
}

async function runPhase<T>(
  name: string,
  callback: () => Promise<T>,
): Promise<{ value: T; phase: string }> {
  currentPhase = name;
  return { value: await callback(), phase: name };
}

function phaseQueries(queries: QueryRecord[], phase: string, kind?: QueryRecord["kind"]) {
  return queries.filter((query) => query.phase === phase && (kind === undefined || query.kind === kind));
}

function expectedDateRange(range: UnknownRecord): [string, string] {
  return [
    (range.desde as Date).toISOString(),
    (range.hasta as Date).toISOString(),
  ];
}

function expectedParamsMatch(
  records: QueryRecord[],
  kind: QueryRecord["kind"],
  scope: Scope,
  range: UnknownRecord,
): boolean {
  const [desde, hasta] = expectedDateRange(range);
  const expectedSiteArray = scope.siteId === null ? undefined : [scope.siteId];
  return records.filter((record) => record.kind === kind).every((record) => {
    const params = Array.isArray(record.params) ? record.params : [];
    if (kind === "cash") {
      // getDifferences also reads the monthly repeated-shortage aggregate;
      // that query intentionally has no bind values.  Validate every
      // date/site-bearing cash query while allowing this fixed auxiliary read.
      if (params.length === 0) return true;
      return equalValues(params, [desde, hasta, scope.siteId]);
    }
    if (kind === "cancellation") {
      return equalValues(params.slice(0, 2), [desde, hasta])
        && equalValues(params[2], expectedSiteArray);
    }
    if (kind === "destination") {
      // listDestinationAccountMovements also reads the previous period.  The
      // current and previous calls must retain the same site and shape; the
      // old/new comparison below checks their complete argument vectors.
      return params.length >= 6 && equalValues(params[2], scope.siteId)
        && (equalValues(params.slice(0, 3), [desde, hasta, scope.siteId])
          || typeof params[0] === "string");
    }
    return true;
  });
}

function sourceArgumentComparison(
  oldQueries: QueryRecord[],
  newQueries: QueryRecord[],
  kind: QueryRecord["kind"],
  scope: Scope,
  range: UnknownRecord,
) {
  const oldArguments = oldQueries.filter((query) => query.kind === kind).map((query) => query.params);
  const newArguments = newQueries.filter((query) => query.kind === kind).map((query) => query.params);
  return {
    oldCalls: oldArguments.length,
    newCalls: newArguments.length,
    oldExpected: expectedParamsMatch(oldQueries, kind, scope, range),
    newExpected: expectedParamsMatch(newQueries, kind, scope, range),
    equal: equalValues(oldArguments, newArguments),
  };
}

function customAlertShape(report: unknown, ...tableIds: string[]): UnknownRecord[] {
  return tableRows(reportTable(report, ...tableIds)).map((row) => ({
    // Do not persist the rendered message, which may contain a cashier name.
    sesionId: row.sesionId ?? null,
    tipo: row.tipo ?? null,
    importe: money(row.importe ?? 0, "alerta.importe"),
  })).sort((left, right) => stable(left).localeCompare(stable(right)));
}

function normalizeDestinationRows(rows: UnknownRecord[], label: string): UnknownRecord[] {
  return rows.map((row) => ({
    documentoId: row.movementId ?? row.documentoId ?? null,
    fecha: row.fecha ?? null,
    documento: row.documento ?? null,
    documentoTipo: row.documentoTipo ?? null,
    clienteId: row.clienteId ?? null,
    sitio: row.sitio ?? null,
    cuentaDestino: row.cuentaDestino ?? null,
    importe: money(row.importe ?? row.monto ?? 0, `${label}.importe`),
    fuente: row.fuente ?? null,
  })).sort((left, right) => stable(left).localeCompare(stable(right)));
}

function destinationSemanticArguments(
  queries: QueryRecord[],
  scope: Scope,
  range: UnknownRecord,
): { filters: string[]; currentFilterPresent: boolean } {
  const records = queries.filter((query) => query.kind === "destination");
  const currentSite = scope.siteId;
  const [desde, hasta] = expectedDateRange(range);
  const currentFilters = records.flatMap((query) => {
    const params = Array.isArray(query.params) ? query.params : [];
    return equalValues(params.slice(0, 6), [
      desde,
      hasta,
      currentSite,
      "TODAS",
      null,
      null,
    ]) ? [stable(params.slice(0, 6))] : [];
  });
  // Previous-period aggregates are allowed to derive their own date range;
  // the selected report range/site/source filters must remain equivalent.
  return {
    filters: [...new Set(currentFilters)].sort(),
    currentFilterPresent: currentFilters.length > 0,
  };
}

function compareDestinationSemantics(
  oldQueries: QueryRecord[],
  newQueries: QueryRecord[],
  scope: Scope,
  range: UnknownRecord,
): UnknownRecord {
  const oldSemantics = destinationSemanticArguments(oldQueries, scope, range);
  const newSemantics = destinationSemanticArguments(newQueries, scope, range);
  return {
    oldFilterVariants: oldSemantics.filters.length,
    newFilterVariants: newSemantics.filters.length,
    oldCurrentSiteFilter: oldSemantics.currentFilterPresent,
    newCurrentSiteFilter: newSemantics.currentFilterPresent,
    equal: equalValues(oldSemantics.filters, newSemantics.filters),
  };
}

function isRemovablePresentationKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return key === "generatedAt"
    || normalized.endsWith("href")
    || normalized.endsWith("url")
    || normalized === "link";
}

function stripPresentationLinks(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPresentationLinks);
  if (value === null || typeof value !== "object") return value;
  const source = value as UnknownRecord;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !isRemovablePresentationKey(key))
      .map(([key, child]) => [key, stripPresentationLinks(child)]),
  );
}

type NumericCell = { path: string; value: number };

function collectNumericCells(value: unknown, path = "$"): NumericCell[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [{ path, value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectNumericCells(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as UnknownRecord).flatMap(([key, child]) =>
      collectNumericCells(child, `${path}.${key}`),
    );
  }
  return [];
}

function isIdentifierNumericPath(path: string): boolean {
  const leaf = path.split(".").at(-1)?.replace(/\[\d+\]$/, "") ?? "";
  return /(?:^|_)(?:id|folio)$/i.test(leaf)
    || /(?:Id|Folio)$/.test(leaf);
}

function collectDifferences(
  oldValue: unknown,
  newValue: unknown,
  path = "$",
  differences: Array<{ path: string; kind: string }> = [],
): Array<{ path: string; kind: string }> {
  if (Object.is(oldValue, newValue)) return differences;
  if (typeof oldValue !== typeof newValue || oldValue === null || newValue === null) {
    differences.push({ path, kind: "value" });
    return differences;
  }
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length !== newValue.length) {
      differences.push({ path, kind: "array-length" });
    }
    const length = Math.max(oldValue.length, newValue.length);
    for (let index = 0; index < length; index += 1) {
      if (index >= oldValue.length || index >= newValue.length) {
        differences.push({ path: `${path}[${index}]`, kind: "missing" });
      } else {
        collectDifferences(oldValue[index], newValue[index], `${path}[${index}]`, differences);
      }
    }
    return differences;
  }
  if (typeof oldValue === "object" && typeof newValue === "object") {
    const oldObject = oldValue as UnknownRecord;
    const newObject = newValue as UnknownRecord;
    const keys = new Set([...Object.keys(oldObject), ...Object.keys(newObject)]);
    for (const key of [...keys].sort()) {
      if (!(key in oldObject) || !(key in newObject)) {
        differences.push({ path: `${path}.${key}`, kind: "missing" });
      } else {
        collectDifferences(oldObject[key], newObject[key], `${path}.${key}`, differences);
      }
    }
    return differences;
  }
  differences.push({
    path,
    kind: typeof oldValue === "number" && typeof newValue === "number"
      ? "numeric"
      : "value",
  });
  return differences;
}

const METRIC_COLUMN_KINDS = new Set([
  "count",
  "days",
  "money",
  "number",
  "percentage",
  "quantity",
]);

function keyedItems(value: unknown, label: string, keyField = "id"): Map<string, UnknownRecord> {
  const items = Array.isArray(value) ? value : [];
  const result = new Map<string, UnknownRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const id = String(record[keyField] ?? "");
    if (!id) continue;
    if (result.has(id)) throw new Error(`ID duplicado en ${label}: ${id}.`);
    result.set(id, record);
  }
  return result;
}

function columnMap(table: UnknownRecord): Map<string, UnknownRecord> {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const result = new Map<string, UnknownRecord>();
  for (const column of columns) {
    const record = asRecord(column);
    const key = String(record.key ?? "");
    if (!key) continue;
    if (result.has(key)) throw new Error(`Columna duplicada en tabla ${String(table.id)}: ${key}.`);
    result.set(key, record);
  }
  return result;
}

function rowBusinessKey(row: UnknownRecord, sharedColumns: Map<string, UnknownRecord>): string {
  const identity = Object.fromEntries([...sharedColumns.entries()]
    .filter(([, column]) => !METRIC_COLUMN_KINDS.has(String(column.kind)))
    .map(([key]) => [key, row[key] ?? null]));
  if (Object.keys(identity).length > 0) return stable(identity);
  return stable(Object.fromEntries([...sharedColumns.keys()].sort().map((key) => [key, row[key] ?? null])));
}

function rowsByBusinessKey(
  rows: UnknownRecord[],
  sharedColumns: Map<string, UnknownRecord>,
): Map<string, UnknownRecord[]> {
  const result = new Map<string, UnknownRecord[]>();
  for (const row of rows) {
    const key = rowBusinessKey(row, sharedColumns);
    const bucket = result.get(key) ?? [];
    bucket.push(row);
    result.set(key, bucket);
  }
  return result;
}

type IdentityComparison = {
  actualMetricEqual: boolean;
  identityEqual: boolean;
  actualMetricDifferences: Array<{ path: string; old: unknown; new: unknown }>;
  identityValueDifferences: string[];
  unmatchedItems: string[];
  authorizedExceptions: string[];
  actualMetricSnapshot: UnknownRecord;
  tableSummary: UnknownRecord[];
  chartSummary: UnknownRecord[];
};

function identityKeyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function compareRowsByIdentity(
  oldRows: UnknownRecord[],
  newRows: UnknownRecord[],
  oldColumns: Map<string, UnknownRecord>,
  newColumns: Map<string, UnknownRecord>,
  path: string,
): {
  differences: Array<{ path: string; old: unknown; new: unknown }>;
  valueDifferences: string[];
  unmatched: string[];
} {
  const sharedColumns = new Map(
    [...oldColumns.entries()].filter(([key]) =>
      newColumns.has(key) && !isRemovablePresentationKey(key),
    ),
  );
  const oldByKey = rowsByBusinessKey(oldRows, sharedColumns);
  const newByKey = rowsByBusinessKey(newRows, sharedColumns);
  const differences: Array<{ path: string; old: unknown; new: unknown }> = [];
  const valueDifferences: string[] = [];
  const unmatched: string[] = [];
  const keys = new Set([...oldByKey.keys(), ...newByKey.keys()]);
  for (const businessKey of [...keys].sort()) {
    const oldBucket = oldByKey.get(businessKey) ?? [];
    const newBucket = newByKey.get(businessKey) ?? [];
    const safeKey = identityKeyHash(businessKey);
    if (oldBucket.length !== newBucket.length) {
      unmatched.push(`${path}.rows[key:${safeKey}].count`);
      continue;
    }
    for (let index = 0; index < oldBucket.length; index += 1) {
      const oldRow = oldBucket[index]!;
      const newRow = newBucket[index]!;
      for (const key of sharedColumns.keys()) {
        if (!equalValues(oldRow[key] ?? null, newRow[key] ?? null)) {
          const differencePath = `${path}.rows[key:${safeKey}][${index}].${key}`;
          valueDifferences.push(differencePath);
          if (METRIC_COLUMN_KINDS.has(String(sharedColumns.get(key)?.kind))) {
            differences.push({
              path: differencePath,
              old: oldRow[key] ?? null,
              new: newRow[key] ?? null,
            });
          }
        }
      }
    }
  }
  return { differences, valueDifferences, unmatched };
}

function compareReportIdentity(oldReport: unknown, newReport: unknown): IdentityComparison {
  const oldData = asRecord(oldReport);
  const newData = asRecord(newReport);
  const actualMetricDifferences: Array<{ path: string; old: unknown; new: unknown }> = [];
  const identityValueDifferences: string[] = [];
  const unmatchedItems: string[] = [];
  const authorizedExceptions: string[] = [];
  const actualMetricSnapshot: UnknownRecord = {
    kpis: {},
    tableTotals: {},
    authorizedRemovedKpis: {},
  };
  const oldKpis = keyedItems(oldData.kpis, "legacy KPI");
  const newKpis = keyedItems(newData.kpis, "current KPI");

  for (const [id, oldKpi] of oldKpis) {
    const newKpi = newKpis.get(id);
    if (newKpi === undefined) {
      if (id === "compras" && oldKpis.has("costo")) {
        if (!equalValues(oldKpi.value, oldKpis.get("costo")!.value)) {
          throw new Error(
            "R01 de compras no autorizado: old compras.value debe ser exactamente old costo.value antes de permitir la eliminación.",
          );
        }
        asRecord(actualMetricSnapshot.authorizedRemovedKpis)[id] = {
          old: oldKpi.value ?? null,
          duplicateOf: "costo",
          duplicateValue: oldKpis.get("costo")!.value ?? null,
        };
        authorizedExceptions.push("kpi:compras (R01 duplicate of kpi:costo)");
      } else {
        unmatchedItems.push(`kpi:${id}:missing-current`);
      }
      continue;
    }
    asRecord(actualMetricSnapshot.kpis)[id] = {
      old: oldKpi.value ?? null,
      new: newKpi.value ?? null,
      equal: equalValues(oldKpi.value ?? null, newKpi.value ?? null),
    };
    if (!equalValues(oldKpi.value ?? null, newKpi.value ?? null)) {
      identityValueDifferences.push(`$.kpis[${id}].value`);
      actualMetricDifferences.push({
        path: `$.kpis[${id}].value`,
        old: oldKpi.value ?? null,
        new: newKpi.value ?? null,
      });
    }
  }
  for (const id of newKpis.keys()) {
    if (!oldKpis.has(id)) unmatchedItems.push(`kpi:${id}:added-current`);
  }

  const oldTables = keyedItems(oldData.tables, "legacy tabla");
  const newTables = keyedItems(newData.tables, "current tabla");
  const tableSummary: UnknownRecord[] = [];
  for (const [id, oldTable] of oldTables) {
    const newTable = newTables.get(id);
    if (newTable === undefined) {
      unmatchedItems.push(`table:${id}:missing-current`);
      continue;
    }
    const oldColumns = columnMap(oldTable);
    const newColumns = columnMap(newTable);
    const oldColumnKeys = new Set(oldColumns.keys());
    const newColumnKeys = new Set(newColumns.keys());
    const missingColumns = [...oldColumnKeys].filter((key) => !newColumnKeys.has(key));
    const addedColumns = [...newColumnKeys].filter((key) => !oldColumnKeys.has(key));
    for (const key of missingColumns) unmatchedItems.push(`table:${id}:column:${key}:missing-current`);
    for (const key of addedColumns) {
      if (isRemovablePresentationKey(key)) {
        authorizedExceptions.push(`table:${id}:column:${key} (authorized link metadata)`);
      } else {
        unmatchedItems.push(`table:${id}:column:${key}:added-current`);
      }
    }
    const rowComparison = compareRowsByIdentity(
      tableRows(oldTable),
      tableRows(newTable),
      oldColumns,
      newColumns,
      `$.tables[${id}]`,
    );
    actualMetricDifferences.push(...rowComparison.differences);
    identityValueDifferences.push(...rowComparison.valueDifferences);
    unmatchedItems.push(...rowComparison.unmatched);
    const oldTotals = asRecord(oldTable.totals);
    const newTotals = asRecord(newTable.totals);
    const sharedTableTotals: UnknownRecord = {};
    const sharedTotals = new Set(
      Object.keys(oldTotals).filter((key) => Object.prototype.hasOwnProperty.call(newTotals, key)),
    );
    for (const key of sharedTotals) {
      sharedTableTotals[key] = {
        old: oldTotals[key] ?? null,
        new: newTotals[key] ?? null,
        equal: equalValues(oldTotals[key] ?? null, newTotals[key] ?? null),
      };
      if (!equalValues(oldTotals[key] ?? null, newTotals[key] ?? null)) {
        actualMetricDifferences.push({
          path: `$.tables[${id}].totals.${key}`,
          old: oldTotals[key] ?? null,
          new: newTotals[key] ?? null,
        });
      }
    }
    asRecord(actualMetricSnapshot.tableTotals)[id] = sharedTableTotals;
    for (const key of Object.keys(oldTotals)) {
      if (!Object.prototype.hasOwnProperty.call(newTotals, key)) {
        unmatchedItems.push(`table:${id}:total:${key}:missing-current`);
      }
    }
    for (const key of Object.keys(newTotals)) {
      if (!Object.prototype.hasOwnProperty.call(oldTotals, key)) {
        unmatchedItems.push(`table:${id}:total:${key}:added-current`);
      }
    }
    tableSummary.push({
      id,
      oldRows: tableRows(oldTable).length,
      newRows: tableRows(newTable).length,
      oldColumns: [...oldColumns.keys()],
      newColumns: [...newColumns.keys()],
      missingColumns,
      addedColumns,
      sharedBusinessRowsCompared: true,
    });
  }
  for (const id of newTables.keys()) {
    if (!oldTables.has(id)) unmatchedItems.push(`table:${id}:added-current`);
  }

  const oldCharts = keyedItems(oldData.charts, "legacy chart");
  const newCharts = keyedItems(newData.charts, "current chart");
  const chartSummary: UnknownRecord[] = [];
  for (const [id, oldChart] of oldCharts) {
    const newChart = newCharts.get(id);
    if (newChart === undefined) {
      unmatchedItems.push(`chart:${id}:missing-current`);
      continue;
    }
    const oldSeries = keyedItems(oldChart.series, `legacy chart ${id} series`, "key");
    const newSeries = keyedItems(newChart.series, `current chart ${id} series`, "key");
    const sharedSeries = [...oldSeries.keys()].filter((key) => newSeries.has(key));
    for (const key of oldSeries.keys()) if (!newSeries.has(key)) unmatchedItems.push(`chart:${id}:series:${key}:missing-current`);
    for (const key of newSeries.keys()) if (!oldSeries.has(key)) unmatchedItems.push(`chart:${id}:series:${key}:added-current`);
    const oldRows = Array.isArray(oldChart.rows) ? oldChart.rows.map(asRecord) : [];
    const newRows = Array.isArray(newChart.rows) ? newChart.rows.map(asRecord) : [];
    const sharedChartColumns = new Map<string, UnknownRecord>();
    const categoryKey = String(oldChart.categoryKey ?? newChart.categoryKey ?? "");
    if (categoryKey) sharedChartColumns.set(categoryKey, { key: categoryKey, kind: "text" });
    for (const key of sharedSeries) sharedChartColumns.set(key, { key, kind: "number" });
    const rowComparison = compareRowsByIdentity(
      oldRows,
      newRows,
      sharedChartColumns,
      sharedChartColumns,
      `$.charts[${id}]`,
    );
    actualMetricDifferences.push(...rowComparison.differences);
    identityValueDifferences.push(...rowComparison.valueDifferences);
    unmatchedItems.push(...rowComparison.unmatched);
    chartSummary.push({ id, oldRows: oldRows.length, newRows: newRows.length, sharedSeries });
  }
  for (const id of newCharts.keys()) {
    if (!oldCharts.has(id)) unmatchedItems.push(`chart:${id}:added-current`);
  }

  return {
    actualMetricEqual: actualMetricDifferences.length === 0,
    identityEqual: identityValueDifferences.length === 0 && unmatchedItems.length === 0,
    actualMetricDifferences,
    identityValueDifferences,
    unmatchedItems,
    authorizedExceptions,
    actualMetricSnapshot,
    tableSummary,
    chartSummary,
  };
}

function reportTableIds(report: unknown): string[] {
  const tables = asRecord(report).tables;
  return Array.isArray(tables)
    ? tables.map((table: unknown) => String(asRecord(table).id))
    : [];
}

function genericSectionComparison(oldReport: unknown, newReport: unknown): UnknownRecord {
  const oldComparable = stripPresentationLinks(oldReport);
  const newComparable = stripPresentationLinks(newReport);
  const identity = compareReportIdentity(oldReport, newReport);
  const differences = collectDifferences(oldComparable, newComparable);
  const oldNumericCells = collectNumericCells(oldComparable);
  const newNumericCells = collectNumericCells(newComparable);
  const oldMetricCells = oldNumericCells.filter((cell) => !isIdentifierNumericPath(cell.path));
  const newMetricCells = newNumericCells.filter((cell) => !isIdentifierNumericPath(cell.path));
  const oldTables = reportTableIds(oldComparable);
  const newTables = reportTableIds(newComparable);
  const numericDifferences = differences
    .filter((difference) => difference.kind === "numeric")
    .map((difference) => {
      const oldCell = oldNumericCells.find((cell) => cell.path === difference.path);
      const newCell = newNumericCells.find((cell) => cell.path === difference.path);
      return {
        path: difference.path,
        old: oldCell?.value,
        new: newCell?.value,
      };
    });
  return {
    equalAfterRemovingOnlyLinksAndGeneratedAt: differences.length === 0,
    identityEqual: identity.identityEqual,
    actualMetricEqual: identity.actualMetricEqual,
    actualMetricDifferences: identity.actualMetricDifferences,
    actualMetricSnapshot: identity.actualMetricSnapshot,
    identityValueDifferences: identity.identityValueDifferences,
    unmatchedItems: identity.unmatchedItems,
    authorizedStructuralExceptions: identity.authorizedExceptions,
    tableIdentitySummary: identity.tableSummary,
    chartIdentitySummary: identity.chartSummary,
    oldTableCount: oldTables.length,
    newTableCount: newTables.length,
    oldTableIds: oldTables,
    newTableIds: newTables,
    missingTableIds: oldTables.filter((id) => !newTables.includes(id)),
    addedTableIds: newTables.filter((id) => !oldTables.includes(id)),
    oldNumericCellCount: oldNumericCells.length,
    newNumericCellCount: newNumericCells.length,
    oldNumericMetricCells: oldMetricCells,
    newNumericMetricCells: newMetricCells,
    rawNumericDifferences: numericDifferences,
    numericDifferences: identity.actualMetricDifferences,
    differencePaths: differences.map((difference) => difference.path),
    nonNumericDifferenceCount: differences.filter((difference) => difference.kind !== "numeric").length,
    differenceCount: differences.length,
    differencePathHash: createHash("sha256").update(stable(differences)).digest("hex"),
  };
}

function optionalReportTable(report: unknown, ...ids: string[]): UnknownRecord | null {
  const tables = asRecord(report).tables;
  if (!Array.isArray(tables)) return null;
  const table = tables.find((candidate) => ids.includes(String(asRecord(candidate).id)));
  return table === undefined ? null : asRecord(table);
}

function scenarioCategorySummary(report: unknown): UnknownRecord {
  const table = optionalReportTable(report, "resumen-cancelaciones");
  if (table === null) return { tablePresent: false };
  const rows = tableRows(table);
  return {
    tablePresent: true,
    rows: rows.map((row) => ({
      modalidad: row.modalidad ?? null,
      tickets: row.tickets ?? null,
      importe: row.importe ?? null,
    })),
    totalCategoryTicketCount: rows.reduce(
      (sum, row) => sum + numeric(row.tickets ?? 0, "scenario.category.tickets"),
      0,
    ),
    totalCategoryAmount: Number(rows.reduce(
      (sum, row) => sum + numeric(row.importe ?? 0, "scenario.category.importe"),
      0,
    ).toFixed(2)),
  };
}

function scenarioProductSummary(report: unknown): UnknownRecord {
  const table = optionalReportTable(report, "productos-cancelados");
  if (table === null) return { tablePresent: false };
  const rows = tableRows(table);
  return {
    tablePresent: true,
    rows: rows.map((row) => ({
      modalidad: row.modalidad ?? null,
      unidad: row.unidad ?? null,
      lineas: row.lineas ?? null,
      cantidad: row.cantidad ?? null,
      importe: row.importe ?? null,
    })),
    totalLines: rows.reduce(
      (sum, row) => sum + numeric(row.lineas ?? 0, "scenario.product.lines"),
      0,
    ),
    totalAmount: Number(rows.reduce(
      (sum, row) => sum + numeric(row.importe ?? 0, "scenario.product.importe"),
      0,
    ).toFixed(2)),
  };
}

type CancellationScenarioConfig = {
  locationId: number;
  productIds: [number, number];
  units: [string, string];
};

function prependScenarioCancellationCte(
  text: string,
  values: unknown[],
  accounted: { accountedDocumentAt(alias?: string): string; accountedDocumentPredicate(alias?: string): string },
  scenario: CancellationScenarioConfig,
): string {
  if (!/t\.estado\s*=\s*'CANCELADO'/i.test(text)) return text;
  const body = text
    .replace(/\s+ORDER BY t\.created_at DESC\s*$/i, "")
    .replace(/\s+ORDER BY importe DESC\s*$/i, "")
    .replace(
      /GROUP BY t\.id,u\.nombre,l\.tipo/i,
      "GROUP BY t.id,t.folio,t.motivo_cancelacion,t.created_at,u.nombre,l.tipo",
    )
    .replace(
      /FROM tickets t JOIN ticket_lineas l/i,
      "FROM scenario_tickets t JOIN scenario_ticket_lines l",
    );
  const cancellationFilter = "t.id IN (SELECT id FROM scenario_tickets)";
  const replaced = body.replace(
    /t\.estado\s*=\s*'CANCELADO'/gi,
    cancellationFilter,
  );
  const scenarioSql = `WITH scenario_tickets (
      id,folio,motivo_cancelacion,cancelado_at,ubicacion_id,estado,documento_tipo,
      cobrado,autorizacion_estado,cobrado_at,autorizado_at,created_at,cliente_id,usuario_terminal_id
    ) AS (
      VALUES
        (-900000001::bigint,'SCENARIO-ACCOUNTED-CANCEL-DATE-OUT',
          'scenario accounted date in range; cancel date out of range',
          ($1::timestamptz - INTERVAL '1 day'),${scenario.locationId},'VENDIDO','TICKET',
          true,NULL::text,$1::timestamptz,NULL::timestamptz,$1::timestamptz,NULL::bigint,NULL::bigint),
        (-900000002::bigint,'SCENARIO-UNPAID-NO-ACCOUNTED-DATE',
          'scenario cancelled unpaid without accounted timestamp',
          ($1::timestamptz + INTERVAL '1 day'),${scenario.locationId},'VENDIDO','TICKET',
          true,NULL::text,NULL::timestamptz,NULL::timestamptz,$1::timestamptz,NULL::bigint,NULL::bigint),
        (-900000003::bigint,'SCENARIO-REVERSE-DATES',
          'scenario accounted date out of range; cancel date in range',
          ($1::timestamptz + INTERVAL '2 days'),${scenario.locationId},'VENDIDO','TICKET',
          true,NULL::text,($1::timestamptz - INTERVAL '1 day'),NULL::timestamptz,$1::timestamptz,NULL::bigint,NULL::bigint)
    ),
    scenario_ticket_lines (
      id,ticket_id,producto_id,tipo,unidad,cantidad,importe,rollo_id
    ) AS (
      VALUES
        (-910000001::bigint,-900000001::bigint,${scenario.productIds[0]},'ROLLO','${scenario.units[0].replace(/'/g, "''")}',1::numeric,100::numeric,NULL::bigint),
        (-910000002::bigint,-900000001::bigint,${scenario.productIds[1]},'METREADO','${scenario.units[1].replace(/'/g, "''")}',2::numeric,50::numeric,NULL::bigint),
        (-910000003::bigint,-900000002::bigint,${scenario.productIds[0]},'ROLLO','${scenario.units[0].replace(/'/g, "''")}',1::numeric,25::numeric,NULL::bigint),
        (-910000004::bigint,-900000003::bigint,${scenario.productIds[1]},'METREADO','${scenario.units[1].replace(/'/g, "''")}',2::numeric,75::numeric,NULL::bigint)
    )
  `;
  return `${scenarioSql}${replaced}`;
}

async function withScenarioCancellation<T>(
  modules: Awaited<ReturnType<typeof loadModules>>,
  query: SnapshotQuery,
  scenario: CancellationScenarioConfig,
  callback: () => Promise<T>,
): Promise<{ value: T; rewrittenStatements: number }> {
  const pool = modules.db.pool as any;
  const originalQuery = pool.query;
  let rewrittenStatements = 0;
  pool.query = (text: string, values: unknown[] = []) => {
    const rewritten = prependScenarioCancellationCte(
      text,
      values,
      modules.currentAccounted,
      scenario,
    );
    if (rewritten !== text) rewrittenStatements += 1;
    return query(rewritten, values);
  };
  try {
    return { value: await callback(), rewrittenStatements };
  } finally {
    pool.query = originalQuery;
  }
}

async function verifyScope(
  scope: Scope,
  modules: Awaited<ReturnType<typeof loadModules>>,
  query: SnapshotQuery,
  queryLog: QueryRecord[],
  enforceEquality: boolean,
  cancellationScenario: CancellationScenarioConfig,
  payloadSnapshot?: UnknownRecord,
): Promise<UnknownRecord> {
  const input = reportInput(scope);
  const oldRange = modules.legacyReportes.reportRange(input);
  const frontendRange = modules.currentFrontendScope.resolveReportRange(input);
  if (frontendRange === undefined) {
    throw new Error(`El helper de alcance no resolvió rango para ${scope.key}.`);
  }
  const scopedApiParams = modules.currentFrontendScope.applyReportScope(input, {
    selectedLocationId: scope.siteId,
    dateRange: frontendRange,
  });
  const newRange = modules.currentReportes.reportRange(scopedApiParams);
  if (!equalValues(
    [oldRange.desde.toISOString(), oldRange.hasta.toISOString()],
    [newRange.desde.toISOString(), newRange.hasta.toISOString()],
  )) {
    throw new Error(`El rango legacy/nuevo no coincide para ${scope.key}.`);
  }
  const filters = analyticsFilters(scope, newRange);
  const scopedLocations = scope.siteId === null ? undefined : [scope.siteId];

  const oldSales = await runPhase(
    `${scope.key}:old-sales`,
    () => modules.legacyReportes.buildReport("ventas", input, scopedLocations, true),
  );
  const oldCash = await runPhase(
    `${scope.key}:old-cash`,
    () => modules.legacyAnalytics.getDifferences(filters, {
      umbralCorte: 0,
      umbralTienda: 0,
      agrupacion: "semana",
    }),
  );
  const oldDestination = await runPhase(
    `${scope.key}:old-destination`,
    () => modules.legacyAnalytics.listDestinationAccountMovements(
      filters,
      "TODAS",
      1,
      10_000,
      { incongruente: true },
    ),
  );
  const oldCustomCash = await runPhase(
    `${scope.key}:old-custom-cash`,
    () => modules.legacyAnalytics.getDifferences(filters, {
      umbralCorte: 500,
      umbralTienda: 500,
      agrupacion: "mes",
    }),
  );

  const newSales = await runPhase(
    `${scope.key}:new-sales`,
    () => modules.currentReportes.buildReport("ventas", scopedApiParams, scopedLocations, true),
  );
  const newControl = await runPhase(
    `${scope.key}:new-control`,
    () => modules.currentReportes.buildReport("control-operativo", scopedApiParams, scopedLocations, true),
  );
  const newCash = await runPhase(
    `${scope.key}:new-cash`,
    () => modules.currentAnalytics.getDifferences(
      {
        desde: newRange.desde,
        hasta: newRange.hasta,
        ...(scope.siteId === null ? {} : { ubicacionId: scope.siteId }),
      },
      { umbralCorte: 0, umbralTienda: 0, agrupacion: "semana" },
    ),
  );
  // CajaDiferencias owns these controls locally.  Keep this call separate
  // from Control operativo: Control intentionally no longer renders cash
  // tables and must not become a second cash consumer.
  const newCustomCash = await runPhase(
    `${scope.key}:new-custom-cash`,
    () => modules.currentAnalytics.getDifferences(
      {
        desde: newRange.desde,
        hasta: newRange.hasta,
        ...(scope.siteId === null ? {} : { ubicacionId: scope.siteId }),
      },
      { umbralCorte: 500, umbralTienda: 500, agrupacion: "mes" },
    ),
  );
  const scenarioRun = await withScenarioCancellation(modules, query, cancellationScenario, async () => {
    const oldScenarioSales = await runPhase(
      `${scope.key}:scenario-old-sales`,
      () => modules.legacyReportes.buildReport("ventas", scopedApiParams, scopedLocations, true),
    );
    const newScenarioSales = await runPhase(
      `${scope.key}:scenario-new-sales`,
      () => modules.currentReportes.buildReport("ventas", scopedApiParams, scopedLocations, true),
    );
    const newScenarioControl = await runPhase(
      `${scope.key}:scenario-new-control`,
      () => modules.currentReportes.buildReport("control-operativo", scopedApiParams, scopedLocations, true),
    );
    return { oldScenarioSales, newScenarioSales, newScenarioControl };
  });
  const oldScenarioRows = normalizeCancellationRows(
    scenarioRun.value.oldScenarioSales.value,
    "cancelaciones",
  );
  const newScenarioSalesRows = normalizeCancellationRows(
    scenarioRun.value.newScenarioSales.value,
    "cancelaciones",
  );
  const newScenarioControlRows = normalizeCancellationRows(
    scenarioRun.value.newScenarioControl.value,
    "cancelaciones-control",
    "cancelaciones",
  );
  const oldScenarioSemanticRows = semanticCancellationRows(oldScenarioRows);
  const newScenarioSalesSemanticRows = semanticCancellationRows(newScenarioSalesRows);
  const newScenarioControlSemanticRows = semanticCancellationRows(newScenarioControlRows);
  const scenarioNumbers = {
    old: cancellationNumbers(oldScenarioRows, "scenario.old"),
    newSales: cancellationNumbers(newScenarioSalesRows, "scenario.newSales"),
    newControl: cancellationNumbers(newScenarioControlRows, "scenario.newControl"),
  };
  const scenarioRawRowsEqual = equalValues(oldScenarioRows, newScenarioSalesRows)
    && equalValues(oldScenarioRows, newScenarioControlRows);
  const scenarioRowsEqual = equalValues(oldScenarioSemanticRows, newScenarioSalesSemanticRows)
    && equalValues(oldScenarioSemanticRows, newScenarioControlSemanticRows);
  const oldScenarioCategory = scenarioCategorySummary(scenarioRun.value.oldScenarioSales.value);
  const newScenarioCategory = scenarioCategorySummary(scenarioRun.value.newScenarioSales.value);
  const oldScenarioProducts = scenarioProductSummary(scenarioRun.value.oldScenarioSales.value);
  const newScenarioProducts = scenarioProductSummary(scenarioRun.value.newScenarioSales.value);
  const scenarioCategoryEqual = equalValues(oldScenarioCategory, newScenarioCategory);
  const scenarioProductsEqual = equalValues(oldScenarioProducts, newScenarioProducts);
  const controlCategoryTablePresent = optionalReportTable(
    scenarioRun.value.newScenarioControl.value,
    "resumen-cancelaciones",
  ) !== null;

  const genericSections: UnknownRecord[] = [];
  const genericPayload: UnknownRecord = {};
  for (const section of PRESERVED_GENERIC_SECTIONS) {
    const oldGeneric = await runPhase(
      `${scope.key}:generic-old-${section}`,
      () => modules.legacyReportes.buildReport(section, scopedApiParams, scopedLocations, true),
    );
    const newGeneric = await runPhase(
      `${scope.key}:generic-new-${section}`,
      () => modules.currentReportes.buildReport(section, scopedApiParams, scopedLocations, true),
    );
    genericSections.push({
      section,
      status: "COMPARED",
      comparison: genericSectionComparison(oldGeneric.value, newGeneric.value),
    });
    genericPayload[section] = {
      old: oldGeneric.value,
      new: newGeneric.value,
    };
  }

  const oldSalesReport = oldSales.value;
  const newSalesReport = newSales.value;
  const oldControlCancellationRows = normalizeCancellationRows(oldSalesReport, "cancelaciones");
  const newSalesCancellationRows = normalizeCancellationRows(newSalesReport, "cancelaciones");
  const newControlCancellationRows = normalizeCancellationRows(newControl.value, "cancelaciones-control", "cancelaciones");
  if (enforceEquality) {
    assert.deepEqual(oldControlCancellationRows, newSalesCancellationRows);
    assert.deepEqual(oldControlCancellationRows, newControlCancellationRows);
  }

  const oldCancellation = cancellationNumbers(oldControlCancellationRows, "old.cancelaciones");
  const newCancellation = cancellationNumbers(newControlCancellationRows, "new.cancelaciones");
  const oldCashData = asRecord(oldCash.value);
  const oldCashSummary = asRecord(oldCashData.resumen);
  const newCashData = asRecord(newCash.value);
  const newCashSummary = asRecord(newCashData.resumen);
  const oldCustomAlerts = asRecord(oldCustomCash.value).alertas;
  const oldCustomAlertShape = Array.isArray(oldCustomAlerts)
    ? oldCustomAlerts.map((row) => {
      const value = asRecord(row);
      return {
        sesionId: value.sesionId ?? null,
        tipo: value.tipo ?? null,
        importe: money(value.importe ?? 0, "old.alerta.importe"),
      };
    }).sort((left, right) => stable(left).localeCompare(stable(right)))
    : [];

  const newCustomAlerts = Array.isArray(asRecord(newCustomCash.value).alertas)
    ? customAlertShape(
      {
        tables: [{
          id: "alertas-desencuadre",
          rows: asRecord(newCustomCash.value).alertas,
        }],
      },
      "alertas-desencuadre",
    )
    : [];
  const oldDestinationData = asRecord(oldDestination.value);
  const newDestinationTable = reportTable(newControl.value, "abonos-incongruentes");
  const oldDestinationCount = count(oldDestinationData.total, "old.abonos.total");
  const newDestinationCount = count(reportKpi(newControl.value, "abonos-incongruentes"), "new.abonos.total");
  const oldDestinationAmount = money(oldDestinationData.montoTotal, "old.abonos.montoTotal");
  const newDestinationAmount = tableMoneyTotal(newDestinationTable, "importe", "new.abonos");
  const oldDestinationRows = normalizeDestinationRows(
    Array.isArray(oldDestinationData.items) ? oldDestinationData.items.map(asRecord) : [],
    "old.abonos",
  );
  const newDestinationRows = normalizeDestinationRows(
    tableRows(newDestinationTable),
    "new.abonos",
  );

  const oldCashShortfallAmount = money(oldCashSummary.importeFaltantes, "old.cash.importeFaltantes");
  const newCashShortfallAmount = money(newCashSummary.importeFaltantes, "new.cash.importeFaltantes");
  const oldCashNet = money(oldCashSummary.diferenciaNeta, "old.cash.diferenciaNeta");
  const newCashNet = money(newCashSummary.diferenciaNeta, "new.cash.diferenciaNeta");

  const oldSalesQueries = phaseQueries(queryLog, oldSales.phase);
  const newSalesQueries = phaseQueries(queryLog, newSales.phase);
  const oldControlQueries = phaseQueries(queryLog, oldCash.phase)
    .concat(phaseQueries(queryLog, oldDestination.phase));
  const newControlQueries = phaseQueries(queryLog, newControl.phase);
  const newCashQueries = phaseQueries(queryLog, newCash.phase);
  const oldCustomQueries = phaseQueries(queryLog, oldCustomCash.phase);
  const newCustomQueries = phaseQueries(queryLog, newCustomCash.phase);
  const range = newRange as UnknownRecord;

  const filterArguments = {
    salesCancellation: sourceArgumentComparison(
      oldSalesQueries,
      newSalesQueries,
      "cancellation",
      scope,
      range,
    ),
    controlCancellation: sourceArgumentComparison(
      oldSalesQueries,
      newControlQueries,
      "cancellation",
      scope,
      range,
    ),
    cash: sourceArgumentComparison(oldControlQueries, newCashQueries, "cash", scope, range),
    destination: compareDestinationSemantics(oldControlQueries, newControlQueries, scope, range),
    customCash: sourceArgumentComparison(oldCustomQueries, newCustomQueries, "cash", scope, range),
  };

  const cancellationRowsEqual = equalValues(oldControlCancellationRows, newControlCancellationRows);
  const customAlertsEqual = equalValues(oldCustomAlertShape, newCustomAlerts);
  const destinationRowsEqual = equalValues(oldDestinationRows, newDestinationRows);
  const result: UnknownRecord = {
    key: scope.key,
    siteId: scope.siteId,
    period: { desde: scope.desde, hasta: scope.hasta, selection: scope.selection },
    oldTab: "legacy Ventas / getDifferences",
    newTab: "new Ventas/Control + embedded Caja Diferencias",
    candidateEvidence: {
      siteTickets: scope.candidateSiteTickets,
      siteSales: scope.candidateSiteSales,
    },
    numbers: {
      sales: pair(
        reportKpi(oldSalesReport, "ventas"),
        reportKpi(newSalesReport, "ventas"),
        `${scope.key}.ventas`,
      ),
      tickets: pairCount(
        reportKpi(oldSalesReport, "tickets"),
        reportKpi(newSalesReport, "tickets"),
        `${scope.key}.tickets`,
      ),
      cancellationCount: pairCount(oldCancellation.count, newCancellation.count, `${scope.key}.cancelaciones.count`),
      cancellationAmount: pair(oldCancellation.amount, newCancellation.amount, `${scope.key}.cancelaciones.amount`),
      cashShortfallCount: pairCount(
        oldCashSummary.faltantes,
        newCashSummary.faltantes,
        `${scope.key}.cash.faltantes`,
      ),
      cashShortfallAmount: pair(oldCashShortfallAmount, newCashShortfallAmount, `${scope.key}.cash.importeFaltantes`),
      cashNet: pair(oldCashNet, newCashNet, `${scope.key}.cash.diferenciaNeta`),
      incongruentAbonoCount: pairCount(oldDestinationCount, newDestinationCount, `${scope.key}.abonos.count`),
      incongruentAbonoAmount: pair(oldDestinationAmount, newDestinationAmount, `${scope.key}.abonos.amount`),
      cashCustomThresholdAlertCount: pairCount(
        oldCustomAlertShape.length,
        newCustomAlerts.length,
        `${scope.key}.cash.customThreshold.alertas`,
      ),
    },
    cancellationRows: {
      countOldTab: oldControlCancellationRows.length,
      countNewTab: newControlCancellationRows.length,
      oldHash: normalizedRowsHash(oldControlCancellationRows),
      newHash: normalizedRowsHash(newControlCancellationRows),
      deepEqualIgnoringLinkFields: cancellationRowsEqual,
    },
    destinationRows: {
      countOld: oldDestinationRows.length,
      countNew: newDestinationRows.length,
      oldHash: normalizedRowsHash(oldDestinationRows),
      newHash: normalizedRowsHash(newDestinationRows),
      semanticEqualIgnoringLinks: destinationRowsEqual,
    },
    customThreshold: {
      umbralCorte: 500,
      umbralTienda: 500,
      agrupacion: "mes",
      oldAlertHash: normalizedRowsHash(oldCustomAlertShape),
      newAlertHash: normalizedRowsHash(newCustomAlerts),
      deepEqual: customAlertsEqual,
    },
    genericSections,
    cancellationScenario: {
      dataKind: "synthetic nonzero SQL scenario; real shared loadCancellationRows SQL and real product units; no persisted fixture",
      statementScopedCte: true,
      rewrittenStatements: scenarioRun.rewrittenStatements,
      cases: {
        includedAccountedDateInRangeCancelDateOutOfRange: true,
        excludedCancelledUnpaidNoAccountedTimestamp: true,
        excludedAccountedDateOutOfRangeCancelDateInRange: true,
      },
      oldSales: scenarioNumbers.old,
      newSales: scenarioNumbers.newSales,
      newControl: scenarioNumbers.newControl,
      oldSalesCategorySummary: oldScenarioCategory,
      newSalesCategorySummary: newScenarioCategory,
      oldSalesProductSummary: oldScenarioProducts,
      newSalesProductSummary: newScenarioProducts,
      controlCategoryTablePresent,
      categoryRowsEqual: scenarioCategoryEqual,
      productRowsEqual: scenarioProductsEqual,
      globalUniqueTicketCount: {
        oldSales: scenarioNumbers.old.count,
        newSales: scenarioNumbers.newSales.count,
        newControl: scenarioNumbers.newControl.count,
      },
      categoryTicketCountIsSeparateMetric: true,
      oldRowsHash: normalizedRowsHash(oldScenarioRows),
      newSalesRowsHash: normalizedRowsHash(newScenarioSalesRows),
      newControlRowsHash: normalizedRowsHash(newScenarioControlRows),
      oldSemanticRowsHash: normalizedRowsHash(oldScenarioSemanticRows),
      newSalesSemanticRowsHash: normalizedRowsHash(newScenarioSalesSemanticRows),
      newControlSemanticRowsHash: normalizedRowsHash(newScenarioControlSemanticRows),
      rawRowsEqualBeforeShapeMapping: scenarioRawRowsEqual,
      rowsEqualAcrossConsumers: scenarioRowsEqual,
    },
    filterArguments,
  };
  if (payloadSnapshot !== undefined) {
    payloadSnapshot[scope.key] = {
      oldSales: oldSales.value,
      newSales: newSales.value,
      oldCash: oldCash.value,
      newCash: newCash.value,
      oldCustomCash: oldCustomCash.value,
      newCustomCash: newCustomCash.value,
      oldDestination: oldDestination.value,
      newControl: newControl.value,
      genericSections: genericPayload,
      cancellationScenario: {
        oldSales: scenarioRun.value.oldScenarioSales.value,
        newSales: scenarioRun.value.newScenarioSales.value,
        newControl: scenarioRun.value.newScenarioControl.value,
      },
    };
  }
  if (enforceEquality) {
    const numberChecks = asRecord(result.numbers);
    for (const [label, value] of Object.entries(numberChecks)) {
      if (asRecord(value).equal !== true) {
        throw new Error(`Número antes/después distinto en ${scope.key}.${label}.`);
      }
    }
    if (!cancellationRowsEqual || !customAlertsEqual || !destinationRowsEqual) {
      throw new Error(`Filas de cancelación, abonos o alertas no coinciden en ${scope.key}.`);
    }
    if (
      scenarioRun.rewrittenStatements < 2
      || scenarioNumbers.old.count === 0
      || scenarioNumbers.newSales.count === 0
      || scenarioNumbers.newControl.count === 0
      || scenarioNumbers.old.amount <= 0
      || scenarioNumbers.newSales.amount <= 0
      || scenarioNumbers.newControl.amount <= 0
      || !scenarioRowsEqual
      || !scenarioCategoryEqual
      || !scenarioProductsEqual
    ) {
      throw new Error(`El escenario CTE de cancelación no produjo una fila no cero en ${scope.key}.`);
    }
    for (const [label, value] of Object.entries(filterArguments)) {
      const check = asRecord(value);
      const destinationCheck = label === "destination";
      if (
        (destinationCheck && (
          check.oldCurrentSiteFilter !== true
          || check.newCurrentSiteFilter !== true
          || check.equal !== true
        ))
        || (!destinationCheck && (
          check.oldExpected !== true
          || check.newExpected !== true
          || check.equal !== true
        ))
      ) {
        throw new Error(`Argumentos de filtro distintos en ${scope.key}.${label}.`);
      }
    }
  }
  return result;
}

async function writeReport(path: string, report: UnknownRecord) {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const captureBefore = args.has("--capture-before");
  const final = args.has("--final");
  const x04Only = args.has("--x04-only");
  if (!captureBefore && !final && !x04Only) {
    console.error(
      "Uso: --capture-before, --final --scope-complete, o --x04-only para la comparación X04 aislada.",
    );
    process.exitCode = 2;
    return;
  }
  if (x04Only && captureBefore) {
    throw new Error("X04-only no se combina con una captura baseline.");
  }
  if (final && (!args.has("--scope-complete") || process.env.REPORT_SCOPE_COMPLETE !== "1")) {
    throw new Error(
      "La comparación final está bloqueada: falta el contrato --scope-complete y REPORT_SCOPE_COMPLETE=1.",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL es obligatorio; no se intentará usar otra conexión.");
  }

  const outputPath = process.env.REPORT_VERIFY_OUTPUT
    ?? (x04Only ? DEFAULT_X04_PATH : final ? DEFAULT_FINAL_PATH : DEFAULT_BEFORE_PATH);
  const payloadOutputPath = process.env.REPORT_VERIFY_PAYLOAD_OUTPUT
    ?? `${outputPath}.payloads.json`;
  const modules = await loadModules();
  try {
    const payloadSnapshots: UnknownRecord = {};
    const result = await withReadOnlySnapshot(modules.db, async (query) => {
      if (x04Only) {
        return { x04: await verifyX04(modules, payloadSnapshots) };
      }
      const selected = await discoverScope(query, modules.currentAccounted);
      const scenarioProducts = await discoverScenarioProducts(query);
      const scopes = makeScopes(selected);
      const results: UnknownRecord[] = [];
      for (const scope of scopes) {
        results.push(await verifyScope(
          scope,
          modules,
          query,
          queryLogForSnapshot,
          final,
          {
            ...scenarioProducts,
            locationId: scope.siteId ?? selected.sites[0]!.id,
          },
          payloadSnapshots,
        ));
      }
      return { selected, scopes, results, scenarioProducts };
    });
    if (x04Only) {
      const x04 = asRecord(result.value.x04);
      const passed = x04.sourceRawEqual === true
        && x04.sourceTotalsEqual === true
        && x04.exportColumnsEqual === true
        && x04.exportTotalsEqual === true
        && x04.sourceOwnedTotals === true
        && x04.visibleColumnsExact === true;
      const report: UnknownRecord = {
        verifier: "verify-report-composition-readonly",
        mode: "x04-only",
        status: passed
          ? "X04_READ_ONLY_COMPLETED"
          : "X04_READ_ONLY_COMPLETED_WITH_REPORTED_DIFFERENCES",
        baselineRef: modules.baselineCommit,
        baselineSelector: BASELINE_REF,
        snapshot: "single READ ONLY REPEATABLE READ connection",
        dataKind: "real development database reads; no synthetic rows",
        outputExcludesPersonalDetails: true,
        selectedPeriod: 2026,
        x04,
        payloadSnapshotPath: payloadOutputPath,
      };
      await writeReport(outputPath, report);
      await writeReport(payloadOutputPath, payloadSnapshots);
      console.log(`x04-only comparison written: ${outputPath}`);
      return;
    }
    const genericValue = result.value as any;
    const genericSectionsEqual = genericValue.results.every((scope: UnknownRecord) =>
      (Array.isArray(scope.genericSections) ? scope.genericSections : []).every((section) =>
        asRecord(asRecord(section).comparison).identityEqual === true,
      ),
    );
    const genericRawStructuralEqual = genericValue.results.every((scope: UnknownRecord) =>
      (Array.isArray(scope.genericSections) ? scope.genericSections : []).every((section) =>
        asRecord(asRecord(section).comparison).equalAfterRemovingOnlyLinksAndGeneratedAt === true,
      ),
    );
    const queryArgumentsEqual = genericValue.results.every((scope: UnknownRecord) =>
      Object.entries(asRecord(scope.filterArguments)).every(([label, check]) => {
        const value = asRecord(check);
        if (label === "destination") {
          return value.oldCurrentSiteFilter === true
            && value.newCurrentSiteFilter === true
            && value.equal === true;
        }
        return value.oldExpected === true && value.newExpected === true && value.equal === true;
      }),
    );
    const genericTablePreservation = genericValue.results.map((scope: UnknownRecord) => {
      const sections = Array.isArray(scope.genericSections) ? scope.genericSections : [];
      const oldTableCount = sections.reduce(
        (sum, section) => sum + Number(asRecord(asRecord(section).comparison).oldTableCount ?? 0),
        0,
      );
      const newTableCount = sections.reduce(
        (sum, section) => sum + Number(asRecord(asRecord(section).comparison).newTableCount ?? 0),
        0,
      );
      return {
        scope: scope.key,
        sectionCount: sections.length,
        oldTableCount,
        newTableCount,
        tableCountsEqual: oldTableCount === newTableCount,
        missingTableIds: sections.flatMap((section) =>
          Array.isArray(asRecord(asRecord(section).comparison).missingTableIds)
            ? asRecord(asRecord(section).comparison).missingTableIds
            : [],
        ),
        addedTableIds: sections.flatMap((section) =>
          Array.isArray(asRecord(asRecord(section).comparison).addedTableIds)
            ? asRecord(asRecord(section).comparison).addedTableIds
            : [],
        ),
      };
    });
    const representativeGenericSections = Array.isArray(genericValue.results[0]?.genericSections)
      ? genericValue.results[0]!.genericSections
      : [];
    const representativeGenericComparisons = representativeGenericSections.map((section: unknown) =>
      asRecord(asRecord(section).comparison),
    );
    const genericSourceMap = {
      sectionCount: representativeGenericComparisons.length,
      tableCountOld: representativeGenericComparisons.reduce(
        (sum: number, comparison: UnknownRecord) => sum + Number(comparison.oldTableCount ?? 0),
        0,
      ),
      tableCountNew: representativeGenericComparisons.reduce(
        (sum: number, comparison: UnknownRecord) => sum + Number(comparison.newTableCount ?? 0),
        0,
      ),
      chartCountOld: representativeGenericComparisons.reduce(
        (sum: number, comparison: UnknownRecord) => sum + (Array.isArray(comparison.chartIdentitySummary)
          ? comparison.chartIdentitySummary.length
          : 0),
        0,
      ),
      chartCountNew: representativeGenericComparisons.reduce(
        (sum: number, comparison: UnknownRecord) => sum + (Array.isArray(comparison.chartIdentitySummary)
          ? comparison.chartIdentitySummary.length
          : 0),
        0,
      ),
      tableIds: representativeGenericComparisons.flatMap((comparison: UnknownRecord) =>
        Array.isArray(comparison.tableIdentitySummary)
          ? comparison.tableIdentitySummary.map((table: unknown) => String(asRecord(table).id))
          : [],
      ),
      chartIds: representativeGenericComparisons.flatMap((comparison: UnknownRecord) =>
        Array.isArray(comparison.chartIdentitySummary)
          ? comparison.chartIdentitySummary.map((chart: unknown) => String(asRecord(chart).id))
          : [],
      ),
      tableIdsBySection: representativeGenericSections.map((section: unknown) => {
        const comparison = asRecord(asRecord(section).comparison);
        return {
          section: String(asRecord(section).section),
          tableIds: Array.isArray(comparison.tableIdentitySummary)
             ? comparison.tableIdentitySummary.map((table: unknown) => String(asRecord(table).id))
            : [],
        };
      }),
      chartIdsBySection: representativeGenericSections.map((section: unknown) => {
        const comparison = asRecord(asRecord(section).comparison);
        return {
          section: String(asRecord(section).section),
          chartIds: Array.isArray(comparison.chartIdentitySummary)
             ? comparison.chartIdentitySummary.map((chart: unknown) => String(asRecord(chart).id))
            : [],
        };
      }),
    };
    const composedSourceMap = {
      generic: genericSourceMap,
      diferenciasCaja: {
        snapshotCaptured: true,
        tableIds: [...CASH_COMPOSED_TABLE_IDS],
        chartIds: [...CASH_COMPOSED_CHART_IDS],
        tableCount: CASH_COMPOSED_TABLE_IDS.length,
        chartCount: CASH_COMPOSED_CHART_IDS.length,
      },
      x04Comparativo: {
        schemaCountedFromCurrentComposedSource: true,
        realDataSnapshotCaptured: false,
        tableIds: [...X04_TABLE_IDS],
        chartIds: [...X04_CHART_IDS],
        tableCount: X04_TABLE_IDS.length,
        chartCount: X04_CHART_IDS.length,
      },
      totals: {
        tableCount: genericSourceMap.tableCountNew
          + CASH_COMPOSED_TABLE_IDS.length
          + X04_TABLE_IDS.length,
        chartCount: genericSourceMap.chartCountNew
          + CASH_COMPOSED_CHART_IDS.length
          + X04_CHART_IDS.length,
      },
    };
    const report: UnknownRecord = {
      verifier: "verify-report-composition-readonly",
      mode: captureBefore ? "before-capture" : "final-comparison",
      status: genericSectionsEqual
        ? "READ_ONLY_SNAPSHOT_COMPLETED"
        : "READ_ONLY_SNAPSHOT_COMPLETED_WITH_REPORTED_DIFFERENCES",
      baselineRef: modules.baselineCommit,
      baselineSelector: BASELINE_REF,
      snapshot: "single READ ONLY REPEATABLE READ connection",
      dataKind: "real development database reads; no synthetic rows",
      outputExcludesPersonalDetails: true,
      selectedPeriod: genericValue.selected.year,
      scopeCount: genericValue.scopes.length,
      cancellationScenarioProducts: genericValue.scenarioProducts,
      scopes: genericValue.results,
      genericSectionsEqual,
      genericRawStructuralEqual,
      genericTablePreservation,
      composedSourceMap,
      queryArgumentChecks: queryArgumentsEqual,
      missingGenericSections: genericValue.results.flatMap((scope: UnknownRecord) =>
        (Array.isArray(scope.genericSections) ? scope.genericSections : [])
          .filter((section) => asRecord(asRecord(section).comparison).status === "missing")
          .map((section) => `${String(scope.key)}:${String(asRecord(section).section)}`),
      ),
      payloadSnapshotPath: payloadOutputPath,
    };
    await writeReport(outputPath, report);
    await writeReport(payloadOutputPath, payloadSnapshots);
    console.log(`${captureBefore ? "before capture" : "final comparison"} written: ${outputPath}`);
  } finally {
    await rm(modules.legacyDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

// The callback API deliberately keeps query records outside the report
// collector's serializable return value.  It is populated by the snapshot
// wrapper below and only read after all phases have completed.
let queryLogForSnapshot: QueryRecord[] = [];

main().catch(async (error) => {
  console.error(`report composition read-only verifier: BLOCKED/FAIL: ${redactError(error)}`);
  process.exitCode = 1;
});