import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRoot = join(workspaceRoot, "artifacts/mariana-textil");
const reportsDirectory = join(workspaceRoot, "reports/behavior-contracts");

const mutants = [
  {
    name: "mobile-row-status-data",
    file: "src/pages/salidas.tsx",
    find: "estado={salida.estado} modalidad={salida.modalidad}",
    replace: 'estado={window.innerWidth < 700 ? "CANCELADA" : salida.estado} modalidad={salida.modalidad}',
    testFile: "src/pages/salidas-status.contract.test.ts",
    expectedFailure: /mobile renders the production badge label for every status representative/,
  },
  {
    name: "mobile-alternate-status-with-hidden-desktop-badge",
    file: "src/pages/salidas.tsx",
    find: '<SalidaEstadoBadge estado={salida.estado} modalidad={salida.modalidad} documentoVenta={salida.documentoVenta} autorizada={salida.autorizada} className="max-w-full whitespace-normal justify-center px-2 py-1 text-center text-xs sm:text-sm !font-bold leading-tight" />',
    replace: '{window.innerWidth < 700 ? <><span hidden><SalidaEstadoBadge estado={salida.estado} modalidad={salida.modalidad} documentoVenta={salida.documentoVenta} autorizada={salida.autorizada} className="max-w-full whitespace-normal justify-center px-2 py-1 text-center text-xs sm:text-sm !font-bold leading-tight" /></span><span>Cancelada</span></> : <SalidaEstadoBadge estado={salida.estado} modalidad={salida.modalidad} documentoVenta={salida.documentoVenta} autorizada={salida.autorizada} className="max-w-full whitespace-normal justify-center px-2 py-1 text-center text-xs sm:text-sm !font-bold leading-tight" />}',
    testFile: "src/pages/salidas-status.contract.test.ts",
    expectedFailure: /mobile has no Cancelada label outside an observed real badge/,
  },
  {
    name: "allow-delivered-cancellation",
    file: "src/lib/salida-cancelacion.ts",
    find: 'salida.estado !== "ENTREGADA" &&',
    replace: "true &&",
    testFile: "src/pages/salidas-venta-errors.contract.test.ts",
    expectedFailure: /ENTREGADA is closed for VENTA_CLIENTE\/ADMIN/,
  },
];
// A sales-derived label is also an alternate presentation, not just one of
// the five raw lifecycle labels.
mutants.splice(2, 0, {
  ...mutants[1],
  name: "mobile-alternate-sales-status-with-hidden-desktop-badge",
  replace: mutants[1].replace.replace("<span>Cancelada</span>", "<span>Por autorizar</span>"),
  expectedFailure: /mobile has no Por autorizar label outside an observed real badge/,
});

function runCommand(cwd, testFiles) {
  return spawnSync(
    join(frontendRoot, "node_modules/.bin/tsx"),
    ["--test", ...testFiles],
    {
      cwd, encoding: "utf8", timeout: 120000,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" },
    },
  );
}

async function runMutant(mutant) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "status-cancel-mutant-"));
  const cloneRoot = join(temporaryRoot, "artifacts/mariana-textil");
  try {
    await mkdir(cloneRoot, { recursive: true });
    await cp(join(frontendRoot, "src"), join(cloneRoot, "src"), { recursive: true });
    await cp(join(frontendRoot, "package.json"), join(cloneRoot, "package.json"));
    await cp(join(frontendRoot, "tsconfig.json"), join(cloneRoot, "tsconfig.json"));
    await symlink(join(frontendRoot, "node_modules"), join(cloneRoot, "node_modules"));
    await symlink(join(workspaceRoot, "lib"), join(temporaryRoot, "lib"));
    await symlink(join(workspaceRoot, "artifacts/api-server"), join(temporaryRoot, "artifacts/api-server"));
    await symlink(join(workspaceRoot, "tsconfig.base.json"), join(temporaryRoot, "tsconfig.base.json"));

    const mutantPath = join(cloneRoot, mutant.file);
    const source = await readFile(mutantPath, "utf8");
    assert.equal(source.includes(mutant.find), true, `${mutant.name} mutation anchor exists`);
    await writeFile(mutantPath, source.replace(mutant.find, mutant.replace), "utf8");

    const result = runCommand(cloneRoot, [mutant.testFile]);
    const output = `${result.stdout}\n${result.stderr}`;
    await writeFile(join(reportsDirectory, `status-cancel-red-${mutant.name}.txt`), output);
    assert.equal(result.status, 1, `${mutant.name} must exit with a test failure`);
    assert.match(output, /AssertionError \[ERR_ASSERTION\]/, `${mutant.name} must be an assertion failure`);
    assert.match(output, mutant.expectedFailure, `${mutant.name} must fail its semantic assertion`);
    assert.doesNotMatch(
      output,
      /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|esbuild.*not found/i,
      `${mutant.name} must fail the assertion, not test infrastructure`,
    );
    // Restore only the isolated copy and prove the same test turns green.
    await writeFile(mutantPath, source, "utf8");
    const restored = runCommand(cloneRoot, [mutant.testFile]);
    await writeFile(
      join(reportsDirectory, `status-cancel-restored-${mutant.name}.txt`),
      `${restored.stdout}\n${restored.stderr}`,
    );
    assert.equal(restored.status, 0, `${mutant.name} must pass after removing the defect`);
    return {
      name: mutant.name, exitCode: result.status, restoredExitCode: restored.status,
      assertionMessage: output.match(/AssertionError \[ERR_ASSERTION\]: ([^\n]+)/)?.[1],
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const baselineTests = [
  "src/pages/salidas-status.contract.test.ts",
  "src/pages/salidas-venta-errors.contract.test.ts",
];
await mkdir(reportsDirectory, { recursive: true });
const baseline = runCommand(frontendRoot, baselineTests);
const baselineOutput = `${baseline.stdout}\n${baseline.stderr}`;
assert.equal(baseline.status, 0, "the unmodified status contract must be green");
assert.match(baselineOutput, /pass 8/, "the baseline ran all eight rewritten-file tests");

const results = [];
for (const mutant of mutants) {
  results.push(await runMutant(mutant));
}

await mkdir(reportsDirectory, { recursive: true });
await writeFile(
  join(reportsDirectory, "status-cancel-green.json"),
  `${JSON.stringify({
    generatedBy: "scripts/src/behavior-status-cancel-negative.mjs",
    command: `tsx --test ${baselineTests.join(" ")}`,
    exitCode: baseline.status,
    passed: true,
    renderMode: "SSR",
    responsiveCoverage: "The same real page flow runs at desktop and phone window widths; every mounted lifecycle label is confined to the observed real badge.",
    limitation: "SSR does not evaluate CSS visibility or layout. Every lifecycle representative, including hidden markup, must use the real badge with the same data; valid repeated representatives are allowed without coupling to CSS classes.",
  }, null, 2)}\n`,
  "utf8",
);
await writeFile(
  join(reportsDirectory, "status-cancel-negative.json"),
  `${JSON.stringify({
    generatedBy: "scripts/src/behavior-status-cancel-negative.mjs",
    mutants: results,
  }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(results.map(({ name, exitCode }) => ({ name, exitCode }))));