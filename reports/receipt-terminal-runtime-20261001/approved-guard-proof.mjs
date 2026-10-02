// MAIN runtime only. Read-only verification against the owned disposable API's
// effective database. Never obtains a URL from shell/app environment.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";

const sha=value=>createHash("sha256").update(value).digest("hex");
const beforeHash="8e5b05bc6101b1d1ddd311bc34e7e47d16247fd655b7d48dc6bfba222900b90c";
const afterHash="fe3f1b3b070c48c0deac7c1f0d7c8281c7262b1cf131fa8c44f287f8fdedcbab";
const sqlHash="ee12bcaace99ed9b7c6abe51b80efa3a554c44d36f9bd94f30169761a68b66a5";
export async function verifyApprovedGuard(run){
  const root=path.resolve(import.meta.dirname,"../..");
  assert.equal(path.dirname(fs.realpathSync(run)),fs.realpathSync(import.meta.dirname));
  const json=file=>JSON.parse(fs.readFileSync(file,"utf8"));
  const state=json(path.join(run,"result.json")),identity=json(path.join(run,"api-effective-identity.json"));
  const manifestFile=path.join(root,"reports/receipt-terminal-print-20261001/revision-3/manifest.json");
  const manifest=json(manifestFile);
  assert.equal(manifest.onlyChangedDatabaseObject,"public.e5_insert_authority()");
  assert.equal(manifest.sqlSha256,sqlHash);
  assert.equal(manifest.apiIndexSha256,state.apiSha256);
  assert.equal(sha(fs.readFileSync(path.join(root,manifest.sql))),sqlHash,"Approved SQL file drift");
  assert.equal(sha(fs.readFileSync(path.join(root,manifest.binaryManifest))),manifest.binaryManifestSha256);
  const proofFiles=fs.readdirSync(run).filter(f=>/^receipt-print-guard-\d+\.json$/.test(f)).sort();
  assert.ok(proofFiles.length,"Missing MAIN isolated guard application proof");
  const proofFile=path.join(run,proofFiles.at(-1)),proof=json(proofFile);
  assert.equal(proof.status,"ISOLATED_GUARD_APPLIED");
  assert.equal(proof.onlyFunction,"public.e5_insert_authority()");
  assert.equal(proof.sqlSha256,sqlHash);
  assert.equal(proof.beforeHash,beforeHash);assert.equal(proof.afterHash,afterHash);
  for(const key of ["financialRowsUnchanged","auditRowsUnchanged","otherFunctionsUnchanged","noApiRestart","noLiveDatabaseAccess"])
    assert.equal(proof[key],true,`Missing proof ${key}`);
  assert.equal(proof.scriptSha256,sha(fs.readFileSync(path.join(root,"reports/receipt-terminal-print-20261001/apply-print-guard-isolated.mjs"))));
  const pid=state.apiPid;
  assert.equal(pid,proof.apiPid);assert.ok(Number.isSafeInteger(pid)&&pid>1);
  assert.equal(proof.database,identity.database);assert.match(identity.database,/^isolated_test_/);
  const argv=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0");
  assert.ok(argv.includes(path.join(run,"bootstrap.mjs")),"PID no longer owns this harness API");
  const environment=Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`,"utf8").split("\0").filter(Boolean).map(v=>{
    const i=v.indexOf("=");return [v.slice(0,i),v.slice(i+1)];
  }));
  const connectionString=environment.DATABASE_URL;
  const url=new URL(connectionString);
  assert.equal(decodeURIComponent(url.pathname.slice(1)),identity.database);
  assert.ok(!/neon/i.test(url.hostname));
  const {Client}=createRequire(path.join(root,"lib/db/package.json"))("pg");
  const client=new Client({connectionString,connectionTimeoutMillis:4000,query_timeout:5000});
  try{
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='4s'");
    const effective=(await client.query("SELECT current_database() db,current_setting('data_directory') directory,current_setting('listen_addresses') listen,current_setting('transaction_read_only') readonly")).rows[0];
    assert.equal(effective.db,identity.database);assert.equal(effective.listen,"");assert.equal(effective.readonly,"on");
    assert.equal(sha(effective.directory),identity.directoryHash);
    const fn=(await client.query("SELECT pg_get_functiondef('public.e5_insert_authority()'::regprocedure) definition")).rows[0];
    assert.equal(sha(fn.definition),afterHash,"Effective native guard differs from exactly approved revision");
    await client.query("ROLLBACK");
    return {status:"APPROVED_FUNCTION_VERIFIED_READ_ONLY",proofFile,proofSha256:sha(fs.readFileSync(proofFile)),
      manifestSha256:sha(fs.readFileSync(manifestFile)),database:identity.database,apiPid:pid,beforeHash,afterHash,
      financialComparisonPolicy:"EXACT original baseline, including all native trigger definitions. No normalized or omitted fields."};
  }catch{
    await client.query("ROLLBACK").catch(()=>{});
    // Do not let pg connection errors print connection strings or credentials.
    throw Error("Approved guard read-only verification failed closed; identity/function/hash not accepted");
  }finally{await client.end();}
}