#!/usr/bin/env node
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const application = join(workspace, "artifacts/mariana-textil");
const runner = join(workspace, "scripts/src/frontend-test-runner.mjs");
const reports = join(workspace, "reports/contract-reliability");

function run(root, file, testName) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [
      runner, "--root", root, "--file", file, "--test-name-pattern", testName,
    ], { cwd: workspace, env: process.env });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.once("error", reject);
    child.once("exit", (code) => resolveRun({ code: code ?? 1, output }));
  });
}

async function makeClone() {
  const root = await mkdtemp(join(tmpdir(), "observable-capture-clone-"));
  const cloneApp = join(root, "artifacts/mariana-textil");
  await mkdir(cloneApp, { recursive: true });
  await Promise.all([
    cp(join(application, "src"), join(cloneApp, "src"), { recursive: true }),
    cp(join(application, "package.json"), join(cloneApp, "package.json")),
    cp(join(application, "tsconfig.json"), join(cloneApp, "tsconfig.json")),
    cp(join(application, "tsconfig.render-tests.json"), join(cloneApp, "tsconfig.render-tests.json")),
    symlink(join(application, "node_modules"), join(cloneApp, "node_modules")),
    symlink(join(workspace, "node_modules"), join(root, "node_modules")),
    symlink(join(workspace, "lib"), join(root, "lib")),
    symlink(join(workspace, "tsconfig.base.json"), join(root, "tsconfig.base.json")),
    symlink(join(workspace, "artifacts/api-server"), join(root, "artifacts/api-server")),
  ]);
  return root;
}

const cases = [
  {
    id: "sale-counter",
    file: "src/components/salida-venta-cliente-nueva.contract.test.ts",
    testName: "customer-sale assembly keeps a visible circular roll counter in sync with scans",
    source: "src/components/salida-venta-cliente-nueva.tsx",
    mutate: (source) => source.replace("current.filter((item) => item !== value)", "current"),
  },
  {
    id: "entradas-capture-layout",
    file: "src/pages/entradas-roll-capture.contract.test.ts",
    testName: "reserva espacios separados para cantidad, unidad y cámara en la captura",
    source: "src/pages/entradas.tsx",
    mutate: (source) => source.replace(
      'className="flex h-20 shrink-0 items-center whitespace-nowrap px-2 text-xl font-bold text-muted-foreground" data-testid="capture-qty-unit"',
      'className="absolute right-0 flex h-20 shrink-0 items-center whitespace-nowrap px-2 text-xl font-bold text-muted-foreground" data-testid="capture-qty-unit"',
    ),
  },
];

const report = {
  suite: "observable-capture-negative",
  mapping: {
    "sale-counter": "source-pattern assertions → mounted page scan/add/remove counter behavior",
    "entradas-capture-layout": "source-pattern assertions → mounted capture geometry and shared unit behavior",
  },
  cases: [],
};
const logs = [];
await mkdir(reports, { recursive: true });
try {
  for (const item of cases) {
    const root = await makeClone();
    const target = join(root, "artifacts/mariana-textil", item.source);
    try {
      const original = await readFile(target, "utf8");
      const mutated = item.mutate(original);
      assert.notEqual(mutated, original, `${item.id}: no se pudo introducir el defecto semántico`);
      await writeFile(target, mutated, "utf8");
      const negative = await run(root, item.file, item.testName);
      logs.push(`\n=== ${item.id}: defecto introducido ===\n${negative.output}`);
      assert.equal(negative.code, 1, `${item.id}: el defecto debe dejar el caso rojo`);
      assert.match(negative.output, /AssertionError/, `${item.id}: el rojo debe ser una aserción semántica, no configuración`);
      await writeFile(target, original, "utf8");
      const restored = await run(root, item.file, item.testName);
      logs.push(`\n=== ${item.id}: clon restaurado ===\n${restored.output}`);
      assert.equal(restored.code, 0, `${item.id}: el clon restaurado debe volver a verde`);
      report.cases.push({
        id: item.id, file: item.file, testName: item.testName,
        negativeExit: negative.code, negativeAssertion: true, restoredExit: restored.code,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  await writeFile(join(reports, "capture-observable-negative.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(reports, "capture-observable-negative.log"), logs.join(""));
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  await writeFile(join(reports, "capture-observable-negative.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(reports, "capture-observable-negative.log"), logs.join(""));
  throw error;
}