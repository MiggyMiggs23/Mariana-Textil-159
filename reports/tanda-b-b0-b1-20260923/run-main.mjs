// MAIN-only lifecycle. Never starts/restarts the real API.
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import assert from "node:assert/strict";
import {report,root,requireMain,verifyPreparation,runtimePin,digest,write,json} from "./common.mjs";
requireMain();verifyPreparation();const pin=runtimePin();
assert.equal(json(path.join(report,"evidencia/controls-offline-final.json")).status,"PASS");
assert.equal(json(path.join(report,"evidencia/static-audit.json")).status,"PASS_STATIC_ONLY");
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith("TANDA_B_")||["PATH","HOME","LANG"].includes(k)));
const protectedFiles={};
function protect(dir) {
  for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if(e.isSymbolicLink())continue;const f=path.join(dir,e.name);
    if(e.isDirectory())protect(f);else protectedFiles[f]=digest(fs.readFileSync(f));
  }
}
protect(path.join(root,"reports/tanda-b-off-preparada-20260923/evidencia"));
for(const f of [".replit","artifacts/api-server/dist-e2-20260927/index.mjs"])
  protectedFiles[path.join(root,f)]=digest(fs.readFileSync(path.join(root,f)));
write(path.join(report,"evidencia/main-protected-before.json"),{pin,files:protectedFiles});
let active,interrupted,signalTimer;
for(const signal of ["SIGINT","SIGTERM"])process.once(signal,()=>{
  interrupted=signal;
  if(active) {
    active.kill("SIGTERM"); // allow runner to stop its candidate AND private PG
    signalTimer=setTimeout(()=>{try{process.kill(-active.pid,"SIGKILL");}catch{}},45000);
  }
});
async function step(name,token) {
  if(interrupted)throw Error(`Interrupted ${interrupted}`);
  const c=spawn(process.execPath,[path.join(report,`${name}.mjs`)],{env,cwd:root,detached:true,stdio:["ignore","pipe","pipe"]});
  active=c;let stdout="",stderr="",timeout=false,forced=false,forceTimer,spawnError;
  c.stdout.on("data",b=>{stdout+=b;if(stdout.length>16*1024*1024){timeout=true;c.kill("SIGTERM");}});
  c.stderr.on("data",b=>{stderr+=b;if(stderr.length>16*1024*1024){timeout=true;c.kill("SIGTERM");}});
  c.once("error",e=>{spawnError=e.message;});
  const timer=setTimeout(()=>{
    timeout=true;c.kill("SIGTERM");
    forceTimer=setTimeout(()=>{forced=true;try{process.kill(-c.pid,"SIGKILL");}catch{}},45000);
  },600000);
  const terminal=await new Promise(resolve=>c.once("close",(exit,signal)=>resolve({exit,signal})));
  clearTimeout(timer);clearTimeout(forceTimer);clearTimeout(signalTimer);active=undefined;
  write(path.join(report,"evidencia",`${name}-cli-terminal.json`),{...terminal,stdout,stderr,timeout,forced,spawnError,interrupted,expectedToken:token});
  assert.ok(!timeout&&!forced&&!interrupted&&!spawnError,`${name}: timeout/signal/spawn failure`);
  assert.equal(terminal.exit,0,`${name}: FAIL; evidence retained`);
  assert.ok(stdout.includes(token),`${name}: missing positive token`);
}
let failure;
try {
  for(const [name,token] of [["capture-readonly","TANDA_B_CAPTURE=PASS_READ_ONLY"],["preflight","TANDA_B_PREFLIGHT=PASS"],
    ["rehearse","PASS_DISPOSABLE_MAIN_REVIEW_PENDING"]])await step(name,token);
} catch(e){failure=e.message;process.exitCode=1;}
let protectedError;
try {
  for(const [f,h] of Object.entries(protectedFiles))assert.equal(digest(fs.readFileSync(f)),h,`Protected file changed ${f}`);
  assert.deepEqual(runtimePin(),pin);
  write(path.join(report,"evidencia/main-protected-after.json"),{status:"PASS_UNCHANGED",pin,files:protectedFiles});
} catch(e){protectedError=e.message;process.exitCode=1;}
const status=failure||protectedError||interrupted?"FAIL":"PASS_EXECUTION_AND_PROTECTED";
write(path.join(report,"evidencia/orchestration-terminal.json"),{status,failure,protectedError,interrupted,
  phaseBExecuted:false,finalizerRun:false,cleanupProof:"See rehearsal attempt terminal.json; no inferred cleanup"});
if(status==="PASS_EXECUTION_AND_PROTECTED") {
  try{await step("finalize","TANDA_B_FINAL=PREPARED_OFF_NOT_RELEASED");}
  catch(e){process.exitCode=1;failure=e.message;}
}
write(path.join(report,"evidencia/run-main-terminal.json"),{status:process.exitCode?"FAIL":"PASS_PREPARED_OFF",failure,protectedError,interrupted,phaseBExecuted:false});