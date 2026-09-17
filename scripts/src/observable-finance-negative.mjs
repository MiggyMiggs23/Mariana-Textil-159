#!/usr/bin/env node
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRoot = join(workspaceRoot, "artifacts/mariana-textil");
const runner = join(workspaceRoot, "scripts/src/frontend-test-runner.mjs");
const reportsDirectory = join(workspaceRoot, "reports/contract-reliability");

const financeMutants = [
  {
    name: "utility-visible-on-load",
    file: "src/pages/cliente-detail.tsx",
    testFile: "src/client-utility-card.contract.test.ts",
    testName: "client utility starts visually hidden and exposes a touch-friendly toggle",
    find: "const [utilityVisible, setUtilityVisible] = useState(false);",
    replace: "const [utilityVisible, setUtilityVisible] = useState(true);",
    expected: /utility begins obscured on a newly mounted client page/,
  },
  {
    name: "authorization-favor-preview-not-applied",
    file: "src/pages/cobros.tsx",
    testFile: "src/components/cliente-saldo-a-favor.contract.test.ts",
    testName: "cash authorization previews the server-calculated automatic favor application",
    find: 'data-testid="text-authorization-saldo-a-favor-aplicado">{projectedMoney(projection.saldoAFavorAplicadoAutomaticamente)}</dd>',
    replace: 'data-testid="text-authorization-saldo-a-favor-aplicado">{projectedMoney(projection.saldoAFavorRemanente)}</dd>',
    expected: /automatic server preview without a manual favor control/,
  },
  {
    name: "note-partial-badge-erased",
    file: "src/components/cliente-nota-credito.tsx",
    testFile: "src/pages/nota.contract.test.ts",
    testName: "Block 4 functionality in ticket detail",
    find: '<ClienteNotaEstadoBadge estadoNota={estadoNota} id={ticketId} className="scale-125" />',
    replace: '<ClienteNotaEstadoBadge estadoNota="PENDIENTE" id={ticketId} className="scale-125" />',
    expected: /ABONO_PARCIAL keeps its canonical badge label free of currency/,
  },
];

function runCanonical(root, mutant) {
  return spawnSync(
    process.execPath,
    [runner, "--root", root, "--test-name-pattern", mutant.testName, mutant.testFile],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      timeout: 120_000,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" },
    },
  );
}

async function makeClone() {
  const root = await mkdtemp(join(tmpdir(), "finance-observable-clone-"));
  const cloneFrontend = join(root, "artifacts/mariana-textil");
  await mkdir(cloneFrontend, { recursive: true });
  await Promise.all([
    cp(join(frontendRoot, "src"), join(cloneFrontend, "src"), { recursive: true }),
    cp(join(frontendRoot, "package.json"), join(cloneFrontend, "package.json")),
    cp(join(frontendRoot, "tsconfig.json"), join(cloneFrontend, "tsconfig.json")),
    cp(join(frontendRoot, "tsconfig.render-tests.json"), join(cloneFrontend, "tsconfig.render-tests.json")),
    symlink(join(frontendRoot, "node_modules"), join(cloneFrontend, "node_modules")),
    symlink(join(workspaceRoot, "node_modules"), join(root, "node_modules")),
    symlink(join(workspaceRoot, "lib"), join(root, "lib")),
    symlink(join(workspaceRoot, "tsconfig.base.json"), join(root, "tsconfig.base.json")),
    symlink(join(workspaceRoot, "artifacts/api-server"), join(root, "artifacts/api-server")),
  ]);
  return { root, cloneFrontend };
}

async function proveMutant(mutant) {
  const clone = await makeClone();
  const path = join(clone.cloneFrontend, mutant.file);
  try {
    const original = await readFile(path, "utf8");
    assert.equal(original.includes(mutant.find), true, `${mutant.name}: mutation anchor exists`);
    await writeFile(path, original.replace(mutant.find, mutant.replace), "utf8");

    const red = runCanonical(clone.root, mutant);
    const redOutput = `${red.stdout}\n${red.stderr}`;
    await writeFile(join(reportsDirectory, `GROUP-finance-red-${mutant.name}.txt`), redOutput);
    assert.equal(red.status, 1, `${mutant.name}: semantic mutant exits 1`);
    assert.match(redOutput, /AssertionError \[ERR_ASSERTION\]/, `${mutant.name}: failure is an assertion`);
    assert.match(redOutput, mutant.expected, `${mutant.name}: failure names the broken observable contract`);
    assert.doesNotMatch(
      redOutput,
      /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Build failed|Timed out waiting|test infrastructure/i,
      `${mutant.name}: red proof is not infrastructure`,
    );

    await writeFile(path, original, "utf8");
    const green = runCanonical(clone.root, mutant);
    const greenOutput = `${green.stdout}\n${green.stderr}`;
    await writeFile(join(reportsDirectory, `GROUP-finance-restored-${mutant.name}.txt`), greenOutput);
    assert.equal(green.status, 0, `${mutant.name}: original behavior restores green`);
    return {
      name: mutant.name,
      testFile: mutant.testFile,
      oldTestName: mutant.name === "authorization-favor-preview-not-applied"
        ? "cash authorization offers favor without selecting it automatically"
        : mutant.testName,
      newTestName: mutant.testName,
      redExitCode: red.status,
      restoredExitCode: green.status,
      assertion: redOutput.match(/AssertionError \[ERR_ASSERTION\]: ([^\n]+)/)?.[1] ?? null,
    };
  } finally {
    await rm(clone.root, { recursive: true, force: true });
  }
}

await mkdir(reportsDirectory, { recursive: true });
const results = [];
for (const mutant of financeMutants) {
  results.push(await proveMutant(mutant));
}
await writeFile(
  join(reportsDirectory, "GROUP-finance-observable-negative.json"),
  `${JSON.stringify({
    generatedBy: "scripts/src/observable-finance-negative.mjs",
    runner: "scripts/src/frontend-test-runner.mjs --root <isolated clone> --test-name-pattern <name> <file>",
    fixtures: "In-memory endpoint payloads parsed by their exported response schemas before each real component/page mount.",
    mutants: results,
  }, null, 2)}\n`,
);
console.log(JSON.stringify(results));