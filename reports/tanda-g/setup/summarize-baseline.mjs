import fs from "node:fs";
import {createHash} from "node:crypto";
const root="/home/runner/workspace";
const cases=[1,2,4,5,6,7,8,9].map(n=>{
 const r=JSON.parse(fs.readFileSync(`${root}/reports/tanda-g/baseline/case-${n}.json`,"utf8"));
 const last=r.steps.at(-1).snapshot;
 return {case:n,status:r.status,steps:r.steps.map(s=>({name:s.name,committed:s.committed})),finalRoll:last.roll,
  balances:last.balance.map(b=>{
   const before=r.baseline.balance.find(p=>p.ubicacion_id===b.ubicacion_id);
   const prior=before?Number(before.signed_ledger)-Number(before.inventory_roll_sum):0;
   const current=Number(b.signed_ledger)-Number(b.inventory_roll_sum);
   return {...b,ledgerMinusInventory:current,baselineLedgerMinusInventory:prior,caseDiscrepancyDelta:current-prior,cacheEqualsLedger:Number(b.cache)===Number(b.signed_ledger)};
  })};
});
const sha=p=>createHash("sha256").update(fs.readFileSync(root+"/"+p)).digest("hex");
fs.writeFileSync(root+"/reports/tanda-g/setup/build-identity.json",JSON.stringify({
 baselineCommit:fs.readFileSync(root+"/reports/tanda-g/setup/baseline-commit.txt","utf8").trim(),
 freeze:"git archive HEAD; all @workspace links resolve to frozen libraries, not mutable working tree",
 apiSha256:sha(".local/tanda-g/baseline-source/artifacts/api-server/dist/index.mjs"),
 uiSha256:sha(".local/tanda-g/baseline-source/artifacts/mariana-textil/dist/public/index.html"),
 runnerSha256:sha(".local/tanda-g/baseline-run.mjs"),
 sourceDumpSha256:sha(".local/tanda-g/source.dump"),
 apiStarted:false,uiStarted:false,applicationWrites:false,gateFlagsEnabled:false
},null,2));
fs.writeFileSync(root+"/reports/tanda-g/baseline/summary.json",JSON.stringify({at:new Date().toISOString(),transport:"Frozen real production helpers + disposable PostgreSQL; not HTTP/browser",cases},null,2));
console.log(JSON.stringify(cases.map(c=>({case:c.case,allCommitted:c.steps.every(s=>s.committed),nonzeroFinalDifferences:c.balances.filter(b=>b.ledgerMinusInventory!==0).map(b=>({site:b.ubicacion_id,difference:b.ledgerMinusInventory}))}))));