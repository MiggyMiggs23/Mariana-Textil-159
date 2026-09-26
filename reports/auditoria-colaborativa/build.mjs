// Isolated candidate only: frozen active sources plus task-only overlays.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const report = import.meta.dirname;
const read = file => fs.readFileSync(file, "utf8");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const must = (condition, message) => { if (!condition) throw Error(message); };
const rel = file => path.relative(root, file);
const freeze = JSON.parse(read(path.join(report, "frozen/manifest.json")));
const parentApi = path.join(root, freeze.apiParent);
const parentStage = path.join(root, freeze.frontendParentStage);
const api = path.join(root, "artifacts/api-server/dist-auditoria-colaborativa-20260925");
const front = path.join(root, "artifacts/mariana-textil/dist-auditoria-colaborativa-20260925");
const stage = path.join(report, "staging/frontend-root");
const evidence = path.join(report, "composition");
const run = (command, args, cwd = root, env = process.env) => {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} failed: ${result.error?.message ?? result.status}`);
};
const save = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
for (const dir of [api, front, stage, evidence]) must(!fs.existsSync(dir), `Refusing overwrite: ${dir}`);
must(sha(fs.readFileSync(path.join(parentApi, "index.mjs"))) === freeze.apiEntrySha256, "Parent API changed");
must(sha(fs.readFileSync(path.join(parentApi, "index.mjs.map"))) === freeze.apiMapSha256, "Parent sourcemap changed");
must(sha(fs.readFileSync(path.join(root, "artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc/index.html"))) === freeze.frontendIndexSha256, "Parent frontend changed");
const map = JSON.parse(read(path.join(report, "frozen/api-parent.map")));
const base = new Map(map.sources.map((name, i) => [path.resolve(parentApi, name), map.sourcesContent[i]]));
const overlays = new Map(base);
const proofs = [];
// Apply only maintained HEAD→task hunks against the active parent, never copy
// the complete generated files. Each old hunk must match exactly once.
function patchGenerated(file, before, context = 3) {
  const result = spawnSync("git", ["diff", `--unified=${context}`, freeze.head, "--", file], { cwd: root, encoding: "utf8" });
  must(result.status === 0 && result.stdout.includes("@@"), `Missing task patch ${file}`);
  save(path.join(evidence, "patches", file + ".diff"), result.stdout);
  const chunks = result.stdout.split(/^@@[^\n]*\n/m).slice(1);
  let value = before;
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    let old = "", next = "";
    for (const line of lines) {
      if (line.startsWith(" ") || line.startsWith("-")) old += line.slice(1) + "\n";
      if (line.startsWith(" ") || line.startsWith("+")) next += line.slice(1) + "\n";
    }
    const at = value.indexOf(old);
    must(old.length > 0 && at >= 0 && at === value.lastIndexOf(old), `Non-unique/non-active generated hunk: ${file}`);
    value = value.slice(0, at) + next + value.slice(at + old.length);
  }
  return value;
}
function record(file, before, value, composition) {
  save(path.join(evidence, "overlays", file), value);
  proofs.push({ path: file, baseSha256: before == null ? null : sha(before), sha256: sha(value), composition });
}
const apiFiles = ["artifacts/api-server/src/lib/auditoria-inventario.ts", "artifacts/api-server/src/routes/auditorias-inventario.ts"];
for (const file of apiFiles) {
  const before = base.get(path.join(root, file));
  const item = freeze.items.find(item => item.path === file);
  must(item.baseEqualsHead && sha(before) === item.baseSha256, `Unsafe full overlay ${file}`);
  const value = read(path.join(root, file));
  overlays.set(path.join(root, file), value);
  record(file, before, value, "Task-only full overlay; active source equals frozen HEAD");
}
const zodFile = "lib/api-zod/src/generated/api.ts";
const oldZod = base.get(path.join(root, zodFile));
const newZod = patchGenerated(zodFile, oldZod, 100);
overlays.set(path.join(root, zodFile), newZod);
record(zodFile, oldZod, newZod, "Exact audit-only maintained codegen hunks");

fs.cpSync(parentStage, stage, { recursive: true, dereference: false });
const stageFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
const page = "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx";
const frontFiles = [page, "artifacts/mariana-textil/src/components/auditoria/audit-collaboration.tsx", "artifacts/mariana-textil/src/components/auditoria/use-audit-participation.ts"];
for (const file of frontFiles) {
  const target = path.join(stage, file);
  const before = fs.existsSync(target) ? read(target) : null;
  if (file === page) {
    const item = freeze.items.find(item => item.path === file);
    must(item.baseEqualsHead && sha(before) === item.baseSha256, "Unsafe page overlay");
  } else must(before === null, `New module already exists: ${file}`);
  const value = read(path.join(root, file));
  save(target, value);
  record(file, before, value, "Task-only page/module");
}
const generated = [
  "lib/api-client-react/src/generated/api.ts",
  "lib/api-client-react/src/generated/api.schemas.ts",
  "lib/api-zod/src/index.ts",
  "lib/api-zod/src/generated/types/index.ts",
  ...["auditoriaInventarioDetail", "auditoriaInventarioEscaneoResult", "auditoriaInventarioParticipante", "auditoriaInventarioResultado"].map(name => `lib/api-zod/src/generated/types/${name}.ts`),
];
for (const file of generated) {
  const target = path.join(stage, file);
  const before = read(target);
  const value = patchGenerated(file, before);
  save(target, value);
  record(file, before, value, "Exact audit-only maintained codegen hunks");
}
const newType = "lib/api-zod/src/generated/types/auditoriaInventarioParticipacion.ts";
must(!fs.existsSync(path.join(stage, newType)), "Participation type already exists");
save(path.join(stage, newType), read(path.join(root, newType)));
record(newType, null, read(path.join(root, newType)), "New task-only participation type");
save(path.join(stage, zodFile), newZod);
// Type-only modules are absent from bundle sourcemaps; resolve only the frozen
// retained stage (with the exact audit patches above), never broad HEAD.
const barrel = path.join(root, "lib/api-zod/src/index.ts");
overlays.set(barrel, read(path.join(stage, rel(barrel))));
const require = createRequire(path.join(root, "artifacts/api-server/build.mjs"));
globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const buildSource = read(path.join(root, "artifacts/api-server/build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
await build({
  entryPoints: [path.join(root, "artifacts/api-server/src/index.ts")],
  platform: "node", bundle: true, format: "esm", outdir: api,
  outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
  plugins: [{ name: "frozen-active-audit-only", setup(builder) {
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
  let value = read(target);
  const anchor = `const outputDir = ${JSON.stringify(api)};`;
  if (value.includes(anchor)) value = value.replace(anchor, "const outputDir = globalThis.__dirname;");
  must(!value.includes(api), "Embedded candidate path");
  fs.writeFileSync(target, value);
  run("node", ["--check", target]);
}
fs.cpSync(path.join(parentApi, "assets"), path.join(api, "assets"), { recursive: true });
const builtMap = JSON.parse(read(path.join(api, "index.mjs.map")));
const changed = [];
for (let i = 0; i < builtMap.sources.length; i++) {
  const file = path.resolve(api, builtMap.sources[i]);
  if (file.includes("node_modules")) continue;
  must(overlays.get(file) === builtMap.sourcesContent[i], `Unapproved emitted module: ${rel(file)}`);
  if (base.get(file) !== builtMap.sourcesContent[i]) changed.push(rel(file));
}
must(JSON.stringify(changed.sort()) === JSON.stringify([...apiFiles, zodFile].sort()), "Unexpected API delta set");
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", front], stageFront, { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
function manifest(dir) {
  const result = {};
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else result[path.relative(dir, file)] = sha(fs.readFileSync(file));
    }
  }
  walk(dir);
  return result;
}
const apiFilesManifest = manifest(api);
const frontendFiles = manifest(front);
const candidate = { apiEntry: path.join(api, "index.mjs"), apiSha256: apiFilesManifest["index.mjs"], frontendRoot: front, frontendFiles };
save(path.join(report, "api-sha256.json"), JSON.stringify(apiFilesManifest, null, 2) + "\n");
save(path.join(report, "frontend-sha256.json"), JSON.stringify(frontendFiles, null, 2) + "\n");
save(path.join(report, "provenance.json"), JSON.stringify({ status: "candidate-only-not-activated", parent: freeze, apiSourceDeltas: changed, overlays: proofs, isolatedFrontendTypecheck: "passed", apiSyntax: "passed-all-mjs", ddl: "none", databaseAccess: "none", activation: "not-performed", stage: rel(stage) }, null, 2) + "\n");
save(path.join(report, "browser-live/candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
console.log(JSON.stringify(candidate, null, 2));