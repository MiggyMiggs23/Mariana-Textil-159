import fs from "node:fs";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
import {fixture,root} from "./browser-common.mjs";
const name=process.argv[2]||"state";
if(!/^[\w-]+$/.test(name))throw Error("Invalid evidence name");
const c=new pg.Client({connectionString:"postgresql://postgres@127.0.0.1:55440/tanda_f_browser",options:"-c default_transaction_read_only=on"});await c.connect();
try{
const identity=(await c.query("select current_database() db,current_setting('data_directory') dir,current_setting('transaction_read_only') readonly")).rows[0];
if(identity.db!=="tanda_f_browser"||identity.dir!==root+"/.local/tanda-f/cluster"||identity.readonly!=="on")throw Error("Isolation mismatch");
const tables=(await c.query("select table_name from information_schema.columns where table_schema='public' and column_name='cliente_id'")).rows.map(x=>x.table_name);
const data={identity,at:new Date().toISOString()};
for(const t of tables){
 if(t==="cliente_documentos")continue;
 data[t]=(await c.query(`select * from "${t}" where cliente_id=$1`,[fixture.customer.id])).rows;
}
data.customer=(await c.query("select id,limite_credito,saldo_credito from clientes where id=$1",[fixture.customer.id])).rows;
data.applications=(await c.query("select a.* from aplicaciones_credito a join movimientos_credito m on m.id=a.venta_movimiento_id where m.cliente_id=$1",[fixture.customer.id])).rows;
fs.writeFileSync(root+"/reports/tanda-f/tarea-1/"+name+".json",JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));
}finally{await c.end();}