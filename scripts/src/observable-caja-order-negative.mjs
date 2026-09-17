import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRoot = join(workspaceRoot, "artifacts/mariana-textil");
const reportsRoot = join(workspaceRoot, "reports/contract-reliability");
const runner = join(workspaceRoot, "scripts/src/frontend-test-runner.mjs");
const testFile = "src/pages/caja/tiempo-real.contract.test.ts";
const testName = "renders principal row and secondary attention row in exact order";

function run(root) {
  const result = spawnSync(
    process.execPath,
    [runner, "--root", root, "--file", testFile, "--test-name-pattern", testName],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      timeout: 120_000,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" },
    },
  );
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

async function cloneWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "observable-caja-order-"));
  const cloneFrontend = join(root, "artifacts/mariana-textil");
  await mkdir(cloneFrontend, { recursive: true });
  await Promise.all([
    cp(join(frontendRoot, "src"), join(cloneFrontend, "src"), { recursive: true }),
    cp(join(frontendRoot, "package.json"), join(cloneFrontend, "package.json")),
    cp(join(frontendRoot, "tsconfig.json"), join(cloneFrontend, "tsconfig.json")),
    cp(
      join(frontendRoot, "tsconfig.render-tests.json"),
      join(cloneFrontend, "tsconfig.render-tests.json"),
    ),
    symlink(join(workspaceRoot, "node_modules"), join(root, "node_modules")),
    symlink(join(frontendRoot, "node_modules"), join(cloneFrontend, "node_modules")),
    symlink(join(workspaceRoot, "lib"), join(root, "lib")),
    symlink(join(workspaceRoot, "artifacts/api-server"), join(root, "artifacts/api-server")),
    symlink(join(workspaceRoot, "tsconfig.base.json"), join(root, "tsconfig.base.json")),
  ]);
  return { root, cloneFrontend };
}

function swapSalesAndSignals(source) {
  const rows = /(?<sales>              <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">[\s\S]*?^              <\/div>\n\n)(?<signals>              <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">[\s\S]*?^              <\/div>\n)/m;
  const match = rows.exec(source);
  assert.ok(match?.groups, "sales and operational-signal row mutation anchors must exist");
  return source.replace(rows, `${match.groups.signals}\n${match.groups.sales.trimEnd()}\n`);
}

await mkdir(reportsRoot, { recursive: true });
const isolated = await cloneWorkspace();
try {
  const pagePath = join(isolated.cloneFrontend, "src/pages/caja/tiempo-real.tsx");
  const original = await readFile(pagePath, "utf8");
  const mutated = swapSalesAndSignals(original);
  assert.notEqual(mutated, original, "the isolated production page copy must be mutated");
  await writeFile(pagePath, mutated, "utf8");

  const red = run(isolated.root);
  await writeFile(join(reportsRoot, "caja-order-negative-red.txt"), red.output, "utf8");
  assert.equal(red.status, 1, "the swapped row geometry must exit 1");
  assert.match(red.output, /AssertionError \[ERR_ASSERTION\]/);
  assert.match(
    red.output,
    /principal sales block must precede operational signals block/,
    "the mutation must fail the semantic geometry assertion",
  );
  assert.doesNotMatch(
    red.output,
    /Timed out|ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Build failed|Expected a mounted layout block/i,
    "the mutation must not fail due to setup, build, mounting, or timeout",
  );

  await writeFile(pagePath, original, "utf8");
  assert.equal(await readFile(pagePath, "utf8"), original, "the same clone must be restored exactly");
  const restored = run(isolated.root);
  await writeFile(join(reportsRoot, "caja-order-negative-restored.txt"), restored.output, "utf8");
  assert.equal(restored.status, 0, "the restored clone must return green");

  await writeFile(
    join(reportsRoot, "caja-order-negative-summary.json"),
    `${JSON.stringify({
      generatedBy: "scripts/src/observable-caja-order-negative.mjs",
      productionWorkspaceChanged: false,
      isolatedMutation: "Swapped the complete principal sales row with the complete operational-signals row.",
      testFile,
      testName,
      viewports: [1280, 390, 402],
      redExitCode: red.status,
      restoredExitCode: restored.status,
      semanticFailure: "principal sales block must precede operational signals block",
    }, null, 2)}\n`,
    "utf8",
  );
} finally {
  await rm(isolated.root, { recursive: true, force: true });
}