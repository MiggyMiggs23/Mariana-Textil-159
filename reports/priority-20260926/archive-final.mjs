import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
const dir="reports/priority-20260926/forensic-preservation";
fs.mkdirSync(dir,{recursive:true});
const at=new Date().toISOString(),stamp=at.replaceAll(":","-");
const archives=[];
for(const [scope,file] of [
  ["original","/tmp/priority-20260926/browser/state.json"],
  ["fiscal","/tmp/priority-fiscal-20260926/browser/state.json"],
  ["performance","/tmp/priority-perf-20260926/browser/state.json"],
]) {
  if(!fs.existsSync(file))continue;
  const data=fs.readFileSync(file),state=JSON.parse(data);
  const safe=[];
  const walk=(v,path=[])=>{
    if(Array.isArray(v)){v.forEach((item,i)=>walk(item,[...path,String(i)]));return;}
    if(v&&typeof v==="object"){for(const[k,value]of Object.entries(v)){
      if(/password|secret|token|cookie|usuario|username|nombre|email|phone|telefono|rfc|body|response|request|sql|params/i.test(k))continue;
      walk(value,[...path,k]);
    }return;}
    const key=path.at(-1)||"";
    if(/^(id|.*Id|status|estado|resultado|tipo|at|.*At|inicio|fin|revision|confirmed|terminal|count|total|.*Count|folio)$/.test(key) &&
      (v===null || typeof v==="number" || typeof v==="boolean" ||
       (typeof v==="string" && (/^[A-Z_]+$/.test(v) || /^[0-9a-f-]{36}$/i.test(v) ||
        /^\d{4}-\d\d-\d\d(?:T[0-9:.]+Z)?$/.test(v) || /^\d+(?:\.\d+)?$/.test(v))))
    )safe.push({path:path.join("."),value:v});
  };
  walk(state);
  const name=`${scope}-terminal-journal-${stamp}.json`;
  fs.writeFileSync(`${dir}/${name}`,JSON.stringify({capturedAt:at,scope,
    snapshotSha256:crypto.createHash("sha256").update(data).digest("hex"),
    sourceDeletedAfterArchival:true,fields:safe,
    operationKeys:Object.keys(state.operations||{}),reconciliationKeys:Object.keys(state.reconciliations||{}),
    note:"Final preservation snapshot, not an assertion every operation succeeded; only allowlisted IDs/statuses/timestamps/numbers retained."},null,2));
  archives.push(name);
}
const observer="/tmp/priority-fiscal-20260926/sanitized-pool-observer.ndjson";
if(fs.existsSync(observer)){
  const allowed=new Set(["atReal","monotonicMs","event","connectionTimeoutMillis","statementTimeoutMillis","queryTimeoutMillis","total","idle","waiting","max","phase","actor","readOnly","intentSha256","workCompleted","causes","name","code","messageSha256","category","acquireId","durationMs","clientId","pid","queryId","verb","shapeSha256","loans","ageMs","rows","state","wait_event_type","wait_event","blockers","transaction_age_seconds","query_age_seconds"]);
  const check=v=>{if(Array.isArray(v))return v.forEach(check);if(v&&typeof v==="object")for(const[k,value]of Object.entries(v)){if(!allowed.has(k))throw Error("Unexpected observer field");check(value);}};
  const lines=fs.readFileSync(observer,"utf8").split("\n");if(lines.at(-1)!=="")lines.pop();
  const records=lines.filter(Boolean).map(line=>JSON.parse(line));records.forEach(check);
  const name=`fiscal-terminal-sanitized-observer-${stamp}.ndjson`;
  fs.writeFileSync(`${dir}/${name}`,records.map(r=>JSON.stringify(r)).join("\n")+"\n");archives.push(name);
}
const ports=[];
for(const port of [18227,18228,18237,18238,18247,18248]){
  const status=await new Promise(resolve=>{const s=net.connect({host:"127.0.0.1",port});s.setTimeout(1000);
    s.on("connect",()=>{s.destroy();resolve("LISTENING")});s.on("error",e=>resolve(e.code));s.on("timeout",()=>{s.destroy();resolve("TIMEOUT")});});
  ports.push({port,status});
}
if(ports.some(p=>p.status!=="ECONNREFUSED"))throw Error("Private runtime still listening");
const log="/tmp/priority-20260926/private-api.log";
const residual={status:"NOT_EXTRACTED_SCOPE_RESTRICTION",logExisted:fs.existsSync(log),
  bytes:fs.existsSync(log)?fs.statSync(log).size:0,
  explanation:"Worker developer scope prohibits reading workflow/console logs, including local parsing of private API console output. No log content inspected; residual login500 cause not established by this worker."};
fs.writeFileSync("reports/priority-20260926/residual-login-cause.json",JSON.stringify(residual,null,2));
fs.writeFileSync("reports/priority-20260926/final-archival.json",JSON.stringify({at,archives,ports,residualLoginCause:residual,
  noDatabaseAccess:true,noTeardownYet:true},null,2));
console.log(JSON.stringify({at,archives,ports,residualCause:residual.status}));