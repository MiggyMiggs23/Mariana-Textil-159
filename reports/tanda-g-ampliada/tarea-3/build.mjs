import {createRequire} from "node:module";
import path from "node:path";
import fs from "node:fs";
const root=process.cwd(), source=path.join(root,".local/tanda-g-ampliada/frozen-source");
if(!fs.existsSync(source+"/lib/db/src/index.ts"))throw Error("BLOCKED: MAIN frozen-source readiness required");
const require=createRequire(source+"/artifacts/api-server/package.json");
await require("esbuild").build({
  entryPoints:["reports/tanda-g-ampliada/tarea-3/run.ts"],
  outfile:".local/tanda-g-ampliada/month-run.mjs",bundle:true,platform:"node",format:"esm",external:["pg-native"],
  nodePaths:[root+"/lib/db/node_modules",root+"/artifacts/api-server/node_modules"],
  banner:{js:"import {createRequire as __monthlyCreateRequire} from 'node:module';const require=__monthlyCreateRequire(import.meta.url);"},
  plugins:[{name:"frozen-db",setup(b){b.onResolve({filter:/^@workspace\/db(?:\/.*)?$/},args=>{
    const suffix=args.path.slice("@workspace/db".length);
    const files={"/schema":"schema/index.ts","/advisory-locks":"lib/advisory-locks.mjs","/test-database-guard":"lib/test-database-guard.ts"};
    return {path:path.join(source,"lib/db/src",suffix?files[suffix]??`${suffix.slice(1)}.ts`:"index.ts")};
  });}}],
});