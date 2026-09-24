import fs from "node:fs";
import assert from "node:assert/strict";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const dir="/home/runner/workspace/reports/tanda-g/candidate";
const c=new pg.Client({host:"127.0.0.1",port:55441,user:"postgres",database:"tanda_g_candidate",options:"-c default_transaction_read_only=on"});
await c.connect();
const identity=(await c.query("select current_database() db,current_setting('data_directory') dir")).rows[0];
assert.equal(identity.db,"tanda_g_candidate");assert.equal(identity.dir,"/home/runner/workspace/.local/tanda-g/cluster");
const cases=[];
for(const n of [1,2,4,5,6,7,8,9,"1-legacy"]){
 const r=JSON.parse(fs.readFileSync(`${dir}/case-${n}.json`,"utf8"));
 const rejected=r.steps.at(-1);
 assert.equal(rejected.committed,false);assert.equal(rejected.unchanged,true);
 assert.equal(Object.keys(rejected.businessBefore).length,107);
 assert.match(rejected.error.code,/^REVERSAL_/);
 const activation=(await c.query("select accion,entidad_id,datos_antes,datos_despues from auditoria where entidad='movimientos' and entidad_id=$1 and accion='INVENTARIO_ESTADO_MOVIMIENTO_V1'",[String(r.fixture.movementId)])).rows;
 assert.equal(activation.length,n==="1-legacy"?0:1);
 cases.push({case:n,activationEvidence:activation,rejectedStep:rejected.name,code:rejected.error.code,message:rejected.error.message,all107BusinessTablesUnchanged:rejected.unchanged,changedTables:rejected.changedTables});
}
await c.end();
fs.writeFileSync(`${dir}/acceptance-summary.json`,JSON.stringify({at:new Date().toISOString(),candidateCommit:"61d82169e414354f8e613f53d583581f3d7955fb",identity,cases,excludedCases:[3,10],scope:"native production helpers; all public table rows hashed before/after rejected transaction, sequences excluded"},null,2));
console.log("8 fresh native scenarios + legacy distinction passed; full 107-table digests unchanged for every rejection.");