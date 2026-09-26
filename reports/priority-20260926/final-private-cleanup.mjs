import fs from "node:fs";
const roots=["/tmp/priority-20260926","/tmp/priority-perf-20260926","/tmp/priority-fiscal-20260926"];
const retained="/tmp/priority-20260926/private-api.log";
const count=p=>fs.readdirSync(p,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?count(`${p}/${e.name}`):1),0);
const removal=[];
for(const root of roots){
  if(!fs.existsSync(root)){removal.push({root,existed:false});continue;}
  if(fs.lstatSync(root).isSymbolicLink())throw Error("Unexpected root symlink");
  const before=count(root);
  for(const entry of fs.readdirSync(root)){
    const p=`${root}/${entry}`;
    if(p===retained){fs.chmodSync(p,0o600);continue;}
    fs.rmSync(p,{recursive:true,force:true});
  }
  const remaining=fs.readdirSync(root);
  if(!remaining.length)fs.rmdirSync(root);else fs.chmodSync(root,0o700);
  removal.push({root,beforeFiles:before,removedFiles:before-remaining.length,remaining});
}
const archival=JSON.parse(fs.readFileSync("reports/priority-20260926/final-archival.json"));
const evidence={status:"BRANCHES_ABSENT_CREDENTIALS_REMOVED_RESIDUAL_LOG_PRESERVED_FOR_MAIN",
  at:new Date().toISOString(),project:"withered-block-09991755",
  branchDeletionOrder:[
    {branch:"br-hidden-lab-axibqutc",deleteSucceeded:true,independentDescribe:"HTTP404 branch not found"},
    {branch:"br-snowy-sea-ax2ft2er",deleteSucceeded:true,independentDescribe:"HTTP404 branch not found"}
  ],otherBranchesTouched:false,applicationDatabaseAccess:false,managedWorkflowsTouched:false,
  ports:archival.ports,removal,
  credentialsDumpsEnvAndBrowserSessionsRemoved:true,
  retainedPrivateException:fs.existsSync(retained)?{
    path:retained,mode:"0600 under0700 directory",
    reason:"MAIN requested residual login500 cause preservation. Worker cannot inspect console logs under developer scope, so preserve only this original log for MAIN rather than irreversibly destroy unextracted evidence.",
    nextStep:"MAIN extract sanitized exception cause if authorized, then delete this last private log and directory."
  }:null,
  reportsAndScreenshotsRetained:true,finalArchival:"final-archival.json",
  residualCauseReport:"residual-login-cause.json"};
fs.writeFileSync("reports/priority-20260926/cleanup.json",JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence));