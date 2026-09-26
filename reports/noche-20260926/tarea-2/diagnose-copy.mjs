import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const env = JSON.parse(fs.readFileSync("/tmp/noche-20260926/test-env.json"));
const url = new URL(env.TEST_DATABASE_URL);
if (url.pathname !== "/noche_20260926") throw Error("Wrong copy");
const c = new pg.Client({ connectionString: url.href });
await c.connect(); await c.query("BEGIN READ ONLY");
const queries = {
  identity: "select current_database() database,current_user actor",
  activity: "select pid,state,wait_event_type,wait_event,extract(epoch from now()-query_start)::int seconds,left(query,150) query from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state<>'idle'",
  counts: "select (select count(*) from tickets) tickets,(select count(*) from movimientos_credito) movements,(select count(*) from clientes where id<>1) nonsystemClients",
};
const result = {};
for (const [name, sql] of Object.entries(queries)) result[name] = (await c.query(sql)).rows;
await c.query("ROLLBACK"); await c.end();
fs.writeFileSync(new URL("./copy-diagnostic.json", import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));