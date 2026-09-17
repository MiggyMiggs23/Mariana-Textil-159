import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const frontend = join(workspace, "artifacts/mariana-textil");
const runner = join(workspace, "scripts/src/frontend-test-runner.mjs");
const reports = join(workspace, "reports/contract-reliability");
const cases = [
  ["cobros-facturado-rojo", "src/pages/cobros-payment-methods.contract.test.ts", "invoiced sales are emphasized without changing the normal document label", "src/pages/cobros.tsx", 'className="text-2xl font-bold text-red-600"', 'className="text-2xl font-bold text-blue-600"', "the invoiced sale is visibly red"],
  ["kardex-ruta-resuelta", "src/pages/inventory-reference-links.contract.test.ts", "kardex document cells keep desktop and mobile resolved-route branches", "src/components/movimiento-documento-link.tsx", "href={movimiento.documentoRuta}", 'href="/entradas/818/documento"', "desktop opens the API-resolved document route"],
  ["proveedor-utilidad-margen", "src/utilidad-nomenclature.contract.test.ts", "monetary profit labels use Utilidad while percentages remain Margen", "src/pages/proveedor-detail.tsx", '<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margen</p>', '<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Utilidad</p>', "supplier metric labels distinguish monetary utility from percentage margin"],
];
function run(root, file, name) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [runner, "--root", root, "--file", file, "--test-name-pattern", name], {
      cwd: workspace, env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test" }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolveRun({ code: code ?? 1, output }));
  });
}
async function clone() {
  const root = await mkdtemp(join(tmpdir(), "observable-identity-clone-"));
  const app = join(root, "artifacts/mariana-textil");
  await mkdir(app, { recursive: true });
  await Promise.all([
    cp(join(frontend, "src"), join(app, "src"), { recursive: true }),
    cp(join(frontend, "test-fixtures"), join(app, "test-fixtures"), { recursive: true }),
    cp(join(frontend, "package.json"), join(app, "package.json")),
    cp(join(frontend, "tsconfig.json"), join(app, "tsconfig.json")),
    cp(join(frontend, "tsconfig.render-tests.json"), join(app, "tsconfig.render-tests.json")),
    symlink(join(frontend, "node_modules"), join(app, "node_modules")),
    symlink(join(workspace, "node_modules"), join(root, "node_modules")),
    symlink(join(workspace, "lib"), join(root, "lib")),
    symlink(join(workspace, "artifacts/api-server"), join(root, "artifacts/api-server")),
    symlink(join(workspace, "tsconfig.base.json"), join(root, "tsconfig.base.json")),
  ]);
  return { root, app };
}
await mkdir(reports, { recursive: true });
const results = [];
for (const [id, file, name, source, before, after, assertion] of cases) {
  const { root, app } = await clone();
  const target = join(app, source);
  try {
    const original = await readFile(target, "utf8");
    assert.ok(original.includes(before), `${id}: semantic mutation anchor exists`);
    await writeFile(target, original.replace(before, after), "utf8");
    const red = await run(root, file, name);
    await writeFile(join(reports, `identity-${id}-red.log`), red.output, "utf8");
    assert.equal(red.code, 1, `${id}: defect must fail`);
    assert.match(red.output, /AssertionError \[ERR_ASSERTION\]/, `${id}: red result is an assertion`);
    assert.match(red.output, new RegExp(assertion), `${id}: assertion belongs to this observable behavior`);
    assert.doesNotMatch(red.output, /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|tsconfig.*does not exist/i, `${id}: not infrastructure`);
    await writeFile(target, original, "utf8");
    const restored = await run(root, file, name);
    await writeFile(join(reports, `identity-${id}-restored.log`), restored.output, "utf8");
    assert.equal(restored.code, 0, `${id}: restored source must pass`);
    results.push({ id, redExit: red.code, restoredExit: restored.code, name });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
await writeFile(join(reports, "identity-observable-negative-summary.json"), `${JSON.stringify({ script: "scripts/src/observable-identity-negative.mjs", testCount: cases.length, renamedTests: [], results }, null, 2)}\n`);