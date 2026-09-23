// Offline inventory, not a release seal. Run after preparing scripts/builds.
import fs from "node:fs";
import path from "node:path";
import {report,root,digest,write} from "./common.mjs";
const files={};
for(const e of fs.readdirSync(report,{withFileTypes:true})) if(e.isFile()&&!["preparation-inputs.json","preparation-inputs.sha256"].includes(e.name))
  files[path.relative(root,path.join(report,e.name))]=digest(fs.readFileSync(path.join(report,e.name)));
for(const e of fs.readdirSync(path.join(report,"sql"))) files[path.relative(root,path.join(report,"sql",e))]=digest(fs.readFileSync(path.join(report,"sql",e)));
for(const p of ["scripts/src/release-catalog-comparison.mjs","reports/tanda-b-off-preparada-20260923/common.mjs"])
  files[p]=digest(fs.readFileSync(path.join(root,p)));
for(const p of ["evidencia/controls-offline-final.json","evidencia/static-audit.json","evidencia/source-gates.json"])
  files[path.relative(root,path.join(report,p))]=digest(fs.readFileSync(path.join(report,p)));
write(path.join(report,"preparation-inputs.json"),{status:"PREPARATION_ONLY_MAIN_EXECUTION_PENDING",files});
fs.writeFileSync(path.join(report,"preparation-inputs.sha256"),`${digest(fs.readFileSync(path.join(report,"preparation-inputs.json")))}  preparation-inputs.json\n`,{flag:"wx"});