// File-only command. No builds, servers, DB, login or tests.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
const [apiArg,uiArg,destination]=process.argv.slice(2);
assert.ok(apiArg&&uiArg&&destination,"node prepare-readiness.mjs CANDIDATE_API CANDIDATE_UI OUTPUT_JSON");
const api=fs.realpathSync(apiArg),ui=fs.realpathSync(uiArg);
const sha=b=>createHash("sha256").update(b).digest("hex");
const frontendFiles=Object.fromEntries(fs.readdirSync(ui,{recursive:true}).filter(f=>fs.statSync(path.join(ui,f)).isFile()).map(f=>[f,sha(fs.readFileSync(path.join(ui,f)))]));
assert.ok(frontendFiles["index.html"]);
fs.writeFileSync(destination,JSON.stringify({ready:true,api,ui,apiSha256:sha(fs.readFileSync(api)),frontendFiles,contract:{
  module:"recibos_abonos",action:"ver",discovery:"/recibos-abonos",
  e3List:"/api/caja/recibos-e3",e5List:"/api/e5/recibos"
}},null,2),{mode:0o600});
console.log(destination);