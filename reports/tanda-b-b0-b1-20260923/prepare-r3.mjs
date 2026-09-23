// Offline only. Revisions r1/r2 remain byte-intact; no DB/application imports.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {root,report,json,digest,write,verifyPreparation,verifyOutputs} from "./common.mjs";
import {auditIfCases} from "../../scripts/src/sql-if-case-audit.mjs";
verifyPreparation();verifyOutputs();
const previous=path.join(report,"r2"),out=path.join(report,"r3");
const seal=json(path.join(previous,"preparation-inputs.json"));
const changedTest="scripts/src/e5-sql-case-regression.test.mjs";
const oldTest=execFileSync("git",["show",`a5ffecfac5450a666d9c800eb73bd06193d3ade2:${changedTest}`],{cwd:root});
assert.equal(digest(oldTest),seal.files[changedTest],"Old externally referenced r2 test recoverable exactly at SQL-r2 commit");
for(const [file,hash] of Object.entries(seal.files)) {
  if(file!==changedTest)assert.equal(digest(fs.readFileSync(path.join(root,file))),hash,`r2 preserved: ${file}`);
}
fs.mkdirSync(out);fs.mkdirSync(path.join(out,"sql"));fs.mkdirSync(path.join(out,"evidencia/live"),{recursive:true});
fs.mkdirSync(path.join(out,"antecedentes"));
fs.writeFileSync(path.join(out,"antecedentes/e5-sql-case-regression-r2.test.mjs"),oldTest,{flag:"wx"});
const oldHash="303366993fe3529b329a2a0c980a4efcda37eef1c1bf0a1e9bd43bb52ca73267";
const newHash="87911ce23ea2ad1f936e2aa4a718788f7aba2a7b95f1ec9845f5d5baaa520c02";
const inv=json(path.join(previous,"sql-inventory.json")),inputs={},cases={};
for(const [source,entry] of Object.entries(inv.inputs)) {
  const prior=fs.readFileSync(path.join(previous,entry.copy),"utf8");
  const next=fs.readFileSync(path.join(root,source),"utf8");let expected=prior;
  if(source==="reports/e5/01-preparado.sql") {
    for(const action of ["PROPONER","AUTORIZAR","RECHAZAR"]) {
      const expression=`CASE WHEN o.accion='${action}' THEN 1 ELSE 0 END`;
      assert.equal(expected.split(expression).length,2);
      expected=expected.replace(expression,`(${expression})`);
    }
  }
  if(source==="reports/e11/01-preparado.sql") {
    assert.equal(prior.split(oldHash).length,2);expected=prior.replace(oldHash,newHash);
  }
  assert.equal(next,expected,`No additional SQL changes allowed: ${source}`);
  const audited=auditIfCases(next);assert.ok(audited.every(c=>c.safe),`Unprotected IF CASE in ${source}`);
  cases[source]=audited;
  fs.writeFileSync(path.join(out,entry.copy),next,{flag:"wx"});
  inputs[source]={...entry,previousSha256:entry.sha256,sha256:digest(next)};
}
const copy=file=>fs.copyFileSync(path.join(previous,file),path.join(out,file),fs.constants.COPYFILE_EXCL);
for(const f of ["common.mjs","projection.mjs","loopback-start.mjs","auxiliary-catalog.sql","release-catalog.sql",
  "preflight.mjs","rehearse.mjs","finalize.mjs","autorizacion-cuatro-reemplazos-e5.txt",
  "autorizacion-propietario-tanda-b-b0-b1.txt","fase-b-NO-EJECUTADA.txt","source-manifest.json","release-assets.sha256"])copy(f);
for(const f of ["catalog-B0-real.json","auxiliary-B0-real.json","capture.json"])copy(`evidencia/live/${f}`);
for(const f of ["controls-offline-final.json","static-audit.json","source-gates.json"])copy(`evidencia/${f}`);
write(path.join(out,"evidencia/reused-baseline.json"),{...json(path.join(previous,"evidencia/reused-baseline.json")),
  sourceSqlRevision:"r3-syntax-only",copiedFromRevision:"r2",freshReadOnlyPreflightExecuted:false});
let runner=fs.readFileSync(path.join(previous,"run-main.mjs"),"utf8");
assert.equal(runner.split('process.env.TANDA_B_ATTEMPT,"r2"').length,2);
runner=runner.replace('process.env.TANDA_B_ATTEMPT,"r2"','process.env.TANDA_B_ATTEMPT,"r3"');
fs.writeFileSync(path.join(out,"run-main.mjs"),runner,{flag:"wx"});
const sourceSql={...inv,inputs,revisionLabel:"r3-syntax-only",sourceSqlCommit:"PENDING_MAIN_SEPARATE_COMMIT",
  change:{e5:"Only three further CASE parenthesis pairs in graph guard IF",e11:"Matching graph guard prosrc hash only",oldHash,newHash},
  scopeReplacements:4};
write(path.join(out,"sql-inventory.json"),sourceSql);
const m=json(path.join(previous,"manifest.json"));
write(path.join(out,"manifest.json"),{...m,status:"BUILT_ASSETS_REUSED_SQL_R3_NOT_VALIDATED",
  sourceSqlRevision:"r3-syntax-only",sourceSqlCommit:"PENDING_MAIN_SEPARATE_COMMIT",
  pending:["FRESH_READONLY_PREFLIGHT_SAME_B0_AND_PIN","EXACT_R3_SQL_DISPOSABLE","CANDIDATE_STARTUP_PRESERVATION","MAIN_REVIEW"]});
fs.writeFileSync(path.join(out,"manifest.sha256"),`${digest(fs.readFileSync(path.join(out,"manifest.json")))}  reports/tanda-b-b0-b1-20260923/r3/manifest.json\n`,{flag:"wx"});
const tests=execFileSync(process.execPath,["--test","scripts/src/e5-sql-case-regression.test.mjs"],{cwd:root,encoding:"utf8"});
fs.writeFileSync(path.join(out,"evidencia/sql-syntax-unit.log"),tests,{flag:"wx"});
write(path.join(out,"evidencia/sql-syntax-unit.json"),{status:"PASS",scope:"12 textual/lexical tests; not PostgreSQL validation",
  tests:12,sqlCaseInventory:cases,oldHash,newHash,additionalCasePairs:3,
  totalExecutableCases:Object.values(cases).reduce((n,r)=>n+r.length,0),
  ifConditionCases:Object.values(cases).flat().filter(c=>c.inIfCondition).length,
  preservedR2ExternalTest:{commit:"a5ffecfac5450a666d9c800eb73bd06193d3ade2",sha256:digest(oldTest),
    archive:"antecedentes/e5-sql-case-regression-r2.test.mjs"},
  priorR2SealSha256:digest(fs.readFileSync(path.join(previous,"preparation-inputs.json")))});
console.log("R3_OFFLINE_PREPARATION=PASS_NOT_EXECUTED");