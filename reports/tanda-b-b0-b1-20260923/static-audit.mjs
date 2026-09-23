import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {report,root,distName,revision,json,write,digest,verifyOutputs} from "./common.mjs";
const s=json(path.join(report,"source-manifest.json"));assert.equal(s.revision,revision);
const gates=[];
for(const [f,h] of Object.entries(s.files)) {
  const b=fs.readFileSync(path.join(report,"source",f));assert.equal(digest(b),h);
  if(!/\/src\/lib\/.*\.ts$/.test(f)||f.includes(".test."))continue;
  for(const m of b.toString().matchAll(/export const ((?:E(?:3|4|5|7|9|11|12)\w*|CREDIT\w*|FONDO_E10\w*|REMATE\w*)_(?:ENABLED|RELEASED))(?::\s*boolean)?\s*=\s*(true|false)/g)) {
    assert.equal(m[2],"false",`Gate ${m[1]}`);gates.push({file:f,name:m[1],value:m[2]});
  }
}
for(const n of ["E3_ENABLED","E4_CASH_OUT_ENABLED","CREDIT_CASH_INCOME_CAPTURE_ENABLED","CREDIT_CASH_RETURN_CAPTURE_ENABLED"])
  assert.ok(gates.some(g=>g.name===n),`Required gate ${n}`);
const m=verifyOutputs(),api=path.join(root,"artifacts/api-server",distName),text=fs.readFileSync(path.join(api,"index.mjs"),"utf8");
const dirs=[...text.matchAll(/const outputDir = "([^"]+)";/g)].map(m=>m[1]);assert.ok(dirs.length);assert.ok(dirs.every(d=>d===api));
const workers=[...text.matchAll(/pinoBundlerAbsolutePath\("(\.\/[^"]+)"\)/g)].map(m=>m[1]);assert.ok(workers.length>=4);
for(const worker of workers)assert.ok(fs.existsSync(path.join(api,worker)));
assert.equal(digest(fs.readFileSync(path.join(root,"scripts/src/release-catalog-comparison.mjs"))),"77ce5002a0751275c8b7d1ecd9f82aa858fffbfaf3c014829be3d36bff5f2828");
write(path.join(report,"evidencia/static-audit.json"),{status:"PASS_STATIC_ONLY",revision,gates,workers,outputFiles:Object.keys(m.outputs).length,
  comparatorCommit:"817830d",comparatorSha256:"77ce5002a0751275c8b7d1ecd9f82aa858fffbfaf3c014829be3d36bff5f2828",
  sourceAndOutputsVerified:true,relocatable:false,applicationStarted:false});