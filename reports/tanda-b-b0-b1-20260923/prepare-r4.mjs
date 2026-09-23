// Offline orchestration/representation repair only. SQL/API bytes unchanged.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {root,report,json,digest,write,verifyPreparation,verifyOutputs} from "./common.mjs";
verifyPreparation();verifyOutputs();
const prior=path.join(report,"r3"),out=path.join(report,"r4");
const priorSeal=json(path.join(prior,"preparation-inputs.json"));
for(const [p,h] of Object.entries(priorSeal.files))assert.equal(digest(fs.readFileSync(path.join(root,p))),h,`r3 input changed: ${p}`);
fs.mkdirSync(path.join(out,"sql"));fs.mkdirSync(path.join(out,"evidencia/live"),{recursive:true});
const copy=f=>fs.copyFileSync(path.join(prior,f),path.join(out,f),fs.constants.COPYFILE_EXCL);
for(const f of ["common.mjs","loopback-start.mjs","auxiliary-catalog.sql","release-catalog.sql",
  "autorizacion-cuatro-reemplazos-e5.txt","autorizacion-propietario-tanda-b-b0-b1.txt",
  "fase-b-NO-EJECUTADA.txt","source-manifest.json","release-assets.sha256"])copy(f);
for(const e of fs.readdirSync(path.join(prior,"sql")))copy(`sql/${e}`);
for(const e of ["catalog-B0-real.json","auxiliary-B0-real.json","capture.json"])copy(`evidencia/live/${e}`);
for(const e of ["controls-offline-final.json","static-audit.json","source-gates.json","sql-syntax-unit.json","sql-syntax-unit.log"])copy(`evidencia/${e}`);
write(path.join(out,"evidencia/reused-baseline.json"),{...json(path.join(prior,"evidencia/reused-baseline.json")),
  sourceSqlRevision:"r3-syntax-only",copiedFromRevision:"r3",runnerRevision:"r4-multiset-only",freshReadOnlyPreflightExecuted:false});
const once=(text,a,b)=>{assert.equal(text.split(a).length,2,`Unique transformation ${a}`);return text.replace(a,b);};
let projection=fs.readFileSync(path.join(prior,"projection.mjs"),"utf8");
const start=projection.indexOf("export function projectAuxiliary("),end=projection.indexOf("const q=s=>",start);
assert.ok(start>=0&&end>start);
projection=projection.slice(0,start)+'export {projectAuxiliaryMultiset as projectAuxiliary} from "./auxiliary-multiset.mjs";\n'+projection.slice(end);
fs.writeFileSync(path.join(out,"projection.mjs"),projection,{flag:"wx"});
for(const name of ["preflight","rehearse","run-main","finalize"]) {
  let s=fs.readFileSync(path.join(prior,`${name}.mjs`),"utf8");
  if(["preflight","rehearse","finalize"].includes(name))s='import {auxiliaryFingerprint} from "./auxiliary-multiset.mjs";\n'+s;
  if(name==="preflight")s=once(s,
    'assert.deepEqual(auxiliary(pgEnvironment(url,bin),bin),json(path.join(report,"evidencia/live/auxiliary-B0-real.json")),"Auxiliary B0 changed");',
    'assert.equal(auxiliaryFingerprint(auxiliary(pgEnvironment(url,bin),bin)),auxiliaryFingerprint(json(path.join(report,"evidencia/live/auxiliary-B0-real.json"))),"Auxiliary B0 multiset changed");');
  if(name==="rehearse")s=once(s,'auxiliarySha256:digest(canonical(readAux()))','auxiliarySha256:auxiliaryFingerprint(readAux())');
  if(name==="finalize")s=once(s,'approvedReplacements:4,files,outputs:m.outputs,',
    'approvedReplacements:4,files,outputs:m.outputs,\n  auxiliaryRepresentation:"Semantic multiset of captured fields; not physical OID/subobject-address preservation",\n  auxiliaryBase:auxiliaryFingerprint(json(path.join(report,"evidencia/live/auxiliary-B0-real.json"))),\n  auxiliaryProjected:auxiliaryFingerprint(json(path.join(dir,"auxiliary-B1-projected.json"))),');
  if(name==="run-main") {
    s=once(s,'process.env.TANDA_B_ATTEMPT,"r3"','process.env.TANDA_B_ATTEMPT,"r4"');
    s=once(s,'const sqlRevision=process.env.TANDA_B_SQL_REVISION;','const sqlRevision=process.env.TANDA_B_SQL_REVISION;assert.equal(sqlRevision,"91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f");');
    s=once(s,'assert.equal(json(path.join(report,"evidencia/sql-syntax-unit.json")).status,"PASS");',
      'assert.equal(json(path.join(report,"evidencia/sql-syntax-unit.json")).status,"PASS");\nassert.equal(json(path.join(report,"evidencia/multiset-offline-audit.json")).status,"PASS");');
  }
  fs.writeFileSync(path.join(out,`${name}.mjs`),s,{flag:"wx"});
}
const inv=json(path.join(prior,"sql-inventory.json"));
for(const [source,e] of Object.entries(inv.inputs))assert.equal(digest(fs.readFileSync(path.join(root,source))),e.sha256,"No SQL source changes allowed in r4");
write(path.join(out,"sql-inventory.json"),{...inv,sourceSqlCommit:"91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f",runnerRevision:"r4-multiset-only"});
write(path.join(out,"manifest.json"),{...json(path.join(prior,"manifest.json")),
  status:"R4_RUNNER_MULTISET_PREPARED_NOT_VALIDATED",sourceSqlRevision:"r3-syntax-only",
  sourceSqlCommit:"91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f",runnerRevision:"r4-multiset-only",
  pending:["FRESH_READONLY_PREFLIGHT_SAME_B0_AND_PIN","R4_DISPOSABLE_COMPLETE","CANDIDATE_STARTUP_PRESERVATION","MAIN_REVIEW"]});
fs.writeFileSync(path.join(out,"manifest.sha256"),`${digest(fs.readFileSync(path.join(out,"manifest.json")))}  reports/tanda-b-b0-b1-20260923/r4/manifest.json\n`,{flag:"wx"});
console.log("R4_PREPARED_OFFLINE_UNSEALED_AUDIT_REQUIRED");