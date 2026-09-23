import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { DisposablePostgresRunner } from "./run-isolated-tests.mjs";
import { prepareTestDatabase } from "./prepare-test-database.mjs";

// The focused runner never inherits an application database target. It keeps
// only the canonical seed credential required by the shared preparation.
const isolatedEnvironment = { ...process.env };
for (const name of Object.keys(isolatedEnvironment)) {
  if (/^PG[A-Z0-9_]*$/i.test(name) ||
      ["DATABASE_URL", "APPLICATION_DATABASE_URL", "TEST_DATABASE_URL"].includes(name)) {
    delete isolatedEnvironment[name];
  }
}
const runner = new DisposablePostgresRunner({ parentEnvironment: isolatedEnvironment });
let root;
let passed = false;
try {
  await runner.start();
  root = runner.cluster.rootDirectory;
  await runner.verifyIdentity();
  await prepareTestDatabase({
    environment: runner.childEnvironment(),
    signal: runner.signal,
    onChild: (child, control) => runner.trackChild(child, control),
  });
  await runner.verifyIdentity();
  const client = new pg.Client({ connectionString: runner.testDatabaseUrl });
  await client.connect();
  try {
    // This is the exact previously prepared/approved E4 SQL, applied only here.
    const sql = readFileSync("reports/tanda-b-b0-b1-20260923/r5/sql/1.sql", "utf8");
    await client.query(sql);
  } finally {
    await client.end();
  }
  const environment = {
    ...runner.childEnvironment(),
    NODE_ENV: "test",
    REQUIRE_ISOLATED_TEST_DATABASE: "1",
  };
  const status = await new Promise((resolve, reject) => {
    const child = spawn("pnpm", [
      "--filter", "@workspace/api-server", "exec", "tsx",
      "src/lib/e4-cash-out.pg.integration.ts",
    ], { env: environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (status !== 0) throw new Error(`E4 disposable suite exited ${status}`);
  await runner.verifyIdentity();
  await runner.smoke();
  passed = true;
} finally {
  await runner.cleanup();
  if (root && existsSync(root)) throw new Error(`Disposable cluster retained: ${root}`);
}
if (!passed) throw new Error("E4 disposable PostgreSQL verification did not pass");
process.stdout.write("E4_DISPOSABLE_CLUSTER_DESTROYED_PASS\n");