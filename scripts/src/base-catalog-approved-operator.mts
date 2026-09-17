/**
 * Offline operator for the owner-approved Base catalogue deactivation.
 *
 * This command never starts the API or imports the application database module.
 * It uses the scripts package's local pg client only, defaults to a read-only
 * check, and has one non-retrying SERIALIZABLE write transaction for --apply.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

type Row = Record<string, unknown>;
type TableEvidence = {
  schema: string;
  table: string;
  relkind: string;
  count: string;
  orderedCanonicalRowHash: string;
};
type RelationIdentity = {
  schema: string;
  table: string;
  relkind: string;
};
type Snapshot = {
  archive?: Row;
  source?: {
    database?: { database_name?: string; server_version?: string };
    catalogue?: { tables?: Row[]; tableEvidence?: TableEvidence[] };
    sequenceStateBeforeDump?: Row[];
    sequenceStateAfterDump?: Row[];
  };
};
interface DriveVerification {
  status: "PASS";
  dumpSha256: string;
  dumpSizeBytes: number;
  downloadSha256: string;
  downloadSizeBytes: number;
  fileId: string;
  webViewLink: string;
  verifiedAtUtc: string;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/base-catalog-2026-09-17");
const RESTORE_PATH = resolve(REPORT_DIR, "block2-restore-metadata.json");
const APPROVAL_PATH = resolve(REPORT_DIR, "aprobacion.md");
const DRIVE_PATH = resolve(REPORT_DIR, "drive-verification.json");
const CHECK_PATH = resolve(REPORT_DIR, "check.json");
const RESULT_PATH = resolve(REPORT_DIR, "result.json");
const REHEARSAL_PATH = resolve(REPORT_DIR, "rehearsal.json");
const SOURCE_DATABASE = "heliumdb";
const SOURCE_SCHEMA = "public";
const APPROVED = [
  "BOM-BAS", "DUB-BAS2", "GABCAM-BAS", "GABDUC-BAS", "LICMET-BAS", "MIC-BAS",
  "POL-BAS", "SOC-BAS", "TUL15-BAS", "TUL70-BAS", "TULEST-BAS", "TULGLI-BAS",
] as const;
const PROTECTED = ["ENC-BAS", "FRACILBAB-BAS", "MAN-BAS", "PIQVER-BAS"] as const;
const ALL_BASE_SKUS = [...APPROVED, ...PROTECTED] as const;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function redact(error: unknown): string {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url-redacted]")
    .replaceAll(ROOT, "[workspace]")
    .replaceAll(/\b(?:password|passwd)=[^\s;]+/gi, "password=[redacted]");
}

function q(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function tableRef(table: string): string {
  return `${q(SOURCE_SCHEMA)}.${q(table)}`;
}

function canonicalHashSql(table: string, where = ""): string {
  return `WITH canonical_rows AS (
    SELECT to_jsonb(t)::text AS canonical FROM ${tableRef(table)} AS t ${where}
  )
  SELECT count(*)::text AS count, md5(COALESCE(
    string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)), ''
  )) AS ordered_canonical_row_hash FROM canonical_rows`;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

async function writeEvidence(path: string, value: Row): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(path, 0o600);
}

async function rows(client: pg.Client, text: string, values: unknown[] = []): Promise<Row[]> {
  try {
    return (await client.query(text, values)).rows as Row[];
  } catch {
    throw new Error("database query failed");
  }
}

async function one(client: pg.Client, text: string, values: unknown[] = []): Promise<Row> {
  const value = (await rows(client, text, values))[0];
  if (!value) throw new Error("required database query returned no row");
  return value;
}

function sameRows(left: Row[], right: Row[]): boolean {
  return stable(left) === stable(right);
}

function asEvidence(row: Row, table: string): TableEvidence {
  return {
    schema: SOURCE_SCHEMA,
    table,
    relkind: String(row.relkind),
    count: String(row.count),
    orderedCanonicalRowHash: String(row.ordered_canonical_row_hash),
  };
}

async function captureEvidence(client: pg.Client, tables: string[]): Promise<TableEvidence[]> {
  // Fetch every relation kind in one catalogue query.  The row hash below is
  // deliberately the exact canonical SQL used by Prompt H's backup snapshot.
  const kinds = await rows(client, `SELECT c.relname AS table, c.relkind::text AS relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
    ORDER BY c.relname`, [[...tables]]);
  const kindByTable = new Map(kinds.map((entry) => [String(entry.table), String(entry.relkind)]));
  assert.equal(kindByTable.size, tables.length, "current relation-kind coverage differs from snapshot");
  const result: TableEvidence[] = [];
  for (const table of tables) {
    const evidence = asEvidence(await one(client, canonicalHashSql(table)), table);
    evidence.relkind = kindByTable.get(table)!;
    result.push(evidence);
  }
  return result;
}

function orderedRelations(items: RelationIdentity[]): RelationIdentity[] {
  return items.slice().sort((left, right) =>
    left.schema.localeCompare(right.schema) || left.table.localeCompare(right.table) ||
    left.relkind.localeCompare(right.relkind));
}

async function captureRelations(client: pg.Client): Promise<RelationIdentity[]> {
  const relations = await rows(client, `SELECT n.nspname AS schema, c.relname AS table,
    c.relkind::text AS relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
    ORDER BY n.nspname, c.relname, c.relkind`);
  return orderedRelations(relations.map((entry) => ({
    schema: String(entry.schema), table: String(entry.table), relkind: String(entry.relkind),
  })));
}

function assertRelationsEqual(
  actual: RelationIdentity[],
  expected: RelationIdentity[],
  label: string,
): void {
  const actualByName = new Map(actual.map((item) => [`${item.schema}.${item.table}`, item]));
  const expectedByName = new Map(expected.map((item) => [`${item.schema}.${item.table}`, item]));
  const differences: string[] = [];
  for (const key of [...new Set([...actualByName.keys(), ...expectedByName.keys()])].sort()) {
    const received = actualByName.get(key);
    const baseline = expectedByName.get(key);
    if (!received || !baseline) {
      differences.push(`${key} [missing relation]`);
    } else if (received.relkind !== baseline.relkind) {
      differences.push(`${key} [relkind]`);
    }
  }
  assert.equal(differences.length, 0, `${label}: dynamic relation list mismatch: ${differences.join("; ")}`);
  assert.equal(stable(orderedRelations(actual)), stable(orderedRelations(expected)),
    `${label}: dynamic relation identity ordering mismatch`);
}

async function sequenceState(client: pg.Client): Promise<Row[]> {
  return rows(client, `SELECT schemaname AS schema, sequencename AS sequence_name,
    last_value::text AS last_value
    FROM pg_sequences
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND schemaname NOT LIKE 'pg_toast%' AND schemaname NOT LIKE 'pg_temp_%'
    ORDER BY schemaname, sequencename`);
}

function assertEvidenceEqual(actual: TableEvidence[], expected: TableEvidence[], label: string): void {
  assert.equal(actual.length, expected.length, `${label}: dynamic application table coverage`);
  const actualByTable = new Map(actual.map((entry) => [entry.table, entry]));
  const expectedByTable = new Map(expected.map((entry) => [entry.table, entry]));
  const differences: string[] = [];
  for (const table of [...new Set([...actualByTable.keys(), ...expectedByTable.keys()])].sort()) {
    const received = actualByTable.get(table);
    const baseline = expectedByTable.get(table);
    if (!received || !baseline) {
      differences.push(`${table} [missing relation]`);
      continue;
    }
    const fields = (["schema", "relkind", "count", "orderedCanonicalRowHash"] as const)
      .filter((field) => received[field] !== baseline[field]);
    if (fields.length) differences.push(`${table} [${fields.join(",")}]`);
  }
  assert.equal(differences.length, 0,
    `${label}: table count/hash mismatch: ${differences.join("; ")}`);
}

function assertSequencesEqual(actual: Row[], expected: Row[], label: string): void {
  assert.equal(stable(actual), stable(expected), `${label}: sequence state drift`);
}

async function loadInputs(): Promise<{
  restore: Row;
  snapshot: Snapshot;
  tables: string[];
  relations: RelationIdentity[];
  backupEvidence: TableEvidence[];
  sequences: Row[];
  backupDirectory: string;
  archive: Row;
}> {
  const [restore, approval, drive] = await Promise.all([
    readJson(RESTORE_PATH),
    fs.readFile(APPROVAL_PATH, "utf8"),
    readJson(DRIVE_PATH) as Promise<DriveVerification>,
  ]);
  const approvedMentions = approval.match(/\b[A-Z0-9]+-BAS2?\b/g) ?? [];
  assert.deepEqual(
    [...new Set(approvedMentions)].sort(),
    [...ALL_BASE_SKUS].sort(),
    "owner approval must explicitly enumerate exactly the 12 approved and 4 protected SKU values",
  );
  assert.match(approval, /permanecen activos/i, "owner approval lacks protected-active instruction");
  assert.equal(restore.status, "PASS", "backup restore metadata is not PASS");
  assert.equal((restore.comparison as Row | undefined)?.status, "PASS", "restore comparison is not PASS");
  assert.equal(
    (restore.comparison as Row | undefined)?.sequenceChangedDuringDump,
    false,
    "source sequence changed during dump",
  );
  assert.equal(restore.sourceDatabase, SOURCE_DATABASE, "backup is not for heliumdb");
  const archive = restore.archive as Row | undefined;
  assert(archive && typeof archive.sha256 === "string" && typeof archive.sizeBytes === "number" &&
    Number.isSafeInteger(archive.sizeBytes),
    "restore metadata has no valid archive metadata");
  const verification = drive as DriveVerification;
  assert.equal(verification.status, "PASS", "Drive verification is not PASS");
  assert.equal(verification.dumpSha256, archive.sha256, "Drive dump SHA-256 differs from fresh metadata");
  assert.equal(verification.downloadSha256, archive.sha256, "Drive download SHA-256 differs from fresh metadata");
  assert.equal(verification.dumpSizeBytes, archive.sizeBytes, "Drive dump size differs from fresh metadata");
  assert.equal(verification.downloadSizeBytes, archive.sizeBytes, "Drive download size differs from fresh metadata");
  assert(verification.fileId && verification.webViewLink && verification.verifiedAtUtc,
    "Drive verification lacks file identity or verification time");
  const backupDirectory = String(restore.backupDirectory ?? "");
  assert(backupDirectory.startsWith(ROOT), "backup directory is outside workspace");
  const snapshot = await readJson(resolve(backupDirectory, "source-snapshot.json")) as Snapshot;
  const snapshotArchive = snapshot.archive;
  assert(snapshotArchive && snapshotArchive.sha256 === archive.sha256 &&
    snapshotArchive.sizeBytes === archive.sizeBytes,
  "snapshot archive SHA-256 or size differs from restore metadata");
  const catalogue = snapshot.source?.catalogue;
  const relations = orderedRelations((catalogue?.tables ?? []).map((entry) => ({
    schema: String(entry.schema), table: String(entry.table), relkind: String(entry.relkind),
  })));
  assert(relations.length > 0 && relations.every((entry) => entry.schema === SOURCE_SCHEMA),
    "snapshot contains a non-public application relation");
  const tables = relations.map((entry) => entry.table);
  const backupEvidence = catalogue?.tableEvidence ?? [];
  const sequences = snapshot.source?.sequenceStateAfterDump;
  assert.equal(snapshot.source?.database?.database_name, SOURCE_DATABASE, "snapshot source is not heliumdb");
  assert(new Set(tables).size === tables.length, "snapshot table coverage is invalid");
  assert.equal(backupEvidence.length, tables.length, "snapshot table evidence coverage is invalid");
  assert(Array.isArray(sequences) && sequences.length > 0, "snapshot sequence state after dump is absent");
  assert.equal(
    stable(snapshot.source?.sequenceStateBeforeDump),
    stable(sequences),
    "backup source sequence changed during dump",
  );
  return { restore, snapshot, tables, relations, backupEvidence, sequences, backupDirectory, archive };
}

function snapshotServerVersion(inputs: Awaited<ReturnType<typeof loadInputs>>): string {
  const version = inputs.snapshot.source?.database?.server_version;
  assert(typeof version === "string" && version.length > 0, "snapshot source server version is absent");
  return version;
}

async function assertIdentityAndConnectionGuard(
  client: pg.Client,
  expectedServerVersion: string,
): Promise<void> {
  const identity = await one(client, `SELECT current_database() AS database_name,
    current_schema() AS schema_name, current_user AS current_user,
    current_setting('server_version') AS server_version`);
  assert.equal(identity.database_name, SOURCE_DATABASE, "DATABASE_URL must target heliumdb");
  assert.equal(identity.schema_name, SOURCE_SCHEMA, "DATABASE_URL must use public schema");
  assert.equal(identity.server_version, expectedServerVersion, "current PostgreSQL version differs from snapshot");
  const peers = await one(client, `SELECT count(*)::int AS count FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
      AND backend_type = 'client backend'`);
  assert.equal(Number(peers.count), 0, "other client connections must be zero");
}

async function assertLocalRestoreIdentity(client: pg.Client): Promise<void> {
  const identity = await one(client, `SELECT current_database() AS database_name,
    current_schema() AS schema_name, inet_server_addr() IS NULL AS unix_socket_only`);
  assert.equal(identity.database_name, SOURCE_DATABASE, "local rehearsal database must be heliumdb");
  assert.equal(identity.schema_name, SOURCE_SCHEMA, "local rehearsal database must use public schema");
  assert.equal(identity.unix_socket_only, true, "local rehearsal connection is not a Unix socket");
}

async function assertRequiredColumns(client: pg.Client): Promise<void> {
  const columns = await rows(client, `SELECT table_name, column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('productos', 'auditoria')
    ORDER BY table_name, ordinal_position`);
  const required = [
    "productos.id", "productos.sku", "productos.tela", "productos.color", "productos.activo",
    "productos.updated_at", "auditoria.id", "auditoria.usuario_id", "auditoria.usuario_snapshot",
    "auditoria.rol_snapshot", "auditoria.modulo", "auditoria.accion", "auditoria.entidad",
    "auditoria.entidad_id", "auditoria.datos_antes", "auditoria.datos_despues", "auditoria.ip",
  ];
  const available = new Set(columns.map((entry) => `${entry.table_name}.${entry.column_name}`));
  assert(required.every((key) => available.has(key)), "required product/audit columns are absent");
  const nullable = new Map(columns.map((entry) => [`${entry.table_name}.${entry.column_name}`, entry.is_nullable]));
  const types = new Map(columns.map((entry) => [`${entry.table_name}.${entry.column_name}`, entry.data_type]));
  assert.equal(nullable.get("auditoria.usuario_id"), "YES", "auditoria.usuario_id must accept NULL");
  assert.equal(nullable.get("auditoria.rol_snapshot"), "YES", "auditoria.rol_snapshot must accept NULL");
  assert.equal(types.get("productos.activo"), "boolean", "productos.activo must be boolean");
  assert.equal(types.get("auditoria.datos_antes"), "jsonb", "auditoria.datos_antes must be jsonb");
  assert.equal(types.get("auditoria.datos_despues"), "jsonb", "auditoria.datos_despues must be jsonb");
}

async function assertNoProductWriterTriggers(client: pg.Client): Promise<number> {
  const triggers = await rows(client, `SELECT t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname = 'productos'
    ORDER BY t.tgname`);
  assert.equal(triggers.length, 0, "productos has an unexpected writer trigger");
  return triggers.length;
}

type Product = { id: string; sku: string; tela: string; color: string; activo: boolean; row: Row };

async function baseProducts(client: pg.Client): Promise<Product[]> {
  const result = await rows(client, `SELECT id::text AS id, sku, tela, color, activo,
    to_jsonb(productos) AS row FROM public.productos ORDER BY sku`);
  return result.filter((entry) => String(entry.color).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes("base"))
    .map((entry) => ({
      id: String(entry.id), sku: String(entry.sku), tela: String(entry.tela), color: String(entry.color),
      activo: entry.activo === true, row: entry.row as Row,
    }));
}

async function gateCounts(client: pg.Client, base: Product[]): Promise<Row> {
  const counts = await one(client, `SELECT
    (SELECT count(*)::int FROM public.productos WHERE activo) AS active_products,
    (SELECT count(DISTINCT producto_id)::int FROM public.precio_historial) AS history_distinct_products,
    (SELECT count(*)::int FROM public.precio_historial) AS history_rows`);
  assert.equal(Number(counts.active_products), 1234, "active product baseline must be 1234");
  assert.equal(Number(counts.history_distinct_products), 1010, "history distinct baseline must be 1010");
  assert.equal(Number(counts.history_rows), 1016, "history row baseline must be 1016");
  assert.equal(base.length, 16, "NFD/case-insensitive Base catalogue must contain 16 products");
  assert.deepEqual(base.map((entry) => entry.sku).sort(), [...ALL_BASE_SKUS].sort(),
    "Base catalogue SKU set differs from owner-approved scope");
  assert(base.every((entry) => entry.activo), "all 16 Base products must be active before write");
  for (const product of base.filter((entry) => (APPROVED as readonly string[]).includes(entry.sku))) {
    const fabric = await one(client, `SELECT count(*)::int AS other_active FROM public.productos
      WHERE tela = $1 AND activo AND sku <> $2`, [product.tela, product.sku]);
    assert(Number(fabric.other_active) > 0, "a Base fabric has no other active product");
    assert.equal(base.filter((entry) => entry.tela === product.tela).length, 1,
      "a fabric has more than one Base product");
  }
  return {
    activeProducts: Number(counts.active_products), baseProducts: base.length,
    historyDistinctProducts: Number(counts.history_distinct_products), historyRows: Number(counts.history_rows),
  };
}

async function productHash(client: pg.Client, approved: boolean): Promise<TableEvidence> {
  const where = approved ? "WHERE sku = ANY($1::text[])" : "WHERE NOT (sku = ANY($1::text[]))";
  return asEvidence(await one(client, canonicalHashSql("productos", where), [[...APPROVED]]), "productos");
}

async function oldAuditHash(client: pg.Client, excludedIds: string[] = []): Promise<TableEvidence> {
  const where = "WHERE NOT (id = ANY($1::bigint[]))";
  return asEvidence(await one(client, canonicalHashSql("auditoria", where), [excludedIds]), "auditoria");
}

function productWithoutActivo(row: Row): Row {
  const copy = { ...row };
  delete copy.activo;
  return copy;
}

function evidenceSummary(items: TableEvidence[]): Row {
  return {
    applicationTableCount: items.length,
    allCountsAndCanonicalHashesMatch: true,
  };
}

function sequenceSummary(before: Row[], after: Row[], allowAuditDelta: boolean): Row {
  const beforeMap = new Map(before.map((item) => [`${item.schema}.${item.sequence_name}`, item]));
  const afterMap = new Map(after.map((item) => [`${item.schema}.${item.sequence_name}`, item]));
  assert.equal(beforeMap.size, afterMap.size, "sequence coverage changed");
  for (const [key, prior] of beforeMap) {
    const later = afterMap.get(key);
    assert(later, `sequence disappeared: ${key}`);
    if (key === "public.auditoria_id_seq" && allowAuditDelta) {
      assert.equal(BigInt(String(later.last_value)) - BigInt(String(prior.last_value)), 12n,
        "auditoria ID sequence delta must be exactly 12");
    } else {
      assert.equal(String(later.last_value), String(prior.last_value), `unexpected sequence change: ${key}`);
    }
  }
  return { sequenceCount: before.length, onlyAuditoriaIdSequenceChanged: allowAuditDelta };
}

async function check(client: pg.Client, inputs: Awaited<ReturnType<typeof loadInputs>>): Promise<Row> {
  await assertIdentityAndConnectionGuard(client, snapshotServerVersion(inputs));
  await assertRequiredColumns(client);
  const productTriggerCount = await assertNoProductWriterTriggers(client);
  const currentRelations = await captureRelations(client);
  assertRelationsEqual(currentRelations, inputs.relations, "fresh backup comparison");
  const current = await captureEvidence(client, currentRelations.map((entry) => entry.table));
  assertEvidenceEqual(current, inputs.backupEvidence, "fresh backup comparison");
  const currentSequences = await sequenceState(client);
  assertSequencesEqual(currentSequences, inputs.sequences, "fresh backup comparison");
  // Exercise the same array-bound whole-row hash helpers that --apply uses
  // before any gate which may stop this read-only run.
  await productHash(client, false);
  await oldAuditHash(client);
  const base = await baseProducts(client);
  const gates = await gateCounts(client, base);
  return {
    mode: "check", readOnly: true, writesExecuted: false,
    gates, backup: { archiveSha256: inputs.archive.sha256, archiveSizeBytes: inputs.archive.sizeBytes,
      snapshot: relative(ROOT, resolve(inputs.backupDirectory, "source-snapshot.json")) },
    preservation: { ...evidenceSummary(current), ...sequenceSummary(inputs.sequences, currentSequences, false) },
    relationList: { schema: SOURCE_SCHEMA, count: currentRelations.length, matchedSnapshot: true },
    productTriggerScan: { noninternalProductTriggers: productTriggerCount, noProductWriterTriggers: true },
    approvedSkus: APPROVED, protectedSkus: PROTECTED,
  };
}

async function apply(client: pg.Client, inputs: Awaited<ReturnType<typeof loadInputs>>): Promise<Row> {
  let commitAttempted = false;
  let transactionOpen = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '180s'");
    await assertIdentityAndConnectionGuard(client, snapshotServerVersion(inputs));
    await assertRequiredColumns(client);
    const currentRelations = await captureRelations(client);
    assertRelationsEqual(currentRelations, inputs.relations, "pre-lock fresh backup comparison");
    for (const table of currentRelations.map((entry) => entry.table)) {
      await client.query(`LOCK TABLE ${tableRef(table)} IN SHARE ROW EXCLUSIVE MODE`);
    }
    const productTriggerCount = await assertNoProductWriterTriggers(client);
    const lockedRelations = await captureRelations(client);
    assertRelationsEqual(lockedRelations, inputs.relations, "locked fresh backup comparison");
    const beforeEvidence = await captureEvidence(client, lockedRelations.map((entry) => entry.table));
    assertEvidenceEqual(beforeEvidence, inputs.backupEvidence, "locked fresh backup comparison");
    const beforeSequences = await sequenceState(client);
    assertSequencesEqual(beforeSequences, inputs.sequences, "locked fresh backup comparison");
    const beforeBase = await baseProducts(client);
    const beforeGates = await gateCounts(client, beforeBase);
    const beforeNonApproved = await productHash(client, false);
    const beforeOldAudit = await oldAuditHash(client);
    const approvalAtWrite = await fs.readFile(APPROVAL_PATH, "utf8");
    assert.deepEqual([...new Set(approvalAtWrite.match(/\b[A-Z0-9]+-BAS2?\b/g) ?? [])].sort(),
      [...ALL_BASE_SKUS].sort(), "owner approval changed before write");

    const beforeBySku = new Map(beforeBase.map((item) => [item.sku, item]));
    const update = await rows(client, `UPDATE public.productos
      SET activo = false
      WHERE sku = ANY($1::text[]) AND activo
      RETURNING id::text AS id, sku, to_jsonb(productos) AS row`, [[...APPROVED]]);
    assert.equal(update.length, 12, "exactly 12 approved active products must be updated");
    assert.deepEqual(update.map((item) => String(item.sku)).sort(), [...APPROVED].sort(),
      "UPDATE returned a SKU outside the approved set");
    const newAuditIds: string[] = [];
    for (const changed of update) {
      const before = beforeBySku.get(String(changed.sku));
      assert(before, "updated product had no approved preimage");
      assert.equal(stable(productWithoutActivo(before.row)), stable(productWithoutActivo(changed.row as Row)),
        "a product field other than activo changed");
      assert.equal((changed.row as Row).activo, false, "updated product is not inactive");
      const audit = await one(client, `INSERT INTO public.auditoria
        (usuario_id, usuario_snapshot, rol_snapshot, modulo, accion, entidad, entidad_id,
         datos_antes, datos_despues, ip)
        VALUES (NULL, 'AUTOMATIZACION AUTORIZADA POR PROPIETARIO', NULL, 'productos',
          'ACTUALIZAR', 'productos', $1, $2::jsonb, $3::jsonb, 'LOCAL-OPERATOR')
        RETURNING id::text AS id, usuario_id, usuario_snapshot, rol_snapshot, modulo, accion,
          entidad, entidad_id, datos_antes, datos_despues, ip`,
        [changed.id, JSON.stringify(before.row), JSON.stringify(changed.row)]);
      assert.equal(audit.usuario_id, null, "audit actor must remain NULL");
      assert.equal(audit.usuario_snapshot, "AUTOMATIZACION AUTORIZADA POR PROPIETARIO");
      assert.equal(audit.rol_snapshot, null);
      assert.equal(audit.modulo, "productos");
      assert.equal(audit.accion, "ACTUALIZAR");
      assert.equal(audit.entidad, "productos");
      assert.equal(String(audit.entidad_id), changed.id);
      assert.equal(audit.ip, "LOCAL-OPERATOR");
      assert.equal(stable(audit.datos_antes), stable(before.row), "audit before JSON mismatch");
      assert.equal(stable(audit.datos_despues), stable(changed.row), "audit after JSON mismatch");
      newAuditIds.push(String(audit.id));
    }
    assert.equal(new Set(newAuditIds).size, 12, "audit IDs must be unique");

    const afterEvidence = await captureEvidence(client, inputs.tables);
    const beforeAuditCount = Number(beforeEvidence.find((entry) => entry.table === "auditoria")?.count);
    const afterAuditCount = Number(afterEvidence.find((entry) => entry.table === "auditoria")?.count);
    assert.equal(afterAuditCount, beforeAuditCount + 12, "there must be precisely 12 new audit rows");
    for (const item of inputs.tables) {
      if (item === "productos" || item === "auditoria") continue;
      assert.equal(stable(afterEvidence.find((entry) => entry.table === item)),
        stable(beforeEvidence.find((entry) => entry.table === item)), `unexpected table change: ${item}`);
    }
    const afterNonApproved = await productHash(client, false);
    assert.equal(stable(afterNonApproved), stable(beforeNonApproved), "non-approved product changed");
    const afterBase = await baseProducts(client);
    assert.equal(afterBase.length, 16, "Base product count changed");
    assert.deepEqual(afterBase.map((item) => item.sku).sort(), [...ALL_BASE_SKUS].sort(), "Base SKU set changed");
    for (const item of afterBase) {
      if ((APPROVED as readonly string[]).includes(item.sku)) assert.equal(item.activo, false);
      else assert.equal(item.activo, true, `protected SKU is not active: ${item.sku}`);
      const prior = beforeBySku.get(item.sku)!;
      assert.equal(stable(productWithoutActivo(item.row)), stable(productWithoutActivo(prior.row)),
        `non-activo product field changed: ${item.sku}`);
    }
    const afterCounts = await one(client, `SELECT
      (SELECT count(*)::int FROM public.productos WHERE activo) AS active_products,
      (SELECT count(DISTINCT producto_id)::int FROM public.precio_historial) AS history_distinct_products,
      (SELECT count(*)::int FROM public.precio_historial) AS history_rows`);
    assert.equal(Number(afterCounts.active_products), 1222, "post-write active product count must be 1222");
    assert.equal(Number(afterCounts.history_distinct_products), 1010, "history distinct count changed");
    assert.equal(Number(afterCounts.history_rows), 1016, "history row count changed");
    const inactiveBase = afterBase.filter((item) => !item.activo).map((item) => item.sku).sort();
    assert.deepEqual(inactiveBase, [...APPROVED].sort(), "only approved Base products may be inactive");
    const afterOldAudit = await oldAuditHash(client, newAuditIds);
    assert.equal(stable(afterOldAudit), stable(beforeOldAudit), "pre-existing audit rows changed");
    const afterSequences = await sequenceState(client);
    const sequenceFacts = sequenceSummary(beforeSequences, afterSequences, true);
    const preCommitValidationAtUtc = await one(client, "SELECT clock_timestamp() AS timestamp");
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    return {
      mode: "apply", committed: true,
      preCommitValidationAtUtc: preCommitValidationAtUtc.timestamp,
      commitAcknowledgedAtUtc: new Date().toISOString(),
      newAuditIds, checkedSkus: APPROVED, approvedSkus: APPROVED, protectedSkus: PROTECTED,
      beforeGates, afterGates: {
        activeProducts: Number(afterCounts.active_products), baseProducts: afterBase.length,
        inactiveBaseSkus: inactiveBase, historyDistinctProducts: Number(afterCounts.history_distinct_products),
        historyRows: Number(afterCounts.history_rows),
      },
      wholeHashChecks: {
        allNonProductNonAuditTablesUnchanged: true, nonApprovedProductsUnchanged: true,
        oldAuditRowsUnchanged: true, precioHistorialUnchanged: true,
        productUpdatedAtUnchanged: true,
      },
      productTriggerScan: { noninternalProductTriggers: productTriggerCount, noProductWriterTriggers: true },
      sequenceFacts,
    };
  } catch (error) {
    if (transactionOpen && !commitAttempted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        throw new Error("ROLLBACK acknowledgement indeterminate; do not retry");
      }
      throw new Error(`transaction rolled back: ${redact(error)}`);
    }
    if (commitAttempted) {
      const indeterminate = new Error(`COMMIT acknowledgement indeterminate; do not retry: ${redact(error)}`) as
        Error & { commitAcknowledgementIndeterminate?: true };
      indeterminate.commitAcknowledgementIndeterminate = true;
      throw indeterminate;
    }
    throw error;
  }
}

function parseMode(): "check" | "apply" | "rehearse" {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--check")) return "check";
  if (args.length === 1 && args[0] === "--apply") return "apply";
  if (args.length === 1 && args[0] === "--rehearse") return "rehearse";
  throw new Error("use --check (or no argument), --rehearse, or explicit --apply; modes cannot be combined");
}

async function main(): Promise<void> {
  const mode = parseMode();
  let preserveExistingApplyReceipt = false;
  let result: Row = {
    operation: "BASE_CATALOG_APPROVED_OPERATOR", mode, status: "RUNNING",
    sourceDatabase: SOURCE_DATABASE, sourceSchema: SOURCE_SCHEMA, approvedSkus: APPROVED,
    protectedSkus: PROTECTED, noApiStartup: true, noDbModuleInitializers: true,
  };
  try {
    if (mode !== "rehearse") {
      assert(process.env.DATABASE_URL, "DATABASE_URL is required");
      const parsed = new URL(process.env.DATABASE_URL);
      assert(["postgres:", "postgresql:"].includes(parsed.protocol), "DATABASE_URL must be PostgreSQL");
      assert.equal(decodeURIComponent(parsed.pathname.replace(/^\/+/, "")), SOURCE_DATABASE,
        "DATABASE_URL must target heliumdb");
    }
    if (mode === "apply") {
      let priorReceiptExists = true;
      try {
        await fs.access(RESULT_PATH);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") priorReceiptExists = false;
        else throw error;
      }
      if (priorReceiptExists) {
        preserveExistingApplyReceipt = true;
        throw new Error("a prior apply result receipt exists; automatic or repeated apply is forbidden");
      }
    }
    const inputs = await loadInputs();
    const restore = inputs.restore.restore as Row | undefined;
    const restoreSocket = restore?.socketDirectory;
    if (mode === "rehearse") {
      assert.equal(restore?.unixSocketOnlyVerified, true,
        "restore metadata does not verify Unix-socket-only local cluster");
      assert(typeof restoreSocket === "string" &&
        restoreSocket.startsWith("/tmp/prompt-h-block2-"),
      "restore metadata does not contain the expected private local socket");
    }
    const client = mode === "rehearse"
      ? new pg.Client({
        host: String(restoreSocket),
        user: "postgres",
        database: SOURCE_DATABASE,
      })
      : new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      // This session setting precedes either transaction and matches the
      // backup's UTC evidence convention without changing database data.
      await client.query("SET TIME ZONE 'UTC'");
      if (mode === "check") {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        result = { ...result, ...(await check(client, inputs)), status: "PASS_READ_ONLY" };
        await client.query("COMMIT");
        await writeEvidence(CHECK_PATH, result);
      } else if (mode === "rehearse") {
        await assertLocalRestoreIdentity(client);
        result = {
          ...result,
          ...(await apply(client, inputs)),
          mode: "rehearse",
          status: "REHEARSAL_COMMITTED_LOCAL_CLONE",
          sourceUntouched: true,
          connection: "verified local restore Unix socket",
        };
        await writeEvidence(REHEARSAL_PATH, result);
      } else {
        result = { ...result, ...(await apply(client, inputs)), status: "COMMITTED" };
        await writeEvidence(RESULT_PATH, result);
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (error) {
    const commitIndeterminate = (error as Error & {
      commitAcknowledgementIndeterminate?: boolean;
    }).commitAcknowledgementIndeterminate === true;
    // A completed COMMIT followed by receipt-I/O failure, or any existing
    // apply receipt, must never be overwritten with a false rollback claim.
    if ((mode === "apply" && preserveExistingApplyReceipt) || result.committed === true) throw error;
    result = {
      ...result,
      status: commitIndeterminate
        ? "COMMIT_STATUS_INDETERMINATE_NO_RETRY"
        : String(redact(error)).includes("ROLLBACK acknowledgement indeterminate")
          ? "ROLLBACK_STATUS_INDETERMINATE_NO_RETRY" : "FAIL_STOPPED",
      committed: commitIndeterminate ? null : false,
      error: redact(error),
      retry: "FORBIDDEN_AUTOMATICALLY",
      sequenceRollbackCaveat: "nextval is non-transactional; a failed pre-COMMIT attempt can consume audit sequence values",
    };
    await writeEvidence(mode === "check" ? CHECK_PATH : mode === "rehearse" ? REHEARSAL_PATH : RESULT_PATH, result);
    throw error;
  }
}

const invokedDirectly = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  await main().catch((error: unknown) => {
    console.error(`Base catalogue operator stopped: ${redact(error)}`);
    process.exitCode = 2;
  });
}