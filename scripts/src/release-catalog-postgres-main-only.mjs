// MAIN must execute explicitly. Creates its own local disposable cluster;
// never consumes DATABASE_URL, PGHOST, or other inherited DB selectors.
// Usage: RELEASE_CATALOG_MAIN_ONLY=AUTHORIZED RELEASE_CATALOG_PG_BIN=/absolute/bin node <this file>
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fingerprints } from "./release-catalog-comparison.mjs";

assert.equal(process.env.RELEASE_CATALOG_MAIN_ONLY, "AUTHORIZED", "MAIN authorization required");
const bin = process.env.RELEASE_CATALOG_PG_BIN;
assert.ok(bin && path.isAbsolute(bin), "Explicit absolute RELEASE_CATALOG_PG_BIN required");
for (const tool of ["initdb", "pg_ctl", "psql"]) assert.ok(fs.existsSync(path.join(bin, tool)), `Missing ${tool}`);
assert.notEqual(process.getuid?.(), 0, "Run as a non-root OS user; runner never escalates privileges");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-enum-"));
const data = path.join(dir, "data");
const socket = path.join(dir, "socket");
fs.mkdirSync(socket);
const env = {
  PATH: bin, HOME: dir, LANG: "C", PGHOST: socket, PGPORT: "5432",
  PGUSER: "enum_test", PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "5",
};
function run(tool, args, input) {
  const r = spawnSync(path.join(bin, tool), args, { env, input, encoding: "utf8", timeout: 60000 });
  if (r.error || r.status !== 0) throw new Error(`${tool} failed: ${r.error?.message ?? r.stderr}`);
  return r.stdout;
}
const sql = text => run("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], text);
function capture() {
  return JSON.parse(sql(`BEGIN READ ONLY;
    SELECT json_build_object('schemaRows', '[]'::json, 'attributes',
      (SELECT json_agg(q ORDER BY kind,parent,name,definition) FROM (
        SELECT 'enum' AS kind,t.typname AS parent,e.enumlabel AS name,e.enumsortorder::text AS definition
        FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
        JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
      ) q)); ROLLBACK;`).trim());
}
let initialized = false;
try {
  run("initdb", ["-D", data, "-U", "enum_test", "-A", "trust", "--no-locale"]);
  initialized = true;
  run("pg_ctl", ["-D", data, "-l", path.join(dir, "postgres.log"), "-o",
    `-c listen_addresses='' -c unix_socket_directories='${socket}'`, "-w", "start"]);
  sql(`CREATE TYPE public.status AS ENUM ('Z','M'); ALTER TYPE public.status ADD VALUE 'A' BEFORE 'M';`);
  const incremental = capture();
  sql(`DROP TYPE public.status; CREATE TYPE public.status AS ENUM ('Z','A','M');`);
  const rebuilt = capture();
  assert.notDeepEqual(incremental.attributes, rebuilt.attributes, "Fixture must actually renumber enum");
  assert.deepEqual(fingerprints(incremental), fingerprints(rebuilt));
  for (const labels of ["'A','Z','M'", "'Z','A','M','EXTRA'", "'Z','A'"]) {
    sql(`DROP TYPE public.status; CREATE TYPE public.status AS ENUM (${labels});`);
    assert.notDeepEqual(fingerprints(incremental), fingerprints(capture()));
  }
  console.log("RELEASE_ENUM_POSTGRES=PASS renumber=pass permutation/addition/removal=reject");
} finally {
  // Stop even if startup returned an ambiguous error. Preserve artifacts on
  // cleanup failure rather than deleting a possibly running cluster.
  if (initialized) {
    const status = spawnSync(path.join(bin, "pg_ctl"), ["-D", data, "status"], { env, encoding: "utf8", timeout: 10000 });
    if (status.status === 0) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    else if (status.status !== 3) throw new Error(`Disposable status uncertain; retained ${dir}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}