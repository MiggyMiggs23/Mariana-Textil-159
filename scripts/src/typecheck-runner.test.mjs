import assert from "node:assert/strict";
import { access, chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LIB_BUILD_ARGS,
  diagnosticKey,
  parseTypeScriptDiagnostics,
  runTypecheck,
} from "./typecheck-runner.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function writeFixturePackage(root, packagePath, name) {
  const absolutePath = resolve(root, packagePath);
  await mkdir(absolutePath, { recursive: true });
  await writeFile(
    join(absolutePath, "package.json"),
    JSON.stringify({
      name,
      private: true,
      scripts: { typecheck: "node fake-typecheck.mjs" },
    }),
  );
  return absolutePath;
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "typecheck-runner-"));
  await mkdir(join(root, "lib"), { recursive: true });
  await writeFixturePackage(root, "lib/first", "@fixture/first");
  await writeFixturePackage(root, "lib/second", "@fixture/second");
  await writeFixturePackage(root, "artifacts/first", "@fixture/artifact-first");
  await writeFixturePackage(root, "artifacts/second", "@fixture/artifact-second");
  await writeFixturePackage(root, "scripts", "@fixture/scripts");
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({
      references: [{ path: "./lib/first" }, { path: "./lib/second" }],
    }),
  );

  const fakeCli = join(root, "fake-cli.mjs");
  await writeFile(
    fakeCli,
    `import { relative } from "node:path";

const args = process.argv.slice(2);
const root = process.env.TYPECHECK_FIXTURE_ROOT;
const packageName = relative(root, process.cwd()).replaceAll("\\\\\\\\", "/");

if (args[0] === "list") {
  if (process.env.TYPECHECK_EMPTY_SELECTION === "1") {
    console.log(JSON.stringify([{ name: "fixture-root", path: root }]));
  } else {
    console.log(JSON.stringify([
      { name: "fixture-root", path: root },
      { name: "@fixture/artifact-first", path: root + "/artifacts/first" },
      { name: "@fixture/artifact-second", path: root + "/artifacts/second" },
      { name: "@fixture/scripts", path: root + "/scripts" }
    ]));
  }
  process.exit(0);
}

if (args.includes("--build")) {
  if (process.env.TYPECHECK_SIGNAL === "1") {
    console.error("lib/first/src/first.ts(2,3): error TS9001: partial library failure");
    process.kill(process.pid, "SIGTERM");
  }
  console.error("lib/first/src/first.ts(2,3): error TS9001: first library failure");
  console.error("lib/second/src/second.ts(4,5): error TS9002: second library failure");
  process.exit(1);
}

if (args[0] === "run" && args[1] === "typecheck") {
  if (packageName === "artifacts/first") {
    console.error("src/first.ts(7,8): error TS9101: first artifact failure");
    process.exit(1);
  }
  if (packageName === "artifacts/second") {
    console.error("../first/src/first.ts(7,8): error TS9101: first artifact failure");
    process.exit(1);
  }
  console.log(packageName + " completed");
  process.exit(0);
}

console.error("unexpected fake command");
process.exit(2);
`,
  );
  await chmod(fakeCli, 0o755);
  return { root, fakeCli };
}

async function writeRealTypecheckPackage(root, packagePath, name, script = null) {
  const packageDirectory = resolve(root, packagePath);
  await mkdir(packageDirectory, { recursive: true });
  const packageJson = { name, private: true };
  if (script) packageJson.scripts = { typecheck: script };
  await writeFile(join(packageDirectory, "package.json"), JSON.stringify(packageJson));
  return packageDirectory;
}

async function makeRealTscFixture() {
  const root = await mkdtemp(join(tmpdir(), "typecheck-real-tsc-"));
  const checkScript = `import { writeFile } from "node:fs/promises";
await writeFile(new URL("./checked.marker", import.meta.url), "checked");
`;

  await writeRealTypecheckPackage(root, "lib/base", "@fixture/base");
  await writeRealTypecheckPackage(root, "lib/child", "@fixture/child");
  await writeRealTypecheckPackage(
    root,
    "artifacts/real-artifact",
    "@fixture/real-artifact",
    "node check.mjs",
  );
  await writeRealTypecheckPackage(
    root,
    "scripts",
    "@fixture/real-scripts",
    "node check.mjs",
  );
  await writeFile(join(root, "pnpm-workspace.yaml"), "packages:\n  - lib/*\n  - artifacts/*\n  - scripts\n");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture-root", private: true }),
  );
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        stopBuildOnErrors: true,
      },
      references: [{ path: "./lib/base" }, { path: "./lib/child" }],
    }),
  );

  for (const packagePath of ["lib/base", "lib/child"]) {
    await mkdir(join(root, packagePath, "src"), { recursive: true });
    await writeFile(
      join(root, packagePath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          composite: true,
          declaration: true,
          outDir: "dist",
          rootDir: "src",
          strict: true,
        },
        include: ["src"],
      }),
    );
  }
  await writeFile(
    join(root, "lib/base/src/index.ts"),
    "export const brokenBase: string = 123;\n",
  );
  await writeFile(
    join(root, "lib/child/src/index.ts"),
    "export const brokenChild: number = 'child';\n",
  );
  await writeFile(join(root, "lib/child/tsconfig.json"), JSON.stringify({
    compilerOptions: {
      composite: true,
      declaration: true,
      outDir: "dist",
      rootDir: "src",
      strict: true,
    },
    references: [{ path: "../base" }],
    include: ["src"],
  }));
  await writeFile(join(root, "artifacts/real-artifact/check.mjs"), checkScript);
  await writeFile(join(root, "scripts/check.mjs"), checkScript);
  return { root, tsc: resolve(repositoryRoot, "node_modules/typescript/bin/tsc") };
}

test("parser normaliza la ubicación y deduplica sólo al contar", () => {
  const parsed = parseTypeScriptDiagnostics(
    [
      "src/example.ts(4,5): error TS2322: Type A is not assignable to type B.",
      "typecheck: src/example.ts(4,5): error TS2322: Type A is not assignable to type B.",
    ].join("\n"),
    { cwd: "/tmp/project", root: "/tmp/project" },
  );

  assert.equal(parsed.parserFailures.length, 0);
  assert.equal(parsed.diagnostics.length, 2);
  assert.equal(diagnosticKey(parsed.diagnostics[0]), diagnosticKey(parsed.diagnostics[1]));
});

test("parser conserva diagnósticos globales sin archivo", () => {
  const parsed = parseTypeScriptDiagnostics(
    "error TS5083: Cannot read file '/tmp/missing.tsconfig.json'.",
  );

  assert.equal(parsed.parserFailures.length, 0);
  assert.equal(parsed.diagnostics.length, 1);
  assert.deepEqual(parsed.diagnostics[0], {
    file: "<global>",
    line: 0,
    column: 0,
    severity: "error",
    code: "TS5083",
    message: "Cannot read file '/tmp/missing.tsconfig.json'.",
  });
});

test("runner continúa después de fallas de libs y paquetes y reporta contextos", async () => {
  const { root, fakeCli } = await makeFixture();
  try {
    const result = await runTypecheck({
      root,
      pnpmCommand: process.execPath,
      pnpmArgs: [fakeCli],
      tscCommand: process.execPath,
      tscArgs: [fakeCli],
      env: {
        ...process.env,
        TYPECHECK_FIXTURE_ROOT: root,
      },
      stream: false,
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /@fixture\/first \[library\] \(1 TypeScript error\)/);
    assert.match(result.summary, /@fixture\/second \[library\] \(1 TypeScript error\)/);
    assert.match(result.summary, /@fixture\/artifact-first \[package\] \(1 TypeScript error\)/);
    assert.match(result.summary, /@fixture\/artifact-second \[package\] \(1 TypeScript error\)/);
    assert.match(result.summary, /@fixture\/scripts \[package\] \(0 TypeScript errors\)/);
    assert.match(result.summary, /artifacts\/first\/src\/first\.ts:7:8 TS9101/);
    assert.equal(
      result.summary.split("artifacts/first/src/first.ts:7:8 TS9101").length - 1,
      2,
    );
    assert.match(result.summary, /Unique TypeScript diagnostics: 3/);
    assert.match(result.summary, /Repeated diagnostic emissions: 1/);
    assert.match(result.summary, /RESULT: FAIL \(all selected checks were attempted\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("tsc real fuerza la continuación de referencias y después comprueba artifacts/scripts", async () => {
  assert.deepEqual(LIB_BUILD_ARGS, [
    "--build",
    "--pretty",
    "false",
    "--stopBuildOnErrors",
    "false",
  ]);
  const { root, tsc } = await makeRealTscFixture();
  try {
    const result = await runTypecheck({
      root,
      tscCommand: tsc,
      stream: false,
    });

    assert.equal(result.exitCode, 1);
    const libraries = result.results.filter((entry) => entry.kind === "library");
    assert.equal(libraries.length, 2);
    assert.ok(libraries.every((entry) => entry.status === "FAIL"));
    assert.match(result.summary, /@fixture\/base \[library\] \(1 TypeScript error\)/);
    assert.match(result.summary, /@fixture\/child \[library\] \(1 TypeScript error\)/);
    assert.match(result.summary, /PASS @fixture\/real-artifact \[package\] \(0 TypeScript errors\)/);
    assert.match(result.summary, /PASS @fixture\/real-scripts \[package\] \(0 TypeScript errors\)/);
    await access(join(root, "artifacts/real-artifact/checked.marker"));
    await access(join(root, "scripts/checked.marker"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("tsc ausente deja libraries UNVERIFIED y conserva código de error", async () => {
  const { root, fakeCli } = await makeFixture();
  try {
    const result = await runTypecheck({
      root,
      pnpmCommand: process.execPath,
      pnpmArgs: [fakeCli],
      tscCommand: join(root, "missing-tsc"),
      env: {
        ...process.env,
        TYPECHECK_FIXTURE_ROOT: root,
      },
      stream: false,
    });

    const libraries = result.results.filter((entry) => entry.kind === "library");
    assert.equal(result.exitCode, 1);
    assert.ok(libraries.length > 0);
    assert.ok(libraries.every((entry) => entry.status === "UNVERIFIED"));
    assert.doesNotMatch(result.summary, /PASS @fixture\/first \[library\]/);
    assert.match(result.summary, /no se pudo iniciar/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("crash de tsc con stderr parcial no acredita libraries", async () => {
  const { root, fakeCli } = await makeFixture();
  try {
    const result = await runTypecheck({
      root,
      pnpmCommand: process.execPath,
      pnpmArgs: [fakeCli],
      tscCommand: process.execPath,
      tscArgs: [fakeCli],
      env: {
        ...process.env,
        TYPECHECK_FIXTURE_ROOT: root,
        TYPECHECK_SIGNAL: "1",
      },
      stream: false,
    });

    const libraries = result.results.filter((entry) => entry.kind === "library");
    assert.equal(result.exitCode, 1);
    assert.ok(libraries.every((entry) => entry.status === "UNVERIFIED"));
    assert.match(result.summary, /señal SIGTERM/);
    assert.match(result.summary, /lib\/first\/src\/first\.ts:2:3 TS9001/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("selección vacía aborta antes de ejecutar tsc", async () => {
  const { root, fakeCli } = await makeFixture();
  try {
    const result = await runTypecheck({
      root,
      pnpmCommand: process.execPath,
      pnpmArgs: [fakeCli],
      tscCommand: process.execPath,
      tscArgs: [fakeCli],
      env: {
        ...process.env,
        TYPECHECK_FIXTURE_ROOT: root,
        TYPECHECK_EMPTY_SELECTION: "1",
      },
      stream: false,
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /ABORTED: No se seleccionaron paquetes/);
    assert.equal(result.results.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("build conserva la barrera && después de typecheck", async () => {
  const packageJson = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts.build, /^pnpm run typecheck && /);
});