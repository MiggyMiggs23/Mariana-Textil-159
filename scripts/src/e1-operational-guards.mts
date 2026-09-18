/**
 * Inert on import; --review is file-only. Parent alone executes this operator.
 * Snapshots are READ ONLY. Installation is one-shot, additive, exact-source,
 * externally supervised, and resolved through fresh READ ONLY verification.
 * No original migration/clone/app imports or removal/reinstall paths.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, readlink } from "node:fs/promises";
import { fork, type ChildProcess } from "node:child_process";
import { performance } from "node:perf_hooks";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runOperationalGuardChecks, OPERATIONAL_GUARD_CHECK_COUNT } from "./e1-operational-guard-probes.mts";
import {
  collectStartupEffects, compareStartupEffects, STARTUP_EFFECTS_SQL, STARTUP_EFFECTS_CONTEXT_SQL,
  STARTUP_EFFECTS_SQL_SHA256, type StartupOutcome,
} from "./e1-startup-effects.mts";

type Row = Record<string, any>;
type Queryable = { query: (...args: any[]) => Promise<any> };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "reports/e1-guardas-operativa-2026-09-18");
const AUTHORITATIVE = "reports/e1-ejecucion-2026-09-17/ejecucion-after-name-array.json";
const MIGRATED = "reports/e1-ensayo-2026-09-17/migrated.json";
const REHEARSED = "reports/e1-guardas-temporales-2026-09-18/resultado-medido.json";
const APPLICATION_REHEARSAL = "reports/e1-ejecucion-2026-09-17/verificacion-aislada-resultados.json";
const INVENTORY = "reports/e1-guardas-operativa-2026-09-18/inventario-e1-referencia.json";
const AUTHORIZATION = "reports/e1-guardas-operativa-2026-09-18/autorizacion-ventana-e-instalacion.md";
const SELF = fileURLToPath(import.meta.url);
const WINDOW_FILES = [
  ".local/e1-identity-window.mjs", ".local/e1-identity-window-preload.cjs",
  "artifacts/api-server/dist/index.mjs", "artifacts/api-server/dist/index.mjs.map",
  "artifacts/api-server/build.mjs", ".local/e1-startup-evidence-review.md",
];
const INSTALL_FILES = [
  "reports/e1-guardas-temporales-2026-09-18/sql/01-install-cash.sql",
  "reports/e1-guardas-temporales-2026-09-18/sql/02-install-pending.sql",
  "reports/e1-guardas-temporales-2026-09-18/sql/03-install-attribution.sql",
];
const GUARD_FUNCTIONS = [
  "e1_guard_cash_capture_closed", "e1_guard_pending_receipts_closed", "e1_guard_historical_attribution_closed",
];
const GUARD_TRIGGERS = [
  "zz_e1_cash_capture_closed", "zz_e1_pending_receipts_closed", "zz_e1_historical_attribution_closed",
];
const LEDGER_COLUMNS = [
  "sitio_origen_id", "sesion_caja_id", "naturaleza", "operacion_productor",
  "operacion_clave", "nota_origen_id", "origen_justificacion",
];
const IDENTITY_FIELDS = [
  "database_name", "database_oid", "database_role", "schema_name", "server_version",
  "server_address", "server_port", "server_started_at", "unix_socket_directories",
  "data_directory", "configured_port", "listen_addresses", "search_schemas",
] as const;
const userSchema = (alias: string) => `${alias}.nspname NOT IN ('pg_catalog','information_schema')
  AND ${alias}.nspname !~ '^pg_(toast|temp)'`;
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const digest = (v: unknown) => sha256(canonical(v));
// The successful migration used order-insensitive array canonicalization.
function referenceCanonical(v: any): string {
  if (Array.isArray(v)) return `[${v.map(referenceCanonical).sort().join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${referenceCanonical(x)}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
const same = (a: unknown, b: unknown) => assert.equal(referenceCanonical(a), referenceCanonical(b));
const fileHash = async (path: string) => sha256(await readFile(path));
const summary = (rows: Row[]) => ({ count: rows.length, sha256: digest(rows), rows });
function safeError(error: any) {
  // PostgreSQL messages/detail/context/parameters and connection strings never
  // enter reports. Stage and SQLSTATE are sufficient to identify the failure.
  return {
    code: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : null,
    message: "Operation failed; consult recorded stage and explicit transaction outcome. Database messages and parameters suppressed.",
  };
}
async function jsonFile(path: string): Promise<Row> {
  return JSON.parse(await readFile(path, "utf8"));
}
async function optionalJson(path: string): Promise<Row | null> {
  try { return await jsonFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

/** Fields parent must capture from the ACTUAL API pool, not environment parsing. */
export const OPERATIONAL_IDENTITY_SQL = `SELECT current_database() AS database_name,
  (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
  current_user AS database_role, current_schema() AS schema_name,
  current_setting('server_version') AS server_version,
  inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
  pg_postmaster_start_time()::text AS server_started_at,
  current_setting('unix_socket_directories') AS unix_socket_directories,
  current_setting('data_directory') AS data_directory,
  current_setting('port') AS configured_port,
  current_setting('listen_addresses') AS listen_addresses,
  to_json(current_schemas(false)) AS search_schemas,
  current_setting('session_replication_role') AS replication_role,
  current_setting('transaction_read_only') AS transaction_read_only,
  pg_backend_pid() AS backend_pid`;

/** READ ONLY snapshot identity binding; this does not grant permission to write. */
export async function assertOperationalIdentity(client: Queryable, expected: Row) {
  const actual = (await client.query(OPERATIONAL_IDENTITY_SQL)).rows[0];
  assert.equal(expected.database_name, "heliumdb");
  assert.equal(expected.schema_name, "public");
  assert.equal(actual.replication_role, "origin");
  for (const key of IDENTITY_FIELDS) {
    assert.ok(Object.hasOwn(expected, key), `Missing API identity field: ${key}`);
    assert.deepEqual(actual[key], expected[key], `API identity mismatch: ${key}`);
  }
  return actual;
}

async function catalogue(client: Queryable) {
  const query = async (sql: string, params: unknown[] = []): Promise<Row[]> => (await client.query(sql, params)).rows;
  const tables = await query(`SELECT n.nspname AS schema,c.relname AS table,c.relkind::text AS relkind,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','f') AND ${userSchema("n")} ORDER BY n.nspname,c.relname`);
  // Foreign tables would make the read-only guarantee depend on an external FDW.
  assert.ok(tables.every((t) => t.relkind !== "f"), "Foreign tables require separate review");
  const tableEvidence: Row[] = [];
  for (const table of tables) {
    const aggregate = (await query(`WITH canonical_rows AS (
      SELECT to_jsonb(t)::text AS canonical FROM ${quote(table.schema)}.${quote(table.table)} t)
      SELECT count(*)::text AS count,
      md5(COALESCE(string_agg(md5(canonical),'' ORDER BY canonical,md5(canonical)),'')) AS "orderedCanonicalRowHash"
      FROM canonical_rows`))[0];
    tableEvidence.push({ schema: table.schema, table: table.table, relkind: table.relkind, ...aggregate });
  }
  const columns = await query(`SELECT n.nspname AS schema,c.relname AS table,a.attname AS column,
    a.attnum AS ordinal_position,format_type(a.atttypid,a.atttypmod) AS data_type,
    a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    NULLIF(a.attidentity,'') AS identity_kind,NULLIF(a.attgenerated,'') AS generated_kind
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','f') AND ${userSchema("n")}
    ORDER BY n.nspname,c.relname,a.attnum`);
  const constraints = await query(`SELECT n.nspname AS schema,c.relname AS table,k.conname AS name,
    k.contype::text AS kind,pg_get_constraintdef(k.oid,true) AS definition,k.convalidated AS validated,
    k.condeferrable AS deferrable,k.condeferred AS initially_deferred
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,k.conname`);
  const indexes = await query(`SELECT n.nspname AS schema,c.relname AS table,i.relname AS name,
    pg_get_indexdef(i.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready,x.indislive AS live
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,i.relname`);
  const functions = await query(`SELECT n.nspname AS schema,p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,pg_get_functiondef(p.oid) AS definition,
    p.prokind::text AS kind,p.proacl::text AS acl,pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prokind IN ('f','p') AND ${userSchema("n")}
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`);
  const triggers = await query(`SELECT n.nspname AS schema,c.relname AS table,t.tgname AS name,
    CASE WHEN t.tgname=ANY($1::text[]) THEN pg_get_triggerdef(t.oid)
      ELSE pg_get_triggerdef(t.oid,true) END AS definition,t.tgenabled::text AS enabled,t.tgtype::int AS type,
    pn.nspname AS function_schema,p.proname AS function_name,t.tgisinternal AS internal
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,t.tgname`, [GUARD_TRIGGERS]);
  const eventTriggers = await query(`SELECT evtname AS name,evtevent AS event,evtenabled::text AS enabled,
    evttags AS tags,pg_get_userbyid(evtowner) AS owner,pg_get_functiondef(evtfoid) AS function_definition
    FROM pg_event_trigger ORDER BY evtname`);
  const relations = await query(`SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl,
    CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END AS view_definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname`);
  const types = await query(`SELECT n.nspname AS schema,t.typname AS name,t.typtype::text AS kind,
    t.typacl::text AS acl,pg_get_userbyid(t.typowner) AS owner,
    CASE WHEN t.typelem<>0 THEN format_type(t.typelem,NULL) END AS element_type,
    CASE WHEN t.typbasetype<>0 THEN format_type(t.typbasetype,t.typtypmod) END AS base_type,
    t.typnotnull AS not_null,t.typdefault AS default_expression,
    (SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid) AS enum_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,t.typname`);
  const sequences = await query(`SELECT schemaname AS schema,sequencename AS name,data_type,
    start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text
    FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema')
    AND schemaname !~ '^pg_(toast|temp)' ORDER BY schemaname,sequencename`);
  const sequenceValues: Row[] = [];
  for (const sequence of sequences) {
    const [values] = await query(`SELECT last_value::text,log_cnt::text,is_called
      FROM ${quote(sequence.schema)}.${quote(sequence.name)}`);
    sequenceValues.push({ schema: sequence.schema, name: sequence.name, ...values });
  }
  const sequenceOwnership = await query(`SELECT sn.nspname AS schema,s.relname AS name,
    tn.nspname AS table_schema,t.relname AS table,a.attname AS column,d.deptype::text AS dependency_type
    FROM pg_class s JOIN pg_namespace sn ON sn.oid=s.relnamespace
    JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
      AND d.refclassid='pg_class'::regclass AND d.refobjsubid>0 AND d.deptype IN ('a','i')
    JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
    WHERE s.relkind='S' AND ${userSchema("sn")} ORDER BY sn.nspname,s.relname,tn.nspname,t.relname,a.attname`);
  const history = await query(`SELECT id::text AS id,md5(to_jsonb(m)::text) AS "fullRowMd5"
    FROM public.movimientos_credito m WHERE ${LEDGER_COLUMNS.map((c) => `${quote(c)} IS NULL`).join(" AND ")}
    ORDER BY id`);
  const purchaseRows = await query(`SELECT md5(id::text) AS "identityHash",md5(to_jsonb(p)::text) AS "fullRowMd5"
    FROM public.pagos_proveedor p WHERE tipo::text='COMPRA' ORDER BY id`);
  // Only IDs and hashes are returned. No application rows, names, amounts,
  // account identifiers or other row content is materialized in this process.
  const e1 = (rows: Row[]) => rows.filter((r) => r.schema === "public" && String(r.name).endsWith("_e1"));
  const e1Inventory = {
    relations: summary(e1(relations)), functions: summary(e1(functions)), types: summary(e1(types)),
    triggers: summary(e1(triggers)), constraints: summary(e1(constraints)),
    ledgerColumns: summary(columns.filter((r) => r.schema === "public" && r.table === "movimientos_credito" && LEDGER_COLUMNS.includes(r.column))),
  };
  const permanentFunctions = functions.filter((r) => !GUARD_FUNCTIONS.includes(r.name));
  const permanentTriggers = triggers.filter((r) => !r.internal && !GUARD_TRIGGERS.includes(r.name));
  const guardFunctions = functions.filter((r) => GUARD_FUNCTIONS.includes(r.name) || /^e1_guard_/.test(r.name));
  const guardTriggers = triggers.filter((r) => GUARD_TRIGGERS.includes(r.name) || /^zz_e1_/.test(r.name));
  return {
    tables: summary(tables), tableEvidence: summary(tableEvidence), columns: summary(columns),
    constraints: summary(constraints), indexes: summary(indexes), functions: summary(functions),
    triggers: summary(triggers), eventTriggers: summary(eventTriggers),
    active_event_triggers: eventTriggers.filter((r) => r.enabled !== "D").length,
    relations: summary(relations), types: summary(types),
    sequences: summary(sequences), sequenceValues: summary(sequenceValues), sequenceOwnership: summary(sequenceOwnership),
    historical: summary(history), e1Inventory,
    startupEvidence: {
      purchaseLedgerCompra: summary(purchaseRows),
      permissionsNotificationsStock: summary(tableEvidence.filter((r) => /^(permisos_|notificaciones_|stock_minimo)/.test(r.table))),
    },
    permanentDefinitions: {
      functions: summary(permanentFunctions), triggers: summary(permanentTriggers),
      sha256: digest({ functions: permanentFunctions, triggers: permanentTriggers }),
    },
    temporaryGuards: { functions: summary(guardFunctions), triggers: summary(guardTriggers) },
  };
}

async function references() {
  const migrated = await jsonFile(resolve(ROOT, MIGRATED));
  const prior = await jsonFile(resolve(ROOT, AUTHORITATIVE));
  const inventory = await jsonFile(resolve(ROOT, INVENTORY));
  const rehearsed = await jsonFile(resolve(ROOT, REHEARSED));
  const applicationRehearsal = await jsonFile(resolve(ROOT, APPLICATION_REHEARSAL));
  assert.equal(prior.status, "PASS");
  assert.equal(prior.commitOutcome, "COMMITTED_VERIFIED");
  assert.equal(rehearsed.status, "PASS");
  assert.equal(await fileHash(resolve(ROOT, MIGRATED)), inventory.reference.sha256);
  assert.equal(await fileHash(resolve(ROOT, AUTHORITATIVE)),
    inventory.supportingReferences.find((r: Row) => r.path === AUTHORITATIVE).sha256);
  for (const category of ["tables", "indexes", "functions", "triggers", "constraints", "views", "types"]) {
    const rows = migrated.catalogue[category] ?? migrated.supplemental[category];
    const comparison = prior.expectedAfterComparison.categories[category];
    assert.equal(comparison.status, "PASS");
    assert.equal(sha256(referenceCanonical(rows)), comparison.expectedSha256);
    assert.equal(comparison.observedSha256, comparison.expectedSha256);
  }
  assert.equal(inventory.objects.length, 60);
  assert.equal(inventory.counts.total, 60);
  for (const path of INSTALL_FILES) {
    const approved = rehearsed.source.files.find((r: Row) => r.path === path);
    assert.ok(approved, "Missing tested install source");
    assert.equal(await fileHash(resolve(ROOT, path)), approved.sha256);
  }
  return { migrated, prior, inventory, rehearsed, applicationRehearsal };
}

/** Match real catalog identities and every saved definition, not SQL block count. */
function assertReference(snapshot: Row, reference: Awaited<ReturnType<typeof references>>, guardsPresent = false) {
  assert.equal(snapshot.active_event_triggers, 0, "Active event triggers prohibited");
  const m = reference.migrated, c = m.catalogue;
  const project = (rows: Row[], keys: string[]) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));
  same(snapshot.tables.rows, c.tables);
  // Startup may have explicitly reviewed permissions/notification/episode
  // effects. Catalog reference comparison must not pretend those rows are DDL
  // changes. Permanent E1 and historical ledger data remain unchanged.
  const e1Data = (rows: Row[]) => rows.filter((r) => r.schema === "public"
    && (r.table === "movimientos_credito" || ["operaciones_credito_e1", "cobros_credito_pendientes_e1", "atribuciones_credito_e1"].includes(r.table)));
  same(e1Data(snapshot.tableEvidence.rows), e1Data(c.tableEvidence));
  const columnKeys = ["schema", "table", "column", "data_type", "not_null", "default_expression", "identity_kind", "generated_kind"];
  same(project(snapshot.columns.rows, columnKeys), project(c.columns, columnKeys));
  const fkinds: Row = { CHECK: "c", "FOREIGN KEY": "f", "PRIMARY KEY": "p", UNIQUE: "u", EXCLUSION: "x" };
  same(snapshot.constraints.rows, c.constraints.map((r: Row) => ({
    ...Object.fromEntries(["schema", "table", "name", "definition", "validated", "deferrable", "initially_deferred"].map((k) => [k, r[k]])),
    kind: fkinds[r.constraint_type],
  })));
  same(snapshot.indexes.rows, c.indexes.map((r: Row) => ({
    schema: r.schema, table: r.table, name: r.index_name, definition: r.definition,
    valid: r.is_valid, ready: r.is_ready, live: r.is_live,
  })));
  const fkeys = ["schema", "name", "identity_arguments", "definition", "kind", "acl", "owner"];
  same(snapshot.permanentDefinitions.functions.rows, project(c.functions, fkeys));
  const triggers = c.triggers.map((r: Row) => ({
    schema: r.schema, table: r.table, name: r.trigger_name, definition: r.definition,
    enabled: r.enabled, function_schema: r.function_schema, function_name: r.function_name,
  }));
  same(project(snapshot.permanentDefinitions.triggers.rows, Object.keys(triggers[0])), triggers);
  const typeKeys = ["schema", "name", "kind", "acl", "owner", "element_type", "base_type", "not_null", "default_expression"];
  same(snapshot.types.rows, m.supplemental.types.map((r: Row) => ({
    ...Object.fromEntries(typeKeys.map((k) => [k, r[k]])), enum_labels: r.enum_labels === null ? null : r.enum_labels.split(","),
  })));
  for (const type of m.supplemental.types) {
    const actual = snapshot.types.rows.find((r: Row) => r.schema === type.schema && r.name === type.name);
    // Unlike catalog object sets, enum label ordering is semantic.
    assert.equal(canonical(actual.enum_labels), canonical(type.enum_labels === null ? null : type.enum_labels.split(",")));
  }
  same(snapshot.relations.rows.filter((r: Row) => ["v", "m"].includes(r.kind)).map((r: Row) => ({
    schema: r.schema, name: r.name, kind: r.kind, owner: r.owner, acl: r.acl, definition: r.view_definition,
  })), m.supplemental.views);
  same(snapshot.sequences.rows, c.sequences.map((r: Row) => {
    const { sequence_name, ...rest } = r; return { ...rest, name: sequence_name };
  }));
  const actualObjects = Object.entries(snapshot.e1Inventory).filter(([k]) => k !== "ledgerColumns")
    .flatMap(([family, value]) => (value as Row).rows.map((r: Row) => ({
      family, schema: r.schema, name: r.name,
      ...(["constraints", "triggers"].includes(family) ? { table: r.table } : {}),
      ...(family === "functions" ? { identity_arguments: r.identity_arguments } : {}),
    })));
  const expectedObjects = reference.inventory.objects.map((r: Row) => ({
    family: r.family, schema: r.schema, name: r.name,
    ...(["constraints", "triggers"].includes(r.family) ? { table: r.table } : {}),
    ...(r.family === "functions" ? { identity_arguments: r.identity_arguments } : {}),
  }));
  assert.equal(actualObjects.length, 60);
  same(actualObjects, expectedObjects);
  assert.equal(snapshot.historical.count, 3);
  assert.equal(snapshot.e1Inventory.ledgerColumns.count, 7);
  assert.equal(snapshot.tableEvidence.count, 66);
  assert.equal(snapshot.sequenceValues.count, 47);
  if (!guardsPresent) {
    assert.equal(snapshot.temporaryGuards.functions.count, 0);
    assert.equal(snapshot.temporaryGuards.triggers.count, 0);
  } else {
    const guard = reference.rehearsed.finalGuardState;
    assert.equal(snapshot.temporaryGuards.functions.count, 3);
    assert.equal(snapshot.temporaryGuards.triggers.count, 3);
    same(snapshot.temporaryGuards.functions.rows.map((r: Row) => ({ proname: r.name, definition: r.definition })), guard.functions);
    same(snapshot.temporaryGuards.triggers.rows.map((r: Row) => ({
      relname: r.table, tgname: r.name, tgenabled: r.enabled, tgtype: r.type,
      proname: r.function_name, definition: r.definition,
    })), guard.triggers);
    assert.ok(snapshot.temporaryGuards.functions.rows.every((r: Row) => r.schema === "public" && r.identity_arguments === ""));
    assert.ok(snapshot.temporaryGuards.triggers.rows.every((r: Row) => r.schema === "public" && r.function_schema === "public"));
  }
}

function preserved(before: Row, after: Row) {
  // Compare the full baseline after removing exactly the six permitted additions.
  const strip = (snapshot: Row) => {
    const result = structuredClone(snapshot);
    result.functions = summary(result.functions.rows.filter((r: Row) => !GUARD_FUNCTIONS.includes(r.name)));
    result.triggers = summary(result.triggers.rows.filter((r: Row) => !GUARD_TRIGGERS.includes(r.name)));
    result.temporaryGuards = { functions: summary([]), triggers: summary([]) };
    return result;
  };
  same(strip(before), strip(after));
}

const STARTUP_MUTABLE_TABLES = [
  "permisos_rol", "permisos_usuario", "permisos_ubicacion",
  "stock_minimo_episodios", "notificaciones_sistema",
] as const;

/**
 * Pure, file-data-only helper for the parent to construct the exact approval.
 * Never approves by itself. It throws for financial/catalog/unscoped changes.
 */
export function computeStartupApprovalDiff(before: Row, after: Row, outcome: StartupOutcome) {
  const effects = compareStartupEffects(before.startupEffects, after.startupEffects, outcome);
  assert.equal(effects.backfill.insertedCount, 0);
  assert.equal(effects.ledgerUnchanged, true);
  assert.equal(effects.existingLedgerUnchanged, true);
  assert.equal(effects.financialTablesUnchanged, true);
  assert.equal(effects.stopReasons.length, 0);
  const allowed = new Set<string>(STARTUP_MUTABLE_TABLES);
  // No ordinary notification may be relabelled a stock startup effect.
  const notificationChanges = effects.tables.notificaciones_sistema;
  assert.ok(notificationChanges.added.every((r) => r.classification.stockNotification === true));
  assert.ok(notificationChanges.deleted.every((r) => r.classification.stockNotification === true));
  assert.ok(notificationChanges.updated.every((r) =>
    r.beforeClassification.stockNotification === true && r.afterClassification.stockNotification === true));
  same(before.snapshot.sequenceOwnership, after.snapshot.sequenceOwnership);
  const ownedAllowed = new Set<string>(before.snapshot.sequenceOwnership.rows
    .filter((r: Row) => r.table_schema === "public" && allowed.has(r.table))
    .map((r: Row) => `${r.schema}.${r.name}`));
  const sequenceDeltas: Row[] = [];
  const afterSequences = new Map<string, Row>(after.snapshot.sequenceValues.rows.map((r: Row) => [`${r.schema}.${r.name}`, r]));
  for (const old of before.snapshot.sequenceValues.rows) {
    const key = `${old.schema}.${old.name}`, current = afterSequences.get(key);
    assert.ok(current, "Sequence disappeared during startup");
    if (canonical(old) !== canonical(current)) {
      assert.ok(ownedAllowed.has(key), "Unapproved startup sequence family changed");
      assert.ok(BigInt(current.last_value) >= BigInt(old.last_value), "Startup sequence moved backwards");
      assert.ok(old.is_called !== true || current.is_called === true, "Startup sequence reset is_called");
      assert.ok(BigInt(current.log_cnt) >= 0n);
      sequenceDeltas.push({ schema: old.schema, name: old.name, before: old, after: current });
    }
  }
  assert.equal(before.snapshot.sequenceValues.count, after.snapshot.sequenceValues.count);
  const immutable = (snapshot: Row) => {
    const result = structuredClone(snapshot);
    result.tableEvidence = summary(result.tableEvidence.rows.filter((r: Row) => !(r.schema === "public" && allowed.has(r.table))));
    result.sequenceValues = summary(result.sequenceValues.rows.filter((r: Row) => !ownedAllowed.has(`${r.schema}.${r.name}`)));
    result.startupEvidence.permissionsNotificationsStock = summary(result.startupEvidence.permissionsNotificationsStock.rows
      .filter((r: Row) => !(r.schema === "public" && allowed.has(r.table))));
    return result;
  };
  // All catalog, seven columns, permanent E1, history and every other table
  // (not merely the four selected financial tables) must remain exact.
  same(immutable(before.snapshot), immutable(after.snapshot));
  const tableDeltas: Row[] = [];
  for (const old of before.snapshot.tableEvidence.rows) {
    const current = after.snapshot.tableEvidence.rows.find((r: Row) => r.schema === old.schema && r.table === old.table);
    assert.ok(current);
    if (canonical(old) !== canonical(current)) {
      assert.ok(old.schema === "public" && allowed.has(old.table));
      const detailed = (effects.tables as Row)[old.table];
      assert.ok(detailed && detailed.counts.added + detailed.counts.deleted + detailed.counts.updated > 0);
      tableDeltas.push({ schema: old.schema, table: old.table, before: old, after: current, detailed });
    }
  }
  return {
    version: 1, effects, tableDeltas, sequenceDeltas,
    immutableBeforeSha256: digest(immutable(before.snapshot)), immutableAfterSha256: digest(immutable(after.snapshot)),
    allowedTableFamilies: STARTUP_MUTABLE_TABLES, approval: "PARENT_REVIEW_REQUIRED",
  };
}

async function preparation() {
  assert.equal(OPERATIONAL_GUARD_CHECK_COUNT, 15);
  const reference = await references();
  const packages = ["artifacts/api-server/package.json", "lib/db/package.json", "lib/api-zod/package.json"];
  const sourceFiles = reference.applicationRehearsal.source.files.filter((r: Row) =>
    ["artifacts/api-server/src/", "lib/db/src/", "lib/api-zod/src/"].some((p) => r.path.startsWith(p)) || packages.includes(r.path));
  assert.equal(sourceFiles.length, 1170, "Incomplete saved application source manifest");
  for (const entry of sourceFiles) assert.equal(await fileHash(resolve(ROOT, entry.path)), entry.sha256, "Application source changed since rehearsal");
  const actualFiles: string[] = [];
  async function walk(path: string) {
    for (const e of await readdir(resolve(ROOT, path), { withFileTypes: true })) {
      if (e.isDirectory()) await walk(`${path}/${e.name}`);
      else { assert.ok(e.isFile(), "Source symlink refused"); actualFiles.push(`${path}/${e.name}`); }
    }
  }
  for (const path of ["artifacts/api-server/src", "lib/db/src", "lib/api-zod/src"]) await walk(path);
  actualFiles.sort();
  same([...actualFiles, ...packages], sourceFiles.map((r: Row) => r.path));
  const mapPath = resolve(ROOT, "artifacts/api-server/dist/index.mjs.map");
  const sourceMap = await jsonFile(mapPath);
  assert.equal(sourceMap.version, 3);
  assert.equal(sourceMap.sources.length, sourceMap.sourcesContent.length);
  let embeddedApplicationSources = 0;
  for (let i = 0; i < sourceMap.sources.length; i++) {
    const path = relative(ROOT, resolve(dirname(mapPath), sourceMap.sourceRoot ?? "", sourceMap.sources[i]));
    if (actualFiles.includes(path)) {
      assert.equal(typeof sourceMap.sourcesContent[i], "string");
      assert.equal(sha256(sourceMap.sourcesContent[i]), await fileHash(resolve(ROOT, path)));
      embeddedApplicationSources++;
    }
  }
  assert.equal(embeddedApplicationSources, 183, "Reviewed embedded application-source inventory changed");
  const files = await Promise.all([
    "scripts/src/e1-operational-guards.mts", AUTHORITATIVE, ...INSTALL_FILES,
    MIGRATED, REHEARSED, APPLICATION_REHEARSAL, INVENTORY, AUTHORIZATION, "scripts/src/e1-operational-guard-probes.mts",
    "scripts/src/e1-startup-effects.mts", ".local/e1-startup-effects-contract.md", ".local/e1-operative-runner-contract.md",
    "scripts/src/e1-approved-migration.mts", "scripts/src/e1-removable-guards.mts",
    "scripts/package.json", "pnpm-lock.yaml", ...WINDOW_FILES, ...packages, ...actualFiles,
  ].map(async (path) => ({ path, sha256: sha256(await readFile(resolve(ROOT, path))) })));
  const prior = reference.prior;
  return {
    status: "PREPARED_REQUIRES_EXPLICIT_GATES", sourceDigest: digest(files), files,
    authoritativeBaseline: { path: AUTHORITATIVE, status: prior.status, commitOutcome: prior.commitOutcome },
    installPlan: { files: INSTALL_FILES, functions: 3, triggers: 3, oneTransaction: true,
      supervisorMs: 30_000, removalsAllowed: false, retryAllowed: false },
    identityContract: {
      path: relative(ROOT, resolve(OUT, "api-pool-identity.json")),
      envelope: { source: "API_POOL", capturedAtUtc: "ISO_TIMESTAMP", identity: "exact OPERATIONAL_IDENTITY_SQL result" },
      fields: IDENTITY_FIELDS,
    },
    snapshotCommand: "cd scripts && env -u NODE_OPTIONS node --import tsx src/e1-operational-guards.mts --snapshot LABEL",
    executeAvailable: true,
    applicationProvenance: { verifiedManifestFiles: 1170, embeddedApplicationSources, runtimeBundleGateRequired: true },
    requiredInventory: { total: 60, sevenLedgerColumns: 7, temporaryGuardsBefore: 0 },
    note: "Snapshot observations never authorize DDL. Startup deltas must be reviewed separately from future guard installation.",
  };
}

export async function captureOperationalSnapshot(label: string, pinApi = false) {
  assert.match(label, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, "Unsafe snapshot label");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL unavailable");
  const preparationEvidence = await preparation();
  const identityEvidence = pinApi ? await jsonFile(resolve(OUT, "api-pool-identity.json")) : null;
  const report: Row = {
    formatVersion: 1, label, status: "RUNNING", stage: "connect",
    startedAtUtc: new Date().toISOString(), readOnly: true, ddlAuthorized: false,
    automaticRetries: 0, ddlStatementsSent: 0, applicationDmlStatementsSent: 0,
    authority: pinApi ? "API_IDENTITY_PINNED_OBSERVATION_NOT_AUTHORIZATION" : "NONAUTHORITATIVE_OBSERVATION_ONLY",
    preparation: preparationEvidence,
  };
  await mkdir(OUT, { recursive: true });
  // Never overwrite an earlier snapshot (including a failed one).
  const output = resolve(OUT, `snapshot-${label}.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL, application_name: "e1-operational-readonly-snapshot",
    connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000,
    options: "-c timezone=UTC -c default_transaction_read_only=on",
  });
  let connectionError = false;
  client.on("error", () => { connectionError = true; });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='20s'");
    report.stage = "identity";
    report.identity = (await client.query(OPERATIONAL_IDENTITY_SQL)).rows[0];
    assert.equal(report.identity.transaction_read_only, "on");
    assert.equal(report.identity.database_name, "heliumdb");
    assert.equal(report.identity.schema_name, "public");
    assert.equal(report.identity.replication_role, "origin");
    if (identityEvidence) {
      assert.equal(identityEvidence.source, "API_POOL");
      assert.ok(Number.isFinite(Date.parse(identityEvidence.capturedAtUtc)), "Missing API capture timestamp");
      await assertOperationalIdentity(client, identityEvidence.identity);
      report.apiIdentityBinding = { status: "MATCHED_NOT_DDL_AUTHORIZATION", evidenceSha256: digest(identityEvidence) };
    } else {
      report.apiIdentityBinding = { status: "UNAVAILABLE_NONAUTHORITATIVE", ddlAuthorized: false };
    }
    report.stage = "catalogue-and-full-row-aggregates";
    report.snapshot = await catalogue(client);
    report.snapshotSha256 = digest(report.snapshot);
    report.stage = "startup-effects-readonly";
    report.startupEffects = await collectStartupEffects(client);
    report.startupEffectsSql = { context: STARTUP_EFFECTS_CONTEXT_SQL, queries: STARTUP_EFFECTS_SQL, sha256: STARTUP_EFFECTS_SQL_SHA256 };
    report.stage = "strict-inventory";
    report.checks = {
      tables66: report.snapshot.tables.count === 66,
      historical3: report.snapshot.historical.count === 3,
      sevenLedgerColumns: report.snapshot.e1Inventory.ledgerColumns.count === 7,
      noTemporaryGuardFunctions: report.snapshot.temporaryGuards.functions.count === 0,
      noTemporaryGuardTriggers: report.snapshot.temporaryGuards.triggers.count === 0,
      permanentFunctions55: report.snapshot.permanentDefinitions.functions.count === 55,
      permanentTriggers23: report.snapshot.permanentDefinitions.triggers.count === 23,
      sequences47: report.snapshot.sequences.count === 47,
      allTablesHashed: report.snapshot.tableEvidence.count === report.snapshot.tables.count,
      allSequencesCaptured: report.snapshot.sequenceValues.count === report.snapshot.sequences.count,
    };
    // Catalog objects are independent from the original 27 SQL blocks.
    const countLikeOriginalPreflight = Number((await client.query(`SELECT count(*)::int AS count FROM (
      SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      UNION ALL SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      UNION ALL SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      UNION ALL SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
      UNION ALL SELECT conname FROM pg_constraint) objects WHERE right(name,3)='_e1'`)).rows[0].count);
    report.e1ObjectCountGate = { status: countLikeOriginalPreflight === 60 ? "PASS" : "FAIL", expected: 60,
      originalMigrationCatalogueQueryCount: countLikeOriginalPreflight,
      countMatchesUserRequirement: countLikeOriginalPreflight === 60,
      componentCounts: Object.fromEntries(Object.entries(report.snapshot.e1Inventory).map(([k, v]) => [k, (v as Row).count])) };
    assert.ok(Object.values(report.checks).every((v) => v === true), "Snapshot invariant failed");
    assert.equal(countLikeOriginalPreflight, 60);
    assertReference(report.snapshot, await references());
    report.referenceComparison = { status: "PASS", objects: 60, ledgerColumns: 7 };
    assert.equal(connectionError, false, "Connection error during snapshot");
    await client.query("ROLLBACK"); // End the read-only snapshot without COMMIT.
    report.readOnlyRollbackAcknowledged = true;
    report.status = "CAPTURED_READ_ONLY_NOT_AUTHORIZATION";
    report.stage = "complete";
  } catch (error) {
    report.status = "FAIL";
    report.error = safeError(error);
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
    report.finishedAtUtc = new Date().toISOString();
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  }
  return { status: report.status, label, report: relative(ROOT, output), sha256: report.snapshotSha256,
    authority: report.authority, ddlAuthorized: false, e1ObjectCountGate: report.e1ObjectCountGate.status };
}

function connectionOptions(application_name: string, readOnly: boolean): pg.ClientConfig {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL unavailable");
  return { connectionString: process.env.DATABASE_URL, application_name, connectionTimeoutMillis: 5000,
    statement_timeout: 15000, query_timeout: 20000,
    options: `-c timezone=UTC -c default_transaction_read_only=${readOnly ? "on" : "off"}` };
}

async function apiAbsent(stopped: Row) {
  assert.equal(stopped.status, "STOPPED");
  assert.ok(Array.isArray(stopped.processes) && stopped.processes.length > 0);
  for (const entry of stopped.processes) {
    assert.ok(Number.isInteger(entry.pid) && entry.pid > 1 && /^\d+$/.test(entry.startTicks));
    try { await readFile(`/proc/${entry.pid}/stat`); throw new Error("Recorded API PID still exists"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let text: string;
    try { text = await readFile(path, "utf8"); }
    catch (error) {
      if (path.endsWith("tcp6") && (error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    assert.ok(!text.trim().split("\n").slice(1).some((line) => {
      const fields = line.trim().split(/\s+/);
      return fields[3] === "0A" && fields[1]?.split(":")[1] === "1F90";
    }), "Port 8080 listener exists");
  }
  for (const entry of await readdir("/proc")) {
    if (!/^\d+$/.test(entry) || Number(entry) === process.pid) continue;
    let command: string;
    try { command = (await readFile(`/proc/${entry}/cmdline`, "utf8")).replace(/\0/g, " "); }
    catch (error) {
      if (["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "")) continue;
      throw error;
    }
    assert.ok(!/(?:artifacts\/api-server\/(?:dist|src)\/(?:index|main)|api-server\/.*--identity-window|--filter[ =]+@workspace\/api-server)/.test(command),
      "API process still present");
    if (/\b(?:node|tsx|ts-node)\b/.test(command) && /(?:dist|src)\/(?:index|main)\.[cm]?[jt]s/.test(command)) {
      let cwd: string;
      try { cwd = await readlink(`/proc/${entry}/cwd`); }
      catch (error) {
        if (["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "")) continue;
        throw error;
      }
      assert.notEqual(cwd, resolve(ROOT, "artifacts/api-server"), "Relative API entrypoint process still present");
    }
  }
  return { status: "PASS", port: 8080, stoppedPids: stopped.processes.map((r: Row) => r.pid), observedAtUtc: new Date().toISOString() };
}

async function exclusive(client: Queryable, allowed: number[]) {
  const other = (await client.query(`SELECT count(*)::int AS count FROM pg_stat_activity
    WHERE backend_type='client backend' AND NOT(pid=ANY($1::int[]))`, [allowed])).rows[0].count;
  assert.equal(other, 0, "Other client backends exist");
  assert.equal((await client.query("SELECT count(*)::int AS count FROM pg_prepared_xacts")).rows[0].count, 0);
}

/** Independent process/control connection: not the event loop performing DDL. */
async function watchdogChild() {
  assert.ok(process.send && process.connected, "Watchdog requires private IPC");
  let control: pg.Client | undefined, target: Row | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false, armedAt = 0, normalStop = false;
  const send = (message: Row) => { if (process.connected) process.send!(message); };
  async function terminate() {
    if (fired) return;
    fired = true; send({ event: "expired" });
    try {
      assert.ok(control && target);
      const result = await control.query(`SELECT pg_terminate_backend(a.pid,1000) AS terminated
        FROM pg_stat_activity a JOIN pg_database d ON d.datname=a.datname
        WHERE a.pid=$1 AND a.datname=$2 AND d.oid::text=$3 AND a.usename=$4
        AND a.application_name=$5 AND a.backend_start::text=$6`,
      [target.pid, target.database_name, target.database_oid, target.database_role, target.application_name, target.backend_start]);
      send({ event: "termination", rows: result.rows });
    } catch (error) { send({ event: "supervisorError", error: safeError(error) }); }
  }
  let chain = Promise.resolve();
  process.on("message", (raw: any) => {
    chain = chain.then(async () => {
      const { id, action } = raw;
      if (action === "init") {
        assert.ok(!control);
        control = new pg.Client({ ...connectionOptions(raw.app, true), statement_timeout: 3000, query_timeout: 5000 });
        control.on("error", () => { send({ event: "supervisorError" }); void terminate(); });
        await control.connect();
        const identity = await assertOperationalIdentity(control, raw.identity);
        send({ id, ok: true, pid: identity.backend_pid });
      } else if (action === "arm") {
        assert.ok(control && !target);
        target = raw.target;
        const matching = await control.query(`SELECT pid FROM pg_stat_activity WHERE pid=$1 AND datname=$2
          AND usename=$3 AND application_name=$4 AND backend_start::text=$5`,
        [target!.pid, target!.database_name, target!.database_role, target!.application_name, target!.backend_start]);
        assert.equal(matching.rowCount, 1);
        await exclusive(control, [target!.pid, Number((await control.query("SELECT pg_backend_pid() AS pid")).rows[0].pid)]);
        armedAt = performance.now();
        timer = setTimeout(() => { void terminate(); }, 30_000);
        send({ id, ok: true });
      } else if (action === "permit") {
        assert.ok(control && target && armedAt > 0 && !fired);
        await exclusive(control, [target!.pid, Number((await control.query("SELECT pg_backend_pid() AS pid")).rows[0].pid)]);
        assert.ok(!fired && performance.now() - armedAt < 30_000);
        send({ id, ok: true });
      } else if (action === "stop") {
        assert.ok(control);
        if (target) {
          const active = await control.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid=$1 AND backend_start::text=$2",
            [target.pid, target.backend_start]);
          assert.equal(active.rows[0].count, 0, "Cannot disarm while DDL backend exists");
        }
        if (timer) clearTimeout(timer);
        await control.end(); control = undefined;
        normalStop = true;
        send({ id, ok: true, fired });
        process.disconnect?.();
      } else throw new Error("Unknown watchdog message");
    }).catch((error) => { send({ id: raw.id, ok: false, error: safeError(error) }); });
  });
  process.on("disconnect", () => { void (async () => {
    if (target && control) await terminate();
    if (timer) clearTimeout(timer);
    await control?.end().catch(() => undefined);
    process.exitCode = normalStop ? 0 : 1;
  })(); });
  send({ event: "ready" });
}

function externalSupervisor(report: Row, onFailure: () => void) {
  const child: ChildProcess = fork(SELF, ["--internal-watchdog"], {
    execArgv: process.execArgv, stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let next = 0, stopped = false;
  let readyResolve!: () => void, readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const readyTimer = setTimeout(() => {
    report.watchdog.failed = true; onFailure(); readyReject(new Error("External supervisor did not become ready"));
  }, 10_000);
  const pending = new Map<number, { resolve: (v: Row) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  child.on("message", (message: any) => {
    if (message.event) {
      (report.watchdog.events ??= []).push({ ...message, atUtc: new Date().toISOString() });
      if (message.event === "ready") { clearTimeout(readyTimer); readyResolve(); return; }
      if (message.event === "expired") report.watchdog.fired = true;
      if (message.event !== "termination") { report.watchdog.failed = true; onFailure(); }
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.ok) request.resolve(message);
    else request.reject(new Error("External supervisor gate failed"));
  });
  const fail = () => {
    clearTimeout(readyTimer); readyReject(new Error("Supervisor unavailable"));
    if (!stopped) { report.watchdog.failed = true; onFailure(); }
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error("Supervisor unavailable")); }
    pending.clear();
  };
  child.on("exit", fail); child.on("error", fail);
  const request = async (action: string, value: Row = {}): Promise<Row> => {
    if (action === "init") await ready;
    assert.ok(child.connected, "External supervisor IPC is disconnected");
    return new Promise((resolve, reject) => {
    const id = ++next;
    const timer = setTimeout(() => {
      pending.delete(id); report.watchdog.failed = true; onFailure(); reject(new Error("Supervisor response timed out"));
    }, 7000);
    pending.set(id, { resolve, reject, timer });
    child.send({ id, action, ...value }, (error) => { if (error) fail(); });
    });
  };
  return { request, async stop() {
    try { await request("stop"); stopped = true; }
    finally { if (child.connected) child.disconnect(); }
  } };
}

async function verifyWindowEvidence(approval: Row, api: Row, before: Row, after: Row, prepared: Row): Promise<StartupOutcome> {
  const resultPath = resolve(OUT, "window-result.json"), proofPath = resolve(OUT, "http-gate-before-entry.json");
  assert.equal(await fileHash(resultPath), approval.windowResultSha256);
  assert.equal(await fileHash(proofPath), approval.httpGateBeforeEntrySha256);
  const window = await jsonFile(resultPath), proof = await jsonFile(proofPath);
  assert.equal(window.kind, "e1-identity-window");
  assert.equal(window.status, "success");
  assert.ok(window.failure === undefined || window.failure === null);
  assert.equal(window.identitySaved, true);
  assert.equal(window.identityPath, relative(ROOT, resolve(OUT, "api-pool-identity.json")));
  assert.equal(window.startupMode, "normal");
  assert.equal(window.startupWritesSuppressed, false);
  assert.equal(window.shutdown.exited, true);
  assert.equal(window.shutdown.forced, false);
  assert.equal(window.shutdown.sigtermSent, true);
  assert.equal(api.kind, "e1-actual-api-pool-identity");
  assert.equal(api.nonce, window.nonce);
  assert.equal(api.runtime.apiPid, window.apiPid);
  assert.equal(api.runtime.constructorName, "BoundPool");
  assert.equal(api.runtime.hasQuery, true);
  same(api.gateBeforeEntry, proof);
  same(window.gateBeforeEntry, proof);
  same(api.bundle, window.bundle);
  same(api.boot, window.boot);
  assert.equal(proof.status, "PASS");
  assert.equal(proof.nonce, window.nonce);
  assert.equal(proof.apiPid, window.apiPid);
  assert.equal(proof.phase, "before Runtime.runIfWaitingForDebugger; no application entry/imports released");
  assert.equal(proof.gate.gateInstalled, true);
  assert.equal(proof.gate.listeningPort, null);
  assert.equal(proof.gate.startupMode, "normal");
  assert.equal(proof.cases.length, 8);
  const expectedCases = [
    ["request", "GET", "/api/healthz", true], ["request", "POST", "/api/healthz", false],
    ["request", "GET", "/api/healthz?x=1", false], ["request", "POST", "/api/clientes", false],
    ["checkContinue", "POST", "/api/clientes", false], ["checkExpectation", "POST", "/api/clientes", false],
  ];
  for (const [index, [event, method, url, allowed]] of expectedCases.entries()) {
    const actual = proof.cases[index];
    assert.equal(actual.event, event); assert.equal(actual.method, method); assert.equal(actual.url, url);
    assert.equal(actual.allowed, allowed); assert.equal(actual.pass, true); assert.equal(actual.reached, allowed);
    if (!allowed) { assert.equal(actual.status, 503); assert.equal(actual.ended, true); }
  }
  for (const [index, event] of ["upgrade", "connect"].entries()) {
    const actual = proof.cases[index + 6];
    assert.equal(actual.event, event); assert.equal(actual.pass, true);
    assert.equal(actual.reached, false); assert.equal(actual.destroyed, true);
  }
  assert.equal(window.boot.health.status, "ok");
  assert.equal(window.boot.guard.gateInstalled, true);
  assert.equal(window.boot.guard.gracefulShutdownInstalled, true);
  assert.equal(window.boot.guard.listeningPort, 8080);
  assert.equal(window.boot.guard.nonce, window.nonce);
  assert.equal(window.boot.guard.startupMode, "normal");
  assert.ok(approval.apiStopped.processes.some((r: Row) => r.pid === window.apiPid
    && r.startTicks === proof.gate.processStartTicks));
  const currentBundle = prepared.files.find((r: Row) => r.path === "artifacts/api-server/dist/index.mjs").sha256;
  assert.equal(window.bundle.path, resolve(ROOT, "artifacts/api-server/dist/index.mjs"));
  assert.equal(window.bundle.runtimeMatchesDisk, true);
  for (const key of ["compiledBundleSha256", "runtimeScriptSourceSha256", "diskAfterCaptureSha256"]) {
    assert.equal(window.bundle[key], currentBundle);
  }
  assert.equal(proof.gate.compiledBundleSha256, currentBundle);
  assert.equal(api.inventory.active_event_triggers, 0);
  const timestamp = (s: string) => { const v = Date.parse(s); assert.ok(Number.isFinite(v)); return v; };
  assert.ok(timestamp(before.finishedAtUtc) <= timestamp(window.preloadStartedAt));
  assert.ok(timestamp(window.preloadStartedAt) <= timestamp(proof.observedAtUtc));
  assert.ok(timestamp(proof.observedAtUtc) <= timestamp(window.boot.observedAt));
  assert.ok(timestamp(window.boot.observedAt) <= timestamp(api.capturedAtUtc));
  assert.ok(timestamp(api.capturedAtUtc) <= timestamp(window.completedAt));
  assert.ok(timestamp(window.completedAt) <= timestamp(after.startedAtUtc));
  const evidence = approval.startupOutcomeEvidence;
  assert.ok(/^reports\/e1-guardas-operativa-2026-09-18\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.json$/.test(evidence.path));
  assert.equal(await fileHash(resolve(ROOT, evidence.path)), evidence.sha256);
  const completion = await jsonFile(resolve(ROOT, evidence.path));
  assert.equal(completion.status, "REVIEWED_COMPLETE");
  assert.equal(completion.windowResultSha256, approval.windowResultSha256);
  assert.ok(typeof completion.reviewedBy === "string" && completion.reviewedBy.length > 0);
  assert.ok(Array.isArray(completion.evidenceSources) && completion.evidenceSources.length > 0);
  for (const source of completion.evidenceSources) {
    assert.ok(/^reports\/e1-guardas-operativa-2026-09-18\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(source.path));
    assert.equal(await fileHash(resolve(ROOT, source.path)), source.sha256);
  }
  // The parent's attested log/task review is mandatory; health alone cannot
  // set these states. The comparator independently verifies actual row deltas.
  same(completion.outcome, { backfill: "completed", initializers: "completed",
    stock: "stopped-without-observed-error", shutdown: "confirmed" });
  return completion.outcome;
}

async function loadExecutionGate(sourceDigest: string, approvalHash: string) {
  assert.match(sourceDigest, /^[a-f0-9]{64}$/); assert.match(approvalHash, /^[a-f0-9]{64}$/);
  const prepared = await preparation();
  assert.equal(prepared.sourceDigest, sourceDigest);
  const path = resolve(OUT, "startup-approval.json");
  assert.equal(await fileHash(path), approvalHash);
  const approval = await jsonFile(path);
  assert.equal(approval.status, "APPROVED");
  assert.ok(typeof approval.approvedBy === "string" && approval.approvedBy.length > 0);
  assert.equal(approval.sourceDigest, sourceDigest);
  assert.equal(approval.inventoryApproval, "EXACT_60_OBJECTS_AND_SEVEN_LEDGER_COLUMNS");
  assert.equal(approval.backfillInsertedRows, 0);
  assert.equal(approval.startupDiff.status, "APPROVED_EXACT_DELTAS");
  assert.equal(approval.startupDiff.unexpectedChanges, false);
  async function snapshotFile(entry: Row) {
    assert.ok(/^reports\/e1-guardas-operativa-2026-09-18\/snapshot-[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\.json$/.test(entry.path));
    assert.equal(await fileHash(resolve(ROOT, entry.path)), entry.sha256);
    const snapshot = await jsonFile(resolve(ROOT, entry.path));
    assert.equal(snapshot.status, "CAPTURED_READ_ONLY_NOT_AUTHORIZATION");
    assert.equal(snapshot.readOnlyRollbackAcknowledged, true);
    assert.equal(snapshot.snapshotSha256, digest(snapshot.snapshot));
    assert.equal(snapshot.referenceComparison.status, "PASS");
    same(snapshot.startupEffectsSql, { context: STARTUP_EFFECTS_CONTEXT_SQL, queries: STARTUP_EFFECTS_SQL, sha256: STARTUP_EFFECTS_SQL_SHA256 });
    for (const key of ["database_name", "database_oid", "database_role", "server_started_at"]) {
      assert.equal(snapshot.startupEffects.context[key], snapshot.identity[key]);
    }
    assert.equal(snapshot.startupEffects.context.backend_pid, String(snapshot.identity.backend_pid));
    for (const table of STARTUP_MUTABLE_TABLES) {
      const full = snapshot.snapshot.tableEvidence.rows.find((r: Row) => r.schema === "public" && r.table === table);
      assert.ok(full);
      assert.equal(String(snapshot.startupEffects.tables[table].count), full.count);
    }
    return snapshot;
  }
  const before = await snapshotFile(approval.before), after = await snapshotFile(approval.after);
  assert.notEqual(approval.before.path, approval.after.path);
  assert.equal(before.authority, "NONAUTHORITATIVE_OBSERVATION_ONLY");
  assert.equal(after.authority, "API_IDENTITY_PINNED_OBSERVATION_NOT_AUTHORIZATION");
  const identityBytes = await readFile(resolve(OUT, "api-pool-identity.json"));
  assert.equal(sha256(identityBytes), approval.apiIdentitySha256);
  const api = JSON.parse(identityBytes.toString("utf8"));
  assert.equal(api.source, "API_POOL");
  assert.equal(after.apiIdentityBinding.evidenceSha256, digest(api));
  const stamp = (s: string) => { const n = Date.parse(s); assert.ok(Number.isFinite(n)); return n; };
  const captureAt = stamp(api.capturedAtUtc), approveAt = stamp(approval.approvedAtUtc), now = Date.now();
  assert.ok(now >= approveAt && now - captureAt <= 30 * 60_000 && now - approveAt <= 30 * 60_000);
  assert.ok(stamp(before.finishedAtUtc) <= captureAt && captureAt <= stamp(after.startedAtUtc));
  assert.ok(stamp(after.finishedAtUtc) <= approveAt && stamp(after.finishedAtUtc) <= stamp(approval.apiStopped.observedAtUtc));
  assert.ok(stamp(approval.apiStopped.observedAtUtc) <= approveAt);
  for (const key of IDENTITY_FIELDS) {
    same(before.identity[key], api.identity[key]);
    same(after.identity[key], api.identity[key]);
  }
  const outcome = await verifyWindowEvidence(approval, api, before, after, prepared);
  const computedDiff = computeStartupApprovalDiff(before, after, outcome);
  assert.equal(approval.backfillInsertedRows, computedDiff.effects.backfill.insertedCount);
  same(approval.startupDiff.diff, computedDiff);
  assertReference(before.snapshot, await references());
  assertReference(after.snapshot, await references());
  return { prepared, approval, api, before, after, computedDiff };
}

async function freshCapture(expected: Row, target: Row | undefined, stopped: Row, controlPid?: number) {
  const client = new pg.Client(connectionOptions("e1-operational-fresh-readonly", true));
  client.on("error", () => undefined);
  try {
    await client.connect();
    const identity = await assertOperationalIdentity(client, expected);
    await exclusive(client, [identity.backend_pid, ...(controlPid ? [controlPid] : [])]);
    if (target) assert.equal((await client.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid=$1 AND backend_start::text=$2",
      [target.pid, target.backend_start])).rows[0].count, 0);
    await apiAbsent(stopped);
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
    const snapshot = await catalogue(client);
    await client.query("ROLLBACK");
    return snapshot;
  } finally { await client.end().catch(() => undefined); }
}

async function execute(sourceDigest: string, approvalHash: string) {
  const gate = await loadExecutionGate(sourceDigest, approvalHash);
  const reference = await references();
  await apiAbsent(gate.approval.apiStopped);
  const run = `${Date.now()}-${process.pid}`;
  const reportPath = resolve(OUT, `operational-run-${run}.json`);
  const report: Row = {
    status: "RUNNING", startedAtUtc: new Date().toISOString(), sourceDigest, approvalHash,
    stage: "file-gates", ddlCommandsAcknowledged: 0, ddlCommandsSent: 0, ddlFilesSent: 0, ddlFiles: [], commitSent: false,
    commitAcknowledged: false, automaticRetries: 0, removals: 0, probes: [],
    watchdog: { budgetMs: 30_000, externalProcess: true, failed: false, events: [] },
    startupBaseline: {
      preStartup: gate.approval.before, postStartup: gate.approval.after,
      approvedDiffSha256: digest(gate.computedDiff), backfillInsertedRows: 0,
      guardPreservationUsesEntirePostStartupBaseline: true,
    },
    originalMigrationExecuted: false,
  };
  const save = () => writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await writeFile(resolve(OUT, "operational-run-claim.json"), JSON.stringify({
    run, sourceDigest, approvalHash, report: relative(ROOT, reportPath), noAutomaticRetry: true,
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const app = `e1-operational-ddl-${run}`;
  let ddl: pg.Client | undefined, target: Row | undefined, controlPid: number | undefined;
  let supervisor: ReturnType<typeof externalSupervisor> | undefined, started = 0, installationClean = false;
  let beforeDDL: Row | undefined, afterDDL: Row | undefined;
  const budget = () => {
    assert.ok(started > 0 && performance.now() - started < 30_000, "DDL total deadline expired");
    assert.equal(report.watchdog.failed, false, "External supervisor failed/expired");
  };
  try {
    report.stage = "fresh-preflight";
    beforeDDL = await freshCapture(gate.api.identity, undefined, gate.approval.apiStopped);
    same(beforeDDL, gate.after.snapshot);
    assertReference(beforeDDL, reference);
    report.beforeReferenceComparison = "PASS";
    report.beforeDDL = beforeDDL;
    await save();
    ddl = new pg.Client(connectionOptions(app, false));
    ddl.on("error", () => { report.ddlConnectionError = true; });
    await ddl.connect();
    const identity = await assertOperationalIdentity(ddl, gate.api.identity);
    target = { ...identity, pid: identity.backend_pid, application_name: app,
      backend_start: (await ddl.query("SELECT backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid()")).rows[0].backend_start };
    report.ddlBackend = { pid: target!.pid, applicationName: app, backendStart: target!.backend_start };
    supervisor = externalSupervisor(report, () => { void ddl?.end().catch(() => undefined); });
    controlPid = (await supervisor.request("init", { app: `e1-operational-supervisor-${run}`, identity: gate.api.identity })).pid;
    assert.equal((await preparation()).sourceDigest, sourceDigest);
    assert.equal(await fileHash(resolve(OUT, "startup-approval.json")), approvalHash);
    report.stage = "joint-installation";
    // Set the local budget BEFORE the supervisor arms: local COMMIT gate is conservative.
    started = performance.now();
    await supervisor.request("arm", { target });
    budget();
    await ddl.query("BEGIN");
    await ddl.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='15s'; SET LOCAL idle_in_transaction_session_timeout='5s'");
    budget();
    await ddl.query(`LOCK TABLE ${beforeDDL.tables.rows.map((r: Row) => `${quote(r.schema)}.${quote(r.table)}`).sort().join(",")}
      IN SHARE ROW EXCLUSIVE MODE`);
    // Recheck full data/catalog under locks. No startup mutation can become the DDL baseline.
    const locked = await catalogue(ddl);
    same(locked, beforeDDL);
    assertReference(locked, reference);
    await apiAbsent(gate.approval.apiStopped);
    for (const path of INSTALL_FILES) {
      const sql = await readFile(resolve(ROOT, path), "utf8");
      assert.equal(sha256(sql), gate.prepared.files.find((f: Row) => f.path === path)!.sha256);
      await apiAbsent(gate.approval.apiStopped);
      await supervisor.request("permit");
      budget();
      const sentAt = performance.now();
      report.ddlFilesSent++;
      report.ddlCommandsSent += 2;
      const result: pg.QueryResult | pg.QueryResult[] = await ddl.query(sql);
      const responses: pg.QueryResult[] = Array.isArray(result) ? result : [result];
      assert.equal(responses.length, 2);
      same(responses.map((r: any) => r.command), ["CREATE", "CREATE"]);
      report.ddlCommandsAcknowledged += 2;
      report.ddlFiles.push({ path, sha256: sha256(sql), commandsAcknowledged: 2, elapsedMs: performance.now() - sentAt });
    }
    const installedInTransaction = await catalogue(ddl);
    assertReference(installedInTransaction, reference, true);
    preserved(beforeDDL, installedInTransaction);
    assert.equal(report.ddlFilesSent, 3);
    assert.equal(report.ddlCommandsSent, 6);
    assert.equal(report.ddlCommandsAcknowledged, 6);
    await apiAbsent(gate.approval.apiStopped);
    await supervisor.request("permit");
    budget();
    assert.equal(report.ddlConnectionError, undefined);
    // No await between the final local deadline gate and sending COMMIT.
    report.commitSent = true;
    report.commitSentAfterBeginMs = performance.now() - started;
    await ddl.query("COMMIT");
    report.commitAcknowledged = true;
    report.commitAcknowledgedAfterBeginMs = performance.now() - started;
    budget();
    installationClean = true;
  } catch (error) {
    report.installationError = safeError(error);
    report.status = "FAIL";
    report.commitOutcome = report.commitSent ? "UNCERTAIN_REQUIRES_FRESH_READONLY" : "NOT_SENT_REQUIRES_FRESH_READONLY";
    if (ddl && !report.commitSent && !report.watchdog.failed && started && performance.now() - started < 30_000) {
      try { await ddl.query("ROLLBACK"); report.rollbackAcknowledged = true; } catch { report.rollbackAcknowledged = false; }
    }
  } finally {
    await ddl?.end().catch(() => undefined);
    report.transactionElapsedMs = started ? performance.now() - started : 0;
    // Persist uncertainty BEFORE attempting to resolve it.
    report.commitOutcome ??= "ACKNOWLEDGED_PENDING_FRESH_READONLY";
    await save();
    // The child disarms only after proving the exact DDL backend absent. Keep
    // verification outside the transaction budget, on a brand-new RO backend.
    try {
      await supervisor?.stop();
      report.watchdog.ddlBackendAbsentBeforeDisarm = Boolean(target);
      controlPid = undefined;
    } catch (error) { report.supervisorStopError = safeError(error); installationClean = false; }
    try {
      report.stage = "fresh-outcome-resolution";
      afterDDL = await freshCapture(gate.api.identity, target, gate.approval.apiStopped, controlPid);
      report.afterDDL = afterDDL;
      assert.ok(beforeDDL);
      preserved(beforeDDL, afterDDL);
      const installed = afterDDL.temporaryGuards.functions.count === 3 && afterDDL.temporaryGuards.triggers.count === 3;
      assertReference(afterDDL, reference, installed);
      report.afterReferenceComparison = "PASS";
      if (installed) report.commitOutcome = "COMMITTED_VERIFIED";
      else {
        assert.equal(afterDDL.temporaryGuards.functions.count, 0);
        assert.equal(afterDDL.temporaryGuards.triggers.count, 0);
        report.commitOutcome = "NOT_COMMITTED_VERIFIED";
        installationClean = false;
      }
      report.preservationAfterDDL = "PASS";
    } catch (error) {
      report.resolutionError = safeError(error);
      report.commitOutcome = "UNRESOLVED_REQUIRES_MANUAL_REVIEW";
      installationClean = false;
    }
    if (report.watchdog.failed || report.ddlConnectionError) installationClean = false;
    await save();
  }
  let probePool: pg.Pool | undefined;
  try {
    assert.ok(installationClean && report.commitOutcome === "COMMITTED_VERIFIED", "Installation not cleanly verified; probes prohibited");
    report.stage = "rollback-only-operational-probes";
    await apiAbsent(gate.approval.apiStopped);
    probePool = new pg.Pool({ ...connectionOptions(`e1-operational-probes-${run}`, false), max: 1 });
    let poolError = false;
    probePool.on("error", () => { poolError = true; report.poolConnectionError = true; report.status = "FAIL"; });
    report.probeResult = await runOperationalGuardChecks({
      pool: probePool,
      assertIdentity: async (client) => {
        assert.equal(poolError, false);
        const id = await assertOperationalIdentity(client, gate.api.identity);
        await exclusive(client, [id.backend_pid]);
        await apiAbsent(gate.approval.apiStopped);
      },
      record: async (result) => {
        report.probes.push(result);
        await save();
        assert.equal(result.status, "PASS", "Probe failed; stop further writes");
      },
    });
    assert.equal(poolError, false);
    assert.equal(report.probeResult.status, "PASS");
    assert.equal(report.probeResult.requiresNonzeroExit, false);
    assert.equal(report.probes.length, OPERATIONAL_GUARD_CHECK_COUNT);
    assert.equal(new Set(report.probes.map((r: Row) => r.name)).size, OPERATIONAL_GUARD_CHECK_COUNT);
    assert.ok(report.probes.every((r: Row) => r.status === "PASS"));
    report.status = "PASS";
  } catch (error) { report.status = "FAIL"; report.probeOrGateError = safeError(error); }
  finally {
    await probePool?.end().catch(() => undefined);
    try {
      report.stage = "final-full-preservation";
      const final = await freshCapture(gate.api.identity, target, gate.approval.apiStopped);
      report.finalSnapshot = final;
      assert.ok(beforeDDL);
      preserved(beforeDDL, final);
      assertReference(final, reference, report.commitOutcome === "COMMITTED_VERIFIED");
      report.finalReferenceComparison = "PASS";
      if (afterDDL) same(afterDDL, final);
      report.finalPreservation = "PASS";
      report.apiAbsent = await apiAbsent(gate.approval.apiStopped);
    } catch (error) { report.status = "FAIL"; report.finalPreservationError = safeError(error); }
    report.finishedAtUtc = new Date().toISOString();
    report.stage = "complete";
    await save();
  }
  if (report.status !== "PASS") process.exitCode = 1;
  console.log(JSON.stringify({ status: report.status, commitOutcome: report.commitOutcome, report: relative(ROOT, reportPath),
    guardsRemoved: false, automaticRetries: 0 }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--review") {
    console.log(JSON.stringify(await preparation(), null, 2));
    return;
  }
  if ((args.length === 2 || (args.length === 3 && args[2] === "--pin-api")) && args[0] === "--snapshot") {
    console.log(JSON.stringify(await captureOperationalSnapshot(args[1]!, args[2] === "--pin-api"), null, 2));
    return;
  }
  if (args.length === 3 && args[0] === "--execute") {
    await execute(args[1]!, args[2]!);
    return;
  }
  if (args.length === 1 && args[0] === "--internal-watchdog" && process.send) {
    await watchdogChild();
    return;
  }
  throw new Error("Use --review, --snapshot LABEL [--pin-api], or --execute SOURCE_DIGEST STARTUP_APPROVAL_SHA256.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(JSON.stringify(safeError(error))); process.exitCode = 1; });
}