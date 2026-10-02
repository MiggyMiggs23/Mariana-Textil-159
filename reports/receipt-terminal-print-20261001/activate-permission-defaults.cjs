// MAIN ONLY: preflight reads; apply atomically installs the tested print guard + module defaults.
// No startup, general schema initialization, workflow, or secret/URI logging.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { Client } = createRequire(path.resolve("lib/db/package.json"))("pg");
const dir = __dirname, root = path.resolve(dir, "../..");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const json = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const save = (f, data) => fs.writeFileSync(path.join(dir, f), JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
const tables = ["permisos_rol", "permisos_usuario", "permisos_ubicacion"];
const mode = process.argv[2], pid = process.argv[3];
const moduleName = "recibos_abonos";
const guardSqlPath = path.join(root, "lib/db/src/lib/receipt-print-authority.sql");
const guardSqlHash = "ee12bcaace99ed9b7c6abe51b80efa3a554c44d36f9bd94f30169761a68b66a5";
// Exact definitions tested in retained isolated PostgreSQL, not guessed from HEAD.
const guardOldHash = "8e5b05bc6101b1d1ddd311bc34e7e47d16247fd655b7d48dc6bfba222900b90c";
const guardNewHash = "fe3f1b3b070c48c0deac7c1f0d7c8281c7262b1cf131fa8c44f287f8fdedcbab";
const desired = role => ({ puede_ver: ["ADMIN", "TERMINAL"].includes(role), puede_crear: false, puede_editar: false, puede_autorizar: false });
function processIdentity() {
  assert.match(pid ?? "", /^\d+$/);
  const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
  const expected = "artifacts/api-server/dist-driver-phones-20261001/index.mjs";
  assert(cmd[0].endsWith("/node") && cmd.some(x => x === expected || x === path.join(root, expected)), "active-api-path-mismatch");
  const guards = json("revision-2/baseline-provenance.json").guards.servedApi;
  for (const [file, hash] of Object.entries(guards))
    if (typeof hash === "string") assert.equal(sha(fs.readFileSync(path.join(root, path.dirname(expected), file))), hash, "active-api-bytes-mismatch");
  const env = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(Boolean)
    .map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; }));
  assert(env.DATABASE_URL && !env.TEST_DATABASE_URL && env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" && env.NODE_ENV !== "test", "wrong-connection-selection");
  const url = new URL(env.DATABASE_URL);
  assert(url.pathname === "/heliumdb" && !/neon/i.test(url.hostname), "not-live-helium");
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ");
  return { connectionString: env.DATABASE_URL, proof: { pid: Number(pid), startTicks: stat[19],
    commandHash: sha(JSON.stringify(cmd)), connectionIdentityHash: sha(JSON.stringify([url.hostname, url.port, url.pathname, url.username])) } };
}
async function identity(c) {
  const row = (await c.query(`SELECT current_database() AS database, current_user AS role,
    current_schema() AS schema, inet_server_addr()::text AS address, inet_server_port() AS port,
    pg_postmaster_start_time()::text AS server_start, pg_is_in_recovery() AS recovery`)).rows[0];
  assert(row.database === "heliumdb" && row.schema === "public" && !row.recovery, "database-identity-mismatch");
  return { database: row.database, schema: row.schema, recovery: row.recovery, fingerprint: sha(JSON.stringify(row)) };
}
async function snapshot(c) {
  const result = {};
  for (const table of tables) result[table] = (await c.query(
    `SELECT to_jsonb(t) AS value, xmin::text AS xmin, ctid::text AS ctid FROM public.${table} t ORDER BY to_jsonb(t)::text`
  )).rows;
  return result;
}
async function guardSnapshot(c) {
  const functions = (await c.query(`SELECT p.oid::text,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS args,
    pg_get_functiondef(p.oid) AS definition,p.proowner::text,p.proacl::text,p.prosecdef,p.proconfig,p.prolang::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.oid`)).rows;
  const guard = functions.find(f => f.proname === "e5_insert_authority" && f.args === "");
  assert(guard && !guard.prosecdef && JSON.stringify(guard.proconfig) === '["search_path=pg_catalog"]', "guard-config-drift");
  const definitionHash = sha(guard.definition);
  assert([guardOldHash, guardNewHash].includes(definitionHash), "untested-guard-definition");
  const triggers = (await c.query(`SELECT t.oid::text,t.tgrelid::text,t.tgfoid::text,t.tgname,t.tgenabled,t.tgtype,
    c.relname AS table_name,
    pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname='public' ORDER BY t.oid`)).rows;
  const authorityTriggers = triggers.filter(t => t.tgname === "e5_insert_authority");
  assert.deepEqual(authorityTriggers.map(t => t.table_name).sort(),
    ["e5_aplicaciones", "e5_devoluciones", "e5_impresiones", "e5_operaciones", "e5_recepciones", "e5_salidas_bancarias"],
    "guard-trigger-set-drift");
  assert(authorityTriggers.every(t => t.tgenabled === "O" && t.tgtype === 7 && t.tgfoid === guard.oid),
    "guard-trigger-disabled-or-rewired");
  return { functions, triggers, guard, definitionHash };
}
function plan(rows, roles) {
  return roles.map(rol => {
    const row = rows.find(r => r.value.rol === rol && r.value.modulo === moduleName)?.value;
    const after = desired(rol);
    return { rol, action: row?.updated_por != null ? "PRESERVE_CUSTOM" : !row ? "INSERT"
      : Object.entries(after).some(([k, v]) => row[k] !== v) ? "UPDATE" : "UNCHANGED",
      before: row ? Object.fromEntries(Object.keys(after).map(k => [k, row[k]])) : null, after };
  });
}
async function main() {
  assert(["preflight", "apply"].includes(mode), "preflight-or-apply-required");
  if (mode === "apply") assert.equal(process.argv[4], "--main-authorized-after-pass", "MAIN-pass-gate-required");
  const selected = processIdentity(), scriptHash = sha(fs.readFileSync(__filename));
  const guardSql = fs.readFileSync(guardSqlPath, "utf8");
  assert.equal(sha(guardSql), guardSqlHash, "canonical-SQL-drift");
  const c = new Client({ connectionString: selected.connectionString, connectionTimeoutMillis: 5000 });
  let committed = false;
  try {
    await c.connect();
    await c.query(mode === "preflight" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SET LOCAL lock_timeout='3s'");
    await c.query("SET LOCAL statement_timeout='20s'");
    if (mode === "apply") await c.query("LOCK TABLE public.permisos_rol, public.permisos_usuario, public.permisos_ubicacion IN SHARE ROW EXCLUSIVE MODE");
    const db = await identity(c);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_event_trigger WHERE evtenabled <> 'D'")).rows[0].n, 0,
      "enabled-DDL-event-triggers-require-review");
    assert.equal((await c.query(`SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgrelid IN ('public.permisos_rol'::regclass,'public.permisos_usuario'::regclass,'public.permisos_ubicacion'::regclass)
      AND NOT tgisinternal AND tgenabled <> 'D'`)).rows[0].n, 0, "permission-triggers-require-review");
    const roles = (await c.query("SELECT unnest(enum_range(NULL::rol_usuario))::text AS rol")).rows.map(r => r.rol).sort();
    assert(roles.includes("ADMIN") && roles.includes("TERMINAL"));
    const before = await snapshot(c), changes = plan(before.permisos_rol, roles);
    const beforeGuard = await guardSnapshot(c);
    const preflight = { scriptHash, process: selected.proof, identity: db, roles, snapshotHash: sha(JSON.stringify(before)), changes,
      guard: { sqlSha256: guardSqlHash, beforeHash: beforeGuard.definitionHash, afterHash: guardNewHash,
        action: beforeGuard.definitionHash === guardNewHash ? "UNCHANGED" : "REPLACE_PRINT_BRANCH_ONLY",
        functionsHash: sha(JSON.stringify(beforeGuard.functions)), triggersHash: sha(JSON.stringify(beforeGuard.triggers)) },
      tableSnapshots: Object.fromEntries(tables.map(t => [t, { rows: before[t].length, sha256: sha(JSON.stringify(before[t])) }])) };
    if (mode === "preflight") {
      await c.query("ROLLBACK");
      save("permission-preflight-private.json", before);
      save("permission-preflight.json", { status: "READ_ONLY_PREFLIGHT", ...preflight });
      console.log(JSON.stringify({ status: "READ_ONLY_PREFLIGHT", changes, guard: preflight.guard, tables: preflight.tableSnapshots }));
      return;
    }
    const prior = json("permission-preflight.json");
    for (const k of ["scriptHash", "process", "identity", "roles", "snapshotHash", "changes", "guard"])
      assert.deepEqual(preflight[k], prior[k], `preflight-drift-${k}`);
    // This statement contains no data DML. The following UPSERT is the only row write.
    await c.query(guardSql);
    const updated = await c.query(`INSERT INTO public.permisos_rol
      (rol,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
      SELECT rol,'recibos_abonos',rol IN ('ADMIN','TERMINAL'),false,false,false
      FROM unnest(enum_range(NULL::rol_usuario)) AS rol
      ON CONFLICT (rol,modulo) DO UPDATE SET puede_ver=EXCLUDED.puede_ver,
        puede_crear=false,puede_editar=false,puede_autorizar=false,updated_at=NOW()
      WHERE permisos_rol.updated_por IS NULL AND
        (permisos_rol.puede_ver,permisos_rol.puede_crear,permisos_rol.puede_editar,permisos_rol.puede_autorizar)
        IS DISTINCT FROM (EXCLUDED.puede_ver,false,false,false)
      RETURNING rol::text AS rol`);
    const expected = changes.filter(x => ["INSERT", "UPDATE"].includes(x.action)).map(x => x.rol).sort();
    assert.deepEqual(updated.rows.map(r => r.rol).sort(), expected, "unexpected-changed-roles");
    const after = await snapshot(c);
    for (const table of ["permisos_usuario", "permisos_ubicacion"]) assert.deepEqual(after[table], before[table], `collateral-${table}`);
    const unaffected = rows => rows.filter(r => r.value.modulo !== moduleName || !expected.includes(r.value.rol));
    assert.deepEqual(unaffected(after.permisos_rol), unaffected(before.permisos_rol), "collateral-role-rows");
    for (const rol of expected) {
      const old = before.permisos_rol.find(r => r.value.rol === rol && r.value.modulo === moduleName)?.value;
      const now = after.permisos_rol.find(r => r.value.rol === rol && r.value.modulo === moduleName)?.value;
      assert(now); assert.equal(now.updated_por, null);
      for (const [k, v] of Object.entries(desired(rol))) assert.equal(now[k], v);
      if (old) for (const k of Object.keys(old)) if (!(k in desired(rol)) && k !== "updated_at") assert.deepEqual(now[k], old[k]);
    }
    const afterGuard = await guardSnapshot(c);
    assert.equal(afterGuard.definitionHash, guardNewHash, "wrong-installed-print-guard");
    const otherFunctions = list => list.filter(f => f.oid !== beforeGuard.guard.oid);
    assert.deepEqual(otherFunctions(afterGuard.functions), otherFunctions(beforeGuard.functions), "collateral-functions");
    const { definition: _oldDefinition, ...oldMetadata } = beforeGuard.guard;
    const { definition: _newDefinition, ...newMetadata } = afterGuard.guard;
    assert.deepEqual(newMetadata, oldMetadata, "guard-owner-ACL-or-metadata-changed");
    assert.deepEqual(afterGuard.triggers, beforeGuard.triggers, "trigger-drift");
    assert.deepEqual(processIdentity().proof, selected.proof, "API-process-changed");
    await c.query("COMMIT"); committed = true;
    save("permission-applied.json", { status: "COMMITTED", ...preflight, changedRoles: expected,
      afterHash: sha(JSON.stringify(after)), noOtherPermissionRowsChanged: true, noInitializers: true,
      installedGuardHash: afterGuard.definitionHash, otherFunctionsAndAllTriggersUnchanged: true });
    console.log(JSON.stringify({ status: "COMMITTED", changedRoles: expected, installedGuardHash: afterGuard.definitionHash,
      noOtherPermissionRowsChanged: true, otherFunctionsAndAllTriggersUnchanged: true }));
  } catch (error) {
    if (!committed) await c.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await c.end(); }
}
main().catch(() => { console.error(JSON.stringify({ status: "FAILED_CLOSED", reason: "identity, preflight, lock, SQL or postcondition failure; no URI logged" })); process.exitCode = 1; });