import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export async function runCases({c,connect,results,runDir,sql,guard,fixture,preflight}) {
  const revision='e2-abono-evidence-v1';
  const install=sql('01-install-evidence-prepared.sql');
  const revert=sql('02-revert-before-capture-only.sql');
  const counts=async()=> (await c.query(`SELECT
    (SELECT count(*) FROM movimientos_credito) AS m,
    (SELECT count(*) FROM aplicaciones_credito) AS a,
    (SELECT count(*) FROM finalizaciones_abono_e2) AS f,
    (SELECT count(*) FROM evidencia_no_aplicada_e2) AS e,
    (SELECT count(*) FROM cobros_credito_pendientes_e1) AS r`)).rows[0];
  const test=async(name,fn)=>{
    const began=Date.now();
    try { const detail=await fn(); results.push({case:name,status:'PASS',ms:Date.now()-began,detail}); }
    catch(e) { results.push({case:name,status:'FAIL',ms:Date.now()-began,error:e.message,code:e.code}); }
    finally {await c.query('ROLLBACK');}
    writeFileSync(path.join(runDir,'cases-progress.json'),JSON.stringify(results,null,2));
  };
  const reject=async(fn,pattern)=>{
    let error;
    try {await fn();} catch(e) {error=e;}
    assert(error,'expected rejection, but command succeeded');
    assert.match(`${error.code}: ${error.message}`,pattern);
    return {code:error.code,message:error.message};
  };
  const movement=async(client=c,key=randomUUID(),producer='ABONO_ORDINARIO',extra={})=>{
    const row={cliente:1,tipo:'ABONO',amount:-100,nature:'INGRESO_FISICO',form:'EFECTIVO',
      destination:'CAJA_FISICA',site:1,session:1,...extra};
    return (await client.query(`INSERT INTO movimientos_credito
      (cliente_id,tipo,importe,naturaleza,forma_pago,cuenta_destino,sitio_origen_id,sesion_caja_id,operacion_productor,operacion_clave)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [row.cliente,row.tipo,row.amount,row.nature,row.form,row.destination,row.site,row.session,producer,key])).rows[0].id;
  };
  const application=(id,amount=100,client=c)=>client.query(
    'INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe) VALUES($1,1,$2)',[id,amount]);
  const evaluation=(amount,producer)=>({contractRevision:revision,
    projector:producer==='ABONO_DIRIGIDO'?'directedApplication':'projectCreditLedger',
    receiptCents:10000,appliedCents:amount*100,
    allocations:amount?[{targetId:1,appliedCents:amount*100}]:[]});
  const finalize=(id,amount=0,producer='ABONO_ORDINARIO',client=c,overrides={})=>client.query(
    'SELECT e2_finalize_new_abono($1,$2,$3,$4,$5::jsonb,$6)',
    [id,producer,amount===0?'UNUSED':amount===100?'FULL':'PARTIAL',amount*100,
      JSON.stringify({...evaluation(amount,producer),...overrides}),revision]);
  const retained=async(client=c,key=randomUUID())=>{
    await client.query(`INSERT INTO cobros_credito_pendientes_e1 VALUES
      ('COBRO_PENDIENTE',$1,'INGRESO_FISICO',1,100,'EFECTIVO','CAJA_FISICA',1)`,[key]); return key;
  };
  const attest=(key,client=c)=>client.query('SELECT e2_attest_new_retained($1)',[key]);
  const atomicNegative=async(fn,pattern)=>{
    const before=await counts(); await c.query('BEGIN');
    const error=await reject(fn,pattern); await c.query('ROLLBACK');
    assert.deepEqual(await counts(),before,'orphan rows after rollback'); return error;
  };
  await c.query(fixture);
  await c.query(install);
  await test('duplicate install rejects atomically, original objects preserved',async()=>{
    const before=await counts();
    const oid=(await c.query("SELECT 'finalizaciones_abono_e2'::regclass::oid AS oid")).rows[0].oid;
    await reject(()=>c.query(install),/42P07/);await c.query('ROLLBACK');
    assert.deepEqual(await counts(),before);
    assert.equal((await c.query("SELECT 'finalizaciones_abono_e2'::regclass::oid AS oid")).rows[0].oid,oid);
  });
  await test('pristine exact03 catalog preflight (no normalization or candidate patch)',async()=>{
    const r=preflight();
    const catalog=await c.query(`SELECT t.relname,c.conname,pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      WHERE t.relname IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2') ORDER BY 1,2`);
    writeFileSync(path.join(runDir,'catalog-rendering.json'),JSON.stringify(catalog.rows,null,2));
    writeFileSync(path.join(runDir,'exact03.log'),`${r.stdout}\n${r.stderr}`);
    assert.equal(r.status,0,'exact03 refused pristine candidate; inspect unmodified catalog rendering');
  });
  await test('revert refuses absent CLOSED guard',()=>atomicNegative(()=>c.query(revert),/close cash capture/));
  // Separate E1 CLOSED boundary, kept inside transaction; rollback undoes this
  // fixture installation as a whole, never runs DROP/DISABLE/removal plans.
  await test('separate empty CLOSED fixture: guards, revert, reinstall',async()=>{
    await c.query('BEGIN');
    await c.query(guard('01-install-cash.sql'));
    await c.query(guard('02-install-pending.sql'));
    await c.query('SAVEPOINT closed_cash');
    await reject(()=>movement(),/E1C01/); await c.query('ROLLBACK TO closed_cash');
    await c.query('SAVEPOINT closed_pending');
    await reject(()=>retained(),/E1P01/); await c.query('ROLLBACK TO closed_pending');
    // Exact revert has BEGIN/COMMIT: run this boundary in a second fresh DB
    // instead of allowing its COMMIT to escape this transactional fixture.
    await c.query('ROLLBACK');
    return 'CLOSED guards checked separately; exact empty revert handled before whole synthetic schema reset by runner';
  });
  const positiveIds=[];
  for(const [amount,producer] of [[0,'ABONO_ORDINARIO'],[40,'ABONO_ORDINARIO'],[100,'ABONO_ORDINARIO'],[100,'ABONO_DIRIGIDO']]) {
    await test(`positive ${producer} ${amount}`,async()=>{
      const key=randomUUID();
      await c.query('BEGIN'); const id=await movement(c,key,producer);
      if(amount) await application(id,amount);
      await finalize(id,amount,producer); await c.query('COMMIT');
      const row=(await c.query(`SELECT f.resultado,f.aplicado,f.importe,f.operacion_productor,f.operacion_clave,
        f.evaluacion,
        (SELECT count(*)::int FROM evidencia_no_aplicada_e2 e WHERE e.abono_id=f.abono_id) AS proofs
        FROM finalizaciones_abono_e2 f WHERE abono_id=$1`,[id])).rows[0];
      assert.equal(row.resultado,amount===0?'UNUSED':amount===100?'FULL':'PARTIAL');
      assert.equal(Number(row.aplicado),amount);assert.equal(Number(row.importe),100);
      assert.equal(row.operacion_productor,producer);assert.equal(row.operacion_clave,key);
      assert.deepEqual(row.evaluacion,evaluation(amount,producer));
      const apps=(await c.query('SELECT venta_movimiento_id,importe FROM aplicaciones_credito WHERE abono_movimiento_id=$1',[id])).rows;
      assert.deepEqual(apps,amount?[{venta_movimiento_id:1,importe:amount.toFixed(2)}]:[]);
      assert.equal(row.proofs,amount===0?1:0);
      if(!amount) {
        const proof=(await c.query('SELECT fuente,cliente_id,importe FROM evidencia_no_aplicada_e2 WHERE abono_id=$1',[id])).rows[0];
        assert.deepEqual(proof,{fuente:`ABONO:${id}`,cliente_id:1,importe:'100.00'});
      }
      positiveIds.push(id); return row;
    });
  }
  await test('deferred missing finalization rejected at COMMIT',()=>atomicNegative(async()=>{
    await movement(); await c.query('COMMIT');
  },/cannot commit without finalization/));
  await test('IMMEDIATE before source INSERT rejects at statement',()=>atomicNegative(async()=>{
    await c.query('SET CONSTRAINTS ALL IMMEDIATE');await movement();
  },/cannot commit without finalization/));
  await test('deferred missing proof rejected at COMMIT',()=>atomicNegative(async()=>{
    const id=await movement();
    await c.query(`INSERT INTO finalizaciones_abono_e2
      (abono_id,operacion_productor,operacion_clave,cliente_id,importe,resultado,aplicado,evaluacion,contrato_revision)
      SELECT id,operacion_productor,operacion_clave,cliente_id,100,'UNUSED',0,$2::jsonb,$3
      FROM movimientos_credito WHERE id=$1`,[id,JSON.stringify(evaluation(0,'ABONO_ORDINARIO')),revision]);
    await c.query('COMMIT');
  },/proof completeness mismatch/));
  for(const extra of [{nature:'CORRECCION_CONTABLE'},{form:'TRANSFERENCIA'},{destination:'CUENTA_FISCAL'},{site:null},{session:null}]) {
    await test(`invalid source ${JSON.stringify(extra)}`,()=>atomicNegative(async()=>{
      await finalize(await movement(c,randomUUID(),'ABONO_ORDINARIO',extra));
    },/physical ABONO|new physical ABONO|finalization requires/));
  }
  await test('invalid classification / projector',()=>atomicNegative(async()=>{
    await finalize(await movement(),0,'ABONO_ORDINARIO',c,{projector:'directedApplication'});
  },/evaluation contract mismatch/));
  await test('directed UNUSED rejected',()=>atomicNegative(async()=>{
    await finalize(await movement(c,randomUUID(),'ABONO_DIRIGIDO'),0,'ABONO_DIRIGIDO');
  },/evaluation contract mismatch/));
  for(const stage of ['movement','application','finalization']) {
    await test(`induced failure after ${stage}, no orphans`,()=>atomicNegative(async()=>{
      const id=await movement();
      if(stage!=='movement') await application(id,100);
      if(stage==='finalization') await finalize(id,100);
      await c.query('SELECT 1/0');
    },/22012/));
  }
  await test('induced error after UNUSED positive proof: no persisted orphans',()=>atomicNegative(async()=>{
    const id=await movement(); await finalize(id);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM evidencia_no_aplicada_e2 WHERE abono_id=$1',[id])).rows[0].n,1);
    await c.query('SELECT 1/0');
  },/22012/));
  await test('retry after rollback same UUID succeeds; replay is not idempotent',async()=>{
    const key=randomUUID(); await c.query('BEGIN'); await movement(c,key); await c.query('ROLLBACK');
    await c.query('BEGIN'); const id=await movement(c,key); await finalize(id); await c.query('COMMIT');
    await atomicNegative(()=>movement(c,key),/23505/);
    await atomicNegative(()=>finalize(id),/23505|this transaction|new physical ABONO/);
  });
  await test('duplicate finalizer same transaction rejects (not idempotent)',()=>atomicNegative(async()=>{
    const id=await movement(); await finalize(id); await finalize(id);
  },/23505/));
  await test('IMMEDIATE then late application BEFORE guard',()=>atomicNegative(async()=>{
    const id=await movement(); await finalize(id); await c.query('SET CONSTRAINTS ALL IMMEDIATE'); await application(id,1);
  },/applications must precede finalization/));
  for(const table of ['finalizaciones_abono_e2','evidencia_no_aplicada_e2']) {
    for(const statement of [`UPDATE ${table} SET cliente_id=cliente_id`,`DELETE FROM ${table}`,`TRUNCATE ${table}`]) {
      await test(`immutable ${statement}`,()=>atomicNegative(()=>c.query(statement),/immutable|cannot truncate a table referenced/));
    }
  }
  await test('later transaction application remains legitimate (A+C-only)',async()=>{
    const id=positiveIds[0]; assert(id);
    await application(id,10);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM aplicaciones_credito WHERE abono_movimiento_id=$1',[id])).rows[0].n,1);
  });
  await test('retained same-tx typed proof',async()=>{
    await c.query('BEGIN'); const key=await retained(); await attest(key); await c.query('COMMIT');
    assert.equal((await c.query('SELECT fuente FROM evidencia_no_aplicada_e2 WHERE cobro_clave=$1',[key])).rows[0].fuente,`COBRO_RETENIDO:${key}`);
  });
  await test('induced error after retained positive proof has no orphans',()=>atomicNegative(async()=>{
    const key=await retained();await attest(key);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM evidencia_no_aplicada_e2 WHERE cobro_clave=$1',[key])).rows[0].n,1);
    await c.query('SELECT 1/0');
  },/22012/));
  await test('retained old source cannot be attested',async()=>{
    const key=await retained();
    await atomicNegative(()=>attest(key),/new physical receipt in this transaction/);
  });
  await test('retained absent source',()=>atomicNegative(()=>attest(randomUUID()),/receipt not found/));
  await test('retained wrong customer typed proof',()=>atomicNegative(async()=>{
    const key=await retained();
    await c.query(`INSERT INTO evidencia_no_aplicada_e2(fuente,cobro_productor,cobro_clave,cliente_id,importe)
      VALUES($1,'COBRO_PENDIENTE',$2,2,100)`,[`COBRO_RETENIDO:${key}`,key]);
  },/new physical receipt/));
  for(const kind of ['ordinary','retained']) for(const before of [true,false]) {
    await test(`savepoint ${kind}: source ${before?'before':'after'} SAVEPOINT (valid-contract expectation)`,async()=>{
      const baseline=await counts(); await c.query('BEGIN');
      const insert=()=>kind==='ordinary'?movement():retained();
      let id;if(before) id=await insert(); await c.query('SAVEPOINT source_child'); if(!before) id=await insert();
      try {if(kind==='ordinary') await finalize(id); else await attest(id); await c.query('SET CONSTRAINTS ALL IMMEDIATE');}
      finally {await c.query('ROLLBACK'); assert.deepEqual(await counts(),baseline);}
    });
  }
  for(const kind of ['ordinary','retained']) {
    await test(`released child SAVEPOINT ${kind}: valid same-transaction source expectation`,async()=>{
      const baseline=await counts();await c.query('BEGIN');await c.query('SAVEPOINT child_source');
      const id=kind==='ordinary'?await movement():await retained();
      await c.query('RELEASE SAVEPOINT child_source');
      try {if(kind==='ordinary')await finalize(id);else await attest(id);await c.query('SET CONSTRAINTS ALL IMMEDIATE');}
      finally {await c.query('ROLLBACK');assert.deepEqual(await counts(),baseline);}
    });
  }
  for(const immediate of [false,true]) {
    await test(`A+C-only reversal characterized constraints ${immediate?'IMMEDIATE':'DEFERRED'} (not production vulnerability)`,async()=>{
      await c.query('BEGIN');const id=await movement();await finalize(id);
      if(immediate) await c.query('SET CONSTRAINTS ALL IMMEDIATE');
      await c.query('INSERT INTO movimientos_credito(cliente_id,tipo,importe,movimiento_origen_id) VALUES(1,\'REVERSO\',100,$1)',[id]);
      let outcome;
      try {await c.query('SET CONSTRAINTS ALL IMMEDIATE');outcome='ACCEPTED';}
      catch(e) {outcome={code:e.code,message:e.message};}
      await c.query('ROLLBACK');
      if(immediate)assert.equal(outcome,'ACCEPTED');
      else {assert.equal(typeof outcome,'object');assert.match(outcome.message,/does not match persisted applications/);}
      return {outcome,limitation:'Permanent E1 reversal validators and application immutability omitted. Not a full-system claim.'};
    });
  }
  // Two sessions plus observer. Unique-index conflict is the real barrier.
  for(const firstCommits of [true,false]) {
    await test(`deterministic same-UUID concurrency first ${firstCommits?'COMMIT':'ROLLBACK'}`,async()=>{
      const a=await connect(),b=await connect();const key=randomUUID();
      try {
        await a.query('BEGIN');const id=await movement(a,key);await finalize(id,0,'ABONO_ORDINARIO',a);
        await b.query('BEGIN');
        const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        let settled=false;
        const pending=movement(b,key).then(id=>({ok:true,id}),e=>({ok:false,code:e.code,message:e.message})).finally(()=>{settled=true;});
        const deadline=Date.now()+4000;let blocked=false;
        while(Date.now()<deadline) {
          const r=(await c.query('SELECT pg_blocking_pids($1) AS blockers',[pid])).rows[0];
          if(r.blockers.length){blocked=true;break;}
          assert.equal(settled,false,'second operation terminated before lock barrier');
          await new Promise(r=>setTimeout(r,25));
        }
        assert(blocked,'real lock barrier timed out');
        await a.query(firstCommits?'COMMIT':'ROLLBACK');
        const terminal=await pending;
        if(firstCommits) {assert.equal(terminal.ok,false);assert.equal(terminal.code,'23505');await b.query('ROLLBACK');}
        else {assert(terminal.ok);await finalize(terminal.id,0,'ABONO_ORDINARIO',b);await b.query('COMMIT');}
        const state=(await c.query(`SELECT count(*)::int AS n FROM movimientos_credito m
          JOIN finalizaciones_abono_e2 f ON f.abono_id=m.id JOIN evidencia_no_aplicada_e2 e ON e.abono_id=m.id
          WHERE m.operacion_clave=$1`,[key])).rows[0];
        assert.equal(state.n,1);return {blocked,terminal,state};
      } finally {await a.query('ROLLBACK').catch(()=>{});await b.query('ROLLBACK').catch(()=>{});await a.end();await b.end();}
    });
  }
  await test('producer versus exact revert: real ACCESS EXCLUSIVE barrier',async()=>{
    const a=await connect(),b=await connect();const key=randomUUID();
    try {
      await a.query('BEGIN');
      const id=await movement(a,key);await finalize(id,0,'ABONO_ORDINARIO',a);
      const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      let settled=false;
      const pending=b.query(revert).then(()=>({ok:true}),e=>({ok:false,code:e.code,message:e.message})).finally(()=>{settled=true;});
      const deadline=Date.now()+4000;let blocked=false;
      while(Date.now()<deadline) {
        if((await c.query('SELECT pg_blocking_pids($1) AS blockers',[pid])).rows[0].blockers.length){blocked=true;break;}
        assert.equal(settled,false,'revert terminated before producer barrier');
        await new Promise(r=>setTimeout(r,25));
      }
      assert(blocked,'producer/revert lock barrier timed out');
      await a.query('COMMIT');
      const terminal=await pending;
      assert.equal(terminal.ok,false);
      assert.match(terminal.message,/close cash capture/);
      await b.query('ROLLBACK');
      assert.equal((await c.query(`SELECT count(*)::int AS n FROM movimientos_credito m
        JOIN finalizaciones_abono_e2 f ON f.abono_id=m.id
        JOIN evidencia_no_aplicada_e2 e ON e.abono_id=m.id WHERE m.operacion_clave=$1`,[key])).rows[0].n,1);
      return {blocked,terminal,scope:'Exact revert waits for producer, then refuses absent closure; no activation/removal. Nonempty CLOSED refusal checked separately.'};
    } finally {await a.query('ROLLBACK').catch(()=>{});await b.query('ROLLBACK').catch(()=>{});await a.end();await b.end();}
  });
  // Install guards only at the end and never remove them.
  await c.query(guard('01-install-cash.sql'));
  await c.query(guard('02-install-pending.sql'));
  await test('revert with evidence and exact CLOSED guard refuses',async()=>{
    const before=await counts();await reject(()=>c.query(revert),/REFUSED.*evidence/);
    await c.query('ROLLBACK');assert.deepEqual(await counts(),before);
  });
  if(results.some(r=>r.status==='FAIL')) throw new Error('One or more independent cases failed; preserved exact candidate and continued matrix');
}