import fs from "node:fs";
import {createRequire} from "node:module";
const root="/home/runner/workspace", privateRoot=root+"/.local/tanda-g", source=privateRoot+"/candidate-source";
const require=createRequire(source+"/artifacts/api-server/package.json"),{build}=require("esbuild");
fs.mkdirSync(root+"/reports/tanda-g/candidate",{recursive:true});
let text=fs.readFileSync(root+"/reports/tanda-f/tarea-5/run.ts","utf8")
 .replaceAll('"../../../lib/',JSON.stringify(source+"/lib/").slice(0,-1))
 .replaceAll('"../../../artifacts/',JSON.stringify(source+"/artifacts/").slice(0,-1))
 .replaceAll("reports/tanda-f/tarea-5","reports/tanda-g/candidate")
 .replaceAll("tanda-f","tanda-g").replaceAll("tanda_f_reversal","tanda_g_candidate")
 .replaceAll("55440","55441").replaceAll("Tanda F","Tanda G candidate")
 .replace("import { ajustarRollo,","import { crearRollo, activarRollo, ajustarRollo,");
text=text.replace('const selected = Number(process.argv[2]);',`const selected = Number(process.argv[2]);
if (![1,2,4,5,6,7,8,9].includes(selected)) throw Error("Only strict eight permitted");
const legacy = process.argv.includes("--legacy");
async function fullDigest() {
 const client=await pool.connect();
 try {
 await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const tables=(await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
 const result:any={};
 for(const {tablename} of tables){
  const name='"'+tablename.replaceAll('"','""')+'"';
  result[tablename]=(await client.query('select count(*)::int count,md5(coalesce(string_agg(h,\\'\\' order by h),\\'\\')) digest from (select md5(row_to_json(t)::text) h from '+name+' t) s')).rows[0];
 }
 await client.query("ROLLBACK");return result;
 }finally{client.release();}
}`);
text=text.replace('`${dir}/case-${selected}.json`','`${dir}/case-${selected}${legacy?"-legacy":""}.json`');
text=text.replace('report.identity = await identity();\n  try {','report.identity = await identity();\n  const businessBefore = await fullDigest();\n  try {');
text=text.replace('report.steps.push({ name, committed: false, error:',`const businessAfter=await fullDigest();
    const changedTables=Object.keys(businessBefore).filter(k=>JSON.stringify(businessBefore[k])!==JSON.stringify(businessAfter[k]));
    report.steps.push({ name, committed: false, businessBefore, businessAfter, changedTables, unchanged:changedTables.length===0, error:`);
text=text.replace('report.fixture = fixture;',`if(!legacy){
      const created=await db.transaction(tx=>crearRollo(tx,{productoId:fixture.productId,ubicacionId:fixture.siteId,proveedorId:fixture.supplierId,cantidadInicial:"10",costoUnitario:"100",usuarioId:actor,uuidCliente:randomUUID()}));
      const activated=await db.transaction(tx=>activarRollo(tx,{rolloId:created.rollo.id,cantidadReal:"10",usuarioId:actor,uuidCliente:randomUUID()}));
      fixture={...fixture,id:created.rollo.id,serie:created.rollo.serie,movementId:activated.movimiento.id,entryId:null,provenance:"native crearRollo PROGRAMADO -> candidate activarRollo RECEPCION; existing supplier"};
    }
    report.fixture = fixture;report.activationEvidence=legacy?"legacy fixture intentionally no evidence":"fresh candidate-produced activation and movement evidence";`);
fs.writeFileSync(privateRoot+"/candidate-run.ts",text,{mode:0o600});
await build({entryPoints:[privateRoot+"/candidate-run.ts"],outfile:privateRoot+"/candidate-run.mjs",bundle:true,platform:"node",format:"esm",external:["pg-native"],nodePaths:[source+"/lib/db/node_modules",source+"/artifacts/api-server/node_modules"],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});