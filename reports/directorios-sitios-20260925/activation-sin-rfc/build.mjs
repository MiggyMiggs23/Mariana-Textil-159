// Frozen-candidate composition only. Does not start services or access a database.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../..");
const report = import.meta.dirname;
const parentReport = path.dirname(report);
const approval = JSON.parse(fs.readFileSync(path.join(report, "approval.json"), "utf8"));
const oldApi = path.join(root, "artifacts/api-server/dist-directorios-sitios-20260925");
const oldFront = path.join(root, "artifacts/mariana-textil/dist-directorios-sitios-20260925-simplificados");
const api = path.join(root, "artifacts/api-server/dist-directorios-sitios-20260925-sin-rfc");
const front = path.join(root, "artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc");
const oldStage = path.join(parentReport, "staging/frontend-root-simplificados");
const stage = path.join(parentReport, "staging/frontend-root-sin-rfc");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const rel = file => path.relative(root, file);
const must = (condition, description) => { if (!condition) throw Error(description); };
const read = file => fs.readFileSync(file, "utf8");
const proofApi = path.join(report, "api-provenance.json");
const proofFront = path.join(report, "frontend-provenance.json");
const ready = path.join(report, "candidate-ready.json");
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} failed: ${result.error?.message ?? result.status}`);
}
must(approval.status === "candidate-only-supplier-rfc-rejected", "Unexpected approval");
must(sha(fs.readFileSync(path.join(oldApi, "index.mjs"))) === approval.apiParentSha256, "API parent hash mismatch");
must(sha(fs.readFileSync(path.join(oldFront, "index.html"))) === approval.frontendParentIndexSha256, "Frontend parent hash mismatch");
for (const file of [api, front, stage, proofApi, proofFront, ready]) must(!fs.existsSync(file), `Refusing to overwrite: ${file}`);
const getMap = dir => {
  const map = JSON.parse(read(path.join(dir, "index.mjs.map")));
  return new Map(map.sources.map((name, i) => [path.resolve(dir, name), map.sourcesContent[i]]));
};
const base = getMap(oldApi);
const retained = getMap(path.join(root, "artifacts/api-server/dist-clientes-lista-20260925"));
const overlays = new Map(base);
const apiRoute = path.join(root, "artifacts/api-server/src/routes/proveedores.ts");
const apiZod = path.join(root, "lib/api-zod/src/generated/api.ts");
const apiSchema = path.join(root, "lib/db/src/schema/proveedores.ts");
const checkApi = (file, value, approvalItem) => {
  must(approvalItem.path === rel(file), `Unexpected approved API source ${rel(file)}`);
  must(sha(base.get(file)) === approvalItem.baseSha256, `API sourcemap parent mismatch: ${rel(file)}`);
  must(sha(value) === approvalItem.sha256, `API reviewed result mismatch: ${rel(file)}`);
  overlays.set(file, value);
};
const oldRoute = base.get(apiRoute);
must(typeof oldRoute === "string", "Missing retained supplier router");
const routePatterns = [
  /^    rfc: row\.rfc,\n/m,
  /^            rfc: parsed\.data\.rfc\?\.trim\(\) \|\| null,\n/m,
  /^        rfc\?: string \| null;\n/m,
  /^      if \("rfc" in body\.data\) updates\.rfc = body\.data\.rfc\?\.trim\(\) \|\| null;\n/m,
];
let newRoute = oldRoute;
for (const pattern of routePatterns) {
  must([...newRoute.matchAll(new RegExp(pattern.source, "gm"))].length === 1, `Ambiguous supplier route RFC removal: ${pattern}`);
  newRoute = newRoute.replace(pattern, "");
}
checkApi(apiRoute, newRoute, approval.api[0]);
must(sha(read(apiRoute)) === sha(newRoute), "Reviewed supplier route diverged");
let oldZod = base.get(apiZod);
must(typeof oldZod === "string", "Missing retained Zod source");
const start = oldZod.indexOf("export const GetProveedoresResumenResponse =");
const end = oldZod.indexOf("export const EstadoCuentaProveedorParams", start);
must(start >= 0 && end > start, "Supplier Zod bounds missing");
const zodSupplier = oldZod.slice(start, end);
const rfcSchema = /  "rfc": zod\.string\(\)\.(?:nullable|nullish)\(\),\n/g;
must([...zodSupplier.matchAll(rfcSchema)].length === 7, "Unexpected supplier RFC Zod count");
const newZod = oldZod.slice(0, start) + zodSupplier.replace(rfcSchema, "") + oldZod.slice(end);
checkApi(apiZod, newZod, approval.api[1]);
must(!newZod.slice(start, end).includes('"rfc"'), "Supplier Zod still has RFC");
const originalSchema = retained.get(apiSchema);
must(typeof originalSchema === "string", "Missing original retained supplier schema");
checkApi(apiSchema, originalSchema, approval.api[2]);
must(sha(read(apiSchema)) === sha(originalSchema) && !originalSchema.includes("rfc"), "Supplier schema diverged or still has RFC");

// The type-only barrel was tree-shaken out of the parent sourcemap.
const safeBarrel = path.join(root, "lib/api-zod/src/index.ts");
if (!overlays.has(safeBarrel)) overlays.set(safeBarrel, read(path.join(root, ".local/e7-text-baseline/lib/api-zod/src/index.ts")));
const require = createRequire(path.join(root, "artifacts/api-server/build.mjs"));
globalThis.require = require;
const { build } = await import(require.resolve("esbuild"));
const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
const buildSource = read(path.join(root, "artifacts/api-server/build.mjs"));
const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
await build({ entryPoints: [path.join(root, "artifacts/api-server/src/index.ts")],
  platform: "node", bundle: true, format: "esm", outdir: api,
  outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
  plugins: [{ name: "frozen-no-rfc", setup(builder) {
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
      if (args.path.includes("node_modules")) return;
      let contents = overlays.get(args.path);
      if (contents === undefined && args.path.startsWith(path.join(root, "lib/api-zod/src/generated/types/"))) {
        const historical = path.join(root, ".local/e7-text-baseline", rel(args.path));
        if (fs.existsSync(historical)) contents = read(historical);
      }
      if (contents === undefined) throw Error(`Unapproved workspace module: ${args.path}`);
      return { contents, loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "js" };
    });
  } }, pino({ transports: ["pino-pretty"] })] });
for (const file of fs.readdirSync(api).filter(file => file.endsWith(".mjs"))) {
  const target = path.join(api, file);
  let contents = read(target);
  const anchor = `const outputDir = ${JSON.stringify(api)};`;
  if (contents.includes(anchor)) {
    must(contents.indexOf(anchor) === contents.lastIndexOf(anchor), "Ambiguous pino worker anchor");
    contents = contents.replace(anchor, "const outputDir = globalThis.__dirname;");
    fs.writeFileSync(target, contents);
  }
  must(!contents.includes(api), "Build-time API candidate directory embedded");
  run("node", ["--check", target]);
}
fs.cpSync(path.join(root, "artifacts/api-server/assets"), path.join(api, "assets"), { recursive: true });
const built = getMap(api);
const changed = [...built].filter(([file, value]) => !file.includes("node_modules") && base.get(file) !== value).map(([file]) => rel(file)).sort();
for (const [file, value] of built) if (!file.includes("node_modules")) must(overlays.get(file) === value, `Unapproved emitted source: ${rel(file)}`);
must(JSON.stringify(changed) === JSON.stringify(approval.api.map(item => item.path).sort()), "Unexpected emitted API delta set");
fs.writeFileSync(proofApi, JSON.stringify({ status: "candidate-only-not-activated", parentSha256: approval.apiParentSha256,
  candidateSha256: sha(fs.readFileSync(path.join(api, "index.mjs"))), sourceDeltas: approval.api }, null, 2) + "\n");

// Clone the previously approved simplified frontend, not the unreleased HEAD tree.
fs.cpSync(oldStage, stage, { recursive: true, dereference: false });
const stageFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
const pageFiles = approval.frontend.slice(0, 2);
must(JSON.stringify(pageFiles.map(item => item.path)) === JSON.stringify([
  "artifacts/mariana-textil/src/pages/proveedores.tsx", "artifacts/mariana-textil/src/pages/proveedor-detail.tsx",
]), "Unexpected frontend page set");
for (const item of pageFiles) {
  const target = path.join(stage, item.path);
  const before = read(target);
  if (item.baseSha256) must(sha(before) === item.baseSha256, `Simplified parent mismatch: ${item.path}`);
  else {
    const original = spawnSync("git", ["show", `HEAD:${item.path}`], { cwd: root });
    must(original.status === 0 && sha(original.stdout) === sha(before), "Prior detail page differs from HEAD");
  }
  const current = read(path.join(root, item.path));
  must(sha(current) === item.sha256, `Reviewed supplier page changed: ${item.path}`);
  const diff = spawnSync("git", ["diff", "HEAD", "--", item.path], { cwd: root, encoding: "utf8" });
  must(diff.status === 0 && diff.stdout.includes("-") && !diff.stdout.includes("+    rfc:"), "Supplier-only RFC diff unavailable");
  fs.writeFileSync(target, current);
  must(!/\brfc\b/i.test(current), `Supplier RFC remains in ${item.path}`);
}
const schemasItem = approval.frontend[2];
must(schemasItem.path === "lib/api-client-react/src/generated/api.schemas.ts", "Unexpected generated type path");
const schemaTarget = path.join(stage, schemasItem.path);
let types = read(schemaTarget);
must(sha(types) === schemasItem.baseSha256, "Generated frontend parent mismatch");
let removed = 0;
types = types.replace(/(export interface (?:Proveedor|ProveedorInput|ProveedorUpdate|ProveedorMetricas) \{[\s\S]*?)(?=\n\}\n)/g,
  block => block.replace(/  \/\*\* @nullable \*\/\n  rfc\??: string \| null;\n/g, () => { removed++; return ""; }));
must(removed === 4 && sha(types) === schemasItem.sha256, "Unexpected supplier generated type delta");
fs.writeFileSync(schemaTarget, types);
for (const item of approval.frontend) must(sha(fs.readFileSync(path.join(stage, item.path))) === item.sha256, `Staged hash mismatch: ${item.path}`);
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
must(!fs.existsSync(front), "Unexpected frontend candidate appeared");
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", front], stageFront,
  { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
const files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(file);
  else files.push({ file: rel(file), sha256: sha(fs.readFileSync(file)) });
} }
walk(front);
fs.writeFileSync(proofFront, JSON.stringify({ status: "candidate-only-not-activated",
  parentIndexSha256: approval.frontendParentIndexSha256, overlays: approval.frontend,
  isolatedTypecheck: "passed", staging: rel(stage), output: files.sort((a, b) => a.file.localeCompare(b.file)) }, null, 2) + "\n");
const manifest = { status: "candidate-only-not-activated",
  apiPath: rel(api), apiEntry: rel(path.join(api, "index.mjs")),
  apiEntrySha256: sha(fs.readFileSync(path.join(api, "index.mjs"))),
  frontendPath: rel(front), frontendIndex: rel(path.join(front, "index.html")),
  frontendIndexSha256: sha(fs.readFileSync(path.join(front, "index.html"))),
  approval: rel(path.join(report, "approval.json")),
  apiProvenance: rel(proofApi), frontendProvenance: rel(proofFront),
  supplierRfc: "rejected-not-built", ddl: "none", activation: "not-performed" };
fs.writeFileSync(ready, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Prepared no-RFC candidates: ${manifest.apiEntry} ${manifest.frontendIndex}; not activated`);