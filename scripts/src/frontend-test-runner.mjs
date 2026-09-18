#!/usr/bin/env node
import { access, readFile, realpath, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsRequire = createRequire(join(scriptRoot, "scripts/package.json"));
const usage = `Usage:
  node scripts/src/frontend-test-runner.mjs [options] [test-file ...]

Runs frontend Node tests with the app-local automatic-JSX tsconfig.

Options:
  --root <workspace-root>       Workspace root (default: inferred from this script)
  --app-root <frontend-root>    Frontend package root (default: <root>/artifacts/mariana-textil)
  --manifest <file>             Explicit manifest (default: <app-root>/test-manifests/safe.txt)
  --file <test-file>            Run one file; may be repeated
  --test-name-pattern <pattern> Pass Node's test-name filter through to tsx
  --offline-preload <file>      Absolute, verified CommonJS preload for the child
  -h, --help                    Show this help

With no test files, the safe manifest is required, non-empty, and every listed
file must exist. Manifest entries are relative to --app-root (or absolute).
When --app-root targets a clone, its own tsconfig.render-tests.json is used.`;

function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function resolveFrom(cwd, candidate) {
  return isAbsolute(candidate) ? candidate : resolve(cwd, candidate);
}

async function requireFile(file, description) {
  try {
    await access(file, constants.R_OK);
    if (!(await stat(file)).isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new Error(`${description} does not exist or is not readable: ${file}`);
  }
}

async function testFilesFromManifest(manifestPath, appRoot) {
  await requireFile(manifestPath, "Test manifest");
  const entries = (await readFile(manifestPath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!entries.length) {
    throw new Error(`Test manifest is empty: ${manifestPath}`);
  }

  const files = entries.map((entry) => resolveFrom(appRoot, entry));
  await Promise.all(files.map((file) => requireFile(file, "Manifest test file")));
  return files;
}

async function main() {
  const argv = process.argv.slice(2);
  const cwd = process.cwd();
  const options = { files: [], root: scriptRoot };
  const positionalFiles = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      positionalFiles.push(...argv.slice(index + 1));
      break;
    }
    if (argument === "-h" || argument === "--help") {
      console.log(usage);
      return;
    }
    if (argument.startsWith("--root=")) {
      options.root = resolveFrom(cwd, argument.slice("--root=".length));
    } else if (argument === "--root") {
      options.root = resolveFrom(cwd, optionValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--app-root=")) {
      options.appRoot = resolveFrom(cwd, argument.slice("--app-root=".length));
    } else if (argument === "--app-root") {
      options.appRoot = resolveFrom(cwd, optionValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--manifest=")) {
      options.manifest = resolveFrom(cwd, argument.slice("--manifest=".length));
    } else if (argument === "--manifest") {
      options.manifest = resolveFrom(cwd, optionValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--file=")) {
      options.files.push(argument.slice("--file=".length));
    } else if (argument === "--file") {
      options.files.push(optionValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--test-name-pattern=")) {
      options.testNamePattern = argument.slice("--test-name-pattern=".length);
    } else if (argument === "--test-name-pattern") {
      options.testNamePattern = optionValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--offline-preload=")) {
      options.offlinePreload = argument.slice("--offline-preload=".length);
    } else if (argument === "--offline-preload") {
      options.offlinePreload = optionValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positionalFiles.push(argument);
    }
  }

  const appRoot = options.appRoot ?? join(options.root, "artifacts/mariana-textil");
  const tsconfigPath = join(appRoot, "tsconfig.render-tests.json");
  const tsxLoader = scriptsRequire.resolve("tsx");
  await Promise.all([
    requireFile(tsconfigPath, "Automatic-JSX tsconfig"),
    requireFile(tsxLoader, "tsx loader"),
  ]);
  const canonicalPreload = await realpath(
    join(scriptRoot, "scripts/src/offline-test-guard.cjs"),
  );
  let offlinePreload = canonicalPreload;
  if (options.offlinePreload !== undefined) {
    if (!isAbsolute(options.offlinePreload)) {
      throw new Error("--offline-preload must be an absolute path");
    }
    await requireFile(options.offlinePreload, "Offline preload");
    offlinePreload = await realpath(options.offlinePreload);
    if (offlinePreload !== canonicalPreload) {
      throw new Error(`--offline-preload must resolve to ${canonicalPreload}`);
    }
  }

  const selected = [...options.files, ...positionalFiles];
  const files = selected.length
    ? selected.map((file) => resolveFrom(appRoot, file))
    : await testFilesFromManifest(
      options.manifest ?? join(appRoot, "test-manifests/safe.txt"),
      appRoot,
    );
  if (!files.length) throw new Error("No test files were selected");
  await Promise.all(files.map((file) => requireFile(file, "Selected test file")));

  const tsxArguments = [
    "--require",
    offlinePreload,
    "--import",
    tsxLoader,
    "--test",
    // Browser-backed contracts must not start one Chromium per CPU at once.
    "--test-concurrency=2",
    ...(options.testNamePattern === undefined
      ? []
      : [`--test-name-pattern=${options.testNamePattern}`]),
    ...files,
  ];
  console.error(
    `[frontend-test-runner] ${files.length} file(s); tsconfig=${tsconfigPath}`,
  );
  const result = spawnSync(process.execPath, tsxArguments, {
    cwd: appRoot,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      NODE_ENV: "test",
      E1_OFFLINE_STATIC_FIXTURE: "1",
      TSX_TSCONFIG_PATH: tsconfigPath,
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(`[frontend-test-runner] ${error.message}`);
  process.exitCode = 2;
});