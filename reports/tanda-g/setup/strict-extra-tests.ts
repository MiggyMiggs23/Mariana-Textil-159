import assert from "node:assert/strict";
import fs from "node:fs";
import {db,pool} from "/home/runner/workspace/.local/tanda-g/candidate-source/lib/db/src/index";
import {crearRollo,activarRollo,ajustarRollo,venderRollo,revertirMovimiento} from "/home/runner/workspace/.local/tanda-g/candidate-source/artifacts/api-server/src/lib/inventario";
const f=JSON.parse(fs.readFileSync("reports/tanda-g/setup/fixture-manifest-redacted.json","utf8"));
const usuarioId=f.actors.admin.id,ubicacionId=f.sites[0].id,productoId=f.products.find((p:any)=>p.unidad==="METRO").id;
const output:any={at:new Date().toISOString(),checks:[]};
const expected=process.env.STRICT_REVERSAL_DATABASE;
const identity=(await pool.query("select current_database() db,current_setting('data_directory') dir")).rows[0];
assert.equal(identity.db,expected);assert.equal(identity.dir,"/home/runner/workspace/.local/tanda-g/cluster");
const physical=(r:any)=>({id:r.id,ubicacionId:r.ubicacionId,cantidadActual:Number(r.cantidadActual),estado:r.estado});
const reverse=(tx:any,id:number)=>revertirMovimiento(tx,{movimientoOrigenId:id,usuarioId,justificacion:"Tanda G additional strict acceptance"});
const rollback=new Error("controlled rollback");
try{
 await db.transaction(async tx=>{
  const created=await crearRollo(tx,{productoId,ubicacionId,usuarioId,cantidadInicial:"10",costoUnitario:"100"});
  const activation=await activarRollo(tx,{rolloId:created.rollo.id,cantidadReal:"10",usuarioId});
  const adjusted=await ajustarRollo(tx,{rolloId:created.rollo.id,cantidadNueva:"12",usuarioId,justificacion:"Tanda G adjustment"});
  const sale=await venderRollo(tx,{rolloId:created.rollo.id,usuarioId});
  const undoSale=await reverse(tx,sale.movimiento.id);
  assert.deepEqual(physical(undoSale.rollo),physical(adjusted.rollo));
  const undoAdjustment=await reverse(tx,adjusted.movimiento.id);
  assert.deepEqual(physical(undoAdjustment.rollo),physical(activation.rollo));
  const undoActivation=await reverse(tx,activation.movimiento.id);
  assert.deepEqual(physical(undoActivation.rollo),physical(created.rollo));
  output.checks.push({name:"reverse chronological chain restores exact site quantity state",pass:true,created:physical(created.rollo),activated:physical(activation.rollo),adjusted:physical(adjusted.rollo),sold:physical(sale.rollo),undoSale:physical(undoSale.rollo),undoAdjustment:physical(undoAdjustment.rollo),undoActivation:physical(undoActivation.rollo)});
  throw rollback;
 });
}catch(e){if(e!==rollback)throw e;}
try{
 await db.transaction(async tx=>{
  const created=await crearRollo(tx,{productoId,ubicacionId,usuarioId,cantidadInicial:"10",costoUnitario:"100"});
  const activation=await activarRollo(tx,{rolloId:created.rollo.id,cantidadReal:"10",usuarioId});
  const undone=await reverse(tx,activation.movimiento.id);
  assert.deepEqual(physical(undone.rollo),physical(created.rollo));
  output.checks.push({name:"fresh unchanged activation rollback succeeds",pass:true,before:physical(created.rollo),after:physical(undone.rollo)});
  throw rollback;
 });
}catch(e){if(e!==rollback)throw e;}
await pool.end();
fs.writeFileSync("reports/tanda-g/candidate/extra-acceptance.json",JSON.stringify(output,null,2));