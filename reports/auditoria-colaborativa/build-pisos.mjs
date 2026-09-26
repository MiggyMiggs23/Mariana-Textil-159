// Frozen noRFC → collaboration → explicit join → floors. Candidate only.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../.."), report = import.meta.dirname;
const read = file => fs.readFileSync(file, "utf8");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const must = (value, message) => { if (!value) throw Error(message); };
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const rel = file => path.relative(root, file);
const frozen = JSON.parse(read(path.join(report, "floor-baseline/manifest.json")));
const original = JSON.parse(read(path.join(report, "frozen/manifest.json")));
const proof = path.join(report, "pisos");
const stage = path.join(report, "staging/frontend-root-pisos");
const api = path.join(root, "artifacts/api-server/dist-auditoria-colaborativa-pisos-20260925");
const front = path.join(root, "artifacts/mariana-textil/dist-auditoria-colaborativa-pisos-20260925");
for (const target of [proof, stage, api, front]) must(!fs.existsSync(target), `Refusing overwrite: ${target}`);
const apiParent = path.dirname(frozen.candidate.apiEntry);
const stageParent = path.join(root, frozen.frontendStage);
function verifyFiles(dir, files) {
  for (const [file, hash] of Object.entries(files)) must(sha(fs.readFileSync(path.join(dir, file))) === hash, `Frozen file changed: ${dir}/${file}`);
}
verifyFiles(apiParent, frozen.apiFiles);
verifyFiles(frozen.candidate.frontendRoot, frozen.candidate.frontendFiles);
verifyFiles(stageParent, frozen.frontendRetainedSources);
const parentMap = JSON.parse(read(path.join(report, "floor-baseline/api-parent.map")));
const base = new Map(parentMap.sources.map((file, i) => [path.resolve(apiParent, file), parentMap.sourcesContent[i]]));
const overlays = new Map(base), changes = [];
function record(file, before, after, method) {
  save(path.join(proof, "overlays", file), after);
  changes.push({ path: file, previousCandidateSha256: before === null ? null : sha(before), sha256: sha(after), method });
}
function overlay(file, before) {
  const value = read(path.join(root, file));
  record(file, before, value, "Task-only full overlay, original active audit sources verified equal to frozen HEAD");
  return value;
}
const apiFiles = ["artifacts/api-server/src/lib/auditoria-inventario.ts", "artifacts/api-server/src/routes/auditorias-inventario.ts"];
for (const file of apiFiles) {
  must(original.items.find(item => item.path === file)?.baseEqualsHead, `Unverified full overlay ${file}`);
  overlays.set(path.join(root, file), overlay(file, base.get(path.join(root, file))));
}
fs.cpSync(stageParent, stage, { recursive: true, dereference: false });
const stageFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link); fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
const uiFiles = [
  "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx",
  ...["audit-collaboration", "use-audit-participation", "audit-floor-station", "use-audit-floors"].map(name => `artifacts/mariana-textil/src/components/auditoria/${name}.${name.startsWith("use-") ? "ts" : "tsx"}`),
];
for (const file of uiFiles) {
  const target = path.join(stage, file), before = fs.existsSync(target) ? read(target) : null;
  save(target, overlay(file, before));
}
// Reconstruct ONLY the maintained audit-task codegen hunks on the original
// active generated source. This retains all historical unrelated noRFC changes.
function auditGenerated(file, active, context = 3) {
  const diff = spawnSync("git", ["diff", `--unified=${context}`, original.head, "--", file], { cwd: root, encoding: "utf8" });
  must(diff.status === 0 && diff.stdout.includes("@@"), `Missing generated task diff ${file}`);
  save(path.join(proof, "generated-patches", file + ".diff"), diff.stdout);
  let value = active;
  for (const chunk of diff.stdout.split(/^@@[^\n]*\n/m).slice(1)) {
    let old = "", next = "";
    for (const line of chunk.split("\n")) {
      if (line.startsWith(" ") || line.startsWith("-")) old += line.slice(1) + "\n";
      if (line.startsWith(" ") || line.startsWith("+")) next += line.slice(1) + "\n";
    }
    const start = value.indexOf(old);
    must(old.length && start >= 0 && start === value.lastIndexOf(old), `Ambiguous/non-active codegen hunk ${file}`);
    value = value.slice(0, start) + next + value.slice(start + old.length);
  }
  return value;
}
const generated = ["lib/api-zod/src/generated/api.ts", "lib/api-client-react/src/generated/api.ts", "lib/api-client-react/src/generated/api.schemas.ts", "lib/api-zod/src/index.ts", "lib/api-zod/src/generated/types/index.ts"];
for (const file of generated) {
  const target = path.join(stage, file), before = read(target);
  const originalFrozen = path.join(report, "frozen/base", file);
  const originalStage = path.join(root, original.frontendParentStage, file);
  const active = read(fs.existsSync(originalFrozen) ? originalFrozen : originalStage);
  const value = auditGenerated(file, active, file === generated[0] ? 100 : 3);
  save(target, value);
  record(file, before, value, "Exact audit-only HEAD-to-task generated hunks on frozen active generated source");
  if (file === generated[0] || file === "lib/api-zod/src/index.ts") overlays.set(path.join(root, file), value);
}
const newType = "lib/api-zod/src/generated/types/auditoriaInventarioPiso.ts";
must(!fs.existsSync(path.join(stage, newType)), "Floor type already exists");
save(path.join(stage, newType), overlay(newType, null));
// Existing collaboration type modules are frozen, not reimported from HEAD.
const sourceChanges = [];
for (const [file, hash] of Object.entries(frozen.frontendRetainedSources)) {
  const target = path.join(stage, file);
  must(fs.existsSync(target), `Retained source removed: ${file}`);
  if (sha(fs.readFileSync(target)) !== hash) sourceChanges.push(file);
}
const allowed = new Set(changes.map(item => item.path));
must(sourceChanges.every(file => allowed.has(file)), "Unexpected frontend retained-source change");
const run = (command, args, cwd = root, env = process.env) => {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} failed ${result.error?.message ?? result.status}`);
};
const require = createRequire(path.join(root, "artifacts/api-server/build.mjs"));
globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const buildSource = read(path.join(root, "artifacts/api-server/build.mjs"));
await build({
  entryPoints: [path.join(root, "artifacts/api-server/src/index.ts")],
  platform: "node", bundle: true, format: "esm", outdir: api, outExtension: { ".js": ".mjs" },
  external: Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)(),
  sourcemap: "linked", banner: { js: buildSource.match(/js: `([\s\S]*?)`,/)[1] },
  plugins: [{ name: "frozen-pisos-only", setup(builder) {
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
      if (args.path.includes("node_modules")) return;
      let contents = overlays.get(args.path);
      if (contents === undefined && args.path.startsWith(path.join(root, "lib/api-zod/src/generated/types/"))) {
        const retained = path.join(stage, rel(args.path));
        if (fs.existsSync(retained)) contents = read(retained);
      }
      must(contents !== undefined, `Unapproved workspace module: ${args.path}`);
      return { contents, loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "js" };
    });
  } }, pino({ transports: ["pino-pretty"] })],
});
for (const file of fs.readdirSync(api).filter(file => file.endsWith(".mjs"))) {
  const target = path.join(api, file);
  const value = read(target).replace(`const outputDir = ${JSON.stringify(api)};`, "const outputDir = globalThis.__dirname;");
  must(!value.includes(api), "Candidate path embedded in API");
  fs.writeFileSync(target, value); run("node", ["--check", target]);
}
fs.cpSync(path.join(apiParent, "assets"), path.join(api, "assets"), { recursive: true });
const map = JSON.parse(read(path.join(api, "index.mjs.map")));
const emitted = new Map(map.sources.map((file, i) => [path.resolve(api, file), map.sourcesContent[i]]));
const apiDeltas = [];
for (const [file, value] of emitted) {
  if (file.includes("node_modules")) continue;
  must(overlays.get(file) === value, `Unexpected emitted module ${rel(file)}`);
  if (base.get(file) !== value) apiDeltas.push(rel(file));
}
for (const file of base.keys()) if (!file.includes("node_modules")) must(emitted.has(file), `Removed API module ${rel(file)}`);
must(JSON.stringify(apiDeltas.sort()) === JSON.stringify([...apiFiles, generated[0]].sort()), "Unexpected API delta set");
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", front], stageFront, { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
verifyFiles(apiParent, frozen.apiFiles);
verifyFiles(frozen.candidate.frontendRoot, frozen.candidate.frontendFiles);
verifyFiles(stageParent, frozen.frontendRetainedSources);
must(sha(fs.readFileSync(path.join(root, original.apiParent, "index.mjs"))) === original.apiEntrySha256, "Active API changed");
must(sha(fs.readFileSync(path.join(root, "artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc/index.html"))) === original.frontendIndexSha256, "Active frontend changed");
function manifest(dir) {
  const result = {};
  function walk(current) { for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) walk(file); else result[path.relative(dir, file)] = sha(fs.readFileSync(file));
  } }
  walk(dir); return result;
}
const apiManifest = manifest(api), frontendFiles = manifest(front);
const candidate = { apiEntry: path.join(api, "index.mjs"), apiSha256: apiManifest["index.mjs"], frontendRoot: front, frontendFiles };
const shaLines = (dir, files) => Object.entries(files).map(([file, hash]) => `${hash}  ${rel(path.join(dir, file))}\n`).join("");
save(path.join(proof, "api.sha256"), shaLines(api, apiManifest));
save(path.join(proof, "frontend.sha256"), shaLines(front, frontendFiles));
save(path.join(proof, "all.sha256"), shaLines(api, apiManifest) + shaLines(front, frontendFiles));
save(path.join(proof, "api-sha256.json"), JSON.stringify(apiManifest, null, 2) + "\n");
save(path.join(proof, "frontend-sha256.json"), JSON.stringify(frontendFiles, null, 2) + "\n");
save(path.join(proof, "provenance.json"), JSON.stringify({
  status: "candidate-only-not-activated", baseline: "reports/auditoria-colaborativa/floor-baseline/manifest.json",
  stage: rel(stage), api: rel(api), frontend: rel(front), apiSourceDeltas: apiDeltas,
  overlays: changes, retainedFrontendSourceChanges: sourceChanges,
  isolatedFrontendTypecheck: "passed", apiSyntax: "passed-all-mjs", sourcePreservation: "passed",
  noApiWorkspaceModulesRemoved: true, priorCandidatesUnchanged: true, activeArtifactsUnchanged: true,
  ddl: "none", databaseAccess: "none", activation: "not-performed", servicesStarted: "none",
}, null, 2) + "\n");
save(path.join(proof, "candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
run("sha256sum", ["--check", path.join(proof, "all.sha256")]);
save(path.join(report, "browser-live/candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
console.log(JSON.stringify(candidate, null, 2));