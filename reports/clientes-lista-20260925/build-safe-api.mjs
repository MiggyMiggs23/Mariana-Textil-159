import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {createRequire} from "node:module";
const root=process.cwd(), api=path.join(root,"artifacts/api-server");
const require=createRequire(path.join(api,"build.mjs")); globalThis.require=require;
const {build}=await import(require.resolve("esbuild"));
const {default:pino}=await import(require.resolve("esbuild-plugin-pino"));
const retained=path.join(api,"dist-test-reset-protected-customers-20260925");
const out=path.join(api,"dist-clientes-lista-20260925");
const map=JSON.parse(fs.readFileSync(path.join(retained,"index.mjs.map"),"utf8"));
const originals=new Map(map.sources.map((file,i)=>[path.resolve(retained,file),map.sourcesContent[i]]));
const overlays=new Map(originals);
const routesPath=path.join(api,"src/routes/index.ts");
let routes=originals.get(routesPath);
if(!routes?.includes("router.use(clientesRouter);"))throw Error("Retained route anchor missing");
routes=routes.replace('import clientesRouter from "./clientes";','import clientesRouter from "./clientes";\nimport clientesListadoRouter from "./clientes-listado";')
  .replace("router.use(clientesRouter);","router.use(clientesListadoRouter);\nrouter.use(clientesRouter);");
overlays.set(routesPath,routes);
const zodPath=path.join(root,"lib/api-zod/src/generated/api.ts");
const generated=fs.readFileSync(zodPath,"utf8");
const start=generated.indexOf("export const listClientesListadoQueryQMax");
const end=generated.indexOf("/**\n * @summary Lista el catálogo operativo",start);
if(start<0||end<0)throw Error("Generated schema anchors missing");
overlays.set(zodPath,originals.get(zodPath)+"\n"+generated.slice(start,end));
const newFiles=["artifacts/api-server/src/lib/clientes-listado.ts","artifacts/api-server/src/routes/clientes-listado.ts"];
for(const relative of newFiles)overlays.set(path.join(root,relative),fs.readFileSync(path.join(root,relative),"utf8"));
const buildSource=fs.readFileSync(path.join(api,"build.mjs"),"utf8");
const external=Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner=buildSource.match(/js: `([\s\S]*?)`,/)[1];
const hash=text=>crypto.createHash("sha256").update(text).digest("hex");
const used=[];
await build({entryPoints:[path.join(api,"src/index.ts")],platform:"node",bundle:true,format:"esm",
  outdir:out,outExtension:{".js":".mjs"},external,sourcemap:"linked",banner:{js:banner},logLevel:"info",
  plugins:[{name:"approved-retained-overlay",setup(builder){
    builder.onLoad({filter:/\.[cm]?[jt]sx?$/},args=>{
      if(args.path.includes("node_modules"))return;
      const contents=overlays.get(args.path);
      if(contents===undefined)return; // Pure re-export barrels have no emitted source.
      used.push({path:path.relative(root,args.path),sha256:hash(contents),changed:contents!==originals.get(args.path)});
      return {contents,loader:args.path.endsWith(".ts")?"ts":"js"};
    });
  }},pino({transports:["pino-pretty"]})]});
fs.cpSync(path.join(api,"assets"),path.join(out,"assets"),{recursive:true});
const built=JSON.parse(fs.readFileSync(path.join(out,"index.mjs.map"),"utf8"));
const deltas=[];
for(let i=0;i<built.sources.length;i++){
  const absolute=path.resolve(out,built.sources[i]);
  if(absolute.includes("node_modules"))continue;
  const relative=path.relative(root,absolute);
  if(!overlays.has(absolute))throw Error("Unexpected emitted workspace source: "+relative);
  if(built.sourcesContent[i]!==overlays.get(absolute))throw Error("Source content mismatch: "+relative);
  if(built.sourcesContent[i]!==originals.get(absolute))deltas.push(relative);
}
const expected=[...newFiles,"artifacts/api-server/src/routes/index.ts","lib/api-zod/src/generated/api.ts"].sort();
if(JSON.stringify(deltas.sort())!==JSON.stringify(expected))throw Error("Unexpected delta: "+deltas);
fs.writeFileSync("reports/clientes-lista-20260925/api-build-provenance.json",JSON.stringify({
  retained:"dist-test-reset-protected-customers-20260925",retainedSha256:hash(fs.readFileSync(path.join(retained,"index.mjs"))),
  candidateSha256:hash(fs.readFileSync(path.join(out,"index.mjs"))),node:process.version,esbuild:require("esbuild/package.json").version,
  workspaceDeltas:deltas,used,
},null,2));
fs.writeFileSync("reports/clientes-lista-20260925/api-artifact.sha256",fs.readdirSync(out).filter(f=>f.endsWith(".mjs"))
  .map(f=>`${hash(fs.readFileSync(path.join(out,f)))}  ${path.relative(root,path.join(out,f))}`).join("\n")+"\n");
console.log("SAFE API candidate built; exactly four approved workspace source deltas.");