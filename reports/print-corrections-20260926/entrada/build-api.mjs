// Frozen cashV10 + receipt-floor evidence only. No startup or database access.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const root = process.cwd(), api = path.join(root, "artifacts/api-server");
const require = createRequire(path.join(api, "build.mjs")); globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const read = p => fs.readFileSync(p, "utf8");
const hash = v => v == null ? null : crypto.createHash("sha256").update(v).digest("hex");
const parent = path.join(api, "dist-owner-cash-v10-20260926");
const out = path.join(api, "dist-print-entrada-20260926");
const proof = path.join(root, "reports/print-corrections-20260926/entrada/api-candidate");
const parentHash = "dafb028d684e3de6f04232908c5fa5054c9bb1757d5dc4bb7f40eb2a29585df1";
assert.equal(hash(fs.readFileSync(path.join(parent, "index.mjs"))), parentHash);
const map = JSON.parse(read(path.join(parent, "index.mjs.map")));
const original = new Map(map.sources.map((s, i) => [path.resolve(parent, s), map.sourcesContent[i]]));
const sources = new Map(original);
// Type/export-only barrels are elided from sourcemaps; recover those from the released frozen root.
const frozenRoot = path.join(root, "reports/postrelease-review-20260926/tarea-4/final-frozen-root");
const allowed = [
  "artifacts/api-server/src/lib/inventario.ts",
  "artifacts/api-server/src/lib/entrada-floor-evidence.ts",
  "lib/api-zod/src/generated/api.ts",
].sort();
for (const file of allowed) sources.set(path.join(root, file),
  read(path.join(root, "reports/print-corrections-20260926/entrada/overlay", file)));
const buildSource = read(path.join(api, "build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
await build({
  entryPoints: [path.join(api, "src/index.ts")], platform: "node", bundle: true, format: "esm",
  outdir: out, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
  plugins: [{
    name: "frozen-cash-v10-entrada-only", setup(b) {
      b.onResolve({ filter: /entrada-floor-evidence$/ }, args => ({
        path: path.resolve(path.dirname(args.importer), `${args.path}.ts`),
      }));
      b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
        const contents = sources.get(args.path);
        if (contents !== undefined) return { contents, loader: args.path.endsWith(".ts") ? "ts" : "js" };
        const frozenFile = path.join(frozenRoot, path.relative(root, args.path));
        if (!args.path.includes("node_modules") && fs.existsSync(frozenFile)) {
          const barrel = read(frozenFile);
          assert.ok(args.path.endsWith("/index.ts") || args.path.includes("/generated/types/"),
            `Only frozen elided barrels/types allowed: ${frozenFile}`);
          return { contents: barrel, loader: "ts" };
        }
        if (!args.path.includes("node_modules")) throw new Error(`Unfrozen application source: ${args.path}`);
      });
    },
  }, pino({ transports: ["pino-pretty"] })],
});
fs.cpSync(path.join(parent, "assets"), path.join(out, "assets"), { recursive: true });
const emittedMap = JSON.parse(read(path.join(out, "index.mjs.map")));
const emitted = new Map(emittedMap.sources.map((s, i) => [path.resolve(out, s), emittedMap.sourcesContent[i]]));
const inventory = [], deltas = [];
for (const [file, content] of emitted) {
  const originalContent = original.get(file);
  if (!file.includes("node_modules")) {
    assert.equal(content, sources.get(file), `Unapproved source ${file}`);
    if (content !== originalContent) deltas.push(path.relative(root, file));
  } else if (originalContent !== undefined) assert.equal(content, originalContent, `Dependency drift ${file}`);
  inventory.push({ file: path.relative(root, file), sha256: hash(content),
    beforeSha256: originalContent === undefined ? null : hash(originalContent),
    application: !file.includes("node_modules") });
}
for (const file of original.keys()) assert.ok(emitted.has(file), `Missing frozen source ${file}`);
assert.deepEqual(deltas.sort(), allowed);
const apiFiles = {};
function collect(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) collect(file);
    else {
      if (file.endsWith(".mjs")) assert.equal(spawnSync("node", ["--check", file]).status, 0);
      apiFiles[path.relative(out, file)] = hash(fs.readFileSync(file));
    }
  }
}
collect(out);
fs.mkdirSync(proof, { recursive: true });
fs.writeFileSync(path.join(proof, "source-inventory.json"), JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(proof, "candidate.json"), JSON.stringify({
  status: "BUILT_NOT_STARTED_NATIVE_COPY_TEST_PENDING",
  apiEntry: path.join(out, "index.mjs"), apiSha256: apiFiles["index.mjs"], parentApiSha256: parentHash,
  apiFiles, sourceDeltas: deltas, sourceParity: true, sourceCount: inventory.length,
  sourceInventorySha256: hash(fs.readFileSync(path.join(proof, "source-inventory.json"))),
  databaseAccess: false, sqlChanges: [], runtimeChanges: false,
}, null, 2));
console.log(JSON.stringify({ apiEntry: path.join(out, "index.mjs"), apiSha256: apiFiles["index.mjs"], sourceDeltas: deltas }));