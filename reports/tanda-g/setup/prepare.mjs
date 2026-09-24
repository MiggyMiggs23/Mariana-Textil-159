import fs from "node:fs";
import {pathToFileURL} from "node:url";
// Reuse the audited F fixture lifecycle verbatim except campaign names/copy set.
// Generated executable stays private. No application modules are imported.
const root="/home/runner/workspace";
const privateRoot=root+"/.local/tanda-g";
fs.mkdirSync(privateRoot,{recursive:true,mode:0o700});
fs.chmodSync(privateRoot,0o700);
let source=fs.readFileSync(root+"/reports/tanda-f/setup/prepare.mjs","utf8")
  .replaceAll("tanda-f","tanda-g").replaceAll("tanda_f","tanda_g")
  .replaceAll("TANDA F","TANDA G").replaceAll("TANDA-F","TANDA-G")
  .replaceAll("tandaf","tandag").replaceAll("AZUL TF","AZUL TG")
  .replaceAll('"TFA","TFB","TFC"','"TGA","TGB","TGC"')
  .replaceAll("55440","55441").replaceAll("994000000","995000000")
  .replace('["browser","concurrency","permissions","reversal"]','["baseline","candidate","browser"]')
  .replace('["template","browser","concurrency","permissions","reversal","witness"]','["template","baseline","candidate","browser","witness"]')
  .replace("four independent copies","three independent copies")
  .replace('"../../../scripts/node_modules/pg/lib/index.js"',JSON.stringify(root+"/scripts/node_modules/pg/lib/index.js"));
fs.writeFileSync(privateRoot+"/prepare-generated.mjs",source,{mode:0o600});
await import(pathToFileURL(privateRoot+"/prepare-generated.mjs").href);