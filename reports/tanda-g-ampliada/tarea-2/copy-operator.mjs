// MAIN only: narrow, fixed-destination DDL. No environment URL is consulted.
import fs from "node:fs";
import assert from "node:assert/strict";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const action = process.argv[2];
assert.ok(["add", "drop"].includes(action), "Use add or drop");
assert.equal(process.env.MAIN_COPY_OPERATOR, "yes");
const directory = process.cwd() + "/.local/tanda-g-ampliada/cluster";
const client = new pg.Client({ host: "127.0.0.1", port: 55442, user: "postgres", database: "tanda_ga_inventory", connectionTimeoutMillis: 8000 });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'");
  const identity = (await client.query("select current_database() db,current_setting('data_directory') dir,inet_server_port() port,current_user actor")).rows[0];
  assert.equal(identity.db, "tanda_ga_inventory"); assert.equal(identity.dir, directory); assert.equal(identity.port, 55442); assert.equal(identity.actor, "postgres");
  const name = "tanda_ga_t2_physical_nonnegative";
  const before = (await client.query("select conname,pg_get_constraintdef(oid) definition,convalidated from pg_constraint where conrelid='rollos'::regclass and conname=$1", [name])).rows;
  if (action === "add") {
    assert.equal(before.length, 0);
    await client.query(`ALTER TABLE rollos ADD CONSTRAINT ${name} CHECK(cantidad_actual >= 0)`);
  } else {
    assert.equal(before.length, 1);
    assert.match(before[0].definition, /cantidad_actual >=/);
    await client.query(`ALTER TABLE rollos DROP CONSTRAINT ${name}`);
  }
  await client.query("COMMIT");
  fs.writeFileSync(`reports/tanda-g-ampliada/tarea-2/operator-${action}.json`, JSON.stringify({ action, identity, before, at: new Date().toISOString() }, null, 2));
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { await client.end(); }