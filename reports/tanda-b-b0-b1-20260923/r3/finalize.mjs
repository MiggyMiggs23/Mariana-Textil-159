// MAIN after terminal evidence only. Does not apply SQL, activate or release.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {report,root,revision,requireMain,verifyPreparation,json,write,digest,verifyOutputs,fingerprints} from "./common.mjs";
requireMain();verifyPreparation();const m=verifyOutputs(),attempt=process.env.TANDA_B_ATTEMPT;
assert.equal(json(path.join(report,"evidencia/main-protected-after.json")).status,"PASS_UNCHANGED");
assert.equal(json(path.join(report,"evidencia/orchestration-terminal.json")).status,"PASS_EXECUTION_AND_PROTECTED");
assert.match(attempt||"",/^[a-zA-Z0-9_-]{1,40}$/);
const dir=path.join(report,"evidencia",`rehearsal-${attempt}`),r=json(path.join(dir,"terminal.json"));
assert.equal(r.status,"PASS_DISPOSABLE_MAIN_REVIEW_PENDING");
assert.equal(r.projection,"PASS_EXACT_FOUR_REPLACEMENTS");
assert.equal(r.auxiliary,"PASS_RI_AND_DEPENDENCIES");
assert.equal(r.invariance,"PASS_CATALOG_ROWS_SEQUENCES");
assert.equal(r.rowAndSequenceSensitivity,"PASS_REAL_DISPOSABLE_MUTATIONS");
assert.equal(r.postgresStopExit,0);assert.equal(r.disposableDestroyed,true);assert.equal(r.candidateStopped,true);
assert.equal(r.candidateProcessGroupGone,true);
assert.equal(json(path.join(report,"evidencia/preflight-cli.json")).status,"PASS");
assert.equal(json(path.join(report,"evidencia/controls-offline-final.json")).status,"PASS");
const b0=json(path.join(report,"evidencia/live/catalog-B0-real.json")),b1=json(path.join(dir,"catalog-B1-projected.json"));
const files={};
function walk(dir) {for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
  if(e.name==="node_modules"||e.name==="source")continue;
  const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.isFile())files[path.relative(root,f)]=digest(fs.readFileSync(f));
}}
walk(report);
write(path.join(report,"final-manifest.json"),{status:"PREPARED_OFF_NOT_RELEASED",apiSourceRevision:revision,sourceSql:{...json(path.join(report,"sql-inventory.json")),sourceSqlCommit:json(path.join(report,"evidencia/source-sql-commit.json")).revision},reusedApiAssets:true,phaseBExecuted:false,
  releaseAuthorized:false,allGates:"OFF",base:fingerprints(b0),projected:fingerprints(b1),
  comparator:{file:"scripts/src/release-catalog-comparison.mjs",sha256:digest(fs.readFileSync(path.join(root,"scripts/src/release-catalog-comparison.mjs")))},
  approvedReplacements:4,files,outputs:m.outputs,
  limits:["Minimal dependency fixture is not full startup schema validation","HTTP probes are unauthenticated denials only, not actor-role integration"],terminal:r});
fs.writeFileSync(path.join(report,"final-manifest.sha256"),digest(fs.readFileSync(path.join(report,"final-manifest.json")))+"  final-manifest.json\n",{flag:"wx"});
console.log("TANDA_B_FINAL=PREPARED_OFF_NOT_RELEASED");