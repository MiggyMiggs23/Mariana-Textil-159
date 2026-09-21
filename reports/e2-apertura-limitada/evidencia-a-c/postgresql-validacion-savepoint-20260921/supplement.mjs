import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export async function supplement({c,runDir,fixture,install}) {
  const results=[];
  const test=async(name,fn)=>{
    try {await fn();results.push({case:name,status:'PASS'});}
    catch(e){results.push({case:name,status:'FAIL',code:e.code,error:e.message});throw e;}
    finally {
      await c.query('ROLLBACK');
      writeFileSync(path.join(runDir,'supplement.json'),JSON.stringify(results,null,2));
    }
  };
  const rejected=async(fn,pattern)=>{
    let error;try{await fn();}catch(e){error=e;}
    assert(error,'expected rejection');assert.match(error.message,pattern);
  };
  const retained=async(key=randomUUID())=>{
    return (await c.query(`INSERT INTO cobros_credito_pendientes_e1
      (operacion_productor,operacion_clave,naturaleza,cliente_id,importe,medio,cuenta_destino,sesion_caja_id,e2_insert_xid)
      VALUES('COBRO_PENDIENTE',$1,'INGRESO_FISICO',1,100,'EFECTIVO','CAJA_FISICA',1,'1'::xid8)
      RETURNING operacion_clave,e2_insert_xid::text AS stamp,pg_current_xact_id()::text AS current`,[key])).rows[0];
  };
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await c.query(fixture);
  const historicalKey=randomUUID();
  await c.query(`INSERT INTO cobros_credito_pendientes_e1 VALUES
    ('COBRO_PENDIENTE',$1,'INGRESO_FISICO',1,100,'EFECTIVO','CAJA_FISICA',1)`,[historicalKey]);
  await c.query(install);
  await test('historical NULL cannot be forged by UPDATE or attested',async()=>{
    await c.query('BEGIN');
    const r=(await c.query(`UPDATE cobros_credito_pendientes_e1 SET e2_insert_xid=pg_current_xact_id()
      WHERE operacion_clave=$1 RETURNING e2_insert_xid`,[historicalKey])).rows[0];
    assert.equal(r.e2_insert_xid,null);
    await rejected(()=>c.query('SELECT e2_attest_new_retained($1)',[historicalKey]),/new physical receipt in this transaction/);
  });
  let committed;
  await test('supplied INSERT stamp overwritten with full top xid',async()=>{
    await c.query('BEGIN');committed=await retained();
    assert.equal(committed.stamp,committed.current);assert.notEqual(committed.stamp,'1');
    await c.query('COMMIT');
  });
  await test('committed source UPDATE preserves OLD stamp and cannot be attested',async()=>{
    await c.query('BEGIN');
    const r=(await c.query(`UPDATE cobros_credito_pendientes_e1 SET e2_insert_xid=pg_current_xact_id(),importe=101
      WHERE operacion_clave=$1 RETURNING e2_insert_xid::text AS stamp,pg_current_xact_id()::text AS current`,
    [committed.operacion_clave])).rows[0];
    assert.equal(r.stamp,committed.stamp);assert.notEqual(r.stamp,r.current);
    await rejected(()=>c.query('SELECT e2_attest_new_retained($1)',[committed.operacion_clave]),/new physical receipt in this transaction/);
  });
  await test('SAVEPOINT rollback removes source stamp; reinsert same key succeeds',async()=>{
    await c.query('BEGIN; SAVEPOINT child');const key=randomUUID();
    const first=await retained(key);
    await c.query('ROLLBACK TO child');
    assert.equal((await c.query('SELECT count(*)::int AS n FROM cobros_credito_pendientes_e1 WHERE operacion_clave=$1',[key])).rows[0].n,0);
    const second=await retained(key);assert.equal(second.stamp,first.stamp);
    await c.query('RELEASE child');
    await c.query('SELECT e2_attest_new_retained($1)',[key]);
  });
  await test('late application after released SAVEPOINT and IMMEDIATE rejected',async()=>{
    await c.query('BEGIN; SAVEPOINT child');
    const id=(await c.query(`INSERT INTO movimientos_credito
      (cliente_id,tipo,importe,naturaleza,forma_pago,cuenta_destino,sitio_origen_id,sesion_caja_id,operacion_productor,operacion_clave,e2_insert_xid)
      VALUES(1,'ABONO',-100,'INGRESO_FISICO','EFECTIVO','CAJA_FISICA',1,1,'ABONO_ORDINARIO',$1,'1'::xid8)
      RETURNING id,e2_insert_xid::text AS stamp,pg_current_xact_id()::text AS current`,[randomUUID()])).rows[0];
    assert.equal(id.stamp,id.current);
    await c.query('RELEASE child');
    const update=(await c.query(`UPDATE movimientos_credito SET e2_insert_xid='1'::xid8
      WHERE id=$1 RETURNING e2_insert_xid::text AS stamp`,[id.id])).rows[0];
    assert.equal(update.stamp,id.stamp);
    await c.query(`SELECT e2_finalize_new_abono($1,'ABONO_ORDINARIO','UNUSED',0,$2::jsonb,'e2-abono-evidence-v1')`,
      [id.id,JSON.stringify({contractRevision:'e2-abono-evidence-v1',projector:'projectCreditLedger',receiptCents:10000,appliedCents:0,allocations:[]})]);
    await c.query('SET CONSTRAINTS ALL IMMEDIATE');
    await rejected(()=>c.query('INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe) VALUES($1,1,1)',[id.id]),/must precede finalization/);
  });
}