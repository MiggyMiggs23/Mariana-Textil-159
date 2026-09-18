/**
 * PREPARATION ONLY: importing this module neither opens a connection nor runs cases.
 * Source-bound CommonJS loader; the sole substituted production import is
 * @workspace/db. Its replacement is REAL Drizzle + REAL schema + the pinned pool.
 * No permissive exports, query mocks, fake E1 helpers, or app/bootstrap import.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Pool } from "pg";

export const REHEARSAL_TARGET = Object.freeze({
  host: "/tmp/prompt-h-block2-20260917165108-3655-3655",
  port: 5432,
  database: "restore_disposable_20260917165108-3655",
  user: "postgres",
});

export function assertPinnedPool(pool: Pool): void {
  assert.equal(pool.options.host, REHEARSAL_TARGET.host, "Only the existing clone socket is permitted");
  assert.equal(Number(pool.options.port ?? 5432), REHEARSAL_TARGET.port);
  assert.equal(pool.options.database, REHEARSAL_TARGET.database);
  assert.equal(pool.options.user, REHEARSAL_TARGET.user);
  assert.ok(!pool.options.connectionString, "Pass explicit pinned fields, never an inherited connection string");
  assert.ok(!pool.options.ssl, "The clone is Unix-socket only");
}

export async function assertCloneIdentity(pool: Pool): Promise<void> {
  assertPinnedPool(pool);
  const result = await pool.query(`SELECT current_database() AS db, current_user AS actor,
    inet_server_addr() AS address, current_setting('data_directory') AS cluster`);
  assert.equal(result.rows[0].db, REHEARSAL_TARGET.database);
  assert.equal(result.rows[0].actor, REHEARSAL_TARGET.user);
  assert.equal(result.rows[0].address, null);
  assert.equal(result.rows[0].cluster,
    "/home/runner/workspace/.local/backups/prompt-h-block2-20260917165108-3655/restore-cluster");
}

export interface RehearsalLoaderOptions {
  pool: Pool;
  workspaceRoot?: string;
}

export function createRehearsalLoader({ pool, workspaceRoot }: RehearsalLoaderOptions) {
  assertPinnedPool(pool);
  const root = realpathSync(workspaceRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
  const appRequire = createRequire(join(root, "artifacts/api-server/package.json"));
  const { transformSync } = appRequire("esbuild");
  const { drizzle } = appRequire("drizzle-orm/node-postgres");
  const modules = new Map<string, { exports: any }>();
  const loadedSources: Array<{ file: string; sha256: string }> = [];
  let databaseExports: Record<string, unknown> | undefined;

  function resolveSource(candidate: string): string {
    const candidates = [
      candidate, `${candidate}.ts`, `${candidate}.mts`, `${candidate}.tsx`,
      join(candidate, "index.ts"), join(candidate, "index.mts"),
      ...(candidate.endsWith(".js") ? [candidate.slice(0, -3) + ".ts"] : []),
    ];
    const found = candidates.find((file) => existsSync(file) && statSync(file).isFile());
    assert.ok(found, `Cannot resolve source file: ${candidate}`);
    return realpathSync(found);
  }

  function loadModule(file: string): any {
    const absolute = resolveSource(isAbsolute(file) ? file : resolve(root, file));
    const name = relative(root, absolute).replaceAll("\\", "/");
    assert.ok(!name.startsWith("../"), "Source must belong to this workspace");
    assert.ok(![
      "lib/db/src/index.ts", "artifacts/api-server/src/index.ts",
      "artifacts/api-server/src/app.ts", "artifacts/api-server/src/routes/index.ts",
    ].includes(name), `Bootstrap/global singleton import prohibited: ${name}`);
    if (modules.has(absolute)) return modules.get(absolute)!.exports;
    const module = { exports: {} as any };
    modules.set(absolute, module); // Real CommonJS cycle semantics.
    const source = readFileSync(absolute, "utf8");
    loadedSources.push({ file: name, sha256: createHash("sha256").update(source).digest("hex") });
    const nativeRequire = createRequire(absolute);
    const requireBound = (specifier: string): any => {
      if (specifier === "@workspace/db") {
        assert.ok(databaseExports, "Schema cannot recursively import the global database");
        return databaseExports;
      }
      if (specifier.startsWith(".") || isAbsolute(specifier)) {
        const resolved = resolveSource(resolve(dirname(absolute), specifier));
        return /\.[cm]?[jt]sx?$/.test(resolved) ? loadModule(resolved) : nativeRequire(resolved);
      }
      const resolved = nativeRequire.resolve(specifier);
      if (specifier.startsWith("@workspace/") || (
        resolved.startsWith(root + "/") && !resolved.includes("/node_modules/") &&
        /\.[cm]?tsx?$/.test(resolved)
      )) return loadModule(resolved);
      return nativeRequire(specifier);
    };
    Object.assign(requireBound, { resolve: nativeRequire.resolve });
    try {
      const code = transformSync(source, {
        loader: extname(absolute) === ".tsx" ? "tsx" : "ts", format: "cjs",
        target: "es2022", sourcefile: absolute, sourcemap: "inline",
        define: { "import.meta.url": JSON.stringify(pathToFileURL(absolute).href) },
      }).code;
      new Function("require", "module", "exports", "__filename", "__dirname", code)(
        requireBound, module, module.exports, absolute, dirname(absolute),
      );
      return module.exports;
    } catch (error) {
      modules.delete(absolute);
      throw error;
    }
  }

  const schema = loadModule("lib/db/src/schema/index.ts");
  const db = drizzle(pool, { schema });
  databaseExports = { ...schema, db, pool };
  return { loadModule, loadedSources, db, schema };
}

export type RehearsalLoader = ReturnType<typeof createRehearsalLoader>;