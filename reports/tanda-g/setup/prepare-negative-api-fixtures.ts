import fs from "node:fs";
import {db,pool} from "/home/runner/workspace/.local/tanda-g/candidate-source/lib/db/src/index";
import {crearRollo} from "/home/runner/workspace/.local/tanda-g/candidate-source/artifacts/api-server/src/lib/inventario";
const identity=(await pool.query("select current_database() db,current_setting('data_directory') dir")).rows[0];
if(identity.db!=="tanda_g_browser"||identity.dir!=="/home/runner/workspace/.local/tanda-g/cluster")throw Error("Wrong copy");
const f=JSON.parse(fs.readFileSync("reports/tanda-g/setup/fixture-manifest-redacted.json","utf8"));
const result=[];
for(const unit of ["METRO","KILO"]){
 const product=f.products.find((p:any)=>p.unidad===unit);
 const created=await db.transaction(tx=>crearRollo(tx,{productoId:product.id,ubicacionId:f.sites[0].id,proveedorId:f.supplier.id,usuarioId:f.actors.admin.id,cantidadInicial:"10",costoUnitario:"100",notas:"Tanda G native PROGRAMADO fixture for authenticated negative activation probe"}));
 result.push({unit,rollId:created.rollo.id,productId:product.id,siteId:f.sites[0].id,initialState:created.rollo.estado,initialQuantity:created.rollo.cantidadActual});
}
fs.writeFileSync("reports/tanda-g/candidate/negative-api-fixtures.json",JSON.stringify(result,null,2));
await pool.end();