// Offline documentary closeout only. No subprocesses, DB, builds or app imports.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { report, root, digest, canonical, json, write, fingerprints, verifyOutputs } from "./common.mjs";
const prior = verifyOutputs();
assert.equal(prior.status,"BUILT_NOT_VALIDATED_MAIN_PENDING","One-time documentary transition only");
const historicalFiles=["manifest.json","manifest.sha256","package-integrity.sha256","package-integrity.sha256.sha256","release-assets.sha256"];
const archive=path.join(report,"antecedentes/preliminar");
assert.ok(!fs.existsSync(archive),"Archive must not be overwritten");
const historical=Object.fromEntries(historicalFiles.map(f=>[f,digest(fs.readFileSync(path.join(report,f)))]));
const expected=json(path.join(report,"release-expected.json"));
const aPath=path.join(report,"evidencia/live/catalog-B0-real.json");
const bPath=path.join(report,"evidencia/rehearsal-r1/catalog-reconstructed.json");
assert.equal(digest(fs.readFileSync(aPath)),expected.captureSha256);
const a=json(aPath), b=json(bPath);
const r1=path.join(report,"evidencia/rehearsal-r1");
const r1Before=Object.fromEntries(fs.readdirSync(r1).map(f=>[f,digest(fs.readFileSync(path.join(r1,f)))]));
const terminal=json(path.join(r1,"terminal.json"));
assert.equal(terminal.status,"FAIL");
assert.equal(terminal.postgresStopExit,0);
assert.equal(terminal.disposableDestroyed,true);
assert.deepEqual(a.schemaRows,b.schemaRows);
assert.equal(a.attributes.length,902);
assert.equal(b.attributes.length,902);
const key=r=>canonical([r.kind,r.parent,r.name]);
const index=rows=>{
  const m=new Map(rows.map(r=>[key(r),r]));
  assert.equal(m.size,rows.length,"Attribute identity must be unique");
  return m;
};
const am=index(a.attributes),bm=index(b.attributes);
assert.deepEqual([...am.keys()].sort(),[...bm.keys()].sort());
const differences=[...am].filter(([k,v])=>canonical(v)!==canonical(bm.get(k))).map(([k,v])=>({real:v,reconstructed:bm.get(k)}));
assert.equal(differences.length,6);
assert.ok(differences.every(d=>d.real.kind==="enum"&&d.real.parent==="rol_usuario"));
const at=a.attributes.filter(r=>r.kind==="trigger"),bt=b.attributes.filter(r=>r.kind==="trigger");
assert.equal(at.length,42); assert.deepEqual(at,bt);
const enumOrder=c=>c.attributes.filter(r=>r.kind==="enum"&&r.parent==="rol_usuario").sort((x,y)=>Number(x.definition)-Number(y.definition)).map(r=>r.name);
assert.deepEqual(enumOrder(a),enumOrder(b));
for(const f of ["capture-cli.json","preflight-cli.json"]) {
  const c=json(path.join(report,"evidencia",f));
  assert.equal(c.status,"PASS"); assert.equal(c.exit,0); assert.equal(c.positiveExecutionToken,true);
}
fs.mkdirSync(archive,{recursive:true});
for(const f of historicalFiles) fs.copyFileSync(path.join(report,f),path.join(archive,f),fs.constants.COPYFILE_EXCL);
write(path.join(archive,"archive-record.json"),{status:"HISTORICAL_PRELIMINARY_NOT_CURRENT_VALIDATOR",hashes:historical});
write(path.join(report,"evidencia/comparacion-r1-offline.json"),{
  status:"BLOCKED_CATALOG_FIDELITY",method:"Offline exact raw JSON comparison; no new DB access or normalization",
  realFileSha256:digest(fs.readFileSync(aPath)),reconstructedFileSha256:digest(fs.readFileSync(bPath)),
  schemaRows:{real:a.schemaRows.length,reconstructed:b.schemaRows.length,identical:true},
  attributes:{real:a.attributes.length,reconstructed:b.attributes.length,changed:differences.length,differences},
  triggers:{real:at.length,reconstructed:bt.length,identical:true},
  enumRelativeOrder:{identical:true,labels:enumOrder(a)},
  hashes:{real:fingerprints(a),reconstructed:fingerprints(b)},
  originalFidelityBoolean:"rawEnumAndTriggerAttributesPreserved:true is contradicted for enums; original evidence retained unchanged",
  candidateStarted:false,controlBundleStarted:false,reason:"Assertion failed before boot",
  actualDatabaseModified:false,repairPerformed:false,expectationsRebaselined:false,
});
const evidenceFiles=[
  "release-expected.json","evidencia/capture-cli.json","evidencia/preflight-cli.json",
  "evidencia/live/catalog-B0-real.json","evidencia/live/schema-B0-real.sql","evidencia/live/read-only-capture.json",
  ...Object.keys(r1Before).map(f=>`evidencia/rehearsal-r1/${f}`),
  "evidencia/comparacion-r1-offline.json","evidencia/static-audit.json",
];
const next={...prior,status:"BLOCKED_NOT_READY_FOR_RELEASE",sealed:false,releaseAuthorized:false,
  phaseBExecuted:false,preliminaryArchive:"antecedentes/preliminar",
  realCapture:{status:"PASS_READ_ONLY",executedBy:"MAIN",pid:191,credentialsRecorded:false,actorsCopied:false},
  realPreflight:{status:"PASS",executedBy:"MAIN",positiveExecutionToken:true},
  rehearsal:{attempt:"r1",status:"FAIL_CATALOG_ATTRIBUTES",executedBy:"MAIN",schemaIdentical:true,
    enumAttributeDifferences:6,triggerAttributesIdentical:42,candidateStarted:false,controlStarted:false,
    controlDisposition:"Not started on unfaithful fixture; current API not restarted",
    postgresStopExit:0,disposableDestroyed:true,evidenceUnmodified:true},
  pending:["EXPLICIT_DECISION_ON_FAITHFUL_DISPOSABLE_ENUM_ATTRIBUTES_WITHOUT_REAL_DB_REPAIR_OR_REBASELINE",
    "CANDIDATE_STARTUP_AND_CATALOG_ROWS_SEQUENCES_PRESERVATION",
    "NEGATIVE_GATES_IDENTITY_HASH_CATALOG_CONTROLS","DISPOSABLE_ROW_VALUE_SENSITIVITY",
    "HTTP_FUNCTIONAL_CLOSED_GATE_TESTS","MAIN_FINAL_READONLY_RUNTIME_CHECK_BEFORE_DELIVERY"],
  evidence:Object.fromEntries(evidenceFiles.map(f=>[f,digest(fs.readFileSync(path.join(report,f)))])),
  documentaryIntegrityOnly:true,
};
fs.writeFileSync(path.join(report,"manifest.json"),JSON.stringify(next,null,2)+"\n");
fs.writeFileSync(path.join(report,"manifest.sha256"),`${digest(fs.readFileSync(path.join(report,"manifest.json")))}  ${path.relative(root,path.join(report,"manifest.json"))}\n`);
for(const [f,h] of Object.entries(r1Before)) assert.equal(digest(fs.readFileSync(path.join(r1,f))),h,"r1 evidence changed");
assert.equal(digest(fs.readFileSync(path.join(report,"release-assets.sha256"))),historical["release-assets.sha256"]);
const excluded=new Set(["package-integrity.sha256","package-integrity.sha256.sha256"].map(f=>path.join(report,f)));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(e.isSymbolicLink()) return [];
  const f=path.join(dir,e.name); return e.isDirectory()?walk(f):excluded.has(f)?[]:[f];
});
const inventory=walk(report).sort().map(f=>`${digest(fs.readFileSync(f))}  ${path.relative(root,f)}\n`).join("");
fs.writeFileSync(path.join(report,"package-integrity.sha256"),inventory);
fs.writeFileSync(path.join(report,"package-integrity.sha256.sha256"),`${digest(inventory)}  ${path.relative(root,path.join(report,"package-integrity.sha256"))}\n`);
console.log("BLOCKED_NOT_READY_FOR_RELEASE: offline documentary integrity updated; no success seal.");