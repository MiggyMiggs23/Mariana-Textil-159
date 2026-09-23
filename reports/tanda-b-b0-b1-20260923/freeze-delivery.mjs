// File-only delivery inventory. No DB, network, tests, builds or application import.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,"../..");
const output=path.join(dir,"delivery-inventory.json"),checksum=path.join(dir,"delivery-inventory.sha256");
assert.ok(!fs.existsSync(output)&&!fs.existsSync(checksum),"Delivery inventory is immutable; never overwrite");
const sha=b=>createHash("sha256").update(b).digest("hex");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const files={},links={};
const excluded=[output,checksum].map(p=>path.relative(root,p));
function add(file) {
  const rel=path.relative(root,file);if(excluded.includes(rel))return;
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()) {
    const target=fs.readlinkSync(file);
    links[rel]={target,sha256OfLinkTargetUtf8:sha(target),externalTargetBytesIncluded:false};
  } else if(stat.isDirectory()) {
    for(const e of fs.readdirSync(file).sort())add(path.join(file,e));
  } else if(stat.isFile())files[rel]={bytes:stat.size,sha256:sha(fs.readFileSync(file))};
  else throw Error(`Unsupported delivery entry: ${rel}`);
}
const final=read(path.join(dir,"r5/final-manifest.json"));
assert.equal(read(path.join(dir,"r5/evidencia/run-main-terminal.json")).status,"PASS_PREPARED_OFF");
assert.equal(read(path.join(dir,"r5/evidencia/finalize-cli-terminal.json")).exit,0);
add(dir);
for(const [rel,hash] of Object.entries(final.outputs)) {
  add(path.join(root,rel));assert.equal(files[rel].sha256,hash,`Output differs ${rel}`);
}
const external=[
  "reports/tanda-c-20260923/07-resultado-paquete-b0-b1.md",
  "reports/tanda-c-20260923/autorizacion-propietario-tanda-b-b0-b1.txt",
  "reports/tanda-c-20260923/autorizacion-cuatro-reemplazos-e5.txt",
  "reports/tanda-c-20260923/07-enum-unit.log",
  "reports/tanda-c-20260923/07-enum-postgres.log",
  "scripts/src/release-catalog-comparison.mjs",
  "scripts/src/release-catalog-comparison.test.mjs",
  "scripts/src/release-catalog-postgres-main-only.mjs",
  "scripts/src/e5-sql-case-regression.test.mjs",
  "scripts/src/sql-if-case-audit.mjs",
  ...Object.keys(final.sourceSql.inputs),
];
for(const rel of external)add(path.join(root,rel));
const protectedFiles=read(path.join(dir,"r5/evidencia/main-protected-after.json")).files;
for(const [file,hash] of Object.entries(protectedFiles)) {
  const rel=path.relative(root,file);
  assert.ok(!rel.startsWith(".."),"Protected path outside workspace");
  add(file);assert.equal(files[rel].sha256,hash,`Protected disk file differs ${rel}`);
}
// Include records written after final-manifest's inventory, without rewriting it.
for(const rel of ["r5/evidencia/run-main-terminal.json","r5/evidencia/finalize-cli-terminal.json"])
  assert.ok(files[path.relative(root,path.join(dir,rel))]);
const inventory={
  status:"DELIVERY_FILE_INVENTORY_NOT_RELEASE_AUTHORIZATION",
  result:"PASS_PREPARED_OFF",phaseBExecuted:false,releaseAuthorized:false,
  finalManifest:"reports/tanda-b-b0-b1-20260923/r5/final-manifest.json",
  finalManifestSha256:sha(fs.readFileSync(path.join(dir,"r5/final-manifest.json"))),
  scope:"Every regular file under package, 23 output assets, explicit external source/authorization/result files and runtime-protected disk references",
  selfExclusions:excluded,
  symlinkPolicy:"Hash link target UTF-8 text; do not traverse external node_modules dependencies; link target package bytes are outside delivery scope",
  fileCount:Object.keys(files).length,linkCount:Object.keys(links).length,
  files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b))),
  links:Object.fromEntries(Object.entries(links).sort(([a],[b])=>a.localeCompare(b))),
};
fs.writeFileSync(output,JSON.stringify(inventory,null,2)+"\n",{flag:"wx"});
fs.writeFileSync(checksum,`${sha(fs.readFileSync(output))}  ${path.relative(root,output)}\n`,{flag:"wx"});
console.log(JSON.stringify({inventory:path.relative(root,output),sha256:sha(fs.readFileSync(output)),
  files:inventory.fileCount,links:inventory.linkCount,phaseBExecuted:false}));