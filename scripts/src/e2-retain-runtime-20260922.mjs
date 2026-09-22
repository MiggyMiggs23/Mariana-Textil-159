import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
const root=process.cwd();
const out="reports/e2-liberacion-20260922";
const metadata=JSON.parse(fs.readFileSync(`${out}/e2-backup-restore-20260922-metadata.json`));
const require=createRequire(path.resolve("artifacts/api-server/dist/index.mjs"));
const units=new Set();
function addUnit(target) {
  const real=fs.realpathSync(target);
  const rel=path.relative(root,real);
  assert.ok(rel.startsWith("node_modules/.pnpm/"));
  const unit=rel.split("/").slice(0,3).join("/");
  if(units.has(unit))return;
  units.add(unit);
  const scan=d=>{
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      const p=path.join(d,e.name);
      if(e.isSymbolicLink()) {
        const dest=fs.realpathSync(p);
        if(dest.includes("/node_modules/.pnpm/")) addUnit(dest);
      } else if(e.isDirectory())scan(p);
    }
  };
  scan(unit);
}
addUnit(require.resolve("@google-cloud/storage"));
const entry="artifacts/api-server/node_modules/@google-cloud/storage";
assert.ok(fs.existsSync(entry));
const files=["artifacts/api-server/dist",entry,...units,
  "reports/e2-apertura-limitada/reconstruccion/runtime-preflight.mjs",
  "artifacts/api-server/.replit-artifact/artifact.toml",
  "reports/e2-liberacion-20260922/workflows-before.json","pnpm-lock.yaml"];
const archive=`${metadata.backupDirectory}/retained-runtime.tar.gz`;
assert.ok(!fs.existsSync(archive));
const r=spawnSync("tar",["-czf",archive,...files],{encoding:"utf8",timeout:120000,maxBuffer:1024*1024});
assert.equal(r.status,0,r.stderr);
const listing=spawnSync("tar",["-tzf",archive],{encoding:"utf8",maxBuffer:16*1024*1024});
assert.equal(listing.status,0);
for(const file of ["index.mjs","pino-file.mjs","pino-worker.mjs","pino-pretty.mjs","thread-stream-worker.mjs","assets/fonts/DejaVuSans.ttf"])assert.ok(listing.stdout.includes(`artifacts/api-server/dist/${file}`));
const sha=p=>createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const evidence={status:"PASS",archive,sha256:sha(archive),sizeBytes:fs.statSync(archive).size,
  files,externalDependency:"@google-cloud/storage including pnpm dependency closure",
  dependencyUnits:units.size,node:process.version,nodeExecutable:process.execPath,
  retainedBundleSha256:sha("artifacts/api-server/dist/index.mjs"),
  noActiveBundleModification:true,archiveListingVerified:true};
assert.equal(evidence.retainedBundleSha256,"3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98");
fs.writeFileSync(`${out}/retained-runtime.json`,JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify({status:evidence.status,sizeBytes:evidence.sizeBytes,dependencyUnits:evidence.dependencyUnits}));