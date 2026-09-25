// Preparation only. Do not execute without the owner's explicit approval manifest.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const report = path.join(root, "reports/directorios-sitios-20260925");
const baseline = path.join(root, ".local/e7-text-baseline");
const api = path.join(root, "artifacts/api-server");
const front = path.join(root, "artifacts/mariana-textil");
const name = "dist-directorios-sitios-20260925";
const mode = process.argv[2];
if (!["api", "front"].includes(mode)) throw Error("Usage: node reports/directorios-sitios-20260925/build-candidate.mjs api|front");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const forbidden = /commercial[-_]?return|devolucion[-_]?comercial/gi;
function forbidNewCommercialReturns(relative, base, candidate) {
  if (forbidden.test(relative)) throw Error("Commercial return path is not authorized: " + relative);
  forbidden.lastIndex = 0;
  const count = text => [...text.matchAll(forbidden)].length;
  if (count(candidate.toString("utf8")) > count(base?.toString("utf8") ?? "")) {
    throw Error("New commercial return references in approved delta: " + relative);
  }
}
const retained = path.join(api, "dist-clientes-lista-20260925");
const activeFront = path.join(front, "dist-clientes-lista-20260925");
const previousApi = JSON.parse(fs.readFileSync(path.join(root, "reports/clientes-lista-20260925/api-build-provenance.json"), "utf8"));
const previousFront = JSON.parse(fs.readFileSync(path.join(root, "reports/clientes-lista-20260925/frontend-build-provenance.json"), "utf8"));
if (sha(fs.readFileSync(path.join(retained, "index.mjs"))) !== previousApi.candidateSha256) throw Error("Active API parent hash mismatch");
if (sha(fs.readFileSync(path.join(activeFront, "index.html"))) !== previousFront.indexHtmlSha256) throw Error("Active frontend parent hash mismatch");

// Main must supply a reviewed, explicit, pinned allowlist. No HEAD file is copied
// implicitly: an approval entry names a file in approved/ and its exact bytes.
const approval = JSON.parse(fs.readFileSync(path.join(report, "approval.json"), "utf8"));
if (approval.parentApiSha256 !== previousApi.candidateSha256 ||
    approval.parentFrontIndexSha256 !== previousFront.indexHtmlSha256) throw Error("Approval does not pin active parents");
const entries = approval[mode];
if (!Array.isArray(entries) || !entries.length) throw Error("No approved " + mode + " deltas");
const changes = new Map();
for (const item of entries) {
  if (!item || typeof item.path !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(item.path) ||
      item.path.split("/").includes("..") || !/^[0-9a-f]{64}$/.test(item.sha256) ||
      !(typeof item.baseSha256 === "string" && /^[0-9a-f]{64}$/.test(item.baseSha256) || item.baseSha256 === null)) {
    throw Error("Invalid approval entry");
  }
  if (mode === "api" && !(
    item.path.startsWith("artifacts/api-server/src/") && /\.[jt]sx?$/.test(item.path) ||
    item.path === "lib/api-zod/src/generated/api.ts" ||
    item.path === "lib/db/src/schema/proveedores.ts"
  )) throw Error("Disallowed API path: " + item.path);
  if (mode === "front" && !(
    item.path.startsWith("artifacts/mariana-textil/src/") ||
    item.path.startsWith("lib/api-client-react/src/generated/") ||
    item.path.startsWith("lib/api-zod/src/generated/") ||
    item.path === "lib/api-zod/src/index.ts"
  )) throw Error("Disallowed frontend path: " + item.path);
  if (changes.has(item.path)) throw Error("Duplicate path: " + item.path);
  const approvedPath = path.join(report, "approved", item.path);
  if (!fs.statSync(approvedPath).isFile()) throw Error("Approved overlay is not a regular file: " + item.path);
  const contents = fs.readFileSync(approvedPath);
  if (sha(contents) !== item.sha256) throw Error("Approved overlay hash mismatch: " + item.path);
  changes.set(item.path, { contents, baseSha256: item.baseSha256 });
}
const out = path.join(mode === "api" ? api : front, name);
if (fs.existsSync(out)) throw Error("Candidate already exists; refusing to overwrite: " + out);
const proof = path.join(report, `${mode}-candidate-provenance.json`);
if (fs.existsSync(proof)) throw Error("Provenance already exists; refusing to overwrite: " + proof);

if (mode === "api") {
  const sourceMap = JSON.parse(fs.readFileSync(path.join(retained, "index.mjs.map"), "utf8"));
  const originals = new Map(sourceMap.sources.map((file, i) =>
    [path.resolve(retained, file), sourceMap.sourcesContent[i]]));
  const overlays = new Map(originals);
  // This pure re-export barrel was tree-shaken from the retained sourcemap.
  // Resolve it from the older safe baseline, never from HEAD (which has
  // unrelated generated exports). Its generated/api export resolves to the
  // retained source with our authorized supplier-only additions below.
  const safeBarrel = path.join(root, "lib/api-zod/src/index.ts");
  if (!originals.has(safeBarrel))
    overlays.set(safeBarrel, fs.readFileSync(path.join(baseline, "lib/api-zod/src/index.ts"), "utf8"));
  for (const [relative, entry] of changes) {
    const absolute = path.join(root, relative);
    const original = originals.get(absolute);
    if ((original === undefined ? null : sha(original)) !== entry.baseSha256) throw Error("Retained sourcemap base mismatch: " + relative);
    if (original === entry.contents.toString("utf8")) throw Error("No-op API delta: " + relative);
    forbidNewCommercialReturns(relative, original === undefined ? null : Buffer.from(original), entry.contents);
    overlays.set(absolute, entry.contents.toString("utf8"));
  }
  // Fail closed on the bundle's complete workspace source set, not merely
  // on the modules we anticipated changing. No fallback to HEAD is allowed.
  const require = createRequire(path.join(api, "build.mjs"));
  globalThis.require = require;
  const { build } = await import(require.resolve("esbuild"));
  const { default: pino } = await import(require.resolve("esbuild-plugin-pino"));
  const buildSource = fs.readFileSync(path.join(api, "build.mjs"), "utf8");
  const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
  const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
  await build({ entryPoints: [path.join(api, "src/index.ts")], platform: "node", bundle: true, format: "esm",
    outdir: out, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
    plugins: [{ name: "approved-retained-sources", setup(builder) {
      builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
        if (args.path.includes("node_modules")) return;
        let contents = overlays.get(args.path);
        if (contents === undefined && args.path.startsWith(path.join(root, "lib/api-zod/src/generated/types/"))) {
          // Type-only barrels have no emitted sourcemap entry; load their
          // historical safe E7 source rather than consulting generated HEAD.
          const relative = path.relative(root, args.path);
          const originalType = path.join(baseline, relative);
          if (fs.existsSync(originalType)) contents = fs.readFileSync(originalType, "utf8");
        }
        if (contents === undefined) throw Error("Unapproved workspace module: " + args.path);
        return { contents, loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "js" };
      });
    } }, pino({ transports: ["pino-pretty"] })] });
  // esbuild-plugin-pino embeds its build-time absolute output directory in
  // worker bundles. Retarget it to each bundle's runtime directory so moving
  // this candidate does not strand pino/thread-stream worker resolution.
  for (const file of fs.readdirSync(out).filter(file => file.endsWith(".mjs"))) {
    const workerFile = path.join(out, file);
    let contents = fs.readFileSync(workerFile, "utf8");
    const absoluteAnchor = `const outputDir = ${JSON.stringify(out)};`;
    if (contents.includes(absoluteAnchor)) {
      if (contents.indexOf(absoluteAnchor) !== contents.lastIndexOf(absoluteAnchor)) throw Error("Ambiguous pino worker path: " + file);
      contents = contents.replace(absoluteAnchor, "const outputDir = globalThis.__dirname;");
      fs.writeFileSync(workerFile, contents);
    }
    if (contents.includes(out)) throw Error("Build-time candidate directory embedded: " + file);
  }
  fs.cpSync(path.join(api, "assets"), path.join(out, "assets"), { recursive: true });
  const built = JSON.parse(fs.readFileSync(path.join(out, "index.mjs.map"), "utf8"));
  const emitted = new Set();
  for (let i = 0; i < built.sources.length; i++) {
    const absolute = path.resolve(out, built.sources[i]);
    if (absolute.includes("node_modules")) continue;
    const relative = path.relative(root, absolute);
    if (!overlays.has(absolute) || built.sourcesContent[i] !== overlays.get(absolute)) throw Error("Unapproved emitted source: " + relative);
    if (built.sourcesContent[i] !== originals.get(absolute)) emitted.add(relative);
  }
  if (JSON.stringify([...emitted].sort()) !== JSON.stringify([...changes.keys()].sort())) throw Error("Unexpected API source delta set");
  fs.writeFileSync(proof, JSON.stringify({ status: "candidate-not-activated", parent: previousApi.candidateSha256,
    candidateSha256: sha(fs.readFileSync(path.join(out, "index.mjs"))),
    sourceDeltas: [...changes].map(([file, item]) => ({ file, baseSha256: item.baseSha256, sha256: sha(item.contents) })) }, null, 2) + "\n");
} else {
  const stage = path.join(report, "staging/frontend-root");
  if (fs.existsSync(stage)) throw Error("Staging tree already exists; refusing to overwrite: " + stage);
  const stageFront = path.join(stage, "artifacts/mariana-textil");
  const baseFront = path.join(baseline, "artifacts/mariana-textil");
  fs.mkdirSync(stageFront, { recursive: true });
  for (const part of ["src", "public", "index.html", "package.json", "vite.config.ts", "tsconfig.json", "tsconfig.render-tests.json"]) {
    fs.cpSync(path.join(baseFront, part), path.join(stageFront, part), { recursive: true });
  }
  for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
    const from = path.join(baseline, "lib", lib);
    const to = path.join(stage, "lib", lib);
    fs.mkdirSync(to, { recursive: true });
    for (const part of ["src", "package.json", "tsconfig.json"]) {
      if (fs.existsSync(path.join(from, part))) fs.cpSync(path.join(from, part), path.join(to, part), { recursive: true });
    }
    fs.symlinkSync(path.join(from, "node_modules"), path.join(to, "node_modules"), "dir");
  }
  fs.cpSync(path.join(baseFront, "node_modules"), path.join(stageFront, "node_modules"), { recursive: true, dereference: false });
  for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
    const link = path.join(stageFront, "node_modules/@workspace", lib);
    fs.unlinkSync(link);
    fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
  }
  fs.symlinkSync(path.join(baseline, "node_modules"), path.join(stage, "node_modules"), "dir");
  fs.symlinkSync(path.join(root, "attached_assets"), path.join(stage, "attached_assets"), "dir");
  fs.symlinkSync(path.join(baseline, "tsconfig.base.json"), path.join(stage, "tsconfig.base.json"), "file");
  // Historical E7 test-only imports are part of the baseline TS project.
  // Link only their fixtures for isolated typechecks; Vite never bundles them.
  fs.mkdirSync(path.join(stage, "reports"), { recursive: true });
  fs.symlinkSync(path.join(root, "reports/e7"), path.join(stage, "reports/e7"), "dir");
  for (const [relative, item] of changes) {
    const baseFile = path.join(baseline, relative);
    const baseBytes = fs.existsSync(baseFile) ? fs.readFileSync(baseFile) : null;
    if ((baseBytes === null ? null : sha(baseBytes)) !== item.baseSha256) throw Error("Safe front baseline mismatch: " + relative);
    if (baseBytes?.equals(item.contents)) throw Error("No-op front delta: " + relative);
    forbidNewCommercialReturns(relative, baseBytes, item.contents);
    const target = path.join(stage, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, item.contents);
  }
  const result = spawnSync("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", out],
    { cwd: stageFront, stdio: "inherit", env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" } });
  if (result.error || result.status !== 0) throw Error("Safe frontend build failed: " + (result.error?.message ?? result.status));
  const files = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else files.push({ file: path.relative(root, absolute), sha256: sha(fs.readFileSync(absolute)) });
  } };
  walk(out);
  fs.writeFileSync(proof, JSON.stringify({ status: "candidate-not-activated", parentIndexSha256: previousFront.indexHtmlSha256,
    baseline: ".local/e7-text-baseline", staging: path.relative(root, stage),
    sourceDeltas: [...changes].map(([file, item]) => ({ file, baseSha256: item.baseSha256, sha256: sha(item.contents) })),
    output: files.sort((a, b) => a.file.localeCompare(b.file)) }, null, 2) + "\n");
}
console.log(`Prepared ${mode} candidate ${path.relative(root, out)}; not activated`);