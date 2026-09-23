import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {report,requireMain,verifyPreparation,runtimePin,runtimeUrl,pgTools,pgEnvironment,catalog,auxiliary,write,fingerprints} from "./common.mjs";
requireMain();verifyPreparation();
const pin=runtimePin(), bin=pgTools();
const target=runtimeUrl(pin);
assert.ok(target,"Effective runtime DATABASE_URL absent");
if(process.env.DATABASE_URL) assert.equal(process.env.DATABASE_URL,target,"Different effective URL");
const dir=path.join(report,"evidencia/live");
fs.mkdirSync(dir); // never overwrite a previous capture
try {
  const env=pgEnvironment(target,bin), b0=catalog(env,bin), aux=auxiliary(env,bin), after=catalog(env,bin);
  assert.deepEqual(auxiliary(env,bin),aux,"Auxiliary catalog drift");
  assert.deepEqual(b0,after,"Catalog drift during readonly capture");
  assert.deepEqual(runtimePin(),pin,"Runtime identity drift");
  write(path.join(dir,"catalog-B0-real.json"),b0);
  write(path.join(dir,"auxiliary-B0-real.json"),aux);
  write(path.join(dir,"capture.json"),{status:"PASS_READ_ONLY",...pin,...fingerprints(b0),
    identity:Object.fromEntries(["database","databaseOid","schema","role","serverVersionNum"].map(k=>[k,b0[k]])),
    transaction:"REPEATABLE READ READ ONLY; ROLLBACK",credentialsRecorded:false,actorsCopied:false,pgDumpUsed:false});
  console.log("TANDA_B_CAPTURE=PASS_READ_ONLY");
} catch(e) {write(path.join(dir,"failure.json"),{status:"FAIL",reason:e.message});throw e;}