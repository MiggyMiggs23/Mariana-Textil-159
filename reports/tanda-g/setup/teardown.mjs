import fs from "node:fs";
import {spawnSync} from "node:child_process";
const root="/home/runner/workspace/.local/tanda-g";
const pg="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/pg_ctl";
const evidence={at:new Date().toISOString(),stopped:[],absent:!fs.existsSync(root),removed:false};
if(fs.existsSync(root)){
 for(const name of ["baseline-api","candidate-api","browser-api","proxy"]){
  const file=root+"/"+name+".pid";
  if(!fs.existsSync(file))continue;
  const pid=Number(fs.readFileSync(file,"utf8").trim());
  if(!Number.isSafeInteger(pid)||pid<2)throw Error("Invalid pid");
  if(fs.existsSync(`/proc/${pid}/cmdline`)){
   const cmd=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8");
   const env=fs.readFileSync(`/proc/${pid}/environ`,"utf8");
   const privateProxy=name==="proxy"&&cmd.includes("/reports/tanda-e-20260923/tarea-1/proxy.mjs")&&(env.includes("STATIC_ROOT="+root+"/")||env.includes("STATIC_ROOT=/home/runner/workspace/.local/tanda-g-ui-candidate\0"))&&env.includes("PROXY_PORT=43840");
   if(!cmd.includes("/reports/tanda-g/setup/")&&!cmd.includes(root+"/")&&!privateProxy)throw Error("Refusing unrelated pid");
   process.kill(pid,"SIGTERM");evidence.stopped.push({name,pid});
  }
 }
 await new Promise(resolve=>setTimeout(resolve,1500));
 if(fs.existsSync(root+"/cluster/postmaster.pid")){
  const pid=Number(fs.readFileSync(root+"/cluster/postmaster.pid","utf8").split("\n")[0]);
  if(fs.existsSync(`/proc/${pid}/cmdline`)){
   const cmd=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0");
   if(!cmd.includes(root+"/cluster")||!cmd.includes("55441"))throw Error("Refusing unrelated cluster");
   const result=spawnSync(pg,["-D",root+"/cluster","-m","fast","-w","stop"],{encoding:"utf8"});
   if(result.status!==0)throw Error("Private cluster stop failed");
   evidence.stopped.push({name:"postgres",pid});
  }
 }
 if(process.argv.includes("--remove")){fs.rmSync(root,{recursive:true});evidence.removed=true;}
}
fs.writeFileSync("/home/runner/workspace/reports/tanda-g/setup/teardown-verification.json",JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence));