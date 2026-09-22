// Post-release observation and evidence retention only; never restart the API.
import fs from "node:fs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
const out="reports/e2-liberacion-20260922";
const pkg="reports/e2-paquete-liberacion-preparado-20260921";
const json=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(`${out}/${p}`,JSON.stringify(x,null,2)+"\n");
const sha=p=>createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const audit=fs.readFileSync("reports/arranques-api.log","utf8").trim().split("\n").map(JSON.parse);
assert.equal(audit.length,1,"Exactly one release attempt");
assert.equal(audit[0].api_exec_attempted,true);
assert.equal(audit[0].preflight.result,"passed");
const pid=audit[0].pid;
const args=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0").filter(Boolean);
assert.ok(args.includes("artifacts/api-server/dist-e2-20260927/index.mjs"));
const runtime=Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`,"utf8").split("\0").filter(Boolean).map(s=>{const i=s.indexOf("=");return[s.slice(0,i),s.slice(i+1)]}));
assert.equal(runtime.DATABASE_URL,process.env.DATABASE_URL,"Runtime connection differs");
assert.equal(runtime.API_INSPECTION_BOOT,"1");
assert.equal(runtime.NODE_ENV,"development");
assert.equal(runtime.PORT,"8080");
const flags=["FONDO_E10_ENABLED","CREDIT_REFUNDS_ENABLED","CREDIT_CASH_INCOME_ENABLED",
  "CREDIT_ABONO_EVIDENCE_ENABLED","CREDIT_PENDING_RECEIPTS_ENABLED","CREDIT_HISTORICAL_ATTRIBUTION_ENABLED"];
for(const f of flags)assert.ok(!runtime[f]||["0","false"].includes(runtime[f]),`Closed flag ${f}`);
assert.ok(!runtime.NODE_OPTIONS);
const trace=fs.readFileSync(`${out}/candidate-worker-open.trace`,"utf8");
const workerOpens={};
for(const worker of ["thread-stream-worker.mjs","pino-pretty.mjs"]) {
  const lines=trace.split("\n").filter(l=>l.includes(`/home/runner/workspace/artifacts/api-server/dist-e2-20260927/${worker}"`)&&/= \d+$/.test(l));
  assert.ok(lines.length>0);
  for(const line of lines)assert.ok(fs.existsSync(`/proc/${pid}/task/${line.trim().split(/\s+/)[0]}`),"Worker open must belong to running API thread group");
  workerOpens[worker]=lines;
}
const log=fs.readFileSync("/tmp/logs/artifactsapi-server_API_Server_20260922_151456_303_58e94bd9.log","utf8");
assert.match(log,/E2_COMPLETE_RELEASE_PREFLIGHT=PASS/);
assert.match(log,/Inspection boot: schema initializers, purchase backfill and stock-minimum monitor are paused/);
fs.writeFileSync(`${out}/startup-log-preserved.log`,log);
save("startup-audit-preserved.json",audit);
const health=await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/healthz`);
assert.equal(health.status,200);
assert.deepEqual(await health.json(),{status:"ok"});
assert.equal(sha("artifacts/api-server/dist/index.mjs"),"3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98");
assert.equal(sha("artifacts/api-server/dist-e2-20260927/index.mjs"),"008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5");
for(const file of ["release-assets.sha256","manifest-final.sha256","package-integrity.sha256"]) {
  assert.equal(spawnSync("sha256sum",["--check","--status",`${pkg}/${file}`]).status,0);
}
assert.equal(json(`${out}/startup-preservation.json`).status,"PASS");
save("runtime-verification.json",{status:"PASS",at:new Date().toISOString(),pid,args,
  mode:{API_INSPECTION_BOOT:runtime.API_INSPECTION_BOOT,NODE_ENV:runtime.NODE_ENV,PORT:runtime.PORT},
  closedFlags:Object.fromEntries(flags.map(f=>[f,runtime[f]??"unset (closed default)"])),
  runtimeConnectionMatchesApprovedSource:true,workerOpens,health:{status:200,body:{status:"ok"}},
  oneReleaseStartup:true,positivePreflightProof:true,inspectionLogVerified:true,
  approvedPackageHashesUnchanged:true,retainedAndCandidateBundleHashesUnchanged:true,
  observation:"Existing workflow invokes the exact approved bash wrapper under read-only strace openat observation. No wrapper/bundle/preload change."});
const stops=[];
for(const record of [json(`${out}/e2-backup-restore-20260922-metadata.json`),json(`${out}/drive-restoration.json`)]) {
  const restore=record.restore;
  assert.ok(restore.clusterDirectory.startsWith("/home/runner/workspace/.local/backups/e2-release-backup-20260922-"));
  const r=spawnSync(`${restore.postgresBinaryDirectory}/pg_ctl`,["-D",restore.clusterDirectory,"-m","fast","-w","stop"],{encoding:"utf8",timeout:30000});
  assert.equal(r.status,0,r.stderr);
  stops.push({cluster:restore.clusterDirectory,stopExit:r.status,dataDirectoryPreserved:fs.existsSync(restore.clusterDirectory),removed:false});
}
save("disposable-clusters-retained.json",{at:new Date().toISOString(),clusters:stops,noBackupsOrEvidenceDeleted:true});
console.log("RUNTIME_WORKERS_HEALTH_HASHES=PASS; DISPOSABLE_CLUSTERS_STOPPED_AND_RETAINED");