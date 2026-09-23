// Versioned seal; old r1 seal and every r1 byte remain intact.
import fs from "node:fs";
import path from "node:path";
import {root,report,digest,write,verifyPreparation} from "./common.mjs";
verifyPreparation();
const dir=path.join(report,"r2"),files={};
const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})) {
  const f=path.join(p,e.name);
  if(e.isDirectory())walk(f);
  else files[path.relative(root,f)]=digest(fs.readFileSync(f));
}};
walk(dir);
for(const p of ["scripts/src/release-catalog-comparison.mjs","scripts/src/e5-sql-case-regression.test.mjs","reports/tanda-b-off-preparada-20260923/common.mjs",
  "reports/tanda-b-b0-b1-20260923/prepare-r2.mjs","reports/tanda-b-b0-b1-20260923/seal-r2.mjs"])
  files[p]=digest(fs.readFileSync(path.join(root,p)));
write(path.join(dir,"preparation-inputs.json"),{status:"R2_PREPARATION_ONLY_MAIN_EXECUTION_PENDING",files,
  previousSealSha256:digest(fs.readFileSync(path.join(report,"preparation-inputs.json")))});
fs.writeFileSync(path.join(dir,"preparation-inputs.sha256"),`${digest(fs.readFileSync(path.join(dir,"preparation-inputs.json")))}  preparation-inputs.json\n`,{flag:"wx"});