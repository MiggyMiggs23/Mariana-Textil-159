import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=process.cwd(), report=path.join(root,"reports/scanner-burst-20261006",process.argv.includes("--revision-2") ? "revision-2" : ".");
const baseline=path.join(root,"reports/receipt-terminal-print-20261001/revision-2/frozen-root");
const frozen=path.join(report,"frozen-root"), ui="artifacts/mariana-textil";
const files=["src/components/campo-escaneo.tsx","src/pages/pos.tsx","src/pages/auditorias-inventario.tsx","src/pages/salida-nueva.tsx"];
const sha=f=>createHash("sha256").update(fs.readFileSync(f)).digest("hex");
if(fs.existsSync(frozen))throw new Error("Use a new candidate directory, never overwrite evidence");
fs.cpSync(baseline,frozen,{recursive:true,filter:f=>!f.endsWith(".tsbuildinfo")&&!f.includes("/.vite/")});
const changes=files.map(file=>{
  const dest=path.join(frozen,ui,file), before=sha(dest);
  fs.copyFileSync(path.join(root,ui,file),dest);
  return {file,before,after:sha(dest)};
});
fs.writeFileSync(path.join(report,"changes.json"),JSON.stringify(changes,null,2));
const run=(name,args)=>{
  const log=fs.openSync(path.join(report,name+".log"),"w");
  try{execFileSync(args[0],args.slice(1),{cwd:path.join(frozen,ui),stdio:["ignore",log,log]});}
  finally{fs.closeSync(log);}
};
run("typecheck",[path.join(root,"node_modules/.bin/tsc"),"--noEmit","--incremental","false","-p","."]);
run("build",[path.join(root,ui,"node_modules/.bin/vite"),"build","--outDir",path.join(report,"web")]);
console.log("BUILT_NOT_ACTIVATED");
