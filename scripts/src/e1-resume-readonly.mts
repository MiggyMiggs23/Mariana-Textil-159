/**
 * Read-only capture for the parent-controlled API resume. Inert on import:
 * no application, installer, probe, seed, workflow or authentication imports.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  collectStartupEffects, compareStartupEffects, type StartupEffectsSnapshot,
} from "./e1-startup-effects.mts";

type Row = Record<string, any>;
type Client = { query(sql: string, params?: unknown[]): Promise<{ rows: Row[] }> };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT = resolve(ROOT,
  "reports/e1-guardas-operativa-2026-09-18/operational-run-1789747937364-3434.json");
const IDENTITY = resolve(ROOT, "reports/e1-guardas-operativa-2026-09-18/api-pool-identity.json");
const GUARD_FUNCTIONS = [
  "e1_guard_cash_capture_closed", "e1_guard_pending_receipts_closed",
  "e1_guard_historical_attribution_closed",
];
const GUARD_TRIGGERS = [
  "zz_e1_cash_capture_closed", "zz_e1_pending_receipts_closed",
  "zz_e1_historical_attribution_closed",
];
const FINANCIAL = new Set([
  "pagos_proveedor", "aplicaciones_pago_proveedor", "movimientos_credito",
  "operaciones_credito_e1", "aplicaciones_credito", "cobros_credito_pendientes_e1",
  "atribuciones_credito_e1", "tickets", "ticket_pagos", "sesiones_caja",
  "sesiones_caja_dias", "salidas_dinero_caja",
]);
const STOCK = /^(existencias|stock_minimo|notificaciones_sistema)/;
const BROWSER_MUTABLE = /^(sesiones|auditoria(?:_|$)|notificaciones(?:_|$)|usuarios$)/;
const IDENTITY_FIELDS = [
  "database_name", "database_oid", "database_role", "schema_name", "server_version",
  "server_address", "server_port", "server_started_at", "unix_socket_directories",
  "data_directory", "configured_port", "listen_addresses", "search_schemas",
] as const;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const digest = (value: unknown) => sha256(canonical(value));
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const summary = (rows: Row[]) => ({ count: rows.length, sha256: digest(rows) });
const userSchema = (alias: string) => `${alias}.nspname NOT IN ('pg_catalog','information_schema')
  AND ${alias}.nspname !~ '^pg_(toast|temp)'`;

// Kept local deliberately: importing the installer would transitively import executable probes.
const OPERATIONAL_IDENTITY_SQL = `SELECT current_database() AS database_name,
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

async function query(client: Client, sql: string, params: unknown[] = []) {
  return (await client.query(sql, params)).rows;
}
const catalogueSql = {
  tables: `SELECT n.nspname AS schema,c.relname AS table,c.relkind::text AS relkind,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','f')
    AND ${userSchema("n")} ORDER BY n.nspname,c.relname`,
  columns: `SELECT n.nspname AS schema,c.relname AS table,a.attname AS column,
    a.attnum AS ordinal_position,format_type(a.atttypid,a.atttypmod) AS data_type,
    a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    NULLIF(a.attidentity,'') AS identity_kind,NULLIF(a.attgenerated,'') AS generated_kind
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0
    AND NOT a.attisdropped AND c.relkind IN ('r','p','f') AND ${userSchema("n")}
    ORDER BY n.nspname,c.relname,a.attnum`,
  constraints: `SELECT n.nspname AS schema,c.relname AS table,k.conname AS name,
    k.contype::text AS kind,pg_get_constraintdef(k.oid,true) AS definition,k.convalidated AS validated,
    k.condeferrable AS deferrable,k.condeferred AS initially_deferred FROM pg_constraint k
    JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userSchema("n")} ORDER BY n.nspname,c.relname,k.conname`,
  indexes: `SELECT n.nspname AS schema,c.relname AS table,i.relname AS name,
    pg_get_indexdef(i.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready,x.indislive AS live
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema("n")}
    ORDER BY n.nspname,c.relname,i.relname`,
  functions: `SELECT n.nspname AS schema,p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,pg_get_functiondef(p.oid) AS definition,
    p.prokind::text AS kind,p.proacl::text AS acl,pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind IN ('f','p')
    AND ${userSchema("n")} ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`,
  triggers: `SELECT n.nspname AS schema,c.relname AS table,t.tgname AS name,
    CASE WHEN t.tgname=ANY($1::text[]) THEN pg_get_triggerdef(t.oid)
      ELSE pg_get_triggerdef(t.oid,true) END AS definition,t.tgenabled::text AS enabled,
    t.tgtype::int AS type,pn.nspname AS function_schema,p.proname AS function_name,
    t.tgisinternal AS internal FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE ${userSchema("n")}
    ORDER BY n.nspname,c.relname,t.tgname`,
  eventTriggers: `SELECT evtname AS name,evtevent AS event,evtenabled::text AS enabled,
    evttags AS tags,pg_get_userbyid(evtowner) AS owner,pg_get_functiondef(evtfoid) AS function_definition
    FROM pg_event_trigger ORDER BY evtname`,
  relations: `SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl,
    CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END AS view_definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema("n")}
    ORDER BY n.nspname,c.relname`,
  types: `SELECT n.nspname AS schema,t.typname AS name,t.typtype::text AS kind,
    t.typacl::text AS acl,pg_get_userbyid(t.typowner) AS owner,
    CASE WHEN t.typelem<>0 THEN format_type(t.typelem,NULL) END AS element_type,
    CASE WHEN t.typbasetype<>0 THEN format_type(t.typbasetype,t.typtypmod) END AS base_type,
    t.typnotnull AS not_null,t.typdefault AS default_expression,
    (SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid) AS enum_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${userSchema("n")}
    ORDER BY n.nspname,t.typname`,
  sequences: `SELECT schemaname AS schema,sequencename AS name,data_type,
    start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text
    FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema')
    AND schemaname !~ '^pg_(toast|temp)' ORDER BY schemaname,sequencename`,
  sequenceOwnership: `SELECT sn.nspname AS schema,s.relname AS name,
    tn.nspname AS table_schema,t.relname AS table,a.attname AS column,d.deptype::text AS dependency_type
    FROM pg_class s JOIN pg_namespace sn ON sn.oid=s.relnamespace
    JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
      AND d.refclassid='pg_class'::regclass AND d.refobjsubid>0 AND d.deptype IN ('a','i')
    JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
    WHERE s.relkind='S' AND ${userSchema("sn")}
    ORDER BY sn.nspname,s.relname,tn.nspname,t.relname,a.attname`,
} as const;

async function captureCatalogue(client: Client, committed: Row) {
  const result: Row = {};
  for (const [name, sql] of Object.entries(catalogueSql)) {
    const rows = await query(client, sql, name === "triggers" ? [GUARD_TRIGGERS] : []);
    assert.equal(rows.some(row => row.relkind === "f"), false, "Foreign tables require review");
    result[name] = summary(rows);
    assert.deepEqual(result[name], {
      count: committed[name].count, sha256: committed[name].sha256,
    }, `Committed catalogue mismatch: ${name}`);
    if (name === "functions")
      result.guardFunctions = rows.filter(row => GUARD_FUNCTIONS.includes(row.name));
    if (name === "triggers")
      result.guardTriggers = rows.filter(row => GUARD_TRIGGERS.includes(row.name));
  }
  const expectedFunctions = committed.functions.rows.filter((row: Row) => GUARD_FUNCTIONS.includes(row.name));
  const expectedTriggers = committed.triggers.rows.filter((row: Row) => GUARD_TRIGGERS.includes(row.name));
  assert.equal(canonical(result.guardFunctions), canonical(expectedFunctions), "Guard function mismatch");
  assert.equal(canonical(result.guardTriggers), canonical(expectedTriggers), "Guard trigger mismatch");
  assert.equal(result.guardFunctions.length, 3, "Three guard functions required");
  assert.equal(result.guardTriggers.length, 3, "Three guard triggers required");
  return result;
}

async function captureTables(client: Client, tables: Row[]) {
  const result: Row = {};
  for (const table of tables.filter(row => row.schema === "public")) {
    const [aggregate] = await query(client, `WITH canonical_rows AS (
      SELECT to_jsonb(t)::text AS canonical FROM ${quote(table.schema)}.${quote(table.table)} t)
      SELECT count(*)::text AS count,
      md5(COALESCE(string_agg(md5(canonical),'' ORDER BY canonical,md5(canonical)),'')) AS hash
      FROM canonical_rows`);
    result[table.table] = aggregate;
  }
  return result;
}

async function capture(output: string) {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL unavailable");
  const reference = JSON.parse(await readFile(REPORT, "utf8")).finalSnapshot;
  const pinned = JSON.parse(await readFile(IDENTITY, "utf8"));
  assert.equal(pinned.kind, "e1-actual-api-pool-identity");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL, application_name: "e1-resume-readonly",
    connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000,
    options: "-c timezone=UTC -c default_transaction_read_only=on",
  });
  let transaction = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transaction = true;
    const [identity] = await query(client, OPERATIONAL_IDENTITY_SQL);
    assert.equal(identity.replication_role, "origin");
    assert.equal(identity.transaction_read_only, "on");
    for (const field of IDENTITY_FIELDS) assert.deepEqual(identity[field], pinned.identity[field],
      `API identity mismatch: ${field}`);
    const catalogue = await captureCatalogue(client, reference);
    const tables = await captureTables(client, reference.tables.rows);
    const startupEffects = await collectStartupEffects(client);
    const body = { version: 1, identity: Object.fromEntries(IDENTITY_FIELDS.map(k => [k, identity[k]])),
      catalogue, tables, startupEffects };
    await writeFile(resolve(output), `${JSON.stringify({ ...body, sha256: digest(body) }, null, 2)}\n`,
      { flag: "wx", mode: 0o600 });
  } finally {
    if (transaction) { try { await client.query("ROLLBACK"); } catch {} }
    await client.end().catch(() => undefined);
  }
}

function changedEffects(before: StartupEffectsSnapshot, after: StartupEffectsSnapshot) {
  return compareStartupEffects(before, after, {
    backfill: "unknown", initializers: "unknown", stock: "unknown", shutdown: "unknown",
  });
}
async function compare(beforePath: string, afterPath: string, output: string) {
  const before = JSON.parse(await readFile(resolve(beforePath), "utf8"));
  const after = JSON.parse(await readFile(resolve(afterPath), "utf8"));
  for (const value of [before, after]) {
    const { sha256: recorded, ...body } = value;
    assert.equal(recorded, digest(body), "Capture digest mismatch");
  }
  assert.equal(canonical(before.identity), canonical(after.identity), "Database identity changed");
  const catalogueChanged = Object.keys(before.catalogue)
    .filter(k => !/^guard/.test(k) && canonical(before.catalogue[k]) !== canonical(after.catalogue[k]));
  const changedTables = Object.keys(before.tables).filter(name =>
    canonical(before.tables[name]) !== canonical(after.tables[name]));
  const startup = changedEffects(before.startupEffects, after.startupEffects);
  const counts = (name: string) => startup.tables[name]?.counts ??
    { added: 0, deleted: 0, updated: 0, unchanged: 0 };
  const effectChanged = Object.entries(startup.tables).filter(([, value]: any) =>
    value.counts.added + value.counts.deleted + value.counts.updated > 0).map(([name]) => name);
  const permissionEffects = ["permisos_rol", "permisos_ubicacion", "permisos_usuario"].map(name => {
    const delta = startup.tables[name];
    const invalidUpdates = (delta?.updated ?? []).filter((row: any) =>
      row.fields.some((field: any) => field.field !== "updated_at"));
    return { table: name, counts: counts(name),
      onlyUpdatedAt: counts(name).added === 0 && counts(name).deleted === 0 &&
        invalidUpdates.length === 0,
      invalidUpdates: invalidUpdates.map((row: any) => ({
        identityHash: sha256(row.key), fields: row.fields.map((f: any) => f.field),
      })) };
  });
  const supplier = startup.tables.pagos_proveedor;
  const supplierUnchanged = supplier.counts.added + supplier.counts.deleted + supplier.counts.updated === 0;
  const financialChanged = changedTables.filter(name => FINANCIAL.has(name));
  const body = {
    version: 1, beforeSha256: before.sha256, afterSha256: after.sha256,
    changedTables, catalogueChanged, financialChanged,
    startup: { effectChanged, supplierUnchanged, supplierLedger: counts("pagos_proveedor"),
      supplierCandidates: {
        beforeCount: before.startupEffects.tables.backfill_candidates.count,
        afterCount: after.startupEffects.tables.backfill_candidates.count,
        delta: counts("backfill_candidates"),
      },
      permissionEffects,
      financialTablesUnchanged: startup.financialTablesUnchanged,
      stockEffects: effectChanged.filter(name => STOCK.test(name))
        .map(name => ({ table: name, counts: counts(name) })) },
    browser: {
      permittedChangedTables: changedTables.filter(name => BROWSER_MUTABLE.test(name)),
      uncertainOrForbiddenChangedTables: changedTables.filter(name => !BROWSER_MUTABLE.test(name)),
      note: "Table hashes only; permitted names are reported, never auto-approved.",
    },
    status: catalogueChanged.length || financialChanged.length || !supplierUnchanged ||
      !startup.financialTablesUnchanged ? "STOP" : "REVIEW",
  };
  await writeFile(resolve(output), `${JSON.stringify({ ...body, sha256: digest(body) }, null, 2)}\n`,
    { flag: "wx", mode: 0o600 });
  if (body.status === "STOP") process.exitCode = 2;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === "--capture") return capture(args[1]!);
  if (args.length === 4 && args[0] === "--compare") return compare(args[1]!, args[2]!, args[3]!);
  throw new Error("Usage: --capture OUTPUT | --compare BEFORE AFTER OUTPUT");
}
main().catch((error: any) => {
  process.stderr.write(`e1-resume-readonly failed${error?.code && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : ""}\n`);
  process.exitCode = 1;
});