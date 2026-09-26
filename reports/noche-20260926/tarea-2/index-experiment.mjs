import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const url = new URL(JSON.parse(fs.readFileSync("/tmp/noche-20260926/test-env.json")).TEST_DATABASE_URL);
if (url.pathname !== "/noche_20260926" || !url.hostname.endsWith(".neon.tech")) throw Error("Copy-only guard");
const c = new pg.Client({ connectionString: url.href }); await c.connect();
if ((await c.query("SELECT current_database() db")).rows[0].db !== "noche_20260926") throw Error("Effective identity failed");
const sql = `SELECT COUNT(*)::int tickets,COALESCE(SUM(x.ventas),0) ventas,
 CASE WHEN COUNT(*) FILTER (WHERE x.pendientes>0)>0 THEN NULL ELSE COALESCE(SUM(x.utilidad),0) END utilidad
 FROM tickets t LEFT JOIN LATERAL (
 SELECT COALESCE(SUM(l.importe),0) ventas,SUM(l.importe-l.costo_total_congelado) utilidad,
 COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL) pendientes
 FROM ticket_lineas l WHERE l.ticket_id=t.id) x ON true
 WHERE t.estado='VENDIDO' AND ((t.documento_tipo='TICKET' AND t.cobrado=true)
 OR(t.documento_tipo='NOTA' AND t.autorizacion_estado='AUTORIZADA'))
 AND CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END >= $1
 AND CASE WHEN t.documento_tipo='TICKET' THEN t.cobrado_at ELSE t.autorizado_at END < $2`;
const plan = async () => (await c.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) " + sql,
  ["2025-09-27T06:00:00Z", "2026-09-27T06:00:00Z"])).rows[0]["QUERY PLAN"];
const result = { database: "noche_20260926", reason: "Annual credit browser 11.68–12.36 seconds; report API ~2 seconds; test covering line aggregate, not a claim that SQL accounts for all render time.",
  query: sql, before: await plan(), ddl: null };
fs.writeFileSync(new URL("./index-experiment.json", import.meta.url), JSON.stringify(result, null, 2));
if (process.argv[2] !== "--apply-copy-only") { await c.end(); process.exit(0); }
// Additive index only. Existing indexes remain untouched; no graph or producer changes.
result.ddl = "CREATE INDEX noche_perf_ticket_lineas_cover ON public.ticket_lineas(ticket_id) INCLUDE(importe,costo_total_congelado,tipo)";
await c.query(result.ddl);
await c.query("ANALYZE public.ticket_lineas");
result.after = await plan();
result.catalog = (await c.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='noche_perf_ticket_lineas_cover'")).rows;
fs.writeFileSync(new URL("./index-experiment.json", import.meta.url), JSON.stringify(result, null, 2));
await c.end();
console.log(JSON.stringify({ beforeMs: result.before[0]["Execution Time"], afterMs: result.after?.[0]["Execution Time"], ddl: result.ddl }));