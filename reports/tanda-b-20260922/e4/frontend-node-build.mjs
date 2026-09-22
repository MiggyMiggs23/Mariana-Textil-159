import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(process.env.E4_ESBUILD_MODULE);
const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const result = await build({
  entryPoints: [plan.test], outfile: plan.output, bundle: true,
  platform: "node", format: "cjs", target: "node24", jsx: "automatic",
  packages: "external", alias: plan.aliases, metafile: true,
  plugins: [{
    name: "no-database",
    setup(build) {
      build.onResolve({ filter: /^(?:@workspace\/db|pg|postgres|mysql2?|better-sqlite3)(?:\/|$)/ }, args => {
        throw Error(`E4_OFFLINE_DB_IMPORT: ${args.path}`);
      });
      build.onLoad({ filter: /\/lib\/db\// }, args => {
        throw Error(`E4_OFFLINE_DB_IMPORT: ${args.path}`);
      });
    },
  }],
  sourcemap: "inline", logLevel: "warning",
});
for (const input of Object.keys(result.metafile.inputs)) {
  const real = fs.realpathSync(path.resolve(input));
  if (!real.startsWith(process.env.E4_SANDBOX + path.sep) &&
      !(real.startsWith(process.env.E4_LIVE_ROOT + path.sep) && real.includes("/node_modules/")))
    throw Error(`E4_BUNDLE_INPUT_ESCAPE: ${real}`);
}
fs.writeFileSync(plan.metafile, JSON.stringify(result.metafile, null, 2));
console.log(`BUNDLE_ONLY_OK ${Object.keys(result.metafile.inputs).length} physical inputs; no test execution`);