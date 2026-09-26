import fs from "node:fs";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const target = JSON.parse(fs.readFileSync("/tmp/priority-20260926/test-env.json")).TEST_DATABASE_URL;
const catalogSql = `
 SELECT 'constraint' kind, n.nspname||'.'||c.relname||'.'||con.conname name,
 pg_get_constraintdef(con.oid,true) definition
 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND con.contype<>'n'
 UNION ALL SELECT 'index',schemaname||'.'||indexname,indexdef FROM pg_indexes WHERE schemaname='public'
 UNION ALL SELECT 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid,true)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL SELECT 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
 UNION ALL SELECT 'column',n.nspname||'.'||c.relname||'.'||a.attname,
 format_type(a.atttypid,a.atttypmod)||' notnull='||a.attnotnull::text||' default='||coalesce(pg_get_expr(d.adbin,d.adrelid),'')
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
 ORDER BY 1,2`;
async function read(url) {
  const c = new pg.Client({ connectionString: url, options: "-c default_transaction_read_only=on" });
  await c.connect(); await c.query("BEGIN READ ONLY");
  const rows = (await c.query(catalogSql)).rows;
  await c.query("ROLLBACK"); await c.end(); return rows;
}
const [source, copy] = await Promise.all([read(process.env.DATABASE_URL), read(target)]);
const equal = JSON.stringify(source) === JSON.stringify(copy);
const counts = rows => Object.fromEntries([...new Set(rows.map(r => r.kind))].map(k => [k, rows.filter(r => r.kind === k).length]));
const differences = [...new Set([...source, ...copy].map(r => `${r.kind}:${r.name}`))].filter(k =>
  JSON.stringify(source.find(r => `${r.kind}:${r.name}` === k)) !== JSON.stringify(copy.find(r => `${r.kind}:${r.name}` === k)));
const applicationDefinitionsEqual = differences.every(k => k === "function:public.fips_mode()");
const evidence = { at: new Date().toISOString(), readOnly: true, equal, applicationDefinitionsEqual, differences,
  versionDifference: "Target pgcrypto adds fips_mode(); newer PostgreSQL exposes NOT NULL in pg_constraint. Column NOT NULL compared explicitly, contype=n excluded.",
  scope: "Exact ordered definitions of public constraints, indexes, noninternal triggers, functions/procedures; owners/ACL intentionally excluded",
  source: counts(source), copy: counts(copy) };
fs.writeFileSync(new URL("./catalog-verification.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
if (!applicationDefinitionsEqual) process.exitCode = 1;