import fs from "node:fs";
import pg from "../../scripts/node_modules/pg/lib/index.js";
const root="/home/runner/workspace";
const privateDir=root+"/.local/tanda-e-continuacion";
const report=root+"/reports/tanda-e-continuacion";
const credentials=JSON.parse(fs.readFileSync(privateDir+"/credentials.json","utf8"));
const manifest=JSON.parse(fs.readFileSync(report+"/fixture-manifest-redacted.json","utf8"));
const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy"});
try {
 await c.connect();
 if((await c.query("SELECT current_database() d")).rows[0].d!=="tanda_e_continuacion_copy")throw Error("Identity mismatch");
 const result=await c.query("UPDATE usuarios SET usuario='admin' WHERE id=$1 AND usuario='tandaec-admin' AND rol='ADMIN' AND activo RETURNING id",[credentials.admin.id]);
 if(result.rowCount!==1)throw Error("Synthetic ADMIN identity mismatch");
 credentials.admin.username="admin";
 manifest.actors.admin.username="admin";
 fs.writeFileSync(privateDir+"/credentials.json",JSON.stringify(credentials,null,2),{mode:0o600});
 fs.writeFileSync(report+"/fixture-manifest-redacted.json",JSON.stringify(manifest,null,2));
 fs.appendFileSync(report+"/progress.txt",new Date().toISOString()+" Isolated launch blocker: prepared-test guard requires canonical username admin. Renamed ONLY synthetic ADMIN234 to admin; same random private password, restored actors remain disabled. No guard bypass or application edits.\n");
} finally {await c.end();}