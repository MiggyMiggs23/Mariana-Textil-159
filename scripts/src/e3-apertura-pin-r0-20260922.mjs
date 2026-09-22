// Pin the already-built incomplete R0 solely to demonstrate the new integration red.
import fs from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root="/home/runner/workspace", rel="reports/e3-apertura-preparada-20260922", dir=`${root}/${rel}`;
const sha=b=>createHash("sha256").update(b).digest("hex");
const state=JSON.parse(fs.readFileSync(`${dir}/preparation-status.json`));
assert.equal(state.status,"BUILT_NOT_REHEARSED_NOT_RELEASED");
assert(!fs.existsSync(`${dir}/api-start-audit.sh`));
const hashes={...state.outputs};
for(const [file,hash] of Object.entries(hashes)) assert.equal(sha(fs.readFileSync(`${root}/${file}`)),hash);
for(const file of ["release-preflight.mjs","release-catalog.sql","release-expected.json","api-start-audit-record.mjs"])
  hashes[`${rel}/${file}`]=sha(fs.readFileSync(`${dir}/${file}`));
const inventory=Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)).map(([f,h])=>`${h}  ${f}\n`).join("");
fs.writeFileSync(`${dir}/release-assets.sha256`,inventory);
const wrapper=fs.readFileSync(`${dir}/api-start-audit.template.sh`,"utf8")
  .replace("d724585b2ac42658c32de38bd95e96dfc95a881a95c1377566d06d3fe64133fe",sha(inventory));
fs.writeFileSync(`${dir}/api-start-audit.sh`,wrapper,{flag:"wx"});
console.log("PINNED_R0_FOR_EXPECTED_RED_ONLY_NOT_RELEASED");