// Copy-only ownership preparation. Never connects to the effective application.
import fs from "node:fs";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const r="/home/runner/workspace/.local/tanda-h";
const result=[];
for(const worker of ["inventory","performance"]){
 const c=new pg.Client({host:"127.0.0.1",port:55444,user:"postgres",database:"tanda_h_"+worker});
 await c.connect();
 try{
  const identity=(await c.query("select current_database() db,current_setting('data_directory') directory,inet_server_port() port")).rows[0];
  if(identity.db!=="tanda_h_"+worker||identity.directory!==r+"/cluster"||identity.port!==55444)throw Error("Copy ownership identity mismatch");
  const tables=(await c.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  await c.query("BEGIN");
  for(const {tablename} of tables)await c.query(`ALTER TABLE public."${tablename.replaceAll('"','""')}" OWNER TO h_${worker}`);
  await c.query("COMMIT");
  result.push({identity,owner:"h_"+worker,tableCount:tables.length,purpose:"Worker may apply constraints/indexes on its own copy only; no proposed DDL applied"});
 }finally{await c.end();}
}
fs.writeFileSync("reports/tanda-h/setup/copy-ownership.json",JSON.stringify(result,null,2));