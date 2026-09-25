import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import pg from "../../../artifacts/api-server/node_modules/pg/lib/index.js";

// Evidence only. Never logs provider errors, raw rows, identities or secrets.
const mode = process.argv[2];
if (!["before", "after"].includes(mode)) throw new Error("Use before|after");
const output = new URL(`./${mode}.json`, import.meta.url);
try {
  await access(output);
  throw new Error("Evidence already exists; refusing overwrite");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const quote = value => `"${value.replaceAll('"', '""')}"`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout='60s'");
  const readOnly = (await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only;
  if (readOnly !== "on") throw new Error("Read-only transaction required");
  const identity = (await client.query(`SELECT current_database() AS db,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
    inet_server_addr()::text AS address,inet_server_port()::text AS port,
    current_setting('server_version_num') AS version`)).rows;
  const relations = (await client.query(`SELECT c.relname AS name,c.relkind AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','f') ORDER BY c.relname`)).rows;
  if (relations.some(row => row.kind !== "r")) throw new Error("Unexpected relation type");
  const columns = (await client.query(`SELECT table_name,column_name,ordinal_position,data_type,
    character_maximum_length,numeric_precision,numeric_scale,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public'
    ORDER BY table_name,ordinal_position`)).rows;
  const constraints = (await client.query(`SELECT c.relname AS relation,k.conname,
    pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k
    JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' ORDER BY c.relname,k.conname`)).rows;
  const indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes
    WHERE schemaname='public' ORDER BY tablename,indexname`)).rows;
  const triggers = (await client.query(`SELECT c.relname AS relation,t.tgname,t.tgenabled,
    pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    ORDER BY c.relname,t.tgname`)).rows;
  const tables = {};
  for (const { name } of relations) {
    tables[name] = (await client.query(`SELECT count(*)::text AS count,
      encode(digest(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'sha256'),'hex') AS sha256
      FROM public.${quote(name)} t`)).rows[0];
  }
  await client.query("COMMIT");
  const snapshot = {
    capturedAt: new Date().toISOString(),
    transactionReadOnly: readOnly,
    databaseFingerprint: hash([new URL(process.env.DATABASE_URL).hostname, identity]),
    schemaFingerprint: hash({ relations, columns, constraints, indexes, triggers }),
    tables,
  };
  if (mode === "after") {
    const before = JSON.parse(await readFile(new URL("./before.json", import.meta.url), "utf8"));
    const names = [...new Set([...Object.keys(before.tables), ...Object.keys(tables)])];
    snapshot.comparison = {
      sameDatabase: before.databaseFingerprint === snapshot.databaseFingerprint,
      sameSchema: before.schemaFingerprint === snapshot.schemaFingerprint,
      changedCounts: names.filter(name => before.tables[name]?.count !== tables[name]?.count),
      changedHashes: names.filter(name => before.tables[name]?.sha256 !== tables[name]?.sha256),
    };
    snapshot.passed = snapshot.comparison.sameDatabase && snapshot.comparison.sameSchema
      && snapshot.comparison.changedCounts.length === 0 && snapshot.comparison.changedHashes.length === 0;
  }
  await writeFile(output, JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ mode, tables: relations.length, readOnly,
    ...(mode === "after" ? { passed: snapshot.passed, comparison: snapshot.comparison } : {}) }));
  if (mode === "after" && !snapshot.passed) process.exitCode = 1;
} catch {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Read-only evidence capture failed; no application writes attempted.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}