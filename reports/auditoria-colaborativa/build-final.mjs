// Final permission fix only. No activation, server, workflow or database access.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../.."), report = import.meta.dirname;
const read = file => fs.readFileSync(file, "utf8");
const json = file => JSON.parse(read(file));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const must = (condition, message) => { if (!condition) throw Error(message); };
const rel = file => path.relative(root, file);
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const parent = json(path.join(report, "pisos/candidate.json"));
const previousProof = json(path.join(report, "pisos/provenance.json"));
const parentStage = path.join(root, previousProof.stage), parentApi = path.dirname(parent.apiEntry);
const api = path.join(root, "artifacts/api-server/dist-auditoria-colaborativa-final-20260925");
const front = path.join(root, "artifacts/mariana-textil/dist-auditoria-colaborativa-final-20260925");
const stage = path.join(report, "staging/frontend-root-final"), proof = path.join(report, "final");
for (const target of [api, front, stage, proof]) must(!fs.existsSync(target), `Refusing overwrite: ${target}`);
const parentApiFiles = json(path.join(report, "pisos/api-sha256.json"));
const verify = (dir, files) => { for (const [file, hash] of Object.entries(files)) must(sha(fs.readFileSync(path.join(dir, file))) === hash, `Parent changed: ${file}`); };
verify(parentApi, parentApiFiles); verify(parent.frontendRoot, parent.frontendFiles);
const parentMap = json(path.join(parentApi, "index.mjs.map"));
const base = new Map(parentMap.sources.map((file, i) => [path.resolve(parentApi, file), parentMap.sourcesContent[i]]));
const overlays = new Map(base);
const route = "artifacts/api-server/src/routes/auditorias-inventario.ts";
const page = "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx";
const changes = [];
for (const file of [route, page]) {
  const before = file === route ? base.get(path.join(root, file)) : read(path.join(parentStage, file));
  must(sha(before) === previousProof.overlays.find(item => item.path === file).sha256, `Prior overlay changed ${file}`);
  const value = read(path.join(root, file));
  save(path.join(proof, "before", file), before);
  save(path.join(proof, "overlays", file), value);
  const diff = spawnSync("diff", ["-u", path.join(proof, "before", file), path.join(proof, "overlays", file)], { encoding: "utf8" });
  must(diff.status === 1, `Expected focused permission change ${file}`);
  save(path.join(proof, "diff", file + ".diff"), diff.stdout);
  changes.push({ path: file, baseSha256: sha(before), sha256: sha(value) });
  if (file === route) overlays.set(path.join(root, file), value);
}
fs.cpSync(parentStage, stage, { recursive: true, dereference: false });
const stageFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link); fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
save(path.join(stage, page), read(path.join(proof, "overlays", page)));
const retainedChanges = [];
function compare(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.endsWith(".tsbuildinfo") || entry.isSymbolicLink()) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { compare(file); continue; }
    const relative = path.relative(parentStage, file), target = path.join(stage, relative);
    must(fs.existsSync(target), `Removed retained file ${relative}`);
    if (sha(fs.readFileSync(file)) !== sha(fs.readFileSync(target))) retainedChanges.push(relative);
  }
}
compare(parentStage);
must(JSON.stringify(retainedChanges) === JSON.stringify([page]), "Unexpected frontend changes");
overlays.set(path.join(root, "lib/api-zod/src/index.ts"), read(path.join(stage, "lib/api-zod/src/index.ts")));
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
  plugins: [{ name: "frozen-final-permission-fix", setup(builder) {
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
      if (args.path.includes("node_modules")) return;
      let contents = overlays.get(args.path);
      if (contents === undefined && args.path.startsWith(path.join(root, "lib/api-zod/src/generated/types/"))) {
        const file = path.join(stage, rel(args.path));
        if (fs.existsSync(file)) contents = read(file);
      }
      must(contents !== undefined, `Unapproved workspace module ${args.path}`);
      return { contents, loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "js" };
    });
  } }, pino({ transports: ["pino-pretty"] })],
});
for (const file of fs.readdirSync(api).filter(file => file.endsWith(".mjs"))) {
  const target = path.join(api, file);
  const value = read(target).replace(`const outputDir = ${JSON.stringify(api)};`, "const outputDir = globalThis.__dirname;");
  must(!value.includes(api), "Embedded candidate path"); fs.writeFileSync(target, value);
  run("node", ["--check", target]);
}
fs.cpSync(path.join(parentApi, "assets"), path.join(api, "assets"), { recursive: true });
const built = json(path.join(api, "index.mjs.map"));
const emitted = new Map(built.sources.map((file, i) => [path.resolve(api, file), built.sourcesContent[i]]));
const apiChanges = [];
for (const [file, value] of emitted) {
  if (file.includes("node_modules")) continue;
  must(overlays.get(file) === value, `Unexpected emitted source ${rel(file)}`);
  if (base.get(file) !== value) apiChanges.push(rel(file));
}
for (const file of base.keys()) if (!file.includes("node_modules")) must(emitted.has(file), `Removed module ${rel(file)}`);
must(JSON.stringify(apiChanges) === JSON.stringify([route]), "Unexpected API delta");
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", front], stageFront, { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
verify(parentApi, parentApiFiles); verify(parent.frontendRoot, parent.frontendFiles);
function manifest(dir) {
  const result = {};
  function walk(current) { for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) walk(file); else result[path.relative(dir, file)] = sha(fs.readFileSync(file));
  } }
  walk(dir); return result;
}
const apiFiles = manifest(api), frontendFiles = manifest(front);
const candidate = { apiEntry: path.join(api, "index.mjs"), apiSha256: apiFiles["index.mjs"], frontendRoot: front, frontendFiles };
const lines = (dir, files) => Object.entries(files).map(([file, hash]) => `${hash}  ${rel(path.join(dir, file))}\n`).join("");
for (const [name, value] of Object.entries({ api: lines(api, apiFiles), frontend: lines(front, frontendFiles), all: lines(api, apiFiles) + lines(front, frontendFiles) })) save(path.join(proof, `${name}.sha256`), value);
save(path.join(proof, "api-sha256.json"), JSON.stringify(apiFiles, null, 2) + "\n");
save(path.join(proof, "frontend-sha256.json"), JSON.stringify(frontendFiles, null, 2) + "\n");
save(path.join(proof, "provenance.json"), JSON.stringify({
  status: "candidate-only-not-activated", parent: "reports/auditoria-colaborativa/pisos/candidate.json",
  stage: rel(stage), overlays: changes, apiSourceDeltas: apiChanges, frontendSourceDeltas: retainedChanges,
  isolatedFrontendTypecheck: "passed", apiSyntax: "passed-all-mjs",
  sourcePreservation: "passed", priorCandidatesUnchanged: true, generatedSourcesUnchanged: true,
  ddl: "none", databaseAccess: "none", activation: "not-performed", servicesStarted: "none",
}, null, 2) + "\n");
save(path.join(proof, "candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
run("sha256sum", ["--check", path.join(proof, "all.sha256")]);
save(path.join(report, "browser-live/candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
console.log(JSON.stringify({ apiEntry: candidate.apiEntry, apiSha256: candidate.apiSha256, frontendRoot: front, frontendIndexSha256: frontendFiles["index.html"] }, null, 2));