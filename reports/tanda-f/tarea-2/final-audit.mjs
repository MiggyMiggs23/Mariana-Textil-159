import fs from "node:fs";
import {c,identity} from "./db.mjs";
import {dir} from "./browser.mjs";
try{
const result={identity,at:new Date().toISOString(),caches:(await c.query("select * from existencias where producto_id between 2078 and 2081 order by ubicacion_id,producto_id")).rows,salidas:(await c.query("select * from salidas where origen_id=836")).rows,partialEnabledCount:(await c.query("select count(*) from productos where activo=true and se_vende_por_metro=true")).rows,customer8Ledger:(await c.query("select * from movimientos_credito where cliente_id=8 order by id")).rows};
fs.writeFileSync(dir+"/final-audit.json",JSON.stringify(result,null,2));
}finally{await c.end();}