import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=process.cwd(), report=path.join(root,"reports/sidebar-collapse-20261009");
const baseline=path.join(root,"reports/optional-delivery-20261008/frozen-root");
const frozen=path.join(report,"frozen-root"), ui="artifacts/mariana-textil";
const files=["src/components/layout/app-layout.tsx","src/components/layout/sidebar-sections.tsx"];
const sha=f=>fs.existsSync(f)?createHash("sha256").update(fs.readFileSync(f)).digest("hex"):null;
if(fs.existsSync(frozen))throw new Error("Use a new candidate directory");
fs.cpSync(baseline,frozen,{recursive:true,filter:f=>!f.endsWith(".tsbuildinfo")&&!f.includes("/.vite/")});
const changes=files.map(file=>{
  const dest=path.join(frozen,ui,file), before=sha(dest);
  fs.copyFileSync(path.join(root,ui,file),dest);
  return {file,before,after:sha(dest)};
});
fs.writeFileSync(path.join(report,"changes.json"),JSON.stringify(changes,null,2));
for(const [name,args] of [
 ["typecheck",[path.join(root,"node_modules/.bin/tsc"),"--noEmit","--incremental","false","-p","."]],
 ["build",[path.join(root,ui,"node_modules/.bin/vite"),"build","--outDir",path.join(report,"web")]],
]){
 const log=fs.openSync(path.join(report,name+".log"),"w");
 try{execFileSync(args[0],args.slice(1),{cwd:path.join(frozen,ui),stdio:["ignore",log,log]});}
 finally{fs.closeSync(log);}
}
console.log("BUILT_NOT_ACTIVATED");
