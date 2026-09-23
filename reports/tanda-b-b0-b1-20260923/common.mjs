import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
export { canonical, fingerprints } from "../../scripts/src/release-catalog-comparison.mjs";
export const report = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(report,"../..");
export const revision = "cc628aed315a4bbfd3e6cb8766d28200ce400842";
export const distName = "dist-tanda-b-b0-b1-20260923";
export const digest = v => createHash("sha256").update(v).digest("hex");
export const json = p => JSON.parse(fs.readFileSync(p,"utf8"));
export const write = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n",{flag:"wx"});
export function requireMain() { if(process.env.TANDA_B_MAIN_ONLY!=="AUTHORIZED") throw Error("MAIN authorization required"); }
export function verifyPreparation() {
  const m=json(path.join(report,"preparation-inputs.json"));
  for(const [p,h] of Object.entries(m.files)) if(digest(fs.readFileSync(path.join(root,p)))!==h) throw Error(`Preparation input changed: ${p}`);
}
export function run(cmd,args,opts={}) {
  const r=spawnSync(cmd,args,{encoding:"utf8",timeout:120000,maxBuffer:128*1024*1024,...opts});
  if(r.status!==0) throw Error(`${path.basename(cmd)} exit ${r.status}; inspect protected local evidence, credentials withheld`);
  return r;
}
export function pgTools() {
  const p=process.env.TANDA_B_PG_BIN;
  if(!p||!path.isAbsolute(p)) throw Error("absolute TANDA_B_PG_BIN required");
  if(!/PostgreSQL\) 16\./.test(run(path.join(p,"psql"),["--version"]).stdout)) throw Error("PG16 required");
  return p;
}
export function pgEnvironment(url,bin) {
  const u=new URL(url);
  if(!["postgres:","postgresql:"].includes(u.protocol)) throw Error("Postgres URL required");
  return {PATH:bin,HOME:"/tmp",LANG:"C.UTF-8",PGHOST:u.hostname,PGPORT:u.port||"5432",
    PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),
    PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:u.searchParams.get("sslmode")||"prefer",
    PGCONNECT_TIMEOUT:"5",PGAPPNAME:"tanda-b-b0-readonly",PGOPTIONS:"-c default_transaction_read_only=on"};
}
export function catalog(env,bin) {
  const c=JSON.parse(run(path.join(bin,"psql"),["-X","-qAt","-v","ON_ERROR_STOP=1"],{env,
    input:fs.readFileSync(path.join(report,"release-catalog.sql"),"utf8")}).stdout.trim());
  if(c.readOnly!=="on"||Number(c.enabledEventTriggers)!==0) throw Error("Readonly/event trigger guard");
  return c;
}
export function auxiliary(env,bin) {
  const c=JSON.parse(run(path.join(bin,"psql"),["-X","-qAt","-v","ON_ERROR_STOP=1"],{env,
    input:fs.readFileSync(path.join(report,"auxiliary-catalog.sql"),"utf8")}).stdout.trim());
  if(c.readOnly!=="on")throw Error("Auxiliary capture must be READ ONLY");
  return c;
}
export function runtimeUrl(pin) {
  const env=Object.fromEntries(fs.readFileSync(`/proc/${pin.pid}/environ`,"utf8").split("\0").filter(Boolean).map(s=>{
    const i=s.indexOf("=");return [s.slice(0,i),s.slice(i+1)];
  }));
  if(env.TEST_DATABASE_URL||env.REQUIRE_ISOLATED_TEST_DATABASE==="1"||env.NODE_ENV==="test")throw Error("Runtime overrides require new effective-identity review");
  if(!env.DATABASE_URL)throw Error("Effective DATABASE_URL absent");
  return env.DATABASE_URL;
}
export const sqlPaths=["reports/tanda-b-20260922/e4/01-preparado.sql","reports/tanda-b-20260922/e12/01-preparado.sql",
  "reports/e9/01-preparado.sql","reports/e5/01-preparado.sql","reports/e11/01-preparado.sql"];
export function verifyOutputs() {
  const m=json(path.join(report,"manifest.json"));
  for(const [f,h] of Object.entries(m.outputs)) if(digest(fs.readFileSync(path.join(root,f)))!==h) throw Error(`Hash mismatch: ${f}`);
  return m;
}
export function runtimePin() {
  const pid=process.env.TANDA_B_RUNTIME_PID;
  if(!/^[1-9][0-9]*$/.test(pid||"")) throw Error("Explicit current runtime PID required");
  const proc=`/proc/${pid}`;
  const cmd=fs.readFileSync(`${proc}/cmdline`), stat=fs.readFileSync(`${proc}/stat`,"utf8");
  const ticks=stat.slice(stat.lastIndexOf(") ")+2).split(" ")[19];
  if(ticks!==process.env.TANDA_B_START_TICKS||digest(cmd)!==process.env.TANDA_B_CMDLINE_SHA256) throw Error("Runtime pin changed");
  const bundle=path.join(root,"artifacts/api-server/dist-e2-20260927/index.mjs");
  const args=cmd.toString().split("\0");
  if(!args.some(a=>path.resolve(fs.realpathSync(`${proc}/cwd`),a)===bundle)) throw Error("Runtime bundle mismatch");
  if(digest(fs.readFileSync(bundle))!=="008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5") throw Error("Control disk hash changed");
  return {pid:Number(pid),startTicks:ticks,cmdlineSha256:digest(cmd),bundleSha256:digest(fs.readFileSync(bundle))};
}