import fs from "node:fs";
import assert from "node:assert/strict";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
assert.equal(process.env.MAIN_READY, "yes");
const c = JSON.parse(fs.readFileSync(".local/tanda-g-ampliada/inventory-handoff.json", "utf8"));
const url = new URL(c.databaseUrl);
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55442"); assert.equal(url.pathname, "/tanda_ga_inventory");
const client = new pg.Client({ connectionString: c.databaseUrl });
await client.connect();
const records = [];
try {
  const identity = (await client.query("select current_database() db,inet_server_port() port,current_user actor")).rows[0];
  assert.equal(identity.db, "tanda_ga_inventory"); assert.equal(identity.actor, "ga_inventory");
  const f = JSON.parse(fs.readFileSync(c.fixtureManifest, "utf8"));
  const row = (await client.query("select id,cantidad_actual from rollos where ubicacion_id=$1 and producto_id=$2 and cantidad_actual=10 order by id limit 1", [f.sites[0].id, f.products[0].id])).rows[0];
  assert.ok(row);
  await client.query("BEGIN");
  for (const value of ["NaN", "Infinity", "-Infinity", "-2", "0", "2"]) {
    await client.query("SAVEPOINT sample");
    const expression = (await client.query("select $1::numeric >= 0 basic_check, ($1::numeric >= 0 AND $1::numeric <> 'NaN'::numeric) proposed_check", [value])).rows[0];
    try {
      const after = (await client.query("update rollos set cantidad_actual=$1 where id=$2 returning cantidad_actual::text actual", [value, row.id])).rows[0];
      records.push({ value, expression, physicalUpdateAccepted: true, after });
    } catch (e) { records.push({ value, expression, physicalUpdateAccepted: false, code: e.code, message: e.message }); }
    await client.query("ROLLBACK TO SAVEPOINT sample");
  }
  await client.query("ROLLBACK");
  const after = (await client.query("select cantidad_actual from rollos where id=$1", [row.id])).rows[0];
  assert.equal(after.cantidad_actual, row.cantidad_actual);
  fs.writeFileSync("reports/tanda-g-ampliada/tarea-2/nonfinite.json", JSON.stringify({ identity, row, after, records, ddlApplied: false }, null, 2));
} finally { await client.end(); }