// Offline only: no application imports, DB, server or workflow calls.
import fs from "node:fs";
import path from "node:path";
import {report,root,revision,sqlPaths,digest,write,run} from "./common.mjs";
const old=path.join(root,"reports/tanda-b-off-preparada-20260923");
if(run("git",["rev-parse","HEAD"],{cwd:root}).stdout.trim()!==revision) throw Error("Frozen source changed");
fs.mkdirSync(path.join(report,"evidencia"),{recursive:true});
fs.mkdirSync(path.join(report,"sql"));
const inputs={};
for(const [i,p] of sqlPaths.entries()) {
  const b=fs.readFileSync(path.join(root,p)); const name=`sql/${i+1}.sql`;
  fs.writeFileSync(path.join(report,name),b,{flag:"wx"}); inputs[p]={copy:name,sha256:digest(b)};
}
for(const name of ["autorizacion-propietario-tanda-b-b0-b1.txt","autorizacion-cuatro-reemplazos-e5.txt"]) {
  fs.copyFileSync(path.join(root,"reports/tanda-c-20260923",name),path.join(report,name),fs.constants.COPYFILE_EXCL);
}
write(path.join(report,"sql-inventory.json"),{inputs,e7:"No standalone DDL; reader OFF",phaseBExecuted:false});
fs.copyFileSync(path.join(old,"release-catalog.sql"),path.join(report,"release-catalog.sql"),fs.constants.COPYFILE_EXCL);
// Reuse reviewed offline export/build mechanics, NOT its old baseline or evidence.
let build=fs.readFileSync(path.join(old,"prepare.mjs"),"utf8");
build=build.replace('fs.copyFileSync(path.join(root, "reports/e3-apertura-preparada-20260922/release-catalog.sql"), path.join(report, "release-catalog.sql"));',"");
build=build.replaceAll("reports/tanda-b-off-preparada-20260923/manifest.json","reports/tanda-b-b0-b1-20260923/manifest.json");
build=build.replaceAll("REAL_READONLY_CAPTURE_PID191","REAL_READONLY_CAPTURE_EFFECTIVE_RUNTIME_PIN")
  .replaceAll("DISPOSABLE_CATALOG_FIDELITY","MINIMAL_FIXTURE_EXACT_DELTA_FOUR_REPLACEMENTS");
fs.writeFileSync(path.join(report,"build-offline.mjs"),build,{flag:"wx"});
await import("./build-offline.mjs");