import { createRequire } from "node:module";
import path from "node:path";
const root=process.cwd();
const require=createRequire(path.join(root,".local/tanda-f/source/artifacts/api-server/package.json"));
const {build}=require("esbuild");
await build({
  entryPoints:["reports/tanda-f/tarea-3/run.ts"],outfile:".local/tanda-f/concurrency-run.mjs",
  bundle:true,platform:"node",format:"esm",external:["pg-native"],
  nodePaths:[path.join(root,"lib/db/node_modules"),path.join(root,"artifacts/api-server/node_modules")],
  banner:{js:"import { createRequire as __tandaCreateRequire } from 'node:module';const require=__tandaCreateRequire(import.meta.url);"},
  plugins:[{name:"frozen-db",setup(b){b.onResolve({filter:/^@workspace\/db(?:\/.*)?$/},args=>{
    const suffix=args.path.slice("@workspace/db".length);
    const files={"/schema":"schema/index.ts","/advisory-locks":"lib/advisory-locks.mjs","/test-database-guard":"lib/test-database-guard.ts"};
    return {path:path.join(root,".local/tanda-f/source/lib/db/src",suffix ? files[suffix]??`${suffix.slice(1)}.ts`:"index.ts")};
  });}}],
});