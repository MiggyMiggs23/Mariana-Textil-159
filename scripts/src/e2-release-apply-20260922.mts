// Explicit owner-authorized E2 CLOSED operator. No retries, no recovery/repair.
import fs from "node:fs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
// @ts-ignore local pg runtime
import pg from "../../lib/db/node_modules/pg/lib/index.js";
import {collectReadonlySnapshot} from "./e2-release-verification-20260922.mts";
// @ts-ignore approved JS operator
import {readCatalog,verifyCatalog,connectionEnvironment} from "../../reports/e2-paquete-liberacion-preparado-20260921/release-preflight.mjs";
const out="reports/e2-liberacion-20260922";
const pkg="reports/e2-paquete-liberacion-preparado-20260921";
const json=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p:string,v:unknown)=>fs.writeFileSync(`${out}/${p}`,JSON.stringify(v,null,2)+"\n",{mode:0o600});
const sha=(p:string)=>createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const env={...process.env,API_INSPECTION_BOOT:"1",NODE_ENV:"development"};
const quote=(s:string)=>`"${s.replaceAll('"','""')}"`;
const expected=json(`${pkg}/release-expected.json`);
const backup=json(`${out}/e2-backup-restore-20260922-metadata.json`);
const drive=json(`${out}/drive-verification.json`);
const restored=json(`${out}/drive-restoration.json`);
const source=json(`${backup.backupDirectory}/source-snapshot.json`);
async function capture(requireQuiet:boolean) {
  const c=new pg.Client({connectionString:process.env.DATABASE_URL,options:"-c default_transaction_read_only=on"});
  await c.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const others=(await c.query("select pid,backend_type,state from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and backend_type='client backend'")).rows;
    if(requireQuiet)assert.equal(others.length,0,"Other client backends; STOP");
    const snapshot=await collectReadonlySnapshot(c);
    const fullSequences=[];
    for(const s of snapshot.sequenceState) {
      const r=(await c.query(`SELECT last_value::text AS last_value,is_called FROM ${quote(String(s.schema))}.${quote(String(s.sequence_name))}`)).rows[0];
      fullSequences.push({schema:s.schema,name:s.sequence_name,...r});
    }
    const oldColumnRows=[];
    for(const t of source.source.catalogue.tableEvidence) {
      const remove=["movimientos_credito","cobros_credito_pendientes_e1"].includes(t.table)?" - 'e2_insert_xid'":"";
      const r=(await c.query(`WITH canonical_rows AS (SELECT (to_jsonb(t)${remove})::text AS canonical FROM ${quote(t.schema)}.${quote(t.table)} t)
      SELECT count(*)::text AS count,md5(COALESCE(string_agg(md5(canonical),'' ORDER BY canonical,md5(canonical)),'')) AS hash FROM canonical_rows`)).rows[0];
      oldColumnRows.push({schema:t.schema,table:t.table,relkind:t.relkind,count:r.count,orderedCanonicalRowHash:r.hash});
    }
    await c.query("ROLLBACK");
    return {snapshot,fullSequences,oldColumnRows,otherClients:others};
  } finally {await c.end();}
}
function checkHashes() {
  assert.equal(sha(`${pkg}/manifest-final.json`),"8e9ffc71872d16b0193b00d51aa1f4cd47458bef918057a0ef8529f3f34bb831");
  assert.equal(sha(`${pkg}/sql/01-install-evidence-prepared.sql`),"3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c");
  assert.equal(sha(`${pkg}/sql/03-preflight-schema-prepared.sql`),"b368c7239f83b088d1fa5c30d1c1d0dd08538842d18a694315bd88b7f1e5980c");
  for(const name of ["release-assets.sha256","package-integrity.sha256"]) {
    assert.equal(spawnSync("sha256sum",["--check","--status",`${pkg}/${name}`]).status,0);
  }
}
async function main() {
  checkHashes();
  if(process.argv[2]==="--verify-startup") {
    const before=json(`${out}/after-commit.json`);
    const after=await capture(false);
    save("after-startup.json",after);
    assert.deepEqual(after.snapshot,before.snapshot,"Startup altered catalogue or data");
    assert.deepEqual(after.fullSequences,before.fullSequences,"Startup altered sequences");
    const proof=verifyCatalog(readCatalog(env),expected,"after");
    save("startup-preservation.json",{status:"PASS",at:new Date().toISOString(),proof,
      allTablesAndRowsUnchanged:true,allSequenceValuesAndIsCalledUnchanged:true,fullSemanticCatalogueUnchanged:true});
    console.log("STARTUP_DATA_SEQUENCES_CATALOGUE=PASS");
    return;
  }
  assert.deepEqual(process.argv.slice(2),["--apply"],"Explicit --apply required");
  assert.ok(!fs.existsSync(`${out}/sql-attempt.json`),"No automatic retry");
  assert.equal(sha(`${pkg}/autorizacion-fase-b-20260922-recibida.txt`),"ea0115d5b57cc3ca5a356271e65164f00bca5acd60f58ac83a4f605f572f788b");
  for(const e of [backup,drive,restored,json(`${out}/retained-runtime.json`)])assert.equal(e.status,"PASS");
  assert.equal(drive.hashesMatch,true);assert.equal(drive.privatePermissionsVerified,true);
  assert.equal(sha(drive.downloadedPath),backup.archive.sha256);
  assert.equal(restored.downloadedDump.sha256,backup.archive.sha256);
  assert.ok(!fs.existsSync("/proc/162"),"Retained API must remain stopped");
  const b0=verifyCatalog(readCatalog(env),expected,"before");
  const before=await capture(true);
  save("before-sql.json",before);
  assert.deepEqual(before.snapshot.catalogue,source.source.catalogue,"Live catalogue/data differs from complete backup");
  assert.deepEqual(before.snapshot.sequenceState,source.source.sequenceStateAfterDump,"Sequences differ from backup");
  assert.deepEqual(before.oldColumnRows,source.source.catalogue.tableEvidence);
  save("b0-final.json",{at:new Date().toISOString(),status:"PASS",proof:b0,backupStillExact:true,otherClients:0});
  const pgEnv=connectionEnvironment(env);
  save("sql-attempt.json",{at:new Date().toISOString(),sqlSha256:sha(`${pkg}/sql/01-install-evidence-prepared.sql`),
    lockTimeout:"2s",statementTimeout:"60s",onErrorStop:true,attempt:1});
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",`${pkg}/sql/01-install-evidence-prepared.sql`],
    {env:{...pgEnv,PGOPTIONS:"-c lock_timeout=2s -c statement_timeout=60s"},encoding:"utf8",timeout:120000});
  save("sql-result.json",{at:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr});
  assert.equal(r.status,0,"SQL failed or uncertain; STOP");
  const post=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",`${pkg}/sql/03-preflight-schema-prepared.sql`],
    {env:pgEnv,encoding:"utf8",timeout:60000});
  save("postflight-sql.json",{exit:post.status,stdout:post.stdout,stderr:post.stderr});
  assert.equal(post.status,0,"Postflight failed; STOP");
  const b1=verifyCatalog(readCatalog(env),expected,"after");
  const after=await capture(true);
  save("after-commit.json",after);
  assert.deepEqual(after.oldColumnRows,before.oldColumnRows,"Pre-existing row values changed");
  assert.deepEqual(after.fullSequences,before.fullSequences,"Sequence values or is_called changed");
  const added=after.snapshot.catalogue.tableEvidence.filter(t=>!before.snapshot.catalogue.tableEvidence.some(b=>b.schema===t.schema&&b.table===t.table));
  assert.deepEqual(added.map(t=>t.table).sort(),["evidencia_no_aplicada_e2","finalizaciones_abono_e2"]);
  assert.ok(added.every(t=>t.count==="0"));
  const c=new pg.Client({connectionString:process.env.DATABASE_URL,options:"-c default_transaction_read_only=on"});
  await c.connect();
  try {
    for(const t of ["movimientos_credito","cobros_credito_pendientes_e1"]) {
      assert.equal((await c.query(`SELECT count(*)::text AS count FROM public.${quote(t)} WHERE e2_insert_xid IS NOT NULL`)).rows[0].count,"0","Historical stamp backfill forbidden");
    }
  }finally{await c.end();}
  save("sql-preservation.json",{status:"PASS",at:new Date().toISOString(),b0,b1,
    existingTables:before.oldColumnRows.length,existingRowsUnchanged:true,sequencesAndIsCalledUnchanged:true,
    onlyApprovedTwoNewTables:true,newTablesEmpty:true,noHistoricalStampBackfill:true,noApiStarted:true});
  console.log("EXACT_A_PLUS_C_B1_AND_PRESERVATION=PASS");
}
await main().catch(e=>{save("operator-stop.json",{at:new Date().toISOString(),message:String(e.message),noAutomaticRetry:true});console.error(String(e.message));process.exitCode=1;});