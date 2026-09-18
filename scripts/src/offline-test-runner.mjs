#!/usr/bin/env node
import { access, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(scriptsRoot, "..");
const defaultRoot = join(workspaceRoot, "artifacts/api-server");
const defaultManifest = join(scriptsRoot, "src/e1-backend-safe.txt");
const scriptsRequire = createRequire(join(scriptsRoot, "package.json"));
const guardSymbol = Symbol.for("e1.offline.guard.installed");
const offlineDatabaseUrl = "postgresql://e1-offline.invalid:9/forbidden";

async function requireFile(file, label) {
  try {
    await access(file, constants.R_OK);
    if (!(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`${label} is not a readable file: ${file}`);
  }
}

async function main() {
  if (globalThis[guardSymbol] !== true) {
    throw new Error("offline guard is not preloaded; use node --require scripts/src/offline-test-guard.cjs");
  }
  const appRoot = defaultRoot;
  const manifest = defaultManifest;
  await requireFile(manifest, "Safe manifest");
  const entries = (await readFile(manifest, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!entries.length) throw new Error(`Safe manifest is empty: ${manifest}`);
  if (new Set(entries).size !== entries.length) throw new Error("Safe manifest contains duplicate entries");
  const files = entries.map((entry) =>
    isAbsolute(entry) ? entry : resolve(appRoot, entry),
  );
  await Promise.all(files.map((file) => requireFile(file, "Safe test")));

  const tsxLoader = scriptsRequire.resolve("tsx");
  const guard = join(scriptsRoot, "src/offline-test-guard.cjs");
  await Promise.all([
    requireFile(tsxLoader, "tsx loader"),
    requireFile(guard, "Offline preload"),
  ]);
  const verifiedGuard = await realpath(guard);
  const result = spawnSync(
    process.execPath,
    [
      "--require",
      verifiedGuard,
      "--import",
      tsxLoader,
      "--test",
      "--test-concurrency=1",
      ...files,
    ],
    {
      cwd: appRoot,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        NODE_ENV: "test",
        DATABASE_URL: offlineDatabaseUrl,
      },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(`[offline-test-runner] ${error.message}`);
  process.exitCode = 2;
});