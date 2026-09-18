import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

if (
  process.env.API_INSPECTION_BOOT !== "1"
  || process.env.NODE_ENV !== "development"
) {
  throw new Error(
    "Refusing before database preflight: explicit inspection environment is missing.",
  );
}

const EXPECTED = Object.freeze({
  database: "heliumdb",
  databaseOid: "16384",
  schema: "public",
  role: "postgres",
  serverVersionNum: "160010",
  tableCount: 69,
  schemaRows: 1519,
  schemaSha256: "37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8",
  guards: [
    ["zz_e1_cash_capture_closed", "movimientos_credito", "e1_guard_cash_capture_closed", "O", 5],
    ["zz_e1_historical_attribution_closed", "atribuciones_credito_e1", "e1_guard_historical_attribution_closed", "O", 4],
    ["zz_e1_pending_receipts_closed", "cobros_credito_pendientes_e1", "e1_guard_pending_receipts_closed", "O", 4],
  ],
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const sql = String.raw`
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'database', current_database(),
  'databaseOid', (SELECT oid::text FROM pg_database WHERE datname=current_database()),
  'schema', current_schema(),
  'role', current_user,
  'serverVersionNum', current_setting('server_version_num'),
  'readOnly', current_setting('transaction_read_only'),
  'tableCount', (
    SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname='public'
  ),
  'enabledEventTriggers', (
    SELECT count(*)::int FROM pg_event_trigger WHERE evtenabled<>'D'
  ),
  'guards', (
    SELECT coalesce(json_agg(json_build_array(t.tgname,c.relname,p.proname,t.tgenabled,t.tgtype::int)
      ORDER BY t.tgname),'[]'::json)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE n.nspname='public' AND NOT t.tgisinternal
      AND t.tgname IN (
        'zz_e1_cash_capture_closed',
        'zz_e1_historical_attribution_closed',
        'zz_e1_pending_receipts_closed'
      )
  )
);
SELECT coalesce(json_agg(row_to_json(q)),'[]'::json) FROM (
  SELECT kind,schema_name,object_name,parent_name,definition FROM (
    SELECT 'table' kind,n.nspname schema_name,c.relname object_name,'' parent_name,
      concat(c.relkind,':',pg_get_userbyid(c.relowner),':',coalesce(c.relacl::text,'')) definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p')
    UNION ALL SELECT 'column',n.nspname,c.relname,a.attname,
      concat(format_type(a.atttypid,a.atttypmod),':',a.attnotnull,':',coalesce(pg_get_expr(d.adbin,d.adrelid),''))
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p')
    UNION ALL SELECT 'constraint',n.nspname,con.conname,c.relname,pg_get_constraintdef(con.oid,true)
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    UNION ALL SELECT 'index',n.nspname,i.relname,t.relname,pg_get_indexdef(i.oid)
      FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
    UNION ALL SELECT 'function',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    UNION ALL SELECT 'trigger',n.nspname,t.tgname,c.relname,pg_get_triggerdef(t.oid,true)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE NOT t.tgisinternal
    UNION ALL SELECT 'sequence',schemaname,sequencename,'',
      concat(data_type,':',start_value,':',min_value,':',max_value,':',increment_by,':',cycle,':',cache_size)
      FROM pg_sequences
  ) inventory
  WHERE schema_name NOT IN ('pg_catalog','information_schema')
    AND schema_name !~ '^pg_(toast|temp)'
  ORDER BY kind,schema_name,object_name,parent_name,definition
) q;
ROLLBACK;
`;

const result = spawnSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
  encoding: "utf8",
  env: process.env,
  input: sql,
  maxBuffer: 8 * 1024 * 1024,
});
if (result.status !== 0) {
  throw new Error(`Read-only startup preflight query failed: ${result.stderr.trim()}`);
}
const lines = result.stdout.split("\n").filter((line) => line.trim() !== "");
if (lines.length !== 2) {
  throw new Error(`Read-only startup preflight returned ${lines.length} records instead of 2.`);
}
const identity = JSON.parse(lines[0]);
const schema = JSON.parse(lines[1]);
const schemaSha256 = createHash("sha256").update(canonical(schema)).digest("hex");
const actual = {
  database: identity.database,
  databaseOid: identity.databaseOid,
  schema: identity.schema,
  role: identity.role,
  serverVersionNum: identity.serverVersionNum,
  tableCount: identity.tableCount,
  schemaRows: schema.length,
  schemaSha256,
  guards: identity.guards,
};
if (identity.readOnly !== "on" || identity.enabledEventTriggers !== 0) {
  throw new Error("Read-only state or event-trigger inventory is unsafe.");
}
if (JSON.stringify(actual) !== JSON.stringify(EXPECTED)) {
  throw new Error(`Read-only startup preflight mismatch: ${JSON.stringify(actual)}`);
}
process.stdout.write(`LIMITED_READONLY_PREFLIGHT=PASS ${JSON.stringify(actual)}\n`);