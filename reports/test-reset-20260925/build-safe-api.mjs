import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const root = process.cwd();
const api = path.join(root, "artifacts/api-server");
const require = createRequire(path.join(api, "build.mjs"));
globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const frozenMapPath = path.join(api, "dist-night-task12/index.mjs.map");
const frozen = JSON.parse(fs.readFileSync(frozenMapPath, "utf8"));
const originals = new Map(frozen.sources.map((p, i) => [path.resolve(api, "dist-night-task12", p), frozen.sourcesContent[i]]));
const safeRoot = path.join(root, ".local/reset-safe-source");
const output = path.join(api, "dist-test-reset-active-20260925");
const allowedChanged = new Set([
  "artifacts/api-server/src/index.ts",
  "artifacts/api-server/src/routes/index.ts",
  "artifacts/api-server/src/lib/server-lifecycle.ts",
  "lib/api-zod/src/generated/api.ts",
]);
const used = [];
const originalBuild = fs.readFileSync(path.join(api, "build.mjs"), "utf8");
const external = Function(`return ${originalBuild.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = originalBuild.match(/js: `([\s\S]*?)`,/)[1];
await build({
  entryPoints: [path.join(api, "src/index.ts")], platform: "node", bundle: true,
  format: "esm", outdir: output, outExtension: { ".js": ".mjs" },
  external, sourcemap: "linked", logLevel: "info", banner: { js: banner },
  plugins: [{
    name: "retained-source-overlay",
    setup(builder) {
      builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
        const relative = path.relative(root, args.path);
        if (relative.includes("node_modules") || relative.startsWith("..")) return;
        const safe = path.join(safeRoot, relative);
        if (!fs.existsSync(safe)) return; // Re-export-only modules have no emitted sourcemap source.
        const contents = fs.readFileSync(safe, "utf8");
        const original = originals.get(args.path);
        const added = relative.startsWith("artifacts/api-server/src/lib/test-reset/")
          || relative === "artifacts/api-server/src/routes/test-reset.ts";
        if (original !== contents && !allowedChanged.has(relative) && !added)
          throw new Error(`Unapproved source difference: ${relative}`);
        used.push({ path: relative, changed: original !== contents,
          sha256: crypto.createHash("sha256").update(contents).digest("hex") });
        return { contents, loader: args.path.endsWith(".ts") ? "ts" : "js" };
      });
    },
  }, pino({ transports: ["pino-pretty"] })],
});
fs.cpSync(path.join(api, "assets"), path.join(output, "assets"), { recursive: true });
const resultMap = JSON.parse(fs.readFileSync(path.join(output, "index.mjs.map"), "utf8"));
const unexpected = resultMap.sources.filter(source => {
  const absolute = path.resolve(output, source);
  if (absolute.includes("node_modules")) return false;
  const relative = path.relative(root, absolute);
  return !originals.has(absolute) && !relative.startsWith("artifacts/api-server/src/lib/test-reset/")
    && relative !== "artifacts/api-server/src/routes/test-reset.ts";
});
if (unexpected.length) throw new Error(`Unexpected emitted project sources: ${unexpected.join(", ")}`);
fs.writeFileSync(path.join(root, "reports/test-reset-20260925/activation-build-inputs.json"), JSON.stringify({
  retainedMapSha256: crypto.createHash("sha256").update(fs.readFileSync(frozenMapPath)).digest("hex"),
  retainedBundleSha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(api, "dist-night-task12/index.mjs"))).digest("hex"),
  candidateSha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(output, "index.mjs"))).digest("hex"),
  node: process.version, esbuild: require("esbuild/package.json").version, used,
}, null, 2));
console.log(`SAFE CANDIDATE: ${output}; ${used.length} frozen/approved source inputs; no unexpected emitted project source.`);