// Run with tsx: paired.mjs pre, then operator COPY DDL, then paired.mjs post.
// No DDL, login, or business mutations. Three bounded samples per workload.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const root = process.cwd(), out = root + "/reports/tanda-h/tarea-2";
const phase = process.argv[2];
if (!["pre", "post"].includes(phase)) throw Error("Expected pre or post");
if (fs.existsSync(`${out}/${phase}.json`)) throw Error("Refusing to overwrite paired evidence");
const cfg = JSON.parse(fs.readFileSync(root + "/.local/tanda-h/worker-databases.json")).performance;
const fixture = JSON.parse(fs.readFileSync(root + "/reports/tanda-h/setup/fixture-manifest-redacted.json"));
const source = root; // current source, not the obsolete G frozen source
process.env.NODE_ENV = "test";
process.env.REQUIRE_ISOLATED_TEST_DATABASE = "1";
process.env.TEST_DATABASE_URL = cfg.url;
process.env.DATABASE_URL = "postgresql://postgres@127.0.0.1:55444/tanda_h_witness";
process.env.APPLICATION_DATABASE_URL = process.env.DATABASE_URL;
const { pool, db } = await import(pathToFileURL(source + "/lib/db/src/index.ts").href);
const canonical = value => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
};
const hash = value => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const original = pool.query.bind(pool);
let current = null;
const queries = [];
try {
  const identity = (await original("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
  if (identity.db !== "tanda_h_performance" || identity.port !== 55444 || identity.actor !== "h_performance") throw Error("COPY isolation mismatch");
  const options = "-c statement_timeout=20000 -c default_transaction_read_only=on";
  // These options apply to every newly opened pool connection, not just one session.
  pool.options.options = options;
  await original("SET statement_timeout='20s'");
  await original("SET default_transaction_read_only=on");
  const dataset = {};
  const tables = (await original("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = (await original(`select row_to_json(t)::text as value from public.${quoted} t order by row_to_json(t)::text collate "C"`)).rows;
    dataset[tablename] = { rows: rows.length, sha256: hash(rows) };
  }
  const indexes = (await original(fs.readFileSync(out + "/preflight.sql", "utf8"))).at(-1).rows;
  const { buildCorteCaja } = await import(pathToFileURL(source + "/artifacts/api-server/src/lib/pos.ts").href);
  const { buildReport } = await import(pathToFileURL(source + "/artifacts/api-server/src/lib/reportes.ts").href);
  pool.query = async function(q, ...args) {
    const text = typeof q === "string" ? q : q.text;
    const values = typeof q === "string" ? (args[0] || []) : (q.values || args[0] || []);
    const start = performance.now();
    try {
      const result = await original(q, ...args);
      queries.push({ workload: current, text, values, ms: performance.now() - start, resultDigest: hash(result.rows), rowCount: result.rowCount });
      return result;
    } catch (e) { queries.push({ workload: current, text, ms: performance.now() - start, error: e.message }); throw e; }
  };
  const results = [];
  for (const [name, fn] of [
    ["cash_cut", () => buildCorteCaja(db, fixture.sessions[0].id)],
    ["credit_report", () => buildReport("clientes", { desde: "2025-09-24", hasta: "2026-09-23" }, fixture.sites.slice(0, 3).map(s => s.id), true)],
  ]) {
    current = name;
    for (let sample = 0; sample < 3; sample++) {
      const start = performance.now();
      const value = await fn();
      const elapsedMs = performance.now() - start;
      // generatedAt is response metadata only. No balances, order or metrics removed.
      const semantic = name === "credit_report" ? (({ generatedAt, ...rest }) => rest)(value) : value;
      results.push({ name, sample, elapsedMs, semanticDigest: hash(semantic) });
    }
  }
  pool.query = original;
  const plans = [];
  for (const q of new Map(queries.filter(q => !q.error).map(q => [hash([q.text, q.values]), q])).values()) {
    try { plans.push({ workload: q.workload, text: q.text, plan: (await original("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + q.text, q.values)).rows }); }
    catch (e) { plans.push({ workload: q.workload, text: q.text, error: e.message }); }
  }
  const evidence = { identity, dataset, indexes, results, queries, plans, excludedMetadata: ["credit_report.generatedAt"], samples: 3, coldCacheClaim: false };
  fs.writeFileSync(`${out}/${phase}.json`, JSON.stringify(evidence, null, 2));
  if (phase === "post") {
    const pre = JSON.parse(fs.readFileSync(out + "/pre.json"));
    const datasetEqual = hash(pre.dataset) === hash(dataset);
    const semanticEqual = results.every((r, i) => r.name === pre.results[i]?.name && r.semanticDigest === pre.results[i]?.semanticDigest);
    fs.writeFileSync(out + "/paired-proof.json", JSON.stringify({ datasetEqual, semanticEqual, comparison: "Full public-table row digests; ordered response arrays preserved; response generatedAt alone excluded" }, null, 2));
    if (!datasetEqual || !semanticEqual) throw Error("Paired proof failed; do not authorize live DDL");
  }
} finally { pool.query = original; await pool.end(); }