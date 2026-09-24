import fs from "node:fs";
import {createHash} from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const root=process.cwd(),r=root+"/.local/tanda-g-ampliada",out=root+"/reports/tanda-g-ampliada/tarea-4";
const cfg=JSON.parse(fs.readFileSync(r+"/worker-databases.json")).performance;
const c=new pg.Client({connectionString:cfg.url});await c.connect();
try{
 const identity=(await c.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
 if(identity.db!=="tanda_ga_performance"||identity.actor!=="ga_performance"||identity.port!==55442)throw Error("Isolation mismatch");
 const before=JSON.parse(fs.readFileSync(out+"/load-results.json"));
 const indexes=(await c.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=ANY($1) order by tablename,indexname",[Object.keys(before.before)])).rows;
 const indexUnchanged=JSON.stringify(indexes)===JSON.stringify(before.indexes);
 const manifest=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/build-identity.json"));
 const actualHash=createHash("sha256").update(fs.readFileSync(r+"/frozen-source/artifacts/api-server/dist/index.mjs")).digest("hex");
 const size=(await c.query("select pg_database_size(current_database())::text bytes")).rows[0];
 const range=(await c.query("select min(created_at)::text first,max(created_at)::text last,count(*)::int tickets,count(distinct created_at::date)::int days,count(distinct ubicacion_id)::int stores from tickets where folio>1800000000")).rows[0];
 const credit=(await c.query("select count(*)::int n from operaciones_credito_e1 where solicitud_canonica->>'benchmark'='true'")).rows[0].n;
 if(!indexUnchanged||actualHash!==manifest.apiSha256)throw Error("Verification mismatch");
 fs.writeFileSync(out+"/verification.json",JSON.stringify({identity,indexUnchanged,apiHashMatchesFrozenManifest:true,apiSha256:actualHash,sourceCommit:manifest.commit,sourceArchiveSha256:manifest.sourceArchiveSha256,size,syntheticRange:range,syntheticCreditOperations:credit,noActorCredentialsUsed:true},null,2));
 console.log("Identity, unchanged indexes and frozen source hash verified");
}finally{await c.end();}