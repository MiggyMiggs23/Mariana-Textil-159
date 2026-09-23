// MAIN only. This entire disposable lifecycle runs within one process.
// No actors, operational table rows, application credentials, activation SQL or live defaults.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { report, root, distName, requireMain, pgTools, json, write, run, catalog, fingerprints, digest, canonical, closedEnv, verifyOutputs } from "./common.mjs";
requireMain();
for (const key of Object.keys(process.env)) {
  if (/^(PG|DATABASE_URL$|TEST_DATABASE_URL$|APPLICATION_DATABASE_URL$|NODE_OPTIONS$)/.test(key)) throw new Error(`Inherited selector forbidden: ${key}`);
}
const bin = pgTools();
const attempt = process.env.TANDA_B_ATTEMPT;
assert.match(attempt || "", /^[a-zA-Z0-9_-]{1,40}$/, "Explicit safe attempt required");
const port = Number(process.env.TANDA_B_API_PORT);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, "Explicit unprivileged API port required");
assert.ok(process.env.TANDA_B_CONTROL_BUNDLE && process.env.TANDA_B_CONTROL_SHA256, "Explicit retained E2 control path/hash required (never restarted)");
const control = fs.realpathSync(process.env.TANDA_B_CONTROL_BUNDLE);
const controlHash = process.env.TANDA_B_CONTROL_SHA256;
assert.match(controlHash,/^[a-f0-9]{64}$/);
assert.equal(digest(fs.readFileSync(control)), controlHash, "Retained control disk hash mismatch");
const procArgs = fs.readFileSync("/proc/191/cmdline","utf8").split("\0").filter(Boolean);
const procCwd = fs.realpathSync("/proc/191/cwd");
assert.ok(procArgs.slice(1).some(arg => {
  try { return fs.realpathSync(path.resolve(procCwd,arg)) === control; } catch { return false; }
}), "Control path is not the PID191 command-line bundle; no synthetic attribution");
verifyOutputs();
assert.equal(json(path.join(report,"evidencia/preflight-cli.json")).status,"PASS", "Real CLI preflight pending");
const expected = json(path.join(report,"release-expected.json"));
const livePath = path.join(report,"evidencia/live/catalog-B0-real.json");
const dumpPath = path.join(report,"evidencia/live/schema-B0-real.sql");
assert.equal(digest(fs.readFileSync(livePath)), expected.captureSha256);
assert.equal(digest(fs.readFileSync(dumpPath)), expected.dumpSha256);
const live = json(livePath);
const evidence = path.join(report,"evidencia",`rehearsal-${attempt}`);
assert.ok(!fs.existsSync(evidence), "Attempt evidence exists");
fs.mkdirSync(evidence);
const base = fs.mkdtempSync(path.join(os.tmpdir(),"tanda-b-off-"));
fs.chmodSync(base,0o700);
const socket = path.join(base,"socket");
fs.mkdirSync(socket);
const data = path.join(base,"data");
const pgPort = "55449"; // private Unix socket, TCP disabled; never a real DB target
const clean = { PATH:`${bin}:${process.env.PATH || ""}`, HOME:base, LANG:"C.UTF-8" };
const pg = { ...clean, PGHOST:socket, PGPORT:pgPort, PGUSER:live.role, PGDATABASE:live.database };
const runtime = { ...clean, ...closedEnv, NODE_ENV:"development", API_INSPECTION_BOOT:"1", PORT:String(port),
  DATABASE_URL:`postgresql://${encodeURIComponent(live.role)}@localhost:${pgPort}/${encodeURIComponent(live.database)}?host=${encodeURIComponent(socket)}` };
const sql = input => run(path.join(bin,"psql"), ["-X","-qAt","-v","ON_ERROR_STOP=1"], { env:pg, input }).stdout.trim();
const readonlyCatalog = () => catalog({ ...pg, PGOPTIONS:"-c default_transaction_read_only=on" },bin);
const ident = x => `"${x.replaceAll('"','""')}"`;
const snapshot = () => {
  const c = readonlyCatalog();
  const tables = {};
  const sequences = {};
  for (const row of c.schemaRows.filter(r => r.kind === "table" && r.schema_name === "public")) {
    const rows = sql(`BEGIN READ ONLY; SELECT encode(convert_to(to_jsonb(t)::text,'UTF8'),'hex') FROM public.${ident(row.object_name)} t ORDER BY to_jsonb(t)::text; ROLLBACK;`);
    tables[row.object_name] = { count: rows ? rows.split("\n").length : 0, sha256:digest(rows) };
  }
  for (const row of c.schemaRows.filter(r => r.kind === "sequence" && r.schema_name === "public")) {
    sequences[row.object_name] = sql(`BEGIN READ ONLY; SELECT last_value::text||':'||is_called::text FROM public.${ident(row.object_name)}; ROLLBACK;`);
  }
  return { ...fingerprints(c), tables, sequences };
};
let child, fd, pgAttempted=false;
let shuttingDown=false;
const result = { status:"FAIL", allGates:"OFF", liveDatabaseTouched:false, actorsCopied:false,
  liveCaptureProvenance:expected.provenance, controlAssociation:"PID191 command-line path and explicit disk hash; not proof of in-memory bytes",
  controlSha256:controlHash, postgresStarted:false, candidateStopped:false, postgresStopExit:null, disposableDestroyed:false };
async function stopChild() {
  if (!child) return;
  const current = child;
  if (current.exitCode === null && current.signalCode === null) {
    const ended = new Promise(resolve => current.once("close",resolve));
    try { process.kill(-current.pid,"SIGTERM"); } catch {}
    await Promise.race([ended,new Promise(resolve => setTimeout(resolve,5000))]);
    if (current.exitCode === null && current.signalCode === null) {
      try { process.kill(-current.pid,"SIGKILL"); } catch {}
      await Promise.race([ended,new Promise((_,reject) => setTimeout(() => reject(new Error("Child cleanup timed out")),5000))]);
    }
  }
  child=undefined;
  if (fd !== undefined) { fs.closeSync(fd); fd=undefined; }
  result.candidateStopped=true;
}
async function cleanup() {
  if (shuttingDown) return;
  shuttingDown=true;
  try { await stopChild(); } catch (error) { result.childCleanupError=error.message; process.exitCode=1; }
  if (pgAttempted) {
    const status = spawnSync(path.join(bin,"pg_ctl"),["-D",data,"status"],{env:clean,encoding:"utf8",timeout:10000});
    result.postgresStatusBeforeCleanup=status.status;
    const stopped = spawnSync(path.join(bin,"pg_ctl"),["-D",data,"-m","immediate","-w","stop"],{env:clean,encoding:"utf8",timeout:20000});
    result.postgresStopExit=stopped.status;
    // Failed stop is never relabelled as successful cleanup, even if the process vanished.
    if (stopped.status !== 0) { result.status="FAIL_CLEANUP"; process.exitCode=1; }
  }
  if ((!pgAttempted || result.postgresStopExit === 0) && !child) fs.rmSync(base,{recursive:true,force:true});
  result.disposableDestroyed=!fs.existsSync(base);
  if (!result.disposableDestroyed) result.preservedClusterForMain=base;
  write(path.join(evidence,"terminal.json"),result);
}
for (const signal of ["SIGINT","SIGTERM"]) process.once(signal,async () => {
  result.status=`INTERRUPTED_${signal}`; process.exitCode=1; await cleanup(); process.exit(1);
});
async function boot(bundle, hash, label) {
  assert.equal(digest(fs.readFileSync(bundle)),hash,"Pre-import bundle integrity mismatch");
  // Reserve/check port without touching the current server.
  const reservation=net.createServer();
  await new Promise((resolve,reject) => { reservation.once("error",reject); reservation.listen(port,"127.0.0.1",resolve); });
  await new Promise(resolve => reservation.close(resolve));
  fd=fs.openSync(path.join(evidence,`${label}.log`),"wx");
  child=spawn(process.execPath,[bundle],{cwd:root,env:runtime,detached:true,stdio:["ignore",fd,fd]});
  let spawnError;
  child.once("error",error => { spawnError=error; });
  const deadline=Date.now()+25000;
  try {
    while (Date.now()<deadline) {
      if (spawnError) throw new Error(`${label} spawn failed`);
      const log=fs.readFileSync(path.join(evidence,`${label}.log`),"utf8");
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`${label} exited before readiness`);
      if (log.includes("Inspection boot:") && log.includes("Server listening")) {
        return { status:"PASS_INSPECTION_START", sha256:hash, runtimeInspectionMarker:true, listeningMarker:true };
      }
      await new Promise(resolve => setTimeout(resolve,150));
    }
    throw new Error(`${label} readiness timeout`);
  } finally { await stopChild(); }
}
try {
  run(path.join(bin,"initdb"),["-U",live.role,"-A","trust","--no-locale","-E","UTF8","-D",data],{env:clean});
  pgAttempted=true;
  run(path.join(bin,"pg_ctl"),["-D",data,"-l",path.join(base,"postgres.log"),"-o",`-k ${socket} -h "" -p ${pgPort}`,"-w","start"],{env:clean});
  result.postgresStarted=true;
  if (!["postgres","template1"].includes(live.database)) run(path.join(bin,"createdb"),[live.database],{env:{...pg,PGDATABASE:"postgres"}});
  sql(fs.readFileSync(dumpPath,"utf8"));
  const reconstructed=readonlyCatalog();
  write(path.join(evidence,"catalog-reconstructed.json"),reconstructed);
  const fidelity={ real:fingerprints(live), reconstructed:fingerprints(reconstructed),
    identityScope:"Disposable identity only; never substitutes for real preflight", rawEnumAndTriggerAttributesPreserved:true };
  write(path.join(evidence,"catalog-fidelity.json"),fidelity);
  // NO catalog UPDATE, enum normalization, trigger repair or relaxed hashes.
  assert.deepEqual(fidelity.reconstructed,fidelity.real,"BLOCKED_CATALOG_FIDELITY: retain raw differences; MAIN decision required");
  const before=snapshot();
  write(path.join(evidence,"before.json"),before);
  assert.ok(Object.values(before.tables).every(t => t.count===0),"Schema-only fixture unexpectedly contains operational rows");
  const candidate=path.join(root,"artifacts/api-server",distName,"index.mjs");
  const manifest=verifyOutputs();
  const candidateHash=manifest.outputs[path.relative(root,candidate)];
  try { result.candidate=await boot(candidate,candidateHash,"candidate"); }
  catch (error) { result.candidate={status:"FAIL",reason:error.message}; }
  const after=snapshot();
  write(path.join(evidence,"after.json"),after);
  assert.deepEqual(after,before,"Startup changed disposable catalog/rows/sequences");
  result.semanticCatalogTableRowsAndSequenceIsCalledUnchanged=true;
  if (result.candidate.status !== "PASS_INSPECTION_START") {
    result.control=await boot(control,controlHash,"control-e2-current-disk");
    const afterControl=snapshot();
    write(path.join(evidence,"after-control.json"),afterControl);
    assert.deepEqual(afterControl,before,"Retained E2 control changed disposable DB");
    throw new Error("Candidate startup failed; current E2 disk control recorded only on disposable DB");
  }
  // Synthetic sensitivity evidence stays explicitly separate from real capture.
  const original=digest(canonical(before));
  const mutant=structuredClone(before); mutant.syntheticSensitivityMarker=true;
  assert.notEqual(digest(canonical(mutant)),original);
  result.syntheticSensitivityControl="Structural hash sensitivity only; NOT real DB or row mutation control";
  result.status="PASS_DISPOSABLE_INSPECTION_MAIN_REVIEW_PENDING";
} catch (error) {
  result.error=error.message; process.exitCode=1;
} finally {
  await cleanup();
}
console.log(JSON.stringify(result));