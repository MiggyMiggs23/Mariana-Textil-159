import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const root = process.cwd(), report = path.join(root, "reports/floor-level-and-letter-20260926");
const frozen = path.join(report, "combined-frozen-root");
const prior = path.join(root, "reports/inventory-floors-20260926/frozen-root");
const api = "artifacts/api-server", ui = "artifacts/mariana-textil";
const output = "dist-floor-level-letter-20260926";
const read = p => fs.readFileSync(p, "utf8");
const sha = x => x == null ? null : crypto.createHash("sha256").update(x).digest("hex");
const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const json = (p, data) => write(p, JSON.stringify(data, null, 2));
const appFile = p => !p.includes("node_modules") && !p.includes("/dist/") && !p.endsWith(".tsbuildinfo");
const parentDir = path.join(root, api, "dist-inventory-floors-20260926");
assert.equal(sha(fs.readFileSync(path.join(parentDir, "index.mjs"))), "7ce444a8dbda01aae9f6df484424159532f6d7c4b1ec9421bba438128693b446");
const map = JSON.parse(read(path.join(parentDir, "index.mjs.map")));
const original = new Map(map.sources.map((p, i) => [path.relative(root, path.resolve(parentDir, p)), map.sourcesContent[i]]));
const patchFile = path.join(report, "floor-source.patch");
const patches = read(patchFile).split(/(?=^diff --git )/m).filter(Boolean);
const inputs = [], deltas = [];
const guards = {};
function guardTree(dir, prefix) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name.endsWith(".tsbuildinfo")) continue;
    const p = path.join(dir, ent.name), key = `${prefix}/${ent.name}`;
    if (ent.isDirectory()) guardTree(p, key);
    else if (ent.isFile()) guards[key] = sha(fs.readFileSync(p));
  }
}
guardTree(prior, "prior-ui-frozen");
guardTree(path.join(report, "print/overlay"), "print-overlay");
guardTree(parentDir, "prior-api-dist");
guards["floor-source.patch"] = sha(read(patchFile));
const guardPath = path.join(report, "combined-input-hashguards.json");
if (fs.existsSync(guardPath)) assert.deepEqual(guards, JSON.parse(read(guardPath)), "Frozen build input drift");
else json(guardPath, guards);
fs.rmSync(frozen, { recursive: true, force: true });
fs.cpSync(prior, frozen, { recursive: true, verbatimSymlinks: true });
// Runtime API content comes exclusively from the retained active sourcemap.
for (const [file, content] of original) if (appFile(file)) write(path.join(frozen, file), content);
// Exact pre-change git blobs supply tests/contracts omitted by the runtime map.
for (const section of patches) {
  const file = section.match(/^diff --git a\/(.+) b\//)[1];
  const dest = path.join(frozen, file);
  if (!fs.existsSync(dest) && !section.includes("\nnew file mode ")) {
    const blob = section.match(/^index ([0-9a-f]+)\.\./m)[1];
    const result = spawnSync("git", ["show", blob], { encoding: "utf8" });
    assert.equal(result.status, 0, `Missing immutable pre-change blob ${file}: ${result.stderr}`);
    write(dest, result.stdout);
    inputs.push({ file, source: `git-blob:${blob}`, sha256: sha(result.stdout) });
  }
}
// Elided barrels and build/typecheck metadata are captured, not used to replace mapped runtime sources.
const metadata = ["tsconfig.base.json", `${api}/package.json`, `${api}/tsconfig.json`, `${api}/build.mjs`,
  "lib/db/package.json", "lib/db/tsconfig.json", "lib/db/src/schema/index.ts", "lib/db/src/lib/advisory-locks.d.mts"];
for (const file of metadata) {
  const dest = path.join(frozen, file);
  if (!fs.existsSync(dest)) {
    const captured = path.join(report, "build-metadata", file);
    if (!fs.existsSync(captured)) write(captured, read(path.join(root, file)));
    write(dest, read(captured));
    inputs.push({ file, source: "captured-build-metadata-or-elided-barrel", sha256: sha(read(dest)) });
  }
}
const before = new Map();
function scan(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "reports") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) scan(p);
    else if (ent.isFile()) before.set(path.relative(frozen, p), read(p));
  }
}
scan(frozen);
for (const file of [`${ui}/src/pages/entrada-documento.tsx`, `${ui}/src/index.css`]) {
  const content = read(path.join(report, "print/overlay", file));
  write(path.join(frozen, file), content);
  inputs.push({ file, source: "print/overlay", sha256: sha(content) });
}
for (const section of patches) {
  const file = section.match(/^diff --git a\/(.+) b\//)[1];
  const dest = path.join(frozen, file);
  let text = fs.existsSync(dest) ? read(dest) : "";
  const originalText = text;
  for (const match of section.matchAll(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@[^\n]*\n([\s\S]*?)(?=^@@|(?![\s\S]))/gm)) {
    const hunk = match[2];
    const lines = hunk.split("\n").filter(l => /^[ +\-]/.test(l));
    let oldText = lines.filter(l => l[0] !== "+").map(l => l.slice(1)).join("\n");
    let newText = lines.filter(l => l[0] !== "-").map(l => l.slice(1)).join("\n");
    if (oldText) oldText += "\n";
    if (newText && !hunk.includes("\\ No newline at end of file")) newText += "\n";
    if (!oldText) { assert.equal(text, "", `New file already exists: ${file}`); text = newText; }
    else {
      assert.ok(text.includes(oldText), `Frozen hunk context mismatch: ${file}\n${oldText}`);
      if (text.indexOf(oldText) !== text.lastIndexOf(oldText)) {
        const blob = section.match(/^index ([0-9a-f]+)\.\./m)[1];
        const result = spawnSync("git", ["show", blob], { encoding: "utf8" });
        assert.equal(result.status, 0);
        const line = Number(match[1]) - 1;
        const endLine = line + oldText.split("\n").length - 1;
        let suffix = "";
        for (let count = 1; count <= 200; count++) {
          suffix = result.stdout.split("\n").slice(endLine, endLine + count).join("\n") + "\n";
          if (text.includes(oldText + suffix) && text.indexOf(oldText + suffix) === text.lastIndexOf(oldText + suffix)) break;
        }
        oldText += suffix; newText += suffix;
        assert.ok(text.includes(oldText), `Expanded frozen context mismatch ${file}`);
      }
      assert.equal(text.indexOf(oldText), text.lastIndexOf(oldText), `Ambiguous hunk ${file}`);
      text = text.replace(oldText, newText);
    }
  }
  write(dest, text);
  inputs.push({ file, source: "floor-source.patch", beforeSha256: sha(originalText), sha256: sha(text) });
}
// Isolate every workspace-package reference. Third-party packages remain installed symlinks.
const packages = fs.readdirSync(path.join(frozen, "lib")).filter(p => fs.existsSync(path.join(frozen, "lib", p, "package.json")));
for (const pkg of [api, ui, ...packages.map(p => `lib/${p}`)]) {
  const nm = path.join(frozen, pkg, "node_modules");
  if (!fs.existsSync(nm)) {
    fs.mkdirSync(nm, { recursive: true });
    const installed = path.join(root, pkg, "node_modules");
    if (fs.existsSync(installed)) for (const ent of fs.readdirSync(installed)) {
      if (ent === "@workspace") continue;
      fs.symlinkSync(path.join(installed, ent), path.join(nm, ent));
    }
  }
  const links = path.join(nm, "@workspace");
  fs.rmSync(links, { recursive: true, force: true });
  fs.mkdirSync(links, { recursive: true });
  for (const p of packages) fs.symlinkSync(path.join(frozen, "lib", p), path.join(links, p));
}
for (const [file, content] of before) {
  const after = read(path.join(frozen, file));
  if (after !== content) deltas.push({ file, beforeSha256: sha(content), sha256: sha(after) });
}
for (const item of inputs) if (!before.has(item.file)) deltas.push({ file: item.file, beforeSha256: null, sha256: item.sha256 });
json(path.join(report, "combined-source-delta-audit.json"), { patchSha256: sha(read(patchFile)), inputs, deltas });
const req = createRequire(path.join(root, api, "build.mjs"));
globalThis.require = req;
const { build } = await import(req.resolve("esbuild"));
const { default: pino } = await import(req.resolve("esbuild-plugin-pino"));
const buildSource = read(path.join(frozen, api, "build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
const apiOut = path.join(root, api, output);
await build({
  entryPoints: [path.join(root, api, "src/index.ts")], platform: "node", bundle: true, format: "esm",
  outdir: apiOut, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
  plugins: [{
    name: "strict-frozen-floor-level",
    setup(b) {
      b.onResolve({ filter: /floor-order\.mjs$|entrada-floor-evidence$/ }, args => ({
        path: path.resolve(path.dirname(args.importer), args.path.endsWith(".mjs") ? args.path : `${args.path}.ts`),
      }));
      b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
        if (args.path.includes("node_modules")) return;
        const file = path.relative(root, args.path), frozenFile = path.join(frozen, file);
        assert.ok(fs.existsSync(frozenFile), `Unfrozen runtime input ${file}`);
        assert.ok(original.has(file) || inputs.some(i => i.file === file) || file.endsWith("/index.ts") || file.includes("/generated/types/"), `Unapproved runtime input ${file}`);
        return { contents: read(frozenFile), loader: file.endsWith(".ts") ? "ts" : "js" };
      });
    },
  }, pino({ transports: ["pino-pretty"] })],
});
fs.cpSync(path.join(parentDir, "assets"), path.join(apiOut, "assets"), { recursive: true });
const emitted = JSON.parse(read(path.join(apiOut, "index.mjs.map")));
const inventory = emitted.sources.map((p, i) => {
  const file = path.relative(root, path.resolve(apiOut, p)), content = emitted.sourcesContent[i];
  if (file.includes("node_modules")) {
    if (original.has(file)) {
      const normalize = s => file.endsWith("/pino/pino.js") ? s.replace(/const outputDir = "[^"]+";/, 'const outputDir = "<OUTPUT_DIR>";') : s;
      assert.equal(normalize(content), normalize(original.get(file)), `Dependency drift ${file}`);
    }
  } else assert.equal(content, read(path.join(frozen, file)), `Source mismatch ${file}`);
  return { file, sha256: sha(content), beforeSha256: original.has(file) ? sha(original.get(file)) : null };
});
for (const file of original.keys()) assert.ok(inventory.some(i => i.file === file), `Missing frozen source ${file}`);
json(path.join(report, "combined-api-source-inventory.json"), inventory);
const inventoryDeltas = inventory.filter(i => !i.file.includes("node_modules") && i.beforeSha256 !== i.sha256).map(i => i.file).sort();
const allowedRuntime = patches.map(section => section.match(/^diff --git a\/(.+) b\//)[1]);
for (const file of inventoryDeltas) assert.ok(allowedRuntime.includes(file), `Unscoped API delta ${file}`);
const uiInventory = {};
guardTree(path.join(frozen, ui, "src"), "candidate-ui-src");
for (const [key, value] of Object.entries(guards)) if (key.startsWith("candidate-ui-src/")) uiInventory[key] = value;
json(path.join(report, "combined-ui-source-inventory.json"), uiInventory);
function run(name, bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: "utf8", env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" }, maxBuffer: 30e6 });
  write(path.join(report, `${name}.log`), `${r.stdout ?? ""}${r.stderr ?? ""}${r.error?.message ?? ""}`);
  return { name, status: r.status, signal: r.signal };
}
const checks = [];
checks.push(run("combined-ui-build", path.join(frozen, ui, "node_modules/.bin/vite"), ["build", "--config", path.join(frozen, ui, "vite.config.ts"), "--outDir", path.join(root, ui, output)], path.join(frozen, ui)));
checks.push(run("combined-libs-typecheck", path.join(root, "node_modules/.bin/tsc"), ["-b", "--force", ...packages.filter(p => fs.existsSync(path.join(frozen, "lib", p, "tsconfig.json"))).map(p => path.join(frozen, "lib", p))], frozen));
for (const [name, pkg] of [["api", api], ["ui", ui]]) checks.push(run(`combined-${name}-typecheck`, path.join(root, "node_modules/.bin/tsc"), ["--noEmit", "--incremental", "false", "-p", path.join(frozen, pkg)], frozen));
function hashes(dir) {
  const result = {};
  function walk(d) { for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else { result[path.relative(dir, p)] = sha(fs.readFileSync(p)); if (p.endsWith(".mjs")) assert.equal(spawnSync("node", ["--check", p]).status, 0); }
  } }
  if (fs.existsSync(dir)) walk(dir);
  return result;
}
const manifest = {
  status: "BUILT_NOT_ACTIVATED", checks, apiFiles: hashes(apiOut), frontendFiles: hashes(path.join(root, ui, output)),
  apiRuntimeSourceDeltas: inventoryDeltas,
  dependencyException: "Only esbuild-plugin-pino generated outputDir changes from retained dist-owner-cash-v10-20260926 to candidate directory; all other mapped dependency content equal.",
  patchSha256: sha(read(patchFile)), sourceAuditSha256: sha(read(path.join(report, "combined-source-delta-audit.json"))),
  apiInventorySha256: sha(read(path.join(report, "combined-api-source-inventory.json"))),
  databaseAccess: false, runtimeChanges: false, validationGaps: [
    "No runtime start or database access; parent agent owns integration/visual verification.",
    "Typecheck covers retained runtime sources and floor patch tests, not all unrelated source-tree tests omitted from retained runtime.",
    ...checks.filter(c => c.status !== 0).map(c => `${c.name} failed: see ${c.name}.log`),
  ],
};
const manifestPath = path.join(report, "combined-build-manifest.json");
if (fs.existsSync(manifestPath)) {
  const previous = JSON.parse(read(manifestPath));
  assert.deepEqual(manifest.apiFiles, previous.apiFiles, "API reproducibility failure");
  assert.deepEqual(manifest.frontendFiles, previous.frontendFiles, "UI reproducibility failure");
  manifest.repeatedBuildByteParity = true;
}
manifest.recipeSha256 = sha(read(path.join(report, "build-combined.mjs")));
manifest.inputHashguardsSha256 = sha(read(guardPath));
json(path.join(report, "combined-build-manifest.json"), manifest);
console.log(JSON.stringify(manifest, null, 2));