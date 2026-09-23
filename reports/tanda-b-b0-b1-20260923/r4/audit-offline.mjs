// Replay existing immutable MAIN r3 evidence; never connects/starts PostgreSQL.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {root,report,json,write,digest,verifyOutputs} from "./common.mjs";
import {project,projectAuxiliary} from "./projection.mjs";
import {multiset,auxiliaryFingerprint} from "./auxiliary-multiset.mjs";
verifyOutputs();
const old=path.resolve(report,"../r3"),attempt=path.join(old,"evidencia/rehearsal-r3");
const sources={};
const load=file=>{sources[path.relative(root,file)]=digest(fs.readFileSync(file));return json(file);};
const live=load(path.join(old,"evidencia/live/catalog-B0-real.json"));
const before=load(path.join(attempt,"fixture-before.json")),after=load(path.join(attempt,"fixture-after.json"));
const p=project(live,before,after);
assert.deepEqual(p.projected,load(path.join(attempt,"catalog-B1-projected.json")),"Main projection unchanged");
const b0=load(path.join(old,"evidencia/live/auxiliary-B0-real.json"));
const beforeAux=load(path.join(attempt,"auxiliary-fixture-before.json")),afterAux=load(path.join(attempt,"auxiliary-fixture-after.json"));
const a=projectAuxiliary(b0,beforeAux,afterAux);
const duplicateRows=[...multiset(b0.dependencies).values()].filter(e=>e.count>1);
assert.equal(duplicateRows.reduce((n,e)=>n+e.count-1,0),6,"Audited existing capture multiplicity changed");
for(const {row,count} of duplicateRows) {
  const k=JSON.stringify(row);
  assert.equal(a.projected.dependencies.filter(x=>JSON.stringify(x)===k).length,count,"Unchanged B0 duplicate count lost");
}
const tests=execFileSync(process.execPath,["--test",path.join(report,"auxiliary-multiset.test.mjs")],{cwd:root,encoding:"utf8"});
fs.writeFileSync(path.join(report,"evidencia/multiset-unit.log"),tests,{flag:"wx"});
for(const [f,h] of Object.entries(sources))assert.equal(digest(fs.readFileSync(path.join(root,f))),h,"Replay input mutated");
const sql=json(path.join(report,"sql-inventory.json"));
assert.equal(sql.sourceSqlCommit,"91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f");
for(const [source,e] of Object.entries(sql.inputs)) {
  assert.equal(digest(fs.readFileSync(path.join(report,e.copy))),e.sha256);
  assert.equal(digest(execFileSync("git",["show",`${sql.sourceSqlCommit}:${source}`],{cwd:root})),e.sha256);
}
const summary=Object.fromEntries(Object.entries(a.delta).map(([s,d])=>[s,{
  base:d.baseRows,baseDistinct:d.baseDistinct,projected:d.projectedRows,
  addedMultiplicity:d.added.reduce((n,e)=>n+e.count,0),removedMultiplicity:d.removed.reduce((n,e)=>n+e.count,0)}]));
write(path.join(report,"evidencia/multiset-offline-audit.json"),{status:"PASS",
  scope:"Offline replay of MAIN r3 capture/SQL catalogs plus 11 pure tests; NOT r4 DB or startup",
  tests:11,sources,duplicateRows,summary,replacements:p.evidence.replaced.schemaRows.length,
  originalB0AuxiliaryFingerprint:auxiliaryFingerprint(b0),projectedAuxiliaryFingerprint:auxiliaryFingerprint(a.projected),
  queryChanged:false,newSubobjectInformationInvented:false,sqlChanged:false,apiRebuilt:false});
console.log("R4_MULTISET_OFFLINE_AUDIT=PASS");