// Exact released V9 + collection-route coordination only. No startup or DB access.
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
const hash = v => crypto.createHash("sha256").update(v).digest("hex");
const parent = path.join(api, "dist-owner-login-v9-20260926");
const out = path.join(api, "dist-owner-cash-v10-20260926");
const proof = path.join(root, "reports/postrelease-review-20260926/tarea-2/cash-v10");
const parentHash = "3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea";
assert.equal(hash(fs.readFileSync(path.join(parent, "index.mjs"))), parentHash);
assert.equal(fs.existsSync(out), false); assert.equal(fs.existsSync(proof), false);
const map = JSON.parse(read(path.join(parent, "index.mjs.map")));
const original = new Map(map.sources.map((s, i) => [path.resolve(parent, s), map.sourcesContent[i]]));
const sources = new Map(original), route = path.join(api, "src/routes/pos.ts"), overlay = read(route);
const startBefore = "      const result = await db.transaction((tx) =>\n        cobrarTicket(";
const startAfter = `      const result = await db.transaction(async (tx) => {
        // Coordinate E5 before cobrarTicket takes ticket/session/FK locks.
        // Waiting at the later UPDATE trigger would invert the graph lock order.
        await tx.execute(sql\`SELECT pg_advisory_xact_lock(650005,5)\`);
        return cobrarTicket(`;
const endBefore = "          true,\n        ),\n      );\n      res.json(CobrarTicketResponse.parse(result));";
const endAfter = "          true,\n        );\n      });\n      res.json(CobrarTicketResponse.parse(result));";
assert.equal(original.get(route).replace(startBefore, startAfter).replace(endBefore, endAfter), overlay);
assert.notEqual(original.get(route), overlay);
sources.set(route, overlay);
const buildSource = read(path.join(api, "build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
await build({
  entryPoints: [path.join(api, "src/index.ts")], platform: "node", bundle: true, format: "esm",
  outdir: out, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
  plugins: [{
    name: "released-v9-cash-only", setup(b) {
      b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
        if (args.path.includes("node_modules")) return;
        const contents = sources.get(args.path); if (contents === undefined) return;
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
assert.deepEqual(deltas, ["artifacts/api-server/src/routes/pos.ts"]);
assert.equal(emitted.get(route), read(route));
const apiFiles = {};
for (const file of fs.readdirSync(out)) {
  if (!fs.statSync(path.join(out, file)).isFile()) continue;
  if (file.endsWith(".mjs")) assert.equal(spawnSync("node", ["--check", path.join(out, file)]).status, 0);
  apiFiles[file] = hash(fs.readFileSync(path.join(out, file)));
}
fs.mkdirSync(proof, { recursive: true });
fs.writeFileSync(path.join(proof, "pos-before.ts"), original.get(route));
fs.writeFileSync(path.join(proof, "pos-after.ts"), overlay);
fs.writeFileSync(path.join(proof, "candidate.json"), JSON.stringify({
  status: "NATIVE_FULL_ROUTE_RED_GREEN_MAIN_ACTIVATION_AND_SIX_ACTOR_RETEST_PENDING",
  apiEntry: path.join(out, "index.mjs"), apiSha256: apiFiles["index.mjs"], parentApiSha256: parentHash,
  apiFiles, sourceDeltas: deltas, actualRouteSha256: hash(overlay), sourceParity: true,
  frontendChanges: [], sqlChanges: [], writeRetriesAdded: false,
  nativePgEvidence: "reports/postrelease-review-20260926/tarea-2/cash-regression/results.json",
  preservedUncertainTicket: 16, healthz: "PENDING_MAIN_ACTIVATION",
}, null, 2));
console.log(JSON.stringify({ apiEntry: path.join(out, "index.mjs"), apiSha256: apiFiles["index.mjs"], sourceDeltas: deltas }));