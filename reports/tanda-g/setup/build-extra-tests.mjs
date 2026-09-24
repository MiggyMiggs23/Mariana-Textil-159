import fs from "node:fs";
import {createRequire} from "node:module";
const root="/home/runner/workspace",r=root+"/.local/tanda-g";
const require=createRequire(r+"/candidate-source/artifacts/api-server/package.json"),{build}=require("esbuild");
const common={bundle:true,platform:"node",format:"esm",external:["pg-native"],nodePaths:[r+"/candidate-source/lib/db/node_modules",r+"/candidate-source/artifacts/api-server/node_modules"],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}};
await build({...common,entryPoints:["reports/tanda-g/setup/strict-extra-tests.ts"],outfile:r+"/extra-tests.mjs"});
await build({...common,entryPoints:["reports/tanda-g/setup/prepare-negative-api-fixtures.ts"],outfile:r+"/prepare-negative-api-fixtures.mjs"});
let negative=fs.readFileSync(r+"/candidate-source/artifacts/api-server/src/lib/inventory-strict-reversal.integration.test.ts","utf8")
 .replace('from "@workspace/db"',`from "${r}/baseline-source/lib/db/src/index"`)
 .replace('from "./inventario"',`from "${r}/baseline-source/artifacts/api-server/src/lib/inventario"`);
fs.writeFileSync(r+"/baseline-negative-tests.ts",negative,{mode:0o600});
await build({...common,entryPoints:[r+"/baseline-negative-tests.ts"],outfile:r+"/baseline-negative-tests.mjs"});