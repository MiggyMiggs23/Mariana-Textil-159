import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const root=process.cwd(), report=path.join(root,"reports/operation-menu-order-20261009");
const baseline=path.join(root,"reports/sidebar-collapse-20261009/frozen-root");
const frozen=path.join(report,"frozen-root"), ui="artifacts/mariana-textil";
const file="src/components/layout/app-navigation.ts";
const before=fs.readFileSync(path.join(baseline,ui,file),"utf8");
const after=fs.readFileSync(path.join(root,ui,file),"utf8");
const items=s=>s.match(/title: "OPERACIÓN",\s*items: \[([\s\S]*?)\]/)[1].trim().split("\n").map(l=>l.trim());
assert.deepEqual(items(after).map(l=>l.match(/name: "([^"]+)"/)[1]),["Movimientos","POS","Entradas","Salidas","Recibos de abonos","Viajes"]);
assert.deepEqual(items(before).map(l=>l.replace('"Ventas / POS"','"POS"')).sort(),items(after).sort(),"Each complete item retains route, icon, permissions and behavior");
const strip=s=>s.replace(/title: "OPERACIÓN",\s*items: \[[\s\S]*?\]/,"OPERACION");
assert.equal(strip(before),strip(after),"No other navigation changes");
if(fs.existsSync(frozen))throw new Error("Never overwrite evidence");
fs.cpSync(baseline,frozen,{recursive:true,filter:f=>!f.endsWith(".tsbuildinfo")&&!f.includes("/.vite/")});
fs.copyFileSync(path.join(root,ui,file),path.join(frozen,ui,file));
const sha=b=>createHash("sha256").update(b).digest("hex");
fs.writeFileSync(path.join(report,"scope-check.json"),JSON.stringify({passed:true,file,before:sha(before),after:sha(after)},null,2));
for(const [name,args] of [
 ["typecheck",[path.join(root,"node_modules/.bin/tsc"),"--noEmit","--incremental","false","-p","."]],
 ["build",[path.join(root,ui,"node_modules/.bin/vite"),"build","--outDir",path.join(report,"web")]],
]){
 const log=fs.openSync(path.join(report,name+".log"),"w");
 try{execFileSync(args[0],args.slice(1),{cwd:path.join(frozen,ui),stdio:["ignore",log,log]});}
 finally{fs.closeSync(log);}
}
console.log("BUILT_NOT_ACTIVATED");
