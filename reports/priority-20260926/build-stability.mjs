// Offline candidate and deterministic RED/GREEN tests; never starts an API or connects to a DB.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const root = process.cwd(), api = path.join(root, "artifacts/api-server");
const require = createRequire(path.join(api, "build.mjs")); globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const read = file => fs.readFileSync(file, "utf8");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const parent = path.join(api, "dist-auditoria-colaborativa-final-20260925");
const out = path.join(api, "dist-priority-stability-combined-v8-20260926");
const proof = path.join(root, "reports/priority-20260926/stability-combined-v8");
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const expectedParent = "e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d";
if (hash(fs.readFileSync(path.join(parent, "index.mjs"))) !== expectedParent) throw Error("Frozen parent changed");
if (fs.existsSync(out) || fs.existsSync(proof)) throw Error("Refusing to overwrite candidate/proof");
const sourceMap = JSON.parse(read(path.join(parent, "index.mjs.map")));
const original = new Map(sourceMap.sources.map((s, i) => [path.resolve(parent, s), sourceMap.sourcesContent[i]]));
const overlays = new Map(original);
const allowlist = ["lib/e11-runtime.ts", "lib/e11-repository.ts", "lib/credit-aging-read-model.ts",
  "routes/e11.ts", "middlewares/auth.ts", "lib/clientes-listado.ts", "lib/read-workload.ts",
  "lib/payment-behavior.ts", "routes/precios.ts", "routes/clientes.ts"].map(file => `artifacts/api-server/src/${file}`);
const inputs = [];
for (const relative of allowlist) {
  const file = path.join(root, relative), base = original.get(file);
  if (base === undefined && !relative.endsWith("/read-workload.ts")) throw Error(`Missing frozen source ${relative}`);
  let content = read(file);
  if (relative.endsWith("/routes/clientes.ts")) {
    // HEAD has unrelated historical changes. Apply ONLY the two authorized
    // payment-behavior edits to the exact frozen route.
    content = base.replace('import { loadPaymentBehaviorList } from "../lib/payment-behavior";',
      'import { loadPaymentBehaviorClient, loadPaymentBehaviorList } from "../lib/payment-behavior";')
      .replace('const item = (await loadPaymentBehaviorList()).find((row) => row.clienteId === id);',
        'const item = await loadPaymentBehaviorClient(id);');
    if (content === base || !read(file).includes('const item = await loadPaymentBehaviorClient(id);'))
      throw Error("Payment detail source anchors missing");
  }
  if (relative.endsWith("/clientes-listado.ts")) {
    const authorized = read(path.join(root, "reports/priority-20260926/clientlist-overlay/clientes-listado.ts"));
    if (hash(authorized) !== "35ec356f44e7d1c057932449f6afd2acbc9871d358639d5fa04f7836e5bbfec9"
      || content !== authorized) throw Error("Authorized clientlist source/overlay drift");
  }
  // HEAD contains an unrelated ledger-ordering change. Explicitly exclude it.
  if (relative.endsWith("/credit-aging-read-model.ts")) {
    if ((content.match(/\) ORDER BY a\.id\)/g) ?? []).length !== 3) throw Error("Ledger HEAD drift");
    content = content.replaceAll(") ORDER BY a.id)", "))");
  }
  overlays.set(file, content);
  if (base !== undefined) save(path.join(proof, "before", relative), base);
  save(path.join(proof, "overlay", relative), content);
  inputs.push({ path: relative, parentSha256: base === undefined ? null : hash(base), overlaySha256: hash(content), headInputSha256: hash(read(file)) });
}
const plugin = (sources, test = false) => ({ name: "exact-frozen-stability-overlay", setup(builder) {
  builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
    if (args.path.includes("node_modules")) return;
    if (test && args.path.endsWith(".test.ts")) return;
    const contents = sources.get(args.path);
    if (contents === undefined) return; // non-emitted re-export barrels verified below
    return { contents, loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "js" };
  });
} });
const buildSource = read(path.join(api, "build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
await build({ entryPoints: [path.join(api, "src/index.ts")], platform: "node", bundle: true,
  format: "esm", outdir: out, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked",
  banner: { js: banner }, plugins: [plugin(overlays), pino({ transports: ["pino-pretty"] })] });
fs.cpSync(path.join(parent, "assets"), path.join(out, "assets"), { recursive: true });
const emittedMap = JSON.parse(read(path.join(out, "index.mjs.map")));
const emitted = new Map(emittedMap.sources.map((s, i) => [path.resolve(out, s), emittedMap.sourcesContent[i]]));
const deltas = [];
for (const [file, content] of emitted) {
  if (file.includes("node_modules")) continue;
  if (overlays.get(file) !== content) throw Error(`Unapproved emitted source ${file}`);
  if (content !== original.get(file)) deltas.push(path.relative(root, file));
}
for (const file of original.keys())
  if (!file.includes("node_modules") && !emitted.has(file)) throw Error(`Missing retained source ${file}`);
if (JSON.stringify(deltas.sort()) !== JSON.stringify([...allowlist].sort())) throw Error("Unexpected delta");
const v6Dir = path.join(api, "dist-priority-stability-combined-v6-20260926");
if (hash(fs.readFileSync(path.join(v6Dir, "index.mjs"))) !== "f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97")
  throw Error("V6 parent changed");
const v6Map = JSON.parse(read(path.join(v6Dir, "index.mjs.map")));
const v6 = new Map(v6Map.sources.map((file, i) => [path.resolve(v6Dir, file), v6Map.sourcesContent[i]]));
const v6Deltas = [...emitted].filter(([file, content]) => !file.includes("node_modules") && v6.get(file) !== content)
  .map(([file]) => path.relative(root, file)).sort();
const expectedV6 = ["lib/read-workload.ts", "lib/payment-behavior.ts", "routes/precios.ts", "routes/clientes.ts"]
  .map(file => `artifacts/api-server/src/${file}`).sort();
if (JSON.stringify(v6Deltas) !== JSON.stringify(expectedV6)) throw Error("Unexpected delta from active V6");
const results = {};
for (const [name, sources] of [["baseline", original], ["candidate", overlays]]) {
  const testEntry = path.join(api, "src/lib/e11-stability.test.ts");
  const testOut = path.join(out, `${name}-stability.test.cjs`);
  await build({ entryPoints: [testEntry], outfile: testOut, platform: "node", bundle: true, format: "cjs",
    external: [...external, "@workspace/db"], sourcemap: "linked", plugins: [plugin(sources, true)], logLevel: "silent" });
  const result = spawnSync("node", ["--test", testOut], { encoding: "utf8", timeout: 60000 });
  save(path.join(proof, `${name}-offline-tests.txt`), result.stdout + result.stderr);
  results[name] = { exitCode: result.status, signal: result.signal };
  if (name === "baseline" ? result.status !== 1 : result.status !== 0) throw Error(`Unexpected ${name} regression result`);
  await build({ entryPoints: [path.join(api, "src/lib/e11-stability.pg.test.ts")],
    outfile: path.join(out, `${name}-stability.pg.test.cjs`), platform: "node", bundle: true, format: "cjs",
    external: [...external, "drizzle-orm", "drizzle-orm/*", "pg"], sourcemap: "linked", logLevel: "silent", plugins: [
      { name: "no-application-db-initializers-in-pg-harness", setup(builder) {
        builder.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "forbidden-global-db", namespace: "harness" }));
        builder.onLoad({ filter: /.*/, namespace: "harness" }, () => ({
          contents: "export const pool={query(){throw Error('Forbidden global pool in tx harness')}};export const db={transaction(){throw Error('Use approved disposable tx')}};",
          loader: "js",
        }));
      } }, plugin(sources, true),
    ] });
}
const files = {};
for (const file of fs.readdirSync(out)) {
  const absolute = path.join(out, file);
  if (!fs.statSync(absolute).isFile()) continue;
  if (file.endsWith(".mjs") && spawnSync("node", ["--check", absolute]).status !== 0) throw Error("Invalid syntax");
  files[file] = hash(fs.readFileSync(absolute));
}
save(path.join(proof, "candidate.json"), JSON.stringify({
  status: "OFFLINE_VERIFIED_PG_AND_BROWSER_PENDING", apiEntry: path.join(out, "index.mjs"),
  apiSha256: files["index.mjs"], parentApiSha256: expectedParent, apiFiles: files,
  inputs, sourceDeltas: deltas, v6SourceDeltas: v6Deltas, offlineTests: results, frontendChanges: [],
  note: "No activation or DB access by builder. Includes authorized clientlist overlay; no blanket HEAD.",
}, null, 2));
if (hash(fs.readFileSync(path.join(parent, "index.mjs"))) !== expectedParent) throw Error("Parent changed");
console.log(JSON.stringify({ candidate: path.relative(root, out), sourceDeltas: deltas, tests: results }));