// MAIN authorized only this owned disposable. Never reads an application URL.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { baselineE1E2 } from "./baseline-e1-e2.mjs";
const require = createRequire(resolve("lib/db/package.json"));
const { Client } = require("pg");
const expected = JSON.parse(readFileSync("reports/trabajo-nocturno-20260925/tarea-5/ownership.json", "utf8"));
assert.equal(expected.owner, "night-task56-browser");
const client = new Client({ connectionString: "postgresql://postgres@127.0.0.1:55526/night56_test", connectionTimeoutMillis: 5000 });
await client.connect();
try {
  const identity = (await client.query(`SELECT current_database() database, inet_server_port() port,
    current_setting('data_directory') directory,pg_postmaster_start_time() started`)).rows[0];
  assert.equal(identity.database, expected.identity.database);
  assert.equal(identity.port, expected.identity.port);
  assert.equal(identity.directory, expected.identity.directory);
  assert.equal(identity.started.toISOString(), expected.identity.started);
  assert.equal((await client.query("SELECT to_regclass('public.e11_perfiles') relation")).rows[0].relation, null);
  await client.query("BEGIN");
  try {
    await client.query("ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS e2_insert_xid xid8; ALTER TABLE cobros_credito_pendientes_e1 ADD COLUMN IF NOT EXISTS e2_insert_xid xid8");
    await client.query(baselineE1E2());
    for (const file of [
      "reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
      "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql",
      ...[1, 2, 3, 4].map(n => `reports/tanda-b-b0-b1-20260923/r5/sql/${n}.sql`),
      "reports/trabajo-nocturno-20260925/tarea-2/historical-pre-e11-graph.sql",
      "reports/e11/01-preparado.sql",
      "reports/trabajo-nocturno-20260925/tarea-1/installed-graph-readonly.sql",
    ]) {
      let text = readFileSync(file, "utf8").replace(/^\\set ON_ERROR_STOP on\r?\n/, "")
        .replace(/^BEGIN;\r?$/gm, "").replace(/^COMMIT;\r?$/gm, "");
      if (file.endsWith("/01-install-prepared.sql"))
        text = text.slice(text.indexOf("CREATE FUNCTION public.e3_receipt_immutable()"));
      await client.query(text);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  const closures = (await client.query(`SELECT tgname,count(*)::int FROM pg_trigger
    WHERE tgname IN ('e5_closed','e11_closed') AND tgenabled='O' GROUP BY tgname ORDER BY tgname`)).rows;
  assert.deepEqual(closures, [{ tgname: "e11_closed", count: 8 }, { tgname: "e5_closed", count: 9 }]);
  writeFileSync("reports/trabajo-nocturno-20260925/tarea-1/task56-baseline-result.json",
    JSON.stringify({ identity, closures, status: "CLOSED_BASELINE_INSTALLED_DISPOSABLE_ONLY", restart: false }, null, 2));
  console.log("TASK56_CLOSED_BASELINE_INSTALLED; no restart; browser may resume");
} finally { await client.end(); }