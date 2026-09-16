import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  diagnosticKey,
  formatDiagnostic,
  parseTypeScriptDiagnostics,
} from "./typecheck-diagnostics.mjs";

export { diagnosticKey, parseTypeScriptDiagnostics } from "./typecheck-diagnostics.mjs";

const RUNNER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const LIB_BUILD_ARGS = Object.freeze([
  "--build",
  "--pretty",
  "false",
  "--stopBuildOnErrors",
  "false",
]);

function packageRelativePath(packagePath, root) {
  return relative(root, packagePath).replaceAll(sep, "/");
}

function isSelectedPackagePath(packagePath, root) {
  const packageRelative = packageRelativePath(packagePath, root);
  return (
    packageRelative === "scripts" ||
    packageRelative.startsWith("scripts/") ||
    packageRelative.startsWith("artifacts/")
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseJsonArray(output) {
  const text = String(output ?? "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("pnpm list no devolvió un JSON de paquetes");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function defaultEnvironment() {
  return { ...process.env };
}

function spawnAndCapture(
  command,
  args,
  { cwd, env = defaultEnvironment(), stream = true, spawnImpl = spawn } = {},
) {
  return new Promise((resolveResult) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    let child;
    try {
      child = spawnImpl(command, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolveResult({
        command,
        args,
        cwd,
        stdout,
        stderr,
        exitCode: null,
        signal: null,
        spawnError: error,
      });
      return;
    }

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolveResult({
        command,
        args,
        cwd,
        stdout,
        stderr,
        ...result,
      });
    };

    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (stream) process.stdout.write(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (stream) process.stderr.write(text);
    });
    child.once("error", (error) => {
      finish({ exitCode: null, signal: null, spawnError: error });
    });
    child.once("close", (exitCode, signal) => {
      finish({ exitCode, signal, spawnError: null });
    });
  });
}

function commandFailure(result, label) {
  if (result.spawnError) {
    return `${label}: no se pudo iniciar (${result.spawnError.message})`;
  }
  if (result.signal) {
    return `${label}: terminó por señal ${result.signal}`;
  }
  return `${label}: terminó con código ${result.exitCode}`;
}

function hasErrorDiagnostics(diagnostics) {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function makePackageResult({ name, path, kind }) {
  return {
    name,
    path,
    kind,
    diagnostics: [],
    parserFailures: [],
    failures: [],
    status: "UNVERIFIED",
    attempted: false,
  };
}

function packageNameFromJson(packageJson, packagePath) {
  return packageJson.name ?? `(${packageRelativePath(packagePath, RUNNER_ROOT)})`;
}

async function referencedLibraries(root) {
  const configPath = resolve(root, "tsconfig.json");
  let config;
  try {
    config = await readJson(configPath);
  } catch (error) {
    return {
      packages: [],
      failures: [`No se pudo leer ${packageRelativePath(configPath, root)}: ${error.message}`],
    };
  }

  const packages = [];
  const failures = [];
  for (const reference of config.references ?? []) {
    const packagePath = resolve(root, reference.path);
    try {
      const packageJson = await readJson(resolve(packagePath, "package.json"));
      packages.push({
        name: packageNameFromJson(packageJson, packagePath),
        path: packagePath,
      });
    } catch (error) {
      failures.push(
        `No se pudo leer el paquete de librería ${packageRelativePath(packagePath, root)}: ${error.message}`,
      );
    }
  }
  return { packages, failures };
}

/**
 * Use pnpm's workspace inventory rather than a hard-coded artifact list. This
 * makes a newly added artifact part of the check without giving the recursive
 * runner a chance to bail on an earlier failure.
 */
export async function discoverTypecheckPackages({
  root = RUNNER_ROOT,
  pnpmCommand = "pnpm",
  pnpmArgs = [],
  env = defaultEnvironment(),
  spawnImpl = spawn,
} = {}) {
  const result = await spawnAndCapture(
    pnpmCommand,
    [...pnpmArgs, "list", "-r", "--depth", "-1", "--json"],
    { cwd: root, env, stream: false, spawnImpl },
  );

  if (result.spawnError || result.exitCode !== 0) {
    throw new Error(commandFailure(result, "pnpm list"));
  }

  const entries = parseJsonArray(result.stdout);
  const selected = [];
  const seen = new Set();

  for (const entry of entries) {
    if (!entry || typeof entry.path !== "string") continue;
    const packagePath = resolve(root, entry.path);
    if (!isSelectedPackagePath(packagePath, root) || seen.has(packagePath)) continue;
    seen.add(packagePath);

    let packageJson = entry;
    try {
      packageJson = await readJson(resolve(packagePath, "package.json"));
    } catch {
      // Keep the pnpm inventory metadata so the execution result can explain
      // the missing manifest rather than dropping the selected package.
    }

    selected.push({
      name: packageNameFromJson(packageJson, packagePath),
      path: packagePath,
      hasTypecheck: typeof packageJson.scripts?.typecheck === "string",
    });
  }

  selected.sort((left, right) => packageRelativePath(left.path, root).localeCompare(packageRelativePath(right.path, root)));
  return selected;
}

function addResultDiagnostic(result, diagnostic) {
  result.diagnostics.push(diagnostic);
}

async function runLibraries({
  root,
  tscCommand,
  tscArgs,
  spawnImpl,
  stream,
  env,
}) {
  const references = await referencedLibraries(root);
  const libraryResults = references.packages.map(({ name, path }) =>
    makePackageResult({ name, path, kind: "library" }),
  );
  const resultByPath = new Map(libraryResults.map((result) => [result.path, result]));
  const genericResult = makePackageResult({
    name: "@workspace/libraries",
    path: root,
    kind: "library-stage",
  });

  for (const failure of references.failures) genericResult.failures.push(failure);

  const commandResult = await spawnAndCapture(
    tscCommand,
    [...tscArgs, ...LIB_BUILD_ARGS],
    { cwd: root, stream, env, spawnImpl },
  );
  const parsed = parseTypeScriptDiagnostics(
    `${commandResult.stdout}\n${commandResult.stderr}`,
    { cwd: root, root },
  );
  genericResult.parserFailures.push(...parsed.parserFailures);

  for (const diagnostic of parsed.diagnostics) {
    const owningReference = references.packages.find(({ path }) => {
      const packageRelative = packageRelativePath(path, root);
      return (
        diagnostic.file === packageRelative ||
        diagnostic.file.startsWith(`${packageRelative}/`)
      );
    });
    const target = owningReference
      ? resultByPath.get(owningReference.path)
      : genericResult;
    addResultDiagnostic(target, diagnostic);
  }

  if (commandResult.spawnError || commandResult.signal || commandResult.exitCode !== 0) {
    const hasParsedErrors = hasErrorDiagnostics(parsed.diagnostics);
    if (commandResult.spawnError || commandResult.signal) {
      genericResult.failures.push(commandFailure(commandResult, "tsc --build de librerías"));
    } else if (!hasParsedErrors && parsed.parserFailures.length === 0) {
      genericResult.failures.push(commandFailure(commandResult, "tsc --build de librerías"));
    }
  }
  if (commandResult.exitCode === 0 && hasErrorDiagnostics(parsed.diagnostics)) {
    genericResult.failures.push("tsc --build terminó correctamente pero emitió errores TypeScript");
  }

  const processStarted =
    !commandResult.spawnError &&
    (commandResult.exitCode !== null || commandResult.signal !== null);
  const processCompleted = processStarted && commandResult.signal === null;
  const processVerified =
    processCompleted && commandResult.exitCode === 0 && parsed.parserFailures.length === 0;

  for (const result of libraryResults) {
    if (hasErrorDiagnostics(result.diagnostics)) {
      result.status = processCompleted ? "FAIL" : "UNVERIFIED";
    } else if (processVerified) {
      result.status = "PASS";
    } else {
      // A failed or interrupted build does not prove that a reference with no
      // printed diagnostic was checked. Never turn that absence into green.
      result.status = "UNVERIFIED";
    }
  }
  genericResult.status =
    commandResult.spawnError ||
    commandResult.signal ||
    commandResult.exitCode !== 0 ||
    genericResult.failures.length > 0 ||
    genericResult.parserFailures.length > 0 ||
    hasErrorDiagnostics(genericResult.diagnostics)
      ? "FAIL"
      : "PASS";

  for (const result of libraryResults) result.attempted = true;
  genericResult.attempted = true;
  return [...libraryResults, genericResult];
}

async function runPackageTypecheck({
  packageInfo,
  root,
  pnpmCommand,
  pnpmArgs,
  spawnImpl,
  stream,
  env,
}) {
  const result = makePackageResult({
    name: packageInfo.name,
    path: packageInfo.path,
    kind: "package",
  });
  result.attempted = true;

  if (!packageInfo.hasTypecheck) {
    result.failures.push("El paquete no declara scripts.typecheck");
    result.status = "FAIL";
    return result;
  }

  const commandResult = await spawnAndCapture(
    pnpmCommand,
    [...pnpmArgs, "run", "typecheck"],
    {
      cwd: packageInfo.path,
      stream,
      spawnImpl,
      env,
    },
  );
  const parsed = parseTypeScriptDiagnostics(
    `${commandResult.stdout}\n${commandResult.stderr}`,
    { cwd: packageInfo.path, root },
  );
  result.diagnostics.push(...parsed.diagnostics);
  result.parserFailures.push(...parsed.parserFailures);

  if (commandResult.spawnError || commandResult.signal || commandResult.exitCode !== 0) {
    if (commandResult.spawnError || commandResult.signal) {
      result.failures.push(commandFailure(commandResult, `${packageInfo.name} typecheck`));
    } else if (!hasErrorDiagnostics(parsed.diagnostics) && parsed.parserFailures.length === 0) {
      result.failures.push(commandFailure(commandResult, `${packageInfo.name} typecheck`));
    }
  }
  if (commandResult.exitCode === 0 && hasErrorDiagnostics(parsed.diagnostics)) {
    result.failures.push("El proceso terminó correctamente pero emitió errores TypeScript");
  }
  result.status =
    result.failures.length > 0 ||
    result.parserFailures.length > 0 ||
    hasErrorDiagnostics(result.diagnostics) ||
    commandResult.spawnError ||
    commandResult.signal ||
    commandResult.exitCode !== 0
      ? "FAIL"
      : "PASS";
  return result;
}

function flattenDiagnostics(results) {
  return results.flatMap((result) =>
    result.diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => ({ ...diagnostic, packageName: result.name })),
  );
}

export function formatSummary({
  results,
  selectionCount,
  selectionFailure = null,
} = {}) {
  const lines = ["", "=== Typecheck summary ==="];
  if (selectionFailure) lines.push(`ABORTED: ${selectionFailure}`);
  if (selectionCount !== undefined) {
    const libraryResultCount = (results ?? []).filter((result) =>
      result.kind === "library" || result.kind === "library-stage",
    ).length;
    lines.push(
      `Packages selected: ${selectionCount} artifacts/scripts; library results: ${libraryResultCount}`,
    );
  }

  const allDiagnostics = flattenDiagnostics(results ?? []);
  const uniqueDiagnostics = new Map();
  for (const diagnostic of allDiagnostics) {
    const key = diagnosticKey(diagnostic);
    if (!uniqueDiagnostics.has(key)) uniqueDiagnostics.set(key, diagnostic);
  }

  for (const result of results ?? []) {
    const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
    const failed =
      result.failures.length > 0 ||
      result.parserFailures.length > 0 ||
      errors.length > 0;
    const status = result.status ?? (failed ? "FAIL" : "PASS");
    lines.push(
      `${status} ${result.name} [${result.kind}] (${errors.length} TypeScript error${errors.length === 1 ? "" : "s"})`,
    );
    for (const diagnostic of result.diagnostics) {
      lines.push(`  ${formatDiagnostic(diagnostic)}`);
    }
    for (const failure of result.parserFailures) lines.push(`  PARSER: ${failure}`);
    for (const failure of result.failures) lines.push(`  PROCESS: ${failure}`);
    if (!errors.length && warnings.length) {
      lines.push(`  ${warnings.length} TypeScript warning${warnings.length === 1 ? "" : "s"}`);
    }
  }

  const repeatedEmissions = Math.max(0, allDiagnostics.length - uniqueDiagnostics.size);
  const processFailures = (results ?? []).reduce(
    (total, result) => total + result.failures.length + result.parserFailures.length,
    0,
  );
  lines.push(`Unique TypeScript diagnostics: ${uniqueDiagnostics.size}`);
  lines.push(`Repeated diagnostic emissions: ${repeatedEmissions}`);
  lines.push(`Process/parser failures: ${processFailures}`);

  const failed =
    Boolean(selectionFailure) ||
    processFailures > 0 ||
    (results ?? []).some((result) =>
      result.status === "UNVERIFIED" ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    );
  if (failed) {
    lines.push("RESULT: FAIL (all selected checks were attempted)");
  } else {
    lines.push("RESULT: PASS (all selected checks completed; 0 TypeScript errors)");
  }
  return lines.join("\n");
}

/**
 * Run library project references first, then every artifact and scripts
 * package one by one. There is intentionally no `&&` between these stages and
 * no recursive run that could stop at the first package failure.
 */
export async function runTypecheck({
  root = RUNNER_ROOT,
  pnpmCommand = "pnpm",
  pnpmArgs = [],
  tscCommand = "tsc",
  tscArgs = [],
  spawnImpl = spawn,
  stream = true,
  env = defaultEnvironment(),
} = {}) {
  let selectedPackages;
  try {
    selectedPackages = await discoverTypecheckPackages({
      root,
      pnpmCommand,
      pnpmArgs,
      env,
      spawnImpl,
    });
  } catch (error) {
    const summary = formatSummary({
      results: [],
      selectionCount: 0,
      selectionFailure: error.message,
    });
    if (stream) process.stdout.write(`${summary}\n`);
    return { exitCode: 1, results: [], summary, selectionFailure: error.message };
  }

  if (selectedPackages.length === 0) {
    const selectionFailure =
      "No se seleccionaron paquetes artifacts/* ni scripts; se aborta para no acreditar un typecheck vacío";
    const summary = formatSummary({
      results: [],
      selectionCount: 0,
      selectionFailure,
    });
    if (stream) process.stdout.write(`${summary}\n`);
    return { exitCode: 1, results: [], summary, selectionFailure };
  }

  const libraryResults = await runLibraries({
    root,
    tscCommand,
    tscArgs,
    spawnImpl,
    stream,
    env,
  });
  const packageResults = [];
  for (const packageInfo of selectedPackages) {
    // This is deliberately sequential: every selected package gets a chance
    // to report diagnostics even when the previous one failed.
    packageResults.push(
      await runPackageTypecheck({
        packageInfo,
        root,
        pnpmCommand,
        pnpmArgs,
        spawnImpl,
        stream,
        env,
      }),
    );
  }

  const results = [...libraryResults, ...packageResults];
  const summary = formatSummary({
    results,
    selectionCount: selectedPackages.length,
  });
  if (stream) process.stdout.write(`${summary}\n`);

  const failed =
    results.some(
      (result) =>
        result.failures.length > 0 ||
        result.parserFailures.length > 0 ||
        result.status === "UNVERIFIED" ||
        hasErrorDiagnostics(result.diagnostics),
    );
  return { exitCode: failed ? 1 : 0, results, summary };
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") {
      options.root = resolve(argv[++index]);
    } else if (argument === "--pnpm") {
      options.pnpmCommand = argv[++index];
    } else if (argument === "--tsc") {
      options.tscCommand = argv[++index];
    } else if (argument === "--no-stream") {
      options.stream = false;
    } else {
      throw new Error(`Argumento desconocido: ${argument}`);
    }
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runTypecheck(parseCliArguments(process.argv.slice(2)));
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`typecheck runner: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}