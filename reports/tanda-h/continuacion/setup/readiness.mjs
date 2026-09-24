import fs from "node:fs";
import pg from "../../../../scripts/node_modules/pg/lib/index.js";
const root=process.cwd(),r=root+"/private.local/tanda-h-resume",out=root+"/reports/tanda-h/continuacion/setup";
const cfg=JSON.parse(fs.readFileSync(r+"/worker-databases.json")).browser;
const c=new pg.Client({connectionString:cfg.url});await c.connect();
try{
 const identity=(await c.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
 if(identity.db!=="tanda_hr_browser"||identity.actor!=="hr_browser"||identity.port!==55445)throw Error("Copy isolation failure");
 const quantities=[];
 for(const [table,column] of [["rollos","cantidad_inicial"],["rollos","cantidad_actual"],["existencias","cantidad_total"]]){
  const row=(await c.query(`select count(*)::int total,count(*) filter(where ${column}<0 or ${column} is null or ${column}::text in ('NaN','Infinity','-Infinity'))::int invalid from public.${table}`)).rows[0];
  if(row.invalid)throw Error("Invalid physical quantities in copy");
  quantities.push({table,column,...row});
 }
 const annual=(await c.query("select count(*)::int tickets,min(created_at) first,max(created_at) last from tickets where folio>1800000000")).rows[0];
 if(annual.tickets!==54750)throw Error("Annual fixture mismatch");
 const small=JSON.parse(fs.readFileSync(out+"/small-customer.json"));
 const smallTickets=(await c.query("select id,total,cobrado,credito,sesion_caja_id from tickets where cliente_id=$1 order by id",[small.id])).rows;
 if(smallTickets.length!==3||smallTickets.some(x=>!x.cobrado))throw Error("Native cashflow readiness mismatch");
 const constraints=(await c.query("select conname,convalidated,pg_get_constraintdef(oid) definition from pg_constraint where conname like '%nonnegative%' or conname like '%physical%'")).rows;
 fs.writeFileSync(out+"/readiness.json",JSON.stringify({at:new Date(),identity,quantities,annual,smallCustomer:small,smallTickets,constraints,applicationStarted:false,gatesOpened:false,metrageChanged:false,annualDataset:"Prior task-2 hypothetical workload, not an inventory correctness simulation",sourceFreeze:"b77bd7db4f97368433ef7dbce6e5c756b78b4452"},null,2));
}finally{await c.end();}