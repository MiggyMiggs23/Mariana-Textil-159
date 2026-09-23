import { createRequire } from "node:module";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const requireFromApiServer = createRequire(
  new URL("../../api-server/package.json", import.meta.url),
);
const { build } = requireFromApiServer("esbuild") as {
  build: (options: Record<string, unknown>) => Promise<unknown>;
};

const sourceExtensions = ["", ".tsx", ".ts", ".jsx", ".js"];

async function resolveSourcePath(basePath: string): Promise<string> {
  for (const extension of sourceExtensions) {
    const candidate = `${basePath}${extension}`;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next source extension.
    }
  }

  for (const extension of sourceExtensions) {
    const candidate = join(basePath, `index${extension}`);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next index extension.
    }
  }

  throw new Error(`No se encontró el módulo de prueba: ${basePath}`);
}

/**
 * Bundles real TSX production modules for Node SSR tests. This deliberately
 * uses esbuild's automatic JSX transform and data URLs for image imports so
 * the test runner sees the same component modules without Vite-only loaders.
 */
export async function loadRenderTestModule(
  entrySource: string,
  options: {
    moduleAliases?: Record<string, string>;
    /**
     * Test-only absolute module paths that must stay external. This is useful
     * for CommonJS backend packages: bundling them into an ESM fixture breaks
     * their own dynamic `require()` calls, while an absolute external import
     * still resolves each package's real sibling dependencies.
     */
    externalModuleAliases?: Record<string, string>;
  } = {},
) {
  // Keep the transient bundle under the app package so Node can resolve the
  // package's external React/UI dependencies from its node_modules folder.
  const temporaryDirectory = await mkdtemp(
    join(frontendRoot, ".mariana-render-"),
  );
  const entryPath = join(temporaryDirectory, "entry.tsx");
  const bundlePath = join(temporaryDirectory, "bundle.mjs");

  await writeFile(entryPath, entrySource, "utf8");

  try {
    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      logLevel: "silent",
      absWorkingDir: frontendRoot,
      loader: {
        ".js": "js",
        ".jsx": "jsx",
        ".ts": "ts",
        ".tsx": "tsx",
        ".png": "dataurl",
        ".jpg": "dataurl",
        ".jpeg": "dataurl",
        ".svg": "dataurl",
      },
      plugins: [
        {
          name: "mariana-ts-path-alias",
          setup(esbuild: {
            onResolve: (
              options: { filter: RegExp },
              callback: (
                args: { path: string },
              ) =>
                | { path: string; external?: boolean }
                | Promise<{ path: string; external?: boolean } | undefined>
                | undefined,
            ) => void;
          }) {
            esbuild.onResolve({ filter: /^[^./]/ }, (args) => {
              const alias = options.moduleAliases?.[args.path];
              return alias ? { path: alias } : undefined;
            });
            esbuild.onResolve({ filter: /^[^./]/ }, (args) => {
              const externalAlias = options.externalModuleAliases?.[args.path];
              return externalAlias
                ? { path: externalAlias, external: true }
                : undefined;
            });
            esbuild.onResolve({ filter: /^@\// }, async (args) => ({
              path: await resolveSourcePath(
                resolve(frontendRoot, "src", args.path.slice(2)),
              ),
            }));
            esbuild.onResolve({ filter: /^[^./]/ }, (args) => {
              if (args.path.startsWith("@workspace/")) return undefined;
              return { path: args.path, external: true };
            });
          },
        },
      ],
    });

    return await import(pathToFileURL(bundlePath).href);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}