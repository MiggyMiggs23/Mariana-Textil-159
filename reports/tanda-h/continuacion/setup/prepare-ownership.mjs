// Copy-only ownership preparation. Never connects to the effective application.
import fs from "node:fs";
import pg from "/home/runner/workspace/scripts/node_modules/pg/lib/index.js";
const r="/home/runner/workspace/private.local/tanda-h-resume";
const result=[];
for(const worker of ["browser"]){
 const c=new pg.Client({host:"127.0.0.1",port:55445,user:"postgres",database:"tanda_hr_"+worker});
 await c.connect();
 try{
  const identity=(await c.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port")).rows[0];
  if(identity.db!=="tanda_hr_"+worker||identity.directory!==r+"/cluster"||identity.port!==55445)throw Error("Copy ownership identity mismatch");
  const tables=(await c.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  await c.query("BEGIN");
  for(const {tablename} of tables)await c.query(`ALTER TABLE public."${tablename.replaceAll('"','""')}" OWNER TO hr_${worker}`);
  await c.query("COMMIT");
  result.push({identity,owner:"hr_"+worker,tableCount:tables.length,purpose:"Worker may apply constraints/indexes on its own copy only; no proposed DDL applied"});
 }finally{await c.end();}
}
fs.writeFileSync("reports/tanda-h/continuacion/setup/copy-ownership.json",JSON.stringify(result,null,2));