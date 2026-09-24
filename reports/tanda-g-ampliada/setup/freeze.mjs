import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
const root="/home/runner/workspace", r=root+"/.local/tanda-g-ampliada", s=r+"/frozen-source", report=root+"/reports/tanda-g-ampliada/setup";
function run(command,args,options={}){
 const x=spawnSync(command,args,{cwd:root,encoding:"utf8",timeout:180000,maxBuffer:8000000,...options});
 if(x.status!==0){fs.writeFileSync(r+"/build-error.txt",(x.stderr||"")+(x.stdout||""),{mode:0o600});throw Error(command+" failed; private diagnostics");}return x.stdout;
}
let commit=run("git",["rev-parse","HEAD"]).trim();
if(!process.argv.includes("--finalize")){
if(fs.existsSync(s))throw Error("Frozen source already exists");
fs.mkdirSync(s,{recursive:true,mode:0o700});
run("git",["archive","--format=tar","--output="+r+"/source.tar",commit]);
run("tar",["-xf",r+"/source.tar","-C",s]);
let link=fs.readFileSync(root+"/reports/tanda-g/setup/link-frozen-dependencies.mjs","utf8");
link=link.replace('root+"/.local/tanda-g/"+(process.argv[2]==="candidate"?"candidate-source":"baseline-source")',JSON.stringify(s));
fs.writeFileSync(r+"/link.mjs",link,{mode:0o600});
run(process.execPath,[r+"/link.mjs"]);
run(process.execPath,[s+"/artifacts/api-server/build.mjs"],{cwd:s+"/artifacts/api-server",env:{PATH:process.env.PATH,HOME:r,NODE_ENV:"production"}});
run(process.execPath,[s+"/artifacts/mariana-textil/node_modules/vite/bin/vite.js","build"],{cwd:s+"/artifacts/mariana-textil",env:{PATH:process.env.PATH,HOME:r,NODE_ENV:"production",BASE_PATH:"/"}});
}
const archiveHeader=Buffer.alloc(10240), archiveFd=fs.openSync(r+"/source.tar","r");
fs.readSync(archiveFd,archiveHeader,0,archiveHeader.length,0);fs.closeSync(archiveFd);
commit=run("git",["get-tar-commit-id"],{input:archiveHeader}).trim();
const hash=p=>createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(p+"/"+x.name):[p+"/"+x.name]);
const assets=walk(s+"/artifacts/mariana-textil/dist/public").map(p=>({path:p.slice(s.length+1),sha256:hash(p)}));
fs.writeFileSync(report+"/build-identity.json",JSON.stringify({commit,sourceArchiveSha256:run("sha256sum",[r+"/source.tar"]).split(" ")[0],apiSha256:hash(s+"/artifacts/api-server/dist/index.mjs"),uiAssets:assets,applicationStarted:false,testsRun:false,freeze:"git archive; workspace library links resolve to frozen source"},null,2));
console.log("Frozen HEAD API and UI builds ready; no application started.");