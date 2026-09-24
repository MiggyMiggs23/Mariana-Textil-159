import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import pg from "../../../../lib/db/node_modules/pg/lib/index.js";

// Mutating evidence runner: execute once, only against the designated isolated API.
const root = "/home/runner/workspace";
const out = root + "/reports/tanda-f/tarea-1/api-limit-followup";
const api = "http://127.0.0.1:43831/api";
const fixture = JSON.parse(fs.readFileSync(root + "/reports/tanda-f/setup/fixture-manifest-redacted.json"));
const credentials = JSON.parse(fs.readFileSync(root + "/.local/tanda-f/credentials.json"));
const save = (name, data) => fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(data, null, 2) + "\n");
const db = new pg.Client({connectionString:"postgresql://postgres@127.0.0.1:55440/tanda_f_permissions",options:"-c default_transaction_read_only=on"});
await db.connect();
const exchanges = [];
try {
  const identity = (await db.query("select current_database() db,current_setting('data_directory') dir,inet_server_port() port,current_setting('transaction_read_only') readonly")).rows[0];
  assert.equal(identity.db, "tanda_f_permissions");
  assert.equal(identity.dir, root + "/.local/tanda-f/cluster");
  assert.equal(identity.port, 55440);
  assert.equal(identity.readonly, "on");
  const pid = fs.readFileSync(root + "/.local/tanda-f/permissions-api.pid","utf8").trim();
  const env = fs.readFileSync(`/proc/${pid}/environ`,"utf8").split("\0");
  assert(env.includes("TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_permissions"));
  assert(env.includes("DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness"));
  save("identity", {...identity,apiPort:43831,apiPid:Number(pid),at:new Date().toISOString()});
  const cookies = {};
  for (const role of ["admin","caja","caja2","caja3"]) {
    const c = credentials[role];
    const response = await fetch(api + "/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({usuario:c.username,password:c.password})});
    assert.equal(response.status,200,`login ${role}`);
    cookies[role] = response.headers.get("set-cookie").split(";")[0];
  }
  async function request(role,method,path,body) {
    const response = await fetch(api+path,{method,headers:{"content-type":"application/json",cookie:cookies[role]},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const raw = await response.text();
    const data = JSON.parse(raw);
    exchanges.push({at:new Date().toISOString(),role,method,path,request:body??null,status:response.status,responseRaw:raw,response:data});
    save("http-exchanges",exchanges);
    return {status:response.status,data};
  }
  const customer = (await db.query("select id,limite_credito from clientes where id=$1",[fixture.customer.id])).rows[0];
  assert.equal(customer.limite_credito,"5000.00");
  assert.equal((await db.query("select count(*)::int n from movimientos_credito where cliente_id=$1",[customer.id])).rows[0].n,0,"requires clean synthetic customer's ledger");
  const notes=[];
  // Three authorized notes across three sites; fourth note is the rejected candidate.
  for(let i=0;i<4;i++) {
    const site = fixture.sites[i<3?i:2];
    const rolls = fixture.rolls.filter(r=>r.siteId===site.id&&r.unit==="METRO");
    const roll = rolls[i===3?1:0];
    const body={uuidCliente:crypto.randomUUID(),ubicacionId:site.id,clienteId:customer.id,documentoTipo:"NOTA",tipo:"NORMAL",facturado:false,diasPlazo:30,lineas:[{rolloId:roll.id,productoId:roll.productId,tipo:"NORMAL",cantidad:10,precioUnitario:150}]};
    const result=await request("admin","POST","/tickets",body);
    assert.equal(result.status,201,JSON.stringify(result));
    assert.equal(result.data.total,"1500.00");
    notes.push({id:result.data.id,siteId:site.id,rollId:roll.id});
  }
  save("notes",notes);
  for(let i=0;i<3;i++) {
    const note=notes[i];
    const body={sitioOrigenId:note.siteId,naturaleza:"OPERACION_CREDITO_SIN_DINERO",operacionClave:crypto.randomUUID(),notaOrigenId:note.id};
    const result=await request(i===0?"caja":"caja"+(i+1),"POST",`/tickets/${note.id}/autorizar`,body);
    assert.equal(result.status,200,JSON.stringify(result));
    assert.equal(result.data.autorizacionEstado,"AUTORIZADA");
  }
  async function snapshot() {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename).filter(t=>t!=="sesiones");
      const digests={};
      for(const table of tables) {
        const q='"'+table.replaceAll('"','""')+'"';
        digests[table]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from ${q} t) s`)).rows[0];
      }
      return {digests,notes:(await db.query("select id,ubicacion_id,total,autorizacion_estado from tickets where id=any($1::int[]) order by id",[notes.map(n=>n.id)])).rows,movements:(await db.query("select * from movimientos_credito where cliente_id=$1 order by id",[customer.id])).rows};
    } finally { await db.query("ROLLBACK"); }
  }
  const candidate=notes[3];
  const preview=await request("caja3","GET",`/tickets/${candidate.id}/autorizar`);
  assert.equal(preview.status,200);
  assert.equal(preview.data.saldoActual,"4500.00");
  assert.equal(preview.data.saldoDeudorProyectado,"6000.00");
  const before=await snapshot();save("before-denial",before);
  assert.equal(before.movements.length,3);
  assert.equal(before.movements.reduce((s,m)=>s+Number(m.importe),0),4500);
  const localDebt=before.movements.filter(m=>Number(m.sitio_origen_id)===candidate.siteId).reduce((s,m)=>s+Number(m.importe),0);
  assert.equal(localDebt,1500);
  const body={sitioOrigenId:candidate.siteId,naturaleza:"OPERACION_CREDITO_SIN_DINERO",operacionClave:crypto.randomUUID(),notaOrigenId:candidate.id};
  const rejected=await request("caja3","POST",`/tickets/${candidate.id}/autorizar`,body);
  const after=await snapshot();save("after-denial",after);
  assert.equal(rejected.status,409);
  assert.equal(rejected.data.code,"CREDIT_LIMIT_EXCEEDED");
  assert.deepEqual(after,before,"rejected authorization must roll back all business-table changes");
  assert.equal(after.notes.find(n=>n.id===candidate.id).autorizacion_estado,"PENDIENTE");
  save("result",{pass:true,customerId:customer.id,limit:5000,globalDebtBefore:4500,candidateAmount:1500,globalProjectedDebt:6000,localDebtBefore:localDebt,localProjectedDebt:localDebt+1500,denial:rejected,unchangedBusinessTables:Object.keys(before.digests),sessionTableExcluded:"sesiones (authentication session activity only)",candidate,validRequest:body,flagsOrGatesChanged:false});
  console.log("PASS: authenticated API rejects global 6000 > 5000; local projection 3000; all business table digests unchanged.");
} catch(error) {
  save("failure",{message:error.message,stack:error.stack});
  throw error;
} finally { await db.end(); }