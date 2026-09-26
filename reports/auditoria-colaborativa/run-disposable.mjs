import { spawn } from "node:child_process";
import { DisposablePostgresRunner } from "../../lib/db/src/run-isolated-tests.mjs";
import { prepareTestDatabase } from "../../lib/db/src/prepare-test-database.mjs";

const environment = { ...process.env };
for (const name of Object.keys(environment)) {
  if (/^PG[A-Z0-9_]*$/i.test(name) || ["DATABASE_URL", "APPLICATION_DATABASE_URL", "TEST_DATABASE_URL"].includes(name)) delete environment[name];
}
const runner = new DisposablePostgresRunner({ parentEnvironment: environment });
try {
  await runner.start();
  await runner.verifyIdentity();
  await prepareTestDatabase({
    environment: runner.childEnvironment(), signal: runner.signal,
    onChild: (child, control) => runner.trackChild(child, control),
  });
  await runner.verifyIdentity();
  const status = await new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", "@workspace/api-server", "exec", "tsx", "--test", "src/lib/auditoria-colaborativa.pg.test.ts"], {
      env: { ...runner.childEnvironment(), NODE_ENV: "test", REQUIRE_ISOLATED_TEST_DATABASE: "1" }, stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (status !== 0) throw new Error(`Collaborative audit tests exited ${status}`);
  await runner.verifyIdentity();
} finally {
  await runner.cleanup();
}