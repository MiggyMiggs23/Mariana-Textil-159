#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const currentRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromScripts = createRequire(join(currentRoot, "scripts/package.json"));
const guard = join(currentRoot, "scripts/src/offline-test-guard.cjs");
const tsx = requireFromScripts.resolve("tsx");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? currentRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${result.stdout ?? ""}${result.stderr ?? ""}`
      : "";
    throw new Error(`${command} exited with ${result.status}.${detail}`);
  }
  return result.stdout ?? "";
}

async function manifestFiles(root, manifest, relativeRoot) {
  const text = await readFile(join(root, manifest), "utf8");
  const entries = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!entries.length) throw new Error(`Empty safe manifest: ${manifest}`);
  if (new Set(entries).size !== entries.length) {
    throw new Error(`Duplicate entry in safe manifest: ${manifest}`);
  }
  const files = entries.map((entry) =>
    isAbsolute(entry) ? entry : resolve(root, relativeRoot, entry));
  for (const file of files) {
    if (!(await stat(file)).isFile()) throw new Error(`Missing safe test: ${file}`);
  }
  return files;
}

async function sourceDigest(root) {
  const output = run(
    "find",
    [
      join(root, "artifacts"), join(root, "lib"), join(root, "scripts"),
      "-type", "f", "!", "-path", "*/node_modules/*",
      "!", "-path", "*/dist/*", "!", "-name", "*.tsbuildinfo", "-print0",
    ],
    { capture: true },
  );
  const hash = createHash("sha256");
  for (const file of output.split("\0").filter(Boolean).sort()) {
    hash.update(file.slice(root.length)).update("\0").update(await readFile(file)).update("\0");
  }
  return hash.digest("hex");
}

function offlineEnvironment() {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://e10-offline.invalid:9/forbidden",
  };
}

async function baselineTree() {
  const root = await mkdtemp(join(tmpdir(), "e10-baseline-head-"));
  const archive = join(root, "head.tar");
  run("git", [
    "-C", currentRoot, "archive", "--format=tar", `--output=${archive}`, "HEAD",
    "package.json", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json",
    "artifacts/api-server", "artifacts/mariana-textil",
    "artifacts/mockup-sandbox", "lib", "scripts",
    "reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql",
    "reports/entradas-ajustes/catalogo.json",
  ]);
  run("tar", ["-xf", archive, "-C", root]);
  await rm(archive);
  await hydrateBaselineDependencies(root);
  const forbidden = run(
    "find",
    [root, "-type", "f", "(", "-name", ".env", "-o", "-name", ".env.*",
      "-o", "-path", "*/.local/*", "-o", "-iname", "*secret*", ")"],
    { capture: true },
  ).trim();
  if (forbidden) throw new Error(`Baseline archive contains forbidden private files:\n${forbidden}`);
  return root;
}

async function hydrateBaselineDependencies(root) {
  const packageFiles = run(
    "find",
    [root, "-name", "package.json", "!", "-path", "*/node_modules/*", "-print0"],
    { capture: true },
  ).split("\0").filter(Boolean);
  const packages = new Map();
  for (const packageFile of packageFiles) {
    const parsed = JSON.parse(await readFile(packageFile, "utf8"));
    if (typeof parsed.name === "string") {
      packages.set(parsed.name, dirname(packageFile));
    }
  }

  for (const packageFile of packageFiles) {
    const baselinePackage = dirname(packageFile);
    const relativePackage = baselinePackage.slice(root.length + 1);
    const currentModules = join(currentRoot, relativePackage, "node_modules");
    try {
      if (!(await stat(currentModules)).isDirectory()) continue;
    } catch {
      continue;
    }
    const baselineModules = join(baselinePackage, "node_modules");
    await mkdir(baselineModules, { recursive: true });
    for (const entry of await readdir(currentModules)) {
      if (entry === "@workspace") continue;
      await symlink(join(currentModules, entry), join(baselineModules, entry));
    }
    const workspaceScope = join(baselineModules, "@workspace");
    await mkdir(workspaceScope, { recursive: true });
    for (const [name, target] of packages) {
      if (!name.startsWith("@workspace/")) continue;
      await symlink(target, join(workspaceScope, name.slice("@workspace/".length)), "dir");
    }
  }

  for (const packageFile of packageFiles) {
    const packageRoot = dirname(packageFile);
    const scope = join(packageRoot, "node_modules/@workspace");
    try {
      for (const entry of await readdir(scope)) {
        const resolved = await realpath(join(scope, entry));
        if (!resolved.startsWith(`${root}/`)) {
          throw new Error(`Baseline workspace alias escaped temp tree: ${join(scope, entry)} -> ${resolved}`);
        }
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (!["--baseline", "--baseline-typecheck", "--current"].includes(mode)) {
    throw new Error("Usage: node scripts/src/e10-safe-suite.mjs --baseline|--baseline-typecheck|--current");
  }
  let root = currentRoot;
  let temporary = false;
  if (mode === "--baseline" || mode === "--baseline-typecheck") {
    root = await baselineTree();
    temporary = true;
  }
  try {
    const before = await sourceDigest(root);
    if (mode === "--baseline-typecheck") {
      const result = spawnSync(
        process.execPath,
        [join(root, "scripts/src/typecheck-runner.mjs")],
        {
          cwd: root,
          env: offlineEnvironment(),
          encoding: "utf8",
          stdio: "inherit",
        },
      );
      if (result.error) throw result.error;
      const after = await sourceDigest(root);
      if (after !== before) {
        throw new Error("Source-write protection detected a modified tracked source file.");
      }
      console.log(`[e10-safe-suite] baseline-typecheck completed with exit ${result.status ?? 1}; source digest unchanged.`);
      process.exitCode = result.status ?? 1;
      return;
    }
    const backendManifest = mode === "--baseline"
      ? "scripts/src/e1-backend-safe.txt"
      : "scripts/src/e10-backend-safe.txt";
    const backend = await manifestFiles(root, backendManifest, "artifacts/api-server");
    const scripts = await manifestFiles(
      root,
      "scripts/src/e10-scripts-safe.txt",
      ".",
    ).catch(async (error) => {
      if (mode !== "--baseline") throw error;
      return [
        resolve(root, "scripts/src/offline-static-fixture-selfcheck.cjs"),
        resolve(root, "scripts/src/offline-test-guard-selfcheck.cjs"),
      ];
    });
    const environment = offlineEnvironment();

    run(process.execPath, [
      "--require", await realpath(guard),
      "--import", tsx,
      "--test", "--test-concurrency=1",
      ...backend,
    ], { cwd: join(root, "artifacts/api-server"), env: environment });

    run(process.execPath, [
      join(currentRoot, "scripts/src/frontend-test-runner.mjs"),
      "--root", root,
      "--app-root", join(root, "artifacts/mariana-textil"),
      "--manifest", join(root, "artifacts/mariana-textil/test-manifests/safe.txt"),
      "--offline-preload", await realpath(guard),
    ], { cwd: root, env: environment });

    for (const script of scripts) {
      run(process.execPath, [
        "--require", await realpath(guard),
        script,
      ], {
        cwd: root,
        env: {
          ...environment,
          ...(script.endsWith("offline-static-fixture-selfcheck.cjs")
            ? { E1_OFFLINE_STATIC_FIXTURE: "1" }
            : script.endsWith("offline-test-guard-selfcheck.cjs")
              ? { E1_OFFLINE_GUARD_ACTIVE: "1" }
              : {}),
        },
      });
    }

    const after = await sourceDigest(root);
    if (after !== before) {
      throw new Error("Source-write protection detected a modified tracked source file.");
    }
    console.log(`[e10-safe-suite] ${mode.slice(2)} completed; source digest unchanged.`);
  } finally {
    if (temporary) await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[e10-safe-suite] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});