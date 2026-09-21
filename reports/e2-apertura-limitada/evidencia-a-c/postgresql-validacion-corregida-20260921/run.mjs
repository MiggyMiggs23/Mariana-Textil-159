// Explicit isolated validation only. No inherited database configuration.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const revision = 'd3b3154753563adc1a64ee1427518a6e6a0a22d6';
const previousRevision = 'f8818255bcb11784c422cc559c3273e1f2e25aa9';
const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../../../..');
const pgBin = '/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin';
const sqlBase = 'reports/e2-apertura-limitada/evidencia-a-c/';
const guardBase = 'reports/e1-guardas-temporales-2026-09-18/sql/';
const harnessBase = sqlBase + 'postgresql-validacion/';
const candidate = p => path.join(here, 'candidate', p);
const bytes = p => readFileSync(candidate(p));
const hash = b => createHash('sha256').update(b).digest('hex');
const auth = readFileSync(path.join(here, '../autorizacion-propietario-correccion-sql-y-registro-arranques.txt'));
const previousAuth = readFileSync(path.join(here, '../autorizacion-propietario-validacion-postgresql.txt'));
assert(auth.toString().includes('Autorizo repetir la validación PostgreSQL'));
assert(previousAuth.toString().includes('f8818255'));
const clean = { PATH: `${pgBin}:/usr/bin:/bin`, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
const artifacts = [];
function walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir,d.name);
    if(d.isDirectory()) walk(p); else artifacts.push(path.relative(path.join(here,'candidate'),p));
  }
}
walk(path.join(here,'candidate'));
function gitBytes(rev,p) {
  const r = spawnSync('git',['show',`${rev}:${p}`],{cwd:workspace,env:clean,maxBuffer:16*1024*1024});
  assert.equal(r.status,0,`git export verification: ${p}`);
  return r.stdout;
}
for(const p of artifacts) assert(bytes(p).equals(gitBytes(revision,p)),`candidate byte mismatch: ${p}`);
const previousInstall = gitBytes(previousRevision,sqlBase+'01-install-evidence-prepared.sql');
if(process.argv[2] !== '--reviewed-isolation-run') {
  console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',revision,files:artifacts.map(p=>({path:p,sha256:hash(bytes(p))}))},null,2));
  process.exit(0);
}
const runDir=path.join(here,`run-${Date.now()}`); mkdirSync(runDir,{mode:0o700});
const root=mkdtempSync('/tmp/e2-ac-corrected-pg16-');
const socket=path.join(root,'socket'); mkdirSync(socket,{mode:0o700});
const data=path.join(root,'data'), db='e2_ac_synthetic', port=56439;
const env={...clean,HOME:root,TMPDIR:root,PGHOST:socket,PGPORT:String(port),
  PGUSER:'e2_owner',PGDATABASE:db,PGCONNECT_TIMEOUT:'5',PGAPPNAME:'e2-isolated-corrected-harness',
  PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=8000'};
let started=false,backendPid=null,failed=false;
const results=[];
const log=x=>appendFileSync(path.join(runDir,'commands.log'),`${x}\n`);
function command(name,args,allowFailure=false) {
  log(JSON.stringify({name,args}));
  const r=spawnSync(path.join(pgBin,name),args,{env,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
  log(JSON.stringify({status:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr,error:r.error?.message}));
  if(!allowFailure) assert.equal(r.status,0,`${name}: ${r.stderr}`);
  return r;
}
const psql=(database,args,allow=false)=>command('psql',['-X','-v','ON_ERROR_STOP=1',
  '-h',socket,'-p',String(port),'-U','e2_owner','-d',database,...args],allow);
const clients=new Set();
try {
  writeFileSync(path.join(runDir,'manifest.json'),JSON.stringify({revision,previousRevision,
    authorizationSha256:hash(auth),previousAuthorizationSha256:hash(previousAuth),
    previousInstallSha256:hash(previousInstall),runnerSha256:hash(readFileSync(fileURLToPath(import.meta.url))),
    root,socket,port,db,files:artifacts.map(p=>({path:p,sha256:hash(bytes(p))}))},null,2));
  command('initdb',['-D',data,'-U','e2_owner','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  command('pg_ctl',['-D',data,'-l',path.join(runDir,'postgres.log'),'-o',
    `-k ${socket} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700 -c max_connections=10`,'-w','-t','15','start']);
  started=true; backendPid=Number(readFileSync(path.join(data,'postmaster.pid'),'utf8').split('\n')[0]);
  psql('postgres',['-c',`CREATE DATABASE ${db} TEMPLATE template0`]);
  for(const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env,env);
  const {default:pg}=await import(path.join(workspace,'node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js'));
  const connect=async()=>{
    const c=new pg.Client({host:socket,port,user:'e2_owner',database:db,password:'',ssl:false,
      connectionTimeoutMillis:5000,query_timeout:12000,statement_timeout:10000,
      application_name:'e2-isolated-corrected-harness'});
    clients.add(c);await c.connect();return c;
  };
  const c=await connect();
  const identity=async label=>{
    const row=(await c.query(`SELECT current_database() AS db,current_user AS role,
      current_setting('data_directory') AS data,current_setting('port') AS port,
      current_setting('unix_socket_directories') AS socket,
      current_setting('listen_addresses') AS listen,inet_server_addr() AS address`)).rows[0];
    log(JSON.stringify({identity:label,...row}));
    assert.deepEqual(row,{db,role:'e2_owner',data,port:String(port),socket,listen:'',address:null});
  };
  await identity('before-first-fixture-DDL');
  psql(db,['-f',candidate(harnessBase+'fixture.sql')]);
  psql(db,['-f',candidate(guardBase+'01-install-cash.sql')]);
  psql(db,['-f',candidate(guardBase+'02-install-pending.sql')]);
  // Negative control is the untouched previous SQL, in this private cluster only.
  const negative=psql(db,['-c',previousInstall.toString()],true);
  assert.notEqual(negative.status,0);
  assert.match(negative.stderr,/syntax error at end of input/);
  const residual=(await c.query(`SELECT
    (SELECT count(*)::int FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2')) AS tables,
    (SELECT count(*)::int FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname LIKE 'e2_%') AS functions,
    (SELECT count(*)::int FROM pg_trigger WHERE tgname LIKE 'e2_%') AS triggers`)).rows[0];
  assert.deepEqual(residual,{tables:0,functions:0,triggers:0});
  results.push({case:'previous exact syntax rejects and installation rolls back without A+C objects',status:'PASS',residual});
  psql(db,['-f',candidate(sqlBase+'01-install-evidence-prepared.sql')]);
  psql(db,['-f',candidate(sqlBase+'02-revert-before-capture-only.sql')]);
  psql(db,['-f',candidate(sqlBase+'01-install-evidence-prepared.sql')]);
  results.push({case:'CLOSED fixture exact install/empty revert/reinstall',status:'PASS'});
  await identity('immediately-before-whole-synthetic-schema-reset');
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const {runCases}=await import(candidate(harnessBase+'cases.mjs'));
  await runCases({c,connect,results,runDir,sql:p=>bytes(sqlBase+p).toString(),
    guard:p=>bytes(guardBase+p).toString(),fixture:bytes(harnessBase+'fixture.sql').toString(),
    preflight:()=>psql(db,['-a','-f',candidate(sqlBase+'03-preflight-schema-prepared.sql')],true)});
} catch(e) {
  failed=true;log(e.stack);results.push({case:'harness',status:'FAIL',error:e.message});
} finally {
  for(const c of clients) await c.end().catch(e=>log(`client end: ${e.message}`));
  let cleanupError=null,dropStatus=null,stopStatus=null,clusterStatus=null,pidAbsent=null,socketAbsent=null;
  try {
    if(existsSync(path.join(data,'postmaster.pid'))) {
      backendPid=Number(readFileSync(path.join(data,'postmaster.pid'),'utf8').split('\n')[0]);
      dropStatus=psql('postgres',['-c',`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`],true).status;
      stopStatus=command('pg_ctl',['-D',data,'-m','immediate','-w','-t','15','stop']).status;
    }
    clusterStatus=command('pg_ctl',['-D',data,'status'],true).status;
    assert.notEqual(clusterStatus,0,'cluster still running');
    if(backendPid) {
      pidAbsent=false;
      try {process.kill(backendPid,0);} catch(e) {if(e.code==='ESRCH') pidAbsent=true;else throw e;}
      assert.equal(pidAbsent,true,'postmaster still exists');
    }
    socketAbsent=!existsSync(path.join(socket,`.s.PGSQL.${port}`));
    assert.equal(socketAbsent,true,'socket still exists');
    rmSync(root,{recursive:true,force:true});assert.equal(existsSync(root),false);
    if(started) assert.equal(dropStatus,0,'explicit database drop failed');
  } catch(e) {failed=true;cleanupError=e.message;log(`CLEANUP FAILURE: ${e.stack}`);}
  writeFileSync(path.join(runDir,'terminal.json'),JSON.stringify({revision,status:failed?'FAIL':'PASS',
    exitCode:failed?1:0,started,backendPid,cleanupError,dropStatus,stopStatus,clusterStatus,pidAbsent,
    socketAbsent,rootRemoved:!existsSync(root),results},null,2));
}
console.log(JSON.stringify({runDir,status:failed?'FAIL':'PASS'}));
process.exitCode=failed?1:0;