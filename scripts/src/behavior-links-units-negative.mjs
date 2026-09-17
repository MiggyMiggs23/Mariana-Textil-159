import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const frontend = join(root, "artifacts/mariana-textil");
const reports = join(root, "reports/behavior-contracts");
const safeEnvironment = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" };

function run(app, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn("pnpm", ["--dir", app, "exec", "tsx", "--test", ...args], {
      cwd: root,
      env: safeEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolveRun({ code, output }));
  });
}

async function isolatedCopy() {
  const temporary = await mkdtemp(join(tmpdir(), "behavior-links-units-negative-"));
  const copiedFrontend = join(temporary, "artifacts/mariana-textil");
  const copiedApi = join(temporary, "artifacts/api-server");
  await Promise.all([
    mkdir(copiedFrontend, { recursive: true }),
    mkdir(join(temporary, "lib/api-client-react/src/generated"), { recursive: true }),
  ]);
  await Promise.all([
    cp(join(frontend, "src"), join(copiedFrontend, "src"), { recursive: true }),
    cp(join(frontend, "package.json"), join(copiedFrontend, "package.json")),
    cp(join(frontend, "tsconfig.json"), join(copiedFrontend, "tsconfig.json")),
    cp(
      join(root, "lib/api-client-react/src/generated/api.schemas.ts"),
      join(temporary, "lib/api-client-react/src/generated/api.schemas.ts"),
      { recursive: true },
    ),
    mkdir(copiedApi, { recursive: true }),
  ]);
  await Promise.all([
    cp(join(root, "artifacts/api-server/package.json"), join(copiedApi, "package.json")),
    symlink(join(frontend, "node_modules"), join(copiedFrontend, "node_modules")),
    symlink(join(root, "artifacts/api-server/node_modules"), join(copiedApi, "node_modules")),
  ]);
  return { temporary, copiedFrontend };
}

async function negativeCase(name, testName, testFile, sourceFile, mutate, failureText) {
  const { temporary, copiedFrontend } = await isolatedCopy();
  try {
    const sourcePath = join(copiedFrontend, "src/pages", sourceFile);
    const original = await readFile(sourcePath, "utf8");
    const changed = mutate(original);
    assert.notEqual(changed, original, `${name} mutation must change the copied source`);
    await writeFile(sourcePath, changed);
    // Use the watched workspace only for pnpm's executable resolution. The test
    // entry, helper, page sources, generated enum, and bundles are all in /tmp.
    const result = await run(frontend, [
      `--test-name-pattern=${testName}`,
      join(copiedFrontend, "src/pages", testFile),
    ]);
    await writeFile(join(reports, `links-units-red-${name}.txt`), result.output);
    assert.equal(result.code, 1, `${name} must exit with a test failure`);
    assert.match(result.output, /AssertionError \[ERR_ASSERTION\]/, `${name} must fail an assertion`);
    assert.ok(result.output.includes(failureText), `${name} failed outside its semantic assertion`);
    await writeFile(sourcePath, original);
    const restored = await run(frontend, [
      `--test-name-pattern=${testName}`,
      join(copiedFrontend, "src/pages", testFile),
    ]);
    await writeFile(join(reports, `links-units-restored-${name}.txt`), restored.output);
    assert.equal(restored.code, 0, `${name} must pass after removing the defect`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

await mkdir(reports, { recursive: true });
await rm(join(reports, "links-units-red-missing-piece-unit.txt"), { force: true });
const green = await run(frontend, [
  "src/pages/detail-link-tables.contract.test.ts",
  "src/pages/productos.contract.test.ts",
]);
await writeFile(join(reports, "links-units-green.txt"), green.output);
assert.equal(green.code, 0, "focused behavior contracts must pass before mutation proof");

await negativeCase(
  "wrong-product-destination",
  "detail-capable table identifiers resolve their controlled primary keys",
  "detail-link-tables.contract.test.ts",
  "productos.tsx",
  (source) => source.replace("href={`/productos/${p.id}`}", "href={`/productos/${p.sku}`}"),
  "/productos/701",
);
await negativeCase(
  "missing-bag-unit",
  "catálogo agrupado conserva unidad, especificaciones y totales separados",
  "productos.contract.test.ts",
  "productos.tsx",
  (source) => source.replace(
    "Object.values(UnidadProducto).map((unidad) => (",
    "Object.values(UnidadProducto).filter((unidad) => unidad !== UnidadProducto.BOLSA).map((unidad) => (",
  ),
  "all four units are offered by the unit filter",
);