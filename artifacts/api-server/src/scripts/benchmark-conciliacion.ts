/**
 * Read-only reconciliation benchmark.
 *
 * Run only against an explicitly isolated, representative seeded test catalog:
 *   pnpm run benchmark:conciliacion
 */
import { performance } from "node:perf_hooks";
import { pool } from "@workspace/db";
import { conciliarTodo } from "../lib/inventario";

if (
  process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" ||
  !process.env.TEST_DATABASE_URL
) {
  throw new Error(
    "benchmark:conciliacion requires REQUIRE_ISOLATED_TEST_DATABASE=1 and an explicit TEST_DATABASE_URL.",
  );
}

const originalQuery = pool.query.bind(pool);
let queryCount = 0;
pool.query = ((...args: Parameters<typeof pool.query>) => {
  queryCount += 1;
  return originalQuery(...args);
}) as typeof pool.query;

try {
  const startedAt = performance.now();
  const rows = await conciliarTodo();
  const durationMs = performance.now() - startedAt;
  const discrepancies = rows.filter((row) => row.discrepancia).length;

  process.stdout.write(
    `${JSON.stringify({
      benchmark: "conciliarTodo",
      catalogPairs: rows.length,
      discrepancies,
      durationMs: Number(durationMs.toFixed(2)),
      queryCount,
      reportOnly: true,
    })}\n`,
  );
} finally {
  pool.query = originalQuery as typeof pool.query;
  await pool.end();
}