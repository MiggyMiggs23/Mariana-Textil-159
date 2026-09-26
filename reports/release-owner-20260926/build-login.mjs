// Frozen V8 plus exactly one auth-route overlay; no activation or database access.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const root = process.cwd(), api = path.join(root, "artifacts/api-server");
const require = createRequire(path.join(api, "build.mjs"));
globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const read = file => fs.readFileSync(file, "utf8");
const hash = data => crypto.createHash("sha256").update(data).digest("hex");
const parent = path.join(api, "dist-priority-stability-combined-v8-20260926");
const out = path.join(api, "dist-owner-login-v9-20260926");
const proof = path.join(root, "reports/release-owner-20260926/login-v9");
const parentHash = "1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e";
assert.equal(hash(fs.readFileSync(path.join(parent, "index.mjs"))), parentHash);
assert.equal(fs.existsSync(out), false);
assert.equal(fs.existsSync(proof), false);
const map = JSON.parse(read(path.join(parent, "index.mjs.map")));
const original = new Map(map.sources.map((s, i) => [path.resolve(parent, s), map.sourcesContent[i]]));
const sources = new Map(original);
const route = path.join(api, "src/routes/auth.ts");
const overlay = read(route);
const inserted = `    // e5_serialize on usuarios UPDATE deliberately raises 40001 if its graph
    // lock is busy. Wait BEFORE taking session/FK/user locks, never after them.
    // The trigger re-acquires our transaction lock; no write retry is needed.
    await tx.execute(sql\`SELECT pg_advisory_xact_lock(650005,5)\`);
`;
assert.equal(overlay.replace(inserted, ""), original.get(route));
assert.notEqual(overlay, original.get(route));
sources.set(route, overlay);
const buildSource = read(path.join(api, "build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
await build({
  entryPoints: [path.join(api, "src/index.ts")], platform: "node", bundle: true,
  format: "esm", outdir: out, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked",
  banner: { js: banner }, plugins: [{
    name: "frozen-v8-login-only", setup(builder) {
      builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
        if (args.path.includes("node_modules")) return;
        const contents = sources.get(args.path);
        if (contents === undefined) return; // Emitted inventory below rejects unrelated sources.
        return { contents, loader: args.path.endsWith(".ts") ? "ts" : "js" };
      });
    },
  }, pino({ transports: ["pino-pretty"] })],
});
fs.cpSync(path.join(parent, "assets"), path.join(out, "assets"), { recursive: true });
const emittedMap = JSON.parse(read(path.join(out, "index.mjs.map")));
const emitted = new Map(emittedMap.sources.map((s, i) => [path.resolve(out, s), emittedMap.sourcesContent[i]]));
const deltas = [];
for (const [file, content] of emitted) {
  if (file.includes("node_modules")) continue;
  assert.equal(content, sources.get(file), `Unapproved source ${file}`);
  if (content !== original.get(file)) deltas.push(path.relative(root, file));
}
for (const file of original.keys())
  if (!file.includes("node_modules")) assert.ok(emitted.has(file), `Missing ${file}`);
assert.deepEqual(deltas, ["artifacts/api-server/src/routes/auth.ts"]);
assert.equal(emitted.get(route), read(route), "Actual source parity");
const apiFiles = {};
for (const file of fs.readdirSync(out)) {
  if (!fs.statSync(path.join(out, file)).isFile()) continue;
  if (file.endsWith(".mjs")) assert.equal(spawnSync("node", ["--check", path.join(out, file)]).status, 0);
  apiFiles[file] = hash(fs.readFileSync(path.join(out, file)));
}
fs.mkdirSync(proof, { recursive: true });
fs.writeFileSync(path.join(proof, "auth-before.ts"), original.get(route));
fs.writeFileSync(path.join(proof, "auth-after.ts"), overlay);
fs.writeFileSync(path.join(proof, "candidate.json"), JSON.stringify({
  status: "NATIVE_PG_RED_GREEN_VERIFIED_MAIN_ACTIVATION_AND_HTTP_PENDING",
  apiEntry: path.join(out, "index.mjs"), apiSha256: apiFiles["index.mjs"], parentApiSha256: parentHash,
  apiFiles, sourceDeltas: deltas, actualRouteSha256: hash(overlay), sourceParity: true,
  frontendChanges: [], sqlChanges: [], writeRetriesAdded: false,
  nativePgEvidence: "reports/release-owner-20260926/login-regression-results.json",
  causeEvidence: "reports/release-owner-20260926/login-cause.json",
  healthz: "PENDING_MAIN_ACTIVATION",
}, null, 2));
console.log(JSON.stringify({ apiEntry: path.join(out, "index.mjs"), apiSha256: apiFiles["index.mjs"], sourceDeltas: deltas }));