import fs from "node:fs";
import {pathToFileURL} from "node:url";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const root="/home/runner/workspace", r=root+"/.local/tanda-h", report=root+"/reports/tanda-h/setup";
fs.mkdirSync(r,{recursive:true,mode:0o700});fs.chmodSync(r,0o700);
const candidates=fs.readdirSync("/proc").filter(x=>/^\d+$/.test(x)).filter(pid=>{
 try{return fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0").some(x=>/^(?:.*\/)?artifacts\/api-server\/dist[^/]*\/index\.mjs$/.test(x));}catch{return false;}
});
if(candidates.length!==1)throw Error("Exactly one effective application API required");
const pid=Number(candidates[0]);
const vars=Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`,"utf8").split("\0").filter(x=>x.includes("=")).map(x=>[x.slice(0,x.indexOf("=")),x.slice(x.indexOf("=")+1)]));
const url=vars.TEST_DATABASE_URL||vars.DATABASE_URL;
if(!url)throw Error("Effective API URL missing");
if(process.argv.includes("--capture")){
 const c=new pg.Client({connectionString:url,options:"-c default_transaction_read_only=on",connectionTimeoutMillis:8000});
 await c.connect();
 try{
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const identity=(await c.query("select current_database() database,current_user db_user,inet_server_addr() server_address,inet_server_port() server_port,current_setting('server_version_num') version,current_setting('transaction_read_only') read_only,pg_postmaster_start_time() server_start")).rows[0];
  const counts=[];
  for(const [table,column] of [["rollos","cantidad_inicial"],["rollos","cantidad_actual"],["existencias","cantidad_total"]]){
   const row=(await c.query(`SELECT count(*)::text total,count(*) FILTER(WHERE ${column}<0)::text negative,count(*) FILTER(WHERE ${column} IS NULL)::text nulls,count(*) FILTER(WHERE ${column}::text='NaN')::text nan,count(*) FILTER(WHERE ${column}::text IN ('Infinity','-Infinity'))::text infinity FROM ${table}`)).rows[0];
   counts.push({table,column,...row});
  }
  fs.writeFileSync(report+"/quantity-preflight.json",JSON.stringify({at:new Date().toISOString(),apiPid:pid,identity,counts,readOnly:true,scope:"Physical roll initial/current quantities and inventory cache; signed ledger excluded"},null,2));
  if(counts.some(x=>["negative","nulls","nan","infinity"].some(k=>BigInt(x[k])!==0n)))throw Error("INVALID PHYSICAL QUANTITIES: stop; no fix authorized");
  await c.query("COMMIT");
 }finally{await c.end();}
}
process.env.DATABASE_URL=url;
let text=fs.readFileSync(root+"/reports/tanda-f/setup/prepare.mjs","utf8")
 .replaceAll("tanda-f","tanda-h").replaceAll("tanda_f","tanda_h")
 .replaceAll("TANDA F","TANDA H").replaceAll("TANDA-F","TANDA-H").replaceAll("tandaf","tandah").replaceAll("AZUL TF","AZUL TH")
 .replaceAll('"TFA","TFB","TFC"','"HAA","HAB","HAC"').replaceAll("55440","55444").replaceAll("994000000","997000000")
 .replace('const pid=180;',`const pid=${pid};`)
 .replace('command.includes("artifacts/api-server/dist-tanda-e-20260923/index.mjs")','/^.*artifacts\\/api-server\\/dist[^/]*\\/index\\.mjs/.test(command)')
 .replace('.find(x=>x.startsWith("DATABASE_URL="))?.slice(13)',`.find(x=>x.startsWith(${JSON.stringify(vars.TEST_DATABASE_URL?"TEST_DATABASE_URL=":"DATABASE_URL=")}))?.slice(${vars.TEST_DATABASE_URL?18:13})`)
 .replace('"../../../scripts/node_modules/pg/lib/index.js"',JSON.stringify(root+"/scripts/node_modules/pg/lib/index.js"))
 .replace('["browser","concurrency","permissions","reversal"]','["inventory","performance","permissions"]')
 .replace('["template","browser","concurrency","permissions","reversal","witness"]','["template","inventory","performance","permissions","witness"]')
 .replace('four independent copies','three independent worker copies plus witness');
fs.writeFileSync(r+"/prepare-generated.mjs",text,{mode:0o600});
await import(pathToFileURL(r+"/prepare-generated.mjs").href);