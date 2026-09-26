// Authorized ONLY for fiscal disposable. Exact catalog pre/postimages, no trigger reset.
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../lib/db/node_modules/pg/lib/index.js";
const beforeHash = "5f4323afaf6225e79a78dc581e3b350fe71dbe202831c07829ed8daf6681c1ca";
const afterHash = "520001178556703d8cda64dcfcda7911f7331c9e5f3e2c41107a8c7777b196bc";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const dir = "reports/priority-fiscal-20260926";
const before = fs.readFileSync(`${dir}/recovery-check-before.sql`, "utf8");
const after = fs.readFileSync(`${dir}/recovery-check-after.sql`, "utf8");
if (hash(before) !== beforeHash || hash(after) !== afterHash) throw Error("Migration artifact changed");
const url = new URL(JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/test-env.json")).TEST_DATABASE_URL);
if (url.pathname !== "/priority_fiscal_20260926") throw Error("Only authorized fiscal copy permitted");
url.hostname = url.hostname.replace("-pooler", "");
const c = new pg.Client({ connectionString: url.href, application_name: "fiscal-alias-only-migration",
  statement_timeout: 5000, connectionTimeoutMillis: 5000 });
const evidence = { beforeHash, afterHash, dataWrites: false, triggerChanges: false };
const definition = async () => (await c.query("SELECT pg_get_functiondef('public.e11_recovery_check()'::regprocedure) AS definition")).rows[0].definition;
const metadata = async () => (await c.query(`SELECT p.oid,p.proowner,p.proacl,
  (SELECT md5(string_agg(pg_get_triggerdef(t.oid),E'\\n' ORDER BY t.oid))
   FROM pg_trigger t WHERE NOT t.tgisinternal) AS triggers
  FROM pg_proc p WHERE p.oid='public.e11_recovery_check()'::regprocedure`)).rows[0];
const begin = async () => {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout='3000ms'");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended('E11:security',0))");
};
try {
  await c.connect();
  if ((await c.query("SELECT current_database() AS name")).rows[0].name !== "priority_fiscal_20260926")
    throw Error("Wrong effective database");
  const originalMeta = await metadata();
  await begin();
  const actual = hash(await definition());
  if (actual === afterHash) {
    await c.query("ROLLBACK");
    evidence.status = "ALREADY_EXACT_POSTIMAGE";
  } else {
    if (actual !== beforeHash) throw Error("Unknown installed function: refusing migration");
    await c.query(after);
    if (hash(await definition()) !== afterHash) throw Error("Trial postimage mismatch");
    await c.query("ROLLBACK");
    if (hash(await definition()) !== beforeHash) throw Error("Rollback did not restore exact preimage");
    evidence.rollbackTrial = "EXACT_PREIMAGE_RESTORED";
    await begin();
    if (hash(await definition()) !== beforeHash) throw Error("Preimage changed between trial and commit");
    await c.query(after);
    if (hash(await definition()) !== afterHash) throw Error("Commit precheck mismatch");
    await c.query("COMMIT");
    if (hash(await definition()) !== afterHash) throw Error("Committed postimage mismatch");
    evidence.status = "ALIAS_ONLY_COMMITTED";
  }
  if (JSON.stringify(await metadata()) !== JSON.stringify(originalMeta)) throw Error("Function identity/privileges or triggers changed");
  evidence.identityPrivilegesAndTriggersUnchanged = true;
} catch (error) {
  try { await c.query("ROLLBACK"); } catch {}
  evidence.status = "FAILED";
  evidence.errorClass = error.name;
  evidence.sqlstate = error.code ?? null;
  process.exitCode = 1;
} finally { await c.end(); }
const resultPath = `${dir}/recovery-alias-migration-result.json`;
if (fs.existsSync(resultPath)) {
  const previous = JSON.parse(fs.readFileSync(resultPath));
  evidence.previousRuns = [...(previous.previousRuns ?? []), {
    status: previous.status, rollbackTrial: previous.rollbackTrial,
    identityPrivilegesAndTriggersUnchanged: previous.identityPrivilegesAndTriggersUnchanged,
  }];
}
fs.writeFileSync(resultPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));