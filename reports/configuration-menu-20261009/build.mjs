import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const root=process.cwd(), report=path.join(root,"reports/configuration-menu-20261009");
const baseline=path.join(root,"reports/operation-menu-order-20261009/frozen-root");
const frozen=path.join(report,"frozen-root"), ui="artifacts/mariana-textil";
const files=["src/components/layout/app-navigation.ts","src/components/layout/app-layout.tsx","src/components/layout/sidebar-sections.tsx"];
const source=(base,file)=>fs.readFileSync(path.join(base,ui,file),"utf8");
const old=source(baseline,files[0]),current=source(root,files[0]);
assert.deepEqual(old.match(/^\s+\{ name:.*$/gm).map(s=>s.trim()).sort(),current.match(/^\s+\{ name:.*$/gm).map(s=>s.trim()).sort(),"All complete navigation items identical");
assert.equal(old.slice(old.indexOf("export function getVisibleNavGroups")),current.slice(current.indexOf("export function getVisibleNavGroups")),"Permission predicate unchanged");
for(const file of ["src/pages/e11.tsx","src/lib/permisos.ts","src/App.tsx"])assert.equal(source(baseline,file),source(root,file),file+" unchanged");
if(fs.existsSync(frozen))throw new Error("Never overwrite evidence");
fs.cpSync(baseline,frozen,{recursive:true,filter:f=>!f.endsWith(".tsbuildinfo")&&!f.includes("/.vite/")});
const sha=f=>createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const changes=files.map(file=>{
  const dest=path.join(frozen,ui,file),before=sha(dest);
  fs.copyFileSync(path.join(root,ui,file),dest);
  return {file,before,after:sha(dest)};
});
fs.writeFileSync(path.join(report,"scope-check.json"),JSON.stringify({passed:true,changes},null,2));
for(const [name,args] of [
 ["typecheck",[path.join(root,"node_modules/.bin/tsc"),"--noEmit","--incremental","false","-p","."]],
 ["build",[path.join(root,ui,"node_modules/.bin/vite"),"build","--outDir",path.join(report,"web")]],
]){
 const log=fs.openSync(path.join(report,name+".log"),"w");
 try{execFileSync(args[0],args.slice(1),{cwd:path.join(frozen,ui),stdio:["ignore",log,log]});}
 finally{fs.closeSync(log);}
}
console.log("BUILT_NOT_ACTIVATED");
