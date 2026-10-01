// Authorized development-only change; never use for managed production.
// Run: node reports/driver-multiple-phones-20261001/migration.cjs test
// Then: node reports/driver-multiple-phones-20261001/migration.cjs apply <api-pid>
// Credentials and row values stay in memory. Reports contain hashes/counts/schema only.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { Client } = createRequire(path.resolve("lib/db/package.json"))("pg");
const directory = __dirname;
const ddl = "ALTER TABLE public.choferes ADD COLUMN telefonos jsonb";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const assert = (condition, label) => {
  if (!condition) {
    const error = new Error(label);
    error.safeLabel = label;
    throw error;
  }
};
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const write = (name, data) => fs.writeFileSync(
  path.join(directory, name), JSON.stringify(data, null, 2) + "\n", { mode: 0o600 },
);
async function column(client) {
  return (await client.query(`
    SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
      a.attnotnull AS not_null, a.atthasdef AS has_default,
      a.attidentity AS identity, a.attgenerated AS generated
    FROM pg_attribute a
    WHERE a.attrelid='public.choferes'::regclass AND a.attname='telefonos'
      AND a.attnum>0 AND NOT a.attisdropped
  `)).rows;
}
function matches(columns) {
  return columns.length === 1 && columns[0].type === "jsonb"
    && !columns[0].not_null && !columns[0].has_default
    && columns[0].identity === "" && columns[0].generated === "";
}
async function snapshot(client) {
  const tables = (await client.query(`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
    ORDER BY n.nspname,c.relname
  `)).rows;
  const result = [];
  for (const table of tables) {
    const target = table.schema === "public" && table.name === "choferes";
    const projection = target ? "(to_jsonb(t)-'telefonos')" : "to_jsonb(t)";
    const sql = `
      SELECT count(*)::text AS rows,
        encode(sha256(convert_to(COALESCE(string_agg(row_hash,'' ORDER BY row_hash),''),'UTF8')),'hex') AS sha256
      FROM (
        SELECT encode(sha256(convert_to(${projection}::text,'UTF8')),'hex') AS row_hash
        FROM ${quote(table.schema)}.${quote(table.name)} t
      ) s
    `;
    result.push({ ...table, ...(await client.query(sql)).rows[0] });
  }
  return result;
}
async function legacyProof(client) {
  // Physical MVCC identity additionally detects UPDATEs that might keep values equal.
  return (await client.query(`
    SELECT count(*)::text AS rows,
      encode(sha256(convert_to(COALESCE(string_agg(
        encode(sha256(convert_to(jsonb_build_array(id,telefono,created_at,updated_at)::text,'UTF8')),'hex'),
        '' ORDER BY id),''),'UTF8')),'hex') AS legacy_phone_and_timestamps_sha256,
      encode(sha256(convert_to(COALESCE(string_agg(
        id::text || ':' || xmin::text || ':' || ctid::text,
        '|' ORDER BY id),''),'UTF8')),'hex') AS tuple_identity_sha256,
      pg_relation_filenode('public.choferes'::regclass)::text AS relation_filenode
    FROM public.choferes
  `)).rows[0];
}
async function schemaHash(client) {
  const result = await client.query(`
    SELECT n.nspname,c.relname,a.attnum,a.attname,
      format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
      pg_get_expr(d.adbin,d.adrelid) AS default_expression,
      a.attidentity,a.attgenerated
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
      AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
      AND NOT (n.nspname='public' AND c.relname='choferes' AND a.attname='telefonos')
    ORDER BY n.nspname,c.relname,a.attnum
  `);
  return hash(JSON.stringify(result.rows));
}
async function migrate(client, expectedDatabase) {
  let committed = false;
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    const identity = (await client.query(`
      SELECT current_database() AS database,current_schema() AS schema,
        pg_is_in_recovery() AS recovery
    `)).rows[0];
    assert(identity.database === expectedDatabase && identity.schema === "public"
      && !identity.recovery, "database-identity-mismatch");
    assert((await client.query("SELECT count(*)::int AS count FROM pg_event_trigger WHERE evtenabled <> 'D'")).rows[0].count === 0,
      "enabled-event-triggers-require-review");
    await client.query("LOCK TABLE public.choferes IN ACCESS EXCLUSIVE MODE");
    const beforeColumn = await column(client);
    assert(beforeColumn.length === 0 || matches(beforeColumn), "existing-column-mismatch");
    const before = await snapshot(client);
    const legacyBefore = await legacyProof(client);
    const schemaBefore = await schemaHash(client);
    if (beforeColumn.length === 0) await client.query(ddl);
    const afterColumn = await column(client);
    assert(matches(afterColumn), "new-column-mismatch");
    const after = await snapshot(client);
    const legacyAfter = await legacyProof(client);
    const schemaAfter = await schemaHash(client);
    assert(JSON.stringify(before) === JSON.stringify(after), "row-content-or-count-changed");
    assert(JSON.stringify(legacyBefore) === JSON.stringify(legacyAfter), "legacy-or-tuple-mutated");
    assert(schemaBefore === schemaAfter, "unrelated-column-schema-changed");
    const populated = (await client.query(
      "SELECT count(*)::text AS count FROM public.choferes WHERE telefonos IS NOT NULL",
    )).rows[0].count;
    if (beforeColumn.length === 0) assert(populated === "0", "unexpected-backfill");
    // Execute the legacy read without transferring row values to the reporting process.
    await client.query(`
      SELECT count(*) FROM (
        SELECT id,nombre_completo,telefono,activo,created_at,updated_at FROM public.choferes
      ) legacy
    `);
    await client.query("COMMIT");
    committed = true;
    const persistedColumn = await column(client);
    assert(matches(persistedColumn), "post-commit-column-mismatch");
    return {
      status: "COMMITTED", identity, action: beforeColumn.length ? "ALREADY_MATCHED" : ddl,
      beforeColumn, afterColumn, persistedColumn, before, after,
      legacyBefore, legacyAfter, schemaBefore, schemaAfter,
      allExistingRowsAndValuesUnchanged: true, legacyPhonesAndTimestampsUnchanged: true,
      targetTupleIdentitiesUnchanged: true, targetTableNotRewritten: true,
      otherTablesUnchangedInTransactionSnapshot: true,
      populatedTelefonosRows: populated, backfill: false, dml: false,
      lockTimeout: "5s", legacyColumnReadCompatible: true,
      comparisonScope: "One repeatable-read transaction; choferes access-exclusive locked. Other-table concurrent application writes outside this snapshot are not excluded.",
    };
  } catch (error) {
    if (!committed) await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
async function test() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "driver-phones-pg-"));
  const data = path.join(root, "data");
  const socket = path.join(root, "socket");
  fs.mkdirSync(socket, { mode: 0o700 });
  const shell = (command, args) => {
    const result = spawnSync(command, args, { stdio: "pipe", timeout: 30000 });
    assert(result.status === 0, `disposable-${command}-failed`);
  };
  let started = false;
  let client;
  try {
    shell("initdb", ["-D", data, "-U", "isolated", "-A", "trust", "--no-locale", "-E", "UTF8"]);
    shell("pg_ctl", ["-D", data, "-l", path.join(root, "postgres.log"), "-o",
      `-k ${socket} -p 55439 -c listen_addresses=''`, "-w", "start"]);
    started = true;
    client = new Client({ host: socket, port: 55439, user: "isolated", database: "postgres" });
    await client.connect();
    await client.query("CREATE DATABASE driver_phones_disposable");
    await client.end();
    client = new Client({ host: socket, port: 55439, user: "isolated", database: "driver_phones_disposable" });
    await client.connect();
    assert((await client.query("SELECT current_database() AS name")).rows[0].name === "driver_phones_disposable",
      "disposable-identity-mismatch");
    await client.query(`CREATE TABLE public.choferes (
      id serial PRIMARY KEY,nombre_completo text NOT NULL,telefono text NOT NULL,
      activo boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    // Synthetic values are generated in memory; no phone values are stored in reports.
    const fixture = Array.from({ length: 12 }, (_, i) => String(i % 10)).join("");
    for (let i = 0; i < 3; i++) {
      await client.query(`INSERT INTO public.choferes(nombre_completo,telefono,activo,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5)`, ["synthetic", i === 1 ? "" : fixture,
        i !== 2, "2020-01-01T00:00:00Z", "2020-02-01T00:00:00Z"]);
    }
    const result = await migrate(client, "driver_phones_disposable");
    const idempotent = await migrate(client, "driver_phones_disposable");
    assert(idempotent.action === "ALREADY_MATCHED", "idempotence-failed");
    await client.query("BEGIN");
    await client.query("INSERT INTO choferes(nombre_completo,telefono) VALUES($1,$2)", ["synthetic", fixture]);
    await client.query("UPDATE choferes SET telefono=$1 WHERE id=1", [fixture]);
    await client.query("ROLLBACK");
    await client.query("ALTER TABLE choferes ALTER COLUMN telefonos SET DEFAULT '[]'::jsonb");
    let rejected = false;
    try { await migrate(client, "driver_phones_disposable"); } catch (error) {
      rejected = error.safeLabel === "existing-column-mismatch";
    }
    assert(rejected, "mismatched-column-not-rejected");
    await client.end();
    client = undefined;
    shell("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    started = false;
    fs.rmSync(root, { recursive: true, force: true });
    write("migration-local-test.json", {
      ...result, mode: "unix-socket-only-disposable-postgresql",
      scriptSha256: hash(fs.readFileSync(__filename)), idempotencePassed: true,
      legacyInsertUpdateCompatible: true, mismatchedDefaultRejected: true, disposableRemoved: true,
    });
    console.log(JSON.stringify({ localTest: "PASS", rows: result.legacyBefore.rows, disposableRemoved: true }));
  } finally {
    if (client) await client.end().catch(() => {});
    if (started) shell("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
async function apply() {
  const proof = JSON.parse(fs.readFileSync(path.join(directory, "migration-local-test.json"), "utf8"));
  assert(proof.status === "COMMITTED" && proof.disposableRemoved
    && proof.scriptSha256 === hash(fs.readFileSync(__filename)), "matching-local-proof-required");
  const pid = process.argv[3];
  assert(/^\d+$/.test(pid || ""), "api-pid-required");
  const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
  assert(cmd[0].endsWith("/node") && cmd.some(x => /artifacts\/api-server\/dist[^/]*\/index\.mjs$/.test(x)),
    "running-api-process-not-confirmed");
  const env = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")
    .filter(Boolean).map(value => { const i = value.indexOf("="); return [value.slice(0, i), value.slice(i + 1)]; }));
  assert(env.DATABASE_URL && !env.TEST_DATABASE_URL && env.REQUIRE_ISOLATED_TEST_DATABASE !== "1"
    && env.NODE_ENV !== "test", "unexpected-api-connection-selection");
  const url = new URL(env.DATABASE_URL);
  assert(!/neon/i.test(url.hostname) && url.pathname === "/heliumdb", "noncanonical-target-rejected");
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await migrate(client, "heliumdb");
    write("migration-live.json", {
      ...result, connectionSource: "running-api-/proc/environ-DATABASE_URL",
      apiPid: Number(pid), scriptSha256: hash(fs.readFileSync(__filename)),
      localTestSha256: hash(fs.readFileSync(path.join(directory, "migration-local-test.json"))),
      noWorkflowOrApplicationRestart: true, sourceFilesChanged: false,
    });
    console.log(JSON.stringify({ status: result.status, identity: result.identity,
      tablesVerified: result.before.length, choferesRows: result.legacyBefore.rows,
      allExistingValuesUnchanged: true, newColumnPopulatedRows: result.populatedTelefonosRows }));
  } finally { await client.end(); }
}
(async () => {
  assert(["test", "apply"].includes(process.argv[2]), "mode-must-be-test-or-apply");
  if (process.argv[2] === "test") await test();
  else await apply();
})().catch(error => {
  console.error(JSON.stringify({ status: "FAILED", reason: error.safeLabel || "database-or-system-error",
    code: /^[A-Z0-9]{5}$/.test(error.code || "") ? error.code : null }));
  process.exitCode = 1;
});