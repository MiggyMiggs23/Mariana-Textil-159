// Explicit MAIN COPY-only authorization. Never accepts an arbitrary database URL.
import fs from "node:fs";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const out="reports/tanda-h/tarea-2";
const pre=JSON.parse(fs.readFileSync(out+"/pre.json"));
const cfg=JSON.parse(fs.readFileSync(".local/tanda-h/worker-databases.json")).performance;
const c=new pg.Client({connectionString:cfg.url});await c.connect();
try{
 const identity=(await c.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
 if(identity.db!=="tanda_h_performance"||identity.actor!=="h_performance"||identity.port!==55444)throw Error("COPY identity mismatch");
 const statements=fs.readFileSync(out+"/approved-indexes.sql","utf8").replace(/^--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean);
 const names=["tickets_pendientes_corte_ga_candidate","tickets_contabilizados_sitio_fecha_ga_candidate"];
 if(statements.length!==2||statements.some((s,i)=>!s.startsWith("CREATE INDEX CONCURRENTLY "+names[i]+"\nON public.tickets")))throw Error("Allowlist mismatch");
 // Catalog reviewed: site/date two-column nonpartial index is not a
 // replacement for three-key partial cut index; no accounted-date expression exists.
 if(pre.indexes.some(i=>names.includes(i.index)))throw Error("Candidate already exists");
 const results=[];
 for(const sql of statements){const start=performance.now();await c.query(sql);results.push({sql,elapsedMs:performance.now()-start});}
 const indexes=(await c.query("select indexname,indexdef from pg_indexes where schemaname='public' and indexname=ANY($1)",[names])).rows;
 fs.writeFileSync(out+"/copy-ddl.json",JSON.stringify({identity,authorization:"Explicit MAIN COPY-only",prefixReview:"Existing site/date nonpartial index lacks ID and cut predicate; no site/accounted-date expression prefix exists. Other existing key prefixes differ. Only approved two candidates applied.",results,indexes},null,2));
}finally{await c.end();}