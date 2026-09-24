import fs from "node:fs";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
const out="reports/tanda-h/continuacion/mediciones",p="private.local/tanda-h-resume";
const build=JSON.parse(fs.readFileSync("reports/tanda-h/continuacion/setup/build-identity.json"));
const identity={at:new Date().toISOString(),sourceCommit:build.commit,assets:build.assets.map(a=>({path:a.path,expected:a.sha256,actual:crypto.createHash("sha256").update(fs.readFileSync(`${p}/frozen-source/${a.path}`)).digest("hex")})),processes:[]};
for(const kind of ["api","ui"]){const pid=Number(fs.readFileSync(`${p}/browser-${kind}.pid`));try{identity.processes.push({kind,pid,cmd:fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").replaceAll("\0"," "),cwd:fs.readlinkSync(`/proc/${pid}/cwd`)});}catch(e){identity.processes.push({kind,pid,error:e.code,earlierObservation:"Initial ps identified PID 2568 as setup/api-runner.mjs and PID 2584 as setup/proxy.mjs; no server lifecycle performed by this worker."});}}
identity.allAssetHashesMatch=identity.assets.every(a=>a.actual===a.expected);
identity.osSnapshot=execFileSync("bash",["-c","free -m; ps -eo comm | sort | uniq -c | grep -E 'chrome|chromium|node'"],{encoding:"utf8"});
identity.osLimitation="Snapshot after browser closure; no evidence of browser-process leak or current memory exhaustion. /proc/pressure/memory unavailable. This does not diagnose transient blank documents.";
fs.writeFileSync(out+"/identity-environment.json",JSON.stringify(identity,null,2));
const samples=fs.readdirSync(out).filter(n=>/^(small|large|cash|cut|credit)-.*\.json$/.test(n)&&!n.includes("tickets")&&!n.includes("persisted")).map(n=>{const r=JSON.parse(fs.readFileSync(out+"/"+n));return {file:n,ready:r.ready,routeReadyMs:r.routeReadyMs,clickReadyMs:r.clickReadyMs,error:r.error,cdp:r.cdp};});
fs.writeFileSync(out+"/summary.json",JSON.stringify({
 samples,
 conclusions:{
  small:"Customer 9 E7 ready, native navigation and selected site 835: 3788.54 ms navigation; tab click to ready 865.62 ms. Export HTTP 200; fresh auth/me 200 ADMIN.",
  large:"Customer 8 twice times out on e7-client-export; subsequent body read and screenshot also timeout. Auth/me 200 ADMIN and availability 200 enabled; no client export request observed. Not an established server authorization failure.",
  cash:"Three native producer-created tickets 54862–54864 collected by CAJA via actual Cobrar → Efectivo → Confirmar Pago, success toast and screenshots. Persisted payments 41157–41159, session 46, 1000 each. Click-to-success 1166.51 / 319.37 / 396.30 ms.",
  cut:"Only one ready sample: navigation 4653.47 ms, click-to-dialog 945.42 ms; no three-sample certification. Later attempt had authenticated shell but no Caja Operativa; subsequent attempts blank login without auth requests.",
  credit:"Two ready samples only: 11005.31 / 9804.43 ms, exceeds 3000 ms objective. Approximately 261710 DOM nodes and 8.91–9.99 s main-thread task CPU. Report HTTP TTFB 825 / 758 ms. Missing sample blank login without auth request.",
  blank:"Requestless blank login is distinct from rejected auth. No pageerror and no auth request; only external-font request blocked as intended. Exact browser/bootstrap cause not established by bounded read-only evidence; do not call this an auth gate failure.",
  recommendation:"Indexes alone do not achieve credit readiness target. Needed frontend change: paginate/virtualize report rows and avoid mounting entire 261k-node result. No implementation performed. Large-account readiness needs bounded rendering investigation independently of auth.",
  exclusions:"No source, schema, gate or business-metric changes; no SQL paired rerun. Browser network TTFB is not SQL duration. Cash routeReadyMs includes selection, confirmation and pre-confirm screenshot; cash clickReadyMs excludes screenshot. All browsers are separate processes, native login, no auth mocks or tokens. Test servers owned by MAIN."
 }
},null,2));