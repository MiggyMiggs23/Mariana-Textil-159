import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const report=new URL("./",import.meta.url);
const query=`SELECT 'constraint' kind,n.nspname||'.'||c.relname||'.'||x.conname name,pg_get_constraintdef(x.oid,true) definition
 FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND x.contype<>'n'
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
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2`;
async function read(url){
 const c=new pg.Client({connectionString:url,options:"-c default_transaction_read_only=on"});
 await c.connect();await c.query("BEGIN READ ONLY");
 const identity=(await c.query("SELECT current_database() database,current_setting('server_version') version,current_setting('transaction_read_only') readonly")).rows[0];
 const rows=(await c.query(query)).rows;await c.query("ROLLBACK");await c.end();
 return {identity,rows};
}
const source=await read(process.env.DATABASE_URL),copies=[];
for(const kind of ["runtime"]){
 const db=`print_corrections_20260926`;
 const target=await read(JSON.parse(fs.readFileSync(`/tmp/print-corrections-20260926/${db}/test-env.json`)).TEST_DATABASE_URL);
 const map=rows=>new Map(rows.map(r=>[`${r.kind}:${r.name}`,r.definition]));
 const s=map(source.rows),t=map(target.rows);
 const differences=[...new Set([...s.keys(),...t.keys()])].filter(k=>s.get(k)!==t.get(k));
 const businessEqual=differences.every(k=>k==="function:public.fips_mode()");
 const digest=rows=>crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
 copies.push({kind,identity:target.identity,businessEqual,differences,sourceCatalogSha256:digest(source.rows),targetCatalogSha256:digest(target.rows),
 counts:Object.fromEntries([...new Set(target.rows.map(r=>r.kind))].map(k=>[k,target.rows.filter(r=>r.kind===k).length]))});
}
const evidence={at:new Date().toISOString(),source:source.identity,copies,
 normalization:"NOT NULL catalog rows vary byPGversion; compared explicit column.notnull instead. Target pgcrypto extra fips_mode disclosed; owners/ACL excluded. No schema/data initializers."};
fs.writeFileSync(new URL("./catalog-verification.json",report),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence));
if(copies.some(c=>!c.businessEqual))process.exitCode=1;