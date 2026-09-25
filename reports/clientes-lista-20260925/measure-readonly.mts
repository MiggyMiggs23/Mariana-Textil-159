import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import { writeFile } from "node:fs/promises";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw Error("Missing configured database");
// Imported service's unused default pool must never be selected by this script.
process.env.NODE_ENV = "test";
const { readClientesListado, activityReadQuery } = await import("../../artifacts/api-server/src/lib/clientes-listado");
const client = new pg.Client({connectionString, options:"-c search_path=public,pg_catalog"});
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const results = [];
  for (const query of [{}, {}, {q:"Arvizu"}, {sort:"movementCount",period:"1m"}, {sort:"saldoActual"}]) {
    const started = performance.now();
    const page = await readClientesListado(client,query,true,null);
    results.push({query,ms:Math.round((performance.now()-started)*100)/100,total:page.total,rows:page.items.length,bytes:JSON.stringify(page).length});
  }
  const ids = (await client.query("SELECT id FROM clientes")).rows.map(r=>r.id);
  const probe = activityReadQuery(ids,null,"1m");
  const plan = await client.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+probe.text,probe.values);
  const counts = (await client.query(`SELECT (SELECT count(*) FROM tickets) AS tickets,
    (SELECT count(*) FROM movimientos_credito) AS ledger`)).rows[0];
  await client.query("COMMIT");
  const evidence = {readOnly:true,results,currentActivityRows:counts,
    activityPlan:plan.rows[0]["QUERY PLAN"],applicationWrites:0,
    limitation:"Service SQL+projection timings, not real authenticated browser/network latency."};
  await writeFile("reports/clientes-lista-20260925/performance-readonly.json",JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({readOnly:true,results,currentActivityRows:counts,applicationWrites:0}));
} finally { await client.end(); }