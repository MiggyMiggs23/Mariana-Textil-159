// Seal verified preparation only. No application/process startup or database access.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root="/home/runner/workspace", rel="reports/e3-apertura-preparada-20260922";
const dir=path.join(root,rel), stage=path.join(dir,"source");
const sha=b=>createHash("sha256").update(b).digest("hex");
const read=f=>fs.readFileSync(path.join(dir,f));
const put=(f,data)=>{ const full=path.join(dir,f);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,data,{flag:"wx"}); };
const json=(f,x)=>put(f,JSON.stringify(x,null,2)+"\n");
assert(!fs.existsSync(path.join(dir,"manifest.json")),"Already sealed: stop.");
const prep=JSON.parse(read("preparation-status.json"));
const accepted=JSON.parse(read("evidencia/arranque-candidato-r1b/candidate-start-results.json"));
assert.equal(accepted.status,"PASS_ORDINARY_CASH_PREPARED_NOT_RELEASED");
assert.equal(accepted.functional.status,"PASS");
assert.equal(accepted.functional.cases.length,11);
assert.equal(accepted.candidateStopped,true);
assert.equal(accepted.postgresStopExit,0);
assert.equal(accepted.disposableDestroyed,true);
assert.equal(accepted.bundleSha256,sha(fs.readFileSync(path.join(prep.apiOut,"index.mjs"))));
assert.equal(accepted.semanticCatalogTableRowsAndSequenceIsCalledUnchanged,true);
const inventoryCheck=spawnSync("sha256sum",["--check","--status",path.join(dir,"release-assets.sha256")],{cwd:root});
assert.equal(inventoryCheck.status,0);
const sourceFiles={};
for(const [file,hash] of Object.entries(prep.sourceFiles)){
  assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,`Live source changed after tested build: ${file}`);
  const actual=sha(fs.readFileSync(path.join(stage,file)));
  assert.equal(actual,prep.activatedFiles[file]??hash,`Frozen source mismatch ${file}`);
  sourceFiles[`source/${file}`]=actual;
}
const changed=[
  "artifacts/api-server/src/lib/credit-evidence-contract.ts",
  "artifacts/api-server/src/lib/credit-abono-evidence.ts",
  "artifacts/api-server/src/routes/e3-collections.ts",
];
const diff=spawnSync("git",["diff","--binary",prep.sourceRevision,"--",...changed],{cwd:root,encoding:"utf8"});
assert.equal(diff.status,0);
const gate="artifacts/api-server/src/lib/e3-ordinary-cash-release.ts";
const gateText=fs.readFileSync(path.join(root,gate),"utf8");
assert(gateText.includes("E3_ORDINARY_CASH_ENABLED = false"));
put("source-corrections.patch",diff.stdout+`diff --git a/${gate} b/${gate}\nnew file mode 100644\n--- /dev/null\n+++ b/${gate}\n@@ -0,0 +1,${gateText.trimEnd().split("\n").length} @@\n`+
  gateText.trimEnd().split("\n").map(line=>"+"+line).join("\n")+"\n");
// Provenance includes the permission/document decision, separately from build input.
for(const file of ["replit.md","reports/prompt-u-respuestas-2026-09-18.md"])
  put(`decisions/${path.basename(file)}`,fs.readFileSync(path.join(root,file)));
json("source-manifest.json",{baseRevision:prep.sourceRevision,cleanCommit:false,
  correctionPatch:"source-corrections.patch",activationPatch:"activation.patch",
  sourceFiles,liveSourceUsedByRuntimeVerification:false,
  reproduction:"Restore physical snapshot in a NEW isolated workspace with identical absolute paths, install frozen pnpm lock dependencies, use recorded build scripts and final paths. Never rebuild the delivered paths. No second byte-identical build claimed."});
const links=[],modules=[];
function findModules(current){
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
    const full=path.join(current,entry.name);
    if(entry.name==="node_modules"){ modules.push(full); collectLinks(full); }
    else if(entry.isDirectory())findModules(full);
    else assert(!entry.isSymbolicLink(),`Unexpected source symlink: ${full}`);
  }
}
function collectLinks(current){
  for(const name of fs.readdirSync(current)){
    const full=path.join(current,name),stat=fs.lstatSync(full);
    if(stat.isSymbolicLink())links.push({path:path.relative(dir,full),target:fs.readlinkSync(full)});
    else if(stat.isDirectory())collectLinks(full);
    else throw new Error(`Unexpected physical dependency file: ${full}`);
  }
}
findModules(stage);
json("build-dependency-links.json",{purpose:"Historical build resolution only; all links removed at seal; never followed by runtime hashes",links});
for(const full of modules)fs.rmSync(full,{recursive:true,force:false});
for(const name of fs.readdirSync(path.join(root,"scripts/src")).filter(n=>/^e3-apertura-.*20260922\.mjs$/.test(n)))
  put(`tooling/${name}`,fs.readFileSync(path.join(root,"scripts/src",name)));
for(const name of ["e3-capture-readonly-20260922.mjs","e3-project-schema-20260922.mjs","e3-candidate-start-20260922.mjs"])
  put(`tooling/antecedents/${name}`,fs.readFileSync(path.join(root,"scripts/src",name)));
for(const name of ["api-start-audit.sh","api-start-audit-record.mjs","release-preflight.mjs","release-catalog.sql"])
  put(`tooling/antecedents/closed-${name}`,fs.readFileSync(path.join(root,"reports/e3-paquete-liberacion-preparado-20260922",name)));
const sqlHashes=Object.fromEntries(fs.readdirSync(path.join(dir,"sql")).sort().map(f=>[f,sha(read(`sql/${f}`))]));
put("owner-authorization.txt",fs.readFileSync(path.join(root,"reports/e2-liberacion-20260922/autorizacion-tres-partes-20260922.txt")));
const manifest={
  status:"PREPARED_OPERATIONAL_ORDINARY_CASH_NOT_RELEASED",phaseBExecuted:false,
  source:{baseRevision:prep.sourceRevision,cleanCommit:false,sourceManifestSha256:sha(read("source-manifest.json")),
    correctionsSha256:sha(read("source-corrections.patch")),activationSha256:sha(read("activation.patch"))},
  outputs:{apiDirectory:prep.apiOut,frontendDirectory:prep.webOut,apiBundleSha256:accepted.bundleSha256,
    files:prep.outputs,releaseAssetsSha256:sha(read("release-assets.sha256"))},
  gates:{e3:true,matrix:true,ordinaryCash:true,e3Directed:false,refund:false,retained:false,attribution:false,fondo:false,remate:false,
    liveDevelopmentSource:"ALL_E3_GATES_OFF"},
  expected:JSON.parse(read("release-expected.json")),sqlHashes,
  acceptedRehearsal:{path:"evidencia/arranque-candidato-r1b/candidate-start-results.json",
    sha256:sha(read("evidencia/arranque-candidato-r1b/candidate-start-results.json")),
    execPid:accepted.execTargetPid,cleanup:{candidateStopped:true,postgresStopExit:0,disposableDestroyed:true}},
  policy:{auditAppend:"WARNING nonblocking as E2; rehearsal required actual matching audit record",
    noOperationalWrites:true,noWorkflowChanges:true,noOperationalRestart:true,
    ownerAuthorization:"owner-authorization.txt",ownerAuthorizationSha256:sha(read("owner-authorization.txt"))},
  limitations:["R0 and R1 failures retained with separate attribution limits",
    "No second byte-identical build claimed","UI preview serving command not deployed or tested as workflow",
    "Typechecks supplied to MAIN for final checks; this manifest does not claim they ran",
    "SQL02 retains permissions, so it is not exact B0 restoration; forbidden after first receipt"],
};
json("manifest.json",manifest);
const manifestHash=sha(read("manifest.json"));
put("manifest.sha256",`${manifestHash}  ${rel}/manifest.json\n`);
const pins=[
  `Base git: ${prep.sourceRevision} + correcciones y activación congeladas.`,
  `Paquete: /home/runner/workspace/${rel}`,
  `manifest.json SHA256: ${manifestHash}`,
  `source-manifest.json SHA256: ${manifest.source.sourceManifestSha256}`,
  `source-corrections.patch SHA256: ${manifest.source.correctionsSha256}`,
  `activation.patch SHA256: ${manifest.source.activationSha256}`,
  `API: ${prep.apiOut}/index.mjs`,
  `API SHA256: ${accepted.bundleSha256}`,
  `Frontend: ${prep.webOut}`,
  `release-assets.sha256 SHA256: ${manifest.outputs.releaseAssetsSha256}`,
  `release-expected.json SHA256: ${sha(read("release-expected.json"))}`,
  `Identidad: ${JSON.stringify(manifest.expected.identity)}`,
  `B0 catálogo: ${manifest.expected.baseSchemaSha256}`,
  `B0 atributos: ${manifest.expected.baseAttributesSha256}`,
  `B1 catálogo: ${manifest.expected.schemaSha256}`,
  `B1 atributos: ${manifest.expected.attributesSha256}`,
  ...Object.entries(sqlHashes).map(([file,hash])=>`SQL ${file} SHA256: ${hash}`),
].join("\n");
put("fase-b-FINAL-PARA-AUTORIZAR.txt",read("fase-b-template.txt").toString().replace("@@PINS@@",pins));
const all={};
function inventory(current){
  for(const name of fs.readdirSync(current).sort()){
    const full=path.join(current,name),stat=fs.lstatSync(full);
    assert(!stat.isSymbolicLink(),`Mutable symlink forbidden at seal: ${full}`);
    if(stat.isDirectory())inventory(full);
    else all[path.relative(root,full)]=sha(fs.readFileSync(full));
  }
}
inventory(dir);inventory(prep.apiOut);inventory(prep.webOut);
const total=Object.entries(all).sort(([a],[b])=>a.localeCompare(b)).map(([file,hash])=>`${hash}  ${file}\n`).join("");
put("package-integrity.sha256",total);
put("package-integrity.sha256.sha256",`${sha(total)}  ${rel}/package-integrity.sha256\n`);
console.log(JSON.stringify({status:manifest.status,manifestSha256:manifestHash,packageIntegritySha256:sha(total),
  releaseAssetsSha256:manifest.outputs.releaseAssetsSha256,apiSha256:accepted.bundleSha256,
  phaseBSha256:sha(read("fase-b-FINAL-PARA-AUTORIZAR.txt")),files:Object.keys(all).length,
  removedBuildDependencyDirectories:modules.length}));