// Non-executing artifact audit: no imports of application or preflight, no DB.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { report, root, distName, revision, digest, json, write, verifyOutputs, closedEnv } from "./common.mjs";
const source = json(path.join(report,"source-manifest.json"));
assert.equal(source.revision,revision);
for (const [file,hash] of Object.entries(source.files)) {
  assert.equal(digest(fs.readFileSync(path.join(report,"source",file))),hash,`Frozen source changed: ${file}`);
}
const manifest=verifyOutputs();
const api=path.join(root,"artifacts/api-server",distName);
const text=fs.readFileSync(path.join(api,"index.mjs"),"utf8");
const outputDirs=[...text.matchAll(/const outputDir = "([^"]+)";/g)].map(m=>m[1]);
assert.ok(outputDirs.length>0);
assert.ok(outputDirs.every(d => d===api),"Pino workers reference a different output location");
const workers=[...text.matchAll(/pinoBundlerAbsolutePath\("(\.\/[^"]+)"\)/g)].map(m=>m[1]);
assert.ok(workers.length>=4);
for (const worker of workers) assert.ok(fs.existsSync(path.join(api,worker)),`Missing worker ${worker}`);
const gates=json(path.join(report,"evidencia/source-gates.json"));
for (const gate of gates) {
  assert.equal(gate.value,"false");
  assert.equal(closedEnv[gate.name],"false",`Runner missing gate: ${gate.name}`);
}
write(path.join(report,"evidencia/static-audit.json"),{
  status:"PASS_STATIC_ONLY", revision, frozenFiles:Object.keys(source.files).length,
  outputFiles:Object.keys(manifest.outputs).length, gatesOff:gates.length,
  workers:workers.map(worker=>({ file:worker, resolved:path.join(api,worker), sha256:digest(fs.readFileSync(path.join(api,worker))) })),
  absoluteOutputDirs:outputDirs, relocatable:false, runtimeWorkerResolutionTested:false,
  realDatabaseAccess:false, applicationStarted:false,
  pending:"MAIN real capture/preflight, disposable fidelity and startup, negative controls, functional closed-gate verification"
});
// Inventory is a preparation snapshot, not an operational success seal.
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if (e.isSymbolicLink()) return [];
  const p=path.join(dir,e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const files=walk(report).filter(f=>!f.endsWith("/package-integrity.sha256") && !f.endsWith("/package-integrity.sha256.sha256")).sort();
const inventory=files.map(f=>`${digest(fs.readFileSync(f))}  ${path.relative(root,f)}\n`).join("");
fs.writeFileSync(path.join(report,"package-integrity.sha256"),inventory,{flag:"wx"});
fs.writeFileSync(path.join(report,"package-integrity.sha256.sha256"),`${digest(inventory)}  ${path.relative(root,path.join(report,"package-integrity.sha256"))}\n`,{flag:"wx"});
console.log("PASS_STATIC_ONLY — not sealed, MAIN pending");