// Offline versioned retry preparation. Does NOT execute PostgreSQL or API.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {report,root,json,digest,write,verifyPreparation,verifyOutputs} from "./common.mjs";
verifyPreparation();const outputs=verifyOutputs();
const revisionDir=path.join(report,"r2");fs.mkdirSync(revisionDir);
fs.mkdirSync(path.join(revisionDir,"evidencia/live"),{recursive:true});
fs.mkdirSync(path.join(revisionDir,"sql"));
const oldInventory=json(path.join(report,"sql-inventory.json")),inputs={};
const replaceOnce=(s,a,b)=>{assert.equal(s.split(a).length,2,`Unique anchor: ${a}`);return s.replace(a,b);};
const e5old=fs.readFileSync(path.join(report,"sql/4.sql"),"utf8");
const e5new=fs.readFileSync(path.join(root,"reports/e5/01-preparado.sql"),"utf8");
const caseOld="CASE WHEN returned>0 THEN 'DEVUELTO' WHEN total=0 THEN 'PENDIENTE'\n          WHEN total=r.importe THEN 'APLICADO' ELSE 'PARCIAL' END";
assert.equal(e5new,replaceOnce(e5old,caseOld,`(${caseOld})`),"Only the authorized parentheses may change E5");
const prosrc=text=>{
  const start=text.indexOf("CREATE FUNCTION public.e5_graph_guard()");
  assert.ok(start>=0);
  const a=text.indexOf("AS $$",start)+5,b=text.indexOf("$$;",a);
  assert.ok(a>start&&b>a);return text.slice(a,b);
};
const oldHash=digest(prosrc(e5old)),newHash=digest(prosrc(e5new));
assert.equal(oldHash,"564fe05aee5d577aa60ab5ed5d9a8365e819ba0b82b4e7893ad791995d7b514c");
assert.equal(newHash,"303366993fe3529b329a2a0c980a4efcda37eef1c1bf0a1e9bd43bb52ca73267");
const e11old=fs.readFileSync(path.join(report,"sql/5.sql"),"utf8");
const e11new=fs.readFileSync(path.join(root,"reports/e11/01-preparado.sql"),"utf8");
assert.equal(e11new,replaceOnce(e11old,oldHash,newHash),"Only paired prosrc hash may change E11");
for(const [source,entry] of Object.entries(oldInventory.inputs)) {
  const bytes=fs.readFileSync(path.join(root,source));
  if(!source.match(/^reports\/e(?:5|11)\//))assert.equal(digest(bytes),entry.sha256);
  fs.writeFileSync(path.join(revisionDir,entry.copy),bytes,{flag:"wx"});
  inputs[source]={...entry,sha256:digest(bytes),previousSha256:entry.sha256};
}
write(path.join(revisionDir,"sql-inventory.json"),{inputs,e7:oldInventory.e7,phaseBExecuted:false,
  revisionLabel:"r2-syntax-only",sourceSqlCommit:"PENDING_MAIN_SEPARATE_COMMIT",
  sourceSqlIdentity:"Exact per-file SHA256; not attributed to the API source revision",
  apiSourceRevision:outputs.revision,reusedApiAssets:true,scopeReplacements:4,
  change:{e5:"Parentheses around CASE only",e11:"Matching graph guard prosrc hash only",oldHash,newHash}});
const copy=(from,to=from)=>fs.copyFileSync(path.join(report,from),path.join(revisionDir,to),fs.constants.COPYFILE_EXCL);
for(const f of ["projection.mjs","loopback-start.mjs","auxiliary-catalog.sql","release-catalog.sql",
  "autorizacion-cuatro-reemplazos-e5.txt","autorizacion-propietario-tanda-b-b0-b1.txt","fase-b-NO-EJECUTADA.txt",
  "source-manifest.json","release-assets.sha256"])copy(f);
for(const f of ["catalog-B0-real.json","auxiliary-B0-real.json","capture.json"])copy(`evidencia/live/${f}`);
for(const f of ["controls-offline-final.json","static-audit.json","source-gates.json"])copy(`evidencia/${f}`);
write(path.join(revisionDir,"evidencia/reused-baseline.json"),{status:"REUSED_IMMUTABLE_CAPTURE_REQUIRES_FRESH_PREFLIGHT",
  original:"../evidencia/live",catalogSha256:digest(fs.readFileSync(path.join(report,"evidencia/live/catalog-B0-real.json"))),
  auxiliarySha256:digest(fs.readFileSync(path.join(report,"evidencia/live/auxiliary-B0-real.json"))),
  originalCaptureSha256:digest(fs.readFileSync(path.join(report,"evidencia/live/capture.json"))),
  apiSourceRevision:outputs.revision,sourceSqlRevision:"r2-syntax-only",freshReadOnlyPreflightExecuted:false});
let common=fs.readFileSync(path.join(report,"common.mjs"),"utf8");
common=replaceOnce(common,'from "../../scripts/src/release-catalog-comparison.mjs"','from "../../../scripts/src/release-catalog-comparison.mjs"');
common=replaceOnce(common,'path.resolve(report,"../..")','path.resolve(report,"../../..")');
fs.writeFileSync(path.join(revisionDir,"common.mjs"),common,{flag:"wx"});
for(const name of ["preflight","rehearse","run-main","finalize"]) {
  let s=fs.readFileSync(path.join(report,`${name}.mjs`),"utf8");
  if(name==="rehearse")s=replaceOnce(s,'from "../tanda-b-off-preparada-20260923/common.mjs"','from "../../tanda-b-off-preparada-20260923/common.mjs"');
  if(name==="run-main") {
    s=replaceOnce(s,'import {spawn} from "node:child_process";','import {spawn,execFileSync} from "node:child_process";');
    s=replaceOnce(s,'[["capture-readonly","TANDA_B_CAPTURE=PASS_READ_ONLY"],["preflight","TANDA_B_PREFLIGHT=PASS"],',
      '[["preflight","TANDA_B_PREFLIGHT=PASS"],');
    s=replaceOnce(s,'requireMain();verifyPreparation();const pin=runtimePin();',
      'requireMain();verifyPreparation();assert.equal(process.env.TANDA_B_ATTEMPT,"r2");const pin=runtimePin();\nassert.equal(json(path.join(report,"evidencia/sql-syntax-unit.json")).status,"PASS");\nconst sqlRevision=process.env.TANDA_B_SQL_REVISION;assert.match(sqlRevision||"",/^[a-f0-9]{40}$/);\nfor(const [source,entry] of Object.entries(json(path.join(report,"sql-inventory.json")).inputs))assert.equal(digest(execFileSync("git",["show",`${sqlRevision}:${source}`],{cwd:root})),entry.sha256,"Committed SQL identity");\nwrite(path.join(report,"evidencia/source-sql-commit.json"),{revision:sqlRevision,apiSourceRevision:"cc628aed315a4bbfd3e6cb8766d28200ce400842",status:"PASS_COMMITTED_SQL_HASHES",rebuiltApi:false});');
  }
  if(name==="finalize")s=replaceOnce(s,'status:"PREPARED_OFF_NOT_RELEASED",revision,phaseBExecuted:false,',
    'status:"PREPARED_OFF_NOT_RELEASED",apiSourceRevision:revision,sourceSql:{...json(path.join(report,"sql-inventory.json")),sourceSqlCommit:json(path.join(report,"evidencia/source-sql-commit.json")).revision},reusedApiAssets:true,phaseBExecuted:false,');
  fs.writeFileSync(path.join(revisionDir,`${name}.mjs`),s,{flag:"wx"});
}
write(path.join(revisionDir,"manifest.json"),{...outputs,status:"BUILT_ASSETS_REUSED_SQL_R2_NOT_VALIDATED",
  apiSourceRevision:outputs.revision,sourceSqlRevision:"r2-syntax-only",sourceSqlCommit:"PENDING_MAIN_SEPARATE_COMMIT",
  reusedAssetsFrom:"reports/tanda-b-b0-b1-20260923",rebuildPerformed:false,
  pending:["FRESH_READONLY_PREFLIGHT_SAME_B0_AND_PIN","EXACT_R2_SQL_DISPOSABLE","CANDIDATE_STARTUP_PRESERVATION","MAIN_REVIEW"],sealed:false});
fs.writeFileSync(path.join(revisionDir,"manifest.sha256"),`${digest(fs.readFileSync(path.join(revisionDir,"manifest.json")))}  reports/tanda-b-b0-b1-20260923/r2/manifest.json\n`,{flag:"wx"});
// Textual parser regression, NOT PostgreSQL validation.
function syntaxGuard(e5,e11) {
  assert.ok(e5.includes(`(${caseOld})`),"CASE expression in PL/pgSQL IF must be parenthesized");
  const expected=digest(prosrc(e5));
  assert.ok(e11.includes(`('public.e5_graph_guard()','${expected}')`),"E11 prosrc hash must match E5 body");
}
syntaxGuard(e5new,e11new);
assert.throws(()=>syntaxGuard(e5old,e11new));
assert.throws(()=>syntaxGuard(e5new,e11old));
write(path.join(revisionDir,"evidencia/sql-syntax-unit.json"),{status:"PASS",scope:"Textual only; PG execution remains MAIN",
  positive:["parenthesized CASE","E11 hash matches new exact prosrc","only two parentheses in E5","only paired hash change E11"],
  negative:["unparenthesized old CASE rejected","old E11 hash rejected"],oldHash,newHash});
console.log("R2_OFFLINE_PREPARATION=PASS_NOT_EXECUTED");