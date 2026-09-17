import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRoot = join(workspaceRoot, "artifacts/mariana-textil");
const reportsRoot = join(workspaceRoot, "reports/contract-reliability");
const runner = join(workspaceRoot, "scripts/src/frontend-test-runner.mjs");
const breakdownTest = "src/pages/caja/tiempo-real-breakdown.contract.test.ts";

function runClone(root, pattern, file) {
  const result = spawnSync(
    process.execPath,
    [runner, "--root", root, "--test-name-pattern", pattern, "--file", file],
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
  const root = await mkdtemp(join(tmpdir(), "observable-caja-negative-"));
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

function assertSemanticRed(result, expectedMessage, name) {
  assert.equal(result.status, 1, `${name} must exit 1`);
  assert.match(result.output, /AssertionError \[ERR_ASSERTION\]/, `${name} must fail an assertion`);
  assert.match(result.output, expectedMessage, `${name} must fail its semantic assertion`);
  assert.doesNotMatch(
    result.output,
    /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Build failed|Cannot read file/i,
    `${name} must not fail due to test infrastructure`,
  );
}

const mutants = [
  {
    name: "wrong-cobrado-detail",
    testName: "realtime cards open the detail that matches their displayed data for click and Enter",
    find: 'onClick={() => openBreakdown("COBRADO")}',
    replace: 'onClick={() => openBreakdown("CREDITO")}',
    expectedMessage: /click preserves the Contado cobrado detail identity/,
  },
];

const orderEvidenceTest = `
  import assert from "node:assert/strict";
  import test from "node:test";
  import { withBrowserFixture } from "./observable-test/browser";
  import { createCajaTiempoRealBrowserFixture } from "./pages/caja/caja-tiempo-real-observable-test-support";

  async function observe() {
    const fixture = await createCajaTiempoRealBrowserFixture();
    try {
      return await withBrowserFixture(fixture.options, async (page) => {
        await page.waitFor("document.querySelectorAll('[role=button]').length === 6 && document.querySelectorAll('a').length >= 4");
        return page.evaluate(\`(() => {
          const signal = Array.from(document.querySelectorAll('[role="button"]'))
            .find((element) => element.textContent?.includes("Ventas pendientes de cobro o autorización"));
          const cobranza = Array.from(document.querySelectorAll("p"))
            .find((element) => element.textContent?.includes("Cobrado en el periodo"));
          if (!(signal instanceof HTMLElement) || !(cobranza instanceof HTMLElement)) {
            return { mounted: false, signalTop: null, cobranzaTop: null };
          }
          return {
            mounted: true,
            signalTop: signal.getBoundingClientRect().top,
            cobranzaTop: cobranza.getBoundingClientRect().top,
          };
        })()\`);
      });
    } finally {
      await fixture.dispose();
    }
  }

  test("documented current Cobranza geometry", async () => {
    const observed = await observe();
    console.log("CAJA_CURRENT_ORDER=" + JSON.stringify(observed));
    assert.equal(observed.mounted, true, "Cobranza and the pending signal mounted");
    assert.ok(observed.signalTop < observed.cobranzaTop, "current UI places Cobranza after the signals");
  });

  test("documented requirement conflict: Cobranza before signals", async () => {
    const observed = await observe();
    assert.equal(observed.mounted, true, "Cobranza and the pending signal mounted");
    assert.ok(observed.cobranzaTop < observed.signalTop, "DOCUMENTED CONFLICT: Cobranza must be before signals");
  });
`;

await mkdir(reportsRoot, { recursive: true });
const baselineClone = await cloneWorkspace();
try {
  const baseline = runClone(
    baselineClone.root,
    "realtime cards open the detail that matches their displayed data for click and Enter",
    breakdownTest,
  );
  await writeFile(join(reportsRoot, "GROUP-caja-breakdown-green.txt"), baseline.output);
  assert.equal(baseline.status, 0, "the rewritten breakdown contract must be green before mutation");
} finally {
  await rm(baselineClone.root, { recursive: true, force: true });
}

const mutationResults = [];
for (const mutant of mutants) {
  const isolated = await cloneWorkspace();
  try {
    const pagePath = join(isolated.cloneFrontend, "src/pages/caja/tiempo-real.tsx");
    const original = await readFile(pagePath, "utf8");
    assert.ok(original.includes(mutant.find), `${mutant.name} mutation anchor exists`);
    await writeFile(pagePath, original.replace(mutant.find, mutant.replace), "utf8");

    const red = runClone(isolated.root, mutant.testName, breakdownTest);
    await writeFile(join(reportsRoot, `GROUP-caja-breakdown-red-${mutant.name}.txt`), red.output);
    assertSemanticRed(red, mutant.expectedMessage, mutant.name);

    await writeFile(pagePath, original, "utf8");
    const restored = runClone(isolated.root, mutant.testName, breakdownTest);
    await writeFile(join(reportsRoot, `GROUP-caja-breakdown-restored-${mutant.name}.txt`), restored.output);
    assert.equal(restored.status, 0, `${mutant.name} must return green after restoration`);
    mutationResults.push({
      name: mutant.name,
      testName: mutant.testName,
      redExitCode: red.status,
      restoredExitCode: restored.status,
    });
  } finally {
    await rm(isolated.root, { recursive: true, force: true });
  }
}

const evidenceClone = await cloneWorkspace();
try {
  const evidenceFile = join(evidenceClone.cloneFrontend, "src/caja-current-order.evidence.test.ts");
  await writeFile(evidenceFile, orderEvidenceTest, "utf8");
  const current = runClone(
    evidenceClone.root,
    "documented current Cobranza geometry",
    "src/caja-current-order.evidence.test.ts",
  );
  await writeFile(join(reportsRoot, "GROUP-caja-current-order-positive.txt"), current.output);
  assert.equal(current.status, 0, "the Chrome observation of the current geometry must complete");

  const conflict = runClone(
    evidenceClone.root,
    "documented requirement conflict: Cobranza before signals",
    "src/caja-current-order.evidence.test.ts",
  );
  await writeFile(join(reportsRoot, "GROUP-caja-current-order-conflict.txt"), conflict.output);
  assert.equal(conflict.status, 1, "the documented conflicting order assertion must fail");
  assert.match(conflict.output, /AssertionError \[ERR_ASSERTION\]/);
  assert.match(conflict.output, /DOCUMENTED CONFLICT: Cobranza must be before signals/);
} finally {
  await rm(evidenceClone.root, { recursive: true, force: true });
}

await writeFile(
  join(reportsRoot, "GROUP-caja-breakdown-summary.json"),
  `${JSON.stringify({
    generatedBy: "scripts/src/observable-caja-negative.mjs",
    rewrittenFile: breakdownTest,
    testCount: 1,
    oldToNew: {
      "realtime cards have fixed order and exactly six cards open their own detail":
        "realtime cards open the detail that matches their displayed data for click and Enter",
    },
    mutants: mutationResults,
    blockedFunctionalCase: {
      unchangedFile: "src/pages/caja/tiempo-real.contract.test.ts",
      requirement: "Cobranza separated before signals",
      observation: "Chrome places the pending signal above the Cobranza band.",
      accreditation: "Not a negative test: this is a documented existing product conflict in an isolated copy.",
    },
  }, null, 2)}\n`,
  "utf8",
);