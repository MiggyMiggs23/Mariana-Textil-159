/**
 * New, operator-run cache-rebuild preservation verification.
 *
 * This wrapper is intentionally narrow.  It can only connect to the already
 * verified disposable restore described by restore-metadata.json; it does not
 * create a database, initialize a server, create a user, run seed, delete or
 * truncate anything, and it never imports the source DATABASE_URL.  The
 * caller owns starting/stopping the existing cluster in the same shell.
 *
 * Required environment:
 *   RUN_DISPOSABLE_RECONSTRUCTION=1
 *   NODE_ENV=test
 *   TEST_DATABASE_URL=<metadata restored_database_url>
 *   APPLICATION_DATABASE_URL=<metadata admin_url>
 *   DATABASE_URL must be absent (the wrapper replaces it with TEST_DATABASE_URL
 *   only immediately before importing the real database-backed function).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { basename, resolve, dirname } from "node:path";

type Row = Record<string, unknown>;

const repositoryRoot = resolve(process.cwd());
const configuredBackupDirectory = process.env.VERIFICATION_BACKUP_DIRECTORY?.trim();
if (!configuredBackupDirectory) {
  throw new Error("VERIFICATION_BACKUP_DIRECTORY is required for a dedicated verified restore.");
}
const backupDirectory = resolve(repositoryRoot, configuredBackupDirectory);
const backupStamp = basename(backupDirectory).replace(/^respaldo-antes-de-purga-/, "");
const reportPath = resolve(
  process.env.VERIFICATION_REPORT_PATH ??
    `reports/verificacion-minimos-preflight-${backupStamp}.json`,
);
const htmlPath = resolve(
  process.env.VERIFICATION_HTML_PATH ??
    `reports/verificacion-minimos-preflight-${backupStamp}.html`,
);
const statePath = resolve(
  process.env.VERIFICATION_STATE_PATH ??
    `reports/verificacion-minimos-preflight-${backupStamp}.state.json`,
);
const metadataPath = resolve(backupDirectory, "restore-metadata.json");
const manifestPath = resolve(backupDirectory, "manifest.json");
const backupStatePath = resolve(backupDirectory, "state.json");
const sourceMinimumPath = resolve(backupDirectory, "source-minimums.json");

const listCTables = [
  "productos",
  "precio_historial",
  "clientes",
  "cliente_documentos",
  "proveedores",
  "usuarios",
  "ubicaciones",
  "pisos",
  "permisos_rol",
  "permisos_usuario",
  "permisos_ubicacion",
  "camionetas",
  "choferes",
  "sesiones",
  "equipos",
  "equipos_checklist",
  "stock_minimo_sitios",
  "stock_minimos",
  "auditoria",
] as const;

const protectedInventoryTables = ["existencias", "movimientos", "rollos"] as const;

type TableName = (typeof listCTables)[number] | (typeof protectedInventoryTables)[number];

interface TableSnapshot {
  table: string;
  present: boolean;
  count: number;
  rowSha256: string | null;
  rows: Row[];
}

interface MinimumSnapshot {
  stock_minimos: Row[];
  stock_minimo_sitios: Row[];
}

interface PairSnapshot {
  producto_id: number;
  ubicacion_id: number;
  movement_total: string;
  available_rolls: number;
  cached_total: string | null;
  cached_rolls: number | null;
  movement_count: number;
  roll_count: number;
  cache_present: boolean;
}

interface CoverageSnapshot {
  active_sites: number;
  active_products: number;
  possible_active_pairs: number;
  configured_active_pairs: number;
  coverage_percent: number | null;
}

interface SourceMinimumEvidence {
  counts: {
    stock_minimos: number;
    stock_minimo_sitios: number;
    active_sites: number;
  };
  stock_minimos: Row[];
  stock_minimo_sitios: Row[];
}

let latestStage = "initializing";

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, json(value), { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

async function writeState(
  status: "RUNNING" | "PASS" | "FAIL",
  extra: Record<string, unknown> = {},
): Promise<void> {
  await writeJson(statePath, {
    status,
    phase: 1,
    operation: "real reconstruirCacheExistencias minimum-preservation verification",
    stage: latestStage,
    exitCode: status === "PASS" ? 0 : status === "FAIL" ? 1 : null,
    childExitCode: status === "PASS" ? 0 : status === "FAIL" ? 1 : null,
    report: reportPath,
    html: htmlPath,
    updatedAtUtc: new Date().toISOString(),
    ...extra,
  });
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableReference(table: string): string {
  return `${quoteIdentifier("public")}.${quoteIdentifier(table)}`;
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function stableString(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function rowHash(rows: Row[]): string {
  const ordered = rows.map(stableValue).sort((left, right) =>
    stableString(left).localeCompare(stableString(right)),
  );
  return createHash("sha256").update(stableString(ordered)).digest("hex");
}

function equalRows(left: Row[], right: Row[]): boolean {
  const leftOrdered = left.map(stableValue).sort((a, b) =>
    stableString(a).localeCompare(stableString(b)),
  );
  const rightOrdered = right.map(stableValue).sort((a, b) =>
    stableString(a).localeCompare(stableString(b)),
  );
  return stableString(leftOrdered) === stableString(rightOrdered);
}

function parseDatabaseUrl(name: string, value: string): {
  url: URL;
  database: string;
  port: number;
} {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${name} is not a PostgreSQL URL.`);
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`${name} must target the local verified disposable cluster.`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) throw new Error(`${name} has no database name.`);
  const port = Number(url.port || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} has an invalid port.`);
  }
  return { url, database, port };
}

async function readObject(path: string): Promise<Row> {
  return JSON.parse(await readFile(path, "utf8")) as Row;
}

function numberValue(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("A numeric database value was invalid.");
  return number;
}

function numericText(value: unknown): string {
  return value === null || value === undefined ? "null" : String(value);
}

function authorValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function isoValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function publicMinimumRows(snapshot: MinimumSnapshot): {
  stock_minimos: Row[];
  stock_minimo_sitios: Row[];
} {
  // Only numeric identifiers, numeric amounts, dates, and author identifiers
  // are emitted. Product/site/user names and credentials never enter reports.
  return {
    stock_minimos: snapshot.stock_minimos
      .map((row) => ({
        id: numberValue(row.id),
        producto_id: numberValue(row.producto_id),
        ubicacion_id: numberValue(row.ubicacion_id),
        cantidad: numericText(row.cantidad),
        updated_by: authorValue(row.updated_by),
        updated_at: isoValue(row.updated_at),
      }))
      .sort((left, right) =>
        `${left.producto_id}:${left.ubicacion_id}`.localeCompare(
          `${right.producto_id}:${right.ubicacion_id}`,
        ),
      ),
    stock_minimo_sitios: snapshot.stock_minimo_sitios
      .map((row) => ({
        ubicacion_id: numberValue(row.ubicacion_id),
        habilitado: Boolean(row.habilitado),
        updated_by: authorValue(row.updated_by),
        updated_at: isoValue(row.updated_at),
      }))
      .sort((left, right) => left.ubicacion_id - right.ubicacion_id),
  };
}

async function assertVerifiedRestore(
  testUrl: string,
  applicationUrl: string,
): Promise<{
  metadata: Row;
  manifest: Row;
  backupState: Row;
  sourceMinimums: SourceMinimumEvidence;
  testTarget: ReturnType<typeof parseDatabaseUrl>;
  applicationTarget: ReturnType<typeof parseDatabaseUrl>;
  clusterDirectory: string;
}> {
  const metadata = await readObject(metadataPath);
  const manifest = await readObject(manifestPath);
  const backupState = await readObject(backupStatePath);
  const sourceMinimums = (await readObject(sourceMinimumPath)) as unknown as SourceMinimumEvidence;
  const testTarget = parseDatabaseUrl("TEST_DATABASE_URL", testUrl);
  const applicationTarget = parseDatabaseUrl(
    "APPLICATION_DATABASE_URL",
    applicationUrl,
  );
  if (testUrl === applicationUrl) {
    throw new Error("TEST_DATABASE_URL and APPLICATION_DATABASE_URL must differ.");
  }
  if (metadata.status === "FAIL") {
    throw new Error("The restored-backup metadata is not usable.");
  }
  const clusterDirectory = resolve(String(metadata.cluster_directory ?? ""));
  const verifiedCluster = resolve(backupDirectory, "restore-cluster-verified");
  if (clusterDirectory !== verifiedCluster) {
    throw new Error("restore-metadata.json does not identify restore-cluster-verified.");
  }
  if (testTarget.database !== String(metadata.database)) {
    throw new Error("TEST_DATABASE_URL does not name the metadata restored database.");
  }
  if (applicationTarget.database !== String(metadata.admin_database)) {
    throw new Error("APPLICATION_DATABASE_URL does not name the metadata admin database.");
  }
  if (testTarget.port !== Number(metadata.port) || applicationTarget.port !== Number(metadata.port)) {
    throw new Error("The local verification URLs do not use the metadata port.");
  }
  if (manifest.status !== "PASS" || manifest.phase !== 1 || manifest.block !== 1) {
    throw new Error("The backup manifest is not PASS for phase 1 block 1.");
  }
  const verification = manifest.verification as Row | undefined;
  if (verification?.allTableCountsMatched !== true) {
    throw new Error("The backup manifest does not state all table counts matched.");
  }
  const sourceMutationPolicy = manifest.sourceMutationPolicy as Row | undefined;
  if (sourceMutationPolicy?.sourceMutated !== false || sourceMutationPolicy.phase2Executed !== false) {
    throw new Error("The backup manifest does not prove an untouched source.");
  }
  if (backupState.status !== "PASS" || Number(backupState.exitCode) !== 0) {
    throw new Error("The verified-backup state file is not PASS with exitCode 0.");
  }
  if (
    !Number.isInteger(sourceMinimums.counts?.stock_minimos) ||
    Number(sourceMinimums.counts.stock_minimos) <= 0 ||
    !Number.isInteger(sourceMinimums.counts?.stock_minimo_sitios) ||
    Number(sourceMinimums.counts.stock_minimo_sitios) <= 0 ||
    !Number.isInteger(sourceMinimums.counts?.active_sites) ||
    Number(sourceMinimums.counts.active_sites) < 0 ||
    sourceMinimums.stock_minimos.length === 0 ||
    sourceMinimums.stock_minimo_sitios.length === 0
  ) {
    throw new Error("The source minimum evidence does not contain populated minima and site switches.");
  }
  return {
    metadata,
    manifest,
    backupState,
    sourceMinimums,
    testTarget,
    applicationTarget,
    clusterDirectory,
  };
}

async function captureTable(
  query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }>,
  table: TableName,
): Promise<TableSnapshot> {
  const presentResult = await query(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    [`public.${table}`],
  );
  const present = presentResult.rows[0]?.present === true;
  if (!present) {
    return { table, present: false, count: 0, rowSha256: null, rows: [] };
  }
  const result = await query(`SELECT * FROM ${tableReference(table)}`);
  return {
    table,
    present: true,
    count: result.rows.length,
    rowSha256: rowHash(result.rows),
    rows: result.rows,
  };
}

async function captureTables(
  query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }>,
  tables: readonly TableName[],
): Promise<TableSnapshot[]> {
  const snapshots: TableSnapshot[] = [];
  for (const table of tables) snapshots.push(await captureTable(query, table));
  return snapshots;
}

function tableSnapshotMap(snapshots: TableSnapshot[]): Map<string, TableSnapshot> {
  return new Map(snapshots.map((snapshot) => [snapshot.table, snapshot]));
}

async function captureMinimums(
  query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }>,
): Promise<MinimumSnapshot> {
  const snapshots = await captureTables(query, [
    "stock_minimos",
    "stock_minimo_sitios",
  ]);
  return {
    stock_minimos: snapshots.find((snapshot) => snapshot.table === "stock_minimos")?.rows ?? [],
    stock_minimo_sitios:
      snapshots.find((snapshot) => snapshot.table === "stock_minimo_sitios")?.rows ?? [],
  };
}

async function captureCoverage(
  query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }>,
): Promise<CoverageSnapshot> {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM stock_minimo_sitios WHERE habilitado = true) AS active_sites,
      (SELECT COUNT(*)::int FROM productos WHERE activo = true) AS active_products,
      (
        SELECT COUNT(*)::int
        FROM productos p
        CROSS JOIN stock_minimo_sitios s
        WHERE p.activo = true AND s.habilitado = true
      ) AS possible_active_pairs,
      (
        SELECT COUNT(*)::int
        FROM stock_minimos m
        JOIN stock_minimo_sitios s ON s.ubicacion_id = m.ubicacion_id
        JOIN productos p ON p.id = m.producto_id
        WHERE p.activo = true AND s.habilitado = true
      ) AS configured_active_pairs
  `);
  const row = result.rows[0] ?? {};
  const possible = numberValue(row.possible_active_pairs);
  const configured = numberValue(row.configured_active_pairs);
  return {
    active_sites: numberValue(row.active_sites),
    active_products: numberValue(row.active_products),
    possible_active_pairs: possible,
    configured_active_pairs: configured,
    coverage_percent: possible === 0 ? null : Number(((configured / possible) * 100).toFixed(3)),
  };
}

async function capturePairs(
  query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }>,
): Promise<PairSnapshot[]> {
  const result = await query(`
    WITH pairs AS (
      SELECT producto_id, ubicacion_id FROM existencias
      UNION
      SELECT producto_id, ubicacion_id FROM movimientos
      UNION
      SELECT producto_id, ubicacion_id FROM rollos
    ),
    movement_totals AS (
      SELECT producto_id, ubicacion_id,
             COALESCE(SUM(cantidad), 0)::numeric(18,3)::text AS movement_total,
             COUNT(*)::int AS movement_count
      FROM movimientos
      GROUP BY producto_id, ubicacion_id
    ),
    available_rolls AS (
      SELECT producto_id, ubicacion_id,
             COUNT(*)::int AS available_rolls,
             COUNT(*)::int AS roll_count
      FROM rollos
      WHERE estado = 'DISPONIBLE'
      GROUP BY producto_id, ubicacion_id
    ),
    all_rolls AS (
      SELECT producto_id, ubicacion_id, COUNT(*)::int AS roll_count
      FROM rollos
      GROUP BY producto_id, ubicacion_id
    )
    SELECT
      pairs.producto_id,
      pairs.ubicacion_id,
      COALESCE(movement_totals.movement_total, '0.000') AS movement_total,
      COALESCE(available_rolls.available_rolls, 0)::int AS available_rolls,
      e.cantidad_total::numeric(18,3)::text AS cached_total,
      e.rollos_count::int AS cached_rolls,
      COALESCE(movement_totals.movement_count, 0)::int AS movement_count,
      COALESCE(all_rolls.roll_count, 0)::int AS roll_count,
      (e.producto_id IS NOT NULL) AS cache_present
    FROM pairs
    LEFT JOIN movement_totals USING (producto_id, ubicacion_id)
    LEFT JOIN available_rolls USING (producto_id, ubicacion_id)
    LEFT JOIN all_rolls USING (producto_id, ubicacion_id)
    LEFT JOIN existencias e USING (producto_id, ubicacion_id)
    ORDER BY pairs.producto_id, pairs.ubicacion_id
  `);
  return result.rows.map((row) => ({
    producto_id: numberValue(row.producto_id),
    ubicacion_id: numberValue(row.ubicacion_id),
    movement_total: numericText(row.movement_total),
    available_rolls: numberValue(row.available_rolls),
    cached_total: row.cached_total === null ? null : numericText(row.cached_total),
    cached_rolls: row.cached_rolls === null ? null : numberValue(row.cached_rolls),
    movement_count: numberValue(row.movement_count),
    roll_count: numberValue(row.roll_count),
    cache_present: row.cache_present === true,
  }));
}

async function captureCacheTupleEvidence(
  query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }>,
): Promise<Row[]> {
  const result = await query(`
    SELECT producto_id, ubicacion_id, xmin::text AS xmin
    FROM existencias
    ORDER BY producto_id, ubicacion_id
  `);
  return result.rows.map((row) => ({
    producto_id: numberValue(row.producto_id),
    ubicacion_id: numberValue(row.ubicacion_id),
    xmin: String(row.xmin),
  }));
}

function invariantRows(pairs: PairSnapshot[]): {
  equal: boolean;
  missingCachePairs: number;
  quantityMismatches: number;
  rollCountMismatches: number;
  rows: PairSnapshot[];
} {
  const missingCachePairs = pairs.filter((row) => !row.cache_present).length;
  const quantityMismatches = pairs.filter(
    (row) => row.cached_total !== row.movement_total,
  ).length;
  const rollCountMismatches = pairs.filter(
    (row) => row.cached_rolls !== row.available_rolls,
  ).length;
  return {
    equal:
      missingCachePairs === 0 &&
      quantityMismatches === 0 &&
      rollCountMismatches === 0,
    missingCachePairs,
    quantityMismatches,
    rollCountMismatches,
    rows: pairs,
  };
}

function comparisonForTables(
  before: TableSnapshot[],
  after: TableSnapshot[],
): {
  rows: Row[];
  allEqual: boolean;
  emptyTablesBefore: string[];
  emptyTablesAfter: string[];
} {
  const beforeMap = tableSnapshotMap(before);
  const afterMap = tableSnapshotMap(after);
  const rows = [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .sort()
    .map((table) => {
      const left = beforeMap.get(table);
      const right = afterMap.get(table);
      const equal =
        left?.present === right?.present &&
        left?.count === right?.count &&
        left?.rowSha256 === right?.rowSha256 &&
        (left && right ? equalRows(left.rows, right.rows) : true);
      return {
        table,
        present_before: left?.present ?? false,
        present_after: right?.present ?? false,
        count_before: left?.count ?? 0,
        count_after: right?.count ?? 0,
        row_sha256_before: left?.rowSha256 ?? null,
        row_sha256_after: right?.rowSha256 ?? null,
        field_for_field_equal: equal,
      };
    });
  return {
    rows,
    allEqual: rows.every((row) => row.field_for_field_equal === true),
    emptyTablesBefore: rows
      .filter((row) => row.present_before === true && row.count_before === 0)
      .map((row) => String(row.table)),
    emptyTablesAfter: rows
      .filter((row) => row.present_after === true && row.count_after === 0)
      .map((row) => String(row.table)),
  };
}

function minimumComparison(
  before: MinimumSnapshot,
  after: MinimumSnapshot,
): {
  exact: boolean;
  before: ReturnType<typeof publicMinimumRows>;
  after: ReturnType<typeof publicMinimumRows>;
} {
  const beforePublic = publicMinimumRows(before);
  const afterPublic = publicMinimumRows(after);
  return {
    exact: stableString(beforePublic) === stableString(afterPublic),
    before: beforePublic,
    after: afterPublic,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function writeHtml(report: Row): Promise<void> {
  const body = escapeHtml(JSON.stringify(report, null, 2));
  await mkdir(dirname(htmlPath), { recursive: true, mode: 0o700 });
  await writeFile(
    htmlPath,
    `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Verificación de mínimos</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.4}pre{white-space:pre-wrap;overflow:auto;background:#f5f5f5;padding:1rem;border-radius:.5rem}</style>
</head><body><h1>Verificación de reconstrucción de caché</h1><pre>${body}</pre></body></html>
`,
    { encoding: "utf8", mode: 0o600 },
  );
}

function functionSourceGuard(source: string): {
  sourcePath: string;
  startLine: number;
  sourceSha256: string;
} {
  const marker = "export async function reconstruirCacheExistencias";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("The real cache-rebuild function could not be read.");
  const nextExport = source.indexOf("\nexport ", start + marker.length);
  const body = source.slice(start, nextExport < 0 ? source.length : nextExport);
  if (!/INSERT\s+INTO\s+existencias/i.test(body)) {
    throw new Error("The real cache-rebuild function did not contain its existencias upsert.");
  }
  if (/\b(?:DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\b/i.test(body)) {
    throw new Error("The real cache-rebuild function contains a forbidden delete/truncate.");
  }
  return {
    sourcePath: "artifacts/api-server/src/lib/inventario.ts",
    startLine: source.slice(0, start).split("\n").length,
    sourceSha256: createHash("sha256").update(body).digest("hex"),
  };
}

async function main(): Promise<void> {
  latestStage = "checking explicit disposable environment";
  await writeState("RUNNING");
  if (process.env.RUN_DISPOSABLE_RECONSTRUCTION !== "1") {
    throw new Error("RUN_DISPOSABLE_RECONSTRUCTION=1 is required.");
  }
  if (process.env.NODE_ENV !== "test") {
    throw new Error("NODE_ENV=test is required.");
  }
  // A source DATABASE_URL is deliberately not read.  The caller must remove it
  // so that even an accidental import cannot select the operational database.
  if (process.env.DATABASE_URL) {
    throw new Error("Refusing to run while DATABASE_URL is present; unset the source URL.");
  }
  const testUrl = process.env.TEST_DATABASE_URL;
  const applicationUrl = process.env.APPLICATION_DATABASE_URL;
  if (!testUrl || !applicationUrl) {
    throw new Error("TEST_DATABASE_URL and APPLICATION_DATABASE_URL are required.");
  }
  const verified = await assertVerifiedRestore(testUrl, applicationUrl);
  const clusterRealPath = await realpath(verified.clusterDirectory);
  const metadataClusterRealPath = await realpath(
    String(verified.metadata.cluster_directory),
  );
  if (clusterRealPath !== metadataClusterRealPath) {
    throw new Error("The live cluster directory differs from restore metadata.");
  }

  latestStage = "reading real cache-rebuild function";
  const functionPath = resolve(repositoryRoot, "artifacts/api-server/src/lib/inventario.ts");
  const functionGuard = functionSourceGuard(await readFile(functionPath, "utf8"));

  // This is the only DATABASE_URL assignment in this wrapper, and it points
  // to TEST_DATABASE_URL.  The source value is never read or used.
  process.env.DATABASE_URL = testUrl;
  latestStage = "importing real function with isolated database guard";
  const { db, pool } = await import("../../lib/db/src/index.ts");
  const { reconstruirCacheExistencias } = await import(
    "../../artifacts/api-server/src/lib/inventario.ts"
  );
  if (typeof reconstruirCacheExistencias !== "function") {
    throw new Error("The real reconstruirCacheExistencias export was not callable.");
  }

  const query = async (text: string, values?: unknown[]): Promise<{ rows: Row[] }> =>
    await pool.query(text, values);
  const identity = async (): Promise<Row> =>
    (await query(`
      SELECT current_database(),
             current_user,
             current_setting('data_directory') AS data_directory,
             inet_server_addr()::text AS server_addr,
             inet_server_port() AS server_port
    `)).rows[0] ?? {};
  const counts = async (): Promise<Row> =>
    (await query(`
      SELECT
        (SELECT COUNT(*)::int FROM existencias) AS existencias,
        (SELECT COUNT(*)::int FROM movimientos) AS movimientos,
        (SELECT COUNT(*)::int FROM rollos) AS rollos,
        (SELECT COUNT(*)::int FROM stock_minimos) AS stock_minimos,
        (SELECT COUNT(*)::int FROM stock_minimo_sitios) AS stock_minimo_sitios
    `)).rows[0] ?? {};

  try {
    latestStage = "confirming live identity and capturing before snapshots";
    const beforeIdentity = await identity();
    assert.equal(
      String(beforeIdentity.current_database),
      verified.testTarget.database,
      "current_database() does not match restored metadata",
    );
    assert.equal(
      String(beforeIdentity.data_directory),
      String(verified.metadata.cluster_directory),
      "data_directory does not match restore metadata",
    );
    assert.equal(Number(beforeIdentity.server_port), Number(verified.metadata.port));

    const beforeListC = await captureTables(query, listCTables);
    const beforeProtected = await captureTables(query, protectedInventoryTables);
    const beforeMinimums = await captureMinimums(query);
    const beforeCoverage = await captureCoverage(query);
    const beforePairs = await capturePairs(query);
    const beforeCacheTupleEvidence = await captureCacheTupleEvidence(query);
    const beforeCounts = await counts();

    latestStage = "invoking actual reconstruirCacheExistencias";
    await db.transaction(async (tx) => {
      await reconstruirCacheExistencias(tx);
    });

    latestStage = "capturing after snapshots and checking preservation";
    const afterIdentity = await identity();
    assert.equal(
      String(afterIdentity.current_database),
      String(beforeIdentity.current_database),
      "current_database changed during verification",
    );
    assert.equal(
      String(afterIdentity.data_directory),
      String(beforeIdentity.data_directory),
      "data_directory changed during verification",
    );
    const afterListC = await captureTables(query, listCTables);
    const afterProtected = await captureTables(query, protectedInventoryTables);
    const afterMinimums = await captureMinimums(query);
    const afterCoverage = await captureCoverage(query);
    const afterPairs = await capturePairs(query);
    const afterCacheTupleEvidence = await captureCacheTupleEvidence(query);
    const afterCounts = await counts();

    const listCComparison = comparisonForTables(beforeListC, afterListC);
    const protectedComparison = comparisonForTables(beforeProtected, afterProtected);
    const sourceMinimums = minimumComparison(
      verified.sourceMinimums,
      beforeMinimums,
    );
    const minimums = minimumComparison(beforeMinimums, afterMinimums);
    const beforeInvariant = invariantRows(beforePairs);
    const afterInvariant = invariantRows(afterPairs);
    const beforeCache = tableSnapshotMap(beforeProtected).get("existencias");
    const afterCache = tableSnapshotMap(afterProtected).get("existencias");
    const cacheValueChanged = !(
      beforeCache &&
      afterCache &&
      equalRows(beforeCache.rows, afterCache.rows)
    );
    const beforeCacheRowsByKey = new Map(
      beforePairs.map((row) => [`${row.producto_id}:${row.ubicacion_id}`, row]),
    );
    const afterCacheRowsByKey = new Map(
      afterPairs.map((row) => [`${row.producto_id}:${row.ubicacion_id}`, row]),
    );
    const beforeXminByKey = new Map(
      beforeCacheTupleEvidence.map((row) => [
        `${row.producto_id}:${row.ubicacion_id}`,
        String(row.xmin),
      ]),
    );
    const afterXminByKey = new Map(
      afterCacheTupleEvidence.map((row) => [
        `${row.producto_id}:${row.ubicacion_id}`,
        String(row.xmin),
      ]),
    );
    const cacheXminChangedKeys = [...afterXminByKey.keys()].filter(
      (key) => beforeXminByKey.get(key) !== afterXminByKey.get(key),
    );
    const updatedTimestampChangedCount = afterCache?.rows.filter((row) => {
      const beforeRow = beforeCache?.rows.find(
        (candidate) =>
          candidate.producto_id === row.producto_id &&
          candidate.ubicacion_id === row.ubicacion_id,
      );
      return beforeRow && stableString(beforeRow.updated_at) !== stableString(row.updated_at);
    }).length ?? 0;

    const countsStable =
      stableString(beforeCounts) === stableString(afterCounts) &&
      beforeProtected.every((beforeRow) => {
        const afterRow = afterProtected.find((row) => row.table === beforeRow.table);
        return (
          afterRow?.count === beforeRow.count &&
          afterRow?.rowSha256 === beforeRow.rowSha256
        );
      }) &&
      listCComparison.allEqual;
    const noForbiddenDataMutation =
      protectedComparison.rows
        .filter((row) => row.table !== "existencias")
        .every((row) => row.field_for_field_equal === true) &&
      listCComparison.allEqual;

    const status =
      listCComparison.allEqual &&
      minimums.exact &&
      protectedComparison.rows
        .filter((row) => row.table !== "existencias")
        .every((row) => row.field_for_field_equal === true) &&
      afterInvariant.equal &&
      afterInvariant.rows.length > 0 &&
      countsStable &&
      noForbiddenDataMutation &&
      sourceMinimums.exact &&
      cacheXminChangedKeys.length > 0;
    if (!status) {
      throw new Error("One or more cache, invariant, or preservation assertions failed.");
    }

    const report: Row = {
      status: "PASS",
      phase: 1,
      operation: "real reconstruirCacheExistencias disposable restored-cluster verification",
      policy: {
        source_database_url_imported: false,
        source_database_url_used_for_mutation: false,
        users_created: false,
        seed_executed: false,
        delete_executed: false,
        truncate_executed: false,
        server_started_by_wrapper: false,
        database_created_by_wrapper: false,
        manual_cache_mutation: false,
        restored_cluster_preserved: true,
      },
      backup_gate: {
        metadata_path: metadataPath,
        manifest_status: verified.manifest.status,
        backup_state_status: verified.backupState.status,
        backup_state_exit_code: verified.backupState.exitCode,
        cluster_directory_matches_metadata: clusterRealPath === metadataClusterRealPath,
        restored_database_matches_metadata: true,
        admin_database_matches_metadata: true,
      },
      execution: {
        real_export_invoked: true,
        mocked_db: false,
        function_source: functionGuard,
        current_database_before: beforeIdentity.current_database,
        current_database_after: afterIdentity.current_database,
        data_directory_before: beforeIdentity.data_directory,
        data_directory_after: afterIdentity.data_directory,
        server_port_before: beforeIdentity.server_port,
        server_port_after: afterIdentity.server_port,
        cache_value_changed: cacheValueChanged,
        cache_tuple_xmin_changed_count: cacheXminChangedKeys.length,
        cache_tuple_xmin_changed_keys: cacheXminChangedKeys,
        cache_tuple_xmin_before: beforeCacheTupleEvidence,
        cache_tuple_xmin_after: afterCacheTupleEvidence,
        actual_write_proof:
          cacheXminChangedKeys.length > 0
            ? "PASS: existencias xmin changed after the real transactional rebuild."
            : "FAIL: no existencias xmin changed after the real transactional rebuild.",
        cache_updated_timestamp_changed_count: updatedTimestampChangedCount,
        cache_timestamp_note:
          updatedTimestampChangedCount > 0
            ? "At least one real cache timestamp changed."
            : "The real function updates quantity/count fields and does not set updated_at; value/invariant evidence is used.",
        child_exit_code: 0,
      },
      counts: {
        before: beforeCounts,
        after: afterCounts,
        unchanged_for_protected_and_list_c_rows: countsStable,
      },
      summary: {
        status: "PASS",
        counts_before: beforeCounts,
        counts_after: afterCounts,
        active_minimum_configuration_coverage: afterCoverage,
        any_empty_tables: listCComparison.emptyTablesAfter.length > 0,
        empty_tables: listCComparison.emptyTablesAfter,
        empty_table_count: listCComparison.emptyTablesAfter.length,
        empty_table_limit:
          "informational only; no empty List C table was created, filled, deleted, or truncated",
      },
      list_c: {
        requested_table_count: listCTables.length,
        requested_tables: [...listCTables],
        prompt_list_c_count_note:
          "The supplied prompt enumerates 19 List C table names; no twentieth table name was supplied.",
        missing_tables: listCComparison.rows
          .filter((row) => row.present_before !== true || row.present_after !== true)
          .map((row) => row.table),
        missing_table_explanation:
          "A table is reported missing when to_regclass(public.<name>) is null in the verified restore; it was not created by this check.",
        rows: listCComparison.rows,
        all_rows_field_for_field_identical: listCComparison.allEqual,
        any_empty_tables_before: listCComparison.emptyTablesBefore.length > 0,
        any_empty_tables_after: listCComparison.emptyTablesAfter.length > 0,
        empty_tables_before: listCComparison.emptyTablesBefore,
        empty_tables_after: listCComparison.emptyTablesAfter,
        empty_table_limit: "reported only; no empty table was created or filled",
      },
      inventory: {
        protected_table_rows: protectedComparison.rows,
        movements_and_rollos_field_for_field_identical:
          protectedComparison.rows
            .filter((row) => row.table !== "existencias")
            .every((row) => row.field_for_field_equal === true),
        before_invariant: {
          equal: beforeInvariant.equal,
          missing_cache_pairs: beforeInvariant.missingCachePairs,
          quantity_mismatches: beforeInvariant.quantityMismatches,
          roll_count_mismatches: beforeInvariant.rollCountMismatches,
        },
        after_invariant: {
          equal: afterInvariant.equal,
          missing_cache_pairs: afterInvariant.missingCachePairs,
          quantity_mismatches: afterInvariant.quantityMismatches,
          roll_count_mismatches: afterInvariant.rollCountMismatches,
          pair_count: afterInvariant.rows.length,
        },
        cache_pairs_before: beforePairs.map((row) => ({
          producto_id: row.producto_id,
          ubicacion_id: row.ubicacion_id,
          movement_total: row.movement_total,
          available_rolls: row.available_rolls,
          cached_total: row.cached_total,
          cached_rolls: row.cached_rolls,
        })),
        cache_pairs_after: afterPairs.map((row) => ({
          producto_id: row.producto_id,
          ubicacion_id: row.ubicacion_id,
          movement_total: row.movement_total,
          available_rolls: row.available_rolls,
          cached_total: row.cached_total,
          cached_rolls: row.cached_rolls,
        })),
        cache_row_changed_keys: [...afterCacheRowsByKey.keys()].filter(
          (key) =>
            stableString(beforeCacheRowsByKey.get(key)) !==
            stableString(afterCacheRowsByKey.get(key)),
        ),
      },
      minimum_configuration: {
        active_coverage_before: beforeCoverage,
        active_coverage_after: afterCoverage,
        exact_field_for_field_preservation: minimums.exact,
        source_to_restored_before_exact: sourceMinimums.exact,
        source_counts: verified.sourceMinimums.counts,
        coverage_status:
          afterCoverage.possible_active_pairs === 0
            ? "EMPTY_RESTORED_CONFIGURATION_NO_ACTIVE_SITE_PRODUCT_PAIRS"
            : "CONFIGURED_ACTIVE_SITE_PRODUCT_PAIRS_PRESENT",
        rows_source: publicMinimumRows(verified.sourceMinimums),
        rows_before: minimums.before,
        rows_after: minimums.after,
        numeric_amounts_dates_and_author_ids_only: true,
      },
      assertions: {
        cache_after_equals_movement_sums_and_available_roll_counts: afterInvariant.equal,
        minimum_configuration_deep_equal_before_after: minimums.exact,
        source_minimum_configuration_matches_restored_before: sourceMinimums.exact,
        list_c_rows_deep_equal_before_after: listCComparison.allEqual,
        movements_and_rollos_unchanged: protectedComparison.rows
          .filter((row) => row.table !== "existencias")
          .every((row) => row.field_for_field_equal === true),
        counts_unchanged: countsStable,
        actual_function_invoked: true,
        actual_cache_write_proven: cacheXminChangedKeys.length > 0,
      },
      reports: {
        json: reportPath,
        html: htmlPath,
        state: statePath,
      },
    };
    await writeJson(reportPath, report);
    await writeHtml(report);
    latestStage = "completed PASS";
    await writeState("PASS", {
      childExitCode: 0,
      currentDatabase: beforeIdentity.current_database,
      dataDirectory: beforeIdentity.data_directory,
      minimumTablesPopulatedCaseExercised: true,
      minimumPreservationProven: sourceMinimums.exact && minimums.exact,
      activeSites: afterCoverage.active_sites,
      cacheWriteProven: cacheXminChangedKeys.length > 0,
      cacheXminChangedCount: cacheXminChangedKeys.length,
      report: reportPath,
      html: htmlPath,
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "PASS",
          report: reportPath,
          html: htmlPath,
          state: statePath,
          counts: afterCounts,
          activeMinimumCoverage: afterCoverage,
          sourceMinimumCounts: verified.sourceMinimums.counts,
          restoredMinimumCounts: {
            stock_minimos: beforeMinimums.stock_minimos.length,
            stock_minimo_sitios: beforeMinimums.stock_minimo_sitios.length,
          },
          cacheWriteProven: cacheXminChangedKeys.length > 0,
          cacheXminChangedCount: cacheXminChangedKeys.length,
          anyEmptyTables: listCComparison.emptyTablesAfter.length > 0,
          emptyTableCount: listCComparison.emptyTablesAfter.length,
          childExitCode: 0,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end();
  }
}

await main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error.message : "Unknown verification failure.";
  latestStage = `failed: ${reason}`;
  const failure = {
    status: "FAIL",
    phase: 1,
    operation: "real reconstruirCacheExistencias disposable restored-cluster verification",
    reason,
    policy: {
      source_database_url_imported: false,
      source_database_url_used_for_mutation: false,
      users_created: false,
      seed_executed: false,
      delete_executed: false,
      truncate_executed: false,
      server_started_by_wrapper: false,
    },
    reports: { json: reportPath, html: htmlPath, state: statePath },
  };
  await writeJson(reportPath, failure).catch(() => undefined);
  await writeHtml(failure).catch(() => undefined);
  await writeState("FAIL", { childExitCode: 1, reason }).catch(() => undefined);
  console.error(`Disposable cache verification failed: ${reason}`);
  process.exitCode = 1;
});