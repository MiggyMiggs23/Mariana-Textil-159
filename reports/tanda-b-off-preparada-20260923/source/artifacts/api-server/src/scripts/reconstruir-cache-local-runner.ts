import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// @ts-expect-error The disposable runner is an intentionally unbuilt local .mjs helper.
import { DisposablePostgresRunner } from "../../../../lib/db/src/run-isolated-tests.mjs";
// @ts-expect-error The disposable runner is an intentionally unbuilt local .mjs helper.
import { prepareTestDatabase } from "../../../../lib/db/src/prepare-test-database.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const regressionPath =
  "src/lib/inventario-reconstruir-cache.local.integration.test.ts";

function runRegression(environment: Record<string, string>): Promise<number> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@workspace/api-server",
        "exec",
        "tsx",
        "--test",
        regressionPath,
      ],
      {
        cwd: workspaceRoot,
        env: environment,
        stdio: "inherit",
      },
    );
    child.once("error", rejectResult);
    child.once("close", (code) => resolveResult(code ?? 1));
  });
}

const runner = new DisposablePostgresRunner({
  parentEnvironment: process.env,
});
let regressionExitCode = 1;
try {
  await runner.start();
  await runner.verifyIdentity();
  await prepareTestDatabase({
    environment: runner.childEnvironment,
    signal: runner.signal,
    onChild: (child: any, control: any) => runner.trackChild(child, control),
  });
  await runner.verifyIdentity();
  regressionExitCode = await runRegression(runner.childEnvironment);
} finally {
  await runner.cleanup();
}

if (regressionExitCode !== 0) {
  process.exitCode = regressionExitCode;
}