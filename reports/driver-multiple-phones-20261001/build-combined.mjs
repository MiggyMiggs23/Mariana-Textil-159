import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = process.cwd();
const report = path.join(root, "reports/driver-multiple-phones-20261001");
const api = "artifacts/api-server";
const ui = "artifacts/mariana-textil";
const prior = path.join(root, "reports/inventory-varias-20260926/frozen-root");
const priorCombined = path.join(root, "reports/floor-level-and-letter-20260926/combined-frozen-root");
const activeApi = path.join(root, api, "dist-floor-level-letter-20260926");
const activeUi = path.join(root, ui, "dist-inventory-varias-20260926");
const frozen = path.join(report, "frozen-root");
const output = "dist-driver-phones-20261001";
const read = p => fs.readFileSync(p, "utf8");
const sha = value => value == null ? null : crypto.createHash("sha256").update(value).digest("hex");
const write = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, value);
};
const json = (p, value) => write(p, JSON.stringify(value, null, 2) + "\n");
function inventory(dir, skip = ["node_modules", "reports", "dist", ".vite", ".vite-temp"]) {
  const result = {};
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.includes(ent.name) || ent.name.endsWith(".tsbuildinfo")) continue;
      const file = path.join(d, ent.name);
      if (ent.isDirectory()) walk(file);
      else if (ent.isFile()) result[path.relative(dir, file)] = sha(fs.readFileSync(file));
      else if (ent.isSymbolicLink()) result[path.relative(dir, file)] = { link: fs.readlinkSync(file) };
    }
  }
  walk(dir);
  return result;
}
function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 50e6 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function baselineGuards() {
  return {
    activeApi: inventory(activeApi, []),
    activeUi: inventory(activeUi, []),
    priorUi: inventory(path.join(prior, ui)),
    priorLibraries: inventory(path.join(prior, "lib")),
    priorCombined: inventory(priorCombined),
  };
}
const provenancePath = path.join(report, "baseline-provenance.json");
function retainTestSupport() {
  const inputs = [];
  for (const name of ["frontend-document-bytes.json", "frontend-fixtures.ts"]) {
    const file = `reports/e7/${name}`;
    const content = read(path.join(priorCombined, file));
    write(path.join(frozen, file), content);
    inputs.push({ file, source: path.relative(root, path.join(priorCombined, file)), sha256: sha(content), runtime: false });
  }
  json(path.join(report, "retained-typecheck-support.json"), inputs);
}
if (process.argv.includes("--prepare")) {
  const retained = fs.existsSync(provenancePath) ? JSON.parse(read(provenancePath)) : null;
  const guards = baselineGuards();
  if (retained) assert.deepEqual(guards, retained.guards, "Captured baseline drift");
  assert.deepEqual(guards.activeApi, JSON.parse(read(path.join(root, "reports/floor-level-and-letter-20260926/combined-build-manifest.json"))).apiFiles);
  assert.deepEqual(guards.activeUi, JSON.parse(read(path.join(root, "reports/inventory-varias-20260926/build-manifest.json"))).frontendFiles);
  const head = retained?.head ?? git(["rev-parse", "HEAD"]).trim();
  const uiHeadDifferences = [];
  for (const [file, hash] of Object.entries(inventory(path.join(prior, ui, "src")))) {
    const tracked = `${ui}/src/${file}`;
    const source = spawnSync("git", ["show", `${head}:${tracked}`], { cwd: root, maxBuffer: 20e6 });
    if (source.status !== 0 || sha(source.stdout) !== hash) uiHeadDifferences.push(tracked);
  }
  json(provenancePath, {
    status: "BASELINE_CAPTURED_AWAITING_MAIN_SOURCE_READY",
    head, workingStatusAtCapture: retained?.workingStatusAtCapture ?? git(["status", "--short", "--", "artifacts/api-server/src", "artifacts/mariana-textil/src", "lib"]),
    baselineApi: path.relative(root, activeApi), baselineUi: path.relative(root, activeUi),
    baselineUiFrozen: path.relative(root, prior), baselineCombinedFrozen: path.relative(root, priorCombined),
    targetApi: `${api}/${output}`, targetUi: `${ui}/${output}`, targetFrozen: path.relative(root, frozen),
    uiHeadDifferences, guards,
    policy: "Apply only MAIN-approved driver-phone working diff to retained active runtime sources. Never replace runtime with HEAD or copy whole regenerated contract files.",
    databaseAccess: false, workflowChanges: false, runtimeChanges: false,
  });
  assert.ok(!uiHeadDifferences.includes(`${ui}/src/pages/configuracion/choferes.tsx`), "Retained chofer UI differs from HEAD");
  console.log(JSON.stringify({ status: "BASELINE_CAPTURED_AWAITING_MAIN_SOURCE_READY", head, uiHeadDifferences, provenancePath }, null, 2));
} else if (process.argv.includes("--finalize-typecheck")) {
  const manifestPath = path.join(report, "combined-build-manifest.json");
  const manifest = JSON.parse(read(manifestPath));
  const provenance = JSON.parse(read(provenancePath));
  assert.deepEqual(baselineGuards(), provenance.guards);
  assert.deepEqual(inventory(path.join(root, api, output), []), manifest.apiFiles);
  assert.deepEqual(inventory(path.join(root, ui, output), []), manifest.frontendFiles);
  assert.deepEqual(inventory(frozen), JSON.parse(read(path.join(report, "combined-source-delta-audit.json"))).after);
  retainTestSupport();
  const check = spawnSync(path.join(root, "node_modules/.bin/tsc"), ["--noEmit", "--incremental", "false", "-p", path.join(frozen, ui)], {
    cwd: frozen, encoding: "utf8", maxBuffer: 30e6,
  });
  write(path.join(report, "combined-ui-typecheck-first-attempt.log"), read(path.join(report, "combined-ui-typecheck.log")));
  write(path.join(report, "combined-ui-typecheck.log"), `${check.stdout ?? ""}${check.stderr ?? ""}`);
  manifest.checks = manifest.checks.map(c => c.name === "combined-ui-typecheck" ? { name: c.name, status: check.status, signal: check.signal } : c);
  manifest.status = manifest.checks.every(c => c.status === 0) ? "BUILT_TYPECHECKED_NOT_ACTIVATED" : "BUILT_VALIDATION_FAILED_NOT_ACTIVATED";
  manifest.recipeSha256 = sha(read(path.join(report, "build-combined.mjs")));
  manifest.typecheckSupportSha256 = sha(read(path.join(report, "retained-typecheck-support.json")));
  manifest.typecheckSupportNote = "Retained baseline reports/e7 test-only fixtures copied into frozen root; first UI typecheck failed because these prior symlinked fixtures were excluded, final check includes them. No production output or source change.";
  json(manifestPath, manifest);
  json(path.join(report, "candidate-ready.json"), { status: manifest.status, api: manifest.api, frontend: manifest.frontend, frozen: manifest.frozen });
  assert.equal(check.status, 0, "Final UI typecheck failed");
  console.log(JSON.stringify({ status: manifest.status, checks: manifest.checks, api: manifest.api, frontend: manifest.frontend }, null, 2));
} else if (process.argv.includes("--build")) {
  const provenance = JSON.parse(read(provenancePath));
  assert.deepEqual(baselineGuards(), provenance.guards, "Baseline drift");
  const approved = [
    `${api}/src/routes/choferes.ts`, `${api}/src/routes/viajes.ts`,
    `${ui}/src/pages/configuracion/choferes.tsx`,
    "lib/api-client-react/src/generated/api.schemas.ts", "lib/api-spec/openapi.yaml",
    "lib/api-zod/src/generated/api.ts",
    ...["chofer", "choferInput", "choferUpdate", "index"].map(n => `lib/api-zod/src/generated/types/${n}.ts`),
    "lib/db/src/lib/choferes-schema.ts", "lib/db/src/schema/choferes.ts",
  ];
  const added = [
    `${api}/src/routes/choferes.integration.test.ts`, `${api}/src/routes/choferes.test.ts`,
    `${ui}/src/pages/configuracion/chofer-telefonos.tsx`, `${ui}/src/pages/configuracion/choferes.test.tsx`,
    `${ui}/vitest.choferes.config.ts`, "lib/api-spec/generate-choferes.mjs",
    "lib/api-zod/src/generated/types/choferTelefono.ts", "lib/db/src/lib/choferes-schema.test.ts",
  ];
  const patchPath = path.join(report, "driver-source.patch");
  const snapshotPath = path.join(report, "overlay-inputs.json");
  if (!fs.existsSync(snapshotPath)) {
    const changed = git(["diff", "--name-only", provenance.head, "--", "artifacts/api-server/src", "artifacts/mariana-textil/src", "lib"]).trim().split("\n").filter(Boolean);
    assert.deepEqual(changed.sort(), [...approved].sort(), "Unapproved source changes");
    const patch = git(["diff", "--no-ext-diff", "--full-index", provenance.head, "--", ...approved]);
    write(patchPath, patch);
    for (const file of added) write(path.join(report, "overlay", file), read(path.join(root, file)));
    json(snapshotPath, {
      approved, added, patchSha256: sha(patch),
      addedHashes: Object.fromEntries(added.map(file => [file, sha(read(path.join(report, "overlay", file)))])),
      readyAuthorization: "MAIN source-ready followup: chofer phones, shared viajes projection, schema/initializer, contracts and tests only",
    });
  }
  const snapshot = JSON.parse(read(snapshotPath));
  assert.equal(sha(read(patchPath)), snapshot.patchSha256);
  for (const file of added) assert.equal(sha(read(path.join(report, "overlay", file))), snapshot.addedHashes[file]);
  if (process.argv.includes("--retry-unsealed")) {
    assert.ok(!fs.existsSync(path.join(report, "combined-build-manifest.json")), "Cannot overwrite sealed outputs");
    for (const dir of [frozen, path.join(root, api, output), path.join(root, ui, output)]) fs.rmSync(dir, { recursive: true, force: true });
  }
  if (process.argv.includes("--retry-prebuild")) {
    assert.ok(!fs.existsSync(path.join(root, api, output)) && !fs.existsSync(path.join(root, ui, output)), "Prebuild retry forbidden after output emission");
    fs.rmSync(frozen, { recursive: true, force: true });
  }
  assert.ok(!fs.existsSync(frozen), "Refusing to overwrite frozen source; inspect existing build before retry");
  const copyFilter = p => !["node_modules", "dist", "reports", ".vite", ".vite-temp"].includes(path.basename(p)) && !p.endsWith(".tsbuildinfo");
  fs.cpSync(priorCombined, frozen, { recursive: true, verbatimSymlinks: true, filter: copyFilter });
  fs.rmSync(path.join(frozen, ui), { recursive: true, force: true });
  fs.cpSync(path.join(prior, ui), path.join(frozen, ui), { recursive: true, verbatimSymlinks: true, filter: copyFilter });
  for (const file of ["tsconfig.base.json"]) {
    fs.rmSync(path.join(frozen, file), { force: true });
    write(path.join(frozen, file), read(path.join(priorCombined, file)));
  }
  const map = JSON.parse(read(path.join(activeApi, "index.mjs.map")));
  const original = new Map(map.sources.map((p, i) => [path.relative(root, path.resolve(activeApi, p)), map.sourcesContent[i]]));
  for (const [file, content] of original) if (!file.includes("node_modules")) write(path.join(frozen, file), content);
  const patches = read(patchPath).split(/(?=^diff --git )/m).filter(Boolean);
  const toolingInputs = [];
  for (const section of patches) {
    const file = section.match(/^diff --git a\/(.+) b\//)[1];
    if (!fs.existsSync(path.join(frozen, file))) {
      assert.ok(file.startsWith("lib/api-spec/"), `Missing retained source ${file}`);
      const content = git(["show", `${provenance.head}:${file}`]);
      write(path.join(frozen, file), content);
      toolingInputs.push({ file, source: `git:${provenance.head}`, sha256: sha(content), runtime: false });
    }
  }
  const before = inventory(frozen);
  for (const section of patches) {
    const file = section.match(/^diff --git a\/(.+) b\//)[1];
    let text = read(path.join(frozen, file));
    for (const match of section.matchAll(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@[^\n]*\n([\s\S]*?)(?=^@@|(?![\s\S]))/gm)) {
      const lines = match[2].split("\n").filter(l => /^[ +\-]/.test(l));
      let oldText = lines.filter(l => l[0] !== "+").map(l => l.slice(1)).join("\n") + "\n";
      let newText = lines.filter(l => l[0] !== "-").map(l => l.slice(1)).join("\n") + "\n";
      assert.ok(text.includes(oldText), `Frozen hunk context mismatch: ${file}\n${oldText}`);
      if (text.indexOf(oldText) !== text.lastIndexOf(oldText)) {
        const base = git(["show", `${provenance.head}:${file}`]).split("\n");
        const start = Number(match[1]) - 1;
        const end = start + oldText.split("\n").length - 1;
        let found = false;
        for (let count = 1; count <= 200; count++) {
          const prefix = base.slice(Math.max(0, start - count), start).join("\n") + "\n";
          if (text.includes(prefix + oldText) && text.indexOf(prefix + oldText) === text.lastIndexOf(prefix + oldText)) {
            oldText = prefix + oldText; newText = prefix + newText; found = true; break;
          }
          const suffix = base.slice(end, end + count).join("\n") + "\n";
          if (text.includes(oldText + suffix) && text.indexOf(oldText + suffix) === text.lastIndexOf(oldText + suffix)) {
            oldText += suffix; newText += suffix; found = true; break;
          }
        }
        assert.ok(found, `Cannot find unique unchanged context for ${file}`);
      }
      assert.equal(text.indexOf(oldText), text.lastIndexOf(oldText), `Ambiguous hunk ${file}`);
      text = text.replace(oldText, () => newText);
    }
    write(path.join(frozen, file), text);
  }
  for (const file of added) {
    assert.ok(!fs.existsSync(path.join(frozen, file)), `New source already exists ${file}`);
    write(path.join(frozen, file), read(path.join(report, "overlay", file)));
  }
  const after = inventory(frozen);
  const deltas = Object.keys(after).filter(file => JSON.stringify(before[file]) !== JSON.stringify(after[file])).map(file => ({
    file, beforeSha256: before[file] ?? null, sha256: after[file],
  }));
  assert.deepEqual(deltas.map(d => d.file).sort(), [...approved, ...added].sort());
  json(path.join(report, "combined-source-delta-audit.json"), {
    baseline: provenance.baselineUiFrozen, apiBaseline: provenance.baselineApi,
    patchSha256: snapshot.patchSha256, toolingInputs, deltas, before, after,
    policy: "Retained active source plus reviewed diff hunks only; no whole regenerated files copied.",
  });
  retainTestSupport();
  const packages = fs.readdirSync(path.join(frozen, "lib")).filter(p => fs.existsSync(path.join(frozen, "lib", p, "package.json")));
  for (const pkg of ["", api, ui, ...packages.map(p => `lib/${p}`)]) {
    const nm = path.join(frozen, pkg, "node_modules");
    fs.mkdirSync(nm, { recursive: true });
    const installed = path.join(root, pkg, "node_modules");
    if (fs.existsSync(installed)) for (const ent of fs.readdirSync(installed)) {
      if (ent !== "@workspace") fs.symlinkSync(path.join(installed, ent), path.join(nm, ent));
    }
    const links = path.join(nm, "@workspace");
    fs.mkdirSync(links, { recursive: true });
    for (const p of packages) fs.symlinkSync(path.join(frozen, "lib", p), path.join(links, p));
  }
  const req = createRequire(path.join(root, api, "build.mjs"));
  globalThis.require = req;
  const { build } = await import(req.resolve("esbuild"));
  const { default: pino } = await import(req.resolve("esbuild-plugin-pino"));
  const buildSource = read(path.join(frozen, api, "build.mjs"));
  const external = Function(`return ${buildSource.match(/external:\s*(\[[\s\S]*?\]),/)[1]}`)();
  const banner = buildSource.match(/js: `([\s\S]*?)`,/)[1];
  const apiOut = path.join(root, api, output);
  const uiOut = path.join(root, ui, output);
  assert.ok(!fs.existsSync(apiOut) && !fs.existsSync(uiOut), "Refusing to overwrite candidate outputs");
  await build({
    entryPoints: [path.join(root, api, "src/index.ts")], platform: "node", bundle: true, format: "esm",
    outdir: apiOut, outExtension: { ".js": ".mjs" }, external, sourcemap: "linked", banner: { js: banner },
    plugins: [{
      name: "strict-frozen-driver-phones",
      setup(b) {
        b.onResolve({ filter: /floor-order\.mjs$|entrada-floor-evidence$/ }, args => ({
          path: path.resolve(path.dirname(args.importer), args.path.endsWith(".mjs") ? args.path : `${args.path}.ts`),
        }));
        b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
          if (args.path.includes("node_modules")) return;
          const file = path.relative(root, args.path), dest = path.join(frozen, file);
          assert.ok(fs.existsSync(dest), `Unfrozen runtime input ${file}`);
          assert.ok(original.has(file) || approved.includes(file) || added.includes(file) || file.endsWith("/index.ts") || file.includes("/generated/types/"), `Unapproved runtime input ${file}`);
          return { contents: read(dest), loader: file.endsWith(".ts") ? "ts" : "js" };
        });
      },
    }, pino({ transports: ["pino-pretty"] })],
  });
  fs.cpSync(path.join(activeApi, "assets"), path.join(apiOut, "assets"), { recursive: true });
  const emitted = JSON.parse(read(path.join(apiOut, "index.mjs.map")));
  const apiInventory = emitted.sources.map((p, i) => {
    const file = path.relative(root, path.resolve(apiOut, p)), content = emitted.sourcesContent[i];
    if (file.includes("node_modules")) {
      assert.ok(original.has(file), `New dependency ${file}`);
      const normalize = s => file.endsWith("/pino/pino.js") ? s.replace(/const outputDir = "[^"]+";/, 'const outputDir = "<OUTPUT_DIR>";') : s;
      assert.equal(normalize(content), normalize(original.get(file)), `Dependency drift ${file}`);
    } else assert.equal(content, read(path.join(frozen, file)), `Source mismatch ${file}`);
    return { file, sha256: sha(content), beforeSha256: original.has(file) ? sha(original.get(file)) : null };
  });
  for (const file of original.keys()) assert.ok(apiInventory.some(i => i.file === file), `Missing retained source ${file}`);
  const runtimeDeltas = apiInventory.filter(i => !i.file.includes("node_modules") && i.sha256 !== i.beforeSha256);
  for (const delta of runtimeDeltas) assert.ok(approved.includes(delta.file) || added.includes(delta.file), `Unscoped runtime delta ${delta.file}`);
  json(path.join(report, "combined-api-source-inventory.json"), apiInventory);
  json(path.join(report, "combined-ui-source-inventory.json"), inventory(path.join(frozen, ui)));
  function run(name, bin, args, cwd = frozen) {
    const result = spawnSync(bin, args, {
      cwd, encoding: "utf8", maxBuffer: 30e6,
      env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" },
    });
    write(path.join(report, `${name}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`);
    console.log(`${name}: ${result.status}`);
    return { name, status: result.status, signal: result.signal };
  }
  const checks = [];
  checks.push(run("combined-ui-build", path.join(frozen, ui, "node_modules/.bin/vite"), ["build", "--config", path.join(frozen, ui, "vite.config.ts"), "--outDir", uiOut], path.join(frozen, ui)));
  json(path.join(report, "candidate-ready.json"), {
    status: checks[0].status === 0 ? "CANDIDATE_BUILT_TYPECHECKS_PENDING_NOT_ACTIVATED" : "UI_BUILD_FAILED",
    api: path.relative(root, apiOut), frontend: path.relative(root, uiOut), frozen: path.relative(root, frozen),
  });
  checks.push(run("combined-libs-typecheck", path.join(root, "node_modules/.bin/tsc"), ["-b", "--force", ...packages.filter(p => fs.existsSync(path.join(frozen, "lib", p, "tsconfig.json"))).map(p => path.join(frozen, "lib", p))]));
  for (const [name, pkg] of [["api", api], ["ui", ui]]) checks.push(run(`combined-${name}-typecheck`, path.join(root, "node_modules/.bin/tsc"), ["--noEmit", "--incremental", "false", "-p", path.join(frozen, pkg)]));
  for (const file of fs.readdirSync(apiOut).filter(f => f.endsWith(".mjs"))) checks.push(run(`syntax-${file}`, process.execPath, ["--check", path.join(apiOut, file)]));
  assert.deepEqual(inventory(frozen), after, "Build/typecheck changed frozen source");
  assert.deepEqual(baselineGuards(), provenance.guards, "Build changed baseline inputs");
  const apiFiles = inventory(apiOut, []), frontendFiles = inventory(uiOut, []);
  for (const [name, dir, files] of [["api", apiOut, apiFiles], ["frontend", uiOut, frontendFiles]]) {
    write(path.join(report, `${name}.sha256`), Object.entries(files).map(([file, hash]) => `${hash}  ${path.relative(root, path.join(dir, file))}\n`).join(""));
  }
  const manifest = {
    status: checks.every(c => c.status === 0) ? "BUILT_TYPECHECKED_NOT_ACTIVATED" : "BUILT_VALIDATION_FAILED_NOT_ACTIVATED",
    api: path.relative(root, apiOut), frontend: path.relative(root, uiOut), frozen: path.relative(root, frozen),
    checks, apiFiles, frontendFiles, apiRuntimeSourceDeltas: runtimeDeltas,
    patchSha256: snapshot.patchSha256, recipeSha256: sha(read(path.join(report, "build-combined.mjs"))),
    sourceDeltaAuditSha256: sha(read(path.join(report, "combined-source-delta-audit.json"))),
    apiInventorySha256: sha(read(path.join(report, "combined-api-source-inventory.json"))),
    uiInventorySha256: sha(read(path.join(report, "combined-ui-source-inventory.json"))),
    baselineProvenanceSha256: sha(read(provenancePath)), baselineInputsUnchanged: true,
    typecheckSupportSha256: sha(read(path.join(report, "retained-typecheck-support.json"))),
    dependencyException: "Only esbuild-plugin-pino generated outputDir differs; all other mapped dependency contents unchanged.",
    databaseAccess: false, workflowChanges: false, runtimeChanges: false,
    validationGaps: ["No runtime or browser verification by build worker; MAIN owns browser verification.",
      "Frozen typechecks include all retained sources plus new tests; unrelated HEAD-only API tests omitted from active runtime baseline are not imported."],
  };
  json(path.join(report, "combined-build-manifest.json"), manifest);
  console.log(JSON.stringify({ status: manifest.status, checks, api: manifest.api, frontend: manifest.frontend }, null, 2));
  assert.ok(checks.every(c => c.status === 0), "Validation failed; see check logs");
} else {
  throw new Error("Build is gated on MAIN source-ready followup. Use --prepare only until the approved overlay is captured.");
}