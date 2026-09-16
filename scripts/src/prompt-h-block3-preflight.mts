/**
 * Prompt H / Block 3: read-only preflight.
 *
 * This command is intentionally a source-only diagnostic.  It requires the
 * verified Block 2 evidence and the owner approval for the lists, opens one
 * REPEATABLE READ READ ONLY transaction against DATABASE_URL, and never
 * executes a write, a sequence call, a rebuild, a truncate, or a rollback-only
 * write.  The SQL for a future operation is persisted as conceptual SQL only.
 *
 * The report deliberately contains identifiers needed to reconcile operational
 * losses (folios, references, tickets, and series), but never user names,
 * credentials, session identifiers, or raw rows with PII.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

// pg has no declarations in this workspace's local runtime package.
// @ts-expect-error Runtime import is deliberately local to the workspace.
import pgRuntime from "../../lib/db/node_modules/pg/lib/index.js";

type Row = Record<string, unknown>;
type QueryResult = {
  rows: Row[];
  rowCount: number | null;
  command: string;
};
type Client = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Row = Row>(text: string, values?: unknown[]): Promise<{
    rows: T[];
    rowCount: number | null;
    command: string;
  }>;
};
const pg = pgRuntime as unknown as {
  Client: new (options: { connectionString: string; application_name: string }) => Client;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/prompt-h");
const REPORT_PATH = resolve(REPORT_DIR, "block3-preflight.md");
const METADATA_PATH = resolve(REPORT_DIR, "block3-preflight-metadata.json");
const APPROVAL_PATH = resolve(REPORT_DIR, "aprobacion-listas-no-purga.md");
const IDENTITY_PATH = resolve(REPORT_DIR, "api-pool-identity-2026-09-15.md");
const RESTORE_REPORT_PATH = resolve(REPORT_DIR, "block2-restore.md");
const RESTORE_METADATA_PATH = resolve(REPORT_DIR, "block2-restore-metadata.json");
const DRIVE_PATH = resolve(REPORT_DIR, "block2-drive-verification.json");
const RENEWAL_PATH = resolve(REPORT_DIR, "renovacion-api-pausado.md");
const EXPECTED_CURRENT_DUMP_SHA256 =
  "4a5deaa825127629e26c3989ea76dab8800748dc177cb4fc7e6eebedf74489a6";
let BACKUP_DIR = "";
let SNAPSHOT_PATH = "";
let DUMP_PATH = "";
let DRIVE_DUMP_PATH = "";
const TZ = "America/Mexico_City";

const A_TABLES = [
  "aplicaciones_credito",
  "aplicaciones_pago_proveedor",
  "auditoria_inventario_escaneos",
  "auditoria_inventario_participantes",
  "auditoria_inventario_snapshot",
  "auditorias_inventario",
  "autorizaciones_nota",
  "contenedor_lineas",
  "contenedores",
  "cuadre_fiscal_registros",
  "entradas",
  "movimientos",
  "movimientos_credito",
  "notificaciones_credito",
  "notificaciones_sistema",
  "pagos_proveedor",
  "reimpresiones_etiqueta",
  "revisiones_etiqueta",
  "rollos",
  "salida_lineas",
  "salida_rollos",
  "salidas",
  "salidas_dinero_caja",
  "sesiones",
  "sesiones_caja",
  "sesiones_caja_dias",
  "solicitudes_pago_dirigido",
  "stock_minimo_episodios",
  "ticket_linea_consumos",
  "ticket_lineas",
  "ticket_pagos",
  "tickets",
  "viaje_salidas",
  "viaje_tickets",
  "viajes",
] as const;

const B_TABLES = [
  "auditoria_inventario_folio",
  "entrada_folio",
  "existencias",
  "salida_folio",
  "series_consecutivo",
  "ticket_folio",
  "viaje_folio",
] as const;

const C_TABLES = [
  "auditoria",
  "camionetas",
  "choferes",
  "cliente_documentos",
  "clientes",
  "equipos",
  "equipos_checklist",
  "permisos_rol",
  "permisos_ubicacion",
  "permisos_usuario",
  "pisos",
  "precio_historial",
  "productos",
  "proveedores",
  "stock_minimo_sitios",
  "stock_minimos",
  "ubicaciones",
  "usuarios",
] as const;

const APPROVED_TARGETS: Record<string, number> = {
  auditoria_inventario_folio: 0,
  entrada_folio: 0,
  salida_folio: 0,
  viaje_folio: 0,
  ticket_folio: 999,
  series_consecutivo: 1_000_000,
};

const TABLE_CLASS = new Map<string, "A" | "B" | "C">([
  ...A_TABLES.map((table) => [table, "A"] as const),
  ...B_TABLES.map((table) => [table, "B"] as const),
  ...C_TABLES.map((table) => [table, "C"] as const),
]);

type QueryRecord = {
  name: string;
  sql: string;
  params: unknown[];
  command?: string;
  rowCount?: number | null;
  rows?: unknown[];
  error?: string;
};

type TableEvidence = {
  schema: string;
  table: string;
  relkind: string;
  count: string;
  orderedCanonicalRowHash: string;
};

type Snapshot = {
  capturedAtUtc?: string;
  capturedAtMexico?: string;
  source?: {
    database?: Row;
    catalogue?: {
      tables?: Row[];
      tableEvidence?: TableEvidence[];
      columns?: Row[];
      constraints?: Row[];
      indexes?: Row[];
      functions?: Row[];
      triggers?: Row[];
      sequences?: Row[];
      database?: Row;
    };
    sequenceStateBeforeDump?: Row[];
    sequenceStateAfterDump?: Row[];
  };
};

const queryRecords: QueryRecord[] = [];

function q(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableRef(table: string): string {
  return `${q("public")}.${q(table)}`;
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const output: Row = {};
    for (const [key, item] of Object.entries(value as Row)) {
      output[key] = jsonSafe(item);
    }
    return output;
  }
  return value;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function md5(value: unknown): string {
  return createHash("md5").update(String(value)).digest("hex");
}

function mexico(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
  }).format(date);
}

function parseDatabaseUrl(value: string): {
  database: string;
  hostname: string;
  port: string;
} {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL is not a PostgreSQL URL.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database || !url.hostname) {
    throw new Error("DATABASE_URL is missing its database or host.");
  }
  return { database, hostname: url.hostname, port: url.port || "5432" };
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

async function sha256File(path: string): Promise<{ sha256: string; sizeBytes: number }> {
  const content = await fs.readFile(path);
  return {
    sha256: createHash("sha256").update(content).digest("hex"),
    sizeBytes: content.byteLength,
  };
}

function exposeMetadata(category: string, row: Row): Row {
  const output: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (["owner", "acl", "current_user", "session_user", "function_source", "definition"].includes(key)) {
      continue;
    }
    output[key] = jsonSafe(value);
  }
  if (category === "functions") {
    output.definition_sha256 = digest(row.definition ?? "");
  }
  if (category === "triggers") {
    output.definition_sha256 = digest(row.definition ?? "");
  }
  return output;
}

async function queryRows<T extends Row>(
  client: Client,
  name: string,
  sql: string,
  params: unknown[] = [],
  exposedRows?: (rows: T[]) => unknown[],
): Promise<T[]> {
  try {
    const result = await client.query<T>(sql, params);
    const rows = result.rows as T[];
    queryRecords.push({
      name,
      sql,
      params: params.map((value) => (value instanceof Date ? value.toISOString() : value)),
      command: result.command,
      rowCount: result.rowCount,
      rows: exposedRows ? exposedRows(rows) : rows.map((row) => jsonSafe(row)),
    });
    return rows;
  } catch {
    queryRecords.push({ name, sql, params, error: "query failed; server details omitted" });
    throw new Error(`Read-only query failed: ${name}.`);
  }
}

async function controlQuery(client: Client, name: string, sql: string): Promise<void> {
  try {
    const result = await client.query(sql);
    queryRecords.push({
      name,
      sql,
      params: [],
      command: result.command,
      rowCount: result.rowCount,
      rows: [],
    });
  } catch {
    queryRecords.push({ name, sql, params: [], error: "control query failed; server details omitted" });
    throw new Error(`Read-only control query failed: ${name}.`);
  }
}

async function one<T extends Row>(
  client: Client,
  name: string,
  sql: string,
  params: unknown[] = [],
  exposedRows?: (rows: T[]) => unknown[],
): Promise<T> {
  const rows = await queryRows<T>(client, name, sql, params, exposedRows);
  if (!rows[0]) throw new Error(`Read-only query returned no row: ${name}.`);
  return rows[0];
}

function rowKey(row: Row, fields: string[]): string {
  return fields.map((field) => String(row[field] ?? "")).join(".");
}

function compareRows(
  left: Row[],
  right: Row[],
  keyFields: string[],
  normalize: (row: Row) => Row = (row) => row,
): { status: "MATCH" | "MISMATCH"; differingKeys: string[] } {
  const leftMap = new Map(left.map((row) => [rowKey(row, keyFields), normalize(row)]));
  const rightMap = new Map(right.map((row) => [rowKey(row, keyFields), normalize(row)]));
  const keys = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort();
  const differingKeys = keys.filter(
    (key) => !leftMap.has(key) || !rightMap.has(key) ||
      stable(leftMap.get(key)) !== stable(rightMap.get(key)),
  );
  return {
    status: differingKeys.length === 0 ? "MATCH" : "MISMATCH",
    differingKeys,
  };
}

function normalizedTable(row: Row): Row {
  return {
    schema: row.schema,
    table: row.table,
    relkind: row.relkind,
  };
}

function normalizedColumn(row: Row): Row {
  const copy = { ...row };
  delete copy.ordinal_position;
  return copy;
}

function normalizedFunction(row: Row): Row {
  const copy = { ...row };
  delete copy.owner;
  delete copy.acl;
  return copy;
}

function normalizedDatabase(row: Row): Row {
  return {
    database_name: row.database_name,
    server_version: row.server_version,
    server_version_num: row.server_version_num,
  };
}

function normalizedTrigger(row: Row): Row {
  return {
    schema: row.schema,
    table: row.table,
    trigger_name: row.trigger_name,
    definition: row.definition,
    enabled: row.enabled,
    function_schema: row.function_schema,
    function_name: row.function_name,
    function_arguments: row.function_arguments,
  };
}

function normalizedSequenceDefinition(row: Row): Row {
  const copy = { ...row };
  delete copy.last_value;
  delete copy.owner_table_schema;
  delete copy.owner_table;
  delete copy.owner_column;
  delete copy.ownership_dependency_type;
  return copy;
}

function reportedAbsolutePath(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Current Block 2 metadata has no usable ${field}.`);
  }
  return resolve(ROOT, value);
}

function assertWithinBackupDirectory(path: string, field: string): void {
  const relativePath = relative(BACKUP_DIR, path);
  if (relativePath.startsWith("..") || relativePath.startsWith("/")) {
    throw new Error(`Current Block 2 ${field} is outside its backup directory.`);
  }
}

function deriveCurrentBackupArtifacts(restoreMetadata: any, drive: any): void {
  BACKUP_DIR = reportedAbsolutePath(
    restoreMetadata.backupDirectory,
    "backupDirectory",
  );
  DUMP_PATH = reportedAbsolutePath(restoreMetadata.archive?.file, "archive.file");
  DRIVE_DUMP_PATH = reportedAbsolutePath(drive.downloadedPath, "downloadedPath");
  SNAPSHOT_PATH = resolve(BACKUP_DIR, "source-snapshot.json");
  assertWithinBackupDirectory(DUMP_PATH, "archive.file");
  assertWithinBackupDirectory(DRIVE_DUMP_PATH, "downloadedPath");
  assertWithinBackupDirectory(SNAPSHOT_PATH, "source-snapshot.json");
}

async function enforceGates(): Promise<{
  statuses: Row[];
  snapshot: Snapshot;
  drive: any;
  restoreMetadata: any;
}> {
  const statuses: Row[] = [];
  const approval = await fs.readFile(APPROVAL_PATH, "utf8");
  const approvalOk =
    /Apruebo las listas/i.test(approval) &&
    /NO purga/i.test(approval) &&
    /A=35, B=7, C=18/i.test(approval) &&
    /TRUNCATE.*SIN RESTART IDENTITY/i.test(approval);
  statuses.push({
    gate: "owner_approval_lists_no_purge",
    status: approvalOk ? "PASS" : "FAIL",
    evidence: relative(ROOT, APPROVAL_PATH),
  });
  if (!approvalOk) throw new Error("Owner approval gate failed.");

  const identity = await fs.readFile(IDENTITY_PATH, "utf8");
  const identityOk =
    /CONFIRMED_FROM_RUNNING_API_POOL_READ_ONLY/.test(identity) &&
    /current_database\(\).*heliumdb|heliumdb.*current_schema\(\).*public/s.test(identity);
  statuses.push({
    gate: "api_pool_effective_identity",
    status: identityOk ? "PASS" : "FAIL",
    evidence: relative(ROOT, IDENTITY_PATH),
  });
  if (!identityOk) throw new Error("API pool identity gate failed.");

  const restoreMetadata = await readJson(RESTORE_METADATA_PATH);
  const drive = await readJson(DRIVE_PATH);
  deriveCurrentBackupArtifacts(restoreMetadata, drive);
  const renewal = await fs.readFile(RENEWAL_PATH, "utf8");
  const renewalOk =
    /PASS.*API detenida/i.test(renewal) &&
    /stopWorkflow.*finished.*8080.*sin listener/is.test(renewal) &&
    /no se reinició la API.*no se inició ningún workflow.*no se instalaron paquetes/is.test(
      renewal,
    ) &&
    /Escritores API detectados:\s*`?0`?/i.test(renewal) &&
    /SOURCE_UNCHANGED_SINCE_BACKUP/i.test(renewal);
  statuses.push({
    gate: "api_paused_before_after_backup_and_drive",
    status: renewalOk ? "PASS" : "FAIL",
    evidence: relative(ROOT, RENEWAL_PATH),
  });
  if (!renewalOk) throw new Error("API paused renewal gate failed.");

  const restoreReport = await fs.readFile(RESTORE_REPORT_PATH, "utf8");
  const restoreOk =
    restoreMetadata.status === "PASS" &&
    restoreMetadata.sourceDatabase === "heliumdb" &&
    restoreMetadata.comparison?.status === "PASS" &&
    restoreMetadata.comparison?.dynamicTableCount === 60 &&
    restoreMetadata.comparison?.sourceTriggerCount === 14 &&
    restoreMetadata.comparison?.sourceSequenceStateBeforeDump?.length === 45 &&
    /\*\*PASS\*\*/.test(restoreReport);
  statuses.push({
    gate: "block2_backup_restore_verified",
    status: restoreOk ? "PASS" : "FAIL",
    evidence: relative(ROOT, RESTORE_METADATA_PATH),
  });
  if (!restoreOk) throw new Error("Block 2 restore gate failed.");

  const localArchive = await sha256File(DUMP_PATH);
  const downloadedArchive = await sha256File(DRIVE_DUMP_PATH);
  const driveOk =
    drive.status === "PASS" &&
    drive.hashesMatch === true &&
    restoreMetadata.archive?.sha256 === EXPECTED_CURRENT_DUMP_SHA256 &&
    drive.sourceSha256 === EXPECTED_CURRENT_DUMP_SHA256 &&
    drive.downloadedSha256 === EXPECTED_CURRENT_DUMP_SHA256 &&
    localArchive.sha256 === drive.sourceSha256 &&
    downloadedArchive.sha256 === drive.downloadedSha256 &&
    localArchive.sizeBytes === drive.sourceBytes &&
    downloadedArchive.sizeBytes === drive.downloadedBytes;
  statuses.push({
    gate: "drive_download_hash",
    status: driveOk ? "PASS" : "FAIL",
    evidence: relative(ROOT, DRIVE_PATH),
  });
  if (!driveOk) throw new Error("Drive hash gate failed.");

  const snapshot = (await readJson(SNAPSHOT_PATH)) as Snapshot;
  const snapshotOk =
    snapshot.source?.database?.database_name === "heliumdb" &&
    snapshot.source.catalogue?.tableEvidence?.length === 60 &&
    snapshot.source.catalogue?.triggers?.length === 14 &&
    snapshot.source.catalogue?.sequences?.length === 45 &&
    snapshot.source.sequenceStateBeforeDump?.length === 45;
  statuses.push({
    gate: "verified_backup_snapshot_shape",
    status: snapshotOk ? "PASS" : "FAIL",
    evidence: relative(ROOT, SNAPSHOT_PATH),
  });
  if (!snapshotOk) throw new Error("Verified backup snapshot shape gate failed.");

  return { statuses, snapshot, drive, restoreMetadata };
}

async function inspectCacheRebuildFunction(): Promise<Row> {
  const path = resolve(ROOT, "artifacts/api-server/src/lib/inventario.ts");
  const source = await fs.readFile(path, "utf8");
  const start = source.indexOf("export async function reconstruirCacheExistencias");
  const next = source.indexOf("\nexport ", start + 1);
  const fragment = source.slice(start, next === -1 ? source.length : next);
  const lineStart = source.slice(0, start).split(/\r?\n/).length;
  return {
    source_file: relative(ROOT, path),
    source_sha256: digest(fragment),
    function_name: "reconstruirCacheExistencias",
    source_line_start: lineStart,
    source_line_end: lineStart + fragment.split(/\r?\n/).length - 1,
    accepts_caller_transaction: /reconstruirCacheExistencias\(tx\?: Tx\)/.test(fragment),
    uses_caller_transaction_when_supplied:
      /if \(!tx\)[\s\S]*return;[\s\S]*lockAllExistingInventoryPairs\(tx\)/.test(fragment),
    reads_existencias_movimientos_rollos:
      /FROM existencias[\s\S]*FROM movimientos[\s\S]*FROM rollos/.test(fragment),
    writes_with_conflict_update:
      /INSERT INTO existencias[\s\S]*ON CONFLICT[\s\S]*DO UPDATE/.test(fragment),
    contains_delete_or_truncate: /\b(?:DELETE|TRUNCATE)\b/i.test(fragment),
    execution_status: "NOT_EXECUTED_BY_BLOCK3",
    required_future_call: "await reconstruirCacheExistencias(tx);",
    required_future_transaction: "same owner transaction as conceptual A truncate and B updates",
  };
}

function incomingClosure(
  aTables: Set<string>,
  fks: Row[],
): { closureTables: string[]; outsideA: string[]; edges: Row[] } {
  const closure = new Set(aTables);
  const queue = [...aTables];
  const edges: Row[] = [];
  while (queue.length) {
    const target = queue.shift()!;
    for (const fk of fks) {
      if (fk.target_table !== target) continue;
      edges.push({
        source_schema: fk.source_schema,
        source_table: fk.source_table,
        constraint_name: fk.constraint_name,
        target_schema: fk.target_schema,
        target_table: fk.target_table,
        delete_action: fk.delete_action,
      });
      if (!closure.has(String(fk.source_table))) {
        closure.add(String(fk.source_table));
        queue.push(String(fk.source_table));
      }
    }
  }
  return {
    closureTables: [...closure].sort(),
    outsideA: [...closure].filter((table) => !aTables.has(table)).sort(),
    edges,
  };
}

function markdownTable(headers: string[], rows: unknown[][]): string {
  const clean = (value: unknown): string =>
    String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) lines.push(`| ${row.map(clean).join(" | ")} |`);
  return lines.join("\n");
}

function listValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value ?? "—");
}

function renderMarkdown(report: any): string {
  const lines: string[] = [];
  const freshness = report.freshness.status;
  lines.push(
    "# Prompt H — Bloque 3: preflight de lectura (purga no autorizada)",
    "",
    `## Veredicto`,
    "",
    `**${report.status}**`,
    "",
    `- Captura UTC: \`${report.capture.utc}\``,
    `- Captura Ciudad de México: \`${report.capture.mexico}\``,
    `- Base efectiva de \`DATABASE_URL\`: \`${report.connection.database}\`; host/credenciales omitidos.`,
    `- Transacción: \`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY\`; ` +
      `timeouts de sentencia/bloqueo/inactividad: \`${report.connection.statementTimeout}\` / ` +
      `\`${report.connection.lockTimeout}\` / \`${report.connection.idleTimeout}\`.`,
    `- Freshness contra snapshot verificado de Bloque 2: **${freshness}**.`,
    `- Snapshot fuente actual: \`${report.freshness.sourceSnapshotPath}\`; ` +
      `backup directory \`${report.freshness.backupDirectory}\`; ` +
      `dump SHA-256 \`${report.freshness.dumpSha256}\`.`,
    `- Gate de triggers actuales (14/14 enabled; estado distinto de \`D\`): **${report.preflightGates.triggerState}** ` +
      `(${report.preflightGates.enabledTriggerCount}/${report.preflightGates.triggerCount}).`,
    "",
    "### Puertas previas",
    "",
    markdownTable(
      ["Puerta", "Estado", "Evidencia"],
      report.gates.map((gate: Row) => [gate.gate, gate.status, gate.evidence]),
    ),
    "",
    "## Alcance y listas vivas",
    "",
    `Conjunto descubierto dinámicamente: **${report.classification.liveTableCount} tablas**; ` +
      `A=${report.classification.counts.A}, B=${report.classification.counts.B}, ` +
      `C=${report.classification.counts.C}.`,
    "",
    markdownTable(
      ["Clase", "Tabla", "Conteo actual", "Hash canónico completo"],
      report.tableEvidence.map((row: TableEvidence) => [
        TABLE_CLASS.get(row.table) ?? "—",
        row.table,
        row.count,
        row.orderedCanonicalRowHash,
      ]),
    ),
    "",
    "Las tablas A, B y C anteriores son las 60 tablas exactas de la captura viva. " +
      "No se sustituyeron por listas históricas.",
    "",
    "## Conteos A",
    "",
    markdownTable(
      ["Tabla A", "Filas actuales"],
      report.aCounts.map((row: Row) => [row.table, row.count]),
    ),
    "",
    "## Filas B: antes y objetivo aprobado",
    "",
    markdownTable(
      ["Tabla B", "Clave de fila (no PII)", "Antes", "Objetivo report-only"],
      report.bBeforeTarget.flatMap((group: Row) =>
        (group.rows as Row[]).map((row) => [
          group.table,
          row.row_key,
          row.before,
          row.target ?? group.target,
        ]),
      ),
    ),
    "",
    "- `existencias` no tiene objetivo de contador: cada fila se conserva para la " +
      "reconstrucción mediante la función real; no se reconstruyó en este bloque.",
    `- Defaults actuales de contador (solo reporte): \`entrada_folio=${report.defaults.entrada_folio}\`, ` +
      `\`salida_folio=${report.defaults.salida_folio}\`. No se modificaron defaults.`,
    "",
    "## Preservación C: conteo y hash canónico",
    "",
    markdownTable(
      ["Tabla C", "Conteo", "Hash exacto `to_jsonb(row)::text` ordenado"],
      report.cTableEvidence.map((row: TableEvidence) => [
        row.table,
        row.count,
        row.orderedCanonicalRowHash,
      ]),
    ),
    "",
    "El hash es el mismo método del respaldo: MD5 de la concatenación ordenada de " +
      "MD5 de cada `to_jsonb(row)::text`; nunca se guardaron filas C.",
    "",
    "## FK estáticas y TRUNCATE conceptual",
    "",
    `- Referencias A → B/C: **${report.fkClosure.aToBcReferences.length}**.`,
    `- Referencias B/C → A que bloquearían \`TRUNCATE ... RESTRICT\`: **${report.fkClosure.bcToAReferences.length}**.`,
    `- Cierre FK entrante desde A fuera de A: **${report.fkClosure.incomingClosure.outsideA.length}**.`,
    `- Resultado estático de cierre: **${report.fkClosure.truncateMetadataStatus}**.`,
    "- Las referencias A → C son relaciones normales de tablas operativas hacia " +
      "catálogos conservados y no bloquean truncar el lado A; el bloqueo relevante " +
      "para `TRUNCATE A ... RESTRICT` es una referencia entrante desde B/C.",
    "",
    "No se ejecutó el siguiente SQL; es solamente la operación conceptual pendiente:",
    "",
    "```sql",
    report.conceptualPlan.sql,
    "```",
    "",
    `- \`TRUNCATE\`: ${report.conceptualPlan.executed ? "EJECUTADO" : "NO EJECUTADO"}.`,
    `- \`RESTART IDENTITY\`, \`setval\`, \`ALTER SEQUENCE\`, \`UPDATE\`, ` +
      `\`DELETE\` e \`INSERT\`: **no ejecutados**.`,
    "",
    "## Secuencias",
    "",
    `Secuencias dinámicas: **${report.sequencePreservation.count}** (se esperaban 45). ` +
      `Lectura inicial/final dentro del preflight: **${report.sequencePreservation.unchangedDuringPreflight ? "sin cambios" : "CAMBIÓ"}` +
      "; las lecturas de secuencia no son MVCC.",
    "",
    markdownTable(
      ["Secuencia", "Valor leído", "Valor al cerrar lectura", "Cambio durante preflight"],
      report.sequencePreservation.before.map((row: Row) => {
        const after = report.sequencePreservation.after.find(
          (candidate: Row) => candidate.sequence_name === row.sequence_name,
        );
        return [
          row.sequence_name,
          row.last_value,
          after?.last_value,
          after?.last_value === row.last_value ? "no" : "sí",
        ];
      }),
    ),
    "",
    "- Política de identidad interna: **CONTINUE IDENTITY**; no se hizo `RESTART IDENTITY`, " +
      "`setval` ni `ALTER SEQUENCE`, y este bloque no introdujo reutilización de IDs internos.",
    "",
    "`public.contenedores_folio_seq` se marca **PENDIENTE** únicamente por la " +
      "ambigüedad de su folio de negocio. No se inventa un objetivo ni se reinicia.",
    "",
    "## Triggers y caché",
    "",
    `- Triggers no internos vivos: **${report.triggers.count}**; enabled (estado distinto de \`D\`): ` +
      `**${report.triggers.enabledCount}**.`,
    `- Guards que escuchan DELETE pero no TRUNCATE: **${report.triggers.appendOnlyDeleteWithoutTruncate.length}**; ` +
      "esto confirma la brecha conceptual de TRUNCATE para roles privilegiados.",
    "",
    markdownTable(
      ["Tabla", "Trigger", "Enabled", "DELETE", "TRUNCATE", "Función"],
      report.triggers.rows.map((row: Row) => [
        row.table,
        row.trigger_name,
        row.enabled,
        row.fires_on_delete,
        row.fires_on_truncate,
        row.function_name,
      ]),
    ),
    "",
    markdownTable(
      ["Inspección estática", "Resultado"],
      Object.entries(report.cacheRebuildInspection).map(([key, value]) => [key, value]),
    ),
    "",
    "La función real acepta la transacción llamadora y sería llamada con `tx`; " +
      "**no se ejecutó ahora**, por lo que `existencias` sigue intacta.",
    "",
    "## Evidencia operacional que se perdería si A fuera purgada",
    "",
    "### Movimientos de crédito: referencias, folios y tipo exacto",
    "",
    markdownTable(
      ["Movimiento", "Tipo", "Importe", "Referencia", "Ticket folio", "Documento", "Crédito", "Origen", "Fecha"],
      report.businessEvidence.creditMovements.map((row: Row) => [
        row.movement_id,
        row.movement_type,
        row.amount,
        row.reference,
        row.ticket_folio,
        row.document_type,
        row.credit,
        row.origin_movement_id,
        row.created_at,
      ]),
    ),
    "",
    "### Tickets y notas de crédito: distinción exacta",
    "",
    `Tickets A evidenciados: **${report.businessEvidence.tickets.length}**; ` +
      `tickets tipo NOTA: **${report.businessEvidence.notaTicketCount}**; ` +
      `autorizaciones de nota asociadas: **${report.businessEvidence.noteAuthorizationCount}** ` +
      `(tabla \`autorizaciones_nota\`: **${report.aCounts.find((row: Row) => row.table === "autorizaciones_nota")?.count ?? "—"}**).`,
    "",
    markdownTable(
      ["Ticket ID", "Folio", "Documento", "Crédito", "Estado", "Autorización", "Total", "Mov. crédito", "Autorización nota", "Creado"],
      report.businessEvidence.tickets.map((row: Row) => [
        row.ticket_id,
        row.folio,
        row.document_type,
        row.credit,
        row.status,
        row.authorization_status,
        row.total,
        row.credit_movement_count,
        row.note_authorization_count,
        row.created_at,
      ]),
    ),
    "",
    "### Series de rollos",
    "",
    `Total de rollos: **${report.businessEvidence.rollos.length}**.`,
    "",
    markdownTable(
      ["Rollo", "Serie", "Estado", "Cantidad actual", "Entrada folio", "Creado", "Actualizado"],
      report.businessEvidence.rollos.map((row: Row) => [
        row.rollo_id,
        row.serie,
        row.status,
        row.cantidad_actual,
        row.entrada_folio,
        row.created_at,
        row.updated_at,
      ]),
    ),
    "",
    "### Folios de entradas",
    "",
    markdownTable(
      ["Entrada", "Folio", "Sitio ID", "Total rollos", "Total costo", "Fecha", "Creada"],
      report.businessEvidence.entradas.map((row: Row) => [
        row.entrada_id,
        row.folio,
        row.site_id,
        row.total_rollos,
        row.total_cost,
        row.fecha,
        row.created_at,
      ]),
    ),
    "",
    "### Salidas",
    "",
    markdownTable(
      ["Salida", "Folio", "Origen ID", "Destino ID", "Estado", "Modalidad", "Ticket ID", "Creada"],
      report.businessEvidence.salidas.map((row: Row) => [
        row.salida_id,
        row.folio,
        row.origin_site_id,
        row.destination_site_id,
        row.status,
        row.modality,
        row.ticket_id,
        row.created_at,
      ]),
    ),
    "",
    "## Freshness contra respaldo verificado",
    "",
    `Snapshot verificado: \`${report.freshness.snapshotCapturedAtUtc}\`; ` +
      `captura actual: \`${report.capture.utc}\`.`,
    `- Datos por tabla (conteos/huellas): **${report.freshness.tableEvidence.status}**.`,
    `- Metadatos semánticos: **${report.freshness.catalogue.status}**.`,
    `- Estado de secuencias contra respaldo: **${report.freshness.sequenceState.status}**.`,
    `- Metadatos de base no volátiles: **${report.freshness.database.status}**.`,
    `- Tamaño actual de base: \`${report.freshness.database.currentSizeBytes}\` bytes ` +
      `(respaldo \`${report.freshness.database.snapshotSizeBytes}\`; valor volátil).`,
    "",
    "### Diferencias detectadas",
    "",
    markdownTable(
      ["Comparación", "Claves diferentes"],
      [
        ["Conteos/huellas", listValue(report.freshness.tableEvidence.differingKeys)],
        ["Metadatos", listValue(report.freshness.catalogue.differingKeys)],
        ["Secuencias", listValue(report.freshness.sequenceState.differingKeys)],
        ["Base", listValue(report.freshness.database.differingKeys)],
      ],
    ),
    "",
    "Detalle de diferencias de conteo/huella:",
    "",
    markdownTable(
      ["Tabla", "Count snapshot", "Count actual", "Hash snapshot", "Hash actual"],
      report.freshness.tableEvidence.differences.map((row: Row) => [
        row.table,
        row.snapshotCount,
        row.currentCount,
        row.snapshotHash,
        row.currentHash,
      ]),
    ),
    "",
    "Detalle de diferencias de secuencia contra el snapshot:",
    "",
    markdownTable(
      ["Secuencia", "Last value snapshot", "Last value actual"],
      report.freshness.sequenceState.differences.map((row: Row) => [
        row.sequence,
        row.snapshotLastValue,
        row.currentLastValue,
      ]),
    ),
    "",
    "## Riesgos y aprobaciones siguientes",
    "",
    "- **NO AUTHORIZED PURGE / PURGA NO AUTORIZADA:** este preflight no autoriza Bloque 4 ni ninguna mutación.",
    "- Se requiere una autorización textual posterior e independiente del propietario, después de revisar este preflight y sus diferencias de freshness.",
    "- Se requiere decisión explícita para `public.contenedores_folio_seq`: reiniciar el folio de negocio o conservarlo; no se propone valor.",
    "- La purga de `sesiones`/`sesiones_caja` invalidaría las sesiones activas y obligaría a reautenticación; no se reinició API, no se cambió autenticación ni se ejecutó invalidación.",
    "- El hallazgo de seguridad permanece: triggers append-only bloquean DELETE, pero no TRUNCATE para roles privilegiados. Los triggers quedaron intactos.",
    "- `cuadre_fiscal_registros` continúa como deriva viva ausente de Drizzle; no se creó, borró ni modificó.",
    "",
    "## Evidencia estructurada",
    "",
    `La salida completa de SQL y metadatos está en \`${relative(ROOT, METADATA_PATH)}\`. ` +
      "Los outputs están sanitizados: no contienen nombres de usuarios, credenciales, IDs de sesión ni filas crudas con PII.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const started = new Date();
  let report: any;
  let client: Client | null = null;
  let transactionOpen = false;
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not configured.");
    const parsed = parseDatabaseUrl(connectionString);
    if (parsed.database !== "heliumdb") {
      throw new Error("DATABASE_URL must target heliumdb.");
    }
    const overrideKeys = [
      "TEST_DATABASE_URL",
      "DATABASE_TEST_URL",
      "APPLICATION_DATABASE_URL",
      "REQUIRE_ISOLATED_TEST_DATABASE",
      "TEST_DATABASE_PREPARATION_PHASE",
      "DATABASE_URL_OVERRIDE",
      "DB_URL_OVERRIDE",
    ];
    const presentOverrides = overrideKeys.filter(
      (key) => process.env[key] !== undefined && process.env[key] !== "",
    );
    if (presentOverrides.length) {
      throw new Error(`Refusing test/application override: ${presentOverrides.join(", ")}.`);
    }

    const gates = await enforceGates();
    const snapshot = gates.snapshot;
    client = new pg.Client({
      connectionString,
      application_name: "prompt_h_block3_preflight_readonly",
    });
    await client.connect();
    await controlQuery(
      client,
      "begin_repeatable_read_read_only",
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    transactionOpen = true;
    await controlQuery(client, "set_local_time_zone", "SET LOCAL TIME ZONE 'UTC'");
    await controlQuery(
      client,
      "set_local_statement_timeout",
      "SET LOCAL statement_timeout = '180s'",
    );
    await controlQuery(client, "set_local_lock_timeout", "SET LOCAL lock_timeout = '5s'");
    await controlQuery(
      client,
      "set_local_idle_in_transaction_timeout",
      "SET LOCAL idle_in_transaction_session_timeout = '300s'",
    );
    const transactionState = await one(
      client,
      "transaction_state",
      `SELECT current_setting('transaction_isolation') AS transaction_isolation,
              current_setting('transaction_read_only') AS transaction_read_only,
              current_setting('statement_timeout') AS statement_timeout,
              current_setting('lock_timeout') AS lock_timeout,
              current_setting('idle_in_transaction_session_timeout') AS idle_timeout`,
    );
    const identity = await one(
      client,
      "live_identity",
      `SELECT current_database() AS database_name,
              current_schema() AS schema_name,
              current_setting('server_version') AS server_version,
              current_setting('transaction_isolation') AS transaction_isolation,
              current_setting('transaction_read_only') AS transaction_read_only`,
    );
    if (
      identity.database_name !== "heliumdb" ||
      identity.schema_name !== "public" ||
      identity.transaction_read_only !== "on"
    ) {
      throw new Error("Live source identity/read-only gate failed.");
    }

    const liveTables = await queryRows(
      client,
      "dynamic_live_table_set",
      `SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind,
              c.relpersistence::text AS persistence, c.relispartition AS is_partition,
              pg_get_partkeydef(c.oid) AS partition_key_definition
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'f')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp_%'
        ORDER BY n.nspname, c.relname`,
      [],
      (rows) =>
        rows.map((row) => ({
          schema: row.schema,
          table: row.table,
          relkind: row.relkind,
          persistence: row.persistence,
          is_partition: row.is_partition,
          partition_key_definition: row.partition_key_definition,
        })),
    );
    const liveTableNames = liveTables.map((row) => String(row.table));
    const expectedTableNames = [...TABLE_CLASS.keys()].sort();
    const liveSet = new Set(liveTableNames);
    const listsMatch =
      liveTableNames.length === 60 &&
      expectedTableNames.length === 60 &&
      expectedTableNames.every((table) => liveSet.has(table));
    if (!listsMatch) throw new Error("Dynamic live table set does not match approved A/B/C lists.");

    const tableEvidence: TableEvidence[] = [];
    for (const row of liveTables) {
      const table = String(row.table);
      const evidence = await one<Row & { count: string; ordered_canonical_row_hash: string }>(
        client,
        `table_count_hash:${table}`,
        `WITH canonical_rows AS (
           SELECT to_jsonb(t)::text AS canonical
             FROM ${tableRef(table)} AS t
         )
         SELECT count(*)::text AS count,
                md5(COALESCE(
                  string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)),
                  ''
                )) AS ordered_canonical_row_hash
           FROM canonical_rows`,
        [],
      );
      tableEvidence.push({
        schema: String(row.schema),
        table,
        relkind: String(row.relkind),
        count: String(evidence.count),
        orderedCanonicalRowHash: String(evidence.ordered_canonical_row_hash),
      });
    }

    const columns = await queryRows(
      client,
      "columns_and_defaults",
      `SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
              a.attnum AS ordinal_position, format_type(a.atttypid, a.atttypmod) AS data_type,
              a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expression,
              NULLIF(a.attidentity, '') AS identity_kind,
              NULLIF(a.attgenerated, '') AS generated_kind
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attnum > 0 AND NOT a.attisdropped
          AND c.relkind IN ('r', 'p', 'f')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp_%'
        ORDER BY n.nspname, c.relname, a.attnum`,
      [],
      (rows) => rows.map((row) => exposeMetadata("columns", row)),
    );
    const constraints = await queryRows(
      client,
      "constraints_and_foreign_keys",
      `SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
              CASE con.contype WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY'
                WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
                WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END AS constraint_type,
              pg_get_constraintdef(con.oid, true) AS definition,
              con.convalidated AS validated, con.condeferrable AS deferrable,
              con.condeferred AS initially_deferred,
              rn.nspname AS referenced_schema, rc.relname AS referenced_table,
              con.confupdtype::text AS update_action, con.confdeltype::text AS delete_action,
              con.confmatchtype::text AS match_type
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_class rc ON rc.oid = con.confrelid
         LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
        WHERE con.contype IN ('c', 'f', 'p', 'u', 'x')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp_%'
        ORDER BY n.nspname, c.relname, con.conname`,
      [],
      (rows) => rows.map((row) => exposeMetadata("constraints", row)),
    );
    const indexes = await queryRows(
      client,
      "indexes",
      `SELECT tn.nspname AS schema, tc.relname AS table, i.relname AS index_name,
              pg_get_indexdef(i.oid) AS definition, x.indisunique AS is_unique,
              x.indisprimary AS is_primary, x.indisexclusion AS is_exclusion,
              x.indisvalid AS is_valid, x.indisready AS is_ready, x.indislive AS is_live,
              pg_get_expr(x.indpred, x.indrelid) AS predicate,
              pg_get_expr(x.indexprs, x.indrelid) AS expressions
         FROM pg_index x
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_class tc ON tc.oid = x.indrelid
         JOIN pg_namespace tn ON tn.oid = tc.relnamespace
        WHERE tc.relkind IN ('r', 'p', 'f')
          AND tn.nspname NOT IN ('pg_catalog', 'information_schema')
          AND tn.nspname NOT LIKE 'pg_toast%'
          AND tn.nspname NOT LIKE 'pg_temp_%'
        ORDER BY tn.nspname, tc.relname, i.relname`,
      [],
      (rows) => rows.map((row) => exposeMetadata("indexes", row)),
    );
    const functions = await queryRows(
      client,
      "functions_semantic",
      `SELECT n.nspname AS schema, p.proname AS name,
              pg_get_function_identity_arguments(p.oid) AS identity_arguments,
              pg_get_function_result(p.oid) AS result_type,
              pg_get_functiondef(p.oid) AS definition,
              p.prokind::text AS kind, p.provolatile::text AS volatility,
              p.prosecdef AS security_definer, p.proleakproof AS leakproof,
              p.proparallel::text AS parallel, p.proacl::text AS acl,
              pg_get_userbyid(p.proowner) AS owner, ext.extname AS extension_name
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         LEFT JOIN pg_depend dep
           ON dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
          AND dep.deptype = 'e'
         LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
        WHERE p.prokind IN ('f', 'p')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp_%'
        ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
      [],
      (rows) => rows.map((row) => exposeMetadata("functions", row)),
    );
    const triggers = await queryRows(
      client,
      "non_internal_triggers_enabled_events",
      `SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger_name,
              t.tgenabled::text AS enabled, t.tgtype::int AS trigger_type_bits,
              ((t.tgtype::int & 8) <> 0) AS fires_on_delete,
              ((t.tgtype::int & 32) <> 0) AS fires_on_truncate,
              pg_get_triggerdef(t.oid, true) AS definition,
              pn.nspname AS function_schema, p.proname AS function_name,
              pg_get_function_identity_arguments(p.oid) AS function_arguments
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_proc p ON p.oid = t.tgfoid
         JOIN pg_namespace pn ON pn.oid = p.pronamespace
        WHERE NOT t.tgisinternal
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp_%'
        ORDER BY n.nspname, c.relname, t.tgname`,
      [],
      (rows) => rows.map((row) => exposeMetadata("triggers", row)),
    );
    const sequences = await queryRows(
      client,
      "sequences_semantic",
      `SELECT schemaname AS schema, sequencename AS sequence_name, data_type,
              start_value::text AS start_value, min_value::text AS min_value,
              max_value::text AS max_value, increment_by::text AS increment_by,
              cycle, cache_size::text AS cache_size,
              NULL::text AS last_value,
              owner_table_schema, owner_table, owner_column,
              ownership_dependency_type
         FROM pg_sequences ps
         LEFT JOIN LATERAL (
           SELECT owner_ns.nspname AS owner_table_schema,
                  owner_table.relname AS owner_table,
                  owner_column.attname AS owner_column,
                  dep.deptype::text AS ownership_dependency_type
             FROM pg_class seq_class
             JOIN pg_namespace seq_ns ON seq_ns.oid = seq_class.relnamespace
             LEFT JOIN pg_depend dep ON dep.classid = 'pg_class'::regclass
               AND dep.objid = seq_class.oid
               AND dep.refclassid = 'pg_class'::regclass
               AND dep.deptype IN ('a', 'i')
             LEFT JOIN pg_class owner_table ON owner_table.oid = dep.refobjid
             LEFT JOIN pg_namespace owner_ns ON owner_ns.oid = owner_table.relnamespace
             LEFT JOIN pg_attribute owner_column ON owner_column.attrelid = dep.refobjid
               AND owner_column.attnum = dep.refobjsubid
            WHERE seq_ns.nspname = ps.schemaname
              AND seq_class.relname = ps.sequencename
              AND seq_class.relkind = 'S'
            LIMIT 1
         ) ownership ON true
        WHERE ps.schemaname NOT IN ('pg_catalog', 'information_schema')
          AND ps.schemaname NOT LIKE 'pg_toast%'
          AND ps.schemaname NOT LIKE 'pg_temp_%'
        ORDER BY ps.schemaname, ps.sequencename`,
      [],
      (rows) => rows.map((row) => exposeMetadata("sequences", row)),
    );
    const sequenceStateBefore = await queryRows(
      client,
      "sequence_state_before",
      `SELECT schemaname AS schema, sequencename AS sequence_name,
              last_value::text AS last_value
         FROM pg_sequences
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND schemaname NOT LIKE 'pg_toast%'
          AND schemaname NOT LIKE 'pg_temp_%'
        ORDER BY schemaname, sequencename`,
    );
    const database = await one(
      client,
      "database_metadata",
      `SELECT current_database() AS database_name,
              pg_database_size(current_database())::text AS size_bytes,
              current_setting('server_version') AS server_version,
              current_setting('server_version_num') AS server_version_num`,
    );
    const foreignKeys = await queryRows(
      client,
      "foreign_key_closure_inputs",
      `SELECT source_ns.nspname AS source_schema, source_table.relname AS source_table,
              con.conname AS constraint_name, con.contype::text AS constraint_type,
              pg_get_constraintdef(con.oid, true) AS constraint_definition,
              target_ns.nspname AS target_schema, target_table.relname AS target_table,
              CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT' ELSE NULL END AS delete_action,
              CASE con.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT' ELSE NULL END AS update_action
         FROM pg_constraint con
         JOIN pg_class source_table ON source_table.oid = con.conrelid
         JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
         LEFT JOIN pg_class target_table ON target_table.oid = con.confrelid
         LEFT JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
        WHERE con.contype = 'f'
          AND source_ns.nspname NOT IN ('pg_catalog', 'information_schema')
          AND source_ns.nspname NOT LIKE 'pg_toast%'
          AND source_ns.nspname NOT LIKE 'pg_temp_%'
          AND source_table.relkind IN ('r', 'p', 'f')
        ORDER BY source_ns.nspname, source_table.relname, con.conname`,
      [],
      (rows) => rows.map((row) => exposeMetadata("foreign_keys", row)),
    );

    const bBeforeTarget: Row[] = [];
    for (const table of B_TABLES) {
      if (table === "existencias") {
        const rows = await queryRows(
          client,
          `b_rows:${table}`,
          `SELECT producto_id::text AS producto_id, ubicacion_id::text AS ubicacion_id,
                  cantidad_total::text AS cantidad_total, rollos_count::text AS rollos_count,
                  updated_at::text AS updated_at
             FROM ${tableRef(table)}
            ORDER BY producto_id, ubicacion_id`,
        );
        bBeforeTarget.push({
          table,
          target: "REBUILD_WITH_ACTUAL_FUNCTION_SAME_TX_NOT_EXECUTED",
          rows: rows.map((row) => ({
            row_key: `${row.producto_id}:${row.ubicacion_id}`,
            before: `${row.cantidad_total}/${row.rollos_count}`,
            target: "REBUILT",
            producto_id: row.producto_id,
            ubicacion_id: row.ubicacion_id,
            updated_at: row.updated_at,
          })),
        });
      } else if (table === "ticket_folio" || table === "series_consecutivo") {
        const column = table === "ticket_folio" ? "ultimo_folio" : "ultimo_numero";
        const rows = await queryRows(
          client,
          `b_rows:${table}`,
          `SELECT id::text AS row_key, ${q(column)}::text AS before
             FROM ${tableRef(table)}
            ORDER BY id`,
        );
        bBeforeTarget.push({
          table,
          target: APPROVED_TARGETS[table],
          rows: rows.map((row) => ({ row_key: row.row_key, before: row.before, target: APPROVED_TARGETS[table] })),
        });
      } else {
        const rows = await queryRows(
          client,
          `b_rows:${table}`,
          `SELECT ubicacion_id::text AS row_key, ultimo_folio::text AS before
             FROM ${tableRef(table)}
            ORDER BY ubicacion_id`,
        );
        bBeforeTarget.push({
          table,
          target: APPROVED_TARGETS[table],
          rows: rows.map((row) => ({
            row_key: row.row_key,
            before: row.before,
            target: APPROVED_TARGETS[table],
          })),
        });
      }
    }

    const creditMovements = await queryRows(
      client,
      "business_credit_movement_references",
      `SELECT m.id::text AS movement_id, m.tipo::text AS movement_type,
              m.importe::text AS amount, m.referencia AS reference,
              m.ticket_id::text AS ticket_id, t.folio::text AS ticket_folio,
              t.documento_tipo AS document_type, t.credito AS credit,
              m.movimiento_origen_id::text AS origin_movement_id,
              m.fecha_vencimiento::text AS due_date, m.es_incobrable AS uncollectible,
              m.dias_plazo::text AS days_term, m.created_at::text AS created_at
         FROM movimientos_credito m
         LEFT JOIN tickets t ON t.id = m.ticket_id
        ORDER BY m.created_at, m.id`,
    );
    const tickets = await queryRows(
      client,
      "business_tickets_and_credit_notes",
      `SELECT t.id::text AS ticket_id, t.folio::text AS folio,
              t.documento_tipo AS document_type, t.credito AS credit,
              t.estado::text AS status, t.autorizacion_estado AS authorization_status,
              t.total::text AS total, t.cobrado AS collected,
              t.dias_plazo::text AS days_term, t.fecha_vencimiento::text AS due_date,
              t.created_at::text AS created_at, t.cobrado_at::text AS collected_at,
              t.autorizado_at::text AS authorized_at,
              (SELECT count(*)::text FROM movimientos_credito m WHERE m.ticket_id=t.id)
                AS credit_movement_count,
              (SELECT count(*)::text FROM autorizaciones_nota a WHERE a.ticket_id=t.id)
                AS note_authorization_count
         FROM tickets t
        ORDER BY t.folio, t.id`,
    );
    const rollos = await queryRows(
      client,
      "business_rollos_series",
      `SELECT r.id::text AS rollo_id, r.serie, r.estado::text AS status,
              r.cantidad_actual::text AS cantidad_actual,
              e.folio::text AS entrada_folio,
              r.created_at::text AS created_at, r.updated_at::text AS updated_at
         FROM rollos r
         LEFT JOIN entradas e ON e.id = r.recepcion_id
        ORDER BY r.serie, r.id`,
    );
    const entradas = await queryRows(
      client,
      "business_entradas_folios",
      `SELECT e.id::text AS entrada_id, e.folio::text AS folio,
              e.ubicacion_id::text AS site_id, e.fecha::text AS fecha,
              e.total_rollos::text AS total_rollos, e.total_costo::text AS total_cost,
              e.created_at::text AS created_at
         FROM entradas e
        ORDER BY e.folio, e.id`,
    );
    const salidas = await queryRows(
      client,
      "business_salidas",
      `SELECT s.id::text AS salida_id, s.folio::text AS folio,
              s.origen_id::text AS origin_site_id, s.destino_id::text AS destination_site_id,
              s.estado::text AS status, s.modalidad AS modality,
              s.ticket_id::text AS ticket_id, s.created_at::text AS created_at
         FROM salidas s
        ORDER BY s.folio, s.id`,
    );

    const defaults = Object.fromEntries(
      columns
        .filter((row) =>
          ["entrada_folio", "salida_folio", "auditoria_inventario_folio",
            "viaje_folio", "ticket_folio", "series_consecutivo"].includes(String(row.table)) &&
          ["ultimo_folio", "ultimo_numero"].includes(String(row.column)),
        )
        .map((row) => [String(row.table), row.default_expression]),
    );
    if (String(defaults.entrada_folio) !== "99" || String(defaults.salida_folio) !== "499") {
      throw new Error("Current entrada_folio/salida_folio defaults are not the verified 99/499 values.");
    }

    const aSet: Set<string> = new Set(A_TABLES);
    const bcSet: Set<string> = new Set([...B_TABLES, ...C_TABLES]);
    const fkRows = foreignKeys.filter((row) => row.constraint_type === "f");
    const aToBcReferences = fkRows.filter(
      (row) => aSet.has(String(row.source_table)) && bcSet.has(String(row.target_table)),
    );
    const bcToAReferences = fkRows.filter(
      (row) => bcSet.has(String(row.source_table)) && aSet.has(String(row.target_table)),
    );
    const closure = incomingClosure(aSet, fkRows);

    const sequenceStateAfter = await queryRows(
      client,
      "sequence_state_after",
      `SELECT schemaname AS schema, sequencename AS sequence_name,
              last_value::text AS last_value
         FROM pg_sequences
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND schemaname NOT LIKE 'pg_toast%'
          AND schemaname NOT LIKE 'pg_temp_%'
        ORDER BY schemaname, sequencename`,
    );
    if (sequenceStateBefore.length !== 45 || sequenceStateAfter.length !== 45) {
      throw new Error("The live source does not expose exactly 45 sequences.");
    }
    const sequenceStateComparison = compareRows(
      sequenceStateBefore,
      sequenceStateAfter,
      ["schema", "sequence_name"],
    );
    const cacheRebuildInspection = await inspectCacheRebuildFunction();
    const enabledTriggers = triggers.filter((row) => row.enabled !== "D");
    const appendOnlyDeleteWithoutTruncate = triggers.filter(
      (row) => row.enabled !== "D" && row.fires_on_delete === true && row.fires_on_truncate !== true,
    );

    const currentCatalogue = {
      tables: liveTables,
      tableEvidence,
      columns,
      constraints,
      indexes,
      functions,
      triggers,
      sequences,
      database,
    };
    const backupCatalogue = snapshot.source?.catalogue ?? {};
    const tableFreshness = compareRows(
      (backupCatalogue.tableEvidence ?? []) as unknown as Row[],
      tableEvidence as unknown as Row[],
      ["schema", "table"],
    );
    const catalogueComparisons: Record<string, { status: string; differingKeys: string[] }> = {
      tables: compareRows(
        (backupCatalogue.tables ?? []) as Row[],
        liveTables,
        ["schema", "table"],
        normalizedTable,
      ),
      columns: compareRows(
        (backupCatalogue.columns ?? []) as Row[],
        columns,
        ["schema", "table", "column"],
        normalizedColumn,
      ),
      constraints: compareRows(
        (backupCatalogue.constraints ?? []) as Row[],
        constraints,
        ["schema", "table", "name"],
      ),
      indexes: compareRows(
        (backupCatalogue.indexes ?? []) as Row[],
        indexes,
        ["schema", "table", "index_name"],
      ),
      functions: compareRows(
        (backupCatalogue.functions ?? []) as Row[],
        functions,
        ["schema", "name", "identity_arguments"],
        normalizedFunction,
      ),
      triggers: compareRows(
        (backupCatalogue.triggers ?? []) as Row[],
        triggers,
        ["schema", "table", "trigger_name"],
        normalizedTrigger,
      ),
      sequences: compareRows(
        (backupCatalogue.sequences ?? []) as Row[],
        sequences,
        ["schema", "sequence_name"],
        normalizedSequenceDefinition,
      ),
    };
    const catalogueDifferences = Object.entries(catalogueComparisons)
      .flatMap(([category, comparison]) =>
        comparison.differingKeys.map((key) => `${category}:${key}`),
      );
    const snapshotDatabase = backupCatalogue.database ?? {};
    const databaseComparison = compareRows(
      [snapshotDatabase],
      [database],
      ["database_name"],
      normalizedDatabase,
    );
    const snapshotSequenceState =
      (snapshot.source?.sequenceStateBeforeDump ?? []) as Row[];
    const sequenceFreshness = compareRows(
      snapshotSequenceState,
      sequenceStateBefore,
      ["schema", "sequence_name"],
    );
    const tableEvidenceDifferences = tableFreshness.differingKeys.map((key) => {
      const before = (backupCatalogue.tableEvidence ?? []).find(
        (row) => `${row.schema}.${row.table}` === key,
      );
      const after = tableEvidence.find((row) => `${row.schema}.${row.table}` === key);
      return {
        table: key,
        snapshotCount: before?.count ?? null,
        currentCount: after?.count ?? null,
        snapshotHash: before?.orderedCanonicalRowHash ?? null,
        currentHash: after?.orderedCanonicalRowHash ?? null,
      };
    });
    const sequenceStateDifferences = sequenceFreshness.differingKeys.map((key) => {
      const before = snapshotSequenceState.find(
        (row) => `${row.schema}.${row.sequence_name}` === key,
      );
      const after = sequenceStateBefore.find(
        (row) => `${row.schema}.${row.sequence_name}` === key,
      );
      return {
        sequence: key,
        snapshotLastValue: before?.last_value ?? null,
        currentLastValue: after?.last_value ?? null,
      };
    });
    const freshnessStatus =
      tableFreshness.status === "MATCH" &&
      catalogueDifferences.length === 0 &&
      sequenceFreshness.status === "MATCH" &&
      databaseComparison.status === "MATCH"
        ? "MATCHES_VERIFIED_BACKUP_AT_CAPTURE"
        : "SOURCE_CHANGED_SINCE_VERIFIED_BACKUP";

    const conceptualSql = [
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE; -- conceptual only, not executed",
      "SET LOCAL statement_timeout = '180s';",
      `TRUNCATE TABLE ${A_TABLES.map(tableRef).join(", ")} CONTINUE IDENTITY RESTRICT;`,
      "-- UPDATE B counter rows to the approved targets; no sequence reset.",
      "-- UPDATE public.entrada_folio SET ultimo_folio = 0; -- per site",
      "-- UPDATE public.salida_folio SET ultimo_folio = 0; -- per site",
      "-- UPDATE public.viaje_folio SET ultimo_folio = 0; -- per site",
      "-- UPDATE public.auditoria_inventario_folio SET ultimo_folio = 0; -- per site",
      "-- UPDATE public.ticket_folio SET ultimo_folio = 999;",
      "-- UPDATE public.series_consecutivo SET ultimo_numero = 1000000;",
      "await reconstruirCacheExistencias(tx); -- same transaction; not executed",
      "COMMIT; -- conceptual only",
    ].join("\n");

    const preflightGateStatus =
      triggers.length === 14 && enabledTriggers.length === 14
        ? "PASS"
        : "FAIL_TRIGGERS_NOT_ALL_ENABLED";
    const safeCatalogue = {
      tables: liveTables.map((row) => exposeMetadata("tables", row)),
      tableEvidence,
      columns: columns.map((row) => exposeMetadata("columns", row)),
      constraints: constraints.map((row) => exposeMetadata("constraints", row)),
      indexes: indexes.map((row) => exposeMetadata("indexes", row)),
      functions: functions.map((row) => exposeMetadata("functions", row)),
      triggers: triggers.map((row) => exposeMetadata("triggers", row)),
      sequences: sequences.map((row) => exposeMetadata("sequences", row)),
      database,
    };
    report = {
      status: preflightGateStatus === "PASS"
        ? "COMPLETE_READ_ONLY_PREFLIGHT"
        : "COMPLETE_READ_ONLY_PREFLIGHT_WITH_GATE_FAILURE",
      operation: "PROMPT_H_BLOCK3_READ_ONLY_PREFLIGHT",
      purgeAuthorization: "NOT_AUTHORIZED",
      capture: {
        utc: started.toISOString(),
        mexico: mexico(started),
        observedAtDatabaseUtc: new Date().toISOString(),
      },
      gates: gates.statuses,
      preflightGates: {
        triggerCount: triggers.length,
        enabledTriggerCount: enabledTriggers.length,
        triggerState: preflightGateStatus,
      },
      connection: {
        database: String(identity.database_name),
        schema: String(identity.schema_name),
        serverVersion: String(identity.server_version),
        transactionIsolation: String(identity.transaction_isolation),
        transactionReadOnly: String(identity.transaction_read_only),
        statementTimeout: String(transactionState.statement_timeout),
        lockTimeout: String(transactionState.lock_timeout),
        idleTimeout: String(transactionState.idle_timeout),
        sourceUrlValueOmitted: true,
        hostAndCredentialsOmitted: true,
        testOverridesPresent: false,
      },
      classification: {
        liveTableCount: liveTableNames.length,
        counts: { A: A_TABLES.length, B: B_TABLES.length, C: C_TABLES.length },
        listNames: { A: [...A_TABLES], B: [...B_TABLES], C: [...C_TABLES] },
        listsMatchDynamicLiveSet: listsMatch,
      },
      tableEvidence,
      aCounts: tableEvidence
        .filter((row) => TABLE_CLASS.get(row.table) === "A")
        .map((row) => ({ table: row.table, count: row.count })),
      bBeforeTarget,
      cTableEvidence: tableEvidence.filter((row) => TABLE_CLASS.get(row.table) === "C"),
      defaults: {
        ...defaults,
        entrada_folio: String(defaults.entrada_folio),
        salida_folio: String(defaults.salida_folio),
        reportOnly: true,
        changed: false,
      },
      fkClosure: {
        aToBcReferences,
        bcToAReferences,
        incomingClosure: {
          closureTables: closure.closureTables,
          outsideA: closure.outsideA,
          edges: closure.edges,
        },
        truncateMetadataStatus:
          bcToAReferences.length === 0 &&
          closure.outsideA.length === 0
            ? "CONDITIONALLY_ALLOWED_BY_STATIC_FK_METADATA_ONLY"
            : "BLOCKED_BY_STATIC_FK_METADATA",
      },
      triggers: {
        count: triggers.length,
        enabledCount: enabledTriggers.length,
        allEnabled: triggers.length === 14 && enabledTriggers.length === 14,
        appendOnlyDeleteWithoutTruncate,
        rows: triggers.map((row) => exposeMetadata("triggers", row)),
        securityFinding:
          "Append-only DELETE guards do not fire on TRUNCATE for privileged roles; separate security remediation required. Triggers untouched.",
      },
      cacheRebuildInspection,
      conceptualPlan: {
        sql: conceptualSql,
        executed: false,
        truncateTarget: "A_ONLY",
        identity: "CONTINUE_IDENTITY",
        foreignKeyMode: "RESTRICT",
        existenciasOperation: "actual function with same tx, not run",
      },
      sequencePreservation: {
        count: sequenceStateBefore.length,
        before: sequenceStateBefore,
        after: sequenceStateAfter,
        unchangedDuringPreflight: sequenceStateComparison.status === "MATCH",
        valuesChangedByThisScript: false,
        internalIdPolicy: "CONTINUE_IDENTITY_NO_INTERNAL_ID_REUSE_NO_SEQUENCE_RESET",
        sequenceResetExecuted: false,
        pendingBusinessFolioDecision: {
          sequence: "public.contenedores_folio_seq",
          ownerTable: "contenedores",
          ownerColumn: "folio",
          decision: "PENDING_OWNER_DECISION_NO_TARGET_INVENTED_NO_RESET",
        },
      },
      businessEvidence: {
        creditMovements,
        tickets,
        notaTicketCount: tickets.filter((row) => row.document_type === "NOTA").length,
        noteAuthorizationCount: tickets.reduce(
          (total, row) => total + Number(row.note_authorization_count ?? 0),
          0,
        ),
        rollos,
        entradas,
        salidas,
      },
      freshness: {
        status: freshnessStatus,
        snapshotCapturedAtUtc: snapshot.capturedAtUtc ?? null,
        tableEvidence: {
          ...tableFreshness,
          differences: tableEvidenceDifferences,
        },
        catalogue: {
          status: catalogueDifferences.length === 0 ? "MATCH" : "MISMATCH",
          differingKeys: catalogueDifferences,
          categories: catalogueComparisons,
        },
        sequenceState: {
          ...sequenceFreshness,
          differences: sequenceStateDifferences,
        },
        database: {
          status: databaseComparison.status,
          differingKeys: databaseComparison.differingKeys,
          snapshotSizeBytes: snapshotDatabase.size_bytes ?? null,
          currentSizeBytes: database.size_bytes ?? null,
          sizeIsVolatile: true,
        },
        sourceSnapshotPath: relative(ROOT, SNAPSHOT_PATH),
        backupDirectory: relative(ROOT, BACKUP_DIR),
        dumpSha256: EXPECTED_CURRENT_DUMP_SHA256,
        mismatchPolicy: "differences reported; none hidden; no source write",
      },
      metadata: {
        catalogueCounts: {
          tables: liveTables.length,
          tableEvidence: tableEvidence.length,
          columns: columns.length,
          constraints: constraints.length,
          indexes: indexes.length,
          functions: functions.length,
          triggers: triggers.length,
          sequences: sequences.length,
        },
        safeCatalogue,
        database,
        rawRowsPersisted: false,
        userNamesCredentialsSessionIdsPersisted: false,
      },
      sourceMutationPolicy: {
        transaction: "REPEATABLE READ READ ONLY",
        sourceWrites: false,
        updateExecuted: false,
        deleteExecuted: false,
        truncateExecuted: false,
        insertExecuted: false,
        sequenceResetExecuted: false,
        cacheRebuildExecuted: false,
        triggerChanged: false,
        apiRestarted: false,
        authenticationChanged: false,
      },
      queryOutputs: queryRecords,
    };
    await controlQuery(client, "rollback_read_only_transaction", "ROLLBACK");
    transactionOpen = false;
  } catch (error) {
    report = report ?? {
      status: "BLOCKED_READ_ONLY_PREFLIGHT",
      operation: "PROMPT_H_BLOCK3_READ_ONLY_PREFLIGHT",
      purgeAuthorization: "NOT_AUTHORIZED",
      error: error instanceof Error ? error.message : "preflight failed",
      gates: [],
      sourceMutationPolicy: {
        sourceWrites: false,
        purgeExecuted: false,
        sequenceResetExecuted: false,
        cacheRebuildExecuted: false,
      },
      queryOutputs: queryRecords,
    };
    if (transactionOpen && client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    if (client) await client.end().catch(() => undefined);
  }
  await fs.mkdir(REPORT_DIR, { recursive: true, mode: 0o700 });
  const metadataText = `${JSON.stringify(report, null, 2)}\n`;
  const markdownText = report.status.startsWith("COMPLETE_READ_ONLY_PREFLIGHT")
    ? renderMarkdown(report)
    : `# Prompt H — Bloque 3: preflight bloqueado\n\n**${report.status}**\n\n` +
      `- Purga: **NOT AUTHORIZED**.\n- Error: ${report.error}\n` +
      "- No se ejecutó ninguna escritura.\n";
  await fs.writeFile(METADATA_PATH, metadataText, { encoding: "utf8", mode: 0o600 });
  await fs.writeFile(REPORT_PATH, markdownText, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(METADATA_PATH, 0o600);
  await fs.chmod(REPORT_PATH, 0o600);
  process.stdout.write(
    `${JSON.stringify({
      status: report.status,
      report: relative(ROOT, REPORT_PATH),
      metadata: relative(ROOT, METADATA_PATH),
      purgeAuthorization: "NOT_AUTHORIZED",
      freshness: report.freshness?.status ?? null,
    })}\n`,
  );
}

await main().catch((error: unknown) => {
  console.error(`Prompt H Block 3 failed: ${error instanceof Error ? error.message : "unknown failure"}`);
  process.exitCode = 1;
});