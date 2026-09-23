import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {report,root,json,write,digest,verifyOutputs,canonical} from "./common.mjs";
import {project,replacements,projectAuxiliary} from "./projection.mjs";
export function checkGates(gates) {
  for(const e of ["E3","E4","E5","E7","E9","E11","E12"]) assert.ok(gates.some(g=>g.name.startsWith(e+"_")),`Missing ${e}`);
  assert.ok(gates.length>10);
  for(const g of gates) assert.equal(g.value,"false",`Open ${g.name}`);
}
export function checkIdentity(a,b) {for(const k of ["database","databaseOid","schema","role","serverVersionNum"])assert.equal(a[k],b[k],k);}
const gates=json(path.join(report,"evidencia/source-gates.json"));checkGates(gates);
const mutant=structuredClone(gates);mutant[0].value="true";assert.throws(()=>checkGates(mutant));
const m=verifyOutputs(),[file,hash]=Object.entries(m.outputs)[0];
assert.equal(digest(fs.readFileSync(path.join(root,file))),hash);
assert.throws(()=>assert.equal(digest(Buffer.concat([fs.readFileSync(path.join(root,file)),Buffer.from("tamper")])),hash));
const ident={database:"fixture",databaseOid:"1",schema:"public",role:"fixture",serverVersionNum:"160010"};
checkIdentity(ident,ident);
for(const k of Object.keys(ident))assert.throws(()=>checkIdentity(ident,{...ident,[k]:"different"}));
// Pure negative controls; never described as live/database observations.
const live={schemaRows:[{kind:"table",schema_name:"public",object_name:"old",parent_name:"",definition:"r"}],attributes:[]};
assert.throws(()=>project(live,live,{...live,schemaRows:[{...live.schemaRows[0],definition:"changed"}]}));
assert.throws(()=>project(live,live,{...live,schemaRows:[]}));
assert.throws(()=>project(live,{schemaRows:[],attributes:[]},live));
const b0={schemaRows:replacements.map(([kind,object_name,parent_name])=>({kind,object_name,parent_name,schema_name:"public",definition:"old"})),attributes:[]};
const b1={schemaRows:b0.schemaRows.map(r=>({...r,definition:"authorized exact replacement fixture"})),attributes:[]};
assert.equal(project(b0,b0,b1).evidence.replaced.schemaRows.length,4);
assert.throws(()=>project({...b0,schemaRows:[...b0.schemaRows,b0.schemaRows[0]]},b0,b1));
const other={...b0,schemaRows:b0.schemaRows.map(r=>({...r,schema_name:"other"}))};
assert.throws(()=>project(other,other,{...other,schemaRows:other.schemaRows.map(r=>({...r,definition:"changed"}))}));
assert.throws(()=>projectAuxiliary({riTriggers:[{parent:"old"}],dependencies:[]},{riTriggers:[{parent:"old"}],dependencies:[]},{riTriggers:[],dependencies:[]}));
write(path.join(report,"evidencia/controls-offline-final.json"),{status:"PASS",scope:"Pure fail-closed unit controls, NOT live or HTTP proof",
  negative:["gate ON","artifact tamper","five identity selectors","unauthorized replacement","removal","B0 collision","duplicate identities","wrong schema allowlist","old FK RI removal"],
  positive:["closed source gates","real output hashes","equal identity","exactly four allowlisted replacements"],
  gatesSha256:digest(canonical(gates))});