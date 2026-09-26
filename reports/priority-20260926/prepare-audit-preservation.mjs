import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const read = p => JSON.parse(fs.readFileSync(p));
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const config = read("reports/priority-20260926/candidate.json");
if (config.apiSha256 !== "1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e" ||
    config.frontendFiles["index.html"] !== "02e8384c8f458daa0d29a958bc1c519ca7e2b75705a47db3d8b514527965ad78")
  throw Error("Expected v8/lifecycle candidate");
if (sha(fs.readFileSync(config.apiEntry)) !== config.apiSha256) throw Error("API mismatch");
for (const [file, hash] of Object.entries(config.frontendFiles))
  if (sha(fs.readFileSync(`${config.frontendRoot}/${file}`)) !== hash) throw Error("UI mismatch");
const url = new URL(read("/tmp/priority-20260926/test-env.json").TEST_DATABASE_URL);
const authoritative = new URL(read("/tmp/priority-20260926/neon.json").TEST_DATABASE_URL);
if (url.pathname !== "/priority_20260926" || url.hostname.replace("-pooler","") !== authoritative.hostname.replace("-pooler",""))
  throw Error("Original own branch required");
const c = new pg.Client({connectionString:url.href,options:"-c default_transaction_read_only=on"});
await c.connect(); await c.query("BEGIN READ ONLY");
const identity = (await c.query("SELECT current_database() database,current_setting('transaction_read_only') read_only,clock_timestamp() actual_db_clock")).rows[0];
const users = (await c.query(`SELECT u.id,u.usuario,u.rol,coalesce(p.perfil,'F') fiscal_profile
  FROM usuarios u LEFT JOIN e11_perfiles p ON p.usuario_id=u.id WHERE u.id IN (234,237,238) ORDER BY u.id`)).rows;
const credentials = read("/tmp/priority-20260926/credentials.json");
for (const actor of [credentials.admin,...Object.values(credentials.roles)]) {
  if (users.find(u=>u.id===actor.id)?.usuario !== actor.usuario) throw Error("Recovered actor mismatch");
}
const rolls = (await c.query("SELECT id,serie,estado,cantidad_actual::text FROM rollos WHERE ubicacion_id=835 ORDER BY id")).rows;
const defaultClock = (await c.query("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='sesiones' AND column_name='created_at'")).rows[0].column_default;
if (defaultClock !== "now()") throw Error("Original normal-clock session default changed");
const nativeReady = rolls.filter(r=>r.estado==="DISPONIBLE" && Number(r.cantidad_actual)>0);
if (nativeReady.length!==6) throw Error("Expected original six available native rolls");
await c.query("ROLLBACK");await c.end();
const dir="reports/priority-20260926/forensic-preservation";fs.mkdirSync(dir,{recursive:true});
const stamp=new Date().toISOString().replaceAll(":","-");
const snapshots=[];
for (const [scope,file] of [
  ["original","/tmp/priority-20260926/browser/state.json"],
  ["fiscal","/tmp/priority-fiscal-20260926/browser/state.json"],
]) {
  if (!fs.existsSync(file)) continue;
  const bytes=fs.readFileSync(file), state=JSON.parse(bytes);
  const summary={scope,sourceSha256:sha(bytes),capturedAt:new Date().toISOString(),
    ongoingSnapshotNotFinal:true,credentialsExcluded:true,
    actors:Object.entries(state.roles||{}).map(([role,a])=>({role,id:a.id})),
    siteId:state.site?.id,invoiceId:state.sales?.invoice?.id,noteId:state.sales?.note?.id,
    operations:Object.entries(state.operations||{}).map(([key,op])=>({
      key,status:op.status??null,at:op.at??null,
      resultId:typeof op.id==="string"||typeof op.id==="number"?op.id:null,
    })),
    reconciliationKeys:Object.keys(state.reconciliations||{}),
    recoverySectionsPresent:["originalSnapshotResolver","originalSnapshotResolution","confirmedSnapshotRecovery","confirmedDecisionRecovery"].filter(k=>k in state),
  };
  const name=`${scope}-journal-${stamp}.json`;fs.writeFileSync(`${dir}/${name}`,JSON.stringify(summary,null,2));snapshots.push(name);
}
// Read only the explicitly sanitized instrumentation, never private API/stdout logs.
const observer="/tmp/priority-fiscal-20260926/sanitized-pool-observer.ndjson";
let observerArchive=null;
if(fs.existsSync(observer)){
  const allowed=new Set(["atReal","monotonicMs","event","connectionTimeoutMillis","statementTimeoutMillis","queryTimeoutMillis","total","idle","waiting","max","phase","actor","readOnly","intentSha256","workCompleted","causes","name","code","messageSha256","category","acquireId","durationMs","clientId","pid","queryId","verb","shapeSha256","loans","ageMs","rows","state","wait_event_type","wait_event","blockers","transaction_age_seconds","query_age_seconds"]);
  const check=v=>{if(Array.isArray(v)){v.forEach(check);return;}if(v&&typeof v==="object")for(const[k,value]of Object.entries(v)){if(!allowed.has(k))throw Error("Unknown observer field; refusing archive");check(value);}};
  const lines=fs.readFileSync(observer,"utf8").split("\n");
  if(lines.at(-1)!=="")lines.pop(); // live append may leave incomplete final record
  const records=lines.filter(Boolean).map(line=>JSON.parse(line));records.forEach(check);
  observerArchive=`fiscal-sanitized-observer-${stamp}.ndjson`;
  fs.writeFileSync(`${dir}/${observerArchive}`,records.map(r=>JSON.stringify(r)).join("\n")+"\n");
}
const ready={status:"ORIGINAL_NORMAL_CLOCK_AUDIT_READY_NOT_STARTED",...identity,
  branch:"br-snowy-sea-ax2ft2er",apiSha256:config.apiSha256,frontendIndexSha256:config.frontendFiles["index.html"],
  users,siteId:835,rolls,availableRolls:nativeReady.length,sessionCreatedAtDefault:defaultClock,
  noDbWrites:true,fiscalAuditNotReused:true,clock:"system",ports:[18227,18228],
  launcher:"node reports/priority-20260926/launch-private.mjs",
  preservation:{ongoingNotFinal:true,snapshots,observerArchive,privateCredentialsNotArchived:true,noTeardown:true},
  capturedAt:new Date().toISOString()};
fs.writeFileSync("reports/priority-20260926/audit-ready.json",JSON.stringify(ready,null,2));
console.log(JSON.stringify({status:ready.status,availableRolls:ready.availableRolls,clock:ready.clock,preservation:ready.preservation}));