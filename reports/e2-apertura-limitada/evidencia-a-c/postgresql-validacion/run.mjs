// PREPARED ONLY. Requires explicit post-review argument. No environment reads.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync, mkdirSync, chmodSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const revision = 'f8818255bcb11784c422cc559c3273e1f2e25aa9';
const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../../../..');
const pgBin = '/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin';
const sqlBase = 'reports/e2-apertura-limitada/evidencia-a-c/';
const guardBase = 'reports/e1-guardas-temporales-2026-09-18/sql/';
const candidate = p => path.join(here, 'candidate', p);
const bytes = p => readFileSync(candidate(p));
const hash = b => createHash('sha256').update(b).digest('hex');
const auth = readFileSync(path.join(here, '../autorizacion-propietario-validacion-postgresql.txt'));
assert(auth.toString().includes('f8818255'));
const clean = { PATH: `${pgBin}:/usr/bin:/bin`, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
const artifacts = [];
function walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir,d.name);
    if(d.isDirectory()) walk(p); else artifacts.push(path.relative(path.join(here,'candidate'),p));
  }
}
walk(path.join(here,'candidate'));
for(const p of artifacts) {
  const r = spawnSync('git',['show',`${revision}:${p}`],{ cwd:workspace,env:clean,maxBuffer:16*1024*1024 });
  assert.equal(r.status,0,`git export verification: ${p}`);
  assert(bytes(p).equals(r.stdout),`candidate byte mismatch: ${p}`);
}
if (process.argv[2] !== '--reviewed-isolation-run') {
  console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',revision,authorizationSha256:hash(auth),
    files:artifacts.map(p=>({path:p,sha256:hash(bytes(p))})),
    next:'Owner/main review required before --reviewed-isolation-run'},null,2));
  process.exit(0);
}
// A single bounded process owns creation, execution, and teardown.
const runDir = path.join(here, `run-${Date.now()}`);
mkdirSync(runDir,{mode:0o700});
const root = mkdtempSync('/tmp/e2-ac-pg16-');
chmodSync(root,0o700);
const socket = path.join(root,'socket'); mkdirSync(socket,{mode:0o700});
const data = path.join(root,'data');
const db = 'e2_ac_synthetic';
const port = 56439; // private unique socket directory prevents collisions.
const env = {...clean,HOME:root,TMPDIR:root,PGHOST:socket,PGPORT:String(port),
 PGUSER:'e2_owner',PGDATABASE:db,PGCONNECT_TIMEOUT:'5',PGAPPNAME:'e2-isolated-harness',
 PGOPTIONS:'-c statement_timeout=10000 -c lock_timeout=8000'};
let started=false, backendPid=null, primary=null;
const results=[];
const log = x => appendFileSync(path.join(runDir,'commands.log'),`${x}\n`);
function command(name,args,allowFailure=false) {
  log(JSON.stringify({name,args}));
  const r=spawnSync(path.join(pgBin,name),args,{env,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
  log(JSON.stringify({status:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr,error:r.error?.message}));
  if(!allowFailure) assert.equal(r.status,0,`${name}: ${r.stderr}`);
  return r;
}
const connectionArgs = database => ['-h',socket,'-p',String(port),'-U','e2_owner','-d',database];
const psql = (database,args,allow=false) => command('psql',['-X','-v','ON_ERROR_STOP=1',...connectionArgs(database),...args],allow);
let failed=false;
try {
  writeFileSync(path.join(runDir,'manifest.json'),JSON.stringify({revision,authorizationSha256:hash(auth),
    root,socket,port,db,harness:['run.mjs','cases.mjs','fixture.sql'].map(p=>({path:p,sha256:hash(readFileSync(path.join(here,p)))})),
    files:artifacts.map(p=>({path:p,sha256:hash(bytes(p))}))},null,2));
  command('initdb',['-D',data,'-U','e2_owner','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  command('pg_ctl',['-D',data,'-l',path.join(runDir,'postgres.log'),'-o',
    `-k ${socket} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700 -c max_connections=10`,'-w','-t','15','start']);
  started=true;
  backendPid=Number(readFileSync(path.join(data,'postmaster.pid'),'utf8').split('\n')[0]);
  psql('postgres',['-c',`CREATE DATABASE ${db} TEMPLATE template0`]);
  // Scrub inherited process environment before importing even the explicit pg file.
  for(const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env,env);
  const {default:pg}=await import(path.join(workspace,'node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js'));
  const clients=new Set();
  const connect=async()=>{
    const c=new pg.Client({host:socket,port,user:'e2_owner',database:db,password:'',
      ssl:false,connectionTimeoutMillis:5000,query_timeout:12000,statement_timeout:10000,
      application_name:'e2-isolated-harness'});
    clients.add(c); await c.connect(); return c;
  };
  primary=await connect();
  try {
    const identity=async(label)=>{
      const row=(await primary.query(`SELECT current_database() AS db,current_user AS role,
        current_setting('data_directory') AS data,current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket,
        current_setting('listen_addresses') AS listen,inet_server_addr() AS address`)).rows[0];
      log(JSON.stringify({identity:label,...row}));
      assert.deepEqual(row,{db,role:'e2_owner',data,port:String(port),socket,listen:'',address:null});
    };
    await identity('before-first-fixture-DDL');
    psql(db,['-f',path.join(here,'fixture.sql')]);
    psql(db,['-f',candidate(guardBase+'01-install-cash.sql')]);
    psql(db,['-f',candidate(guardBase+'02-install-pending.sql')]);
    psql(db,['-f',candidate(sqlBase+'01-install-evidence-prepared.sql')]);
    psql(db,['-f',candidate(sqlBase+'02-revert-before-capture-only.sql')]);
    psql(db,['-f',candidate(sqlBase+'01-install-evidence-prepared.sql')]);
    results.push({case:'CLOSED fixture exact install/empty revert/reinstall',status:'PASS'});
    // Reset the entire synthetic fixture, never individual closure triggers.
    // This database exists only in this invocation's newly initialized cluster.
    await identity('immediately-before-whole-synthetic-schema-reset');
    await primary.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    const {runCases}=await import('./cases.mjs');
    await runCases({c:primary,connect,results,runDir,sql:p=>bytes(sqlBase+p).toString(),
      guard:p=>bytes(guardBase+p).toString(),fixture:readFileSync(path.join(here,'fixture.sql'),'utf8'),
      preflight:()=>psql(db,['-a','-f',candidate(sqlBase+'03-preflight-schema-prepared.sql')],true)});
  } finally { for(const c of clients) await c.end().catch(e=>log(`client end: ${e.message}`)); }
} catch(e) { failed=true; log(e.stack); results.push({case:'harness',status:'FAIL',error:e.message}); }
finally {
  // Attempt cleanup even when startup partly succeeded.
  let cleanupError=null;
  try {
    if(existsSync(path.join(data,'postmaster.pid'))) {
      // pg_ctl can time out after starting its child; discover PID in finally too.
      backendPid=Number(readFileSync(path.join(data,'postmaster.pid'),'utf8').split('\n')[0]);
      for(const database of [db]) {
        const dropped=psql('postgres',['-c',`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`],true);
        if(dropped.status!==0) log(`Explicit drop failed for ${database}; cluster removal remains mandatory`);
      }
      command('pg_ctl',['-D',data,'-m','immediate','-w','-t','15','stop']);
    }
    const status=command('pg_ctl',['-D',data,'status'],true);
    assert.notEqual(status.status,0,'cluster still running');
    if(backendPid) {
      let alive=true;
      try {process.kill(backendPid,0);} catch(e) {if(e.code==='ESRCH') alive=false; else throw e;}
      assert.equal(alive,false,'postmaster still exists');
    }
    assert.equal(existsSync(path.join(socket,`.s.PGSQL.${port}`)),false,'socket still exists');
    rmSync(root,{recursive:true,force:true});
    assert.equal(existsSync(root),false);
  } catch(e) {failed=true;cleanupError=e.message;log(`CLEANUP FAILURE: ${e.stack}`);}
  writeFileSync(path.join(runDir,'terminal.json'),JSON.stringify({revision,status:failed?'FAIL':'PASS',
    exitCode:failed?1:0,started,backendPid,cleanupError,rootRemoved:!existsSync(root),results},null,2));
}
process.exitCode=failed?1:0;