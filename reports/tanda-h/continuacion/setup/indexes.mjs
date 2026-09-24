// Copy-only catalog guarded indexes. Never uses an ambient application URL.
import fs from "node:fs";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";
const root=process.cwd(), r=root+"/private.local/tanda-h-resume", out=root+"/reports/tanda-h/continuacion/setup";
const cfg=JSON.parse(fs.readFileSync(r+"/worker-databases.json")).browser;
const c=new pg.Client({connectionString:cfg.url});await c.connect();
try{
 const identity=(await c.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
 if(identity.db!=="tanda_hr_browser"||identity.actor!=="hr_browser"||identity.port!==55445)throw Error("Copy guard failed");
 const expected=JSON.parse(fs.readFileSync(root+"/reports/tanda-h/tarea-2/copy-ddl.json")).indexes;
 const sql=fs.readFileSync(root+"/reports/tanda-h/tarea-2/approved-indexes.sql","utf8").replace(/^--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean);
 const proof=[];
 for(const statement of sql){
  const name=statement.match(/^CREATE INDEX CONCURRENTLY (\w+)/)?.[1];
  const wanted=expected.find(x=>x.indexname===name);
  if(!wanted)throw Error("Index allowlist mismatch");
  const catalog=()=>c.query("select ci.relname indexname,pg_get_indexdef(i.indexrelid) indexdef,i.indisvalid,i.indisready from pg_index i join pg_class ci on ci.oid=i.indexrelid where i.indrelid='public.tickets'::regclass");
  let rows=(await catalog()).rows;
  const signature=s=>s.replace(/^CREATE INDEX \w+ /,"CREATE INDEX ");
  const named=rows.find(x=>x.indexname===name);
  if(named&&(named.indexdef!==wanted.indexdef||!named.indisvalid||!named.indisready))throw Error("Named catalog mismatch");
  const equivalent=rows.find(x=>signature(x.indexdef)===signature(wanted.indexdef));
  if(equivalent&&(!equivalent.indisvalid||!equivalent.indisready))throw Error("Invalid equivalent index");
  if(!equivalent)await c.query(statement);
  rows=(await catalog()).rows;
  const verified=rows.find(x=>signature(x.indexdef)===signature(wanted.indexdef)&&x.indisvalid&&x.indisready);
  if(!verified)throw Error("Post-DDL catalog mismatch");
  proof.push({requested:name,action:equivalent?"retained exact catalog equivalent":"created on copy",...verified});
 }
 fs.writeFileSync(out+"/copy-indexes.json",JSON.stringify({identity,proof},null,2));
}finally{await c.end();}