import fs from "node:fs";
import {createRequire} from "node:module";
const root="/home/runner/workspace", privateRoot=root+"/.local/tanda-g", source=privateRoot+"/baseline-source";
const require=createRequire(source+"/artifacts/api-server/package.json");
const {build}=require("esbuild");
fs.mkdirSync(root+"/reports/tanda-g/baseline",{recursive:true});
let text=fs.readFileSync(root+"/reports/tanda-f/tarea-5/run.ts","utf8")
 .replaceAll('"../../../lib/',JSON.stringify(source+"/lib/").slice(0,-1))
 .replaceAll('"../../../artifacts/',JSON.stringify(source+"/artifacts/").slice(0,-1))
 .replaceAll("reports/tanda-f/tarea-5","reports/tanda-g/baseline")
 .replaceAll("tanda-f","tanda-g").replaceAll("tanda_f_reversal","tanda_g_baseline")
 .replaceAll("55440","55441").replaceAll("Tanda F","Tanda G baseline");
text=text.replace('const selected = Number(process.argv[2]);','const selected = Number(process.argv[2]);\nif (![1,2,4,5,6,7,8,9].includes(selected)) throw Error("Only the eight eligible F cases may run");');
fs.writeFileSync(privateRoot+"/baseline-run.ts",text,{mode:0o600});
await build({entryPoints:[privateRoot+"/baseline-run.ts"],outfile:privateRoot+"/baseline-run.mjs",bundle:true,platform:"node",format:"esm",external:["pg-native"],nodePaths:[source+"/lib/db/node_modules",source+"/artifacts/api-server/node_modules"],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});