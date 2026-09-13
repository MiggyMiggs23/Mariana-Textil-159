/**
 * Operator-only Phase 2 purge rehearsal.
 *
 * This file is deliberately not imported by the API and has no seed/migration
 * path.  It defaults to no operation.  A real development run requires the
 * exact authorization phrase, the development environment, heliumdb as the
 * server identity, the verified 2026-09-13-101833 restore as the immutable
 * baseline, and an explicit parent workflow-pause acknowledgement.
 *
 * Modes:
 *   pnpm --filter @workspace/scripts exec tsx src/purge-operational-phase2.mts --preflight
 *   PHASE2_REHEARSAL=1 NODE_ENV=test TEST_DATABASE_URL=<metadata restored url> \
 *     pnpm --filter @workspace/scripts exec tsx src/purge-operational-phase2.mts --rehearse
 *   REQUIRE_PHASE2_AUTHORIZATION=PURGE_LISTS_A33_B7_C18_HELIUMDB \
 *   PHASE2_BACKGROUND_WORKFLOWS_PAUSED=1 NODE_ENV=development \
 *     pnpm --filter @workspace/scripts exec tsx src/purge-operational-phase2.mts --apply
 *
 * The committed disposable post-purge/UI/ticket proof is a separate harness:
 * scripts/src/disposable-phase2-ui-harness.mts (never used by --apply).
 *
 * Re-restore the disposable cluster from the verified dump before --apply
 * (the helper can advance nontransactional sequences), then set
 * PHASE2_REHEARSAL_RESTORED=1.  Apply also requires the separate disposable
 * postpurge proof:
 *   PHASE2_DISPOSABLE_PROOF_PATH=.local/<proof>.json
 *   PHASE2_DISPOSABLE_PROOF_SHA256=<sha256-of-proof>
 *
 * If the backup commit differs only outside the protected application source
 * trees, review the recorded source fingerprint before --apply and add:
 *   PHASE2_SOURCE_DRIFT_ACK=ACK_BACKUP_COMMIT_DRIFT_REVIEWED
 *
 * The caller, not this script, starts/stops the verified restore cluster.  The
 * rehearsal target is always the database URL in restore-metadata.json; an
 * arbitrary target URL is not accepted.  No backup is created here.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import {
  chmod,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Database rows are opaque evidence values; only counts/hashes are serialized.
type Row = Record<string, any>;
type QueryResult = { rows: Row[]; rowCount?: number | null };
type PgClient = {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
};
type PgPool = {
  connect(): Promise<PgClient>;
  end(): Promise<void>;
};
type PoolConstructor = new (options: Record<string, unknown>) => PgPool;
type DatabaseModule = {
  db: {
    transaction<T>(
      callback: (tx: unknown) => Promise<T>,
    ): Promise<T>;
  };
  pool: { end(): Promise<void> };
};
type DrizzleSql = {
  raw(text: string): unknown;
};
type DrizzleRuntime = { sql: DrizzleSql };

const execFile = promisify(execFileCallback);
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "../..");
const backupDirectory = resolve(
  repositoryRoot,
  "scripts/.local/backups/respaldo-antes-de-purga-2026-09-13-101833",
);
const manifestPath = resolve(backupDirectory, "manifest.json");
const sourceSnapshotPath = resolve(backupDirectory, "source-snapshot.json");
const sourceMinimumsPath = resolve(backupDirectory, "source-minimums.json");
const restoreComparisonPath = resolve(backupDirectory, "restore-comparison.json");
const restoreMetadataPath = resolve(backupDirectory, "restore-metadata.json");
const driveVerificationPath = resolve(backupDirectory, "drive-verification.json");
const backupStatePath = resolve(backupDirectory, "state.json");
const expectedArchivePath = resolve(
  backupDirectory,
  "respaldo-antes-de-purga-2026-09-13-101833.dump",
);
const evidencePath = resolve(
  repositoryRoot,
  `.local/phase2-purge-evidence-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "")}.json`,
);
const statePath = resolve(repositoryRoot, ".local/phase2-purge-state.json");

const PHASE2_AUTHORIZATION = "PURGE_LISTS_A33_B7_C18_HELIUMDB";
const REHEARSAL_AUTHORIZATION = "REHEARSE_LISTS_A33_B7_C18_RESTORE";
const COMMIT_DRIFT_ACK = "ACK_BACKUP_COMMIT_DRIFT_REVIEWED";

const LIST_A = [
  "tickets",
  "ticket_lineas",
  "ticket_pagos",
  "autorizaciones_nota",
  "movimientos_credito",
  "aplicaciones_credito",
  "notificaciones_credito",
  "sesiones_caja",
  "sesiones_caja_dias",
  "salidas_dinero_caja",
  "cuadre_fiscal_registros",
  "salidas",
  "salida_lineas",
  "salida_rollos",
  "viajes",
  "viaje_salidas",
  "viaje_tickets",
  "entradas",
  "contenedores",
  "contenedor_lineas",
  "pagos_proveedor",
  "aplicaciones_pago_proveedor",
  "movimientos",
  "rollos",
  "reimpresiones_etiqueta",
  "auditorias_inventario",
  "auditoria_inventario_escaneos",
  "auditoria_inventario_participantes",
  "auditoria_inventario_snapshot",
  "solicitudes_pago_dirigido",
  "notificaciones_sistema",
  "stock_minimo_episodios",
  "sesiones",
] as const;

// Lista B has seven tables: six row-backed counters plus the cache, which is
// rebuilt rather than manually changed.  The contenedores serial sequence is
// reported separately because it is not a table.
const LIST_B = [
  "ticket_folio",
  "entrada_folio",
  "salida_folio",
  "viaje_folio",
  "auditoria_inventario_folio",
  "series_consecutivo",
  "existencias",
] as const;

const LIST_C = [
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
  "equipos",
  "equipos_checklist",
  "stock_minimo_sitios",
  "stock_minimos",
  "auditoria",
] as const;

const COUNTER_TABLES = [
  "ticket_folio",
  "entrada_folio",
  "salida_folio",
  "viaje_folio",
  "auditoria_inventario_folio",
  "series_consecutivo",
] as const;

// The five unconditional blockers are the historical immutable DELETE/UPDATE
// triggers.  reimpresiones_etiqueta is intentionally not disabled: its
// documented transaction-local bypass is app.etiquetas_cleanup = 'on'.
const FIVE_DELETE_BLOCKERS = [
  ["aplicaciones_credito", "aplicaciones_credito_inmutables"],
  ["aplicaciones_pago_proveedor", "aplicaciones_pago_proveedor_append_only"],
  ["movimientos_credito", "movimientos_credito_inmutables"],
  ["pagos_proveedor", "pagos_proveedor_inmutables"],
  ["ticket_pagos", "ticket_pagos_inmutables"],
] as const;

const EXPECTED_TRIGGER_NAMES = [
  "aplicaciones_credito_inmutables",
  "aplicaciones_credito_validas",
  "aplicaciones_pago_proveedor_append_only",
  "aplicaciones_pago_proveedor_validar_insert",
  "auditoria_append_only",
  "auditoria_enriquecer_insert",
  "movimientos_credito_inmutables",
  "movimientos_credito_reversos_validos",
  "pagos_proveedor_inmutables",
  "reimpresiones_etiqueta_inmutable",
  "ticket_pagos_inmutables",
] as const;

// This is the FK-topological order verified in Phase 1.  It is intentionally
// explicit and is never replaced by DELETE ... CASCADE or TRUNCATE.
const DELETE_ORDER = [
  "aplicaciones_credito",
  "aplicaciones_pago_proveedor",
  "auditoria_inventario_escaneos",
  "auditoria_inventario_participantes",
  "auditoria_inventario_snapshot",
  "autorizaciones_nota",
  "contenedor_lineas",
  "cuadre_fiscal_registros",
  "notificaciones_credito",
  "notificaciones_sistema",
  "reimpresiones_etiqueta",
  "salida_rollos",
  "salidas_dinero_caja",
  "sesiones_caja_dias",
  "solicitudes_pago_dirigido",
  "stock_minimo_episodios",
  "ticket_lineas",
  "ticket_pagos",
  "viaje_salidas",
  "viaje_tickets",
  "auditorias_inventario",
  "contenedores",
  "movimientos_credito",
  "pagos_proveedor",
  "movimientos",
  "salida_lineas",
  "viajes",
  "entradas",
  "rollos",
  "salidas",
  "tickets",
  "sesiones_caja",
  "sesiones",
] as const;

const expectedTableSet = new Set<string>([
  ...LIST_A,
  ...LIST_B,
  ...LIST_C,
]);

class GuardFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardFailure";
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function tableRef(table: string): string {
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

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function rowHash(rows: Row[]): string {
  const canonical = rows
    .map((row) => stableJson(row))
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function mapCounts(rows: Row[]): Record<string, number> {
  return Object.fromEntries(
    rows.map((row) => [String(row.table), Number(row.count)]),
  );
}

function mapEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => String(left[key]) === String(right[key]));
}

function sortedStrings(values: Iterable<unknown>): string[] {
  return [...values].map(String).sort((left, right) => left.localeCompare(right));
}

function setEqual(left: Iterable<unknown>, right: Iterable<unknown>): boolean {
  const a = sortedStrings(left);
  const b = sortedStrings(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url-redacted]")
    .replaceAll(/password[^\s,;]*/gi, "password-redacted")
    .replaceAll(repositoryRoot, "[workspace]");
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, jsonText(value), { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadDisposableProof(expectedDatabase: string): Promise<Row> {
  const rawPath = process.env.PHASE2_DISPOSABLE_PROOF_PATH;
  const expectedSha = process.env.PHASE2_DISPOSABLE_PROOF_SHA256;
  if (!rawPath || !expectedSha) {
    throw new GuardFailure(
      "apply requires PHASE2_DISPOSABLE_PROOF_PATH and PHASE2_DISPOSABLE_PROOF_SHA256",
    );
  }
  const proofPath = resolve(repositoryRoot, rawPath);
  if (relative(repositoryRoot, proofPath).startsWith("..")) {
    throw new GuardFailure("disposable proof must be inside the workspace");
  }
  const actualSha = await sha256File(proofPath);
  if (actualSha !== expectedSha) {
    throw new GuardFailure("disposable proof SHA-256 does not match reviewed evidence");
  }
  const proof = await readJson(proofPath);
  if (
    proof.status !== "PASS" ||
    proof.operation !== "phase2-disposable-postpurge-probe" ||
    proof.targetDatabase !== expectedDatabase ||
    proof.emptyUi?.status !== "PASS" ||
    Number(proof.ticket?.folio) !== 1000 ||
    proof.ticket?.created !== true
  ) {
    throw new GuardFailure(
      "disposable proof must contain PASS empty-UI checks and a committed ticket folio 1000",
    );
  }
  return {
    path: relative(repositoryRoot, proofPath),
    sha256: actualSha,
    operation: proof.operation,
    targetDatabase: proof.targetDatabase,
    emptyUi: proof.emptyUi,
    ticket: proof.ticket,
  };
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function gitStdout(args: string[]): Promise<string> {
  const result = await execFile("git", args, {
    cwd: repositoryRoot,
    maxBuffer: 16 * 1024 * 1024,
  });
  return String(result.stdout).trim();
}

async function gitRaw(args: string[]): Promise<string> {
  const result = await execFile("git", args, {
    cwd: repositoryRoot,
    maxBuffer: 16 * 1024 * 1024,
  });
  return String(result.stdout);
}

async function verifySourceFingerprint(expectedCommit: string): Promise<Row> {
  const currentHead = await gitStdout(["rev-parse", "HEAD"]);
  const expectedFiles = (await gitStdout([
    "ls-tree",
    "-r",
    "--name-only",
    expectedCommit,
    "--",
    "artifacts/api-server/src",
    "lib/db/src",
  ]))
    .split("\n")
    .filter(Boolean)
    .sort();
  const currentFiles = (await gitStdout([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "artifacts/api-server/src",
    "lib/db/src",
  ]))
    .split("\n")
    .filter(Boolean)
    .sort();
  const mismatches: string[] = [];
  if (!setEqual(expectedFiles, currentFiles)) {
    mismatches.push("source file set differs from backup commit");
  }
  for (const file of expectedFiles) {
    const currentHash = createHash("sha256")
      .update(await readFile(resolve(repositoryRoot, file)))
      .digest("hex");
    const expectedText = await gitRaw(["show", `${expectedCommit}:${file}`]);
    const expectedHash = createHash("sha256")
      .update(expectedText)
      .digest("hex");
    if (currentHash !== expectedHash) mismatches.push(file);
  }
  return {
    expectedCommit,
    currentHead,
    sourceFilesCompared: expectedFiles.length,
    sourceFilesMatch: mismatches.length === 0,
    commitMatches: currentHead === expectedCommit,
    mismatches: mismatches.slice(0, 20),
    // A changed accompanying commit is reported separately.  The caller must
    // acknowledge it explicitly after reviewing that the source-file hashes
    // still match; no new backup is created by this script.
    pass: mismatches.length === 0,
  };
}

async function loadBackupArtifacts(): Promise<Row> {
  const [manifest, sourceSnapshot, sourceMinimums, restoreComparison, metadata, drive, state] =
    await Promise.all([
      readJson(manifestPath),
      readJson(sourceSnapshotPath),
      readJson(sourceMinimumsPath),
      readJson(restoreComparisonPath),
      readJson(restoreMetadataPath),
      readJson(driveVerificationPath),
      readJson(backupStatePath),
    ]);
  if (manifest.status !== "PASS" || manifest.phase !== 1) {
    throw new GuardFailure("latest verified backup manifest is not Phase 1 PASS");
  }
  if (
    manifest.sourceMutationPolicy?.phase2Executed !== false ||
    manifest.sourceMutationPolicy?.sourceMutated !== false
  ) {
    throw new GuardFailure("backup source mutation policy is not untouched");
  }
  if (drive.status !== "PASS" || state.status !== "PASS") {
    throw new GuardFailure("dump/cloud receipt or restore state is not PASS");
  }
  const actualSha = await sha256File(expectedArchivePath);
  if (
    actualSha !== manifest.archive?.sha256 ||
    actualSha !== drive.downloadSha256 ||
    drive.file?.sha256Checksum !== actualSha ||
    Number(manifest.archive?.sizeBytes) !== (await readFile(expectedArchivePath)).byteLength
  ) {
    throw new GuardFailure("verified dump SHA-256/size does not match manifest and cloud receipt");
  }
  const expectedCategories = ["tables", "columns", "constraints", "indexes", "triggers", "sequences", "foreign_key_edges"];
  for (const category of expectedCategories) {
    const comparison = restoreComparison.categories?.[category];
    if (
      !comparison ||
      Number(comparison.sourceCount) !== Number(comparison.restoredCount) ||
      !Array.isArray(comparison.mismatches) ||
      comparison.mismatches.length !== 0
    ) {
      throw new GuardFailure(`verified restore category mismatch: ${category}`);
    }
  }
  if (
    restoreComparison.status !== "PASS" ||
    restoreComparison.tableCounts?.mismatches?.length !== 0 ||
    restoreComparison.database?.mismatch === true ||
    Number(restoreComparison.tableCounts?.source?.length) !== 58
  ) {
    throw new GuardFailure("verified restore comparison is not an exact PASS");
  }
  if (
    sourceSnapshot.commit !== manifest.commit ||
    sourceSnapshot.database?.database_name !== "heliumdb" ||
    sourceSnapshot.catalogue?.tables?.length !== 58 ||
    sourceSnapshot.catalogue?.tableCounts?.length !== 58
  ) {
    throw new GuardFailure("backup source snapshot metadata is inconsistent");
  }
  const snapshotTables = sourceSnapshot.catalogue.tables.map((row: Row) => String(row.table));
  if (!setEqual(snapshotTables, expectedTableSet)) {
    throw new GuardFailure("backup table catalogue does not equal exact Lists A33/B7/C18");
  }
  if (
    sourceMinimums.counts?.stock_minimos !== 3 ||
    sourceMinimums.counts?.stock_minimo_sitios !== 1 ||
    sourceMinimums.counts?.active_sites !== 1
  ) {
    throw new GuardFailure("backup minimum evidence is not exactly 3 minima, 1 site, 1 active site");
  }
  if (metadata.database !== "restore_disposable_2026-09-13-101833") {
    throw new GuardFailure("restore metadata database is not the fixed verified restore");
  }
  return {
    manifest,
    sourceSnapshot,
    sourceMinimums,
    restoreComparison,
    metadata,
    dumpSha256: actualSha,
    dumpRelativePath: relative(repositoryRoot, expectedArchivePath),
  };
}

async function loadPgRuntime(): Promise<{ Pool: PoolConstructor }> {
  // @ts-expect-error pg is intentionally loaded from the workspace runtime.
  const module = await import("../../lib/db/node_modules/pg/lib/index.js");
  const runtime = (module.default ?? module) as unknown as { Pool: PoolConstructor };
  return runtime;
}

async function createPool(url: string, label: string): Promise<PgPool> {
  const { Pool } = await loadPgRuntime();
  return new Pool({
    connectionString: url,
    max: 1,
    application_name: `phase2_purge_${label}`,
    statement_timeout: 120_000,
    query_timeout: 120_000,
  });
}

async function withReadOnly<T>(
  pool: PgPool,
  callback: (client: PgClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const result = await callback(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function queryRows(client: PgClient, text: string): Promise<Row[]> {
  return (await client.query(text)).rows;
}

async function captureReadOnlySnapshot(
  pool: PgPool,
  tableNames: string[],
): Promise<Row> {
  return withReadOnly(pool, async (client) => {
    const identity = (await queryRows(
      client,
      `
        SELECT current_database() AS database_name,
               current_user AS current_user,
               inet_server_port() AS server_port,
               current_setting('server_version') AS server_version
      `,
    ))[0] ?? {};
    const catalogTables = await queryRows(
      client,
      `
        SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'f')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_%'
        ORDER BY n.nspname, c.relname
      `,
    );
    const counts: Row[] = [];
    for (const table of tableNames) {
      const rows = await queryRows(
        client,
        `SELECT count(*)::int AS count FROM ${tableRef(table)}`,
      );
      counts.push({ table, count: Number(rows[0]?.count ?? -1) });
    }
    const cSnapshots: Record<string, Row> = {};
    const minimumRows: Row[] = [];
    for (const table of LIST_C) {
      const rows = await queryRows(client, `SELECT row_to_json(t)::text AS snapshot_row FROM ${tableRef(table)} t`);
      cSnapshots[table] = { count: rows.length, hash: rowHash(rows) };
      if (table === "stock_minimos" || table === "stock_minimo_sitios") {
        minimumRows.push(...await queryRows(client, `SELECT * FROM ${tableRef(table)}`));
      }
    }
    const triggers = await queryRows(
      client,
      `
        SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled,
               t.tgisinternal
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname
      `,
    );
    const schemaCounts = (await queryRows(
      client,
      `
        SELECT
          (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relkind IN ('r','p','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
               AND n.nspname NOT LIKE 'pg_%')::int AS tables,
          (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','f')
               AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%')::int AS columns,
          (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE con.contype IN ('c','f','p','u','x') AND n.nspname NOT IN ('pg_catalog','information_schema')
               AND n.nspname NOT LIKE 'pg_%')::int AS constraints,
          (SELECT count(*) FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relkind IN ('r','p','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
               AND n.nspname NOT LIKE 'pg_%')::int AS indexes,
          (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE NOT t.tgisinternal AND n.nspname NOT IN ('pg_catalog','information_schema')
               AND n.nspname NOT LIKE 'pg_%')::int AS triggers,
          (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
               AND n.nspname NOT LIKE 'pg_%')::int AS sequences,
          (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE con.contype='f' AND n.nspname NOT IN ('pg_catalog','information_schema')
               AND n.nspname NOT LIKE 'pg_%')::int AS foreign_keys
      `,
    ))[0] ?? {};
    const sequence = (await queryRows(
      client,
      `SELECT pg_get_serial_sequence('public.contenedores', 'folio') AS sequence_name`,
    ))[0] ?? {};
    const activeSites = Number(
      (await queryRows(
        client,
        `SELECT count(*)::int AS count FROM ${tableRef("stock_minimo_sitios")} WHERE habilitado = true`,
      ))[0]?.count ?? -1,
    );
    return {
      identity,
      catalogTables,
      counts,
      countMap: mapCounts(counts),
      listC: cSnapshots,
      minimumEvidenceHash: rowHash(minimumRows),
      triggers,
      triggerNames: triggers.map((row) => String(row.trigger_name)),
      schemaCounts,
      sequence,
      activeSites,
    };
  });
}

function assertIdentity(
  snapshot: Row,
  expectedDatabase: string,
  expectedPort: number | undefined,
  expectedServerVersion: string,
  label: string,
): void {
  assert.equal(
    String(snapshot.identity?.database_name),
    expectedDatabase,
    `${label} current_database identity mismatch`,
  );
  if (expectedPort !== undefined) {
    assert.equal(
      Number(snapshot.identity?.server_port),
      expectedPort,
      `${label} server port mismatch`,
    );
  }
  assert.equal(
    String(snapshot.identity?.server_version),
    expectedServerVersion,
    `${label} PostgreSQL version mismatch`,
  );
}

function assertSchemaAndTables(
  snapshot: Row,
  expectedTableCounts: Record<string, number>,
  expectedSchemaCounts: Record<string, number>,
  label: string,
): void {
  const names = snapshot.catalogTables.map((row: Row) => `${row.schema}.${row.table}`);
  assert.equal(names.length, 58, `${label} must expose exactly 58 relations`);
  assert(
    setEqual(
      names,
      [...expectedTableSet].map((table) => `public.${table}`),
    ),
    `${label} table set differs from verified 58-table schema`,
  );
  assert(mapEqual(snapshot.countMap, expectedTableCounts), `${label} table counts differ from backup`);
  assert(mapEqual(snapshot.schemaCounts, expectedSchemaCounts), `${label} schema catalogue counts differ`);
  assert(
    setEqual(snapshot.triggerNames, EXPECTED_TRIGGER_NAMES),
    `${label} trigger set differs from verified 11-trigger schema`,
  );
  assert(
    snapshot.triggers.every((row: Row) => String(row.tgenabled) === "O"),
    `${label} trigger catalogue contains a disabled trigger`,
  );
  assert.equal(
    String(snapshot.sequence?.sequence_name),
    "public.contenedores_folio_seq",
    `${label} contenedores serial sequence mismatch`,
  );
}

function assertListCHashes(expected: Row, actual: Row, label: string): void {
  for (const table of LIST_C) {
    const before = expected.listC?.[table];
    const after = actual.listC?.[table];
    assert.equal(after?.count, before?.count, `${label} ${table} count differs`);
    assert.equal(after?.hash, before?.hash, `${label} ${table} row hash differs`);
  }
}

function assertMinimumEvidence(
  sourceMinimums: Row,
  snapshot: Row,
  label: string,
): void {
  assert.equal(snapshot.listC.stock_minimos?.count, 3, `${label} stock_minimos count must be 3`);
  assert.equal(snapshot.listC.stock_minimo_sitios?.count, 1, `${label} stock_minimo_sitios count must be 1`);
  assert.equal(snapshot.activeSites, 1, `${label} active site count must be 1`);
  const sourceRows = [
    ...sourceMinimums.stock_minimos,
    ...sourceMinimums.stock_minimo_sitios,
  ] as Row[];
  assert(sourceRows.length === 4, `${label} source minimum evidence must contain four rows`);
  assert.equal(
    snapshot.minimumEvidenceHash,
    rowHash(sourceRows),
    `${label} minimum values/dates/authors differ from backup evidence`,
  );
}

function expectedSchemaCounts(artifacts: Row): Record<string, number> {
  const categories = artifacts.restoreComparison.categories;
  return {
    tables: Number(categories.tables.sourceCount),
    columns: Number(categories.columns.sourceCount),
    constraints: Number(categories.constraints.sourceCount),
    indexes: Number(categories.indexes.sourceCount),
    triggers: Number(categories.triggers.sourceCount),
    sequences: Number(categories.sequences.sourceCount),
    foreign_keys: Number(categories.foreign_key_edges.sourceCount),
  };
}

function expectedTableCounts(artifacts: Row): Record<string, number> {
  return Object.fromEntries(
    artifacts.sourceSnapshot.catalogue.tableCounts.map((row: Row) => [
      String(row.table),
      Number(row.count),
    ]),
  );
}

function assertTargetMatchesBackup(
  target: Row,
  baseline: Row,
  artifacts: Row,
  label: string,
): void {
  assertSchemaAndTables(
    target,
    expectedTableCounts(artifacts),
    expectedSchemaCounts(artifacts),
    label,
  );
  assertListCHashes(baseline, target, `${label} vs verified restore`);
  assertMinimumEvidence(artifacts.sourceMinimums, target, label);
  for (const table of LIST_A) {
    assert.equal(
      target.countMap[table],
      baseline.countMap[table],
      `${label} ${table} count differs from verified restore`,
    );
  }
  for (const table of LIST_B) {
    assert.equal(
      target.countMap[table],
      baseline.countMap[table],
      `${label} ${table} count differs from verified restore`,
    );
  }
}

function txRows(tx: unknown, sqlRuntime: DrizzleRuntime, text: string): Promise<Row[]> {
  const executor = tx as {
    execute(query: unknown): Promise<{ rows: Row[] }>;
  };
  return executor.execute(sqlRuntime.sql.raw(text)).then((result) => result.rows);
}

async function txCount(tx: unknown, sqlRuntime: DrizzleRuntime, table: string): Promise<number> {
  const rows = await txRows(
    tx,
    sqlRuntime,
    `SELECT count(*)::int AS count FROM ${tableRef(table)}`,
  );
  return Number(rows[0]?.count ?? -1);
}

async function txTableSnapshot(
  tx: unknown,
  sqlRuntime: DrizzleRuntime,
  table: string,
): Promise<Row> {
  // Serialize in PostgreSQL, not through pg/Drizzle's differing date parsers.
  const rows = await txRows(tx, sqlRuntime, `SELECT row_to_json(t)::text AS snapshot_row FROM ${tableRef(table)} t`);
  return { count: rows.length, hash: rowHash(rows) };
}

async function txTriggerRows(tx: unknown, sqlRuntime: DrizzleRuntime): Promise<Row[]> {
  return txRows(
    tx,
    sqlRuntime,
    `
      SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled,
             t.tgisinternal
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
      ORDER BY c.relname, t.tgname
    `,
  );
}

async function txSequenceState(
  tx: unknown,
  sqlRuntime: DrizzleRuntime,
  sequenceName: string,
): Promise<Row> {
  const rows = await txRows(
    tx,
    sqlRuntime,
    `SELECT last_value::text AS last_value, is_called FROM ${sequenceName}`,
  );
  return rows[0] ?? {};
}

async function txCaptureC(
  tx: unknown,
  sqlRuntime: DrizzleRuntime,
): Promise<Record<string, Row>> {
  const result: Record<string, Row> = {};
  for (const table of LIST_C) result[table] = await txTableSnapshot(tx, sqlRuntime, table);
  return result;
}

async function txCounterSnapshot(
  tx: unknown,
  sqlRuntime: DrizzleRuntime,
): Promise<Record<string, Row>> {
  const result: Record<string, Row> = {};
  for (const table of COUNTER_TABLES) {
    const rows = await txRows(tx, sqlRuntime, `SELECT * FROM ${tableRef(table)} ORDER BY 1`);
    result[table] = { count: rows.length, rows };
  }
  return result;
}

async function txInvariant(
  tx: unknown,
  sqlRuntime: DrizzleRuntime,
): Promise<Row> {
  const badRows = await txRows(
    tx,
    sqlRuntime,
    `
      SELECT e.producto_id, e.ubicacion_id
      FROM existencias e
      LEFT JOIN movimientos m
        ON m.producto_id = e.producto_id AND m.ubicacion_id = e.ubicacion_id
      LEFT JOIN rollos r
        ON r.producto_id = e.producto_id AND r.ubicacion_id = e.ubicacion_id
           AND r.estado = 'DISPONIBLE'
      GROUP BY e.producto_id, e.ubicacion_id, e.cantidad_total, e.rollos_count
      HAVING e.cantidad_total <> COALESCE(SUM(m.cantidad), 0)
          OR e.rollos_count <> COUNT(r.id)
    `,
  );
  return {
    badPairs: badRows.length,
    existenciasRows: await txCount(tx, sqlRuntime, "existencias"),
    movimientosRows: await txCount(tx, sqlRuntime, "movimientos"),
    rollosRows: await txCount(tx, sqlRuntime, "rollos"),
  };
}

async function executePurge(
  artifacts: Row,
  baseline: Row,
  preflight: Row,
): Promise<Row> {
  // These imports happen only after all URL/database/source guards and the
  // read-only current-vs-backup comparison have passed.
  const dbModule = (await import("../../lib/db/src/index.ts")) as unknown as DatabaseModule;
  const sqlRuntime = (await import(
    "../../artifacts/api-server/node_modules/drizzle-orm/index.js"
  )) as unknown as DrizzleRuntime;
  const { reconstruirCacheExistencias } = await import(
    "../../artifacts/api-server/src/lib/inventario.ts"
  );
  try {
    const result = await dbModule.db.transaction(async (tx) => {
      // Lock every one of the verified 58 tables before any second snapshot or
      // write.  The lock is ACCESS EXCLUSIVE and names are fixed by the backup
      // catalogue, so concurrent API writes/config changes cannot slip in.
      const lockList = [...expectedTableSet]
        .sort((left, right) => left.localeCompare(right))
        .map(tableRef)
        .join(", ");
      await txRows(
        tx,
        sqlRuntime,
        `LOCK TABLE ${lockList} IN ACCESS EXCLUSIVE MODE`,
      );
      const lockedBeforeCounts: Record<string, number> = {};
      for (const table of expectedTableSet) {
        lockedBeforeCounts[table] = await txCount(tx, sqlRuntime, table);
      }
      const lockedBeforeC: Record<string, Row> = {};
      for (const table of LIST_C) {
        lockedBeforeC[table] = await txTableSnapshot(tx, sqlRuntime, table);
      }
      if (!mapEqual(lockedBeforeCounts, preflight.countMap)) {
        throw new GuardFailure("locked-before counts drifted from read-only preflight; rollback");
      }
      for (const table of LIST_C) {
        if (
          lockedBeforeC[table].count !== preflight.listC[table].count ||
          lockedBeforeC[table].hash !== preflight.listC[table].hash
        ) {
          throw new GuardFailure(`locked-before Lista C hash drifted for ${table}; rollback`);
        }
      }
      const triggerBefore = await txTriggerRows(tx, sqlRuntime);
      if (
        !setEqual(triggerBefore.map((row) => row.trigger_name), EXPECTED_TRIGGER_NAMES) ||
        triggerBefore.some((row) => String(row.tgenabled) !== "O")
      ) {
        throw new GuardFailure("locked-before trigger catalogue is not exactly 11 enabled O triggers");
      }
      const settingBefore = (
        await txRows(
          tx,
          sqlRuntime,
          `SELECT current_setting('app.etiquetas_cleanup', true) AS setting`,
        )
      )[0]?.setting;

      await txRows(tx, sqlRuntime, "SET LOCAL app.etiquetas_cleanup = 'on'");
      const settingDuring = (
        await txRows(
          tx,
          sqlRuntime,
          `SELECT current_setting('app.etiquetas_cleanup', true) AS setting`,
        )
      )[0]?.setting;
      if (String(settingDuring) !== "on") {
        throw new GuardFailure("app.etiquetas_cleanup was not enabled transaction-locally");
      }

      for (const [table, trigger] of FIVE_DELETE_BLOCKERS) {
        await txRows(
          tx,
          sqlRuntime,
          `ALTER TABLE ${tableRef(table)} DISABLE TRIGGER ${quoteIdentifier(trigger)}`,
        );
      }
      for (const table of DELETE_ORDER) {
        await txRows(tx, sqlRuntime, `DELETE FROM ${tableRef(table)}`);
      }
      for (const [table, trigger] of FIVE_DELETE_BLOCKERS) {
        await txRows(
          tx,
          sqlRuntime,
          `ALTER TABLE ${tableRef(table)} ENABLE TRIGGER ${quoteIdentifier(trigger)}`,
        );
      }
      const restoredTriggerRows = await txTriggerRows(tx, sqlRuntime);
      if (
        restoredTriggerRows.length !== 11 ||
        !setEqual(restoredTriggerRows.map((row) => row.trigger_name), EXPECTED_TRIGGER_NAMES) ||
        restoredTriggerRows.some((row) => String(row.tgenabled) !== "O")
      ) {
        throw new GuardFailure("not all 11 triggers returned to tgenabled O before commit");
      }
      const auditoriaTriggers = restoredTriggerRows.filter(
        (row) => String(row.table_name) === "auditoria",
      );
      if (auditoriaTriggers.some((row) => String(row.tgenabled) !== "O")) {
        throw new GuardFailure("auditoria trigger was not continuously enabled");
      }

      const beforeCounters = await txCounterSnapshot(tx, sqlRuntime);
      for (const table of COUNTER_TABLES) {
        if (table === "series_consecutivo") {
          await txRows(
            tx,
            sqlRuntime,
            `UPDATE ${tableRef(table)} SET ultimo_numero = 1000000`,
          );
        } else {
          await txRows(
            tx,
            sqlRuntime,
            `UPDATE ${tableRef(table)} SET ultimo_folio = ${
              table === "ticket_folio" ? "999" : "0"
            }`,
          );
        }
      }

      const sequenceName = String(
        (
          await txRows(
            tx,
            sqlRuntime,
            `SELECT pg_get_serial_sequence('public.contenedores', 'folio') AS sequence_name`,
          )
        )[0]?.sequence_name ?? "",
      );
      if (sequenceName !== "public.contenedores_folio_seq") {
        throw new GuardFailure(`unexpected contenedores.folio sequence ${sequenceName}`);
      }
      await txRows(
        tx,
        sqlRuntime,
        `ALTER SEQUENCE ${tableRef("contenedores_folio_seq")} RESTART WITH 1`,
      );
      const sequenceAfterReset = await txSequenceState(
        tx,
        sqlRuntime,
        sequenceName,
      );
      if (
        String(sequenceAfterReset.last_value) !== "1" ||
        sequenceAfterReset.is_called !== false
      ) {
        throw new GuardFailure("contenedores sequence is not RESTART WITH 1/is_called false");
      }

      // The actual shared function receives this caller-owned transaction.  It
      // must not open its standalone db.transaction branch.
      await reconstruirCacheExistencias(tx as never);
      const invariant = await txInvariant(tx, sqlRuntime);
      if (
        Number(invariant.badPairs) !== 0 ||
        Number(invariant.movimientosRows) !== 0 ||
        Number(invariant.rollosRows) !== 0
      ) {
        throw new GuardFailure("existencias invariant failed after real cache rebuild");
      }

      const afterA: Record<string, number> = {};
      for (const table of LIST_A) afterA[table] = await txCount(tx, sqlRuntime, table);
      if (Object.values(afterA).some((count) => count !== 0)) {
        throw new GuardFailure("one or more Lista A tables is not empty before commit");
      }
      const afterC = await txCaptureC(tx, sqlRuntime);
      for (const table of LIST_C) {
        if (
          afterC[table].count !== baseline.listC[table].count ||
          afterC[table].hash !== baseline.listC[table].hash
        ) {
          throw new GuardFailure(`Lista C exact row count/hash failed for ${table}`);
        }
      }
      const afterCounterRows = await txCounterSnapshot(tx, sqlRuntime);
      const counterVerification: Record<string, Row> = {};
      for (const table of COUNTER_TABLES) {
        const rows = (afterCounterRows[table].rows as Row[]) ?? [];
        const expectedValue = table === "ticket_folio"
          ? 999
          : table === "series_consecutivo"
            ? 1000000
            : 0;
        const column = table === "series_consecutivo" ? "ultimo_numero" : "ultimo_folio";
        if (
          rows.length !== Number(beforeCounters[table].count) ||
          rows.some((row) => Number(row[column]) !== expectedValue)
        ) {
          throw new GuardFailure(`counter reset/count verification failed for ${table}`);
        }
        counterVerification[table] = {
          beforeCount: beforeCounters[table].count,
          afterCount: rows.length,
          resetColumn: column,
          resetValue: expectedValue,
        };
      }
      const existenciasCount = await txCount(tx, sqlRuntime, "existencias");
      if (existenciasCount !== Number(baseline.countMap.existencias)) {
        throw new GuardFailure("existencias row count changed during rebuild");
      }
      const finalTriggers = await txTriggerRows(tx, sqlRuntime);
      if (
        finalTriggers.length !== 11 ||
        finalTriggers.some((row) => String(row.tgenabled) !== "O")
      ) {
        throw new GuardFailure("final pg_trigger verification is not 11 rows all O");
      }
      // Read back the setting and record the pre-setting value without ever
      // touching auditoria.  SET LOCAL rolls back at transaction end.
      const settingFinal = (
        await txRows(
          tx,
          sqlRuntime,
          `SELECT current_setting('app.etiquetas_cleanup', true) AS setting`,
        )
      )[0]?.setting;
      if (String(settingFinal) !== "on") {
        throw new GuardFailure("cleanup setting disappeared before commit");
      }
      const transactionEvidence = {
        lockedBeforeCounts,
        lockedBeforeC,
        triggerBefore,
        triggerAfterReenable: restoredTriggerRows,
        settingBefore: settingBefore ?? null,
        settingDuring,
        settingFinal,
        deleteOrder: [...DELETE_ORDER],
        disabledTriggers: FIVE_DELETE_BLOCKERS.map(([table, trigger]) => `${table}.${trigger}`),
        afterA,
        afterC,
        postPurgeChecksBeforeFixturesOrTicket: true,
        counters: counterVerification,
        sequence: {
          derivedName: sequenceName,
          afterReset: sequenceAfterReset,
          isCalledFalse: sequenceAfterReset.is_called === false,
        },
        invariant,
        triggersFinal: finalTriggers,
      };
      return transactionEvidence;
    });
    return {
      transaction: "single db.transaction committed",
      rollbackOnError: true,
      ...result,
    };
  } finally {
    await dbModule.pool.end();
  }
}

type Mode = "preflight" | "rehearse" | "apply";

function parseMode(): Mode {
  const args = process.argv.slice(2);
  const known = new Set(["--preflight", "--rehearse", "--apply"]);
  if (args.length !== 1 || !known.has(args[0]!)) {
    throw new GuardFailure("exactly one of --preflight, --rehearse, or --apply is required");
  }
  return args[0]!.slice(2) as Mode;
}

async function resolveTarget(
  mode: Mode,
  metadata: Row,
): Promise<{ targetUrl: string; expectedDatabase: string; expectedPort?: number }> {
  if (mode === "rehearse") {
    if (process.env.PHASE2_REHEARSAL !== "1") {
      throw new GuardFailure("disposable rehearsal/probe requires PHASE2_REHEARSAL=1");
    }
    if (process.env.REQUIRE_PHASE2_AUTHORIZATION !== REHEARSAL_AUTHORIZATION) {
      throw new GuardFailure(
        `rehearsal requires REQUIRE_PHASE2_AUTHORIZATION=${REHEARSAL_AUTHORIZATION}`,
      );
    }
    if (process.env.DATABASE_URL) {
      throw new GuardFailure("rehearsal refuses any DATABASE_URL source target");
    }
    const targetUrl = String(metadata.restored_database_url ?? "");
    if (!targetUrl || process.env.TEST_DATABASE_URL !== targetUrl) {
      throw new GuardFailure(
        "TEST_DATABASE_URL must exactly equal fixed restore-metadata restored_database_url",
      );
    }
    return {
      targetUrl,
      expectedDatabase: String(metadata.database),
      expectedPort: Number(metadata.port),
    };
  }
  if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
    throw new GuardFailure("direct development mode requires NODE_ENV=development");
  }
  if (mode === "apply" && process.env.NODE_ENV !== "development") {
    throw new GuardFailure("apply requires NODE_ENV=development");
  }
  if (mode === "apply") {
    if (process.env.REQUIRE_PHASE2_AUTHORIZATION !== PHASE2_AUTHORIZATION) {
      throw new GuardFailure(
        `apply requires REQUIRE_PHASE2_AUTHORIZATION=${PHASE2_AUTHORIZATION}`,
      );
    }
    if (process.env.PHASE2_REHEARSAL_RESTORED !== "1") {
      throw new GuardFailure(
        "apply requires PHASE2_REHEARSAL_RESTORED=1 after re-restoring the disposable rehearsal cluster",
      );
    }
    if (process.env.PHASE2_BACKGROUND_WORKFLOWS_PAUSED !== "1") {
      throw new GuardFailure(
        "apply requires PHASE2_BACKGROUND_WORKFLOWS_PAUSED=1; parent must stop API/background writers",
      );
    }
  }
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) throw new GuardFailure("direct development mode requires DATABASE_URL");
  if (process.env.TEST_DATABASE_URL) {
    throw new GuardFailure("direct development mode refuses TEST_DATABASE_URL");
  }
  return { targetUrl, expectedDatabase: "heliumdb" };
}

async function main(): Promise<void> {
  const mode = parseMode();
  const selfSha256 = await sha256File(scriptPath);
  const evidence: Row = {
    operation: "Phase 2 operational purge rehearsal",
    status: "RUNNING",
    mode,
    scriptPath: relative(repositoryRoot, scriptPath),
    scriptSha256: selfSha256,
    reviewedScriptSha256: process.env.PHASE2_REVIEWED_SCRIPT_SHA256 ?? null,
    backupDirectory: relative(repositoryRoot, backupDirectory),
    evidencePath: relative(repositoryRoot, evidencePath),
    noBackupCreated: true,
    lists: { A: [...LIST_A], B: [...LIST_B], C: [...LIST_C] },
  };
  await writePrivateJson(statePath, evidence);
  try {
    if (
      mode === "apply" &&
      process.env.PHASE2_REVIEWED_SCRIPT_SHA256 !== selfSha256
    ) {
      throw new GuardFailure(
        `apply requires PHASE2_REVIEWED_SCRIPT_SHA256=${selfSha256}`,
      );
    }
    const artifacts = await loadBackupArtifacts();
    evidence.backup = {
      dumpRelativePath: artifacts.dumpRelativePath,
      dumpSha256: artifacts.dumpSha256,
      manifestStatus: artifacts.manifest.status,
      cloudReceiptStatus: "PASS",
      restoreComparisonStatus: artifacts.restoreComparison.status,
    };
    if (mode === "apply") {
      evidence.disposableProof = await loadDisposableProof(
        String(artifacts.metadata.database),
      );
    }
    const sourceFingerprint = await verifySourceFingerprint(
      String(artifacts.manifest.commit),
    );
    evidence.sourceFingerprint = sourceFingerprint;
    if (!sourceFingerprint.sourceFilesMatch) {
      throw new GuardFailure(
        "source file fingerprint drift detected; no new backup is created by this script",
      );
    }
    if (
      mode === "apply" &&
      !sourceFingerprint.commitMatches &&
      process.env.PHASE2_SOURCE_DRIFT_ACK !== COMMIT_DRIFT_ACK
    ) {
      throw new GuardFailure(
        `backup commit differs although source files match; review drift and set PHASE2_SOURCE_DRIFT_ACK=${COMMIT_DRIFT_ACK}`,
      );
    }
    const target = await resolveTarget(mode, artifacts.metadata);
    // The fixed verified restore is the only acceptable baseline.  It is
    // opened read-only and is never used as a purge target in --apply.
    const baselinePool = await createPool(
      String(artifacts.metadata.restored_database_url),
      "baseline",
    );
    const targetPool = await createPool(target.targetUrl, "target");
    try {
      const [baselineSnapshot, targetSnapshot] = await Promise.all([
        captureReadOnlySnapshot(
          baselinePool,
          [...expectedTableSet].sort((left, right) => left.localeCompare(right)),
        ),
        captureReadOnlySnapshot(
          targetPool,
          [...expectedTableSet].sort((left, right) => left.localeCompare(right)),
        ),
      ]);
      const expectedVersion = String(artifacts.sourceSnapshot.database.server_version);
      assertIdentity(
        baselineSnapshot,
        String(artifacts.metadata.database),
        Number(artifacts.metadata.port),
        expectedVersion,
        "verified restore",
      );
      assertIdentity(
        targetSnapshot,
        target.expectedDatabase,
        target.expectedPort,
        expectedVersion,
        "target",
      );
      const tableCounts = expectedTableCounts(artifacts);
      const schemaCounts = expectedSchemaCounts(artifacts);
      assertSchemaAndTables(baselineSnapshot, tableCounts, schemaCounts, "verified restore");
      assertTargetMatchesBackup(targetSnapshot, baselineSnapshot, artifacts, "target");
      if (
        mode === "apply" &&
        String(targetSnapshot.identity?.database_name) ===
          String(baselineSnapshot.identity?.database_name)
      ) {
        throw new GuardFailure(
          "direct development target unexpectedly equals verified restore identity",
        );
      }
      assertMinimumEvidence(artifacts.sourceMinimums, baselineSnapshot, "verified restore");
      evidence.preflight = {
        targetIdentity: targetSnapshot.identity,
        baselineIdentity: baselineSnapshot.identity,
        targetAll58Counts: targetSnapshot.countMap,
        baselineAll58Counts: baselineSnapshot.countMap,
        listCBefore: targetSnapshot.listC,
        listCHashesMatchBackup: true,
        minimums: {
          stock_minimos: targetSnapshot.listC.stock_minimos,
          stock_minimo_sitios: targetSnapshot.listC.stock_minimo_sitios,
          activeSites: targetSnapshot.activeSites,
          equipos: targetSnapshot.listC.equipos,
          permisos_ubicacion: targetSnapshot.listC.permisos_ubicacion,
        },
        triggersBefore: targetSnapshot.triggers,
        readOnly: true,
      };
      if (mode === "preflight") {
        evidence.status = "PASS";
        evidence.exitCode = 0;
        await writePrivateJson(evidencePath, evidence);
        await writePrivateJson(statePath, {
          status: "PASS",
          exitCode: 0,
          evidencePath: relative(repositoryRoot, evidencePath),
          operation: evidence.operation,
        });
        console.log(
          `PASS preflight; script SHA-256 ${selfSha256}; private evidence: ${relative(repositoryRoot, evidencePath)}`,
        );
        return;
      }
      // The database module uses TEST_DATABASE_URL only for the isolated
      // rehearsal path.  It therefore cannot silently select heliumdb.
      if (mode === "rehearse") {
        process.env.NODE_ENV = "test";
        process.env.TEST_DATABASE_URL = target.targetUrl;
        process.env.APPLICATION_DATABASE_URL = String(artifacts.metadata.admin_url);
        delete process.env.DATABASE_URL;
      } else {
        process.env.NODE_ENV = "development";
      }
      evidence.execution = await executePurge(
        artifacts,
        baselineSnapshot,
        targetSnapshot,
      );
      evidence.status = "PASS";
      evidence.exitCode = 0;
      await writePrivateJson(evidencePath, evidence);
      await writePrivateJson(statePath, {
        status: "PASS",
        exitCode: 0,
        evidencePath: relative(repositoryRoot, evidencePath),
        operation: evidence.operation,
      });
      console.log(
        `PASS ${mode}; script SHA-256 ${selfSha256}; private evidence: ${relative(repositoryRoot, evidencePath)}`,
      );
    } finally {
      await Promise.all([baselinePool.end(), targetPool.end()]);
    }
  } catch (error) {
    evidence.status = "FAIL";
    evidence.exitCode = error instanceof GuardFailure ? 2 : 1;
    evidence.error = redactError(error);
    await writePrivateJson(evidencePath, evidence);
    await writePrivateJson(statePath, {
      status: "FAIL",
      exitCode: evidence.exitCode,
      evidencePath: relative(repositoryRoot, evidencePath),
      operation: evidence.operation,
      error: evidence.error,
    });
    console.error(
      `FAIL phase2 purge guard (script SHA-256 ${selfSha256}): ${evidence.error}`,
    );
    process.exitCode = evidence.exitCode as number;
  }
}

await main();