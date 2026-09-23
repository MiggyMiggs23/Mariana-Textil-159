// E11 derivative: E5 image/public import.meta handling, original E12 guard.
// Only network transport and construction gates are aliased; productive UI,
// generated hooks, authorization, QueryClient and layouts are not replaced.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(process.env.E4_ESBUILD_MODULE);
const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const result = await build({
  entryPoints: [plan.test], outfile: plan.output, bundle: true, platform: "node", format: "cjs", target: "node24",
  jsx: "automatic", packages: "external", alias: plan.aliases, metafile: true,
  loader: { ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".gif": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
  define: { "import.meta.env.BASE_URL": JSON.stringify("/"), "import.meta.env.VITE_FONDO_E10_ENABLED": JSON.stringify("false"), "import.meta.env.DEV": "false" },
  logOverride: { "empty-import-meta": "error" },
  plugins: [{
    name: "offline-transport-boundary",
    setup(build) {
      build.onResolve({ filter: /custom-fetch$/ }, args => {
        if (args.importer.endsWith("/api-client-react/src/generated/api.ts") || args.importer.endsWith("/api-client-react/src/index.ts")) return { path: plan.transport };
      });
      build.onResolve({ filter: /^(?:@workspace\/db|pg|postgres|mysql2?|better-sqlite3)(?:\/|$)/ }, args => { throw Error(`E4_OFFLINE_DB_IMPORT ${args.path}`); });
      build.onLoad({ filter: /\/lib\/db\// }, args => { throw Error(`E4_OFFLINE_DB_IMPORT ${args.path}`); });
    },
  }],
  sourcemap: "inline", logLevel: "warning",
});
for (const input of Object.keys(result.metafile.inputs)) {
  const real = fs.realpathSync(path.resolve(input));
  if (!real.startsWith(process.env.E4_SANDBOX + path.sep) &&
    !(real.startsWith(process.env.E4_LIVE_ROOT + path.sep) && real.includes("/node_modules/"))) throw Error(`E4_BUNDLE_INPUT_ESCAPE ${real}`);
}
fs.writeFileSync(plan.metafile, JSON.stringify(result.metafile, null, 2));
console.log(`BUNDLE_ONLY_OK ${Object.keys(result.metafile.inputs).length}; zero test execution`);