import fs from "node:fs";
import {randomUUID} from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const origin="http://127.0.0.1:43843",root="/home/runner/workspace";
const pid=Number(fs.readFileSync(root+"/.local/tanda-g/browser-api.pid","utf8"));
const processEnv=fs.readFileSync(`/proc/${pid}/environ`,"utf8");
if(!processEnv.includes("TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/tanda_g_browser\0")||!processEnv.includes("ISOLATED_API_MODULE="+root+"/.local/tanda-g/candidate-source/artifacts/api-server/dist/index.mjs\0"))throw Error("API identity not verified");
const credentials=JSON.parse(fs.readFileSync(root+"/.local/tanda-g/credentials.json","utf8")).admin;
const login=await fetch(origin+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({usuario:credentials.username,password:credentials.password})});
if(!login.ok)throw Error("Private login failed");
const cookie=login.headers.get("set-cookie")?.split(";")[0];
if(!cookie)throw Error("Missing private cookie");
const client=new pg.Client({host:"127.0.0.1",port:55441,user:"postgres",database:"tanda_g_browser",options:"-c default_transaction_read_only=on"});
await client.connect();
const results=[];
for(const fixture of JSON.parse(fs.readFileSync(root+"/reports/tanda-g/candidate/negative-api-fixtures.json","utf8"))){
 const before=(await client.query("select id,estado,cantidad_actual,ubicacion_id from rollos where id=$1",[fixture.rollId])).rows[0];
 if(before.estado!=="PROGRAMADO"||Number(before.cantidad_actual)!==10)throw Error("Probe already consumed or fixture changed");
 const response=await fetch(origin+`/api/inventario/rollos/${fixture.rollId}/activar`,{method:"POST",headers:{"content-type":"application/json",cookie},body:JSON.stringify({cantidadReal:"-2",notas:"Tanda G authorized isolated negative activation probe",uuidCliente:randomUUID()})});
 const body=await response.json();
 const after=(await client.query("select id,estado,cantidad_actual,ubicacion_id from rollos where id=$1",[fixture.rollId])).rows[0];
 const movements=(await client.query("select id,tipo,cantidad,ubicacion_id from movimientos where rollo_id=$1 order by id",[fixture.rollId])).rows;
 results.push({...fixture,before,status:response.status,error:body.error??null,after,movements,negativePhysicalCommitted:Number(after.cantidad_actual)<0});
}
await client.end();
fs.writeFileSync(root+"/reports/tanda-g/candidate/negative-api-results.json",JSON.stringify({at:new Date().toISOString(),apiPid:pid,authenticatedRole:"ADMIN",results},null,2));
console.log(JSON.stringify(results.map(r=>({unit:r.unit,status:r.status,negativePhysicalCommitted:r.negativePhysicalCommitted}))));