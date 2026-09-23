// Pure preparation: preserves all r4 SQL, capture, FAIL and seal bytes.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {root,report,json,digest,write,verifyPreparation,verifyOutputs} from "./common.mjs";
verifyPreparation();verifyOutputs();
const old=path.join(report,"r4"),out=path.join(report,"r5");
for(const [p,h] of Object.entries(json(path.join(old,"preparation-inputs.json")).files))
  assert.equal(digest(fs.readFileSync(path.join(root,p))),h,`r4 input changed: ${p}`);
fs.mkdirSync(path.join(out,"sql"));fs.mkdirSync(path.join(out,"evidencia/live"),{recursive:true});
const copy=f=>fs.copyFileSync(path.join(old,f),path.join(out,f),fs.constants.COPYFILE_EXCL);
for(const f of ["common.mjs","projection.mjs","auxiliary-multiset.mjs","loopback-start.mjs",
  "auxiliary-catalog.sql","release-catalog.sql","preflight.mjs","finalize.mjs",
  "autorizacion-cuatro-reemplazos-e5.txt","autorizacion-propietario-tanda-b-b0-b1.txt",
  "fase-b-NO-EJECUTADA.txt","source-manifest.json","release-assets.sha256"])copy(f);
for(const f of fs.readdirSync(path.join(old,"sql")))copy(`sql/${f}`);
for(const f of ["catalog-B0-real.json","auxiliary-B0-real.json","capture.json"])copy(`evidencia/live/${f}`);
for(const f of ["controls-offline-final.json","static-audit.json","source-gates.json","sql-syntax-unit.json","sql-syntax-unit.log",
  "multiset-offline-audit.json","multiset-unit.log"])copy(`evidencia/${f}`);
write(path.join(out,"evidencia/reused-baseline.json"),{...json(path.join(old,"evidencia/reused-baseline.json")),
  copiedFromRevision:"r4",runnerRevision:"r5-http-off-contract-only",freshReadOnlyPreflightExecuted:false});
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,`Unique anchor ${a}`);return s.replace(a,b);};
let runner=fs.readFileSync(path.join(old,"run-main.mjs"),"utf8");
runner=once(runner,'process.env.TANDA_B_ATTEMPT,"r4"','process.env.TANDA_B_ATTEMPT,"r5"');
runner=once(runner,'assert.equal(json(path.join(report,"evidencia/multiset-offline-audit.json")).status,"PASS");',
  'assert.equal(json(path.join(report,"evidencia/multiset-offline-audit.json")).status,"PASS");\nassert.equal(json(path.join(report,"evidencia/http-off-contracts-unit.json")).status,"PASS");');
fs.writeFileSync(path.join(out,"run-main.mjs"),runner,{flag:"wx"});
let rehearsal=fs.readFileSync(path.join(old,"rehearse.mjs"),"utf8");
const start=rehearsal.indexOf('        const health=await fetch('),end=rehearsal.indexOf('        return {status:"PASS_INSPECTION_START"',start);
assert.ok(start>=0&&end>start);
rehearsal='import {routes as offRoutes,assertHttpContract} from "./http-off-contracts.mjs";\n'+
  rehearsal.slice(0,start)+`        const probes=[];
        for(const [i,route] of ["/healthz",...offRoutes].entries()) {
          const r=await fetch(\`http://127.0.0.1:\${port}/api\${route}\`,{signal:AbortSignal.timeout(3000)});
          const observation={route,status:r.status,bodyText:await r.text(),
            contentType:r.headers.get("content-type"),contract:label,
            scope:"Actual unauthenticated HTTP observation; not role/actor integration"};
          // Preserve every status and raw body BEFORE asserting the contract.
          write(path.join(evidence,\`http-\${label}-\${i}.json\`),observation);
          assertHttpContract(label,route,observation);
          probes.push(observation);
        }
`+rehearsal.slice(end);
fs.writeFileSync(path.join(out,"rehearse.mjs"),rehearsal,{flag:"wx"});
write(path.join(out,"sql-inventory.json"),{...json(path.join(old,"sql-inventory.json")),runnerRevision:"r5-http-off-contract-only"});
write(path.join(out,"manifest.json"),{...json(path.join(old,"manifest.json")),
  status:"R5_HTTP_OFF_CONTRACT_PREPARED_NOT_VALIDATED",runnerRevision:"r5-http-off-contract-only",
  pending:["FRESH_READONLY_PREFLIGHT_SAME_B0_AND_PIN","R5_DISPOSABLE_COMPLETE","EXACT_HTTP_OFF_CONTRACTS","MAIN_REVIEW"]});
fs.writeFileSync(path.join(out,"manifest.sha256"),`${digest(fs.readFileSync(path.join(out,"manifest.json")))}  reports/tanda-b-b0-b1-20260923/r5/manifest.json\n`,{flag:"wx"});
const tests=execFileSync(process.execPath,["--test",path.join(out,"http-off-contracts.test.mjs")],{cwd:root,encoding:"utf8"});
fs.writeFileSync(path.join(out,"evidencia/http-off-contracts-unit.log"),tests,{flag:"wx"});
write(path.join(out,"evidencia/http-off-contracts-unit.json"),{status:"PASS",scope:"20 pure contract tests only; no HTTP or application executed",
  tests:20,bodyEvidenceBeforeAssertions:true,candidate404NeverPasses:true,controlE2Separate404:true,
  apiRebuilt:false,sqlChanged:false,r4FailureReclassified:false});
console.log("R5_OFFLINE_HTTP_CONTRACT_PREPARATION=PASS");