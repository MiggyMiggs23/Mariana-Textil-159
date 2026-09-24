import fs from "node:fs";
import {pathToFileURL} from "node:url";
const root="/home/runner/workspace", r=root+"/.local/tanda-g-ampliada";
fs.mkdirSync(r,{recursive:true,mode:0o700});fs.chmodSync(r,0o700);
const candidates=fs.readdirSync("/proc").filter(x=>/^\d+$/.test(x)).filter(pid=>{
 try{return fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0").some(x=>/^artifacts\/api-server\/dist[^/]*\/index\.mjs$/.test(x));}catch{return false;}
});
if(candidates.length!==1)throw Error("Exactly one effective application API required");
const pid=Number(candidates[0]);
let text=fs.readFileSync(root+"/reports/tanda-f/setup/prepare.mjs","utf8")
 .replaceAll("tanda-f","tanda-g-ampliada").replaceAll("tanda_f","tanda_ga")
 .replaceAll("TANDA F","TANDA GA").replaceAll("TANDA-F","TANDA-GA")
 .replaceAll("tandaf","tandaga").replaceAll("AZUL TF","AZUL GA")
 .replaceAll('"TFA","TFB","TFC"','"GAA","GAB","GAC"')
 .replaceAll("55440","55442").replaceAll("994000000","996000000")
 .replace('const pid=180;',`const pid=${pid};`)
 .replace('command.includes("artifacts/api-server/dist-tanda-e-20260923/index.mjs")','/^.*artifacts\\/api-server\\/dist[^/]*\\/index\\.mjs/.test(command)')
 .replace('"../../../scripts/node_modules/pg/lib/index.js"',JSON.stringify(root+"/scripts/node_modules/pg/lib/index.js"))
 .replace('["browser","concurrency","permissions","reversal"]','["permissions","inventory","month","performance","failure"]')
 .replace('["template","browser","concurrency","permissions","reversal","witness"]','["template","permissions","inventory","month","performance","failure","witness"]')
 .replace(' const roles=',` for(let i=1;i<=4;i++)sites.push(await one("INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'BODEGA') RETURNING id,nombre",["TANDA GA BODEGA "+i,["GAD","GAE","GAF","GAG"][i-1]]));\n const roles=`)
 .replace(' const actor=index===0?credentials.caja:', ' if(index>=3)continue;\n const actor=index===0?credentials.caja:')
 .replace('provenance!==96','provenance!==224').replace('inventory.length!==12','inventory.length!==28')
 .replace('four independent copies','five independent copies')
 .replace('3 stores, shared credit customer, 96','3 stores and 4 warehouses, shared credit customer, 224');
fs.writeFileSync(r+"/prepare-generated.mjs",text,{mode:0o600});
await import(pathToFileURL(r+"/prepare-generated.mjs").href);