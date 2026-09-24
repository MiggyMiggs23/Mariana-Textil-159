import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const app = path.join(root, "artifacts/mariana-textil");
const require = createRequire(path.join(app, "package.json"));
const { build } = createRequire(require.resolve("vite/package.json"))("esbuild");
const directory = fs.mkdtempSync(path.join(app, ".auth-entry-test-"));
const transport = path.join(app, "src/components/e11-node-test-transport.ts");
try {
  await build({
    entryPoints: [path.join(app, "src/components/e11-auth-entry.dom.test.tsx")],
    outfile: path.join(directory, "case.test.cjs"),
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", packages: "external",
    alias: {
      "@": path.join(app, "src"),
      "@workspace/api-client-react": path.join(root, "lib/api-client-react/src/index.ts"),
      "@workspace/number-format": path.join(root, "lib/number-format/src/index.ts"),
      "@/lib/e11-feature-flags": transport,
      "@/lib/e5-feature-flags": transport,
    },
    define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
    loader: { ".png": "dataurl" },
    plugins: [{
      name: "offline-test-transport",
      setup(builder) {
        builder.onResolve({ filter: /custom-fetch$/ }, args =>
          /api-client-react\/src\/(?:generated\/api|index)\.ts$/.test(args.importer) ? { path: transport } : undefined);
      },
    }],
  });
  fs.copyFileSync(path.join(root, "reports/tanda-b-20260922/e12/frontend-node-dom.cjs"), path.join(directory, "dom.cjs"));
  const result = spawnSync(process.execPath, [
    "--require", path.join(root, "scripts/src/offline-test-guard.cjs"),
    "--require", path.join(directory, "dom.cjs"),
    "--test", path.join(directory, "case.test.cjs"),
  ], { cwd: app, stdio: "inherit", env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", E1_OFFLINE_STATIC_FIXTURE: "1" } });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}